"""Domain verifiers producing structured, evidence-backed findings.

Each verifier is an independently executable capability. Findings carry
observed values, expected values and human-readable explanations so the score
is never a black box.

Design rule: a finding must survive every *reasonable* interpretation of the
document before it is raised. Legitimate layouts (discount rows, partial
payments, combined tax lines, extra charges, multi-GSTIN headers) are parsed
explicitly so the checks stay razor-sharp on genuine contradictions.
"""
import re
from datetime import datetime

from .document import Document
from .entities import _MONEY_RE, _money_value
from .schemas import Finding, Region

_TAX_LABEL_RE = re.compile(
    r"\b(cgst|sgst|igst|vat|gst|tax|service charge)\b(?![^\n]{0,12}\bincl)", re.I
)
# Lines that reference invoices/IDs ("Cinema GST Invoice Number:") are
# identifiers, never printed tax amounts.
_TAX_REF_RE = re.compile(r"invoice\s*(?:no\.?|number)|\bref\b|\bref\s*no\b", re.I)
_SERVICE_CHARGE_RE = re.compile(r"\bservice\s+charge\b", re.I)
_TAX_RATE_RE = re.compile(r"(\d{1,2}(?:\.\d+)?)\s*%")
# "Total tax (amount)" / "Tax total" are tax rows, never the invoice total.
_TAX_TOTAL_RE = re.compile(r"^\s*tax\s+total\b|^\s*total\s+tax\b(?!\s*able)", re.I)
# Primary total rows. Excludes rows where "total" heads a non-amount figure
# (Total Qty, Total Items, Total Tax, Total Paid, Total Due, ...).
_TOTAL_LABEL_RE = re.compile(
    r"^\s*(grand\s+)?total\b(?!\s*(?:tax|qty|quantity|items?|pages|boxes|weight|pieces|discount|due|paid|adv|round))|"
    r"^\s*net\s+amount|^\s*total\s+payable",
    re.I,
)
_DUE_LABEL_RE = re.compile(r"^\s*(?:amount|balance|total|net)\s+due\b", re.I)
_SUBTOTAL_LABEL_RE = re.compile(r"^\s*sub\s*[- ]?total\b|^\s*taxable\s+value", re.I)
_DISCOUNT_LABEL_RE = re.compile(r"\b(?:discount|rebate|coupon|less)\b", re.I)
_PAID_LABEL_RE = re.compile(r"\b(?:advance|deposit|paid)\b", re.I)
_OTHER_CHARGE_RE = re.compile(
    r"\b(?:shipping|delivery|freight|courier|handling|forwarding|convenience\s+fee|"
    r"platform\s+fee|cod\s+(?:fee|charge)|other\s+charges|installation)\b",
    re.I,
)

# Money tokens that carry no amount semantics: a rate ("9%") or a bare count
# followed by a word ("3 items", "5 pcs") — currency words are exempt.
_COUNT_SUFFIX_RE = re.compile(r"\s+(?!rs\.?(?:\s|$)|inr\b|usd\b|eur\b|gbp\b)[a-z][A-Za-z]{0,7}\b")

_MISS = _MISSING = object()


def _money_only_box(text: str) -> bool:
    """True when a box is a pure money figure ("31.32", "Rs 1,234.00") and not
    narrative text that happens to embed digits (ID lists, references)."""
    t = re.sub(r"(?i)\b(rs\.?|inr|usd|eur|gbp)\b", " ", text)
    t = re.sub(r"[₹$€£,\s]", "", t)
    return bool(t) and bool(re.fullmatch(r"[\d.()\-]+", t)) and any(c.isdigit() for c in t)


def _tax_row_eligible(text: str) -> bool:
    """Generic tax-label lines qualify as printed tax rows only when they carry
    tax evidence themselves: a rate, a money amount, or a short labeled form.
    Long narrative sentences that merely mention GST/Tax are references."""
    if not _TAX_LABEL_RE.search(text):
        return False
    if _TAX_REF_RE.search(text):
        return False
    if _TAX_RATE_RE.search(text):
        return True
    if _MONEY_RE.search(text):
        return True
    return len(re.findall(r"[A-Za-z]{2,}", text)) <= 4


def _boxes_for(doc: Document):
    for p in doc.pages:
        boxes = p.textboxes if p.textboxes else p.ocr_boxes
        if boxes:
            yield p, boxes


