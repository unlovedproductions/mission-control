# Mission Control Runbook

## Service Summary
- Frontend URL: `http://localhost:3100`
- Backend URL: `http://localhost:8100`
- External dependency targets:
  - APF `http://localhost:3000`
  - ShadowCast `http://localhost:8000`
  - Ollama `http://localhost:11434`

## Startup
### Backend
```bash
cd backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```

### Frontend
```bash
cd frontend
pnpm install
pnpm run dev -- --host 0.0.0.0 --port 3100
```

## Health Checks
- Backend:
  - `curl -fsS http://localhost:8100/api/health >/dev/null`
- Service graph:
  - `curl -fsS http://localhost:8100/api/status/services >/dev/null`
- Frontend:
  - `curl -fsS http://localhost:3100 >/dev/null`

## Daily Operations
- Verify settings still point to APF/ShadowCast/Ollama defaults.
- Import products from APF and monitor queue status.
- Review activity feed for failed jobs.

## Shutdown
- Stop frontend/backend terminals (`Ctrl+C`).

## Common Failures
- APF/ShadowCast offline: restart those services first.
- Shared secret mismatch: align `INTERNAL_SERVICE_SECRET` across repos.
- Frontend port conflict: move Vite to a free port and update docs/settings.
