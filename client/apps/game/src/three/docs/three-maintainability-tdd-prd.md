# PRD: Three.js Maintainability TDD Hardening

## Overview

- Feature: Maintainability hardening program for `client/apps/game/src/three` using strict TDD.
- Status: In Progress (M1)
- Owner: Three.js Team
- Created: 2026-02-17
- Last Updated: 2026-02-17

## Document Update Log

| Update | Date (UTC)       | Author | Change |
| ------ | ---------------- | ------ | ------ |
| U1     | 2026-02-17 00:00 | Codex  | Created TDD PRD from maintainability review findings, with milestones, slice backlog, and test gates. |
| U2     | 2026-02-17 00:00 | Codex  | Marked milestone M0 as started and updated execution log. |
| U3     | 2026-02-17 00:00 | Codex  | Added M0 RED baseline tests (`scene-manager.test.ts`, `worldmap-lifecycle.test.ts`) and recorded fail-first behavior matrix. |
| U4     | 2026-02-17 00:00 | Codex  | Implemented GREEN pass for baseline slices (scene transition lock + worldmap lifecycle safeguards); targeted + `src/three` test gates passing. |
| U5     | 2026-02-17 00:00 | Codex  | Started M1 with RED/GREEN lifecycle hardening slice: `onSwitchOff()` now detaches `urlChanged`; `requestChunkRefresh()` now no-ops when switched off; updated lifecycle tests and re-ran `src/three` gate. |
| U6     | 2026-02-17 00:00 | Codex  | Added explicit switch/unmount lifecycle policy tests and extracted idempotent URL listener lifecycle resolver; wired worldmap setup/switch-off/destroy through policy and re-ran `src/three` gate. |

## Executive Summary

`src/three` has strong policy-test coverage in selected areas, but core lifecycle/orchestration paths still carry
maintainability risk:

1. Scene/lifecycle cleanup is inconsistent across `onSwitchOff()` and `destroy()`.
2. Scene transitions are not serialized and can overlap under rapid input.
3. Background/listener flows can trigger work while scene is inactive.
4. Core files remain large and lint/type debt is high, reducing refactor safety.

This PRD defines a test-first hardening iteration that prioritizes lifecycle correctness and safe refactoring speed over
architecture rewrite.

## Baseline (as of 2026-02-17)

1. `pnpm --dir client/apps/game test src/three`: passing (`26` files, `173` tests).
2. `pnpm --dir client/apps/game exec eslint src/three`: failing (`182` errors).
3. Largest orchestration files:
   1. `client/apps/game/src/three/scenes/worldmap.tsx` (`4,885` lines)
   2. `client/apps/game/src/three/managers/army-manager.ts` (`2,688` lines)
   3. `client/apps/game/src/three/managers/structure-manager.ts` (`2,253` lines)
   4. `client/apps/game/src/three/game-renderer.ts` (`1,519` lines)

## Problem Statement

The module has good unit coverage for extracted policies, but critical runtime behavior still depends on large
imperative flows with weak lifecycle test coverage. This creates risk of:

1. Event/listener leaks and stale async work across scene switches.
2. Race conditions during rapid scene transitions.
3. Slow, fragile iteration due to weak seams and unresolved lint/type debt.

## Goals

1. Make scene lifecycle behavior deterministic and test-protected.
2. Serialize scene transitions to prevent overlapping `setup()`/fade flows.
3. Ensure inactive scenes cannot execute heavy refresh work.
4. Add missing tests for `scene-manager` and transition lifecycle paths.
5. Establish enforceable quality gates for `src/three` changes.

## Non-Goals

1. Full `three` architecture rewrite.
2. Visual/gameplay redesign.
3. Cross-repo lint cleanup outside `src/three`.

## Scope

