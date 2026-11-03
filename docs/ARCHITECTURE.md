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
                              │
                              └─ Digistore daemon (:3219) [direct probe stopgap]
```

## Components

| Piece | Location | Role |
|-------|----------|------|
| Frontend | `frontend/` | Products, Jobs, Calendar, Publish, Ops, Analytics, Models, Settings |
| Backend core | `backend/main.py` | FastAPI orchestration, products/jobs/calendar, polling |
| APF control | `backend/apf_control.py` | Enrich, bookmarks, daemon probe, marketplaces, refresh_runs |
| ShadowCast control | `backend/shadowcast_control.py` | Readiness, TTS, retry-missing, audit, files |
| Publish control | `backend/publish_control.py` | OAuth, postable, publish/batch, social schedule/queue, SC analytics |
| Ops control | `backend/ops_control.py` | Service registry, schedules, overview |
| Scheduler | `backend/scheduler.py` | Background APF refresh/enrich + SC queue process |
| DB | `backend/mission_control.db` | Local SQLite (WAL) |

## Persistence (high level)

| Table | Role |
|-------|------|
| `config` | Settings key/value (URLs, models, hooks/style, secret) |
| `products` | Imported/enriched affiliate products and review state |
| `video_jobs` | ShadowCast job tracking; status includes `partial`, `cancelled` |
| `calendar_events` | Publish schedule (`shadowcast_job_id`, `publish_target`) |
| `activity_log` | Operator-facing activity feed |
| `services` | Health registry (ShadowCast, APF, Ollama, Digistore daemon) |
| `schedules` | Background `apf_refresh` / `apf_enrich` / `sc_queue_process` |
| `refresh_runs` | Local scrape outcomes (until APF `products.refreshLogs`) |

## Auth

- Machine-to-machine calls to APF and ShadowCast send `X-Service-Key` when an internal service secret is configured.
- Secret sources: `INTERNAL_SERVICE_SECRET` env / `backend/.env`, optional `.service-secret` via `start-ecosystem.sh`, and SQLite `config.internal_service_secret` (seeded from env when empty).
- Optional operator gate: `MC_DASHBOARD_TOKEN` — when set, frontend unlock screen + `X-Dashboard-Token` on `/api` (except `/api/health`, `/api/auth/*`).
- See [CONFIGURATION.md](CONFIGURATION.md).

## Core orchestration sequence

1. **Import** — MC pulls products from APF (9 marketplaces), upserts into `products`.
2. **Review / approve** — Operator reviews enrichment; may queue APF enrichment / bookmarks (queue depth not visible until APF ships enrichment APIs).
3. **Queue job** — MC checks ShadowCast readiness, configures LLM options, calls generate (preset/TTS); creates `video_jobs` row.
4. **Poll** — Tracks `complete`/`partial`/`cancelled`/`error`; stuck jobs older than 35 minutes auto-fail. Delete soft-cancels MC and calls ShadowCast `POST /api/cancel/{id}`.
5. **Calendar / publish** — Schedule to calendar; **Mark published** uses ShadowCast `social/schedule` then `/api/publish` with postable variant metadata. Publish page drives variants → publish / batch platforms / schedule / queue process.

## External integrations

- **APF** — product import, scrape/refresh, credentials (9 markets), enrich queue (fire-and-forget), bookmarks, Digistore daemon probe at `:3219`
- **ShadowCast** — hooks, styles, generate, readiness, TTS, cancel, audit/retry, postable variants, publish/schedule/queue, analytics
- **Ollama** — model list/pull/running; analysis and script defaults in Settings

## Operational constraints

- Does **not** modify APF or ShadowCast codebases. Remaining child-app gaps: [handoff/](handoff/).
- Shared `INTERNAL_SERVICE_SECRET` must match across all three repos.
- Dashboard accuracy depends on APF / ShadowCast / Ollama uptime.
- **Local-first:** SQLite + long polling — not suitable for serverless deploy.
- Set `MC_DASHBOARD_TOKEN` before using Publish against live OAuth accounts.

## Related docs

- [RUNBOOK.md](RUNBOOK.md) — day-to-day ops
- [LOCAL_STACK.md](LOCAL_STACK.md) — triple-repo bring-up
- [RECOVERY.md](RECOVERY.md) — restore paths
- [handoff/SHADOWCAST_CHANGES.md](handoff/SHADOWCAST_CHANGES.md) — SC cancel + publish contracts
- [handoff/APF_CHANGES.md](handoff/APF_CHANGES.md) — refresh logs, daemon session, enrichment queue status
