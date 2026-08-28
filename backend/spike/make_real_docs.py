"""Generate a reproducible corpus of realistic, structurally-diverse LEGITIMATE documents.

Each document is clean by construction (consistent values, matching metadata, no tampering)
and exercises realistic typography, multi-column alignment, tables, centered headings and
embedded artwork — exactly the things a real-world document has and a naive analyzer flags.
"""
from pathlib import Path

import pymupdf
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "sample_data" / "real"
K = 1240
PW = 595.27
PH = 841.89
LEFT = 49600
RIGHT = 710000
INK = (0.12, 0.16, 0.24)
BLUE = (0.0, 0.27, 0.55)


def _tb(page, x0, y0, x1, y1, text, font, size, align=0, color=INK):
    page.insert_textbox(
        pymupdf.Rect(x0 / K, y0 / K, x1 / K, y1 / K),
        text,
        fontname=font,
        fontsize=size / K,
        align=align,
        color=color,
    )


def _row(page, y0, text, size=12400):
    _tb(page, LEFT, y0, RIGHT, y0 + round(size * 1.4), text, "Helvetica", size)


def _meta(doc, title, author, producer):
    doc.set_metadata(
        {
            "title": title,
            "author": author,
            "creator": producer,
            "producer": producer,
            "creationDate": pymupdf.get_pdf_now(),
        }
    )


def _new_page():
    doc = pymupdf.open()
    page = doc.new_page(width=PW, height=PH)
    return doc, page


_TB_SET: dict[int, str] = {}


def _textbox(doc, page, kind, key, x0, y0, x1, y1, text, font, size, align=0):
    return _tb(page, x0, y0, x1, y1, text, font, size, align)


# ---------------------------------------------------------------- images ----


def _logo_png(path: Path):
    img = Image.new("RGB", (200, 200), (198, 152, 66))
    px = img.load()
    for y in range(200):
        for x in range(200):
            dx, dy = x - 100, y - 100
            if dx * dx + dy * dy <= 94 * 94:
                px[x, y] = (120, 74, 20) if (x + y) % 11 < 4 else (198, 152, 66)
    img.save(str(path))


def _seal_png(path: Path, size=160):
    img = Image.new("RGB", (size, size), "white")
    px = img.load()
    cx = cy = size // 2
    r_out = size * 0.42
    for y in range(size):
        for x in range(size):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            if d <= r_out:
                px[x, y] = (18, 68, 130)
    for ring in (r_out - 4, r_out - 10, r_out - 18):
        for y in range(size):
            for x in range(size):
                d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
                if abs(d - ring) <= 1.5:
                    px[x, y] = (212, 192, 110)
    img.save(str(path))


def _barcode_png(path: Path, width=220, height=52):
    import random

    rng = random.Random(7)
    img = Image.new("1", (width, height), 1)
    px = img.load()
    x = 0
    while x < width - 4:
        bw = rng.choice((2, 3, 4, 5))
        if rng.random() < 0.55:
            for xx in range(x, min(x + bw, width)):
                for yy in range(height):
                    px[xx, yy] = 0
        x += bw
    img.save(str(path))


# ------------------------------------------------------------ documents ----


