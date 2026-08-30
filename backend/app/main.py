import asyncio
import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from .extractor import extract
from .ingestion import ValidationError, ingest, validate_bytes
from .pipeline import analyze_file, build_report
from .reference import compare_docs, compare_weights

ROOT = Path(__file__).resolve().parent
JOBS_DIR = ROOT / "jobs"
JOBS_DIR.mkdir(exist_ok=True)

FRONTEND_DIST = ROOT.parent.parent / "frontend" / "dist"
JOB_TTL_SECONDS = 2 * 3600
CLEANUP_INTERVAL = 30 * 60

AUTH_PROXY_URL = os.getenv("AUTH_PROXY_URL", "http://127.0.0.1:4000")

_jobs: dict[str, dict] = {}


def _new_job_dir() -> tuple[str, Path]:
    job_id = uuid.uuid4().hex[:12]
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=False)
    return job_id, job_dir


async def _run_job(job_id: str, job: dict):
    job_dir = Path(job["job_dir"])
    job["status"] = "processing"
    try:
        if job["mode"] != "compare":
            report = await asyncio.to_thread(
                analyze_file, job_dir / job["original_name"], job_dir, True
            )
        else:
            report = await asyncio.to_thread(_run_compare, job_dir, job)
        (job_dir / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        job["report"] = report
        job["status"] = "complete"
        job["finished"] = time.time()
    except ValidationError as exc:
        job["status"] = "failed"
        job["error"] = str(exc)
    except Exception as exc:
        job["status"] = "failed"
        job["error"] = f"Analysis failed: {exc}"
        job["finished"] = time.time()


def _run_compare(job_dir: Path, job: dict) -> dict:
    import shutil

    from .aggregator import aggregate
    from .config import WEIGHTS
    from .pipeline import _to_report, analyze_document
    from .reference import compare_docs, compare_weights

    doc = extract(ingest((job_dir / job["original_name"]).read_bytes(), job["original_name"], job_dir / "_d"), run_ocr=True)
    tpl = extract(ingest((job_dir / job["template_file"]).read_bytes(), job["template_file"], job_dir / "_t"), run_ocr=True)
    refs = compare_docs(tpl, doc)

    _, findings, _assessment, lf, ls, le = analyze_document(doc)
    combined = findings + refs
    assessment = aggregate(doc, combined, weights=compare_weights(dict(WEIGHTS)))

    src = job_dir / "_d" / "pages"
    if src.exists():
        shutil.copytree(src, job_dir / "pages", dirs_exist_ok=True)

    return _to_report(
        doc,
        combined,
        assessment,
        lf,
        ls,
        le,
        {"reference": {"enabled": True, "template": job.get("template_name"), "finding_count": len(refs)}},
    )


async def _cleanup_loop():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL)
        now = time.time()
        for job_id, job in list(_jobs.items()):
            if job.get("status") in ("complete", "failed") and now - job.get("created", now) > JOB_TTL_SECONDS:
                shutil.rmtree(job["job_dir"], ignore_errors=True)
                _jobs.pop(job_id, None)


AUTH_DIR = ROOT.parent.parent / "auth"

