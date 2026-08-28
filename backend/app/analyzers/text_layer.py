import re
from difflib import SequenceMatcher

from ..document import Document
from ..schemas import Finding
from .base import Analyzer, _next_id


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9]+", " ", s.lower())).strip()


class TextLayerAnalyzer(Analyzer):
    name = "text_layer_analyzer"
    category = "text_layer"

    def analyze(self, doc: Document) -> list[Finding]:
        if not (doc.pdf_text_present and any(p.ocr_boxes for p in doc.pages)):
            return []
        native = _norm(" ".join(b.text for p in doc.pages for b in p.textboxes))
        ocr = _norm(" ".join(b.text for p in doc.pages for b in p.ocr_boxes))
        if not native or not ocr:
            return []
        ratio = SequenceMatcher(None, native, ocr).ratio()
        if ratio < 0.6:
            return [
                Finding(
                    id=_next_id("tl"),
                    category=self.category,
                    module=self.name,
                    severity="high",
                    score=0.8 if ratio < 0.4 else 0.65,
                    confidence=0.7,
                    evidence=[
                        f"Text-layer vs rendered-pixel text similarity: {ratio:.2f}",
                        f"Native layer: {len(native.split())} tokens; OCR of render: {len(ocr.split())} tokens",
                    ],
                    explanation=(
                        "The selectable text layer disagrees strongly with what is actually printed on the rendered page. "
                        "Such a divergence can indicate the text layer was edited or desynchronized from the visible content."
                    ),
                    fields={"similarity": round(ratio, 3)},
                )
            ]
        return []