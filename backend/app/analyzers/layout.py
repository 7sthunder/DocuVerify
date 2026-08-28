from collections import Counter
import re

from ..document import Document
from ..schemas import Finding, Region
from .base import Analyzer, _next_id


def _is_amount(text: str) -> bool:
    """Pure numeric/amount spans (invoice totals, prices, money) — weaker alignment signal."""
    t = "".join(ch for ch in text if ch not in " \t,₹$€£%,.()")
    t = re.sub(r"^(rs|inr|usd|eur|gbp)", "", t, flags=re.I)
    if not t:
        return True
    return t.isdigit()


class LayoutAnalyzer(Analyzer):
    name = "layout_analyzer"
    category = "layout"

    def analyze(self, doc: Document) -> list[Finding]:
        findings: list[Finding] = []
        for page in doc.pages:
            boxes = page.textboxes if page.textboxes else page.ocr_boxes
            if len(boxes) < 6:
                continue
            pw, ph = page.width, page.height
            body = [
                b
                for b in boxes
                if b.y < ph * 0.75
                and b.w < 0.6 * pw
                and b.w >= 16
                and b.h <= ph * 0.2
                and abs((b.x + b.w / 2) - pw / 2) >= 30
            ]
            if len(body) < 4:
                continue

            dom_l = Counter(
                round(b.x / 16) * 16 for b in body
            ).most_common(1)[0][0]
            dom_count = sum(1 for b in body if abs(b.x - dom_l) < 16)

            # Boxes are considered "column-anchored" when at least 2 other blocks
            # share the same x position anywhere on the page (a repeated column).
            near_floor = 2
            # Field-value columns on the right half of the page (totals, dates,
            # customer fields) are naturally ragged: when several blocks live in
            # that zone it is a column, not an isolated shift.
            right_zone = [o for o in body if o.x > pw * 0.6]
            findings_for_page: list[Finding] = []
            for b in body:
                if b.y < ph * 0.10:
                    continue
                dev = b.x - dom_l
                adev = abs(dev)
                if adev < 115:
                    continue
                if b.x > pw * 0.6 and len(right_zone) >= 4:
                    continue
                near = sum(
                    1
                    for o in boxes
                    if abs(o.x - b.x) < 16 and abs(o.y - b.y) >= 30
                )
                near_right = sum(
                    1
                    for o in boxes
                    if abs((o.x + o.w) - (b.x + b.w)) < 16 and abs(o.y - b.y) >= 30
                )
                if near >= near_floor or near_right >= near_floor:
                    continue
                # A value box printed immediately after its label on the same
                # row ("Invoice Number: TBC0626...") is natural label:value
                # layout, not an independently shifted block.
                bcy = b.y + b.h / 2
                row_gap = max(18.0, b.h * 1.2)
                after_label = any(
                    o is not b
                    and abs((o.y + o.h / 2) - bcy) <= row_gap
                    and o.x < b.x
                    and -2 <= b.x - (o.x + o.w) <= 12
                    for o in boxes
                )
                if after_label:
                    continue
                right_flush = (b.x + b.w) > pw - 40
                if _is_amount(b.text):
                    if right_flush or adev < 170:
                        continue
                elif right_flush and adev < 320:
                    continue
                severity = "high" if adev > 210 else ("medium" if adev > 150 else "low")
                score = min(1.0, adev / 280)
                if b.y > ph * 0.60:
                    # Signature / footer / caption zone: single out-of-line captions are
                    # common in legitimate documents, so cap the hit at medium.
                    severity = "medium"
                    score = min(0.6, score)
                findings_for_page.append(
                    Finding(
                        id=_next_id("lay"),
                        category=self.category,
                        module=self.name,
                        severity=severity,
                        score=round(score, 3),
                        confidence=0.6,
                        region=Region(page=b.page, x=b.x, y=b.y, w=b.w, h=b.h),
                        evidence=[
                            f"Block left edge at x={b.x:.0f} vs dominant content alignment x={dom_l:.0f}",
                            f"Deviation {adev:.0f}px; {dom_count} body blocks share the dominant alignment",
                        ],
                        explanation=(
                            f"The horizontal position of '{b.text[:28]}' deviates {adev:.0f}px from the dominant "
                            f"alignment used by the surrounding content, and no other block shares its x position. "
                            "Isolated, unaligned text can indicate a field that was re-rendered or shifted independently."
                        ),
                        fields={"dominant_left": dom_l, "deviation_px": round(adev, 1)},
                    )
                )

            findings_for_page.sort(key=lambda f: f.score, reverse=True)
            findings.extend(findings_for_page[:4])
        return findings