# Local Stack — APF + ShadowCast + Mission Control

Canonical Mission Control repo: `/home/unloved/mission-control` (not `shadowcast-/mission-control`).

## Ports

| Service | Port |
|---------|------|
| APF | 3000 |
| ShadowCast | 8000 |
| Mission Control API | 8100 |
| Mission Control UI | 3100 |
| Ollama | 11434 |
| MySQL (APF) | 3306 |

## One-time setup

1. **MySQL:** `docker start apf-mysql` (or local MySQL per APF `SETUP` docs)
2. **APF:** `cd ~/APF && pnpm install && pnpm db:push`
3. **ShadowCast:** `cd ~/shadowcast-/backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
4. **Mission Control backend:** `cd ~/mission-control/backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
5. **Mission Control frontend:** `cd ~/mission-control/frontend && pnpm install`
6. **Shared secret:** copy `backend/.env.example` → `backend/.env` and set the same `INTERNAL_SERVICE_SECRET` in APF `.env` and ShadowCast `backend/.env`

## Daily startup

```bash
chmod +x ~/mission-control/scripts/start-ecosystem.sh
~/mission-control/scripts/start-ecosystem.sh
```

Or use Desktop launchers under `~/.local/bin/unloved-launchers/` if configured.

Open **http://localhost:3100**

## Smoke checklist

See [SMOKE_TEST.md](SMOKE_TEST.md).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| APF import returns empty | Match `INTERNAL_SERVICE_SECRET`; ensure `APF_USER_ID=1` in APF |
| ShadowCast offline | Start `python app.py` in `shadowcast-/backend` |
| Job stuck after MC restart | Stuck jobs auto-fail after 35 minutes; delete and re-queue |
| Settings reset broke URLs | Reset uses `:8000` / `:3000` defaults |

Mission Control is **local-first**. Do not deploy the backend to serverless hosts (SQLite + long polling).