def retail_invoice(out: Path) -> Path:
    doc, page = _new_page()
    _tb(page, LEFT, 32000, 560000, 70000, "CROMA RETAIL (INDIA) LIMITED", "Helvetica-Bold", 19840)
    _tb(page, LEFT, 78000, 400000, 108000, "Croma Store 0421 | Virinchi Mall, Banjara Hills, Hyderabad 500034", "Helvetica", 11160)
    _tb(page, 560000, 32000, RIGHT, 70000, "TAX INVOICE", "Helvetica-Bold", 18600, align=2)
    _tb(page, 560000, 70000, RIGHT, 98000, "Invoice No: INV-2026-0045", "Helvetica", 11160, align=2)
    _tb(page, 560000, 98000, RIGHT, 126000, "Dated: 27 May 2026", "Helvetica", 11160, align=2)

    _tb(page, LEFT, 180000, 250000, 210000, "Bill To:", "Helvetica-Bold", 12400)
    _row(page, 228000, "John Doe", 13640)
    _row(page, 256000, "2210 Baker Street, Apt 7B")
    _row(page, 284000, "Hyderabad, Telangana 500034")
    _tb(page, 409200, 226000, 700000, 252000, "GSTIN: 36AABCR3217K1ZB", "Helvetica", 12400)
    _tb(page, 409200, 252000, 700000, 278000, "State: Telangana (36)", "Helvetica", 12400)
    _tb(page, 409200, 278000, 700000, 304000, "Phone: +91 98480 12345", "Helvetica", 12400)

    hdr_col = [(49600, 80000), (86800, 440000), (446400, 465000), (533200, 554000), (632400, 654000)]
    yy = 325000
    for text, (x0, x1) in zip(["#", "Item Description", "Qty", "Rate", "Amount"], hdr_col):
        _tb(page, x0, yy, x1, yy + 22000, text, "Helvetica-Bold", 11160)
    rows = [
        ("1", "Samsung Galaxy S24 8/256GB", "1", "Rs 67,999.00", "Rs 67,999.00"),
        ("2", "JBL Tune 510BT Headphones", "2", "Rs 2,499.00", "Rs 4,998.00"),
        ("3", "SanDisk 64GB Pendrive", "1", "Rs 649.00", "Rs 649.00"),
        ("4", "USB-C Fast Charger 33W", "1", "Rs 1,299.00", "Rs 1,299.00"),
    ]
    y = 358000
    for r in rows:
        for text, (x0, x1) in zip(r, hdr_col):
            _tb(page, x0, y, x1, y + 22000, text, "Helvetica", 12400)
        y += 34000

    _tb(page, 409200, 500000, 490000, 528000, "Subtotal", "Helvetica", 12400)
    _tb(page, 632400, 500000, 654000, 528000, "Rs 74,945.00", "Helvetica", 12400)
    _tb(page, 409200, 528000, 490000, 556000, "CGST 9% + SGST 9%", "Helvetica", 12400)
    _tb(page, 632400, 528000, 654000, 556000, "Rs 13,490.10", "Helvetica", 12400)
    _tb(page, 409200, 566000, 500000, 594000, "TOTAL", "Helvetica-Bold", 14880)
    _tb(page, 617520, 566000, 654000, 594000, "Rs 88,435.10", "Helvetica", 12400)

    _tb(page, 500000, 700000, 654000, 726000, "*CROMA-2026-0045*", "Helvetica", 11160)
    _tb(page, LEFT, 800000, 420000, 824000, "Terms: Goods once sold will not be taken back. EMI available on select cards.", "Helvetica", 9920)
    _tb(page, 446400, 800000, 654000, 824000, "Authorized Signatory: For Croma Retail India Ltd.", "Helvetica", 9920)

    _meta(doc, "Tax Invoice", "Croma Retail (India) Limited", "Croma Retail Systems v3.1")
    out.write_bytes(doc.tobytes())
    doc.close()
    return out


def degree_certificate(out: Path, logo_png: Path) -> Path:
    _seal_png(logo_png)
    doc, page = _new_page()
    page.insert_image(pymupdf.Rect(295000 / K, 146000 / K, 440000 / K, 291000 / K), filename=str(logo_png))

    cx0 = 110000
    cx1 = 629000
    _tb(page, cx0, 316000, cx1, 348000, "CERTIFICATE OF COMPLETION", "Helvetica-Bold", 21080, align=1)
    _tb(page, cx0, 394000, cx1, 424000, "This is to certify that", "Times-Roman", 16120, align=1)
    _tb(page, cx0, 446000, cx1, 484000, "SIVARAM KRISHNAN", "Times-Bold", 24800, align=1)
    _tb(page, cx0, 520000, cx1, 560000, "has successfully completed the Bachelor of Technology (B.Tech) program in Computer Science and Engineering from this university, having fulfilled all academic requirements prescribed by the university.", "Times-Roman", 15200, align=1)
    _tb(page, LEFT, 626000, 696000, 654000, "Program Duration:  2021 - 2025", "Times-Roman", 14880)
    _tb(page, LEFT, 663000, 696000, 691000, "Final CGPA:  8.70  (out of 10.00)", "Times-Roman", 14880)
    _tb(page, LEFT, 700000, 696000, 728000, "Registration Number:  REG-2021-0487", "Times-Roman", 14880)
    _tb(page, LEFT, 737000, 696000, 765000, "Date of Issue:  15 July 2025", "Times-Roman", 14880)

    page.draw_line(pymupdf.Point(330, 760), pymupdf.Point(540, 760), color=INK, width=1.0)
    _tb(page, 380000, 700000, 540000, 722000, "Registrar", "Helvetica", 11160, align=1)
    page.draw_line(pymupdf.Point(60, 760), pymupdf.Point(250, 760), color=INK, width=1.0)
    _tb(page, 74400, 700000, 260000, 722000, "Dean (Academic Affairs)", "Helvetica", 11160, align=1)
    _tb(page, cx0, 830000, cx1, 854000, "Verify: https://verify.annauniv.edu.in", "Helvetica", 9920, align=1)

    _meta(doc, "Certificate of Completion", "Anna University", "Anna Univ Document System v2.2")
    out.write_bytes(doc.tobytes())
    doc.close()
    return out


