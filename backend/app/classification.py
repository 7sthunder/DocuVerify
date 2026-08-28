"""Document classification.

Hybrid approach: cheap deterministic keyword scoring over the taxonomy first;
optional LLM classification only when the deterministic result is ambiguous.
An uncertain classification degrades to UNKNOWN with low confidence — the
pipeline continues with universal verification regardless.
"""
import json
import re
from dataclasses import dataclass, field

from . import taxonomy
from .config import CLASSIFY_AMBIGUOUS_BELOW
from .document import Document
from .entities import full_text

_MIN_KEYWORD_HITS = 1
_KNOWN_FLOOR = 2.0


@dataclass
class Candidate:
    type_id: str
    label: str
    confidence: float
    score: float


@dataclass
class Classification:
    type_id: str = taxonomy.UNKNOWN
    label: str = "Unknown"
    family: str = "unclassified"
    confidence: float = 0.0
    method: str = "deterministic"
    candidates: list[Candidate] = field(default_factory=list)

    @property
    def is_known(self) -> bool:
        return self.type_id != taxonomy.UNKNOWN

    def to_report(self) -> dict:
        return {
            "type": self.type_id,
            "label": self.label,
            "family": self.family,
            "confidence": round(self.confidence, 3),
            "method": self.method,
            "candidates": [
                {"type": c.type_id, "label": c.label, "confidence": round(c.confidence, 3)}
                for c in self.candidates[:3]
            ],
        }


def _score_type(text: str, dt: taxonomy.DocumentType) -> float:
    score = 0.0
    for kw, weight in dt.keywords:
        if kw in text:
            score += weight
    return score


def classify_deterministic(doc: Document) -> Classification:
    text = full_text(doc).lower()
    scored: list[tuple[float, taxonomy.DocumentType]] = []
    for dt in taxonomy.DOC_TYPES.values():
        s = _score_type(text, dt)
        if s >= _MIN_KEYWORD_HITS:
            scored.append((s, dt))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    if not scored or scored[0][0] < _KNOWN_FLOOR:
        return Classification(method="deterministic", confidence=0.0)

    best_score, best = scored[0]
    second_score = scored[1][0] if len(scored) > 1 else 0.0
    margin = best_score / max(second_score, 1.0)
    confidence = min(0.95, best_score / (best_score + 2.0))
    if margin < 1.6:
        confidence = min(confidence, 0.55)

    candidates = [
        Candidate(
            type_id=dt.id,
            label=dt.label,
            score=s,
            confidence=min(0.95, s / (s + 2.0)),
        )
        for s, dt in scored[:3]
    ]
    return Classification(
        type_id=best.id,
        label=best.label,
        family=best.family,
        confidence=confidence,
        method="deterministic",
        candidates=candidates,
    )


def is_ambiguous(cls: Classification) -> bool:
    if not cls.is_known:
        return True
    return cls.confidence < CLASSIFY_AMBIGUOUS_BELOW


def classify(doc: Document, llm_classifier=None) -> Classification:
    cls = classify_deterministic(doc)
    if not is_ambiguous(cls) or llm_classifier is None:
        return cls
    try:
        result = llm_classifier(doc)
    except Exception:
        return cls
    if not result:
        return cls
    llm_type, llm_conf = result
    dt = taxonomy.DOC_TYPES.get(llm_type)
    if not dt or llm_conf < 0.5:
        return cls
    if cls.is_known and cls.type_id == dt.id:
        merged_conf = min(0.97, max(cls.confidence, llm_conf))
        cls.confidence = merged_conf
        cls.method = "hybrid"
        return cls
    if not cls.is_known or llm_conf > cls.confidence + 0.15:
        return Classification(
            type_id=dt.id,
            label=dt.label,
            family=dt.family,
            confidence=min(0.9, llm_conf),
            method="hybrid",
            candidates=cls.candidates,
        )
    return cls
