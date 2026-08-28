from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "sample_data"
OUT.mkdir(exist_ok=True)

W, H = 612.0, 792.0
CANVAS_W = 1240

GRAY = (0.42, 0.42, 0.42)
BLACK = (0, 0, 0)


def _meta(producer="ADP Payroll System v2026.1", creation=None, mod=None, title="2026 Wage and Tax Statement", author="Acme Manufacturing Inc. — Payroll"):
    m = {
        "title": title,
        "author": author,
        "subject": "Wage and Tax Statement (Copy B)",
        "creator": producer,
        "producer": producer,
        "creationDate": creation or pymupdf.get_pdf_now(),
    }
    if mod:
        m["modDate"] = mod
    return m


def _box(page, x, y, w, h, label, value, value_x=None, value_font=("Times-Roman", 11), label_font=("Helvetica", 7)):
    page.draw_rect(pymupdf.Rect(x, y, x + w, y + h), color=BLACK, width=0.8)
    page.insert_text((x + 4, y + 10), label, fontname=label_font[0], fontsize=label_font[1], color=GRAY)
    page.insert_text((value_x if value_x is not None else x + 8, y + 34), value, fontname=value_font[0], fontsize=value_font[1], color=BLACK)


def make_w2(path, tamper=None):
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)

    t = tamper or {}

    page.draw_rect(pymupdf.Rect(32, 28, W - 32, H - 24), color=BLACK, width=1.2)
    page.insert_textbox(
        pymupdf.Rect(40, 38, W - 40, 64),
        "Form W-2  Wage and Tax Statement",
        fontname="Helvetica-Bold", fontsize=15, align=1,
    )
    page.insert_textbox(
        pymupdf.Rect(40, 66, W - 40, 84),
        "Copy B — To Be Filed With Employee's FEDERAL Tax Return",
        fontname="Helvetica", fontsize=9, align=1,
    )
    page.insert_textbox(
        pymupdf.Rect(40, 82, W - 40, 98),
        "Department of the Treasury — Internal Revenue Service",
        fontname="Helvetica", fontsize=8, align=1, color=GRAY,
    )

    def f(name, x, y, w, h, label, value, **kw):
        spec = t.get(name, {})
        x = spec.get("x", x)
        y = spec.get("y", y)
        font = spec.get("font", kw.pop("value_font", ("Times-Roman", 11)))
        vx = spec.get("vx")
        _box(page, x, y, w, h, label, spec.get("value", value), value_x=vx, value_font=font, **kw)

    f("ssn", 40, 108, 262, 52, "a. Employee's social security number", "123-45-6789")
    f("ein", 312, 108, 262, 52, "b. Employer identification number (EIN)", "12-3456789")
    f("employer", 40, 170, 262, 66, "c. Employer's name, address, and ZIP code",
      "Acme Manufacturing Inc.\n1400 Industrial Parkway, Suite 4\nSpringfield, IL 62704")
    f("control", 312, 170, 262, 66, "d. Control number", "2026-ACME-0943")
    f("ename", 40, 246, 262, 52, "e. Employee's first name and initial   Last name   Suff.",
      "JOHN A   DOE")
    f("eaddr", 312, 246, 262, 52, "f. Employee's address and ZIP code",
      "2210 Baker Street, Apt 7B\nSpringfield, IL 62704")

    f("box1", 40, 322, 262, 46, "1. Wages, tips, other compensation", "$158,650.00")
    f("box2", 40, 380, 262, 46, "2. Federal income tax withheld", "$23,415.00")
    f("box3", 40, 438, 262, 46, "3. Social security wages", "$168,600.00")
    f("box4", 40, 496, 262, 46, "4. Social security tax withheld", "$10,453.20")
    f("box5", 40, 554, 262, 46, "5. Medicare wages and tips", "$168,600.00")
    f("box6", 40, 612, 262, 46, "6. Medicare tax withheld", "$2,444.70")

    f("box7", 312, 322, 262, 46, "7. Social security tips", "$0.00")
    f("box8", 312, 380, 262, 46, "8. Allocated tips", "$0.00")
    f("box10", 312, 438, 262, 46, "10. Dependent care benefits", "$0.00")
    f("box11", 312, 496, 262, 46, "11. Nonqualified plans", "$0.00")
    f("box12", 312, 554, 262, 46, "12a. Code DD  Value  | 12b. Code C  Value", "DD  $0.00      C  $0.00")
    f("box14", 312, 612, 262, 46, "14. Other", "Uniform allow  $250.00")

    f("state", 40, 672, 534, 56, "15-20. State / Employer's state ID  State wages, tips  State income tax  Local wages  Local tax  Locality",
      "IL  56123456  $158,650.00  $9,518.99   $158,650.00  $2,218.50   SPRINGFIELD")

    for key in list(t.keys()):
        if key == "sticker" or key.startswith("sc"):
            s = t[key]
            page.insert_image(pymupdf.Rect(s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]), filename=str(s["img"]))
            page.draw_rect(pymupdf.Rect(s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]), color=(0.3, 0.3, 0.3), width=0.6)

    doc.set_metadata(_meta(**t.get("meta", {})))
    doc.save(str(path))
    doc.close()
    return path


