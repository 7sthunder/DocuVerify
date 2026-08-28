from .analyzers.base import _next_id
from .analyzers.typography import _family
from .document import Document
from .schemas import Finding, Region


def _boxes(doc: Document):
    out = []
    for page in doc.pages:
        out.extend(page.textboxes if page.textboxes else page.ocr_boxes)
    return sorted(out, key=lambda b: (b.y, b.x))


def compare_docs(template: Document, subject: Document) -> list[Finding]:
    t = _boxes(template)
    d = _boxes(subject)
    findings: list[Finding] = []

    n = min(len(t), len(d))
    for i in range(n):
        tb, db = t[i], d[i]
        if abs(db.y - tb.y) > 90:
            continue
        dx = abs(db.x - tb.x)
        if dx >= 70:
            findings.append(
                Finding(
                    id=_next_id("refpos"),
                    category="reference",
                    module="reference_compare",
                    severity="medium" if dx >= 150 else "low",
                    score=min(1.0, dx / 260),
                    confidence=0.7,
                    region=Region(page=db.page, x=db.x, y=db.y, w=db.w, h=db.h),
                    evidence=[
                        f"Template block x={tb.x:.0f} vs document block x={db.x:.0f} (shift {dx:.0f}px)",
                        f"'{tb.text[:24]}' -> '{db.text[:24]}'",
                    ],
                    explanation=(
                        "This block sits at a different horizontal position than the corresponding block in the "
                        "official template. Deviation from the reference layout indicates relocation or re-rendering."
                    ),
                    fields={"shift_px": round(dx, 1)},
                )
            )
        if tb.font and db.font and _family(tb.font) != _family(db.font):
            findings.append(
                Finding(
                    id=_next_id("reffont"),
                    category="reference",
                    module="reference_compare",
                    severity="medium",
                    score=0.6,
                    confidence=0.7,
                    region=Region(page=db.page, x=db.x, y=db.y, w=db.w, h=db.h),
                    evidence=[f"Template font {tb.font} vs document font {db.font} (same region)"],
                    explanation=(
                        "The font used here differs from the official template's font for this region. Typographic "
                        "deviation from a reference is a common edit indicator."
                    ),
                    fields={"template_font": tb.font, "doc_font": db.font},
                )
            )

    for tb in t[len(d):]:
        findings.append(
            Finding(
                id=_next_id("refmiss"),
                category="reference",
                module="reference_compare",
                severity="medium",
                score=0.5,
                confidence=0.6,
                region=None,
                evidence=[f"Template block '{tb.text[:30]}' has no counterpart in the document"],
                explanation="A content block present in the official template appears to be missing from the document.",
                fields={"missing": tb.text[:50]},
            )
        )
    for db in d[len(t):]:
        findings.append(
            Finding(
                id=_next_id("refextra"),
                category="reference",
                module="reference_compare",
                severity="low",
                score=0.4,
                confidence=0.6,
                region=Region(page=db.page, x=db.x, y=db.y, w=db.w, h=db.h),
                evidence=[f"Document block '{db.text[:30]}' has no counterpart in the template"],
                explanation="The document contains a content block not present in the official template.",
                fields={"extra": db.text[:50]},
            )
        )
    return findings


def compare_weights(base: dict) -> dict:
    total = sum(base.values())
    if total <= 0:
        total = 1.0
    scale = (1.0 - 0.15) / total
    weights = {k: round(v * scale, 4) for k, v in base.items()}
    weights["reference"] = 0.15
    return weights