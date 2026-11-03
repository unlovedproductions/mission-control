# APF — Changes Required for Mission Control

Mission Control does **not** modify this repo. Implement the items below in `~/APF` so MC can stop guessing at scrape/enrichment health.

MC already drives (via `X-Service-Key`): `products.list|search|refresh|shadowCastPayload|queueEnrichment|getDetail`, `credentials.*`, `bookmarks.*`, and probes Digistore daemon `http://127.0.0.1:3219/health` directly.

**Marketplaces (APF `PLATFORM_VALUES`, 9):** `warriorplus`, `digistore24`, `clickbank`, `shareasale`, `cj`, `awin`, `impact`, `amazon`, `rakuten`.

Still missing as of 2026-08 (verified against `~/APF`): `products.refreshLogs`, `system.digistoreDaemon`, `products.enrichmentQueue` / `enrichmentStatus`.

## 1. Refresh history reader (required)

`data_refresh_logs` is written during `products.refresh` but has no tRPC reader. MC keeps a local `refresh_runs` table as a stopgap.

### Proposed procedure

```ts
products.refreshLogs: protectedProcedure
  .input(z.object({
    platform: z.string().optional(),
    limit: z.number().min(1).max(100).default(20),
  }))
  .query(...)
```

**Output (array):**

```json
[
  {
    "id": 1,
    "platform": "clickbank",
    "startedAt": "2026-07-25T12:00:00.000Z",
    "finishedAt": "2026-07-25T12:04:00.000Z",
    "status": "ok",
    "productsCount": 42,
    "errorMessage": null
  }
]
```

Also useful: `products.lastRefresh` → latest row per platform.

Once shipped, MC will prefer these over local `refresh_runs`.

## 2. Digistore daemon / session status over APF HTTP (required)

Daemon lives on `127.0.0.1:3219` and is opaque when scrape fails. Surfacing it through APF avoids MC hardcoding the daemon port forever.

### Proposed procedure

```ts
system.digistoreDaemon: protectedProcedure.query(...)
```

**Output:**

```json
{
  "reachable": true,
  "url": "http://127.0.0.1:3219",
  "health": { "...": "daemon /health body" },
  "sessionValid": true,
  "lastError": null
}
```

`sessionValid` should reflect whether the Firefox profile still has a usable Digistore login (however APF already detects that today).

Optional mutations (nice-to-have): `system.digistoreOpen`, `system.digistoreShutdown` wrapping existing daemon client scripts.

## 3. Enrichment queue status (required)

`products.queueEnrichment` exists; operators cannot see queue depth or per-product job state without CLI (`review:status`).

### Proposed procedures

```ts
products.enrichmentQueue: protectedProcedure
  .input(z.object({
    status: z.enum(["queued","running","complete","failed"]).optional(),
    limit: z.number().default(50),
  }))
  .query(...)

products.enrichmentStatus: protectedProcedure
  .input(z.object({ productIds: z.array(z.number()).optional() }))
  .query(...)
```

**Queue item shape:**

```json
{
  "productId": 123,
  "status": "queued",
  "attempts": 1,
  "nextRunAt": "...",
  "errorMessage": null,
  "briefStatus": "pending"
}
```

Wire to `review_enrichment_jobs` + `product_review_briefs`.

## 4. Optional

| Item | Why |
|------|-----|
| `products.refresh` progress / cancel | Digistore refresh can block ~15m |
| Affiliate link quality field on list/detail (`generated` vs `approved`) | Quality gate before MC import |
| Rate-limit header or batch `shadowCastPayload` | MC import hammers per-product payload fetches |

## Auth reminder

All new procedures must work under `X-Service-Key` → impersonated `APF_USER_ID` (default `1`), same as existing protected routes.
