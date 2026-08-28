# DocuVerify — Implementation Plan

Intelligent Document Authenticity & Forgery Detection (Hackathon)

## A. Understanding of the Product

DocuVerify is a **document-forensics evidence platform**, not a binary "AI fake detector." We ingest a document, extract multiple *independent* forensic signals (text, layout, typography, visuals, metadata, semantics), and combine them into an **evidence-based suspicion assessment** with *regional highlights* and *human-readable explanations*.

Core product principles:
- **Signals, not verdicts** — every module emits structured `Finding` objects with category, severity, score, region, evidence, confidence. No module decides "fake/genuine."
- **Explainability is first-class** — the report answers *why* a region was flagged, citing concrete evidence.
- **Deterministic where possible** — OCR, geometry, metadata, fonts are exact; the **LLM (via OpenRouter)** is used only for semantic reasoning and explanation prose. If no key is present, we still deliver a full analysis via deterministic NLP rules.
- **Graceful degradation** — scanned PDF, missing metadata, low OCR confidence: report the limitation, never fabricate precision.
- **A before/after demo wins** — genuine doc → low suspicion; the same doc with 3 subtle forgeries → higher suspicion with highlights on exactly the tampered regions.

## B. Core User Flow

1. User uploads a PDF/JPG/PNG (file validated for type + size).
2. Backend ingests → normalizes each page to a fixed pixel coordinate space → runs the extraction + forensic pipeline.
3. UI shows an **assessment card** (suspicion 0–100, risk level, per-category status chips).
4. **Document renders** with color-coded overlay boxes (red/orange/yellow) on suspicious regions; clicking a box opens the finding detail (category, severity, evidence, explanation, source module).
5. A **forensic report** section lists all findings with severities and module attribution, plus a mandated disclaimer.
6. (Reference mode, stretch) Compare an official template vs an upload, producing a difference report.

## C. Recommended Architecture

```
┌─ React + Vite + Tailwind SPA ───────────┐
│ Upload  •  Assessment card  •  Page     │
│ render w/ overlay highlights  • Findings │
│ list  •  Report + disclaimer            │
└───────────────▲─────────────────────────┘
                │ REST + SSE/poll job status
┌───────────────┴─────────────────────────┐
│ FastAPI backend (per-job temp workspace) │
│  ├ Ingestion (PyMuPDF/Pillow/OpenCV)     │
│  ├ Extractor → normalized TextBox list   │
│  │    (bbox·font·conf·page·source)       │
│  ├ Analyzer modules ─ each → []Finding   │
│  │   layout · typography · visual ·      │
│  │   metadata · semantic(deterministic)  │
│  │   + semantic(LLM via OpenRouter, opt) │
│  ├ Aggregator → final assessment         │
│  ├ Explanation/report generator          │
│  └ Job store (in-memory + SQLite opt)    │
└──────────┬──────────────┬───────────────┘
           │              │
   synthetic forge      optional ref-mode
   dataset + tests      comparer (stretch)
```

A single Python process owns every analytic primitive (PyMuPDF, OpenCV, RapidOCR, NLP); FastAPI exposes clean endpoints and serves the built React app for a one-command demo. No separate microservices — unneeded for a hackathon.

## D. Existing Repository Assessment

The repo is a **blank slate**: initialized git repo (`main`, no commits), no scaffold, no `.gitignore`. Remote: `https://github.com/7sthunder/DocuVerify.git`.

Environment findings:
- Python **3.13.5** + pip (no uv/poetry — use plain `requirements.txt` + venv)
- Node **22.17.0** + npm 10.9.2
- **PyMuPDF 1.28.0 already installed** (text-with-font extraction, metadata, image extraction, rendering — key asset)
- **No Tesseract** binary, **no GPU** (CPU only), no NVIDIA
- **No Ollama**, no API keys in env (user will supply an **OpenRouter** key for free models)
- Docker 28.3 available (not needed for MVP)

**Implication**: greenfield build; stack is our choice; CPU-only, no Tesseract → OCR must be **RapidOCR** (ONNX, PP-OCRv4, no system deps, works on 3.13); PyMuPDF handles all PDF primitives.

## E. Recommended Technology Stack

