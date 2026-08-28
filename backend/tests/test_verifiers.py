import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "spike"))

import pymupdf

from app.classification import classify_deterministic
from app.extractor import extract
from app.ingestion import ingest
from app.pipeline import analyze_file
from app.verifiers import InvoiceVerifier, UniversalVerifier

K = 1240
PW, PH = 595.27, 841.89


def _money_invoice_pdf(subtotal: str, tax: str, total: str) -> Path:
    doc = pymupdf.open()
    page = doc.new_page(width=PW, height=PH)
    page.insert_textbox(pymupdf.Rect(60, 40, 400, 70), "TAX INVOICE", fontname="hebo", fontsize=14)
    page.insert_textbox(pymupdf.Rect(350, 80, 540, 95), "Invoice No: INV-2026-777", fontname="helv", fontsize=9)
    rows = [("Subtotal", subtotal), ("CGST 9% + SGST 9%", tax), ("TOTAL", total)]
    y = 250.0
    for label, amount in rows:
        page.insert_textbox(pymupdf.Rect(200, y, 330, y + 18), label, fontname="helv", fontsize=9)
        page.insert_textbox(pymupdf.Rect(340, y, 540, y + 18), f"Rs {amount}", fontname="helv", fontsize=9)
        y += 30.0
    out = ROOT / "sample_data" / "_verifier_invoice.pdf"
    out.write_bytes(doc.tobytes())
    doc.close()
    return out


def _ingested(path: Path):
    with tempfile_dir() as jd:
        return extract(ingest(path.read_bytes(), path.name, jd), run_ocr=False)


@contextmanager
def tempfile_dir():
    with tempfile.TemporaryDirectory(prefix="dv_ver_", dir=ROOT) as td:
        yield Path(td)


def test_invoice_verifier_flags_tampered_total():
    doc = _ingested(_money_invoice_pdf("1,000.00", "180.00", "2,500.00"))
    findings = InvoiceVerifier().analyze(doc)
    assert findings, "expected arithmetic mismatch finding"
    f = findings[0]
    assert f.severity in ("medium", "high")
    assert f.fields["observed_total"] == 2500.0
    assert f.fields["expected_total"] == 1180.0
    assert f.evidence and f.explanation


def test_invoice_verifier_passes_consistent_totals():
    doc = _ingested(_money_invoice_pdf("1,000.00", "180.00", "1,180.00"))
    assert InvoiceVerifier().analyze(doc) == []


def test_invoice_verifier_flags_wrong_tax_amount():
    doc = _ingested(_money_invoice_pdf("1,000.00", "500.00", "1,500.00"))
    findings = InvoiceVerifier().analyze(doc)
    assert findings, "expected tax-rate mismatch finding"
    assert any(f.fields.get("expected_tax") == 180.0 for f in findings)


def test_universal_verifier_flags_far_future_issue_date():
    doc_path = ROOT / "sample_data" / "_verifier_future.pdf"
    d = pymupdf.open()
    page = d.new_page()
    page.insert_text((72, 100), "Date of Issue:  15 July 2032", fontname="helv", fontsize=11)
    page.insert_text((72, 130), "Some unrelated body text for the document.", fontname="helv", fontsize=11)
    doc_path.write_bytes(d.tobytes())
    d.close()
    doc = _ingested(doc_path)
    findings = UniversalVerifier().analyze(doc)
    assert any(f.id == "unv-001" for f in findings)


def test_universal_verifier_flags_malformed_gstin():
    doc_path = ROOT / "sample_data" / "_verifier_gstin.pdf"
    d = pymupdf.open()
    page = d.new_page()
    page.insert_text((72, 100), "GSTIN: 36XX99ZZ", fontname="helv", fontsize=11)
    doc_path.write_bytes(d.tobytes())
    d.close()
    doc = _ingested(doc_path)
    findings = UniversalVerifier().analyze(doc)
    assert any(f.id == "unv-002" and f.severity == "low" for f in findings)


