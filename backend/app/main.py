import asyncio
import json
import re
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .ingestion import ValidationError, validate_bytes
from .pipeline import analyze_file

ROOT = Path(__file__).resolve().parent
JOBS_DIR = ROOT / "jobs"
JOBS_DIR.mkdir(exist_ok=True)

FRONTEND_DIST = ROOT.parent.parent / "frontend" / "dist"
JOB_TTL_SECONDS = 2 * 3600
CLEANUP_INTERVAL = 30 * 60

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
        report = await asyncio.to_thread(
            analyze_file, job_dir / job["original_name"], job_dir, True
        )
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


async def _cleanup_loop():
    while True:
        await asyncio.sleep(CLEANUP_INTERVAL)
        now = time.time()
        for job_id, job in list(_jobs.items()):
            if job.get("status") in ("complete", "failed") and now - job.get("created", now) > JOB_TTL_SECONDS:
                shutil.rmtree(job["job_dir"], ignore_errors=True)
                _jobs.pop(job_id, None)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()


app = FastAPI(title="DocuVerify", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
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