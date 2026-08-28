"""Generic entity extraction over document text boxes.

Reusable across classification, domain verifiers and the report. Operates on
the document's native text spans (falling back to OCR boxes) and never
mutates the document.
"""
import re
from dataclasses import dataclass, field
from datetime import datetime

from .document import Document

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

_DATE_TEXT_RE = re.compile(
    r"(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})", re.I
)
_DATE_NUMERIC_RE = re.compile(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})")
_LABELED_DATE_RE = re.compile(
    r"^\s*(date|dated|issue date|date of issue|date of issuance|issued|issued on|invoice date|order date)\s*[:\-]",
    re.I,
)
_MONEY_RE = re.compile(
    r"(?:rs\.?|inr|usd|eur|gbp|\u20B9|\$|\u20AC|\u00A3)?\s*((?:\d{1,3}(?:,\d{2,3})*|\d+)(?:\.\d{1,2})?)",
    re.I,
)
_MONEY_STRICT_RE = re.compile(
    r"(?:rs\.?|inr|usd|eur|gbp|\u20B9|\$|\u20AC|\u00A3)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+\.\d{2})\b", re.I
)
_ID_LABEL_RE = re.compile(
    r"^\s*([A-Za-z][A-Za-z .]{0,24}(?:no|number|id)\.?|gstin|pan|ref|reference|reg no|reg\. no)\s*[:\-]\s*(.+)$",
    re.I,
)
_GSTIN_LABELED_RE = re.compile(
    r"\b(?:gstin|gst)\b\s*[:\-]?\s*([0-9A-Z][0-9A-Z/,;.\-]{5,38})", re.I
)
GSTIN_FORMAT_RE = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]$")


@dataclass
class Entities:
    dates: list[datetime] = field(default_factory=list)
    labeled_dates: list[tuple[str, datetime]] = field(default_factory=list)
    amounts: list[float] = field(default_factory=list)
    identifiers: dict[str, str] = field(default_factory=dict)
    gstins: list[str] = field(default_factory=list)
    text: str = ""


def full_text(doc: Document) -> str:
    return " ".join(
        b.text for p in doc.pages for b in (p.textboxes if p.textboxes else p.ocr_boxes)
    )


def _parse_date_text(m: re.Match) -> datetime | None:
    try:
        return datetime(int(m.group(3)), MONTHS.index(m.group(2).lower()) + 1, int(m.group(1)))
    except ValueError:
        return None


def _parse_date_numeric(m: re.Match) -> datetime | None:
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return None
    try:
        return datetime(y, mo, d)
    except ValueError:
        return None


def _money_value(raw: str) -> float | None:
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return None


def extract_entities(doc: Document) -> Entities:
    ents = Entities(text=full_text(doc).lower())
    for p in doc.pages:
        boxes = p.textboxes if p.textboxes else p.ocr_boxes
        for b in boxes:
            t = b.text.strip()
            if not t:
                continue
            if _LABELED_DATE_RE.match(t):
                for m in _DATE_TEXT_RE.finditer(t):
                    d = _parse_date_text(m)
                    if d:
                        ents.labeled_dates.append((t.split(":")[0].strip().lower(), d))
                        break
                for m in _DATE_NUMERIC_RE.finditer(t):
                    d = _parse_date_numeric(m)
                    if d:
                        ents.labeled_dates.append((t.split(":")[0].strip().lower(), d))
                        break
            for m in _DATE_TEXT_RE.finditer(t):
                d = _parse_date_text(m)
                if d:
                    ents.dates.append(d)
            for m in _MONEY_STRICT_RE.finditer(t):
                v = _money_value(m.group(1) or m.group(2))
                if v is not None:
                    ents.amounts.append(v)
            idm = _ID_LABEL_RE.match(t)
            if idm:
                ents.identifiers[idm.group(1).strip().rstrip(":").lower()] = idm.group(2).strip()
            gst_m = _GSTIN_LABELED_RE.search(t)
            # Tax identifiers always contain digits; captures like "INVOICE"
            # (from "GST Invoice Number:") are title words, not identifiers.
            if gst_m and re.search(r"\d", gst_m.group(1)):
                ents.gstins.append(gst_m.group(1).upper())
    ents.dates.extend(d for _, d in ents.labeled_dates)
    return ents
