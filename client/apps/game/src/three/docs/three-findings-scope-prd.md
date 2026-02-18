# PRD: Three Findings Scope and Execution Plan

## Overview

- Feature: Scope and execute the current `src/three` testing and maintainability findings backlog.
- Status: Draft v1
- Owner: Three.js Team
- Created: 2026-02-18
- Last Updated: 2026-02-18

## Scope Source

This plan scopes the prioritized findings list and converts it into executable TDD slices.

## Execution Status (2026-02-18)

1. M1 started.
2. Added direct class-level lifecycle tests for `GameRenderer.destroy`:
   1. `client/apps/game/src/three/game-renderer.lifecycle.test.ts`
3. Added `WorldmapScene` runtime teardown seam and tests without importing the full scene runtime graph:
   1. `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.ts`
   2. `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.test.ts`
4. Wired `WorldmapScene.onSwitchOff` to the new runtime seam:
   1. `client/apps/game/src/three/scenes/worldmap.tsx`
5. Added direct `StructureManager` lifecycle smoke tests and idempotent destroy guard:
   1. `client/apps/game/src/three/managers/structure-manager.lifecycle.test.ts`
   2. `client/apps/game/src/three/managers/structure-manager.ts`
6. Added `InputManager` lifecycle tests and idempotent destroy guard:
   1. `client/apps/game/src/three/managers/input-manager.test.ts`
   2. `client/apps/game/src/three/managers/input-manager.ts`
7. Added `PathRenderer` lifecycle tests and idempotent dispose guard:
   1. `client/apps/game/src/three/managers/path-renderer.test.ts`
   2. `client/apps/game/src/three/managers/path-renderer.ts`
8. Added deterministic `ArmyModel` behavior policy tests (movement/rotation/model-switch) and wired runtime methods to the policy seam:
   1. `client/apps/game/src/three/managers/army-model-behavior-policy.ts`
   2. `client/apps/game/src/three/managers/army-model-behavior-policy.test.ts`
   3. `client/apps/game/src/three/managers/army-model.ts`
9. Added direct effects/weather coverage for `DayNightCycleManager` and `RainEffect`, including idempotent dispose guards:
   1. `client/apps/game/src/three/effects/day-night-cycle.test.ts`
   2. `client/apps/game/src/three/effects/rain-effect.test.ts`
   3. `client/apps/game/src/three/effects/day-night-cycle.ts`
   4. `client/apps/game/src/three/effects/rain-effect.ts`

## Prioritized Findings (Scoped)

### High Priority

1. `WorldmapScene` runtime behavior is weakly test-protected; lifecycle tests are fixture-level.
   1. `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`
   2. `client/apps/game/src/three/scenes/worldmap-lifecycle-fixture.ts`
   3. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `GameRenderer` has heavy listener/timer/cleanup orchestration and no direct suite.
   1. `client/apps/game/src/three/game-renderer-policy.test.ts`
   2. `client/apps/game/src/three/game-renderer.ts`
3. `StructureManager` is large/high-risk with only narrow policy tests.
   1. `client/apps/game/src/three/managers/structure-manager.ts`
   2. `client/apps/game/src/three/managers/structure-update-policy.test.ts`

### Medium Priority

1. `ArmyModel` movement/rotation/model-switching paths are mostly untested.
2. Listener-heavy managers (`InputManager`, `PathRenderer`) have no lifecycle suites.
3. Effects/weather coverage is shallow (`DayNightCycleManager`, `RainEffect`).
4. No coverage thresholds in `vitest.config.ts`.

### Low Priority

1. PRD/doc baselines are stale.
2. Global debug hooks are attached to `window` in production modules; should be DEV-gated.

## Goals

1. Close P0 test-protection gaps around runtime lifecycle correctness.
2. Add deterministic behavior tests for high-risk manager/effect paths.
3. Add enforceable coverage guardrails so regressions fail CI.
4. Add runtime smoke validation using the `agent-browser` skill.
5. Keep strict TDD evidence for every production change.

## Non-Goals

1. Full architecture rewrite of `worldmap.tsx` or renderer stack.
2. Shader/material visual redesign.
3. Broad lint cleanup outside touched files.

## Workstreams

### WS1: Lifecycle Runtime Hardening (P0)

