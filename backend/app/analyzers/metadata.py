import re

from ..config import METADATA_SCORE_CAP
from ..document import Document
from ..schemas import Finding
from .base import Analyzer, _next_id

SUSPICIOUS_THIRD_PARTY = [
    "photoshop",
    "adobe indesign",
    "coreldraw",
    "mspublisher",
    "microsoft publisher",
    "pdf password",
    "pdfedit",
    "foxit",
]

OFFICIAL_HINTS = ["bank", "university", "institution", "college", "board", "government", "writely", "payroll"]


def _parse_pdf_date(s: str) -> tuple | None:
    if not s:
        return None
    m = re.search(r"(\d{4})(\d{2})(\d{2})", s)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return (y, mo, d)


def _fmt(t: tuple) -> str:
    return f"{t[0]:04d}-{t[1]:02d}-{t[2]:02d}"


class MetadataAnalyzer(Analyzer):
    name = "metadata_analyzer"
    category = "metadata"

    def analyze(self, doc: Document) -> list[Finding]:
        findings: list[Finding] = []
        md = doc.metadata or {}
        producer = (md.get("producer") or "").lower()
        creator = (md.get("creator") or "").lower()
        claimed = " ".join([md.get(k, "") or "" for k in ("title", "author")]).lower()
        official = any(h in claimed for h in OFFICIAL_HINTS)

        third = next((t for t in SUSPICIOUS_THIRD_PARTY if t in producer), None)
        if third and official:
            findings.append(
                Finding(
                    id=_next_id("met"),
                    category=self.category,
                    module=self.name,
                    severity="medium",
                    score=METADATA_SCORE_CAP,
                    confidence=0.7,
                    evidence=[
                        f"Producer metadata: '{md.get('producer')}'",
                        f"Document title/author suggests an official origin: '{md.get('title')}', '{md.get('author')}'",
                    ],
                    explanation=(
                        "The document is framed as an official record yet carries production metadata from third-party "
                        "editing software. This is an indicator, not proof — metadata can be legitimate, stripped, or "
                        "spoofed, and never decides the verdict on its own."
                    ),
                    fields={"producer": md.get("producer"), "software": third},
                )
            )

        creation = _parse_pdf_date(md.get("creationDate"))
        mod = _parse_pdf_date(md.get("modDate"))
        if creation and mod:
            if mod < creation:
                findings.append(
                    Finding(
                        id=_next_id("met"),
                        category=self.category,
                        module=self.name,
                        severity="low",
                        score=0.25,
                        confidence=0.7,
                        evidence=[
                            f"CreationDate {_fmt(creation)} vs ModDate {_fmt(mod)}",
                            "ModDate precedes CreationDate",
                        ],
                        explanation=(
                            "The modification timestamp predates the creation timestamp, an odd ordering that can occur "
                            "when a document was re-saved or metadata rewritten."
                        ),
                        fields={"creationDate": _fmt(creation), "modDate": _fmt(mod)},
                    )
                )
            elif mod[0] - creation[0] >= 1:
                findings.append(
                    Finding(
                        id=_next_id("met"),
                        category=self.category,
                        module=self.name,
                        severity="low",
                        score=0.2,
                        confidence=0.6,
                        evidence=[f"CreationDate {_fmt(creation)}, ModDate {_fmt(mod)} (gap {mod[0] - creation[0]}y)"],
                        explanation=(
                            "The document was modified long after it was created, consistent with a later re-save or edit. "
                            "Not decisive on its own."
                        ),
                        fields={"creationDate": _fmt(creation), "modDate": _fmt(mod)},
                    )
                )

        if not md:
            findings.append(
                Finding(
                    id=_next_id("met"),
                    category=self.category,
                    module=self.name,
                    severity="low",
                    score=0.1,
                    confidence=0.5,
                    evidence=["No PDF metadata (creator/producer/timestamps) present"],
                    explanation=(
                        "Metadata is entirely absent. That is neutral — legitimate documents often ship without metadata, "
                        "and it can also be deliberately stripped."
                    ),
                    fields={"available": False},
                )
            )
        return findings