def _skip_token(m: re.Match) -> bool:
    """True when a money-shaped token is not an amount (a rate or a count)."""
    tail = m.string[m.end():]
    if tail.startswith("%"):
        return True
    return bool(_COUNT_SUFFIX_RE.match(tail))


def _row_money_tokens(label_box, boxes, max_row_gap=None):
    """Money tokens on the label's visual row (label box included), ordered
    rightmost-in-reading-order first."""
    gap = max_row_gap if max_row_gap is not None else max(18.0, label_box.h * 1.2)
    cy = label_box.y + label_box.h / 2
    out = []
    for b in boxes:
        bcy = b.y + b.h / 2
        if abs(bcy - cy) > gap:
            continue
        for m in _MONEY_RE.finditer(b.text):
            if _skip_token(m):
                continue
            v = _money_value(m.group(1))
            if v is not None and v > 0:
                out.append((b.x, m.start(), v, b))
    out.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return out


def _label_row_amounts(label_box, boxes, max_row_gap=None):
    """Rightmost money amount on the same visual row as the label. Used for
    total-like rows where one final figure is printed."""
    return [(x, v, b) for x, _, v, b in _row_money_tokens(label_box, boxes, max_row_gap)]


def _tax_row_amounts(label_box, boxes, max_row_gap=None):
    """Money tokens for a tax row. Indian invoices frequently print combined
    tax lines inside a single box ("CGST 9%: 90.00 SGST 9%: 90.00"), so all
    amount tokens on the row are summed; rates and parenthetical base figures
    are excluded. Amounts are only taken from the label box itself or from
    boxes that are pure money figures — narrative/reference lines (invoice
    number lists, transaction IDs) sharing the row are ignored."""
    gap = max_row_gap if max_row_gap is not None else max(18.0, label_box.h * 1.2)
    cy = label_box.y + label_box.h / 2
    total = 0.0
    found = False
    box = None
    for b in boxes:
        bcy = b.y + b.h / 2
        if abs(bcy - cy) > gap:
            continue
        if b is not label_box and not _money_only_box(b.text):
            continue
        for m in _MONEY_RE.finditer(b.text):
            if _skip_token(m):
                continue
            prefix = b.text[: m.start()]
            if prefix.count("(") > prefix.count(")"):
                continue  # parenthetical base/reference figure
            v = _money_value(m.group(1))
            if v is None or v <= 0:
                continue
            total += v
            found = True
            box = box or b
    return [(0.0, total, box)] if found else []


