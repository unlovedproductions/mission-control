# Mission Control Architecture

## Intent

Mission Control is an orchestration layer above APF and ShadowCast. It does not rewrite those systems; it coordinates them via HTTP APIs and uses Ollama for local LLM work.

## Component diagram

```
┌─────────────────────────────────────────────┐
│            Mission Control                   │
│  React/Vite (:3100)  ──▶  FastAPI (:8100)   │
│                              │               │
│                     SQLite (mission_control.db)
└──────────────────────────────┼───────────────┘
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ShadowCast (:8000)     APF (:3000)         Ollama (:11434)
```

## Components

| Piece | Location | Role |
|-------|----------|------|
| Frontend | `frontend/` | Dashboard UI (products, jobs, calendar, models, settings) |
| Backend | `backend/main.py` | FastAPI orchestration, polling, persistence |
| DB | `backend/mission_control.db` | Local SQLite (WAL) |

## Persistence (high level)

| Table | Role |
|-------|------|
| `config` | Settings key/value (URLs, models, hooks/style, secret) |
| `products` | Imported/enriched affiliate products and review state |
| `video_jobs` | ShadowCast job tracking (paths, status, errors); status includes `partial` |
| `calendar_events` | Publish schedule (`shadowcast_job_id`, `publish_target`) |
| `activity_log` | Operator-facing activity feed |
| `services` | Health registry (ShadowCast, APF, Ollama, Digistore daemon) |
| `schedules` | Background `apf_refresh` / `apf_enrich` / `sc_queue_process` |
| `refresh_runs` | Local scrape outcomes |

## Auth

- Machine-to-machine calls to APF and ShadowCast send `X-Service-Key` when an internal service secret is configured.
- Secret sources: `INTERNAL_SERVICE_SECRET` env / `backend/.env`, optional `.service-secret` via `start-ecosystem.sh`, and SQLite `config.internal_service_secret` (seeded from env when empty).
- Optional operator gate: `MC_DASHBOARD_TOKEN` — when set, frontend unlock screen + `X-Dashboard-Token` on `/api` (except `/api/health`, `/api/auth/*`).
- See [CONFIGURATION.md](CONFIGURATION.md).

## Core orchestration sequence

1. **Import** — MC pulls products from APF (list + enrichment / ShadowCast payload), upserts into `products`.
2. **Review / approve** — Operator reviews enrichment; sets product status; may queue APF enrichment / bookmarks.
3. **Queue job** — MC checks ShadowCast readiness, configures LLM options, calls generate (preset/TTS); creates `video_jobs` row.
4. **Poll** — Backend tracks job status including `partial`; stuck in-flight jobs older than 35 minutes are auto-failed on init. Delete soft-cancels MC and best-effort calls ShadowCast cancel (see [handoff/SHADOWCAST_CHANGES.md](handoff/SHADOWCAST_CHANGES.md)).
5. **Calendar / publish** — Completed work can be scheduled; marking calendar `published` calls ShadowCast schedule/publish.

## External integrations

- **APF** — product import, scrape/refresh, credentials (8 markets), enrich queue, bookmarks, Digistore daemon probe
- **ShadowCast** — hooks, content styles, generate/job execution, readiness, TTS, audit/retry, publish/OAuth proxies, analytics
- **Ollama** — model list/pull/running; analysis and script defaults in Settings

## Operational constraints

- Does **not** modify APF or ShadowCast codebases. Required child-app APIs are specified under [handoff/](handoff/).
- Shared `INTERNAL_SERVICE_SECRET` must match across all three repos.
- Dashboard accuracy depends on APF / ShadowCast / Ollama uptime.
- **Local-first:** SQLite + long polling — not suitable for serverless deploy.
- Set `MC_DASHBOARD_TOKEN` before using Publish against live OAuth accounts.

## Related docs

- [RUNBOOK.md](RUNBOOK.md) — day-to-day ops
- [LOCAL_STACK.md](LOCAL_STACK.md) — triple-repo bring-up
- [RECOVERY.md](RECOVERY.md) — restore paths
- [handoff/SHADOWCAST_CHANGES.md](handoff/SHADOWCAST_CHANGES.md) — ShadowCast cancel + auth alignment
- [handoff/APF_CHANGES.md](handoff/APF_CHANGES.md) — refresh logs, daemon session, enrichment queue status
