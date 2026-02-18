# PRD: Spectator Autonomous Self-Checking Loop (TDD)

## Overview

- Feature: Build a deterministic, self-checking TDD loop for spectator entry and world-map readiness.
- Status: Draft v1
- Owner: Game Client (Onboarding + Navigation + Three)
- Created: 2026-02-18
- Last Updated: 2026-02-18

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                 |
| ------ | ---------------- | ------ | ---------------------------------------------------------------------- |
| U1     | 2026-02-18 00:00 | Codex  | Initial PRD with autonomous spectator test loop, milestones, and gates. |

## Executive Summary

Spectator behavior is implemented across onboarding, store state, navigation, loading overlay, and worldmap rendering.
Today we have utility-level tests around loading helpers, but no end-to-end autonomous validation that:

1. boots the game,
2. enters spectator mode,
3. reaches stable worldmap rendering, and
4. fails fast with actionable artifacts when regressions occur.

This PRD defines a strict red-green-refactor program and a self-checking execution loop that can run locally and in CI.

## Problem Statement

Current spectator behavior can regress without immediate detection because the critical path crosses multiple modules with
limited cross-module tests:

1. Spectator state resolution and fallback selection.
2. Route transitions and structure-sync-driven navigation.
3. Overlay dismissal timing tied to `LoadingStateKey.Map`.
4. Worldmap readiness after entering spectator mode.

Without an autonomous browser check, regressions are often discovered manually.

## Current Findings

### F1: Spectator state transitions exist but are not directly unit-tested

Relevant code:

1. `client/apps/game/src/hooks/store/use-realm-store.ts`
2. `client/apps/game/src/dojo/sync.ts:336`

Gap:

1. No direct test coverage for `setStructureEntityId(..., { spectator: true })`, startup spectator recovery, or
   `exitSpectatorMode`.

### F2: Spectator navigation path is behavior-rich and untested

Relevant code:

1. `client/apps/game/src/hooks/helpers/use-navigate.ts:109`
2. `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx:919`

Gap:

1. No tests proving correct route + state handoff when entering spectator flow from onboarding/game entry.

### F3: Spectator loading overlay behavior is timing-sensitive and only partially covered

Relevant code:

1. `client/apps/game/src/ui/layouts/game-loading-overlay.tsx:101`
2. `client/apps/game/src/ui/layouts/game-loading-overlay.utils.test.ts`

Gap:

1. Utility tests exist, but overlay component spectator flow is not verified through integration behavior.

### F4: No autonomous browser test stack currently wired for spectator flow

Current state:

1. No Playwright/Cypress config in repository root or `client/apps/game`.
2. No scripted end-to-end run that enters spectator and verifies worldmap-ready outcomes.

## Goals

1. Create deterministic tests for spectator state and navigation policies.
2. Add integration tests for spectator overlay flow with fake timers and controlled loading-state transitions.
3. Add autonomous browser tests that boot app, enter spectator mode, and verify readiness outcomes.
4. Provide one self-check command that executes gates, collects artifacts, and classifies failures.
5. Enforce strict TDD for every slice (RED -> GREEN -> REFACTOR).

## Non-Goals

1. Redesign spectator UX or visual style.
2. Rewrite Three.js worldmap architecture.
3. Expand into unrelated onboarding/account flows beyond spectator path.

## Scope

### In Scope

1. `client/apps/game/src/hooks/store/use-realm-store.ts`
2. `client/apps/game/src/hooks/helpers/use-navigate.ts`
3. `client/apps/game/src/ui/layouts/game-loading-overlay.tsx`
4. `client/apps/game/src/dojo/sync.ts` (only spectator selection logic seams)
5. `client/apps/game/src/ui/features/landing/components/game-entry-modal.tsx` (spectator entry contract)
6. New test suites:
   1. `client/apps/game/src/hooks/store/use-realm-store.test.ts`
   2. `client/apps/game/src/hooks/helpers/use-navigate.spectator.test.ts`
   3. `client/apps/game/src/ui/layouts/game-loading-overlay.spectator.test.tsx`
   4. `client/apps/game/e2e/spectator/*.spec.ts` (new)
