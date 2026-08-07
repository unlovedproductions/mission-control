# Changelog

All notable changes to Mission Control are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Publish UI: postable **variants**, multi-platform batch, schedule datetime (ShadowCast contracts)
- Calendar **Mark published** wired to ShadowCast schedule/publish
- Ninth APF marketplace: `rakuten`
- Job cancel honesty: surface ShadowCast cancel success/failure; poller maps `cancelled`/`cancelling`

### Changed

- ShadowCast cancel path fixed to `POST /api/cancel/{job_id}` (was wrong `/api/jobs/{id}/cancel`)
- Publish proxies aligned with SC `hook_type` / `platforms[]` / `scheduled_time`
- Docs/handoffs updated for live APF (9 markets; 3 tRPC gaps remain) and ShadowCast cancel/publish alignment
- Ops/Products UI labels for APF stopgaps (daemon probe, local refresh_runs, enrich fire-and-forget)

### Added (prior)

- Command-center surfaces: APF enrich/bookmarks/daemon/refresh-runs, ShadowCast readiness/TTS/preset/partial/retry/audit, Publish + Ops pages, service registry, scheduler, optional `MC_DASHBOARD_TOKEN`
- Child-app handoffs: `docs/handoff/SHADOWCAST_CHANGES.md`, `docs/handoff/APF_CHANGES.md`
- `docs/CONFIGURATION.md` — single reference for env vars and SQLite Settings
- `CHANGELOG.md`

### Changed (prior)

- README, runbook, recovery, architecture, and local-stack docs aligned on pnpm, canonical paths (`~/APF`, `~/shadowcast-`), dual secret wiring (`.env` + `.service-secret`), and ecosystem script bring-up
- Full APF marketplace credentials in Products/Settings

## [2026-07-22]

### Added

- Ecosystem smoke preflight results logged in `docs/SMOKE_TEST.md` (`f00661d`)

### Changed

- Orchestration layer hardened; frontend/APF tooling standardized on pnpm (`84a5f9f`)

## [2026-07-09]

### Fixed

- Define `_recover_stuck_jobs` before `init_db()` module call (PR #2, `ef85f0e`)

### Added

- Recovery, runbook, and architecture guides under `docs/` (`8fd7afe`)

## [2026-07]

### Added

- APF and ShadowCast pipeline integration: import, enrichment forwarding, video job options, refuse thin APF imports (`436c3ee`, `48bc1ac`, `a04bbac`, and related)
- Local ecosystem bring-up script and wiring (`f07a4eb`, `22d90f4`)
- `INTERNAL_SERVICE_SECRET` read from environment (`9f45efb`)

### Changed

- Default APF URL targeting for real local app reachability (`22d90f4`)
- Local pnpm setup and repo hygiene (`2c7e0ca`, `1a40d59`, `bb30da6`)
