# DocuVerify

**Intelligent Document Authenticity & Forgery Detection** — an evidence-based document-forensics platform.

DocuVerify ingests a PDF or image, runs it through a multi-signal forensic engine, and returns an explainable assessment: a **0–100 suspicion score**, a **LOW / MEDIUM / HIGH risk verdict**, and **highlighted suspicious regions** drawn directly on the rendered page — every finding backed by concrete, human-verifiable evidence.

---

## 1. The problem it addresses (and resolves)

Forged documents — fake certificates, inflated W-2s / tax forms, edited transcripts, manipulated invoices — are cheap to produce and hard to catch:

- **Manual verification** is slow, subjective, and needs a trained eye.
- **"AI fake detectors"** return opaque yes/no verdicts with no evidence anyone can audit or defend.

DocuVerify resolves this by reframing the problem: **it does not guess whether a document is fake — it measures where the document deviates from its own internal consistency**, and shows the evidence for every measurement.

### Hackathon panel description

> **Problem:** Document forgery is trivially easy and verification is expert-driven, slow, and unauditable when delegated to black-box AI.
>
> **Target users:** universities and employers verifying certificates/transcripts, banks and lenders verifying income documents (W-2, payslips, bank statements), and any KYC / back-office verification team needing fast, defensible first-pass triage before human review.
>
> **What makes the approach unique:** the core engine is **100% deterministic and explainable** — layout geometry, font statistics, image sharpness forensics, metadata provenance, and arithmetic field checks — so every finding cites a verifiable measurement instead of an opaque model output. The optional LLM layer only re-reasons over fields the deterministic engine already extracted, is **capped at 10% of the score**, and is **off by default**; the full report works without it. *Signals, not verdicts.*

---

## 2. What has been built

### Forensic engine (backend, Python)

| Component | What it does |
|---|---|
| **Ingestion** (`ingestion.py`) | Magic-byte validation (PDF/JPG/PNG), 25 MB limit, ≤10 pages, password-PDF rejection, pixel-bomb guard; every page rendered to a normalized 1240 px canvas |
| **Dual text extraction** (`extractor.py`) | Two independent views of the text: the PDF's native text layer (PyMuPDF — fonts, sizes, coordinates, colors) **and** OCR of the rendered pixels (RapidOCR) |
| **Classification** (`classification.py`, `taxonomy.py`) | Data-driven document-type taxonomy (invoice, receipt, tax document, certificate, transcript, offer letter, ticket, bank statement, medical, contract, identity, resume). Cheap deterministic keyword scoring first; optional LLM classification **only when ambiguous**; unknown documents are a first-class outcome and still get full universal analysis |
| **Capability registry** (`capabilities.py`) | Universal capabilities (layout, typography, visual, metadata, semantic, text-layer, embedded-image) + domain verifiers selected by document type. Each capability runs in isolation — a failure becomes a warning record, never a crashed pipeline. Every run is timed and reported |
| **Universal analyzers** (`analyzers/`) | **Layout** — x-alignment vs the document's dominant column grid. **Typography** — isolated foreign fonts, abnormal size outliers. **Visual** — tile-based Laplacian sharpness to detect pasted-in patches; low-DPI upscaled embedded images via PyMuPDF bounding boxes. **Metadata** — producer/creator software checks, timestamp ordering. **Semantic** — regex field extraction + arithmetic rules (CGPA vs declared scale, degree shorter than a year, issue date before completion). **Text-layer** — native text vs OCR-of-pixels similarity (edited/desynchronized text layers) |
| **Domain verifiers** (`verifiers.py`) | **Invoice verifier** — subtotal + taxes == total arithmetic, tax-rate sanity, money parsing. **Certificate verifier** — structured education-field consistency. **Universal verifier** — generic cross-field checks for any document type |
| **Aggregation** (`aggregator.py`) | Weighted category scores → 0–100 suspicion score + LOW/MEDIUM/HIGH verdict; severity-tiered score caps (metadata ≤ 0.4, LLM ≤ 0.5) so no single module can decide the verdict |
| **Reference Template Mode** (`reference.py`) | Compare an upload against an official template: block-position shifts, font mismatches, missing/extra content blocks (15% of score in compare mode) |
| **Optional LLM layer** (`llm.py`) | Semantic-reasoning pass + natural-language executive summary via any OpenAI-compatible endpoint (OpenRouter default). Off by default, gracefully skipped on error/failure — deterministic analyzers always deliver the full report |
| **Async job API** (`main.py`) | FastAPI: upload → background analysis → poll status; per-job temp workspace; automatic cleanup loop (2 h TTL); page-image endpoint for overlays; production single-server mode serving the built frontend |

