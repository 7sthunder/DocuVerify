import threading
from statistics import mean

import pymupdf

from .config import CANVAS_W, MAX_PAGES, RELIABLE_OCR_MEAN
from .document import Document, PageContext
from .schemas import TextBox

_ENGINE = None
_ENGINE_LOCK = threading.RLock()


def _engine():
    global _ENGINE
    with _ENGINE_LOCK:
        if _ENGINE is None:
            from rapidocr_onnxruntime import RapidOCR

            _ENGINE = RapidOCR()
        return _ENGINE


def _scale_coords(x0, y0, x1, y1, k):
    return round(x0 * k, 2), round(y0 * k, 2), round((x1 - x0) * k, 2), round((y1 - y0) * k, 2)


def extract_native(pdf: pymupdf.Document, page_no: int, canvas_w: int = CANVAS_W) -> list[TextBox]:
    page = pdf[page_no]
    k = canvas_w / page.rect.width
    boxes: list[TextBox] = []
    data = page.get_text("dict")
    for block in data["blocks"]:
        if block["type"] != 0:
            continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                if not text:
                    continue
                x, y, w, h = _scale_coords(*span["bbox"], k)
                boxes.append(
                    TextBox(
                        text=text,
                        x=x,
                        y=y,
                        w=w,
                        h=h,
                        page=page_no,
                        confidence=None,
                        source="native",
                        font=span["font"],
                        size=round(span["size"] * k, 2),
                        flags=span["flags"],
                        color=span["color"],
                    )
                )
    return boxes


def extract_ocr(image_path: str, page_no: int) -> list[TextBox]:
    with _ENGINE_LOCK:
        result, _ = _engine()(str(image_path))
    boxes: list[TextBox] = []
    for item in result or []:
        quad, text, score = item
        xs = [p[0] for p in quad]
        ys = [p[1] for p in quad]
        boxes.append(
            TextBox(
                text=text,
                x=round(min(xs), 2),
                y=round(min(ys), 2),
                w=round(max(xs) - min(xs), 2),
                h=round(max(ys) - min(ys), 2),
                page=page_no,
                confidence=round(float(score), 3),
                source="ocr",
            )
        )
    return boxes


def extract(doc: Document, run_ocr: bool = True) -> Document:
    from io import BytesIO

    if doc.kind == "pdf":
        if doc.pdf_text_present:
            pdf = pymupdf.open(stream=doc.original_path.read_bytes(), filetype="pdf")
            for page_ctx in doc.pages:
                page_ctx.textboxes = extract_native(pdf, page_ctx.index)
            pdf.close()
        confs = []
        if run_ocr:
            for page_ctx in doc.pages:
                if not page_ctx.image_path:
                    continue
                page_ctx.ocr_boxes = extract_ocr(str(page_ctx.image_path), page_ctx.index)
                confs.extend(b.confidence for b in page_ctx.ocr_boxes if b.confidence)
        doc.ocr_mean_conf = mean(confs) if confs else None
    else:
        page_ctx = doc.pages[0]
        if run_ocr:
            page_ctx.ocr_boxes = extract_ocr(str(page_ctx.image_path), 0)
        confs = [b.confidence for b in page_ctx.ocr_boxes if b.confidence]
        doc.ocr_mean_conf = mean(confs) if confs else None
    return doc