# Mission Control Recovery Guide

## 1) Purpose
Mission Control orchestrates APF, ShadowCast, and Ollama from a single operations dashboard.

## 2) Source Of Truth
- Repository: `https://github.com/unlovedproductions/mission-control`
- Default branch: `main`
- Local root: `/home/unloved/mission-control`

## 3) Dependencies
- Backend: Python 3.10+, FastAPI, Uvicorn
- Frontend: Node.js + Vite app (port 3100)
- Backend API port: 8100
- External services:
  - APF (`http://localhost:3000`)
  - ShadowCast (`http://localhost:8000`)
  - Ollama (`http://localhost:11434`)

## 4) Secrets Inventory (names only)
- `INTERNAL_SERVICE_SECRET` (must align across APF, ShadowCast, Mission Control)

## 5) Data To Back Up
- `backend/mission_control.db` (SQLite state)
- Optional local secret material used by startup scripts (for example generated local secret files)

## 6) Recovery A: New Machine
1. Clone repository.
2. Backend setup:
   - `cd backend`
   - `python3 -m venv venv`
   - `source venv/bin/activate`
   - `pip install -r requirements.txt`
3. Frontend setup:
   - `cd ../frontend`
   - `pnpm install`
4. Ensure APF, ShadowCast, and Ollama are reachable.
5. Set `INTERNAL_SERVICE_SECRET` to the shared value.
6. Start backend:
   - `uvicorn main:app --host 0.0.0.0 --port 8100 --reload`
7. Start frontend:
   - `pnpm run dev -- --host 0.0.0.0 --port 3100`

## 7) Recovery B: Corrupted Working Tree
1. Inspect and stash if needed:
   - `git status`
   - `git stash push -u`
2. Reset:
   - `git fetch origin`
   - `git checkout main`
   - `git reset --hard origin/main`
3. Reinstall backend/frontend dependencies.

## 8) Recovery C: Database Loss
1. Stop backend.
2. Restore `backend/mission_control.db` from backup, or let app recreate a new empty DB.
3. Re-import products from APF and rebuild queue/calendar state as needed.

## 9) Verification Checklist
- `curl -fsS http://localhost:8100/api/health >/dev/null`
- `curl -fsS http://localhost:8100/api/status/services >/dev/null`
- `curl -fsS http://localhost:3100 >/dev/null`

## 10) Stack Dependencies
- Requires APF + ShadowCast + Ollama to achieve full orchestration behavior.
- Shared secret mismatch will break APF/ShadowCast machine-to-machine calls.

## 11) Last Verified
- Date: 2026-07-09
- Commit: `41ad1f5`