def academic_mark_sheet(out: Path) -> Path:
    doc, page = _new_page()
    _tb(page, 110000, 32000, 630000, 62000, "ANNA UNIVERSITY, CHENNAI", "Helvetica-Bold", 18600, align=1)
    _tb(page, 110000, 70000, 630000, 94000, "ACADEMIC TRANSCRIPT", "Helvetica-Bold", 14880, align=1)

    info = ["Reg No: 2020-CS-1173", "Name: SIVARAM KRISHNAN", "Program: B.E. Computer Science and Engineering", "Affiliation: 2020 - 2024"]
    y = 186000
    for line in info:
        _tb(page, LEFT, y, 460000, y + 22000, line, "Helvetica", 12400)
        y += 26000

    cols = [(49600, 83000), (111600, 236000), (260000, 436000), (456000, 476000), (533200, 563000), (595600, 625600)]
    yy = 330000
    for text, (x0, x1) in zip(["SL", "Course Code", "Subject", "Credits", "Grade", "Result"], cols):
        _tb(page, x0, yy, x1, yy + 22000, text, "Helvetica-Bold", 11160)
    subjects = [
        ("CS8612", "Computer Networks", "3", "A+", "PASS"),
        ("CS8642", "Operating Systems", "3", "A", "PASS"),
        ("CS8672", "Machine Learning", "3", "O", "PASS"),
        ("CS8701", "Database Systems", "4", "A", "PASS"),
        ("CS8722", "Software Engineering", "3", "B+", "PASS"),
        ("CS8743", "Compiler Design", "3", "A", "PASS"),
    ]
    y = 366000
    for i, (code, subj, cred, grade, res) in enumerate(subjects, 1):
        vals = [str(i), code, subj, cred, grade, res]
        for text, (x0, x1) in zip(vals, cols):
            _tb(page, x0, y, x1, y + 22000, text, "Helvetica", 12400)
        y += 34000

    _tb(page, LEFT, 620000, 300000, 648000, "Total Credits: 19", "Helvetica", 12400)
    _tb(page, LEFT, 652000, 390000, 680000, "OVERALL CGPA: 8.42 (out of 10.00)", "Helvetica", 12400)
    _tb(page, LEFT, 684000, 340000, 712000, "Date of Issue:  15 May 2024", "Helvetica", 12400)
    _tb(page, 230000, 800000, 510000, 828000, "Controller of Examinations", "Helvetica", 12400, align=1)

    _meta(doc, "Academic Transcript", "Anna University", "Anna Univ Document System v2.2")
    out.write_bytes(doc.tobytes())
    doc.close()
    return out