| Layer | Choice | Why | Alternatives (rejected) |
|---|---|---|---|
| Backend | **FastAPI + Uvicorn** | async uploads, auto docs, trivially serves React build | Flask (sync, more boilerplate), Node backend (loses PyMuPDF/OCR access) |
| OCR / extraction | **PyMuPDF** (native PDF text w/ fonts+bbox) + **RapidOCR-ONNXRuntime** (scans) | exact geometry on born-digital; CPU-only OCR with no system install | Tesseract (not installed), PaddleOCR (paddlepaddle 3.13 wheels risky), EasyOCR (torch install heavy, slower CPU) |
| Vision | **OpenCV-headless + Pillow + NumPy** | grid sharpness/DCT-artifact/tile-noise signals, image dpi/sharpness checks | — |
| NLP rules | **spaCy small** (offset) + **regex/rule engine** | entity + date/number/name cross-checks | NLTK (heavier, less NER). Regex-only is fallback if spaCy 3.13 wheel unavailable |
| LLM reasoning | **Dedicated OpenRouter client** (OpenAI-compatible API), provider-agnostic via config | free models, one key, works with any compat model | Direct OpenAI/Anthropic/Gemini only (locks providers) |
| Frontend | **React 18 + Vite + TypeScript + Tailwind** | best overlay/click UX | vanilla SPA |
| Jobs/storage | **Temp dir per job (UUID) + in-memory registry**, optional SQLite | stateless, no DB ops for MVP | Postgres/Redis (overkill) |
| Tests | **pytest + httpx TestClient** | CI-able validation vs synthetic dataset | — |

## F. Module-by-Module Design

All modules emit the unified `Finding` schema:

```json
{
  "id": "vis-042", "category": "visual", "module": "visual_analyzer",
  "severity": "medium", "score": 0.71, "confidence": 0.8,
  "region": {"page": 0, "x": 420, "y": 315, "w": 250, "h": 42},
  "evidence": ["logo region sharpness = 84 (page median = 41)"],
  "explanation": "…",
  "fields": {}
}
```

### 1. Ingestion (`ingestion.py`)
- Accept `application/pdf`, `image/jpeg`, `image/png`; validate magic bytes (not just extension); size cap ~25 MB; reject password-protected PDFs with a clear error (PyMuPDF `needs_pass`).
- Convert every input to normalized pages: render via `page.get_pixmap(dpi≈200)` → fixed-width canvas (e.g., **1240 px wide**) → PNG. **All downstream coordinates live in this single page-pixel space**, so OCR boxes, PyMuPDF spans, and visual tiles are directly comparable and overlay-able.
- Preserve original file + the normalized page images in the job dir.

### 2. OCR / Text Extraction (`extractor.py`)
- **Born-digital PDF**: `page.get_text("dict")` → blocks→lines→spans with `bbox`, `font` (family, size, flags for bold/italic, color). Source = `"native"`.
- **Scanned/image**: page PNG → RapidOCR → text + quad boxes + per-line confidence. Source = `"ocr"`.
- Emits `TextBox[]`: `{text, page, x,y,w,h, confidence, source, font_info?}`.
- Confidence handling: blocks below a threshold (e.g., <0.55) are marked `unreliable`; if a page's mean confidence is too low, the aggregator down-weights text-derived signals and the report states OCR reliability is poor (never guesses text content).

### 3. Layout Analyzer
- Group blocks; compute per-page: dominant **left/right/center alignment** (edge-histograms), **column structure**, **margins** (content bbox vs page box), **row spacing / line-height** distributions, **baseline Y clusters**.
- Finding rules (statistical outliers, not absolutes): a block whose alignment class contradicts the page's dominant class; spacing ratios ≥ ~2.5σ from the page distribution; content bleeding into a margin other blocks honor; grid (table) cells misaligned relative to the table's column edges.
- Every signal includes the page-relative dominant pattern in `evidence`.

### 4. Typography Analyzer
- Runs only on **native** text (degrade for scans: emit no typography findings and mark category `unavailable` in the report).
- Build the document's font usage profile → dominant (family, size, weight) clusters. Intra-document signals: a span/line whose family is absent elsewhere, or size deviating > N px from the nearest dominant cluster, **particularly if surrounded by lines of the dominant font** (local context check).
- Baseline consistency: spans on the same logical line with diverging baselines; mixed italic/bold flags in a field that is uniformly regular elsewhere.
- Score = distance from the dominant font-cluster centroid in feature space.

