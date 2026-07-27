# Mission Control — Unloved Productions

A unified orchestration dashboard that sits on top of **ShadowCast** (video renderer) and **APF** (affiliate product finder) without modifying either app. It communicates with both via their existing APIs and uses **Ollama** for local LLM inference.

## Operational docs

- [CHANGELOG.md](CHANGELOG.md) — notable changes
- [SETUP_POPOS.md](SETUP_POPOS.md) — full Pop!_OS / Razer Blade ecosystem setup
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md) — env vars and Settings surface
- [docs/RECOVERY.md](docs/RECOVERY.md) — disaster-recovery playbook
- [docs/RUNBOOK.md](docs/RUNBOOK.md) — startup/shutdown and operations checks
- [docs/LOCAL_STACK.md](docs/LOCAL_STACK.md) — local triple-repo startup
- [docs/SMOKE_TEST.md](docs/SMOKE_TEST.md) — ecosystem smoke checklist
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture and data-flow reference
- [docs/handoff/SHADOWCAST_CHANGES.md](docs/handoff/SHADOWCAST_CHANGES.md) — ShadowCast APIs MC needs
- [docs/handoff/APF_CHANGES.md](docs/handoff/APF_CHANGES.md) — APF APIs MC needs

## Architecture

```
┌─────────────────────────────────────────────┐
│            Mission Control (this app)        │
│  ┌──────────────┐    ┌───────────────────┐  │
│  │ React Frontend│    │ FastAPI Backend   │  │
│  │  (port 3100) │───▶│   (port 8100)    │  │
│  └──────────────┘    └──────┬────────────┘  │
│                             │               │
└─────────────────────────────┼───────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
   ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
   │  ShadowCast │   │     APF      │   │   Ollama     │
   │  (port 8000)│   │  (port 3000) │   │ (port 11434) │
   └─────────────┘   └──────────────┘   └──────────────┘
```

**CRITICAL:** Mission Control does NOT modify ShadowCast or APF. It orchestrates them from above.

## Features

- **Product Pipeline** — Import affiliate products from APF (8 marketplaces), browse/filter/search, queue enrichment, bookmarks, AI-analyze with Ollama
- **Video Production Queue** — Send products to ShadowCast with preset/TTS, track job status including `partial`, retry-missing / audit
- **Publish** — Proxy ShadowCast OAuth status, postable jobs, publish/schedule/queue (connect accounts in ShadowCast UI)
- **Ops** — Service registry health, Digistore daemon, refresh runs, schedules, problem jobs
- **Ollama Model Manager** — View installed models, pull new ones, see VRAM usage, hardware-optimized recommendations
- **Content Calendar** — Monthly calendar view; marking published can call ShadowCast schedule/publish
- **Analytics Overview** — Pipeline funnel plus ShadowCast hook/format/revenue proxies
- **Settings** — Configure API endpoints, default models, APF credentials

Child-app gaps that need APF/ShadowCast code: [docs/handoff/](docs/handoff/).

## Hardware Requirements

Optimized for:

- **GPU:** NVIDIA RTX 3080 (16GB VRAM) or equivalent
- **RAM:** 32GB DDR4
- **Storage:** NVMe SSD recommended for fast model loading
- **OS:** Windows 10/11 or Ubuntu 22.04+ / Pop!_OS 22.04+

## Prerequisites

1. **Python 3.10+** with pip
2. **Node.js 18+** with **pnpm**
3. **Ollama** installed and running (`ollama serve`)
4. **ShadowCast** at `~/shadowcast-` running on `localhost:8000`
5. **APF** at `~/APF` running on `localhost:3000`

## Quick Start

Preferred: bring up APF + ShadowCast + Mission Control together:

```bash
chmod +x scripts/start-ecosystem.sh
./scripts/start-ecosystem.sh
```

Defaults: `APF_HOME=~/APF`, `SC_HOME=~/shadowcast-`, `MC_HOME` = this repo. Open **http://localhost:3100**.

See [docs/LOCAL_STACK.md](docs/LOCAL_STACK.md) for one-time setup and secret wiring.

### Mission Control only

#### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # set INTERNAL_SERVICE_SECRET to match APF + ShadowCast
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```

#### 2. Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

#### 3. Open Dashboard

Navigate to **http://localhost:3100**

Interactive API docs (FastAPI OpenAPI): **http://localhost:8100/docs**

## Ollama Setup

### Install Ollama

```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows — download from https://ollama.com/download
```

### Pull Recommended Models

```bash
# Fast all-rounder (5GB VRAM)
ollama pull llama3.1:8b

# Creative writing alternative (4.5GB VRAM)
ollama pull mistral:7b-instruct

