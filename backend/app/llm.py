import json
import re

import httpx

from .analyzers.semantic import _extract_fields
from .config import LLM_API_KEY, LLM_BASE_URL, LLM_ENABLED, LLM_MODEL
from .document import Document
from .schemas import Finding, Region

SEV_SCORE = {"high": 0.85, "medium": 0.6, "low": 0.35}
TIMEOUT = 60.0


def is_enabled() -> bool:
    return LLM_ENABLED and bool(LLM_API_KEY)


def _field_summary(doc: Document) -> str:
    f = _extract_fields(doc)
    lines = []
    if f["names"]:
        lines.append("Names: " + ", ".join(f["names"]))
    if f["year_start"] is not None:
        lines.append(f"Program year range: {f['year_start']} - {f['year_end']}")
    if f["issue_date"] is not None:
        lines.append(f"Issue date: {f['issue_date'].date()}")
    if f["cgpa"] is not None:
        lines.append(f"CGPA: {f['cgpa']} (stated scale {f['cgpa_scale']})")
    if f["regno"]:
        lines.append("Registration numbers: " + ", ".join(f["regno"]))
    for page in doc.pages:
        for b in (page.textboxes if page.textboxes else page.ocr_boxes):
            t = b.text.strip()
            if re.search(r"(universit|institute|college|techn|degree|bachelor|institution)", t, re.I) and len(t) <= 120:
                lines.append(f"Context: {t}")
    return "\n".join(lines)


def _deterministic_summary(findings: list[Finding]) -> str:
    if not findings:
        return "No deterministic anomalies."
    lines = []
    for f in findings[:20]:
        lines.append(f"- [{f.category}/{f.severity}] {f.explanation}")
    return "\n".join(lines)


def _tokens(value: str) -> list[str]:
    toks = [t for t in re.split(r"[\s,:/\\-]+", value) if len(t) >= 3]
    return toks


def _region_for(doc: Document, values: list[str]) -> Region | None:
    if not values:
        return None
    cands: list[str] = []
    for v in values:
        cands.append(v)
        cands.extend(_tokens(v))
    for page in doc.pages:
        for b in (page.textboxes if page.textboxes else page.ocr_boxes):
            text = b.text.lower()
            for v in cands:
                if v and len(v) >= 3 and v.lower() in text:
                    return Region(page=b.page, x=b.x, y=b.y, w=b.w, h=b.h)
    return None


def _parse_payload(content: str) -> dict | None:
    m = re.search(r"\{.*\}", content, re.S)
    if not m:
        return None
    try:
        obj = json.loads(m.group(0))
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    return None


def llm_analyze(doc: Document, findings: list[Finding]) -> tuple[list[Finding], str | None, str | None]:
    if not is_enabled():
        return [], None, None
    fields = _field_summary(doc)
    if not fields:
        return [], None, "No structured fields to reason over"
    system = (
        "You are a forensic document-semantics analyst. Given extracted fields and deterministic findings from a "
        "document, identify any logical inconsistencies: impossible or conflicting values, contradictory date or "
        "number relationships, repeated fields that disagree, or implausible combinations. "
        "Respond with STRICT JSON only, in this exact shape: "
        '{"inconsistencies":[{"severity":"low|medium|high","reason":"...","confidence":0.0..1.0,'
        '"fields":["FieldValueA","FieldValueB"]}],"summary":"2-4 sentences: overall semantic assessment, naming the '
        'main contradictions and stating they are indicators, not proof of forgery."}. '
        "Do not invent fields not present. Do not call anything a forgery outright."
    )
    user = (
        "EXTRACTED FIELDS/CONTEXT:\n"
        f"{fields}\n\n"
        "DETERMINISTIC FINDINGS:\n"
        f"{_deterministic_summary(findings)}\n\n"
        "Return the JSON object."
    )

    payload = {
        "model": LLM_MODEL,
        "temperature": 0.2,
        "max_tokens": 1200,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    headers = {
        "Authorization": f"Bearer {LLM_API_KEY}",
        "X-Title": "DocuVerify",
    }
    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.post(f"{LLM_BASE_URL}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
    except Exception as exc:
        return [], None, f"LLM call failed: {exc}"

    obj = _parse_payload(content)
    if not obj:
        return [], None, "LLM returned an unparseable response"
    summary = obj.get("summary")
    out: list[Finding] = []
    for item in obj.get("inconsistencies", [])[:10]:
        sev = item.get("severity", "low") if item.get("severity") in ("low", "medium", "high") else "low"
        conf = min(1.0, max(0.0, float(item.get("confidence", 0.6))))
        score = SEV_SCORE[sev] * (0.7 + 0.3 * conf)
        fields_list = [str(x) for x in item.get("fields", [])]
        out.append(
            Finding(
                id=f"semllm-{len(out):03d}",
                category="semantic",
                module="semantic_llm",
                severity=sev,
                score=round(min(1.0, score), 3),
                confidence=round(conf, 2),
                region=_region_for(doc, fields_list),
                evidence=[f"LLM identified contradiction between: {', '.join(fields_list) or 'n/a'}"] + ([f"Reason: {item.get('reason','')}"] if item.get("reason") else []),
                explanation=str(item.get("reason", "Semantic inconsistency between fields.")),
                fields={"llm_fields": fields_list},
            )
        )
    return out, summary, None