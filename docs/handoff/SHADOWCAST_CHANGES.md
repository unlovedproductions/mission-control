# ShadowCast — Alignment with Mission Control

Mission Control does **not** modify this repo. This document tracks ShadowCast contracts MC depends on.

## 1. Cooperative job cancel — ALIGNED

ShadowCast exposes:

```http
POST /api/cancel/{job_id}
```

Mission Control `DELETE /api/jobs/{id}` soft-cancels its poller and best-effort calls that route (not `/api/jobs/{id}/cancel`).

**Response `200` examples:**

```json
{ "job_id": "<uuid>", "status": "cancelling", "message": "Cancel requested. Worker stops at the next checkpoint." }
```

or terminal:

```json
{ "job_id": "<uuid>", "status": "complete|cancelled|error", "message": "Job is not running" }
```

**`404`:** unknown job.

MC treats HTTP 200/201/204 as `shadowcast_cancel_ok: true` and surfaces failures in the Jobs UI.

Job statuses MC maps: `running` → in progress; `complete` → `completed`; `partial` → `partial`; `cancelled`/`cancelling` → `cancelled`; `error` → failed.

## 2. Publish / schedule contracts — ALIGNED (MC side)

| ShadowCast route | Required fields MC sends |
|------------------|--------------------------|
| `POST /api/publish` | `job_id`, `hook_type`, `platform`, `video_format`, optional `product_slug`, `dry_run` |
| `POST /api/publish/batch` | `job_id`, `hook_type`, `platforms[]`, `video_format` (one variant → many platforms) |
| `POST /api/social/schedule` | `platform`, `scheduled_time`, optional `job_id`/`hook_type`/`video_format`/`caption`/`hashtags` |
| `GET /api/jobs/postable` | Returns jobs with `variants[]` (hook/format/slug) used by Publish UI |

Connect OAuth in ShadowCast UI. Set `MC_DASHBOARD_TOKEN` before live Publish.

## 3. Align service-key middleware with OpenAPI (recommended)

OpenAPI documents `ServiceKeyAuth` on many routes, but runtime middleware largely allowlists non-GET job/publish/analytics routes as public (`backend/auth_public_routes.py`). Either:

- tighten the allowlist so generate/publish/retry require `X-Service-Key` when the secret is set, **or**
- update OpenAPI to match the public allowlist.

Mission Control already sends `X-Service-Key` on generate, config, publish, cancel, and retry-missing.

## 4. Optional niceties (not blocking)

| Item | Why |
|------|-----|
| Persist `POST /api/config` LLM settings to `.env` or a config file | MC overwrites in-memory config per job |
| Expose `missing` / `missing_outputs` on `partial` status payloads | MC stores whatever you return under `status_data.missing` |
| Document `video_preset` enum (`fast`/`medium`/`best` → ffmpeg) in OpenAPI | MC forwards these strings on generate |

## Out of scope for ShadowCast

OAuth connect UI stays in ShadowCast. MC proxies status + publish/schedule/queue/process.
