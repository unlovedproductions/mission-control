# Mission Control — Unloved Productions

A unified orchestration dashboard that sits on top of **ShadowCast** (video renderer) and **APF** (affiliate product finder) without modifying either app. It communicates with both via their existing APIs and uses **Ollama** for local LLM inference.

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
npm install
npm run dev
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
| `/api/products` | GET | List imported products |
| `/api/products/import` | POST | Import from APF |
| `/api/products/{id}/analyze` | POST | AI-analyze a product |
| `/api/jobs` | GET/POST | List/create video jobs |
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
| Heavy Model | `qwen2.5:14b-instruct-q5_K_M` |

All settings are configurable from the dashboard Settings page.

## Project Structure

```
mission-control/
├── backend/
│   ├── main.py              # FastAPI orchestration server
│   ├── requirements.txt     # Python dependencies
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
└── README.md
```

## Troubleshooting

| Issue | Solution |
|---|---|
| Ollama shows "Offline" | Run `ollama serve` in a terminal |
| ShadowCast shows "Offline" | Start ShadowCast: `cd shadowcast && python app.py` |
| APF shows "Offline" | Start APF: `cd apf && npm run dev` |
| Model pull fails | Check disk space and internet connection |
| Video job fails | Check ShadowCast logs for render errors |
| Port conflict | Change ports in Settings or vite.config.ts |

## License

Internal tool — Unloved Productions
