# Mission Control Runbook

## Service Summary

| Service | URL |
|---------|-----|
| Mission Control UI | `http://localhost:3100` |
| Mission Control API | `http://localhost:8100` |
| APF | `http://localhost:3000` |
| ShadowCast | `http://localhost:8000` |
| Ollama | `http://localhost:11434` |

Canonical paths: MC `/home/unloved/mission-control`, APF `~/APF`, ShadowCast `~/shadowcast-`.

## Startup

### Preferred — full ecosystem

```bash
chmod +x ~/mission-control/scripts/start-ecosystem.sh
~/mission-control/scripts/start-ecosystem.sh
```

Overrides: `APF_HOME`, `SC_HOME`, `MC_HOME`, `INTERNAL_SERVICE_SECRET`, `SECRET_FILE` (default `$MC_HOME/.service-secret`).

### Alternate — Mission Control only

Assumes APF, ShadowCast, and Ollama are already up with a matching secret.

**Backend**

```bash
cd ~/mission-control/backend
source venv/bin/activate
# Ensure backend/.env has INTERNAL_SERVICE_SECRET matching APF + ShadowCast
uvicorn main:app --host 0.0.0.0 --port 8100 --reload
```

**Frontend**

```bash
cd ~/mission-control/frontend
pnpm install
pnpm run dev -- --host 0.0.0.0 --port 3100
```

## Health Checks

```bash
curl -fsS http://localhost:8100/api/health >/dev/null
curl -fsS http://localhost:8100/api/status/services | python3 -m json.tool
curl -fsS http://localhost:3100 >/dev/null
```

`/api/status/services` should report APF, ShadowCast, and Ollama reachability as seen by MC (URLs from Settings). Offline entries mean fix that dependency first — MC health alone is not enough for orchestration.

Interactive API: `http://localhost:8100/docs`

## Daily Operations

- Confirm Settings still point at APF `:3000`, ShadowCast `:8000`, Ollama `:11434`.
- Confirm `INTERNAL_SERVICE_SECRET` matches across APF, ShadowCast, and MC (see [CONFIGURATION.md](CONFIGURATION.md)).
- Import products from APF; monitor Video Queue and activity feed for failures.
- Copy `backend/mission_control.db` before risky upgrades or weekly (see [RECOVERY.md](RECOVERY.md)).

## Stuck Jobs

Jobs left `running` / in-flight across a backend restart are auto-failed if `started_at` is older than **35 minutes**. Delete the job in the UI and re-queue if needed.

## Shutdown

- Full stack started via `start-ecosystem.sh`: stop that terminal / process group (`Ctrl+C`).
- MC-only: stop frontend and backend terminals (`Ctrl+C`).

## Common Failures

| Symptom | Fix |
|---------|-----|
| APF / ShadowCast offline in status | Start those services first (`~/APF`, `~/shadowcast-/backend`) |
| 401/403 on import or generate | Align `INTERNAL_SERVICE_SECRET` in all three repos (and `.service-secret` if using the ecosystem script) |
| Import returns empty | Matching secret + `APF_USER_ID=1` on APF; APF must actually have products |
| `:3000` is not APF | Port conflict (e.g. Open WebUI); free the port or retarget APF / MC Settings |
| Frontend port conflict | Move Vite to a free port; update docs if the change is permanent |
| Job stuck | Wait for 35-minute auto-fail, or delete and re-queue |

Full bring-up and smoke: [LOCAL_STACK.md](LOCAL_STACK.md), [SMOKE_TEST.md](SMOKE_TEST.md).