def employment_offer_letter(out: Path) -> Path:
    doc, page = _new_page()
    _tb(page, LEFT, 32000, 420000, 60000, "ACME TECHNOLOGIES PVT. LTD.", "Helvetica-Bold", 18600)
    _tb(page, LEFT, 72000, 360000, 96000, "Bandra Kurla Complex, Mumbai 400051", "Helvetica", 11160)

    y = 72000
    for line in ("Offer No: OL-2026-112", "Date: 18 Aug 2026", "Ref: HR-STR-044", "Division: Engineering"):
        _tb(page, 585000, y, 710000, y + 22000, line, "Helvetica", 12400, align=2)
        y += 26000

    _tb(page, LEFT, 190000, 500000, 218000, "OFFER OF EMPLOYMENT", "Helvetica-Bold", 14880)

    body = [
        "We are pleased to offer you the position of Software Engineer at Acme",
        "Technologies, reporting to the Head of Engineering. Your compensation",
        "and benefits are summarized in the annexure to this letter.",
        "Your annual CTC is Rs 18,00,000. You are requested to report to the",
        "HR office on 01 September 2026 with copies of your transcripts and",
        "identity documents for verification.",
    ]
    y = 260000
    for line in body:
        _tb(page, LEFT, y, 690000, y + 23000, line, "Helvetica", 12400)
        y += 30000

    page.draw_line(pymupdf.Point(95, 760), pymupdf.Point(285, 760), color=INK, width=1.0)
    _tb(page, LEFT, 700000, 400000, 724000, "S. Menon | Head of Talent Acquisition", "Helvetica", 11160)
    _tb(page, LEFT, 780000, 440000, 804000, "For and on behalf of Acme Technologies Pvt. Ltd.", "Helvetica", 9920)

    _meta(doc, "Offer of Employment", "Acme Technologies Pvt. Ltd.", "Acme HR Suite v1.0")
    out.write_bytes(doc.tobytes())
    doc.close()
    return out


def event_ticket(out: Path, barcode_png: Path) -> Path:
    _barcode_png(barcode_png)
    doc, page = _new_page()
    _tb(page, LEFT, 32000, 500000, 60000, "CITY DISTRICT CARD SERVICES", "Helvetica-Bold", 18600)
    _tb(page, LEFT, 78000, 330000, 102000, "Metro + Bus Multi-Modal Ticket", "Helvetica", 12400)
    _tb(page, 620000, 32000, RIGHT, 60000, "TICKET", "Helvetica-Bold", 17360, align=2)
    lines = [
        "Ticket No: DL-CHENNAI-2026-88413",
        "Issued: 26 May 2026, 04:15 PM",
        "Passenger: Karthik R",
        "Route: Secunderabad Jn -> Siruseri TechPark",
        "Class: AC Chair Car | Seat 14A",
        "Fare: Rs 46.00 incl. service charge",
    ]
    y = 160000
    for line in lines:
        _tb(page, LEFT, y, 620000, y + 23000, line, "Helvetica", 13640)
        y += 28000
    _tb(page, LEFT, 520000, 400000, 544000, "*CITY-88413-2605*", "Helvetica", 11160)
    page.insert_image(pymupdf.Rect(503000 / K, 620000 / K, 710000 / K, 690000 / K), filename=str(barcode_png))
    _tb(page, LEFT, 740000, 500000, 764000, "Journey valid only for the date & train printed above.", "Helvetica", 11160)
    _tb(page, LEFT, 780000, 460000, 804000, "Verified on boarding. Carry valid ID proof.", "Helvetica", 11160)

    _meta(doc, "Metro + Bus Ticket", "City District Card Services", "CDCS Ticketing v4.0")
    out.write_bytes(doc.tobytes())
    doc.close()
    return out


def generate_all(out_dir: Path | None = None) -> dict[str, Path]:
    out_dir = Path(out_dir) if out_dir else OUT
    out_dir.mkdir(parents=True, exist_ok=True)
    return {
        "invoice": retail_invoice(out_dir / "retail_invoice.pdf"),
        "certificate": degree_certificate(out_dir / "degree_certificate.pdf", out_dir / "seal.png"),
        "mark_sheet": academic_mark_sheet(out_dir / "academic_mark_sheet.pdf"),
        "offer_letter": employment_offer_letter(out_dir / "employment_offer_letter.pdf"),
        "ticket": event_ticket(out_dir / "event_ticket.pdf", out_dir / "barcode.png"),
    }


if __name__ == "__main__":
    for name, path in generate_all().items():
        print(f"wrote: {path.name}")