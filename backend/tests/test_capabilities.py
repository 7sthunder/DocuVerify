import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.capabilities import Registry
from app.schemas import Finding


class _OkRunner:
    name = "ok_runner"
    category = "test"

    def analyze(self, doc):
        return [
            Finding(
                id="ok-001",
                category="test",
                module="ok_runner",
                severity="low",
                score=0.3,
                explanation="fine",
            )
        ]


class _BoomRunner:
    name = "boom_runner"
    category = "test"

    def analyze(self, doc):
        raise RuntimeError("exploded")


def test_registry_register_get_list():
    reg = Registry()
    reg.register("a", "A", _OkRunner(), scope="universal", cost="cheap")
    reg.register("b", "B", _OkRunner(), scope="domain", cost="cheap", domain_types={"invoice"})
    assert reg.get("a") is not None and reg.get("missing") is None
    assert {c.name for c in reg.list()} == {"a", "b"}


def test_selection_by_document_type():
    reg = Registry()
    reg.register("u", "U", _OkRunner(), scope="universal")
    reg.register("dom", "D", _OkRunner(), scope="domain", domain_types={"invoice"})

    class Doc:
        pages = []

    assert [c.name for c in reg.select(Doc(), "invoice")] == ["u", "dom"]
    assert [c.name for c in reg.select(Doc(), "certificate")] == ["u"]


def test_capability_failure_is_isolated():
    reg = Registry()
    reg.register("ok", "OK", _OkRunner(), scope="universal")
    reg.register("boom", "BOOM", _BoomRunner(), scope="universal")

    class Doc:
        pages = []

    findings, runs = reg.run(reg.list(), Doc())
    assert len(findings) == 1
    statuses = {r.name: r.status for r in runs}
    assert statuses == {"ok": "ok", "boom": "error"}
    boom = next(r for r in runs if r.name == "boom")
    assert boom.error and "RuntimeError" in boom.error
    assert boom.duration_ms >= 0


def test_default_registry_selects_domain_verifiers():
    from app.capabilities import default_registry

    reg = default_registry()

    class Doc:
        pages = []

    inv = {c.name for c in reg.select(Doc(), "invoice")}
    cert = {c.name for c in reg.select(Doc(), "certificate")}
    unk = {c.name for c in reg.select(Doc(), "unknown")}
    assert "invoice_verifier" in inv and "certificate_verifier" not in inv
    assert "certificate_verifier" in cert and "invoice_verifier" not in cert
    assert "invoice_verifier" not in unk and "certificate_verifier" not in unk
    assert "universal_verifier" in unk
    # legacy keyword hint keeps certificate semantics alive for unknown docs
    hinted = {c.name for c in reg.select(Doc(), "unknown", text_hint=True)}
    assert "certificate_verifier" in hinted