class InvoiceVerifier:
    """Arithmetic consistency: subtotal - discounts + taxes (+ other charges)
    == total, printed tax-rate sanity, and balance-due consistency for
    partially paid invoices."""

    name = "invoice_verifier"
    category = "semantic"

    def analyze(self, doc: Document) -> list[Finding]:
        findings: list[Finding] = []
        fmt = self._check_amount_precision(doc)
        if fmt:
            findings.append(fmt)
        for page, boxes in _boxes_for(doc):
            p = self._parse_rows(boxes)
            if p["subtotal"] is _MISSING:
                continue
            for check in (self._check_totals, self._check_due_consistency, self._check_tax_rate):
                f = check(p)
                if f:
                    findings.append(f)
            break
        return findings

    _ONE_DEC_RE = re.compile(r"[\d,]+\.\d\s*$")
    _TWO_DEC_RE = re.compile(r"[\d,]+\.\d{2}\s*$")

    def _check_amount_precision(self, doc: Document) -> Finding | None:
        """Edited figures often lose or gain a digit: a document whose other
        amounts print two decimals but whose summary rows print exactly one
        ("74,945.0" among "67,999.00") carries a strong edit artifact."""
        one_dec: list[tuple[str, object]] = []
        two_dec = 0
        for _, boxes in _boxes_for(doc):
            for b in boxes:
                t = b.text.strip()
                if not _money_only_box(t):
                    continue
                if self._ONE_DEC_RE.search(t):
                    one_dec.append((t, b))
                elif self._TWO_DEC_RE.search(t):
                    two_dec += 1
        if len(one_dec) < 2 or two_dec < 3:
            return None
        values = [v for v, _ in one_dec]
        return Finding(
            id="inv-004",
            category=self.category,
            module=self.name,
            severity="high",
            score=0.8,
            confidence=0.85,
            evidence=[f"Amounts printed with a single decimal digit: {', '.join(values)}"]
            + [f"{two_dec} other amounts on the document use two-decimal precision"],
            explanation=(
                "Printed money amounts use inconsistent precision: some summary figures carry exactly one "
                "decimal digit while the document's other amounts use two-decimal bookkeeping. Inconsistent "
                "precision is a common artifact of manually edited figures."
            ),
            fields={"one_decimal_amounts": values, "two_decimal_count": two_dec},
        )

    # ----------------------------------------------------------- parsing --

    @staticmethod
    def _parse_rows(boxes) -> dict:
        subtotal = total = due = discount = paid = other = _MISSING
        subtotal_box = total_box = due_box = tax_box = None
        # tax-ish rows collected as (y, amount, rates, box, is_service_charge)
        tax_rows: list[tuple] = []
        tax_rows_below: list[tuple] = []

        # Pass 1: anchor the summary block at its topmost row so item-table
        # rows that merely mention taxes ("GST 18%" in a description) are not
        # mistaken for printed tax amounts.
        anchor_y = None
        for b in boxes:
            t = b.text.strip()
            if not t:
                continue
            if (
                _SUBTOTAL_LABEL_RE.match(t)
                or _TOTAL_LABEL_RE.match(t)
                or _DUE_LABEL_RE.match(t)
                or _TAX_TOTAL_RE.match(t)
            ):
                anchor_y = b.y if anchor_y is None else min(anchor_y, b.y)

        for b in boxes:
            t = b.text.strip()
            if not t:
                continue
            below = anchor_y is None or b.y >= anchor_y - 4.0
            if _SUBTOTAL_LABEL_RE.match(t):
                amounts = _label_row_amounts(b, boxes)
                if amounts and subtotal is _MISSING:
                    subtotal, subtotal_box = amounts[0][1], amounts[0][2]
            elif _TAX_TOTAL_RE.match(t):
                res = _tax_row_amounts(b, boxes)
                if res:
                    row = (b.y, res[0][1], [float(r) for r in _TAX_RATE_RE.findall(t)], res[0][2], False)
                    tax_rows.append(row)
                    if below:
                        tax_rows_below.append(row)
            elif _TOTAL_LABEL_RE.match(t):
                amounts = _label_row_amounts(b, boxes)
                if amounts:
                    # Bottom-most primary total wins (Grand Total follows Total).
                    total, total_box = amounts[0][1], amounts[0][2]
            elif _DUE_LABEL_RE.match(t):
                amounts = _label_row_amounts(b, boxes)
                if amounts:
                    due, due_box = amounts[0][1], amounts[0][2]
            elif below and _DISCOUNT_LABEL_RE.search(t):
                amounts = _label_row_amounts(b, boxes)
                if amounts:
                    d = amounts[0][1]
                    discount = d if discount is _MISSING else discount + d
            elif below and _PAID_LABEL_RE.search(t):
                amounts = _label_row_amounts(b, boxes)
                if amounts:
                    pv = amounts[0][1]
                    paid = pv if paid is _MISSING else paid + pv
            elif below and _OTHER_CHARGE_RE.search(t):
                amounts = _label_row_amounts(b, boxes)
                if amounts:
                    ov = amounts[0][1]
                    other = ov if other is _MISSING else other + ov
            elif _tax_row_eligible(t):
                res = _tax_row_amounts(b, boxes)
                if res:
                    is_sc = bool(_SERVICE_CHARGE_RE.search(t))
                    row = (b.y, res[0][1], [float(r) for r in _TAX_RATE_RE.findall(t)], res[0][2], is_sc)
                    tax_rows.append(row)
                    if below:
                        tax_rows_below.append(row)

        def _rollup(rows):
            if not rows:
                return _MISSING, None, [], False
            amount = sum(r[1] for r in rows)
            rates: list[float] = []
            for r in rows:
                rates.extend(r[2])
            box = min(rows, key=lambda r: r[0])[3]
            has_sc = any(r[4] for r in rows)
            return amount, box, rates, has_sc

        tax, tax_box, tax_rates, has_sc = _rollup(tax_rows_below)
        tax_any, _, tax_rates_any, has_sc_any = _rollup(tax_rows)

        return {
            "subtotal": subtotal,
            "subtotal_box": subtotal_box,
            "total": total,
            "total_box": total_box,
            "due": due,
            "due_box": due_box,
            "discount": discount,
            "paid": paid,
            "other": other,
            "tax": tax,
            "tax_box": tax_box,
            "tax_rates": tax_rates,
            "tax_service_charge": has_sc,
            "tax_any": tax_any,
            "tax_rates_any": tax_rates_any,
            "tax_any_service_charge": has_sc_any,
        }

    # ------------------------------------------------------------ checks --

    def _check_totals(self, p: dict) -> Finding | None:
        subtotal = p["subtotal"]
        if subtotal is _MISSING:
            return None
        total, due = p["total"], p["due"]
        target = target_box = target_kind = None
        if total is not _MISSING:
            target, target_box, target_kind = total, p["total_box"], "total"
            # A balance due below the printed total means part of the invoice
            # was settled (advance / partial payment) — perfectly legitimate.
            if due is not _MISSING and due <= total + 0.01:
                due = _MISSING
        elif due is not _MISSING:
            target, target_box, target_kind = due, p["due_box"], "balance due"
        if target is None:
            return None

        discount = 0.0 if p["discount"] is _MISSING else p["discount"]
        base = subtotal - discount
        candidates = [base]
        for tax_val in (p["tax"], p["tax_any"]):
            if tax_val is not _MISSING:
                candidates.append(base + tax_val)
        if p["other"] is not _MISSING:
            extra = [c + p["other"] for c in candidates]
            candidates.extend(extra)
            if p["tax"] is not _MISSING:
                candidates.append(base + p["other"] + p["tax"])
            if p["tax_any"] is not _MISSING:
                candidates.append(base + p["other"] + p["tax_any"])
        if target_kind == "balance due" and p["paid"] is not _MISSING:
            candidates = [c - p["paid"] for c in candidates]

        tol = max(0.05, 0.005 * abs(target))
        best = min(candidates, key=lambda c: abs(c - target))
        if abs(best - target) <= tol:
            return None

        sev = "high" if abs(best - target) > max(0.05 * target, 1.0) else "medium"
        evidence = [f"Subtotal: {subtotal}"]
        if p["discount"] is not _MISSING:
            evidence.append(f"Discount: -{p['discount']}")
        if p["other"] is not _MISSING:
            evidence.append(f"Other charges: {p['other']}")
        if p["tax"] is not _MISSING:
            evidence.append(f"Tax: {p['tax']}")
        if p["paid"] is not _MISSING:
            evidence.append(f"Payments received: {p['paid']}")
        evidence.extend(
            [f"Stated {target_kind}: {target}", f"Closest consistent {target_kind}: {round(best, 2)}"]
        )
        return Finding(
            id="inv-001",
            category=self.category,
            module=self.name,
            severity=sev,
            score=0.85 if sev == "high" else 0.6,
            confidence=0.9,
            region=self._region(target_box),
            evidence=evidence,
            explanation=(
                "The stated total does not reconcile with the subtotal after accounting for itemized "
                "discounts, other charges, taxes and recorded payments. An arithmetic mismatch between "
                "printed amounts is a strong tampering indicator."
            ),
            fields={
                "observed_total": target,
                "expected_total": round(best, 2),
                "subtotal": subtotal,
                "discount": None if p["discount"] is _MISSING else p["discount"],
                "other": None if p["other"] is _MISSING else p["other"],
                "tax": None if p["tax"] is _MISSING else p["tax"],
                "paid": None if p["paid"] is _MISSING else p["paid"],
            },
        )

    def _check_due_consistency(self, p: dict) -> Finding | None:
        total, due, paid = p["total"], p["due"], p["paid"]
        if total is _MISSING or due is _MISSING or paid is _MISSING:
            return None
        expected_due = total - paid
        tol = max(0.05, 0.005 * abs(expected_due))
        if abs(expected_due - due) <= tol:
            return None
        return Finding(
            id="inv-003",
            category=self.category,
            module=self.name,
            severity="medium",
            score=0.55,
            confidence=0.75,
            region=self._region(p["due_box"]),
            evidence=[
                f"Stated total: {total}",
                f"Payments received: {paid}",
                f"Stated balance due: {due}",
                f"Expected balance due: {round(expected_due, 2)}",
            ],
            explanation=(
                "The balance due does not equal the total minus the recorded payments. An inconsistent "
                "outstanding amount can indicate edited figures."
            ),
            fields={"observed_due": due, "expected_due": round(expected_due, 2), "total": total, "paid": paid},
        )

    def _check_tax_rate(self, p: dict) -> Finding | None:
        subtotal = p["subtotal"]
        if subtotal is _MISSING or p["tax"] is _MISSING:
            return None
        discount = 0.0 if p["discount"] is _MISSING else p["discount"]
        base = subtotal - discount
        variants = [
            (p["tax"], p["tax_rates"], p["tax_service_charge"]),
            (p["tax_any"], p["tax_rates_any"], p["tax_any_service_charge"]),
        ]
        for tax_val, rates, has_sc in variants:
            if tax_val is _MISSING or not rates or has_sc:
                continue  # unverifiable or non-tax row (service charge) in this reading
            expected_tax = base * sum(rates) / 100.0
            tol = max(0.05, 0.02 * expected_tax)
            if abs(expected_tax - tax_val) <= tol:
                return None  # one printed interpretation reconciles the document
        rates = p["tax_rates"]
        if not rates:
            return None
        expected_tax = base * sum(rates) / 100.0
        return Finding(
            id="inv-002",
            category=self.category,
            module=self.name,
            severity="medium",
            score=0.55,
            confidence=0.75,
            region=self._region(p["tax_box"]),
            evidence=[
                f"Tax rate(s) printed: {sum(rates)}%",
                f"Tax on {base} at {sum(rates)}% would be {round(expected_tax, 2)}",
                f"Stated tax amount: {p['tax']}",
            ],
            explanation=(
                "The printed tax amount does not match the printed tax percentage applied to the "
                "(discount-adjusted) subtotal. Inconsistent tax arithmetic can indicate edited figures."
            ),
            fields={
                "observed_tax": p["tax"],
                "expected_tax": round(expected_tax, 2),
                "rate_pct": sum(rates),
            },
        )

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
    # Only explicit issue-date labels are checked; a generic "Date:" line on a
    # ticket or booking usually refers to a legitimate future event.
    _ISSUE_KEYS = {
        "date of issue",
        "issue date",
        "date of issuance",
        "issued",
        "issued on",
        "invoice date",
        "issue dt",
    }

    def analyze(self, doc: Document) -> list[Finding]:
        from .entities import GSTIN_FORMAT_RE, extract_entities

        findings: list[Finding] = []
        ents = extract_entities(doc)

        for key, issue in ents.labeled_dates:
            if key not in self._ISSUE_KEYS or issue is None:
                continue
            if issue > datetime.now().replace(hour=0, minute=0, second=0, microsecond=0):
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
                            evidence=[
                                f"Labeled issue date {issue.date()} is {days_ahead} days in the future"
                            ],
                            explanation=(
                                "The stated issue date lies far in the future. Future-dated documents can be "
                                "legitimate (post-dated paperwork) but are also a common forgery slip."
                            ),
                            fields={
                                "issue_date": issue.date().isoformat(),
                                "days_ahead": days_ahead,
                                "label": key,
                            },
                        )
                    )

        reported: set[str] = set()
        for gstin in ents.gstins:
            raw = gstin.strip()
            # A captured span may hold several identifiers ("A...Z5,07B...Z5");
            # short fragments next to a *valid* GSTIN are treated as noise,
            # standalone garbage identifiers are still called out.
            parts = [p for p in re.split(r"[^A-Z0-9]+", raw) if p]
            valid15 = any(GSTIN_FORMAT_RE.fullmatch(p) for p in parts)
            for part in parts:
                if part in reported:
                    continue
                if len(part) == 15:
                    bad = not GSTIN_FORMAT_RE.fullmatch(part)
                elif len(part) < 6 or valid15:
                    continue  # OCR noise / fragment of a complete identifier
                else:
                    bad = True  # a short, standalone printed identifier
                if bad:
                    reported.add(part)
                    findings.append(
                        Finding(
                            id="unv-002",
                            category=self.category,
                            module=self.name,
                            severity="low",
                            score=0.35,
                            confidence=0.8,
                            evidence=[
                                f"Identifier '{part}' does not match the GSTIN structure "
                                "(15-char state+PAN+check layout)"
                            ],
                            explanation=(
                                "A printed tax identifier fails its declared format. Format violations in "
                                "registration numbers are cheap, strong tampering signals. Checksum validity "
                                "against the issuing registry is not verified by this system."
                            ),
                            fields={"gstin": part, "issue": "format"},
                        )
                    )
        return findings