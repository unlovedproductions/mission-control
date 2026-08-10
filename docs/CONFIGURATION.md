# Mission Control Configuration

Secrets belong in env files. Service URLs and model defaults live in SQLite Settings (seeded on first start). Do not commit secret values.

## Sources

| Source | What lives there |
|--------|------------------|
| `backend/.env` | `INTERNAL_SERVICE_SECRET`; optional `MC_*` / `SENTRY_*` overrides |
| `backend/.env.example` | Template — copy to `.env` |
| `frontend/.env` | `VITE_SENTRY_DSN`; optional `VITE_SENTRY_ENVIRONMENT` |
| `frontend/.env.example` | Template — copy to `.env` |
| `$MC_HOME/.service-secret` | Fallback for `scripts/start-ecosystem.sh` when env secret is unset |
| SQLite `config` table | URLs, default models, hooks/style, secret (via Settings / `/api/config`) |
| Sibling repos | Same `INTERNAL_SERVICE_SECRET`; APF `APF_USER_ID` (default `1`) |

## Environment variables (`backend/.env`)

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `INTERNAL_SERVICE_SECRET` | Yes (for M2M) | empty | Shared with APF + ShadowCast; sent as `X-Service-Key` |
| `MC_DB_PATH` | No | `backend/mission_control.db` | SQLite file path |
| `MC_MAX_CONCURRENT_JOBS` | No | `2` | Parallel video jobs |
| `MC_CORS_ORIGINS` | No | `http://localhost:3100,http://127.0.0.1:3100` | Comma-separated CORS origins |
| `MC_DASHBOARD_TOKEN` | No | empty | When set, all `/api/*` except health/auth require `X-Dashboard-Token` or `Authorization: Bearer` |
| `SENTRY_DSN` | No | empty | Backend Sentry DSN; when set, errors/traces/logs are sent |
| `SENTRY_ENVIRONMENT` | No | `development` | Sentry environment tag |

On backend start, if Settings has an empty `internal_service_secret` and the env var is set, the env value is seeded into SQLite.

## Service registry & schedules

SQLite tables (seeded on start):

| Table | Purpose |
|-------|---------|
| `services` | Health probes for ShadowCast, APF, Ollama, Digistore daemon (`GET /api/status/services`, Ops UI) |
| `schedules` | Background jobs: `apf_refresh`, `apf_enrich`, `sc_queue_process` (disabled by default; toggle on Ops) |
| `refresh_runs` | Local scrape outcome log (until APF exposes refresh logs — see [handoff/APF_CHANGES.md](handoff/APF_CHANGES.md)) |

## SQLite Settings (`DEFAULT_CONFIG`)

Editable via the Settings UI or `GET`/`PUT /api/config`. Secret keys are not returned in clear form on GET beyond allowlisted handling in the API.

| Key | Default |
|-----|---------|
| `shadowcast_url` | `http://localhost:8000` |
| `apf_url` | `http://localhost:3000` |
| `ollama_url` | `http://localhost:11434` |
| `internal_service_secret` | from `INTERNAL_SERVICE_SECRET` or empty |
| `default_script_model` | `llama3.1:8b` |
| `default_analysis_model` | `llama3.1:8b` |
| `default_creative_model` | `mistral:7b-instruct` |
| `heavy_reasoning_model` | `mixtral:8x7b-instruct-v0.1-q4_K_M` |
| `default_hook_types` | `curiosity` |
| `default_content_style` | `honest_review` |
| `apf_session_cookie` | empty |

## Sibling-repo requirements

1. Same `INTERNAL_SERVICE_SECRET` in:
   - `~/mission-control/backend/.env` (and/or `.service-secret` for ecosystem script sessions)
   - `~/APF/.env`
   - `~/shadowcast-/backend/.env`
2. APF: `APF_USER_ID=1` (or the user that owns scraped products) so service-key `products.list` returns data.

## Ecosystem script

`scripts/start-ecosystem.sh`:

- Defaults: `APF_HOME=~/APF`, `SC_HOME=~/shadowcast-`, `SECRET_FILE=$MC_HOME/.service-secret`
- If `INTERNAL_SERVICE_SECRET` is unset: read `SECRET_FILE` or generate a new hex secret into that file, then export for child processes

Prefer a durable matching value in each repo’s `.env` so services started outside the script still authenticate.

## Related

- [LOCAL_STACK.md](LOCAL_STACK.md) — bring-up
- [RUNBOOK.md](RUNBOOK.md) — ops checks
- [RECOVERY.md](RECOVERY.md) — restore secrets + DB