def test_universal_verifier_flags_non_numeric_gstin_state_code():
    doc_path = ROOT / "sample_data" / "_verifier_gstin_bad.pdf"
    d = pymupdf.open()
    page = d.new_page()
    page.insert_text((72, 100), "GSTIN: XXAABCR3217K1ZB", fontname="helv", fontsize=11)
    doc_path.write_bytes(d.tobytes())
    d.close()
    doc = _ingested(doc_path)
    findings = UniversalVerifier().analyze(doc)
    assert any(f.id == "unv-002" for f in findings)


def test_universal_verifier_quiet_on_valid_gstin_format():
    doc_path = ROOT / "sample_data" / "_verifier_gstin_ok.pdf"
    d = pymupdf.open()
    page = d.new_page()
    page.insert_text((72, 100), "GSTIN: 36AABCR3217K1ZB", fontname="helv", fontsize=11)
    doc_path.write_bytes(d.tobytes())
    d.close()
    doc = _ingested(doc_path)
    assert not [f for f in UniversalVerifier().analyze(doc) if f.id == "unv-002"]


def test_unknown_document_receives_full_universal_analysis():
    junk = _junk_lorem_pdf()
    with tempfile_dir() as jd:
        report = analyze_file(junk, jd, run_ocr=False)
    assert report["document"]["type"] == "unknown"
    assert report["assessment"]["risk_level"] in ("LOW", "MEDIUM", "HIGH")
    caps = report["processing"]["capabilities"]
    names = {c["name"] for c in caps}
    assert {"layout", "typography", "visual", "metadata", "universal_verifier"} <= names
    assert report["processing"]["domain_analysis"] is None


def test_invoice_report_carries_document_and_processing_blocks():
    from make_real_docs import generate_all

    with tempfile.TemporaryDirectory(prefix="dv_rep_c_", dir=ROOT) as ctd, tempfile_dir() as jd:
        inv = generate_all(Path(ctd))["invoice"]
        report = analyze_file(inv, jd, run_ocr=False)
    assert report["document"]["type"] == "invoice"
    assert report["document"]["confidence"] >= 0.55
    assert all(c["status"] == "ok" for c in report["processing"]["capabilities"])
    for legacy_key in ("assessment", "findings", "pages", "reliability", "llm"):
        assert legacy_key in report


def _junk_lorem_pdf() -> Path:
    d = pymupdf.open()
    page = d.new_page()
    page.insert_text(
        (72, 100),
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do eiusmod tempor incididunt.",
        fontname="helv",
        fontsize=11,
    )
    out = ROOT / "sample_data" / "_cls_junk2.pdf"
    out.write_bytes(d.tobytes())
    d.close()
    return out


def test_classification_of_generated_invoice_is_deterministic_invoice():
    sys.path.insert(0, str(ROOT / "spike"))
    from make_real_docs import generate_all

    with tempfile.TemporaryDirectory(prefix="dv_rep_c2_", dir=ROOT) as ctd:
        inv = generate_all(Path(ctd))["invoice"]
        with tempfile_dir() as jd:
            doc = extract(ingest(inv.read_bytes(), inv.name, jd), run_ocr=False)
    assert classify_deterministic(doc).type_id == "invoice"


# ---- Regression tests for tricky-legit layouts that must NOT flag ----

def _ingest_pdf(content: str) -> Path:
    """Create a PDF from raw pymupdf insert_text calls."""
    d = pymupdf.open()
    page = d.new_page(width=PW, height=PH)
    for line in content.strip().split("\n"):
        x, y, text = line.split("|", 2)
        page.insert_text((float(x), float(y)), text.strip(), fontname="helv", fontsize=10)
    out = ROOT / "sample_data" / f"_verifier_regr_{abs(hash(content))}.pdf"
    out.write_bytes(d.tobytes())
    d.close()
    return out


def test_invoice_verifier_quiet_on_discounted_invoice():
    """Legit invoice with a discount row between subtotal and tax."""
    doc = _ingested(_ingest_pdf("""
        60|200|TAX INVOICE
        200|230|Subtotal          Rs 1,000.00
        200|250|Discount (5%)     Rs 50.00
        200|270|CGST 9%           Rs 85.50
        200|290|SGST 9%           Rs 85.50
        200|320|TOTAL             Rs 1,121.00
    """))
    assert InvoiceVerifier().analyze(doc) == []


