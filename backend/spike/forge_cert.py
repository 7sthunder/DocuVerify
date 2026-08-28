from pathlib import Path

import pymupdf
from PIL import Image

from make_cert import CANVAS_W, PDF_PATH, W, H, make_cert, render_png

OUT = Path(__file__).resolve().parent.parent / "sample_data"


def _rustic_logo_png(path: Path, size=48):
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            r, g, b = 198, 152, 66
            px[x, y] = (r, g, b) if (x + y) % 9 < 3 else (r, min(g + 40, 255), b)
    img.save(str(path))


def forge_variants():
    out = []

    gen = OUT / "genuine_cert.pdf"
    make_cert(gen)
    render_png(gen)
    out.append(("genuine", gen, 0))

    v1 = OUT / "forged_name.pdf"
    make_cert(v1, student="VIKAS DIWAKER")
    render_png(v1)
    out.append(("forged_name", v1, 1))

    v2 = OUT / "forged_cgpa.pdf"
    make_cert(v2, cgpa="15.75")
    render_png(v2)
    out.append(("forged_cgpa", v2, 2))

    v3 = OUT / "forged_date.pdf"
    make_cert(v3, issue_date="12 March 2022")
    render_png(v3)
    out.append(("forged_date", v3, 3))

    v4 = OUT / "forged_font.pdf"
    _rustic_font_cert(v4)
    out.append(("forged_font", v4, 4))

    v5 = OUT / "forged_shift.pdf"
    _shift_field_cert(v5)
    out.append(("forged_shift", v5, 5))

    v6 = OUT / "forged_metadata.pdf"
    _metadata_cert(v6)
    out.append(("forged_metadata", v6, 6))

    v7 = OUT / "forged_logo.pdf"
    _logo_cert(v7)
    out.append(("forged_logo", v7, 7))

    vd = OUT / "forged_demo.pdf"
    make_cert(
        vd,
        student="VIKAS DIWAKER",
        cgpa="15.75",
        issue_date="12 March 2022",
        producer="Adobe Photoshop CS6 (Windows)",
        cgpa_font=("Courier-Bold", 9),
        mod="D:20250602091210Z",
    )
    render_png(vd)
    out.append(("forged_demo", vd, 8))

    return out


def _rustic_font_cert(path):
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.draw_rect(pymupdf.Rect(20, 20, W - 20, H - 20), color=(0.0, 0.3, 0.6), width=2.5)
    page.draw_rect(pymupdf.Rect(26, 26, W - 26, H - 26), color=(0.0, 0.3, 0.6), width=0.8)
    cx = W / 2
    page.insert_textbox(pymupdf.Rect(0, 90, W, 130), "ABC UNIVERSITY OF TECHNOLOGY", fontname="Times-Bold", fontsize=22, align=1, color=(0.0, 0.25, 0.55))
    page.draw_circle(pymupdf.Point(cx, 190), 46, color=(0.0, 0.25, 0.55), width=2.0)
    page.draw_circle(pymupdf.Point(cx, 190), 40, color=(0.0, 0.25, 0.55), width=1.0)
    page.insert_textbox(pymupdf.Rect(cx - 40, 140, cx + 40, 180), "UNIVERSITY\nEMBLEM", fontname="Helvetica", fontsize=9, align=1, color=(0.0, 0.25, 0.55))
    page.insert_textbox(pymupdf.Rect(0, 255, W, 300), "CERTIFICATE OF COMPLETION", fontname="Helvetica-Bold", fontsize=17, align=1)
    page.insert_textbox(pymupdf.Rect(0, 318, W, 342), "This is to certify that", fontname="Times-Roman", fontsize=13, align=1)
    page.insert_textbox(pymupdf.Rect(60, 360, W - 60, 405), "RAHUL KUMAR", fontname="Times-Bold", fontsize=20, align=1)
    page.insert_textbox(
        pymupdf.Rect(90, 420, W - 90, 470),
        "has successfully completed the Bachelor of Technology (B.Tech) program in Computer Science and Engineering "
        "from this university, having fulfilled all academic requirements prescribed by the university.",
        fontname="Times-Roman", fontsize=12, align=1,
    )
    page.insert_textbox(pymupdf.Rect(90, 505, W - 90, 530), f"Program Duration:  2021 - 2025", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(90, 535, W - 90, 560), "Final CGPA:  8.70  (out of 10.00)", fontname="Courier-Bold", fontsize=9)
    page.insert_textbox(pymupdf.Rect(90, 565, W - 90, 590), f"Registration Number:  REG-2021-0487", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(90, 595, W - 90, 620), "Date of Issue:  15 July 2025", fontname="Times-Roman", fontsize=12)
    page.draw_line(pymupdf.Point(330, 700), pymupdf.Point(540, 700), color=(0, 0, 0), width=1.0)
    page.insert_text(pymupdf.Point(345, 720), "Registrar", fontname="Helvetica", fontsize=11)
    page.draw_line(pymupdf.Point(70, 700), pymupdf.Point(260, 700), color=(0, 0, 0), width=1.0)
    page.insert_text(pymupdf.Point(120, 720), "Dean (Academic Affairs)", fontname="Helvetica", fontsize=11)
    page.insert_textbox(pymupdf.Rect(0, 775, W, 800), "Certificate ID: REG-2021-0487 | Verify at https://verify.abcuniv.edu.in", fontname="Helvetica", fontsize=9, align=1, color=(0.35, 0.35, 0.35))
    doc.set_metadata({"title": "Certificate of Completion", "author": "ABC University of Technology", "creator": "ABC University Document System v2.1", "producer": "ABC University Document System v2.1", "creationDate": pymupdf.get_pdf_now()})
    doc.save(str(path))
    doc.close()
    render_png(path)


