from collections import Counter

from ..document import Document
from ..schemas import Finding, Region
from .base import Analyzer, _next_id


class LayoutAnalyzer(Analyzer):
    name = "layout_analyzer"
    category = "layout"

    def analyze(self, doc: Document) -> list[Finding]:
        findings: list[Finding] = []
        for page in doc.pages:
            boxes = page.textboxes if page.textboxes else page.ocr_boxes
            if len(boxes) < 5:
                continue
            pw, ph = page.width, page.height
            body = [
                b
                for b in boxes
                if b.y < ph * 0.75 and b.w < 0.6 * pw and abs((b.x + b.w / 2) - pw / 2) >= 30
            ]
            if len(body) < 4:
                continue
            dom_l = Counter(round(b.x / 16) * 16 for b in body).most_common(1)[0][0]
            dom_count = sum(1 for b in body if abs(b.x - dom_l) < 16)
            for b in body:
                dev = b.x - dom_l
                if abs(dev) < 110:
                    continue
                near = sum(1 for o in boxes if abs(o.x - b.x) < 18)
                if near >= max(3, int(len(boxes) * 0.12)):
                    continue
                adev = abs(dev)
                severity = "high" if adev > 200 else ("medium" if adev > 140 else "low")
                score = min(1.0, adev / 260)
                findings.append(
                    Finding(
                        id=_next_id("lay"),
                        category=self.category,
                        module=self.name,
                        severity=severity,
                        score=round(score, 3),
                        confidence=0.7,
                        region=Region(page=b.page, x=b.x, y=b.y, w=b.w, h=b.h),
                        evidence=[
                            f"Block left edge at x={b.x:.0f} vs dominant content alignment x={dom_l:.0f}",
                            f"Deviation {adev:.0f}px; {dom_count} of {len(body)} body blocks share the dominant alignment",
                        ],
                        explanation=(
                            f"The horizontal position of '{b.text[:28]}' deviates {adev:.0f}px from the dominant "
                            f"alignment used by the upper-region content. The block is neither centered nor part of the "
                            "signature zone, so a lateral offset can indicate relocated or re-positioned text."
                        ),
                        fields={"dominant_left": dom_l, "deviation_px": round(dev, 1)},
                    )
                )
        return findings