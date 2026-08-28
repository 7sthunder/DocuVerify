import re
from datetime import datetime

from ..document import Document
from ..schemas import Finding, Region
from .base import Analyzer, _next_id


def _region(box) -> Region | None:
    if box is None:
        return None
    return Region(page=box.page, x=box.x, y=box.y, w=box.w, h=box.h)

MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
STOP_WORDS = {
    "university", "institute", "college", "techn", "certif", "engineering", "council",
    "board", "government", "ministry", "commission", "academy", "school", "emblen",
}

CERT_HINTS = (
    "certificate", "certif", "to certify", "completion", "awarded", "degree", "bachelor",
    "master", "diploma", "graduate", "graduat", "cgpa", " sgpa", "gpa", "percentage",
    "percent", "semester", "examination", "transcript", "statement of marks", "marksheet",
    "marks sheet", "hall ticket", "admit card", "academic", "registration number",
    "reg no", "roll number", "testamur", "to the body", "curriculum",
)

_YEAR_RANGE_RE = re.compile(r"(\d{4})\s*[-–]\s*(\d{4})")
_DATE_TEXT_RE = re.compile(r"(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})", re.I)
_CGPA_RE = re.compile(r"cgpa\s*[:.\-]?\s*([\d.,]+)\s*\(?\s*(?:out\s*of|of|/)\s*([\d.,]+)", re.I)
_REG_RE = re.compile(r"\b(?:reg(?:\.?\s*no|istration(?:\s*no)?)?)\s*[:\-]\s*([A-Z0-9\-]{5,20})", re.I)


def _document_text(doc: Document) -> str:
    return " ".join(b.text for p in doc.pages for b in (p.textboxes if p.textboxes else p.ocr_boxes)).lower()


def _certificate_like(doc: Document) -> bool:
    text = _document_text(doc)
    return any(h in text for h in CERT_HINTS)


def _box_for_doc(doc: Document) -> list:
    return list(doc.pages[0].textboxes) if doc.pages[0].textboxes else list(doc.pages[0].ocr_boxes)


def _extract_fields(doc: Document) -> dict:
    boxes = [b for p in doc.pages for b in (p.textboxes if p.textboxes else p.ocr_boxes)]
    texts = [b.text.strip() for b in boxes]

    fields = {
        "names": [],
        "cgpa": None,
        "cgpa_scale": None,
        "year_start": None,
        "year_end": None,
        "issue_date": None,
        "regno": [],
        "cgpa_box": None,
        "date_box": None,
        "range_box": None,
    }

    for t in texts:
        words = t.split()
        if len(words) >= 2 and all(w.isalpha() or w == "." for w in words):
            if sum(1 for w in words if w[0].isupper() and len(w) >= 3) == len(words) and len(t) <= 40:
                low = t.lower()
                if not any(s in low for s in STOP_WORDS) and "certificate of" not in low and "to certify" not in low:
                    fields["names"].append(t)

    for t in texts:
        m = _CGPA_RE.search(t)
        if m and fields["cgpa"] is None:
            fields["cgpa"] = float(m.group(1).replace(",", "."))
            fields["cgpa_scale"] = float(m.group(2).replace(",", "."))
            fields["cgpa_box"] = boxes[texts.index(t)]

    for t in texts:
        m = _YEAR_RANGE_RE.search(t)
        if m and fields["year_start"] is None:
            fields["year_start"] = int(m.group(1))
            fields["year_end"] = int(m.group(2))
            fields["range_box"] = boxes[texts.index(t)]

    for t in texts:
        m = _DATE_TEXT_RE.search(t)
        if m:
            fields["issue_date"] = datetime(int(m.group(3)), MONTHS.index(m.group(2).lower()) + 1, int(m.group(1)))
            fields["date_box"] = boxes[texts.index(t)]
            break

    for t in texts:
        m = _REG_RE.search(t)
        if m:
            fields["regno"].append(m.group(1))

    return fields