### 5. Visual / Image Analyzer
- **Embedded image inventory** via PyMuPDF: per image `{bbox, pixel size, color mode, placed DPI}`, plus per-page tile grid (e.g., 64 px tiles) computed on the normalized render.
- Signals (OpenCV, deterministic):
  - Sharpness (Laplacian variance) per tile → tiles far from page baseline distribution (possible pasted high-detail object on a soft background, or a blur-smudged replaced area).
  - JPEG **block-artifact** fingerprint per tile (DCT blockiness) → compression mismatch = strong tamper hint.
  - Background luminance uniformity → "painted-over" rectangular regions.
  - Embedded image placed at DPI far from nominal, or heavily upscaled from source pixels.
- Emits region findings; purely heuristic, always with `confidence`, clearly labeled as signals.

### 6. Metadata Analyzer
- PDF: PyMuPDF `doc.metadata` (creator, producer, `CreationDate`, `ModDate`, version). Images: Pillow/EXIF optional.
- Heuristic rules (deterministic, low ceiling): producer software inconsistent with a claimed official backend (small curated list); `ModDate` wildly after `CreationDate` or `<` it; odd timestamp date components; producer version mismatches.
- **Design constraint honored**: metadata alone can never push overall risk above LOW/MEDIUM; missing metadata is reported as "not available" (neutral), never as suspicion. Explanations always note metadata can be legitimately produced/missing/stripped.

### 7. Semantic Consistency Analyzer
- **Part A — Deterministic (always runs):**
  - Field extraction: regex + spaCy small NER (name, dates, numbers) keyed to the expected certificate field canvas (cert no., name, degree, program, institution, issue/validity date, CGPA/marks).
  - Cross-field rules: date ranges (issue ≤ validity, expiry > issue), duration plausibility (e.g., 4-year degree issued 4–5 years after enrollment), CGPA within the scale implied by the doc (0–4 vs 0–10 vs 100), certificate-number format consistency, **repeated-name/repeated-field drift** across pages, same institution spelled inconsistently.
- **Part B — LLM (OpenRouter, optional):**
  - Send **extracted text fields + deterministic findings ONLY** (never raw images), instructing the model to (1) identify logical/semantic inconsistencies between fields, (2) assess each as a hypothesis with severity + reason, (3) respond in strict JSON. Temperature low (~0.2).
  - No key → module reports `heuristic-only`; aggregator lowers its ceiling. Key → merge LLM hypotheses into findings with module=`semantic_llm`, scoring capped by its `confidence`.
- **Constraint honored**: the LLM reasons over *extracted evidence*; it never OCRs, measures fonts, or computes coordinates.

### 8. Anomaly Aggregator
- Input: `Finding[]`. Output:
  - Per-category status `{category, label: normal|minor|suspicious|anomaly, max_severity, weighted_score, available}` (skip unavailable categories; **renormalize weights over active categories**).
  - `suspicion_score` 0–100 via weighted combination (e.g., typography 0.25, layout 0.2, text-consistency 0.25, visual 0.15, semantic-LLM 0.10, metadata 0.05); bounded so one module can't dominate (cap any category's contribution).
  - `risk_level`: LOW (<30), MEDIUM (30–64), HIGH (≥65), with thresholds verified against the synthetic corpus.
- Output is explicitly styled as **evidence-based assessment**, never "probability" — no calibration claims.

### 9. Explanation Engine / Report Generator
- Every finding carries its explanation at creation time (rule → human sentence with numbers baked in). The report adds the NLP overlay: a short summary paragraph (LLM or template) + a global disclaimer: *"Forensic indicators are algorithmic signals, not legal proof of forgery."*
- Report = structured JSON (findings, assessment, per-page regions, reliability notes) → rendered by frontend; downloadable as JSON (and later PDF).

### 10. Frontend (React, detailed UI deferred)
- Screens: **Upload**, **Analyzing (progress)**, **Result**: assessment card, page viewer with overlay toggles per category, clickable region → detail drawer, findings table with severity filter, report section.
- Backend serves page PNGs from the job dir; frontend draws overlay boxes absolutely positioned over them (coordinates already in shared canvas space).

## G. Data Flow

```
Upload ─→ validate ─→ job dir (UUID)
  ├─ normalize → page PNGs (1240px) + original
  ├─ extract  → TextBox[] (native/OCR, per page)
  ├─ [layout][typography][visual][metadata][semantic-rules]
  │     each → Finding[]
  ├─ [semantic-llm → Finding[]]  (optional)
  ├─ aggregate → assessment JSON
  ├─ report JSON persisted in job dir
  └─ UI polls status → renders pages + overlays + findings
```

