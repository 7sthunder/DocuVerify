import sys
import tempfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "spike"))

from app.pipeline import analyze_file
from make_real_docs import generate_all

LEGIT_LIMIT = 30.0


@pytest.fixture(scope="module")
def corpus():
    with tempfile.TemporaryDirectory(prefix="dv_real_", dir=ROOT) as td:
        yield generate_all(Path(td) / "corpus")


@pytest.mark.parametrize("name", ["invoice", "certificate", "mark_sheet", "offer_letter", "ticket"])
def test_real_documents_stay_low_risk(corpus, name):
    path = corpus[name]
    with tempfile.TemporaryDirectory(prefix="dv_real_job_", dir=ROOT) as jd:
        r = analyze_file(path, Path(jd), run_ocr=False)
    a = r["assessment"]
    assert a["risk_level"] == "LOW", f"{name} scored {a['suspicion_score']} ({a['risk_level']})"
    assert a["suspicion_score"] < LEGIT_LIMIT, f"{name} scored {a['suspicion_score']}"


def test_each_real_document_has_explainable_findings_text(corpus, name="invoice"):
    path = corpus[name]
    with tempfile.TemporaryDirectory(prefix="dv_real_job_", dir=ROOT) as jd:
        r = analyze_file(path, Path(jd), run_ocr=False)
    for f in r["findings"]:
        assert f["explanation"] and f["evidence"]