class SemanticAnalyzer(Analyzer):
    name = "semantic_analyzer"
    category = "semantic"

    def analyze(self, doc: Document) -> list[Finding]:
        findings: list[Finding] = []
        if not _certificate_like(doc):
            return findings
        f = _extract_fields(doc)

        if f["cgpa"] is not None and f["cgpa_scale"]:
            if f["cgpa"] < 0 or f["cgpa"] > f["cgpa_scale"]:
                if f["cgpa"] > f["cgpa_scale"] * 1.2:
                    sev, score = "high", 0.85
                else:
                    sev, score = "medium", 0.6
                findings.append(
                    Finding(
                        id=_next_id("sem"),
                        category=self.category,
                        module=self.name,
                        severity=sev,
                        score=score,
                        confidence=0.75,
                        region=_region(f["cgpa_box"]),
                        evidence=[f"CGPA {f['cgpa']} exceeds the stated scale {f['cgpa_scale']}"],
                        explanation=(
                            "The reported score falls outside the scale the document itself declares. "
                            "An out-of-scale score is inconsistent and a strong numerical red flag."
                        ),
                        fields={"cgpa": f["cgpa"], "scale": f["cgpa_scale"]},
                    )
                )

        if f["year_start"] is not None and f["year_end"] is not None:
            dur = f["year_end"] - f["year_start"]
            if dur < 1:
                findings.append(
                    Finding(
                        id=_next_id("sem"),
                        category=self.category,
                        module=self.name,
                        severity="high",
                        score=0.8,
                        confidence=0.75,
                        evidence=[f"Program duration parsed as {dur} years ({f['year_start']} to {f['year_end']})"],
                        explanation="The effective year range spans less than one year, which is implausible for a degree program.",
                        fields={"start": f["year_start"], "end": f["year_end"]},
                    )
                )
            elif dur > 6:
                findings.append(
                    Finding(
                        id=_next_id("sem"),
                        category=self.category,
                        module=self.name,
                        severity="low",
                        score=0.3,
                        confidence=0.55,
                        evidence=[f"Program duration parsed as {dur} years ({f['year_start']} to {f['year_end']})"],
                        explanation=(
                            f"The stated duration is unusually long ({dur} years). Possible but worth verifying; not a red flag on its own."
                        ),
                        fields={"start": f["year_start"], "end": f["year_end"]},
                    )
                )

        if f["issue_date"] is not None and f["year_end"] is not None:
            issue_year = f["issue_date"].year
            if issue_year < f["year_end"] - 1:
                findings.append(
                    Finding(
                        id=_next_id("sem"),
                        category=self.category,
                        module=self.name,
                        severity="medium",
                        score=0.55,
                        confidence=0.65,
                        region=_region(f["date_box"]),
                        evidence=[
                            f"Issue date {f['issue_date'].date()} vs program end year {f['year_end']}",
                            f"Certificate issued {f['year_end'] - issue_year} year(s) before the stated completion",
                        ],
                        explanation=(
                            "The certificate issue date is significantly earlier than the programme's completion year, "
                            "an inconsistent date relationship."
                        ),
                        fields={"issue_year": issue_year, "program_end": f["year_end"]},
                    )
                )

        if len(f["names"]) > 1 and len(set(f["names"])) > 1:
            findings.append(
                Finding(
                    id=_next_id("sem"),
                    category=self.category,
                    module=self.name,
                    severity="low",
                    score=0.3,
                    confidence=0.6,
                    evidence=[f"Distinct full-name candidates found: {f['names']}"],
                    explanation=(
                        "Multiple distinct personal-name strings appear where a single consistent name would be expected. "
                        "Conflicting identity fields are a common manipulation target."
                    ),
                    fields={"names": f["names"]},
                )
            )

        if not (f["cgpa"] or f["year_start"] or f["issue_date"] or f["names"] or f["regno"]):
            findings.append(
                Finding(
                    id=_next_id("sem"),
                    category=self.category,
                    module=self.name,
                    severity="low",
                    score=0.1,
                    confidence=0.4,
                    evidence=["No recognizable certificate fields (name, dates, scores, IDs) could be extracted"],
                    explanation=(
                        "The extraction could not reliably identify typical structured fields in this document, so semantic "
                        "checks have limited coverage."
                    ),
                    fields={"coverage": "none"},
                )
            )
        return findings