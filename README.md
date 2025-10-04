# TestFlowAI — Intelligent Web Testing Platform

A modern, evidence‑driven web testing platform that blends heuristic generation with optional AI assistance. Configure a run, watch it execute live, and review a clean report with coverage, heuristic‑vs‑AI comparison, and downloadable artifacts.

> Monorepo managed with pnpm. Web app lives in `apps/web/`; shared libraries under `packages/`.

---

## ✨ Features

- Dashboard (Run Configuration)
  - Target URL, crawl depth, mode (dynamic/static)
  - Toggles: AI‑generated tests, screenshot capture
  - Optional credentials and asset uploads
  - Starts a new run and routes to a live view

  Screenshot placeholder: `docs/readme-shots/01-dashboard.png`

  ![Dashboard (add your screenshot)](docs/readme-shots/01-dashboard.png)

- Live Run (Streaming Execution)
  - Real‑time status via Server‑Sent Events (SSE)
  - Test/step progress with minimal log lines
  - Live screenshot thumbnails as evidence
  - Graceful completion and error handling

  Screenshot placeholder: `docs/readme-shots/02-live-run.png`

  ![Live Run (add your screenshot)](docs/readme-shots/02-live-run.png)

- Report (Post‑Run Analysis)
  - Heuristic vs AI comparison (totals, pass/fail, lift)
  - Coverage: pages tested, forms filled, routes hit, clickables touched
  - Concise AI summary/rationale when AI is used
  - Evidence gallery with step screenshots
  - Exports: PDF and CSV (download buttons at the top)

  Screenshot placeholders:
  - `docs/readme-shots/03-report-comparison.png` (Heuristic vs AI)
  - `docs/readme-shots/04-report-coverage.png` (Coverage)
  - `docs/readme-shots/05-report-evidence.png` (Evidence)

  ![Report — Heuristic vs AI (add your screenshot)](docs/readme-shots/03-report-comparison.png)

  ![Report — Coverage (add your screenshot)](docs/readme-shots/04-report-coverage.png)

  ![Report — Evidence (add your screenshot)](docs/readme-shots/05-report-evidence.png)

- History (Run Management)
  - Cards with status, duration, success %, and actions
  - Quick access to Report and Details; optional filters/search

  Screenshot placeholder: `docs/readme-shots/06-history.png`

  ![History (add your screenshot)](docs/readme-shots/06-history.png)

- Optional AI Integration
  - Providers: Groq, Gemini, or Hugging Face (when configured)
  - Generates additional tests and a brief rationale in the report
  - Health check endpoint to verify keys

---

## 🧠 How it works (high‑level)

1. Accept Run Config (URL, depth, options)
2. Crawl & Discover (pages, forms, routes)
3. Generate Tests (heuristic + optional AI)
4. Execute Tests (headless browser runner)
5. Capture Evidence (screenshots and logs where applicable)
6. Analyze & Summarize (coverage, comparison, rationale)
7. Serve Report (web view + PDF/CSV exports)

---

## 🚀 Quick Start

Prereqs: Node 18+, pnpm 8+

Install:

```bash
pnpm install
```

Build (monorepo):

```bash
pnpm -w -s build
```

Run the web app:

```bash
pnpm --filter @autotest/web dev
# open http://localhost:3030
```

Start a run (from Dashboard):

- Enter target URL, set Depth=1 (quick), enable Screenshots; toggle AI if keys are configured.
- Click “Start Testing” to open the live run. After completion, click “View Report.”

---

## 🔌 API (internal)

- `POST /api/run` — start a run
- `GET  /api/run?runId=...` — get a run record
- `GET  /api/events?runId=...` — SSE stream for live updates
- `GET  /api/run/report?runId=...` — structured report payload
- `GET  /api/run/report/pdf?runId=...` — PDF download
- `GET  /api/run/report/csv?runId=...` — CSV download
- `GET  /api/ai/check` — provider health check (optional)

---

## 🔐 Environment (optional AI)

Create `apps/web/.env` with any providers you plan to use:

```env
# Groq
GROQ_API_KEY=

# Google Gemini
GOOGLE_API_KEY=

# Hugging Face
HUGGING_FACE_HUB_TOKEN=
```

If no keys are set, the app runs purely on heuristic generation.

---

## 🗂️ Monorepo structure (simplified)

- `apps/web/` — Next.js app (Dashboard, Live Run, Report, History)
- `apps/cli/` — CLI prototype and test artifacts
- `packages/*` — shared libraries (ai, core, crawler, generator, reporting, runner)
- `docs/ch4-figures/` — Mermaid/PlantUML sources for ER/DFD/Use‑Case

---

## 🧭 Roadmap

- Deeper crawl/authenticated flows; stable selectors & waits
- Richer AI prompts and multi‑model routing; uncertainty hints
- Trend analytics across runs; flaky test detection
- CI/CD integration with artifact publishing

---

## 🤝 Contributing

Issues and PRs are welcome for documentation, examples, and small enhancements. For larger changes, please open an issue first to discuss scope and design.

---