def test_invoice_verifier_quiet_on_total_tax_and_qty_rows():
    """Legit invoice with 'Total Qty' and 'Total Tax Amount' rows that
    must not be confused with the invoice total."""
    doc = _ingested(_ingest_pdf("""
        60|200|TAX INVOICE
        200|230|Subtotal              Rs 1,000.00
        200|250|Total Qty             3
        200|270|Total Tax Amount      Rs 180.00
        200|300|TOTAL                 Rs 1,180.00
    """))
    assert InvoiceVerifier().analyze(doc) == []


def test_invoice_verifier_quiet_on_partial_payment():
    """Legit invoice with advance payment and balance due below total."""
    doc = _ingested(_ingest_pdf("""
        60|200|TAX INVOICE
        200|230|Subtotal          Rs 1,000.00
        200|250|CGST 9% + SGST 9% Rs 180.00
        200|280|TOTAL             Rs 1,180.00
        200|300|Advance Paid      Rs 500.00
        200|320|Balance Due       Rs 680.00
    """))
    assert InvoiceVerifier().analyze(doc) == []


def test_invoice_verifier_quiet_on_combined_tax_row():
    """Single-box combined CGST+SGST row (common in e-invoices)."""
    doc = _ingested(_ingest_pdf("""
        60|200|TAX INVOICE
        200|230|Subtotal          Rs 1,000.00
        200|250|CGST 9%: 90.00 SGST 9%: 90.00
        200|280|TOTAL             Rs 1,180.00
    """))
    assert InvoiceVerifier().analyze(doc) == []


def test_invoice_verifier_flags_tampered_balance_due():
    """Balance due inconsistent with total minus payments = tampering signal."""
    doc = _ingested(_ingest_pdf("""
        60|200|TAX INVOICE
        200|230|Subtotal          Rs 1,000.00
        200|250|CGST 9% + SGST 9% Rs 180.00
        200|280|TOTAL             Rs 1,180.00
        200|300|Advance Paid      Rs 200.00
        200|320|Balance Due       Rs 380.00
    """))
    findings = InvoiceVerifier().analyze(doc)
    assert any(f.id == "inv-003" for f in findings)


def test_universal_verifier_quiet_on_multi_gstin():
    """Multi-GSTIN header line (supplier + recipient) dash-joined."""
    doc = _ingested(_ingest_pdf("""
        60|140|GSTIN: 36AABCR3217K1ZB-07AABCU9603R1ZM
        200|230|Subtotal          Rs 1,000.00
        200|250|CGST 9% + SGST 9% Rs 180.00
        200|280|TOTAL             Rs 1,180.00
    """))
    findings = UniversalVerifier().analyze(doc)
    assert not [f for f in findings if f.id == "unv-002"]


def test_universal_verifier_quiet_on_future_event_date():
    """Generic 'Date:' on a ticket/booking is an event date, not an issue date."""
    doc = _ingested(_ingest_pdf("""
        60|100|EVENT TICKET
        60|140|Date: 15 March 2027
        60|160|Seat: A14 | Gate 3
    """))
    findings = UniversalVerifier().analyze(doc)
    assert not [f for f in findings if f.id == "unv-001"]


def test_forged_total_reported_medium_or_higher():
    """A blatant arithmetic contradiction must push the global score to
    at least MEDIUM via the decisive-evidence floor."""
    with tempfile.TemporaryDirectory(prefix="dv_floor_", dir=ROOT) as jd:
        pdf_path = _ingest_pdf("""
            60|200|TAX INVOICE
            200|230|Subtotal          Rs 1,000.00
            200|250|CGST 9% + SGST 9% Rs 180.00
            200|280|TOTAL             Rs 2,980.00
        """)
        report = analyze_file(pdf_path, Path(jd), run_ocr=False)
    a = report["assessment"]
    assert a["risk_level"] in ("MEDIUM", "HIGH"), f"scored {a['suspicion_score']} ({a['risk_level']})"
    assert a["suspicion_score"] >= 40.0, f"floor failed: {a['suspicion_score']}"