def render_png(pdf_path: Path, png_path: Path | None = None, canvas_w=CANVAS_W):
    png_path = png_path or pdf_path.with_suffix(".png")
    doc = pymupdf.open(str(pdf_path))
    page = doc[0]
    k = canvas_w / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(k, k), colorspace=pymupdf.csRGB, alpha=False)
    pix.save(str(png_path))
    doc.close()
    return png_path


def _sticker(text, path, px=340, py=42):
    img = Image.new("RGB", (px, py), "white")
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("arial.ttf", 34)
    except Exception:
        font = ImageFont.load_default()
    d.text((10, 2), text, fill="black", font=font)
    img.save(str(path))
    return path


def forge_w2_variants():
    out = []

    gen = OUT / "genuine_w2.pdf"
    make_w2(gen)
    render_png(gen)
    out.append(("w2_genuine", gen, 0))

    v1 = OUT / "forged_w2_wages.pdf"
    make_w2(v1, tamper={
        "box1": {"value": "$999,999.99", "font": ("Courier", 16), "vx": 300},
        "box2": {"value": "zz 99,999.99", "font": ("Helvetica-Oblique", 20), "vx": 340},
    })
    render_png(v1)
    out.append(("w2_wages", v1, 1))

    sticker_img = OUT / "ssn_sticker.png"
    _sticker("765-43-2109", sticker_img)
    ctrl_img = OUT / "control_sticker.png"
    _sticker("0421-XXX-99311", ctrl_img)
    v2 = OUT / "forged_w2_ssn.pdf"
    make_w2(v2, tamper={"sticker": {"img": sticker_img, "x": 44, "y": 114, "w": 252, "h": 40}})
    render_png(v2)
    out.append(("w2_ssn", v2, 2))

    v3 = OUT / "forged_w2_metadata.pdf"
    make_w2(v3, tamper={"meta": {"producer": "Adobe Photoshop CS6 (Windows)", "creation": "D:20240215091500Z", "mod": "D:20260602081210Z"}})
    render_png(v3)
    out.append(("w2_metadata", v3, 3))

    v4 = OUT / "forged_demo_w2.pdf"
    make_w2(v4, tamper={
        "box1": {"value": "$999,999.99", "font": ("Courier", 18), "vx": 300},
        "box2": {"value": "ZZZZZZZZ", "font": ("ZapfDingbats", 9), "vx": 340},
        "box3": {"value": "$999,999.99", "font": ("Symbol", 18), "vx": 310},
        "box4": {"value": "$99,999.99", "font": ("Helvetica-Oblique", 21), "vx": 350},
        "ename": {"value": "JOHN DOE", "font": ("Times-Bold", 14)},
        "employer": {"value": "ACME MANUFACTURING\n1400 Industrial Parkway\nSpringfield, IL 62704"},
        "sticker": {"img": sticker_img, "x": 44, "y": 114, "w": 252, "h": 40},
        "sc2": {"img": ctrl_img, "x": 316, "y": 176, "w": 252, "h": 40},
        "sc3": {"img": ctrl_img, "x": 44, "y": 328, "w": 252, "h": 40},
        "sc4": {"img": ctrl_img, "x": 316, "y": 386, "w": 252, "h": 40},
        "meta": {"producer": "Adobe Photoshop CS6 (Windows)", "creation": "D:20240215091500Z", "mod": "D:20260602081210Z"},
    })
    render_png(v4)
    out.append(("w2_demo", v4, 4))

    return out


if __name__ == "__main__":
    for name, path, _ in forge_w2_variants():
        print(name, "->", path)