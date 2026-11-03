# Mission Control Recovery Guide

## 1) Purpose

Mission Control orchestrates APF, ShadowCast, and Ollama from a single operations dashboard. This guide restores the MC repo, secrets alignment, and SQLite state.

## 2) Source Of Truth

- Repository: `https://github.com/unlovedproductions/mission-control`
- Default branch: `main`
- Local root: `/home/unloved/mission-control`
- Sibling apps: `~/APF`, `~/shadowcast-`

## 3) Dependencies

- Backend: Python 3.10+, FastAPI, Uvicorn (port **8100**)
- Frontend: Node.js 18+, **pnpm**, Vite (port **3100**)
- External services:
  - APF (`http://localhost:3000`)
  - ShadowCast (`http://localhost:8000`)
  - Ollama (`http://localhost:11434`)

## 4) Secrets Inventory (names only)

- `INTERNAL_SERVICE_SECRET` — must match APF, ShadowCast, and Mission Control
- Local files (do not commit):
  - `backend/.env` (from `backend/.env.example`)
  - `.service-secret` at MC root (used by `scripts/start-ecosystem.sh` when env is unset)

## 5) Data To Back Up

| Path | Why |
|------|-----|
| `backend/mission_control.db` | Products, jobs, calendar, activity, Settings |
| `backend/.env` | Local secret / optional overrides |
| `.service-secret` | Ecosystem-script session secret (if used) |

**Cadence:** copy `mission_control.db` (and secret files) before risky upgrades, DB experiments, or at least weekly.

## 6) Recovery A: New Machine

1. Clone repository into `/home/unloved/mission-control` (or your chosen root).
2. Backend:
   - `cd backend`
   - `python3 -m venv venv`
   - `source venv/bin/activate`
   - `pip install -r requirements.txt`
   - `cp .env.example .env` and set `INTERNAL_SERVICE_SECRET` to the shared value
3. Frontend:
   - `cd ../frontend`
   - `pnpm install`
4. Ensure APF, ShadowCast, and Ollama are reachable; secret must match in their env files.
5. Start (either):
   - Full stack: `./scripts/start-ecosystem.sh`
   - Or MC only: `uvicorn main:app --host 0.0.0.0 --port 8100 --reload` then `pnpm run dev -- --host 0.0.0.0 --port 3100` in `frontend/`

## 7) Recovery B: Corrupted Working Tree

1. Inspect and stash if needed:
   - `git status`
   - `git stash push -u`
2. Reset:
   - `git fetch origin`
   - `git checkout main`
   - `git reset --hard origin/main`
3. Reinstall backend/frontend dependencies (`pip install -r requirements.txt`, `pnpm install`).
4. Restore `backend/.env` / `.service-secret` from backup if wiped.

## 8) Recovery C: Database Loss

1. Stop the backend.
2. Restore `backend/mission_control.db` from backup, **or** let the app recreate an empty DB on next start.
3. If empty DB: re-import products from APF; rebuild queue/calendar as needed.
4. Confirm Settings URLs and that the secret is present (env seed or Settings UI).

## 9) Verification Checklist

```bash
curl -fsS http://localhost:8100/api/health >/dev/null
curl -fsS http://localhost:8100/api/status/services | python3 -m json.tool
curl -fsS http://localhost:3100 >/dev/null
```

Then run the import/job steps in [SMOKE_TEST.md](SMOKE_TEST.md) when the full stack is up.

## 10) Stack Dependencies

- Full orchestration requires APF + ShadowCast + Ollama.
- Shared secret mismatch breaks APF/ShadowCast machine-to-machine calls (`X-Service-Key`).
- Mission Control is **local-first** (SQLite + long polling); do not serverless-deploy the backend.

## 11) Last Verified

- Date: 2026-08-06
- Commit: sibling-sync (ShadowCast cancel/publish alignment + APF 9 markets; see CHANGELOG Unreleased)