# Heavy reasoning — uses most of your 16GB VRAM
ollama pull qwen2.5:14b-instruct-q5_K_M
```

### Start Ollama

```bash
ollama serve
```

You can also pull models directly from the Mission Control dashboard under **Ollama Models**.

## API Reference

The backend exposes a REST API on port 8100 (also browsable at `/docs`):

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | GET | Health check |
| `/api/config` | GET/PUT | Read/update configuration |
| `/api/status/services` | GET | Check ShadowCast, APF, Ollama status |
| `/api/ollama/models` | GET | List installed Ollama models |
| `/api/ollama/pull` | POST | Pull a new model |
| `/api/ollama/running` | GET | Currently loaded models |
| `/api/products` | GET | List imported products (filtered total) |
| `/api/products/import` | POST | Import from APF (upsert by APF id) |
| `/api/products/refresh` | POST | Trigger APF marketplace scrape |
| `/api/products/search` | GET | Search APF products |
| `/api/products/{id}/reenrich` | POST | Re-fetch APF enrichment + ShadowCast normalize |
| `/api/products/{id}/analyze` | POST | AI-analyze a product |
| `/api/products/{id}/status` | PUT | Approve/reject product |
| `/api/apf/credentials` | GET/PUT | Marketplace API key status / save |
| `/api/shadowcast/hooks` | GET | ShadowCast hook types |
| `/api/shadowcast/content-styles` | GET | ShadowCast content styles |
| `/api/jobs` | GET/POST | List/create video jobs (hooks, style, model) |
| `/api/jobs/{id}` | GET/DELETE | Get/delete a job |
| `/api/calendar` | GET/POST | List/create calendar events |
| `/api/analytics/overview` | GET | Dashboard statistics |
| `/api/activity` | GET | Activity log |

## Default Configuration

| Setting | Default Value |
|---|---|
| ShadowCast URL | `http://localhost:8000` |
| APF URL | `http://localhost:3000` |
| Ollama URL | `http://localhost:11434` |
| Script Model | `llama3.1:8b` |
| Analysis Model | `llama3.1:8b` |
| Creative Model | `mistral:7b-instruct` |
| Heavy Model | `mixtral:8x7b-instruct-v0.1-q4_K_M` |
| Default Hooks | `curiosity` |
| Default Content Style | `honest_review` |

Full env + Settings reference: [docs/CONFIGURATION.md](docs/CONFIGURATION.md).

## Operator Workflow

1. **Scrape APF** — Product Pipeline → Scrape APF (per marketplace)
2. **Import** — pulls `products.list` + `shadowCastPayload`, normalizes via ShadowCast
3. **Review** — open product detail, check review brief + recommended style
4. **Approve** — mark product approved before queuing video
5. **Create job** — pick hooks, style, model; MC sets ShadowCast LLM config then `/api/generate`
6. **Track** — Video Queue shows progress; download when complete
7. **Schedule** — completed jobs → Add to Calendar

APF service-key auth uses `APF_USER_ID` (default `1`) so `products.list` returns scraped products.

## Service Authentication

Mission Control talks to APF and ShadowCast with `X-Service-Key` when the internal service secret is set. Use the **same** value in all three repos.

Two local mechanisms (either is fine; values must still match):

1. **`backend/.env`** — copy from `backend/.env.example`; set `INTERNAL_SERVICE_SECRET`. Mirror the same value in `~/APF/.env` and `~/shadowcast-/backend/.env`.
2. **`scripts/start-ecosystem.sh`** — if `INTERNAL_SERVICE_SECRET` is unset, reads or creates `MC_HOME/.service-secret` and exports it for APF, ShadowCast, and MC for that session.

Settings also store the secret in SQLite (seeded from `INTERNAL_SERVICE_SECRET` on backend start when empty).

## Project Structure

```
mission-control/
├── backend/
│   ├── main.py              # FastAPI orchestration server
│   ├── requirements.txt     # Python dependencies
│   ├── .env.example         # Secret / optional env template
│   └── mission_control.db   # SQLite database (auto-created)
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   ├── utils/           # API client
│   │   ├── App.tsx          # Root component with routing
│   │   ├── main.tsx         # Entry point
│   │   └── index.css        # Tailwind + custom styles
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── scripts/
│   └── start-ecosystem.sh   # Local bring-up for APF + ShadowCast + MC
├── docs/                    # Ops guides (runbook, recovery, architecture, …)
├── tests/                   # Backend API tests
├── .github/workflows/       # CI
├── SETUP_POPOS.md           # Full machine setup
├── CHANGELOG.md
└── README.md
```

## Troubleshooting

| Issue | Solution |
|---|---|
| Ollama shows "Offline" | Run `ollama serve` in a terminal |
| ShadowCast shows "Offline" | Start ShadowCast: `cd ~/shadowcast-/backend && source venv/bin/activate && python app.py` |
| APF shows "Offline" | Start APF: `cd ~/APF && pnpm run dev` |
| Port 3000 is not APF | Another app (e.g. Open WebUI) may own `:3000`; stop it or point APF / MC Settings at APF’s real port |
| Empty APF import | Match `INTERNAL_SERVICE_SECRET`; ensure `APF_USER_ID=1` in APF |
| Model pull fails | Check disk space and internet connection |
| Video job fails | Check ShadowCast logs for render errors |
| Job stuck after MC restart | Stuck jobs auto-fail after 35 minutes; delete and re-queue |
| Port conflict | Change ports in Settings or `vite.config.ts` |

## License

Internal tool — Unloved Productions