Target files:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/game-renderer.ts`
3. `client/apps/game/src/three/managers/structure-manager.ts`

Deliverables:

1. Real class-level lifecycle smoke tests (setup/switch-off/destroy idempotency).
2. Listener/timer cleanup assertions at runtime seams.
3. Transition safety assertions for concurrent switching paths.

Test targets (new):

1. `client/apps/game/src/three/scenes/worldmap.runtime-lifecycle.test.ts`
2. `client/apps/game/src/three/game-renderer.lifecycle.test.ts`
3. `client/apps/game/src/three/managers/structure-manager.lifecycle.test.ts`

### WS2: Manager Behavior Coverage (P1)

Target files:

1. `client/apps/game/src/three/managers/army-model.ts`
2. `client/apps/game/src/three/managers/input-manager.ts`
3. `client/apps/game/src/three/managers/path-renderer.ts`

Deliverables:

1. Movement/rotation/model-switch decision coverage for `ArmyModel`.
2. Listener attach/detach/idempotent destroy tests for `InputManager`.
3. Segment allocation/compaction/dispose tests for `PathRenderer`.

Test targets (new):

1. `client/apps/game/src/three/managers/army-model.behavior.test.ts`
2. `client/apps/game/src/three/managers/input-manager.test.ts`
3. `client/apps/game/src/three/managers/path-renderer.test.ts`

### WS3: Effects and Weather Determinism (P1)

Target files:

1. `client/apps/game/src/three/effects/day-night-cycle.ts`
2. `client/apps/game/src/three/effects/rain-effect.ts`

Deliverables:

1. Deterministic interpolation and fog/lighting transition tests.
2. Rain spawn/wind/velocity invariants under fixed random seed strategy.

Test targets (new):

1. `client/apps/game/src/three/effects/day-night-cycle.test.ts`
2. `client/apps/game/src/three/effects/rain-effect.test.ts`

### WS4: Test Guardrails and Policy (P1/P2)

Target files:

1. `client/apps/game/vitest.config.ts`
2. `client/apps/game/src/three/utils/easing.ts`
3. `client/apps/game/src/three/managers/army-model.ts`
4. `client/apps/game/src/three/utils/hex-geometry-pool.ts`

Deliverables:

1. Coverage thresholds for `src/three` with changed-files expectation policy.
2. DEV-only debug hook registration policy and central registry.

### WS5: Docs Freshness (P2)

Target files:

1. `client/apps/game/src/three/docs/three-tdd-cleanup-prd.md`
2. `client/apps/game/src/three/docs/three-maintainability-tdd-prd.md`

Deliverables:

1. Updated footprint metrics and test counts.
2. Quarterly doc sync checklist.

## TDD Slice Plan

For every slice, follow strict `RED -> GREEN -> REFACTOR`.

### M0 (P0): Harness Baseline

1. Add deterministic lifecycle harness helpers for scene/renderer/manager tests.
2. Add one failing smoke test per P0 component proving missing behavior.

Exit:

1. Failing tests exist for all WS1 targets.

### M1 (P0): Worldmap and Renderer Lifecycle

1. Worldmap: test attach/remove for key listeners and in-flight timer cancellation.
2. Renderer: test cleanup for keyboard/focus/resize listeners and interval disposal.

Exit:

1. New lifecycle suites pass and fail when guards are removed.

### M2 (P0): StructureManager Lifecycle

1. Add tests for subscription teardown and chunk-switch promise cleanup.
2. Add idempotent destroy behavior test.

Exit:

1. Direct manager lifecycle suite green.

### M3 (P1): ArmyModel + Utility Managers

1. Add movement/rotation/model-switch tests for `ArmyModel`.
2. Add full lifecycle tests for `InputManager` and `PathRenderer`.

Exit:

1. Behavior suites pass; major branches covered.

### M4 (P1): Effects + Coverage Gates

1. Add deterministic effect tests.
2. Introduce explicit coverage threshold config for `src/three`.

Exit:

1. Coverage gate enforced in CI path.

### M5 (P2): Debug Hook Policy + Docs Sync

1. Gate global debug hooks behind DEV-only registry.
2. Refresh PRD baseline metrics and add quarterly sync cadence.

Exit:

1. Docs and debug policy merged; no production global leakage.

## Runtime Validation Lane (`agent-browser` Skill)

Use `agent-browser` as runtime smoke for post-merge confidence, in addition to unit/integration tests.

Minimum smoke checks:

1. Launch game and enter map/spectator flow.
2. Verify no startup crash overlay.
3. Verify `main-canvas` exists.
4. Verify route transitions do not leak duplicate overlays/listeners during quick navigation.

Artifacts:

1. Screenshot
2. Console log
3. Errors log

Storage path:

1. `.context/spectator-browser/`

## Acceptance Criteria

1. P0 runtime lifecycle suites exist and pass for worldmap, renderer, and structure manager.
2. P1 manager/effect suites exist and pass.
3. `src/three` coverage gate is enforced in CI.
4. Runtime smoke via `agent-browser` is documented and reproducible.
5. Docs baseline is updated after implementation closeout.

## Risks and Mitigations

1. Risk: Flaky async lifecycle tests.
   1. Mitigation: fake timers + deterministic harness utilities.
2. Risk: Over-mocking hides runtime defects.
   1. Mitigation: keep class-level tests with real orchestration paths where possible.
3. Risk: Coverage gate blocks unrelated teams.
   1. Mitigation: phased rollout with warning mode before hard fail.

## Immediate Next Action

Start WS1/M0 by scaffolding:

1. `worldmap.runtime-lifecycle.test.ts`
2. `game-renderer.lifecycle.test.ts`

with one intentional failing assertion each before implementation changes.
