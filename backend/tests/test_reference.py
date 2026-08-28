import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.extractor import extract
from app.ingestion import ingest
from app.reference import compare_docs, compare_weights

ROOT = Path(__file__).resolve().parent.parent


def _load(fname):
    td = tempfile.TemporaryDirectory()
    return td, extract(
        ingest((ROOT / "sample_data" / fname).read_bytes(), fname, Path(td.name)),
        run_ocr=False,
    )


def test_compare_detects_shift_from_template():
    td, gen = _load("genuine_cert.pdf")
    td2, shift = _load("forged_shift.pdf")
    try:
        refs = compare_docs(gen, shift)
        assert refs, "expected at least one reference finding"
        assert all(f.category == "reference" for f in refs)
        assert any(f.severity == "medium" for f in refs)
        assert any(f.region is not None for f in refs)
        assert any("shift" in "\n".join(f.evidence) for f in refs)
    finally:
        td.cleanup()
        td2.cleanup()


def test_genuine_vs_genuine_is_quiet():
    td, gen = _load("genuine_cert.pdf")
    td2, gen2 = _load("genuine_cert.pdf")
    try:
        refs = compare_docs(gen, gen2)
        assert not refs
    finally:
        td.cleanup()
        td2.cleanup()


def test_compare_weights_reserve_reference_share():
    base = {"a": 0.3, "b": 0.2}
    w = compare_weights(base)
    assert abs(sum(w.values()) - 1.0) < 1e-6
    assert abs(w["reference"] - 0.15) < 1e-9