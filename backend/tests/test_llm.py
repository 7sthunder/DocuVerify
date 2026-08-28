import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import llm
from app.document import Document, PageContext
from app.schemas import TextBox

SAMPLE = (
    '{"inconsistencies":['
    '{"severity":"high","reason":"CGPA impossible on 10 scale","confidence":0.95,"fields":["15.75","10.0"]},'
    '{"severity":"low","reason":"Minor inconsistency","confidence":0.5,"fields":["2022-03-12"]}'
    '],"summary":"Summary text with caveat that it is not proof."}'
)


def _make_doc() -> Document:
    boxes = [
        TextBox(text="Final CGPA:  15.75  (out of 10.00)", x=0, y=0, w=100, h=10, page=0),
        TextBox(text="Date of Issue:  12 March 2022", x=0, y=20, w=100, h=10, page=0),
    ]
    page = PageContext(index=0, width=1240, height=1754, textboxes=boxes)
    return Document(
        original_path=Path("x.pdf"), kind="pdf", pages=[page], metadata={}, pdf_text_present=True
    )


def test_llm_disabled_returns_empty():
    llm.LLM_ENABLED = False
    findings, summary, err = llm.llm_analyze(_make_doc(), [])
    assert findings == []
    assert summary is None and err is None


def test_llm_parses_and_attaches_regions(monkeypatch):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": SAMPLE}}]}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, *a, **k):
            return FakeResponse()

    monkeypatch.setattr(llm, "httpx", types.SimpleNamespace(Client=FakeClient))
    monkeypatch.setattr(llm, "LLM_ENABLED", True)
    monkeypatch.setattr(llm, "LLM_API_KEY", "sk-test")

    findings, summary, err = llm.llm_analyze(_make_doc(), [])
    assert err is None
    assert len(findings) == 2
    assert findings[0].module == "semantic_llm"
    assert findings[0].severity == "high"
    assert summary and "not proof" in summary
    cgpa = next(f for f in findings if "15.75" in f.evidence[0])
    assert cgpa.region is not None and cgpa.region.y == 0
    date = next(f for f in findings if "2022" in f.evidence[0])
    assert date.region is not None and date.region.y == 20