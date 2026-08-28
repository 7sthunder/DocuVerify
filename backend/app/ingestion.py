import mimetypes
from pathlib import Path

import pymupdf
from PIL import Image

from .config import CANVAS_W, MAX_PAGES, MAX_UPLOAD_BYTES
from .document import Document, PageContext

ALLOWED_EXT = {".pdf", ".jpg", ".jpeg", ".png"}
PDF_MAGIC = b"%PDF"
JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG"


class ValidationError(ValueError):
    pass


def validate_bytes(data: bytes, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise ValidationError(f"Unsupported file type: {ext}")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValidationError("File exceeds the 25 MB size limit")
    n = min(len(data), 1024)
    head = data[:n]
    if ext == ".pdf":
        if not head.startswith(PDF_MAGIC):
            raise ValidationError("File is not a valid PDF")
    else:
        if not (head.startswith(JPEG_MAGIC) or head.startswith(PNG_MAGIC)):
            raise ValidationError("File is not a valid image")
    return ext


def _save_original(job_dir: Path, data: bytes, ext: str) -> Path:
    path = job_dir / f"original{ext}"
    path.write_bytes(data)
    return path


def _resize_to_canvas(img: Image.Image, canvas_w: int = CANVAS_W) -> Image.Image:
    if img.width == canvas_w:
        return img.convert("RGB")
    k = canvas_w / img.width
    return img.resize((canvas_w, max(1, round(img.height * k))), Image.LANCZOS).convert("RGB")


def _render_pdf_page(page: pymupdf.Page, save_to: Path, canvas_w: int = CANVAS_W) -> tuple[int, int]:
    k = canvas_w / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(k, k), colorspace=pymupdf.csRGB, alpha=False)
    pix.save(str(save_to))
    return pix.width, pix.height


def _pdf_doc_from_bytes(data: bytes) -> pymupdf.Document:
    doc = pymupdf.open(stream=data, filetype="pdf")
    if doc.needs_pass:
        raise ValidationError("Password-protected PDFs are not supported")
    return doc


def ingest(data: bytes, filename: str, job_dir: Path) -> Document:
    job_dir.mkdir(parents=True, exist_ok=True)
    ext = validate_bytes(data, filename)

    if ext == ".pdf":
        return _ingest_pdf(data, job_dir)
    return _ingest_image(data, ext, job_dir)


def _ingest_pdf(data: bytes, job_dir: Path) -> Document:
    pdf = _pdf_doc_from_bytes(data)
    if pdf.page_count > MAX_PAGES:
        raise ValidationError(f"Documents over {MAX_PAGES} pages are not supported")
    raw_metadata = dict(pdf.metadata or {})
    pages_dir = job_dir / "pages"
    pages_dir.mkdir(exist_ok=True)

    pages: list[PageContext] = []
    text_present = False
    for i, page in enumerate(pdf):
        txt = page.get_text("text").strip()
        if txt:
            text_present = True
        img_path = pages_dir / f"page_{i}.png"
        w, h = _render_pdf_page(page, img_path)
        pages.append(
            PageContext(
                index=i,
                width=w,
                height=h,
                image_path=img_path,
                textboxes=[],
                ocr_boxes=[],
            )
        )
    orig = _save_original(job_dir, data, ".pdf")
    pdf.close()
    return Document(
        original_path=orig,
        kind="pdf",
        pages=pages,
        metadata=raw_metadata,
        pdf_text_present=text_present,
        raw_metadata=raw_metadata,
    )


def _ingest_image(data: bytes, ext: str, job_dir: Path) -> Document:
    import io

    from PIL import Image

    img = Image.open(io.BytesIO(data))
    img.verify()
    img = Image.open(io.BytesIO(data))

    pages_dir = job_dir / "pages"
    pages_dir.mkdir(exist_ok=True)
    canvas = _resize_to_canvas(img)
    img_path = pages_dir / "page_0.png"
    canvas.save(str(img_path))

    pages = [
        PageContext(
            index=0,
            width=canvas.width,
            height=canvas.height,
            image_path=img_path,
            textboxes=[],
            ocr_boxes=[],
        )
    ]
    exif = {k: str(v) for k, v in (img.getexif() or {}).items()}
    orig = _save_original(job_dir, data, ext)
    return Document(
        original_path=orig,
        kind="image",
        pages=pages,
        metadata={},
        pdf_text_present=False,
        raw_metadata={"exif": exif},
    )