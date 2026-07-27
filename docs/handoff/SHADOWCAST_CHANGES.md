# ShadowCast — Changes Required for Mission Control

Mission Control does **not** modify this repo. Implement the items below in `~/shadowcast-` so MC can fully control render lifecycle and auth.

## 1. Cooperative job cancel (required)

MC soft-cancels its own poller on `DELETE /api/jobs/{id}` and best-effort calls:

```http
POST /api/jobs/{job_id}/cancel
X-Service-Key: <INTERNAL_SERVICE_SECRET>
```

### Contract

**Request:** empty body (or `{}`). Path `job_id` is the ShadowCast job id returned from `POST /api/generate`.

**Response `200`:**

```json
{
  "status": "cancelled",
  "job_id": "<uuid>",
  "message": "Cancel requested"
}
```

**Response `404`:** unknown job.

**Response `409`:** job already terminal (`complete` / `partial` / `error` / `cancelled`).

### Implementation notes

1. Add a `cancelled: bool` (or `status = "cancelled"`) flag on the in-memory job record and persist it to `backend/output/{job_id}/job.json`.
2. In `_run_generation` / `_run_single_product`, check the flag **between** hook × format iterations (cooperative). An in-flight single MoviePy render may finish; do not kill mid-encode unless you already have safe interrupt hooks.
3. When cancelled, stop further hooks/formats, mark job `cancelled`, leave any partial artifacts on disk, and return that status from `GET /api/status/{job_id}`.
4. Gate the route with the same service-key middleware used for `POST /api/config` when `INTERNAL_SERVICE_SECRET` is set.

### Where MC calls it

[`mission-control/backend/main.py`](../../backend/main.py) — `delete_job` posts to `/api/jobs/{sc_job_id}/cancel` after reading `shadowcast_job_id` from `video_jobs.script_json`. Today a missing endpoint is swallowed (`shadowcast_cancel_ok: false`).

## 2. Align service-key middleware with OpenAPI (recommended)

OpenAPI documents `ServiceKeyAuth` on many routes, but runtime middleware largely allowlists non-GET job/publish/analytics routes as public. Either:

- tighten the allowlist so generate/publish/retry require `X-Service-Key` when the secret is set, **or**
- update OpenAPI to match the public allowlist.

Mission Control already sends `X-Service-Key` on generate, config, publish, and retry-missing.

## 3. Optional niceties (not blocking)

| Item | Why |
|------|-----|
| Persist `POST /api/config` LLM settings to `.env` or a config file | MC overwrites in-memory config per job |
| Expose `missing` / `missing_outputs` on `partial` status payloads | MC stores whatever you return under `status_data.missing` |
| Document `video_preset` enum (`fast`/`medium`/`best` → ffmpeg) in OpenAPI | MC forwards these strings on generate |

## Out of scope for ShadowCast

OAuth connect UI stays in ShadowCast. MC only proxies status + publish/schedule/queue.
