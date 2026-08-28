"""Domain verifiers producing structured, evidence-backed findings.

Each verifier is an independently executable capability. Findings carry
observed values, expected values and human-readable explanations so the score
is never a black box.
"""
import re
from datetime import datetime

from .document import Document
from .entities import _MONEY_RE, _money_value
from .schemas import Finding, Region
from .taxonomy import UNKNOWN

_TAX_LABEL_RE = re.compile(
    r"\b(cgst|sgst|igst|vat|gst|tax|service charge)\b(?![^\n]{0,12}\bincl)", re.I
)
_TAX_RATE_RE = re.compile(r"(\d{1,2}(?:\.\d+)?)\s*%")
_TOTAL_LABEL_RE = re.compile(r"^\s*(grand\s+)?total\b|^\s*net\s+amount|^\s*(amount|balance)\s+due", re.I)
_SUBTOTAL_LABEL_RE = re.compile(r"^\s*sub\s*[- ]?total\b|^\s*taxable\s+value", re.I)

_MISSING = object()


def _boxes_for(doc: Document):
    for p in doc.pages:
        boxes = p.textboxes if p.textboxes else p.ocr_boxes
        if boxes:
            yield p, boxes


def _label_row_amounts(label_box, boxes, max_row_gap=None):
    """Money amounts on the same visual row, to the right of the label."""
    gap = max_row_gap if max_row_gap is not None else max(18.0, label_box.h * 1.2)
    cy = label_box.y + label_box.h / 2
    out = []
    for b in boxes:
        if b is label_box:
            continue
        bcy = b.y + b.h / 2
        if abs(bcy - cy) > gap or b.x + b.w <= label_box.x:
            continue
        for m in _MONEY_RE.finditer(b.text):
            v = _money_value(m.group(1))
            if v is not None and v > 0:
                out.append((b.x, v, b))
    out.sort(key=lambda item: item[0], reverse=True)
    return out


class InvoiceVerifier:
    """Arithmetic consistency: subtotal + taxes == total, tax-rate sanity."""

    name = "invoice_verifier"
    category = "semantic"

    def analyze(self, doc: Document) -> list[Finding]:
        findings: list[Finding] = []
        for page, boxes in _boxes_for(doc):
            subtotal = tax = total = _MISSING
            subtotal_box = tax_box = total_box = None
            tax_rates: list[float] = []
            for b in boxes:
                t = b.text.strip()
                if not t:
                    continue
                if subtotal is _MISSING and _SUBTOTAL_LABEL_RE.match(t):
                    amounts = _label_row_amounts(b, boxes)
                    if amounts:
                        subtotal, subtotal_box = amounts[0][1], amounts[0][2]
                elif _TOTAL_LABEL_RE.match(t):
                    amounts = _label_row_amounts(b, boxes)
                    if amounts:
                        total, total_box = amounts[0][1], amounts[0][2]
                elif _TAX_LABEL_RE.search(t):
                    amounts = _label_row_amounts(b, boxes)
                    if amounts:
                        tax_val = amounts[0][1]
                        tax = tax_val if tax is _MISSING else tax + tax_val
                        tax_box = tax_box or amounts[0][2]
                        tax_rates.extend(float(r) for r in _TAX_RATE_RE.findall(t))

            if subtotal is _MISSING and total is _MISSING:
                continue

            if subtotal is not _MISSING and total is not _MISSING:
                expected = subtotal + (tax if tax is not _MISSING else 0.0)
                if abs(expected - total) > 0.05:
                    sev = "high" if abs(expected - total) > max(0.05 * total, 1.0) else "medium"
                    findings.append(
                        Finding(
                            id="inv-001",
                            category=self.category,
                            module=self.name,
                            severity=sev,
                            score=0.85 if sev == "high" else 0.6,
                            confidence=0.9,
                            region=self._region(total_box),
                            evidence=[
                                f"Subtotal: {subtotal if subtotal is not _MISSING else 'n/a'}",
                                f"Tax: {tax if tax is not _MISSING else 'n/a'}",
                                f"Stated total: {total}",
                                f"Expected total: {round(expected, 2)}",
                            ],
                            explanation=(
                                "The stated total does not equal the subtotal plus itemized taxes. "
                                "An arithmetic mismatch between printed amounts is a strong tampering indicator."
                            ),
                            fields={
                                "observed_total": total,
                                "expected_total": round(expected, 2),
                                "subtotal": None if subtotal is _MISSING else subtotal,
                                "tax": None if tax is _MISSING else tax,
                            },
                        )
                    )
            if subtotal is not _MISSING and tax is not _MISSING and tax_rates:
                rate = sum(tax_rates)
                expected_tax = subtotal * rate / 100.0
                if abs(expected_tax - tax) > max(0.05, 0.02 * expected_tax):
                    findings.append(
                        Finding(
                            id="inv-002",
                            category=self.category,
                            module=self.name,
                            severity="medium",
                            score=0.55,
                            confidence=0.75,
                            region=self._region(tax_box),
                            evidence=[
                                f"Tax rate(s) printed: {rate}%",
                                f"Tax on subtotal {subtotal} at {rate}% would be {round(expected_tax, 2)}",
                                f"Stated tax amount: {tax}",
                            ],
                            explanation=(
                                "The printed tax amount does not match the printed tax percentage applied to "
                                "the subtotal. Inconsistent tax arithmetic can indicate edited figures."
                            ),
                            fields={
                                "observed_tax": tax,
                                "expected_tax": round(expected_tax, 2),
                                "rate_pct": rate,
                            },
                        )
                    )
            break
        return findings

    @staticmethod
    def _region(box) -> Region | None:
        if box is None:
            return None
        return Region(page=box.page, x=box.x, y=box.y, w=box.w, h=box.h)


