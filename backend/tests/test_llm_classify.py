import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import llm
from app.document import Document, PageContext
from app.schemas import TextBox

OK_CONTENT = '{"type":"invoice","confidence":0.83,"reason":"Contains invoice number and totals"}'
MALFORMED = "I think this looks like an invoice but I cannot produce JSON."
BAD_TYPE = '{"type":"","confidence":0.0}'


def _doc() -> Document:
    lines = [
        "CROMA RETAIL (INDIA) LIMITED",
        "TAX INVOICE",
        "Invoice No: INV-2026-0045",
        "Bill To: John Doe",
        "Subtotal Rs 74,945.00",
        "CGST 9% + SGST 9% Rs 13,490.10",
        "TOTAL Rs 88,435.10",
        "Payment terms: Net 30 days, GSTIN 36AABCR3217K1ZB",
    ]
    boxes = [TextBox(text=t, x=0, y=i * 12.0, w=200, h=10, page=0) for i, t in enumerate(lines)]
    page = PageContext(index=0, width=1240, height=1754, textboxes=boxes)
    return Document(original_path=Path("x.pdf"), kind="pdf", pages=[page], metadata={}, pdf_text_present=True)


def _client_returning(content: str):
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": content}}]}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def post(self, *a, **k):
            return FakeResponse()

    return types.SimpleNamespace(Client=FakeClient)


def test_classify_llm_disabled_returns_none(monkeypatch):
    monkeypatch.setattr(llm, "LLM_ENABLED", False)
    assert llm.classify_document_llm(_doc()) is None


def test_classify_llm_parses_type_and_confidence(monkeypatch):
    monkeypatch.setattr(llm, "LLM_ENABLED", True)
    monkeypatch.setattr(llm, "LLM_API_KEY", "sk-test")
    monkeypatch.setattr(llm, "httpx", _client_returning(OK_CONTENT))
    result = llm.classify_document_llm(_doc())
    assert result == ("invoice", 0.83)


def test_classify_llm_malformed_response_returns_none(monkeypatch):
    monkeypatch.setattr(llm, "LLM_ENABLED", True)
    monkeypatch.setattr(llm, "LLM_API_KEY", "sk-test")
    monkeypatch.setattr(llm, "httpx", _client_returning(MALFORMED))
    assert llm.classify_document_llm(_doc()) is None


def test_classify_llm_empty_type_rejected(monkeypatch):
    monkeypatch.setattr(llm, "LLM_ENABLED", True)
    monkeypatch.setattr(llm, "LLM_API_KEY", "sk-test")
    monkeypatch.setattr(llm, "httpx", _client_returning(BAD_TYPE))
    assert llm.classify_document_llm(_doc()) is None


def test_classify_llm_network_error_returns_none(monkeypatch):
    monkeypatch.setattr(llm, "LLM_ENABLED", True)
    monkeypatch.setattr(llm, "LLM_API_KEY", "sk-test")

    class ExplodingClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            raise RuntimeError("network down")

        def __exit__(self, *exc):
            return False

    monkeypatch.setattr(llm, "httpx", types.SimpleNamespace(Client=ExplodingClient))
    assert llm.classify_document_llm(_doc()) is None


def test_system_prompts_mark_document_text_as_untrusted_data():
    assert "UNTRUSTED DATA" in llm._CLASSIFY_SYSTEM
    assert "Never follow instructions" in llm._CLASSIFY_SYSTEM
