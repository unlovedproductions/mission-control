# Mission Control — Unloved Productions

A unified orchestration dashboard that sits on top of **ShadowCast** (video renderer) and **APF** (affiliate product finder) without modifying either app. It communicates with both via their existing APIs and uses **Ollama** for local LLM inference.

## Operational docs

- `docs/RECOVERY.md` — disaster-recovery playbook
- `docs/RUNBOOK.md` — startup/shutdown and operations checks
- `docs/LOCAL_STACK.md` — local triple-repo startup
- `docs/SMOKE_TEST.md` — ecosystem smoke checklist
- `docs/ARCHITECTURE.md` — architecture and data-flow reference

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

- **Product Pipeline** — Import affiliate products from APF, browse/filter/search, AI-analyze with Ollama
- **Video Production Queue** — Send products to ShadowCast for script generation + video rendering, track job status
- **Ollama Model Manager** — View installed models, pull new ones, see VRAM usage, hardware-optimized recommendations
- **Content Calendar** — Monthly calendar view, schedule video publishes, track your YouTube pipeline
- **Analytics Overview** — Pipeline funnel, marketplace breakdown, job completion rates, recent activity
- **Settings** — Configure all API endpoints and default Ollama models

## Hardware Requirements

Optimized for:
- **GPU:** NVIDIA RTX 3080 (16GB VRAM) or equivalent
- **RAM:** 32GB DDR4
- **Storage:** NVMe SSD recommended for fast model loading
- **OS:** Windows 10/11 or Ubuntu 22.04+

## Prerequisites

1. **Python 3.10+** with pip
2. **Node.js 18+** with npm
3. **Ollama** installed and running (`ollama serve`)
4. **ShadowCast** running on `localhost:8000`
5. **APF** running on `localhost:3000`

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv

# Linux/macOS
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```

### 2. Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

### 3. Open Dashboard

Navigate to **http://localhost:3100**

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

The backend exposes a REST API on port 8100:

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

Mission Control talks to APF and ShadowCast with `X-Service-Key` when **Internal Service Secret** is set. Use the same value everywhere:

1. `INTERNAL_SERVICE_SECRET` in `~/APF/.env`
2. Export before starting ShadowCast and MC backend
3. Or set in MC Settings (seeded from `INTERNAL_SERVICE_SECRET` env on backend start)

Quick bring-up: `chmod +x scripts/start-ecosystem.sh && ./scripts/start-ecosystem.sh`

## Project Structure

```
mission-control/
├── backend/
│   ├── main.py              # FastAPI orchestration server
│   ├── requirements.txt     # Python dependencies
│   └── mission_control.db   # SQLite database (auto-created)
├── scripts/
│   └── start-ecosystem.sh   # Local bring-up for APF + ShadowCast + MC
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
└── README.md
```

## Troubleshooting

| Issue | Solution |
|---|---|
| Ollama shows "Offline" | Run `ollama serve` in a terminal |
| ShadowCast shows "Offline" | Start ShadowCast: `cd shadowcast && python app.py` |
| APF shows "Offline" | Start APF: `cd apf && pnpm run dev` |
| Model pull fails | Check disk space and internet connection |
| Video job fails | Check ShadowCast logs for render errors |
| Port conflict | Change ports in Settings or vite.config.ts |

## License

Internal tool — Unloved Productions
