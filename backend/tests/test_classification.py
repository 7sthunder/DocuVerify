import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "spike"))

import pymupdf

from app.classification import classify_deterministic
from app.extractor import extract
from app.ingestion import ingest
from make_real_docs import generate_all


@pytest.fixture(scope="module")
def corpus():
    with tempfile.TemporaryDirectory(prefix="dv_cls_", dir=ROOT) as td:
        yield generate_all(Path(td) / "corpus")


def _doc(pdf_path: Path):
    with tempfile.TemporaryDirectory(prefix="dv_cls_job_", dir=ROOT) as jd:
        return extract(ingest(pdf_path.read_bytes(), pdf_path.name, Path(jd)), run_ocr=False)


def _junk_pdf() -> Path:
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text(
        (72, 100),
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.",
        fontname="helv",
        fontsize=11,
    )
    page.insert_text(
        (72, 130),
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo.",
        fontname="helv",
        fontsize=11,
    )
    out = ROOT / "sample_data" / "_cls_junk.pdf"
    out.write_bytes(doc.tobytes())
    doc.close()
    return out


@pytest.mark.parametrize(
    "name,expected",
    [
        ("invoice", "invoice"),
        ("certificate", "certificate"),
        ("mark_sheet", "transcript"),
        ("offer_letter", "offer_letter"),
        ("ticket", "ticket"),
    ],
)
def test_legit_corpus_classification(corpus, name, expected):
    cls = classify_deterministic(_doc(corpus[name]))
    assert cls.type_id == expected
    assert cls.confidence >= 0.55


def test_unknown_document_classifies_as_unknown():
    cls = classify_deterministic(_doc(_junk_pdf()))
    assert cls.type_id == "unknown"
    assert cls.confidence == 0.0
    assert cls.to_report()["label"] == "Unknown"


def test_classification_report_shape(corpus):
    cls = classify_deterministic(_doc(corpus["invoice"]))
    r = cls.to_report()
    assert r["type"] == "invoice"
    assert r["method"] == "deterministic"
    assert r["candidates"] and r["candidates"][0]["type"] == "invoice"
