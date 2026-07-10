# Mission Control Architecture

## Intent
Mission Control is an orchestration layer above APF and ShadowCast. It does not rewrite those systems; it coordinates them.

## Components
- Frontend: React + Vite app (`frontend`, port 3100)
- Backend: FastAPI service (`backend/main.py`, port 8100)
- Local persistence: SQLite (`backend/mission_control.db`)

## External Integrations
- APF APIs for product import and status
- ShadowCast APIs for hooks/styles/job execution
- Ollama API for local model operations

## Core Flows
1. Import products from APF.
2. Review and approve products in Mission Control.
3. Queue jobs for ShadowCast rendering.
4. Track outputs and schedule content.

## Operational Constraints
- Shared `INTERNAL_SERVICE_SECRET` must match across APF, ShadowCast, and Mission Control.
- Full dashboard accuracy depends on APF/ShadowCast/Ollama uptime.
