from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .schemas import TextBox


@dataclass
class PageContext:
    index: int
    width: int
    height: int
    image_path: Optional[Path] = None
    textboxes: list[TextBox] = field(default_factory=list)
    ocr_boxes: list[TextBox] = field(default_factory=list)


@dataclass
class Document:
    original_path: Path
    kind: str
    pages: list[PageContext]
    metadata: dict
    pdf_text_present: bool
    ocr_mean_conf: Optional[float] = None
    raw_metadata: dict = field(default_factory=dict)