## H. AI/ML/LLM Responsibilities

| Responsibility | Engine | Notes |
|---|---|---|
| Pixel/font/coordinate/OCR | PyMuPDF / OpenCV / RapidOCR | deterministic, never LLM |
| Field NER (deterministic baseline) | spaCy + regex | offline |
| Semantic/logical consistency | LLM (OpenRouter) atop extracted fields | JSON-out, low temp, hypotheses only |
| Explanation prose | rule templates; LLM optional enrichment | numbers always from evidence |
| Report summary | LLM or template | optional |

**OpenRouter integration**: OpenAI-compatible client with `base_url=https://openrouter.ai/api/v1`. Config via `.env`: `LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=<free model>`, with `LLM_ENABLED=true/false`. Provider-agnostic so a local Ollama endpoint can slot in later.

## I. Anomaly Scoring Strategy

- Per-finding: `score ∈ [0,1]` derived from the specific detector (z-score distance, cluster distance, rule hit count).
- Per-category: max severity + weighted mean with missing-category renormalization.
- Document: weighted sum with per-category caps; **suspicion output mapped to LOW/MEDIUM/HIGH** via thresholds we tune on the controlled dataset. No probability/calibration claims anywhere; formula documented in the report.

## J. Suspicious Region Strategy

- Findings carry `region` in the shared canvas. The UI draws:
  - **Red** = high, **orange** = medium, **yellow** = low (stable mapping, placed in a legend).
- Region resolution guarantees: OCR/native spans → exact block bbox; visual tiles → merged tile cluster bbox; metadata/integer findings → **no region** (page-level note).
- Click region → detail drawer with finding + evidence + explanation + module + severity + confidence.
- Demo-critical: we verify overlay covers the actual tampered area (see M).

## K. Explainability Strategy

- Answer *"why flagged?"* with concrete evidence strings (e.g., `"Font 'Times-Bold' 6.2pt appears nowhere else; 41 adjacent spans use 'Calibri' 11pt"`).
- Per-finding: category, severity, score, confidence, location (page/bbox), evidence list, explanation.
- Report always lists what was **not** assessable (metadata missing, scanned → no typography), so the user knows the system's own limits.

## L. Reference Template Mode Feasibility

**Feasible at low cost** — it reuses every extraction primitive. Compare an uploaded doc against an official template:
- Per-page: block-level layout alignment diff (nearest-neighbor), margin/gutter diff, dominant-font diff, logo/seal presence, position + size, required-field presence (e.g., cert no., registrar signature), per-tile visual diff (grayscale diff heatmap → mismatched tiles).
- Output: difference report with matched labels per region ("logo moved 14px right", "CGPA field format changed").

**Recommendation**: build **after** MVP; it's the stretch feature that differentiates the demo if time allows.

## M. Dataset / Testing Strategy

- **Synthetic corpus** (no real personal data): a Python `forge.py` renders a base "ABC University certificate" (Pillow + PyMuPDF) and produces ~6–10 variants per template with **known ground-truth edits**:
  1. name string changed (native or pasted pixels)
  2. CGPA altered (number swapped / upscaled region pasted over)
  3. date changed
  4. one field re-rendered in a different font/size
  5. a field moved out of alignment
  6. a logo/QR region copy-pasted from another area
  7. producer metadata rewritten to "Adobe Photoshop"
  8. genuine untouched
- **Validation (pytest)**:
  - original → `risk_level=LOW`, lowest scores.
  - each variant → suspicion higher than original, and at least the known-edited bbox overlaps a flagged region at correct severity tier.
  - threshold tuning loop → commit `thresholds.json`.
- **No invented performance numbers.** If metrics are shown in the demo (e.g., "8/9 edits detected"), they are computed from this corpus run and displayed as such.

## N. MVP vs Optional Features

**MVP (must ship):** ingestion+normalization; native text + OCR fallback; layout, typography (native), visual, metadata, deterministic semantic analyzers; aggregator + report; FastAPI upload/analyze/poll; React result UI with overlays + findings; synthetic dataset + pytest validation; demo corpus with originals + forged pairs.

**Optional (in order):** LLM (OpenRouter) semantic + prose; reference-compare mode; per-page multi-page navigation; SQLite history; PDF report export; EXIF image metadata; signature-region lap/ink analysis.

## O. Risks & Challenges