### Web app (frontend, React)

- **Verify page** — drag-and-drop upload, live job polling, assessment card (score, verdict, per-category chips), page render with **color-coded overlay boxes** on flagged regions, findings list with severity/module/evidence/explanation
- **Templates page** — Reference Template Mode: upload a document + official template, get a difference report
- **History & Reports pages** — past verifications, report browsing
- **Auth-gated** — Better Auth email/password login with shared session cookie

### Auth service (Node)

- **Better Auth + Hono + SQLite** (`auth/`) — schema migrations on boot, seeds a sample user automatically, session cookie shared with the frontend and proxied through both the Vite dev server and FastAPI

### Validation corpus & tests

- Synthetic corpora in `backend/sample_data/` (generated by scripts, never real personal data):
  - **Certificate corpus** — `genuine_cert.pdf` + forgeries with one known edit each (name, CGPA, date, font, layout shift, metadata, pasted logo)
  - **IRS W-2 corpus** — built from the official blank form, filled programmatically; forgeries include inflated wages in foreign fonts, a pasted low-res SSN sticker, and spoofed producer metadata
  - Invoice/ticket fixtures
- **pytest suites** (`backend/tests/`): pipeline, API, reference compare, capabilities, classification, verifiers, legit-doc regression corpus, LLM (mocked)
- **Measured results** (via `spike/evaluate.py` / `spike/eval_w2.py`):

| document | risk | score |
|---|---|---|
| genuine_cert | LOW | 0.0 |
| forged_demo (cert) | MEDIUM | ~40 |
| genuine_w2 | LOW | 1.0 |
| forged_demo_w2 | HIGH | ~77 |

---

## 3. How it works (pipeline)

```
Upload (PDF/JPG/PNG)
  │
  ├─► Ingestion ── validate type/size, reject encrypted, render pages @1240px
  │
  ├─► Extraction ── native text spans (font/size/coords)  +  OCR of rendered pixels
  │
  ├─► Classification ── deterministic keyword scoring over taxonomy
  │                      (LLM assist only when ambiguous) → type or UNKNOWN
  │
  ├─► Capability registry ── universal analyzers + type-selected domain verifiers
  │                          (isolated execution; failure ⇒ warning, not crash)
  │
  ├─► Aggregation ── weighted category scores → 0–100 suspicion + risk verdict
  │
  ├─► (optional) LLM reasoning ── semantic contradictions + executive summary
  │
  └─► Report ── findings (region + evidence + explanation), page renders,
                reliability, capability trace, disclaimer
```

---

## 4. Tech stack

- **Backend:** Python 3.13, FastAPI, PyMuPDF, OpenCV, NumPy, Pillow, RapidOCR (ONNX Runtime), Pydantic v2, pytest
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, react-router 7
- **Auth:** Node 22, Better Auth, Hono, better-sqlite3 (Kysely)
- **Optional AI:** any OpenAI-compatible chat endpoint (OpenRouter by default)

---

## 5. Project structure

```
DocuVerify/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI: upload, jobs, compare, auth proxy, static hosting
│   │   ├── ingestion.py       # validation + page normalization
│   │   ├── extractor.py       # native text + OCR extraction
│   │   ├── classification.py  # deterministic (+optional LLM) doc-type classification
│   │   ├── taxonomy.py        # data-driven document-type profiles
│   │   ├── capabilities.py    # capability registry (universal + domain)
│   │   ├── verifiers.py       # invoice / certificate / universal domain verifiers
│   │   ├── entities.py        # reusable entity extraction (dates, money, IDs)
│   │   ├── analyzers/         # layout, typography, visual, metadata, semantic, text_layer
│   │   ├── aggregator.py      # weighted assessment
│   │   ├── reference.py       # template-compare mode
│   │   ├── llm.py             # optional LLM reasoning layer
│   │   ├── pipeline.py        # stage orchestration
│   │   └── config.py          # weights, thresholds, LLM env config
│   ├── supabase/migrations/   # prepared Postgres schema (jobs persistence + RLS)
│   ├── sample_data/           # synthetic genuine/forged corpora
│   ├── spike/                 # dataset generators + evaluation scripts
│   └── tests/                 # pytest suites
├── auth/                      # Better Auth service (Hono + SQLite)
│   └── server/                # auth.ts, db.ts, index.ts
├── frontend/                  # React SPA (Verify, Templates, History, Reports)
└── .env.example               # root env template
```

---

## 6. Setup

### Backend (Python 3.13)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Auth service (Node 22)

```powershell
cd auth
npm install
```

### Frontend (Node 22)

```powershell
cd frontend
npm install
```

---

## 7. Environment variables

Copy the templates and fill in what you need. **Never commit real keys.**