def _shift_field_cert(path):
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.draw_rect(pymupdf.Rect(20, 20, W - 20, H - 20), color=(0.0, 0.3, 0.6), width=2.5)
    page.draw_rect(pymupdf.Rect(26, 26, W - 26, H - 26), color=(0.0, 0.3, 0.6), width=0.8)
    cx = W / 2
    page.insert_textbox(pymupdf.Rect(0, 90, W, 130), "ABC UNIVERSITY OF TECHNOLOGY", fontname="Times-Bold", fontsize=22, align=1, color=(0.0, 0.25, 0.55))
    page.draw_circle(pymupdf.Point(cx, 190), 46, color=(0.0, 0.25, 0.55), width=2.0)
    page.draw_circle(pymupdf.Point(cx, 190), 40, color=(0.0, 0.25, 0.55), width=1.0)
    page.insert_textbox(pymupdf.Rect(cx - 40, 140, cx + 40, 180), "UNIVERSITY\nEMBLEM", fontname="Helvetica", fontsize=9, align=1, color=(0.0, 0.25, 0.55))
    page.insert_textbox(pymupdf.Rect(0, 255, W, 300), "CERTIFICATE OF COMPLETION", fontname="Helvetica-Bold", fontsize=17, align=1)
    page.insert_textbox(pymupdf.Rect(0, 318, W, 342), "This is to certify that", fontname="Times-Roman", fontsize=13, align=1)
    page.insert_textbox(pymupdf.Rect(60, 360, W - 60, 405), "RAHUL KUMAR", fontname="Times-Bold", fontsize=20, align=1)
    page.insert_textbox(
        pymupdf.Rect(90, 420, W - 90, 470),
        "has successfully completed the Bachelor of Technology (B.Tech) program in Computer Science and Engineering "
        "from this university, having fulfilled all academic requirements prescribed by the university.",
        fontname="Times-Roman", fontsize=12, align=1,
    )
    page.insert_textbox(pymupdf.Rect(90, 505, W - 90, 530), f"Program Duration:  2021 - 2025", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(90, 535, W - 90, 560), "Final CGPA:  8.70  (out of 10.00)", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(90, 565, W - 90, 590), f"Registration Number:  REG-2021-0487", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(300, 595, W - 90, 620), "Date of Issue:  15 July 2025", fontname="Times-Roman", fontsize=12)
    page.draw_line(pymupdf.Point(330, 700), pymupdf.Point(540, 700), color=(0, 0, 0), width=1.0)
    page.insert_text(pymupdf.Point(345, 720), "Registrar", fontname="Helvetica", fontsize=11)
    page.draw_line(pymupdf.Point(70, 700), pymupdf.Point(260, 700), color=(0, 0, 0), width=1.0)
    page.insert_text(pymupdf.Point(120, 720), "Dean (Academic Affairs)", fontname="Helvetica", fontsize=11)
    page.insert_textbox(pymupdf.Rect(0, 775, W, 800), "Certificate ID: REG-2021-0487 | Verify at https://verify.abcuniv.edu.in", fontname="Helvetica", fontsize=9, align=1, color=(0.35, 0.35, 0.35))
    doc.set_metadata({"title": "Certificate of Completion", "author": "ABC University of Technology", "creator": "ABC University Document System v2.1", "producer": "ABC University Document System v2.1", "creationDate": pymupdf.get_pdf_now()})
    doc.save(str(path))
    doc.close()
    render_png(path)