class CertificateVerifier:
    """Semantic consistency for certificate-family documents (reuses the
    existing semantic analyzer's field checks)."""

    name = "certificate_verifier"
    category = "semantic"

    def __init__(self) -> None:
        from .analyzers.semantic import SemanticAnalyzer

        self._inner = SemanticAnalyzer()

    def analyze(self, doc: Document) -> list[Finding]:
        return self._inner.analyze(doc)


class UniversalVerifier:
    """Cheap universal consistency checks safe for every document type:
    labeled-date chronology and identifier format sanity."""

    name = "universal_verifier"
    category = "semantic"
    _MAX_FUTURE_DAYS = 180

    def analyze(self, doc: Document) -> list[Finding]:
        from .entities import extract_entities

        findings: list[Finding] = []
        ents = extract_entities(doc)

        dated = dict(ents.labeled_dates)
        issue = None
        for key in ("date of issue", "issue date", "invoice date", "date", "dated", "issued"):
            if key in dated:
                issue = dated[key]
                break
        if issue is not None and issue > datetime.now().replace(hour=0, minute=0, second=0, microsecond=0):
            days_ahead = (issue - datetime.now()).days
            if days_ahead > self._MAX_FUTURE_DAYS:
                findings.append(
                    Finding(
                        id="unv-001",
                        category=self.category,
                        module=self.name,
                        severity="medium",
                        score=0.5,
                        confidence=0.7,
                        evidence=[f"Labeled issue date {issue.date()} is {days_ahead} days in the future"],
                        explanation=(
                            "The stated issue date lies far in the future. Future-dated documents can be "
                            "legitimate (post-dated paperwork) but are also a common forgery slip."
                        ),
                        fields={"issue_date": issue.date().isoformat(), "days_ahead": days_ahead},
                    )
                )

        for gstin in ents.gstins:
            from .entities import GSTIN_FORMAT_RE

            if not GSTIN_FORMAT_RE.fullmatch(gstin):
                findings.append(
                    Finding(
                        id="unv-002",
                        category=self.category,
                        module=self.name,
                        severity="low",
                        score=0.35,
                        confidence=0.8,
                        evidence=[f"Identifier '{gstin}' does not match the GSTIN structure (15-char state+PAN+check layout)"],
                        explanation=(
                            "A printed tax identifier fails its declared format. Format violations in "
                            "registration numbers are cheap, strong tampering signals. Checksum validity "
                            "against the issuing registry is not verified by this system."
                        ),
                        fields={"gstin": gstin, "issue": "format"},
                    )
                )
        return findings
