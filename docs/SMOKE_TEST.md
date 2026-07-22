# Ecosystem Smoke Test

Run after starting the stack ([LOCAL_STACK.md](LOCAL_STACK.md)). Record pass/fail and date.

## 0. Preflight

```bash
export INTERNAL_SERVICE_SECRET="$(grep INTERNAL_SERVICE_SECRET ~/mission-control/backend/.env 2>/dev/null | cut -d= -f2-)"
test -n "$INTERNAL_SERVICE_SECRET" || echo "WARN: set INTERNAL_SERVICE_SECRET in all three repos"
```

## 1. Health

```bash
curl -sf localhost:3000/api/health && echo " APF OK"
curl -sf localhost:8000/api/health && echo " ShadowCast OK"
curl -sf localhost:8100/api/health && echo " MC OK"
curl -sf localhost:8100/api/status/services | python3 -m json.tool
```

Expected: APF, ShadowCast, Ollama reported in MC status (Ollama optional for connectivity-only smoke).

## 2. MC → APF import

From Mission Control UI: **Products → Import** (clickbank or digistore24), or:

```bash
curl -sf -X POST localhost:8100/api/products/import \
  -H 'Content-Type: application/json' \
  -d '{"marketplace":"clickbank","limit":5}' | python3 -m json.tool
```

Expected: `imported` + `updated` counts; products visible with enrichment fields when APF has data.

## 3. MC → ShadowCast job (requires Ollama)

1. Approve one enriched product in UI
2. **Create Video Job** — pick hooks, style, short/both
3. Watch **Video Queue** until `completed` or clear error

Expected: download links open from Jobs detail modal.

## 4. Secret alignment

If import or generate returns 401/403:

```bash
grep INTERNAL_SERVICE_SECRET ~/APF/.env ~/shadowcast-/backend/.env ~/mission-control/backend/.env
```

All three values must match.

## Results log

| Step | Date | Pass/Fail | Notes |
|------|------|-----------|-------|
| Health | 2026-07-20 | Partial | MC :8100 offline; APF :3000 responded (non-JSON on this host); SC :8000 offline |
| Import | 2026-07-20 | Not run | Requires APF + MC backend up with matching secret |
| Job | 2026-07-20 | Not run | Requires Ollama + ShadowCast |
| Secret | 2026-07-20 | Manual | `grep INTERNAL_SERVICE_SECRET` across three `.env` files |
