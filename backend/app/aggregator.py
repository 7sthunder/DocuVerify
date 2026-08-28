from .config import (
    CATEGORY_LABELS,
    HIGH_THRESHOLD,
    LOW_THRESHOLD,
    METADATA_SCORE_CAP,
    WEIGHTS,
)
from .schemas import Assessment, CategoryStatus, Finding


def _label(score: float) -> str:
    for lbl, thr in CATEGORY_LABELS:
        if score < thr:
            return lbl
    return "anomaly"


def _severity_weight(f: Finding) -> float:
    return {"low": 0.45, "medium": 0.7, "high": 1.0}[f.severity]


def category_score(findings: list[Finding]) -> float:
    if not findings:
        return 0.0
    top = max(_severity_weight(f) * f.score for f in findings)
    boost = 1 + 0.12 * (len(findings) - 1)
    return min(1.0, top * boost)


def aggregate(doc, findings: list[Finding]) -> Assessment:
    from .llm import is_enabled

    by_cat: dict[str, list[Finding]] = {}
    for f in findings:
        by_cat.setdefault(f.category, []).append(f)

    unavailable = set()
    if getattr(doc, "pdf_text_present", False) is False:
        unavailable.add("typography")
    if not (getattr(doc, "pdf_text_present", False) and any(p.ocr_boxes for p in doc.pages)):
        unavailable.add("text_layer")
    if not is_enabled():
        unavailable.add("semantic_llm")

    statuses: list[CategoryStatus] = []
    active: list[str] = []
    for cat in WEIGHTS:
        fs = by_cat.get(cat, [])
        if cat in unavailable or (cat == "metadata" and not fs):
            statuses.append(
                CategoryStatus(category=cat, label="unavailable", available=False, score=0.0, findings_count=0)
            )
            continue
        active.append(cat)
        score = category_score(fs)
        if cat == "metadata":
            score = min(score, METADATA_SCORE_CAP)
            severity = fs[0].severity if fs else None
        else:
            severity = "high" if any(f.severity == "high" for f in fs) else (
                "medium" if any(f.severity == "medium" for f in fs) else ("low" if fs else None)
            )
        statuses.append(
            CategoryStatus(
                category=cat,
                label=_label(score),
                available=True,
                max_severity=severity,
                score=round(score, 3),
                findings_count=len(fs),
            )
        )

    total_w = sum(WEIGHTS[c] for c in active)
    suspicion = 0.0
    for s in statuses:
        if s.available:
            suspicion += (WEIGHTS[s.category] / total_w) * s.score

    risk = "LOW" if suspicion < LOW_THRESHOLD else ("HIGH" if suspicion >= HIGH_THRESHOLD else "MEDIUM")
    return Assessment(suspicion_score=round(suspicion * 100, 1), risk_level=risk, categories=statuses)