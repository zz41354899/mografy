# Refactoring plan

Started: 2026-10-16

Preserve the six-package architecture, browser-only scene execution, shared runtime/output effects, and the Project write queue. Keep existing public commands and player behavior compatible.

## 1. Correctness and regression coverage

- [x] Serialize asset name allocation and writes through Project.
- [x] Share runtime input identity across inspection, stills, and the player.
- [x] Trial runtime-affecting settings before writing; retain the last working configuration on failure.
- [x] Cover concurrent uploads, failed seed/audio changes, and still-cache invalidation with isolated fixtures.

## 2. Project and player responsibilities

- [x] Extract project watching, still/thumbnail resources, and export jobs behind the Project coordinator.
- [x] Separate inspector controls and playback subscriptions from App orchestration.
- [x] Model export visibility and job transitions explicitly; share progress/cancellation presentation logic.

## 3. Contracts and supporting workflows

- [x] Validate HTTP requests with shared schemas and consistent errors.
- [x] Separate CLI export transport/progress from command parsing.
- [x] Separate workspace initialization from project listing and installation state.
- [x] Isolate browser test fixtures by feature, retaining real Chromium/FFmpeg integration coverage.

## 4. Complete ownership boundaries

- [x] Move player loading, shortcuts, parameter drafts/saves, and effect drafts/saves out of App.
- [x] Split inspector tabs into parameter, effects, audio, and frame-review panels.
- [x] Separate export settings presentation, reusable choices, and per-format draft transitions from job orchestration.
- [x] Separate HTTP transport, request parsing, workspace routes, project routes, and Project/lock session lifecycle.
- [x] Separate project scaffolding and built-in initialization from read-only workspace listing.
- [x] Serialize library name allocation and recent/active-state updates; cover concurrent creation and conditional cleanup.
- [x] Bind requests to the Project captured at dispatch and scope delayed player actions to the displayed project.
- [x] Cover slow request bodies across switches, startup failure lock cleanup, idempotent shutdown, and export draft invariants.

## Initial acceptance

- [x] `pnpm check` — build/typecheck and 94 tests passed; two additional owned-CLI transport regressions passed separately (96 cases total).
- [x] `pnpm test:browser` — 17 checks passed.
- [x] Review player playback, inspector, and export states in Chromium.
- [x] Update architecture and status with the implemented boundaries and validation results.

## Completion acceptance

- [x] `pnpm check` — build/typecheck and all 105 tests passed, including real Chromium/FFmpeg integration and the delayed auto-save switch regression.
- [x] `pnpm test:browser` — all 17 Runtime browser checks passed.
- [x] Web and Server typechecks with unused locals/parameters enabled passed; `git diff --check` passed.
- [x] Visually inspect fresh 1280 × 800 player/effects/export and 390 × 844 export captures in `artifacts/refactoring-completion/`.
- [x] Rebuild Server and rerun workspace tests after preserving best-effort recent-history behavior for unavailable state directories.

All refactoring stages in this plan are complete. Distribution, Windows support, additional scene workflows, and speculative export acceleration remain separate product work tracked in STATUS.md.

## Playback comparison 

One local Chromium run compared HEAD's App with the refactored App using the same current dependencies at 1280 × 800. During a one-second playback window, App function executions fell from 60 to 0 while scene time advanced normally. The raw paused Canvas frame at one second had the same SHA-256 in both versions. This measures the shell's render subscription, not export throughput or total React work. Evidence and desktop/mobile captures are in `artifacts/refactoring/`.