def _auth_port_ready(port: int = 4000, timeout: float = 1.0) -> bool:
    import socket
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def _start_auth_service() -> subprocess.Popen | None:
    if not AUTH_DIR.exists():
        return None
    tsx = AUTH_DIR / "node_modules" / ".bin" / "tsx.cmd" if os.name == "nt" else AUTH_DIR / "node_modules" / ".bin" / "tsx"
    if not tsx.exists():
        print("[auth] tsx not found; run `npm install` in /auth first", flush=True)
        return None
    env = dict(os.environ)
    env.setdefault("AUTH_PORT", "4000")
    proc = subprocess.Popen(
        [str(tsx), "server/index.ts"],
        cwd=str(AUTH_DIR),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    for _ in range(100):
        if proc.poll() is not None:
            print("[auth] subprocess exited early", flush=True)
            return None
        if _auth_port_ready():
            print("[auth] bundled auth service is ready on :4000", flush=True)
            return proc
        time.sleep(0.3)
    print("[auth] gave up waiting for auth service", flush=True)
    return proc


def _stop_auth_service(proc: subprocess.Popen | None):
    if proc is None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


@asynccontextmanager
async def lifespan(app: FastAPI):
    auth_proc = _start_auth_service()
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()
    _stop_auth_service(auth_proc)


app = FastAPI(title="DocuVerify", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    data = await file.read()
    try:
        ext = validate_bytes(data, file.filename or "upload.pdf")
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    job_id, job_dir = _new_job_dir()
    original_name = f"original{ext}"
    (job_dir / original_name).write_bytes(data)
    (job_dir / "pages").mkdir(exist_ok=True)

    job = {
        "id": job_id,
        "status": "queued",
        "mode": "single",
        "filename": file.filename,
        "original_name": original_name,
        "job_dir": str(job_dir),
        "created": time.time(),
        "finished": None,
        "error": None,
        "report": None,
    }
    _jobs[job_id] = job
    asyncio.create_task(_run_job(job_id, job))
    return {"job_id": job_id}


@app.post("/api/compare")
async def upload_compare(document: UploadFile = File(...), template: UploadFile = File(...)):
    d_data = await document.read()
    t_data = await template.read()
    try:
        d_ext = validate_bytes(d_data, document.filename or "upload.pdf")
        t_ext = validate_bytes(t_data, template.filename or "template.pdf")
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    job_id, job_dir = _new_job_dir()
    original_name = f"original{d_ext}"
    template_name = f"template{t_ext}"
    (job_dir / original_name).write_bytes(d_data)
    (job_dir / template_name).write_bytes(t_data)
    (job_dir / "pages").mkdir(exist_ok=True)

    job = {
        "id": job_id,
        "status": "queued",
        "mode": "compare",
        "filename": document.filename,
        "template_name": template.filename,
        "template_file": template_name,
        "original_name": original_name,
        "job_dir": str(job_dir),
        "created": time.time(),
        "finished": None,
        "error": None,
        "report": None,
    }
    _jobs[job_id] = job
    asyncio.create_task(_run_job(job_id, job))
    return {"job_id": job_id}


@app.get("/api/jobs")
def list_jobs():
    jobs = []
    for job in _jobs.values():
        if job.get("status") != "complete" or not job.get("report"):
            continue
        report = job["report"]
        assessment = report.get("assessment", {})
        jobs.append(
            {
                "id": job["id"],
                "filename": job["filename"],
                "created": job["created"],
                "status": "completed",
                "score": round(assessment.get("suspicion_score", 0), 1),
                "risk_level": assessment.get("risk_level", "LOW"),
            }
        )
    jobs.sort(key=lambda j: j["created"], reverse=True)
    return jobs


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job["id"],
        "status": job["status"],
        "filename": job["filename"],
        "error": job["error"],
        "report": job["report"],
    }


@app.get("/api/jobs/{job_id}/pages/{page_name}")
def get_page(job_id: str, page_name: str):
    if not re.fullmatch(r"page_\d+\.png", page_name):
        raise HTTPException(status_code=400, detail="Invalid page name")
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    path = Path(job["job_dir"]) / "pages" / page_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Page not found")
    return FileResponse(path, media_type="image/png")


_PROXY_SKIP_HEADERS = {"host", "content-length", "connection"}


@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy_auth(path: str, request: Request):
    url = f"{AUTH_PROXY_URL}/api/auth/{path}"
    headers = {
        k: v for k, v in request.headers.items() if k.lower() not in _PROXY_SKIP_HEADERS
    }
    headers["x-forwarded-host"] = request.headers.get("host", "localhost:8000")
    body = await request.body()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.request(
                request.method, url, headers=headers, content=body
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Auth service unreachable: {exc}")
    response = Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type"),
    )
    for name, value in resp.headers.items():
        if name.lower() in ("set-cookie",):
            response.raw_headers.append((name.lower().encode(), value.encode()))
    return response


if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
else:
    @app.get("/")
    def index():
        return JSONResponse(
            {
                "message": "DocuVerify API is running. Build the frontend (npm run build in /frontend) to serve it here, or use the Vite dev server at http://localhost:5173.",
                "docs": "/docs",
            }
        )