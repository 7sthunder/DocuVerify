# DocuVerify

Intelligent Document Authenticity & Forgery Detection — an evidence-based document-forensics platform.

Multi-signal pipeline: OCR/native text extraction → layout, typography, visual, metadata, semantic and text-layer analyzers → anomaly aggregation → explainable assessment with suspicious-region highlights.

## Setup

Backend (Python 3.13):

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Frontend (Node 22):

```
cd frontend
npm install
```

> Note: this environment reaches pypi.org slowly — the venv pip config already points at the Aliyun mirror.

## Run

Terminal 1 — backend (serves the built frontend too):

```
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

Terminal 2 — frontend dev server (hot reload + `/api` proxy):

```
cd frontend
npm run dev
```

Then open `http://localhost:5173`. For a production-like single server, use `npm run build` in `frontend` then just the backend on `http://localhost:8000`.

## Test / dataset

Synthetic certificate corpus (no real personal data) in `backend/sample_data/`:

- `genuine_cert.pdf` — unmodified
- `forged_*.pdf` — each with one known edit (name, CGPA, date, font, layout shift, metadata, pasted logo)
- `forged_demo.pdf` — combined edits for the before/after demo

Regenerate/extend with `backend/spike/forge_cert.py`. Run validation:

```
cd backend
.venv\Scripts\python.exe -m pytest tests -q
```

Reference results (computed from actual runs, `spike/evaluate.py`):

| document       | risk  | score |
|----------------|-------|-------|
| genuine        | LOW   | 0.0   |
| forged_demo    | MEDIUM| ~40   |

## API

- `POST /api/documents` — multipart upload (PDF/JPG/PNG, ≤25 MB, magic-byte validated)
- `GET /api/jobs/{id}` — status + full forensic report
- `GET /api/jobs/{id}/pages/page_{n}.png` — normalized page render used for overlays

## Honesty notes

- Suspicion score is an evidence-based indicator, **not** a calibrated probability of forgery.
- Signals are heuristic; the report always includes the disclaimer: *forensic indicators are algorithmic signals, not legal proof of forgery.*

## Roadmap (Phase 5, optional)

- LLM reasoning + prose via OpenRouter (needs `OPENROUTER_API_KEY`) on top of extracted evidence
- Reference Template Mode — compare an uploaded doc against an official template