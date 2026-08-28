import statistics

import cv2
import numpy as np
from PIL import Image

from ..document import Document
from ..schemas import Finding, Region
from .base import Analyzer, _next_id

TILE = 64
MIN_CLUSTER_TILES = 10


def _tile_sharpness(gray: np.ndarray, tile: int = TILE) -> tuple[np.ndarray, int, int]:
    h, w = gray.shape
    rows = h // tile
    cols = w // tile
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    lap2 = laplacian ** 2
    sharp = np.zeros((rows, cols), dtype=np.float64)
    for r in range(rows):
        for c in range(cols):
            block = lap2[r * tile : (r + 1) * tile, c * tile : (c + 1) * tile]
            sharp[r, c] = block.mean()
    return sharp, rows, cols


def _text_tile_mask(doc, page_idx, rows, cols, tile=64) -> np.ndarray:
    page = doc.pages[page_idx]
    boxes = page.textboxes if page.textboxes else page.ocr_boxes
    mask = np.zeros((rows, cols), dtype=bool)
    for b in boxes:
        r0, c0 = int(b.y // tile), int(b.x // tile)
        r1, c1 = int((b.y + b.h) // tile), int((b.x + b.w) // tile)
        r0, c0 = max(0, r0), max(0, c0)
        r1, c1 = min(rows - 1, r1), min(cols - 1, c1)
        mask[r0 : r1 + 1, c0 : c1 + 1] = True
    return mask


class VisualAnalyzer(Analyzer):
    name = "visual_analyzer"
    category = "visual"

    def analyze(self, doc: Document) -> list[Finding]:
        findings: list[Finding] = []
        for page in doc.pages:
            if not page.image_path:
                continue
            gray = np.array(Image.open(page.image_path).convert("L"), dtype=np.uint8)
            sharp, rows, cols = _tile_sharpness(gray)
            text_mask = _text_tile_mask(doc, page.index, rows, cols)

            text_vals = sharp[text_mask].ravel()
            if len(text_vals) < 8:
                continue
            ref = float(np.median(text_vals))
            if ref <= 1e-6:
                continue

            outlier = np.zeros((rows, cols), dtype=np.uint8)
            for r in range(rows):
                for c in range(cols):
                    if text_mask[r, c] or r < 2 or c < 2 or r >= rows - 2 or c >= cols - 2:
                        continue
                    if float(sharp[r, c]) > ref * 2.2:
                        outlier[r, c] = 1

            num, labels, stats, _ = cv2.connectedComponentsWithStats(outlier, connectivity=8)
            for i in range(1, num):
                area = int(stats[i, cv2.CC_STAT_AREA])
                if area < MIN_CLUSTER_TILES:
                    continue
                x, y, w, h = (
                    int(stats[i, cv2.CC_STAT_LEFT]),
                    int(stats[i, cv2.CC_STAT_TOP]),
                    int(stats[i, cv2.CC_STAT_WIDTH]),
                    int(stats[i, cv2.CC_STAT_HEIGHT]),
                )
                aspect = w / max(h, 1)
                if not (0.4 <= aspect <= 2.5 and min(w, h) >= 2 * TILE):
                    continue
                x *= TILE
                y *= TILE
                w *= TILE
                h *= TILE
                cluster_sharp = float(np.median(sharp[y // TILE : (y + h) // TILE, x // TILE : (x + w) // TILE]))
                score = min(1.0, 0.3 + (area * 0.03))
                findings.append(
                    Finding(
                        id=_next_id("vis"),
                        category=self.category,
                        module=self.name,
                        severity="medium",
                        score=round(score, 3),
                        confidence=0.6,
                        region=Region(page=page.index, x=x, y=y, w=w, h=h),
                        evidence=[
                            f"Region average sharpness = {cluster_sharp:.0f} vs text-content reference = {ref:.0f}",
                            f"Cluster spans ~{area} tiles with no overlapping text, ~{round(aspect, 2)}x aspect",
                        ],
                        explanation=(
                            "This image region carries a texture and detail profile significantly denser than the page's "
                            "own text content, with no text overlapping it. A visually distinct patch can indicate an "
                            "inserted or pasted element."
                        ),
                        fields={"cluster_sharpness": round(cluster_sharp, 2), "reference": round(ref, 2), "area_tiles": area},
                    )
                )
        return findings


def analyze_embedded_images(doc: Document) -> list[Finding]:
    findings: list[Finding] = []
    if doc.kind != "pdf":
        return findings
    import pymupdf

    from ..config import CANVAS_W

    pdf = pymupdf.open(stream=doc.original_path.read_bytes(), filetype="pdf")
    for page_no, page_ctx in enumerate(doc.pages):
        try:
            infos = pdf[page_no].get_image_info()
        except Exception:
            continue
        k = CANVAS_W / pdf[page_no].rect.width
        for info in infos:
            bbox = info.get("bbox")
            iw, ih = info.get("width", 0), info.get("height", 0)
            if not bbox or not iw:
                continue
            placed_w = bbox[2] - bbox[0]
            if placed_w <= 0:
                continue
            placed_dpi = (iw / placed_w) * 72
            if placed_dpi >= 120:
                continue
            x, y = bbox[0] * k, bbox[1] * k
            w, h = (bbox[2] - bbox[0]) * k, (bbox[3] - bbox[1]) * k
            placed_h = bbox[3] - bbox[1]
            factor = max(iw / placed_w, ih / placed_h)
            findings.append(
                Finding(
                    id=_next_id("visimg"),
                    category="visual",
                    module="visual_analyzer",
                    severity="medium",
                    score=0.6,
                    confidence=0.7,
                    region=Region(page=page_no, x=x, y=y, w=w, h=h),
                    evidence=[
                        f"Embedded image placed at {placed_dpi:.0f} DPI (nominal ~150+); source {iw}x{ih}px",
                        f"Upscale factor ~{factor:.1f}x relative to placed size",
                    ],
                    explanation=(
                        "An embedded image is rendered much larger than its native pixel resolution. "
                        "Heavily upscaled inserts tend to look soft or blocky next to the rest of the document."
                    ),
                    fields={"placed_dpi": round(placed_dpi, 1), "upscale": round(factor, 1)},
                )
            )
    pdf.close()
    return findings