| Risk | Impact | Mitigation |
|---|---|---|
| Python 3.13 wheel availability (onnxruntime, spaCy, opencv) | install failure mid-hackathon | **Phase 0 install spike first**; RapidOCR is pure-py + onnxruntime; regex-only NER fallback |
| No GPU, CPU OCR latency | slow multi-page docs | cap OCR pages/DPI; process via background tasks + progress poll; cap upload at ~10 pages |
| Coordinate space mismatch (native pts vs OCR px) | misaligned highlights | single 1240px canvas normalization from day one |
| False-positive over-flagging (real docs differ legitimately) | credibility damage | statistical outlier approach + local-context checks + confidence + disclaimer |
| OpenRouter key/model unavailability at demo | LLM feature gap | deterministic pipeline is the complete fallback; demo script notes it |
| Metadata edge cases (stripped/inconsistent legitimately) | wrong accusation | metadata ceiling LOW/MEDIUM, neutrality promised |
| Password-protected / malformed PDFs | pipeline crash | explicit pre-checks with friendly errors |
| Time pressure | incomplete pipeline | MVP ordered before any optional feature |

## P. Dependency / API Requirements

- **pip**: fastapi, uvicorn[standard], python-multipart, pydantic, pymupdf, pillow, numpy, opencv-python-headless, rapidocr-onnxruntime, onnxruntime, python-dotenv; optional: spacy (+ `en_core_web_sm`). LLM call via `httpx` to OpenRouter.
- **npm**: react, react-dom, vite, typescript, @vitejs/plugin-react, tailwindcss, (axios or fetch).
- **External API**: OpenRouter only (user-provided, free models). Everything else local/offline.
- **No** GPU, Docker, database server, or cloud infra required.

## Q. Security & Privacy

- Validation by magic bytes; 25 MB cap; UUID temp job dirs; **no logging of document text/findings text** (log IDs, module, severity only); no persistence by default, TTL cleanup (e.g., purge job dirs > 2 h).
- Demo-friendly notes clearly separated from production hardening (auth, encrypted storage) in README. No secrets in repo; `.env.example` only, `.env` gitignored.

## R. Step-by-Step Implementation Phases

- **Phase 0 — Spike (half-day):** venv + `requirements.txt`; verify install of opencv/onnxruntime/rapidocr/spaCy on 3.13; OCR a sample certificate; confirm PyMuPDF font/bbox extraction; prototype 1240px canvas; scaffold Vite app. **Exit: all installs green, sample JSON output produced.**
- **Phase 1 — Extraction core:** ingestion + normalization + extractor (native + OCR) → `TextBox[]` JSON; CLI debug dump. Exit: correct coordinate alignment on both PDF and scan.
- **Phase 2 — Analyzers:** layout, typography (native), visual, metadata, semantic-rules → `Finding[]`; aggregator; `thresholds.json`; pytest harness with synthetic fixtures. Exit: originals LOW / variants flagged.
- **Phase 3 — Backend API:** `POST /api/docs`, `GET /api/jobs/{id}` (+progress), `GET /api/jobs/{id}/report`, static page images; job store; serve built React. Exit: full end-to-end via curl.
- **Phase 4 — Frontend:** upload → progress → result screen (assessment card, page viewer, overlay toggle, click regions, findings, report + disclaimer). Exit: demo flow in browser.
- **Phase 5 — Hardening + stretch:** LLM (OpenRouter) semantics + prose; reference mode; multi-page nav; demo corpus script polish; README with run instructions.

## S. Hackathon Demo Flow

1. Upload **genuine certificate** → LOW suspicion, mostly "normal" categories, few minor findings.
2. Upload **forged copy** (name + CGPA + date edited via forge script) → score jumps; findings tag the three edited regions in red/orange.
3. Click each highlight → drawer shows category/severity/evidence/explanation/module (e.g., "Typography: field font differs from 41 surrounding spans").
4. Toggle category layers (visual/metadata/typography) to isolate signals.
5. (If ready) reference mode: template vs upload → difference report.
6. Show the falsification-disclaimer line to signal honesty.

## T. What Should Be Built First

1. **Phase 0 install + OCR/extraction spike** (de-risks Python 3.13 + CPU OCR immediately).
2. **The extraction core + unified Finding schema** — every later module depends on normalized `TextBox[]` and coordinates.
3. **Synthetic forge script + pytest harness early** (before tuning scoring, so thresholds are data-driven).
4. Then analyzers → aggregator → API → UI, in that order. LLM and reference mode last.