def _metadata_cert(path):
    make_cert(
        path,
        producer="Adobe Photoshop CS6 (Windows)",
        creation="D:20090312083644Z",
        mod="D:20250602091210Z",
    )


def _logo_cert(path):
    logo = OUT / "logo_40x40.png"
    _rustic_logo_png(logo, 48)
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)
    page.draw_rect(pymupdf.Rect(20, 20, W - 20, H - 20), color=(0.0, 0.3, 0.6), width=2.5)
    page.draw_rect(pymupdf.Rect(26, 26, W - 26, H - 26), color=(0.0, 0.3, 0.6), width=0.8)
    cx = W / 2
    page.insert_textbox(pymupdf.Rect(0, 90, W, 130), "ABC UNIVERSITY OF TECHNOLOGY", fontname="Times-Bold", fontsize=22, align=1, color=(0.0, 0.25, 0.55))
    page.insert_image(pymupdf.Rect(cx - 60, 130, cx + 60, 250), filename=str(logo))
    page.insert_textbox(pymupdf.Rect(0, 255, W, 300), "CERTIFICATE OF COMPLETION", fontname="Helvetica-Bold", fontsize=17, align=1)
    page.insert_textbox(pymupdf.Rect(0, 318, W, 342), "This is to certify that", fontname="Times-Roman", fontsize=13, align=1)
    page.insert_textbox(pymupdf.Rect(60, 360, W - 60, 405), "RAHUL KUMAR", fontname="Times-Bold", fontsize=20, align=1)
    page.insert_textbox(
        pymupdf.Rect(90, 420, W - 90, 470),
        "has successfully completed the Bachelor of Technology (B.Tech) program in Computer Science and Engineering "
        "from this university, having fulfilled all academic requirements prescribed by the university.",
        fontname="Times-Roman", fontsize=12, align=1,
    )
    page.insert_textbox(pymupdf.Rect(90, 505, W - 90, 530), f"Program Duration:  2021 - 2025", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(90, 535, W - 90, 560), "Final CGPA:  8.70  (out of 10.00)", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(90, 565, W - 90, 590), f"Registration Number:  REG-2021-0487", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(90, 595, W - 90, 620), "Date of Issue:  15 July 2025", fontname="Times-Roman", fontsize=12)
    page.draw_line(pymupdf.Point(330, 700), pymupdf.Point(540, 700), color=(0, 0, 0), width=1.0)
    page.insert_text(pymupdf.Point(345, 720), "Registrar", fontname="Helvetica", fontsize=11)
    page.draw_line(pymupdf.Point(70, 700), pymupdf.Point(260, 700), color=(0, 0, 0), width=1.0)
    page.insert_text(pymupdf.Point(120, 720), "Dean (Academic Affairs)", fontname="Helvetica", fontsize=11)
    page.insert_textbox(pymupdf.Rect(0, 775, W, 800), "Certificate ID: REG-2021-0487 | Verify at https://verify.abcuniv.edu.in", fontname="Helvetica", fontsize=9, align=1, color=(0.35, 0.35, 0.35))
    doc.set_metadata({"title": "Certificate of Completion", "author": "ABC University of Technology", "creator": "ABC University Document System v2.1", "producer": "ABC University Document System v2.1", "creationDate": pymupdf.get_pdf_now()})
    doc.save(str(path))
    doc.close()
    render_png(path)


if __name__ == "__main__":
    for name, path, _ in forge_variants():
        print(name, "->", path)