7. Self-check orchestration script(s) under `client/apps/game/scripts/` (new).

### Out of Scope

1. Chain/indexer reliability fixes.
2. Settlement creation flows.
3. Performance tuning not required for spectator correctness gates.

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                           | Priority |
| ---- | ----------------------------------------------------------------------------------------------------- | -------- |
| FR-1 | Entering spectator mode sets `isSpectating=true` and preserves worldmap return coordinates.          | P0       |
| FR-2 | Startup selection picks owned realm when available, otherwise first global structure as spectator.   | P0       |
| FR-3 | `exitSpectatorMode()` restores last controlled structure deterministically.                            | P0       |
| FR-4 | Spectator overlay dismisses only after map loading transition (`true -> false`) plus post-load delay. | P0       |
| FR-5 | Spectator entry from game-entry flow always lands on map route (`/play/map?...&spectate=true`).      | P0       |
| FR-6 | Autonomous browser run can enter spectator without manual input and verify worldmap readiness.        | P0       |
| FR-7 | Self-check loop retries once only for recognized flaky signatures, otherwise fails immediately.       | P1       |
| FR-8 | Self-check loop emits artifacts (logs, screenshot, trace) on failure.                                 | P1       |
| FR-9 | Every production change in this scope is introduced via failing-first tests.                          | P0       |

### Non-Functional Requirements

| ID    | Requirement                                                           | Priority |
| ----- | --------------------------------------------------------------------- | -------- |
| NFR-1 | Full self-check loop target runtime <= 10 minutes on CI workers.      | P1       |
| NFR-2 | Flake rate for spectator browser suite < 2% across 50 runs.           | P1       |
| NFR-3 | Tests must be deterministic (fake timers/mocked boundaries where possible). | P0       |
| NFR-4 | Failures must be classified into infra vs regression with clear output. | P1       |

## Self-Checking Loop Architecture

### Layer A: Pure Unit Policy Gates

Target:

1. Realm spectator state transitions
2. Navigation decision helpers
3. Sync spectator selection policy seams

Purpose:

1. Fast, deterministic red/green cycles.

### Layer B: Component/Integration Gates

Target:

1. `GameLoadingOverlay` spectator path and timeout semantics.

Purpose:

1. Validate React + store wiring without full browser harness.

### Layer C: Autonomous Browser Spectator Gate

Target:

1. Boot app
2. Enter spectator path
3. Wait for overlay progression and worldmap-ready signals
4. Assert route, canvas presence, and overlay dismissal

Purpose:

1. Catch cross-layer regressions missed by unit/integration tests.

### Layer D: Orchestrated Self-Check Runner

Target:

1. Execute Layer A -> B -> C in order.
2. Stop early on non-flaky failures.
3. Retry recognized flaky signatures once.
4. Archive artifacts.

Purpose:

1. Provide a single command for local and CI confidence.

## TDD Operating Model (Mandatory)

### Iron Rule

No production code without a failing test first.

### Per-Slice Protocol

1. RED:
   1. Add one minimal failing test.
   2. Run target test only and verify intended failure.
2. GREEN:
   1. Implement minimum production changes to pass.
   2. Re-run target test.
3. REFACTOR:
   1. Clean names/seams only after green.
   2. Re-run affected cluster.

## Milestones

### M0: Baseline and Harness Contract

Deliverables:

1. Baseline matrix for spectator-critical paths.
2. Define `spectator:self-check` command contract and output schema.

Exit Criteria:

1. Team agrees on deterministic pass/fail signals and artifact paths.

### M1: Realm/Sync Spectator Policy Tests (P0)

Deliverables:

1. `use-realm-store` tests for spectator transitions and recovery.
2. Extract and test pure selector helper for initial spectator selection from `sync.ts`.

Exit Criteria:

1. All spectator state edge cases are unit-covered.

### M2: Navigation Spectator TDD (P0)

