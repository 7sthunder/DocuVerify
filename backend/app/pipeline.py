from pathlib import Path

from .aggregator import aggregate
from .analyzers import run_analyzers
from .document import Document
from .extractor import extract
from .ingestion import ingest
from .llm import llm_analyze


def analyze_file(path: Path, job_dir: Path, run_ocr: bool = True) -> dict:
    data = path.read_bytes()
    doc = ingest(data, path.name, job_dir)
    doc = extract(doc, run_ocr=run_ocr)
    findings = run_analyzers(doc)
    assessment = aggregate(doc, findings)

    llm_findings, llm_summary, llm_error = llm_analyze(doc, findings)
    all_findings = findings + llm_findings
    if llm_findings:
        assessment = aggregate(doc, all_findings)

    return {
        "assessment": assessment.model_dump(),
        "findings": [f.model_dump() for f in all_findings],
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