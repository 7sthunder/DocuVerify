import re
from collections import Counter
from statistics import median

from ..document import Document
from ..schemas import Finding, Region
from .base import Analyzer, _next_id


def _family(font: str) -> str:
    return re.sub(r"-(Bold|Italic|Roman|Regular|Oblique|BoldItalic|Light|Medium)$", "", font)


class TypographyAnalyzer(Analyzer):
    name = "typography_analyzer"
    category = "typography"

    def analyze(self, doc: Document) -> list[Finding]:
        if not doc.pdf_text_present:
            return []
        findings: list[Finding] = []
        all_boxes = [b for p in doc.pages for b in p.textboxes if b.font]
        if len(all_boxes) < 4:
            return []

        fam_counts = Counter(_family(b.font) for b in all_boxes)
        total = len(all_boxes)
        dominant_families: set[str] = set()
        acc = 0
        for fam, c in fam_counts.most_common():
            dominant_families.add(fam)
            acc += c
            if acc / total >= 0.85:
                break

        sizes = [b.size for b in all_boxes if b.size]
        global_median = median(sizes) if sizes else 12.0

        font_sizes: dict[str, list[float]] = {}
        for b in all_boxes:
            if b.font:
                font_sizes.setdefault(b.font, []).append(b.size or 0)

        for page in doc.pages:
            for b in page.textboxes:
                if not b.font or not b.size:
                    continue
                fam = _family(b.font)
                region = Region(page=b.page, x=b.x, y=b.y, w=b.w, h=b.h)
                fam_n = fam_counts[fam]
                if fam not in dominant_families:
                    ratio = b.size / global_median if global_median else 1.0
                    if fam_n == 1 and (ratio > 1.35 or ratio < 0.7):
                        severity, score = "high", min(1.0, abs(ratio - 1) + 0.3)
                    elif fam_n <= 2:
                        severity, score = "medium", 0.55
                    else:
                        severity, score = "low", 0.35
                    findings.append(
                        Finding(
                            id=_next_id("typ"),
                            category=self.category,
                            module=self.name,
                            severity=severity,
                            score=round(score, 3),
                            confidence=0.7,
                            region=region,
                            evidence=[
                                f"Font '{b.font}' ({fam} family) appears {fam_n}x in the document while dominant families "
                                f"cover {round(acc / total * 100)}% of text",
                                f"Span size {b.size}px vs document median {round(global_median, 1)}px",
                            ],
                            explanation=(
                                f"The region uses font family '{fam}' ({b.font}, {b.size}px), which is atypical for this "
                                "document. Surrounding content follows the dominant typography; an isolated foreign font "
                                "is a classic sign that a field was re-rendered independently."
                            ),
                            fields={"font": b.font, "family": fam, "size": b.size, "family_count": fam_n},
                        )
                    )
                else:
                    same_font = [s for s in font_sizes.get(b.font, []) if s > 0]
                    if len(same_font) >= 3:
                        fam_med = median(same_font)
                        if fam_med > 0 and b.size > fam_med * 1.45:
                            findings.append(
                                Finding(
                                    id=_next_id("typ"),
                                    category=self.category,
                                    module=self.name,
                                    severity="medium",
                                    score=0.5,
                                    confidence=0.6,
                                    region=region,
                                    evidence=[
                                        f"Font family '{fam}' median size {round(fam_med, 1)}px; this span is {round(b.size, 1)}px "
                                        f"({round(b.size / fam_med * 100)}%)",
                                        f"Font name: {b.font}",
                                    ],
                                    explanation=(
                                        "This span carries the document's dominant font family but at a markedly different "
                                        "size than the family's usual usage, suggesting it may have been inserted/edited separately."
                                    ),
                                    fields={"font": b.font, "size": b.size, "family_median_size": round(fam_med, 1)},
                                )
                            )
        return findings