In scope:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scene-manager.ts`
3. `client/apps/game/src/three/managers/transition-manager.tsx`
4. `client/apps/game/src/three/game-renderer.ts`
5. New/expanded tests under:
   1. `client/apps/game/src/three/scenes/*.test.ts`
   2. `client/apps/game/src/three/managers/*.test.ts`
   3. `client/apps/game/src/three/*.test.ts`

Out of scope:

1. Material/shader feature work.
2. Asset pipeline changes.
3. Non-`three` package refactors.

## TDD Operating Model (Mandatory)

### Iron Rule

No production change without a failing test first.

### Per-Slice Protocol

1. RED
   1. Write one minimal failing test for one behavior.
   2. Run only that target test.
   3. Confirm failure reason is the intended missing behavior.
2. GREEN
   1. Implement minimum code to pass.
   2. Re-run target test.
3. REFACTOR
   1. Clean up names/structure after green.
   2. Re-run affected cluster.

### Required Commands

1. Targeted loop:
   - `pnpm --dir client/apps/game test client/apps/game/src/three/<path>/<file>.test.ts`
2. Module gate:
   - `pnpm --dir client/apps/game test src/three`
3. Quality gate:
   - `pnpm --dir client/apps/game exec eslint src/three`

## Milestones

### M0: Test Harness + Lifecycle Spec Baseline (0.5-1 day)

Objective:

Lock expected lifecycle behavior before implementation changes.

Deliverables:

1. New test files for scene/lifecycle behavior:
   1. `client/apps/game/src/three/scene-manager.test.ts`
   2. `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`
2. Baseline behavior matrix captured in docs.

Exit criteria:

1. Tests fail first on missing guards/serialization behavior.

### M0 RED Behavior Matrix (2026-02-17)

| Slice | Test | Expected behavior (spec) | Current outcome |
| ----- | ---- | ------------------------ | --------------- |
| S4    | `src/three/scene-manager.test.ts` | `switchScene()` does not start a new fade transition while a prior fade callback is still pending. | Fails: `fadeOut` invoked twice on rapid toggle. |
| S3    | `src/three/scenes/worldmap-lifecycle.test.ts` | `urlChanged` listener uses stable handler identity and is removed during teardown. | Fails: anonymous add listener, no corresponding remove. |
| S1    | `src/three/scenes/worldmap-lifecycle.test.ts` | `updateVisibleChunks()` short-circuits when scene is switched off. | Fails: no early `isSwitchedOff` guard at method entry. |
| S2    | `src/three/scenes/worldmap-lifecycle.test.ts` | `destroy()` reuses `onSwitchOff()` cleanup path for teardown symmetry. | Fails: `destroy()` does not invoke shared switch-off cleanup. |

### M1: Worldmap Lifecycle Safety (1-2 days)

Objective:

Prevent inactive scene work and teardown drift.

Deliverables:

1. Active-scene/inactive-scene guards around refresh paths.
2. Unified, idempotent cleanup path covering listeners/timers/subscriptions.
3. URL listener registration converted to removable named handler.

Exit criteria:

1. Lifecycle tests pass.
2. No duplicate listener firing in switch/unmount tests.

### M2: Scene Transition Serialization (1-2 days)

Objective:

Guarantee one authoritative transition at a time.

Deliverables:

1. Transition token or in-flight lock in `scene-manager.ts`.
2. Cancellation/ignore semantics for superseded transitions.
3. Tests for rapid scene toggles and fade sequencing.

Exit criteria:

1. Overlapping `setup()` paths are dropped or serialized deterministically.

### M3: Maintainability Seams + Lint Guardrail (1-2 days)

Objective:

Improve refactor safety and reduce debt growth.

Deliverables:

1. Extract pure lifecycle decision helpers where needed (policy modules + tests).
2. Resolve high-value lint issues in touched files (no debt expansion).
3. Fix docs drift (README architecture reference).

Exit criteria:

1. `src/three` test suite green.
2. `src/three` lint error count reduced from baseline, with no new errors in touched files.

### M4: Hardening Closeout (0.5 day)

Objective:

Publish final quality snapshot and handoff backlog.

Deliverables:

1. Final verification run report.
2. Residual risk list + next extraction backlog.

Exit criteria:

1. All planned slices complete with red/green/refactor evidence.

## Prioritized TDD Slice Backlog

1. S1 (P0): Add failing test proving inactive worldmap can still trigger refresh work.
2. S2 (P0): Add failing test proving `destroy()` misses cleanup covered by `onSwitchOff()`.
3. S3 (P0): Add failing test for unremovable `urlChanged` listener callback identity.
4. S4 (P0): Add failing tests for rapid `switchScene()` overlap/race behavior.
5. S5 (P1): Add tests for transition cancel/ignore semantics.
6. S6 (P1): Extract lifecycle/transition pure decision helpers and cover with table tests.
7. S7 (P1): Reduce lint/type debt in touched files without broad rewrite.
8. S8 (P2): Add docs consistency tests/checklist and update architecture references.

## Requirements

Functional requirements:

1. Inactive worldmap must not execute chunk refresh logic.
2. Scene cleanup must be idempotent and symmetrical across switch-off and destroy flows.
3. Scene transitions must be serialized or token-gated.
4. Event listeners must be removable and cleaned on teardown.

Non-functional requirements:

1. Preserve current gameplay behavior.
2. Keep `src/three` tests deterministic in CI.
3. Avoid net-new lint debt in modified files.

## Acceptance Criteria

1. New lifecycle/transition tests are present and passing.
2. Every production change in this iteration links to a failing-first test in commit/PR notes.
3. `pnpm --dir client/apps/game test src/three` passes.
4. `pnpm --dir client/apps/game exec eslint src/three` shows measurable improvement versus baseline or an agreed
   debt budget with no regressions in touched files.
5. README/doc references match existing files.

## Risks and Mitigations

1. Risk: Flaky async tests around timers/transitions.
   1. Mitigation: Use fake timers and explicit transition tokens in tests.
2. Risk: Refactor scope creep in large files.
   1. Mitigation: Keep slices narrow; one behavior per TDD loop.
3. Risk: Lint cleanup expands beyond schedule.
   1. Mitigation: Restrict to touched-file debt + high-value blockers only.

## Execution Log

| Date       | Milestone | Status  | Notes |
| ---------- | --------- | ------- | ----- |
| 2026-02-17 | M0        | Started | Kickoff confirmed; begin lifecycle-spec baseline tests (`scene-manager.test.ts`, `worldmap-lifecycle.test.ts`). |
| 2026-02-17 | M0        | In Progress | RED baseline captured: targeted lifecycle/transition tests fail for intended missing guards/serialization/teardown symmetry (`4` failing assertions). |
| 2026-02-17 | M0        | In Progress | GREEN iteration applied: `scene-manager.ts` transition-in-flight guard; `worldmap.tsx` switched-off early-return, stable/removable `urlChanged` handler, `destroy()` reuses `onSwitchOff()`. Tests: targeted (`2` files / `4` tests) and module gate (`28` files / `177` tests) passing. |
| 2026-02-17 | M1        | In Progress | RED/GREEN slice completed: added lifecycle assertions for switch-off listener teardown and switched-off refresh guard; implemented `onSwitchOff()` listener detach + `requestChunkRefresh()` early return; tests passing (`worldmap-lifecycle` `5/5`, `src/three` `28` files / `179` tests). |
| 2026-02-17 | M1        | In Progress | Added switch/unmount sequence coverage via `worldmap-lifecycle-policy.test.ts` (`3` tests), extracted `worldmap-lifecycle-policy.ts`, and routed url-listener lifecycle through policy for idempotent setup/switch-off/destroy behavior. Tests passing (`src/three` `29` files / `182` tests). |