Deliverables:

1. Tests for `useSpectatorModeClick` and `useGoToStructure` spectator options propagation.
2. Verify URL + store handoff invariants.

Exit Criteria:

1. Spectator entry route and state wiring are behavior-tested.

### M3: Overlay Spectator Integration TDD (P0)

Deliverables:

1. `game-loading-overlay.spectator.test.tsx` with fake timers and store-driven map loading transitions.
2. Explicit tests for post-map delay and safety timeout.

Exit Criteria:

1. Spectator overlay lifecycle is integration-tested and deterministic.

### M4: Autonomous Browser Spectator Suite (P0)

Deliverables:

1. Browser e2e harness (Playwright or equivalent) under `client/apps/game/e2e/spectator`.
2. At least one happy-path and one failure-path test with artifact capture.

Exit Criteria:

1. Headless run proves app can enter spectator mode and reach stable worldmap readiness.

### M5: Self-Check Runner + CI Gate (P1)

Deliverables:

1. `scripts/spectator-self-check.(ts|mjs)` orchestration.
2. Unified command + CI job wiring.
3. Failure classifier and retry-once policy for known flakes.

Exit Criteria:

1. CI can run one command and produce deterministic pass/fail with artifacts.

## Prioritized TDD Slice Backlog

1. S1 (P0): `use-realm-store` spectator transition matrix tests.
2. S2 (P0): Initial sync spectator selection pure helper extraction + tests.
3. S3 (P0): `useSpectatorModeClick` route/state propagation tests.
4. S4 (P0): `GameLoadingOverlay` spectator timing tests.
5. S5 (P0): Autonomous spectator happy-path browser test.
6. S6 (P1): Autonomous failure diagnostics test (forced map-loading stall).
7. S7 (P1): Self-check runner failure classifier and retry policy tests.
8. S8 (P1): CI gate integration with artifact publish.

## Command Contract (Target)

### Developer Loop

1. `pnpm --dir client/apps/game exec vitest run src/hooks/store/use-realm-store.test.ts`
2. `pnpm --dir client/apps/game exec vitest run src/hooks/helpers/use-navigate.spectator.test.ts`
3. `pnpm --dir client/apps/game exec vitest run src/ui/layouts/game-loading-overlay.spectator.test.tsx`

### Autonomous Gate

1. `pnpm --dir client/apps/game run spectator:self-check`

Expected internal sequence:

1. Unit policy pack
2. Integration pack
3. Browser spectator pack
4. Artifact archival (`.context/spectator-self-check/<timestamp>/`)
5. Pass/fail summary with classified reason

## Acceptance Criteria

1. A single command executes end-to-end spectator validation without manual browser input.
2. The autonomous run enters spectator mode and verifies:
   1. spectator route
   2. spectator overlay lifecycle
   3. worldmap scene readiness (canvas/render-visible condition)
3. Spectator unit/integration/browser tests are all green in CI.
4. On failure, artifacts include at minimum:
   1. runner log
   2. browser screenshot
   3. trace or console dump
5. Every production change in scope has linked failing-first test evidence.

## Risks and Mitigations

1. Risk: Browser test flakiness from async world streaming.
   1. Mitigation: use deterministic waiting predicates, avoid sleep-only waits, enforce one controlled retry.
2. Risk: Over-coupling tests to unstable UI text.
   1. Mitigation: add stable `data-testid` selectors for critical spectator checkpoints.
3. Risk: Long CI runtime.
   1. Mitigation: keep browser suite minimal and move edge-case matrix to unit/integration layers.

## Rollout Plan

1. Land M1-M3 first and stabilize deterministic local test packs.
2. Add browser suite and run non-blocking in CI for one week.
3. Promote `spectator:self-check` to required gate after flake budget is met.

## Open Questions

1. Should spectator browser tests launch from game-entry modal flow, direct route, or both?
2. Do we want an explicit `window` test hook for spectator readiness, or only DOM-visible assertions?
3. Should self-check artifacts be uploaded on all runs, or only on failure?