### `backend/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `LLM_ENABLED` | no | `false` | Master switch for the optional LLM layer (`true`/`false`) |
| `LLM_BASE_URL` | no | `https://openrouter.ai/api/v1` | Any OpenAI-compatible endpoint (OpenRouter, Groq, Gemini OpenAI-compat) |
| `LLM_API_KEY` | only if `LLM_ENABLED=true` | — | API key for the LLM provider |
| `LLM_MODEL` | no | `minimax/minimax-m3:free` | Model ID; swap in one line |
| `SUPABASE_URL` | no | — | Reserved for persistence (schema prepared in `backend/supabase/migrations/0001_init.sql`) |
| `SUPABASE_ANON_KEY` | no | — | Reserved (same) |
| `SUPABASE_PUBLISHABLE_KEY` | no | — | Reserved (same) |
| `SUPABASE_SECRET_KEY` | no | — | Reserved — service-role key for future job-history persistence/storage |
| `DATABASE_URL` | no | — | Reserved — Postgres connection for future persistence |

> Note: the job store is currently **in-memory with a 2 h TTL cleanup**; the Supabase/Postgres schema for durable persistence ships in `backend/supabase/migrations/0001_init.sql` and is not yet wired into runtime.

### `auth/.env` (all optional — defaults shown)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `AUTH_PORT` | `4000` | Auth service port |
| `AUTH_BASE_URL` | `http://localhost:5173` | Base URL for auth callbacks |
| `BETTER_AUTH_SECRET` | dev default | Set `openssl rand -base64 32` in production |
| `AUTH_TEST_EMAIL` | `test@docu.com` | Sample user seeded on first start |
| `AUTH_TEST_PASSWORD` | `password` | Sample user password |

### `frontend/.env`

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | no | Reserved for future client-side Supabase use |
| `VITE_SUPABASE_ANON_KEY` | no | Reserved (same) |

### Shell environment

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_PROXY_URL` | `http://127.0.0.1:4000` | Where FastAPI proxies `/api/auth/*` (see `backend/app/main.py`) |

---

## 8. Run

### Development (three terminals)

```powershell
# Terminal 1 — backend (API on :8000)
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000

# Terminal 2 — auth service (seeds the sample user on first start)
cd auth
npm run dev

# Terminal 3 — frontend dev server (hot reload + /api proxies)
cd frontend
npm run dev
```

Open **http://localhost:5173** and sign in:

```
email:    test@docu.com
password: password
```

The Vite dev server proxies `/api/auth` → auth service (:4000) and `/api/*` → backend (:8000).

### Production-like single server

```powershell
cd frontend
npm run build          # emits frontend/dist
cd ..\backend
.venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
```

FastAPI serves the built SPA and the API from one port (**http://localhost:8000**); it still proxies `/api/auth/*` to the auth service, so keep Terminal 2 running.

---

## 9. API

| Endpoint | Description |
|---|---|
| `POST /api/auth/*` | Better Auth endpoints (sign-in/out, session) — proxied to the auth service |
| `POST /api/documents` | Multipart upload (PDF/JPG/PNG, ≤25 MB, magic-byte validated) → `{job_id}` |
| `POST /api/compare` | Multipart `document` + `template` → Reference Template Mode job |
| `GET /api/jobs` | Completed job summaries (score, risk level) |
| `GET /api/jobs/{id}` | Status + full forensic report |
| `GET /api/jobs/{id}/pages/page_{n}.png` | Normalized page render used for overlays |
| `GET /api/health` | Liveness probe |

Interactive docs at `/docs` (Swagger UI) while the backend runs.

---

## 10. Test / dataset

```powershell
cd backend
.venv\Scripts\python.exe -m pytest tests -q
```

Regenerate / extend the corpora:

- Certificates: `backend/spike/forge_cert.py`
- W-2 forms: `backend/spike/forge_w2.py`

All sample documents are script-generated — **no real personal data**.

---

## 11. Honesty notes

- The suspicion score is an **evidence-based indicator, not a calibrated probability of forgery**.
- Signals are heuristic; every report carries the disclaimer: *forensic indicators are algorithmic signals, not legal proof of forgery.*
- The LLM layer never sees raw documents and never decides the verdict; its output is score-capped and skippable.
- Durable job persistence (Supabase/Postgres) is schema-ready but not yet wired in; runtime state is in-memory.

---

## 12. Roadmap

- Wire Supabase/Postgres job persistence (schema prepared) + per-user job history
- More domain verifiers (bank statement reconciliation, contract clause checks)
- Fine-tuned local classifier as a drop-in replacement for the LLM assist
- Batch upload + queue worker separation for horizontal scaling
