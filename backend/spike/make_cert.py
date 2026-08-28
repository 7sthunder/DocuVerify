import pymupdf
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "sample_data"
OUT.mkdir(exist_ok=True)

PDF_PATH = OUT / "genuine_cert.pdf"
PNG_PATH = OUT / "genuine_cert.png"
CANVAS_W = 1240

W, H = 595.27, 841.89


def make_cert(
    path=PDF_PATH,
    student="RAHUL KUMAR",
    class_year="2021 - 2025",
    cgpa="8.70",
    regno="REG-2021-0487",
    issue_date="15 July 2025",
    producer="ABC University Document System v2.1",
    creation=None,
    mod=None,
    cgpa_font=None,
):
    doc = pymupdf.open()
    page = doc.new_page(width=W, height=H)

    page.draw_rect(pymupdf.Rect(20, 20, W - 20, H - 20), color=(0.0, 0.3, 0.6), width=2.5)
    page.draw_rect(pymupdf.Rect(26, 26, W - 26, H - 26), color=(0.0, 0.3, 0.6), width=0.8)

    cx = W / 2
    univ = pymupdf.Rect(0, 90, W, 130)
    page.insert_textbox(univ, "ABC UNIVERSITY OF TECHNOLOGY", fontname="Times-Bold", fontsize=22, align=1, color=(0.0, 0.25, 0.55))

    seal_c = pymupdf.Point(cx, 190)
    page.draw_circle(seal_c, 46, color=(0.0, 0.25, 0.55), width=2.0)
    page.draw_circle(seal_c, 40, color=(0.0, 0.25, 0.55), width=1.0)
    page.insert_textbox(pymupdf.Rect(cx - 40, 140, cx + 40, 180), "UNIVERSITY\nEMBLEM", fontname="Helvetica", fontsize=9, align=1, color=(0.0, 0.25, 0.55))

    page.insert_textbox(pymupdf.Rect(0, 255, W, 300), "CERTIFICATE OF COMPLETION", fontname="Helvetica-Bold", fontsize=17, align=1)

    page.insert_textbox(pymupdf.Rect(0, 318, W, 342), "This is to certify that", fontname="Times-Roman", fontsize=13, align=1)

    nrect = pymupdf.Rect(60, 360, W - 60, 405)
    page.insert_textbox(nrect, student, fontname="Times-Bold", fontsize=20, align=1)

    page.insert_textbox(
        pymupdf.Rect(90, 420, W - 90, 470),
        "has successfully completed the Bachelor of Technology (B.Tech) program in Computer Science and Engineering "
        "from this university, having fulfilled all academic requirements prescribed by the university.",
        fontname="Times-Roman",
        fontsize=12,
        align=1,
    )

    page.insert_textbox(pymupdf.Rect(90, 505, W - 90, 530), f"Program Duration:  {class_year}", fontname="Times-Roman", fontsize=12)
    cf = cgpa_font or ("Times-Roman", 12)
    page.insert_textbox(pymupdf.Rect(90, 535, W - 90, 560), f"Final CGPA:  {cgpa}  (out of 10.00)", fontname=cf[0], fontsize=cf[1])
    page.insert_textbox(pymupdf.Rect(90, 565, W - 90, 590), f"Registration Number:  {regno}", fontname="Times-Roman", fontsize=12)
    page.insert_textbox(pymupdf.Rect(90, 595, W - 90, 620), f"Date of Issue:  {issue_date}", fontname="Times-Roman", fontsize=12)

    page.draw_line(pymupdf.Point(330, 700), pymupdf.Point(540, 700), color=(0, 0, 0), width=1.0)
    page.insert_text(pymupdf.Point(345, 720), "Registrar", fontname="Helvetica", fontsize=11)
    page.draw_line(pymupdf.Point(70, 700), pymupdf.Point(260, 700), color=(0, 0, 0), width=1.0)
    page.insert_text(pymupdf.Point(120, 720), "Dean (Academic Affairs)", fontname="Helvetica", fontsize=11)

    page.insert_textbox(pymupdf.Rect(0, 775, W, 800), f"Certificate ID: {regno} | Verify at https://verify.abcuniv.edu.in", fontname="Helvetica", fontsize=9, align=1, color=(0.35, 0.35, 0.35))

    meta = {
        "title": "Certificate of Completion",
        "author": "ABC University of Technology",
        "creator": producer,
        "producer": producer,
        "creationDate": creation or pymupdf.get_pdf_now(),
    }
    if mod:
        meta["modDate"] = mod
    doc.set_metadata(meta)
    doc.save(str(path))
    doc.close()
    return path


def render_png(pdf_path=PDF_PATH, png_path=PNG_PATH, canvas_w=CANVAS_W):
    doc = pymupdf.open(str(pdf_path))
    page = doc[0]
    k = canvas_w / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(k, k), colorspace=pymupdf.csRGB, alpha=False)
    pix.save(str(png_path))
    doc.close()
    return png_path


if __name__ == "__main__":
    make_cert()
    render_png()
    print(f"wrote: {PDF_PATH}")
    print(f"wrote: {PNG_PATH}")