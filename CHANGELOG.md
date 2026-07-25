# Changelog

All notable changes to Mission Control are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- `docs/CONFIGURATION.md` — single reference for env vars and SQLite Settings
- `CHANGELOG.md`

### Changed

- README, runbook, recovery, architecture, and local-stack docs aligned on pnpm, canonical paths (`~/APF`, `~/shadowcast-`), dual secret wiring (`.env` + `.service-secret`), and ecosystem script bring-up

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
