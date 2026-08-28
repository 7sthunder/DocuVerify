from .config import (
    CATEGORY_LABELS,
    HIGH_THRESHOLD,
    LOW_THRESHOLD,
    LLM_SCORE_CAP,
    METADATA_SCORE_CAP,
    WEIGHTS,
)
from .schemas import Assessment, CategoryStatus, Finding


def _label(score: float) -> str:
    for lbl, thr in CATEGORY_LABELS:
        if score < thr:
            return lbl
    return "anomaly"


_SEVERITY_WEIGHT = {"low": 0.45, "medium": 0.7, "high": 1.0}
_CATEGORY_CAP = {"low": 0.35, "medium": 0.6, "high": 1.0}


def _severity_weight(f: Finding) -> float:
    return _SEVERITY_WEIGHT[f.severity]


def _top_severity(findings: list[Finding]) -> str:
    if any(f.severity == "high" for f in findings):
        return "high"
    if any(f.severity == "medium" for f in findings):
        return "medium"
    return "low"


def category_score(findings: list[Finding]) -> float:
    if not findings:
        return 0.0
    top = max(_severity_weight(f) * f.score for f in findings)
    boost = 1 + 0.12 * (len(findings) - 1)
    # Cap each category by its strongest signal's severity tier so a pile of
    # low/medium findings cannot inflate a category beyond its evidence ceiling.
    return min(_CATEGORY_CAP[_top_severity(findings)], top * boost)


def _bucket(f: Finding) -> str:
    return "semantic_llm" if f.module == "semantic_llm" else f.category


def aggregate(doc, findings: list[Finding], weights: dict | None = None) -> Assessment:
    from .llm import is_enabled

    WEIGHTS_ACTIVE = weights or WEIGHTS
    by_cat: dict[str, list[Finding]] = {}
    for f in findings:
        by_cat.setdefault(_bucket(f), []).append(f)

    unavailable = set()
    if getattr(doc, "pdf_text_present", False) is False:
        unavailable.add("typography")
    if not (getattr(doc, "pdf_text_present", False) and any(p.ocr_boxes for p in doc.pages)):
        unavailable.add("text_layer")
    if not is_enabled():
        unavailable.add("semantic_llm")

    statuses: list[CategoryStatus] = []
    active: list[str] = []
    for cat in WEIGHTS_ACTIVE:
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
        elif cat == "semantic_llm":
            score = min(score, LLM_SCORE_CAP)
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

    total_w = sum(WEIGHTS_ACTIVE[c] for c in active)
    suspicion = 0.0
    for s in statuses:
        if s.available:
            suspicion += (WEIGHTS_ACTIVE[s.category] / total_w) * s.score

    risk = "LOW" if suspicion < LOW_THRESHOLD else ("HIGH" if suspicion >= HIGH_THRESHOLD else "MEDIUM")
    return Assessment(suspicion_score=round(suspicion * 100, 1), risk_level=risk, categories=statuses)