from .aggregator import aggregate
from .capabilities import default_registry
from .classification import classify
from .document import Document
from .extractor import extract
from .ingestion import ingest
from .llm import classify_document_llm, is_enabled, llm_analyze


def _to_report(doc, findings, assessment, llm_findings, llm_summary, llm_error, extra=None):
    data = {
        "assessment": assessment.model_dump(),
        "findings": [f.model_dump() for f in findings],
        "pages": [
            {
                "index": p.index,
                "width": p.width,
                "height": p.height,
                "image": f"pages/page_{p.index}.png",
            }
            for p in doc.pages
        ],
        "reliability": {
            "text_layer_available": doc.pdf_text_present,
            "ocr_mean_conf": doc.ocr_mean_conf,
            "ocr_computed": bool(any(p.ocr_boxes for p in doc.pages)),
        },
        "llm": {
            "enabled": bool(llm_findings or llm_summary or (llm_error is not None)),
            "summary": llm_summary,
            "error": llm_error,
            "finding_count": len(llm_findings),
        },
    }
    if extra:
        data.update(extra)
    return data


def _run_stage(capabilities, doc, registry):
    findings, runs = registry.run(capabilities, doc)
    warnings = [r.error for r in runs if r.error]
    return findings, runs, warnings


def _stage_process(doc: Document):
    """Full engine pipeline: classify -> select capabilities -> run ->
    aggregate -> LLM reasoning -> report. Classification uncertainty never
    aborts the run; unknown documents still receive universal analysis."""
    from .analyzers.semantic import _certificate_like

    registry = default_registry()

    llm_classifier = classify_document_llm if is_enabled() else None
    cls = classify(doc, llm_classifier)
    cert_text_hint = not cls.is_known and _certificate_like(doc)

    selected = registry.select(doc, cls.type_id, text_hint=cert_text_hint)
    findings, runs, warnings = _run_stage(selected, doc, registry)

    assessment = aggregate(doc, findings)
    llm_findings, llm_summary, llm_error = llm_analyze(doc, findings, doc_type=cls.type_id if cls.is_known else None)
    if llm_findings:
        findings = findings + llm_findings
        assessment = aggregate(doc, findings)

    return _to_report(
        doc,
        findings,
        assessment,
        llm_findings,
        llm_summary,
        llm_error,
        extra={
            "document": cls.to_report(),
            "processing": {
                "capabilities": [r.to_report() for r in runs],
                "warnings": warnings,
                "classification_method": cls.method,
                "domain_analysis": cls.type_id if cls.is_known else None,
            },
        },
    )


def build_report(doc: Document, extra=None) -> dict:
    """Single-document verification through the generalized engine."""
    report = _stage_process(doc)
    if extra:
        report.update(extra)
    return report


def analyze_document(doc: Document, weights=None) -> tuple:
    """Backward-compatible analysis path (used by the compare/template mode)."""
    from .analyzers import run_analyzers

    findings = run_analyzers(doc)
    assessment = aggregate(doc, findings, weights=weights)
    llm_findings, llm_summary, llm_error = llm_analyze(doc, findings)
    if llm_findings:
        findings = findings + llm_findings
        assessment = aggregate(doc, findings, weights=weights)
    return doc, findings, assessment, llm_findings, llm_summary, llm_error


def analyze_file(path, job_dir, run_ocr: bool = True) -> dict:
    data = path.read_bytes()
    doc = ingest(data, path.name, job_dir)
    doc = extract(doc, run_ocr=run_ocr)
    return build_report(doc)
