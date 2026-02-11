# PRD: Worldmap Chunking Stability Hardening v2

## Overview

- Feature: Harden worldmap chunk switching and manager synchronization to eliminate stale screens and transient disappearance.
- Status: In Progress
- Owner: Three / Worldmap Team
- Created: 2026-02-10
- Last Updated: 2026-02-10

## Executive Summary

The worldmap chunking path has known race windows between terrain hydration, manager apply timing, and visibility bounds handoff. This PRD formalizes a milestone-driven stabilization plan with explicit testing gates after each milestone.

## Problem Statement

Current chunk flow can expose partially committed visual state under pan/zoom/boundary churn:

1. Temporary empty terrain or missing armies/structures/chests.
2. Edge-of-chunk mismatch between terrain, entities, and interaction mesh.
3. Stale hover/selection labels or delayed manager settle.

## Goals

1. Make chunk transitions transactional and deterministic.
2. Ensure chunk-aware managers apply updates only for active transition state.
3. Remove stale-screen windows in switch, resume, and teardown.
4. Add high-signal telemetry and regression coverage for chunk/zoom stress.

## Non-Goals

1. Full architecture rewrite.
2. Torii transport replacement.
3. Gameplay changes.
4. Visual redesign.

## Scope

In scope:

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
3. `client/apps/game/src/three/managers/army-manager.ts`
4. `client/apps/game/src/three/managers/structure-manager.ts`
5. `client/apps/game/src/three/managers/chest-manager.ts`
6. `client/apps/game/src/three/managers/interactive-hex-manager.ts`
7. `client/apps/game/src/three/managers/instanced-biome.tsx`
8. `client/apps/game/src/three/utils/chunk-geometry.ts`
9. `client/apps/game/src/three/utils/centralized-visibility-manager.ts`
10. `client/apps/game/src/three/scenes/hexagon-scene.ts`
11. `client/apps/game/src/three/managers/hover-label-manager.ts`

Out of scope:

1. Contract/indexer schema work.
2. New chunk geometry strategy.

## Requirements

Functional requirements:

1. Chunk switch lifecycle follows `prepare -> hydrate -> render -> commit -> cleanup`.
2. `currentChunk` and active bounds update only at commit phase.
3. Manager updates must be dropped unless token and target chunk are current.
4. Structure manager chunk update completion must reflect async render settle.
5. Bounds parity across terrain/entity/interaction must be consistent.
6. Resume/switch-off must clear stale hover/label state.
7. Teardown must deterministically dispose chunk-relevant managers/listeners.

Non-functional requirements:

1. Frame-time p95 regression <= 5%.
2. Chunk-switch p95 regression <= 10%.
3. No registered chunk/listener leaks in soak runs.
4. Dev/canary telemetry for stale-drop and transition phase diagnostics.

## Milestones

- [x] M0: Baseline + Instrumentation
- [x] M1: Transactional Switch Core
- [ ] M2: Manager Convergence Hardening
- [ ] M3: Bounds and Interaction Parity
- [ ] M4: Lifecycle and Resume Cleanup
- [ ] M5: Test Expansion + Soak
- [ ] M6: Canary + Rollout

## Milestone Details

### M0: Baseline + Instrumentation

Objectives:

1. Add transition/fetch/apply counters and structured diagnostics.
2. Add a reproducible baseline capture path for local/dev.
3. Add tests validating diagnostics behavior.

Exit criteria:

1. Diagnostics available in dev at runtime.
2. Test coverage added for diagnostics helpers.
3. Baseline can be captured before M1 changes.

Completion notes:

1. Runtime diagnostics are exposed in dev via `window.getWorldmapChunkDiagnostics()`.
2. Baseline capture is available via `window.captureWorldmapChunkBaseline(label?)`.
3. Runtime counters can be reset via `window.resetWorldmapChunkDiagnostics()`.
4. Coverage added: `worldmap-chunk-diagnostics.test.ts`.

### M1: Transactional Switch Core

Objectives:

1. Commit-phase-only chunk authority updates.
2. Old/new bounds overlap handoff until commit success.
3. Strict stale apply guard for manager fanout.

Exit criteria:

1. No stale manager apply in rapid boundary switch test.
2. No blank-terrain transition in zoom stress replay.

Completion notes:

1. `performChunkSwitch` now defers `currentChunk` authority update until commit phase after hydrate + switch-action resolution.
2. Transition handoff now applies overlap bounds (previous + target) during switch to avoid culling gaps before commit.
3. `resolveChunkSwitchActions` now keys stale handling on transition-token currency (`isCurrentTransition`) rather than pre-commit `currentChunk`.
4. Manager fanout remains strict via exact transition token + target chunk guard in `shouldRunManagerUpdate`.

### M2: Manager Convergence Hardening

Objectives:

1. Make structure chunk updates awaitable through settle.
2. Align army/structure/chest completion semantics.

Exit criteria:

1. No premature manager-settled logs before visual apply.

### M3: Bounds and Interaction Parity

Objectives:

1. Unify bounds semantics across render/visibility/interaction.

Exit criteria:

1. No reproducible edge mismatch at chunk boundaries.

### M4: Lifecycle and Resume Cleanup

Objectives:

1. Reset hover label state on switch-off/resume.
2. Reattach labels only after forced refresh settle.
3. Normalize manager teardown paths.

Exit criteria:

1. No stale hover/label artifacts after scene switches.

### M5: Test Expansion + Soak

Objectives:

1. Add integration tests for chunk+zoom+resume races.
2. Add 20-minute soak validation script/checklist.

Exit criteria:

1. CI coverage includes chunk/zoom race regression paths.
2. Soak run shows no leaks or stale-screen incidents.

### M6: Canary + Rollout

Objectives:

1. Canary rollout with telemetry watch.
2. Production enablement decision based on metrics.

Exit criteria:

1. Canary stale-screen and perf rates at or better than baseline.

## QA Matrix

1. Slow pan across single boundary.
2. Fast multi-boundary pan.
3. Rapid zoom out/in near boundary.
4. Delayed fetch + active entity movement.
5. Scene switch and resume loops.

## Execution Log

| Date       | Milestone | Status | Notes |
| ---------- | --------- | ------ | ----- |
| 2026-02-10 | M0        | Started | PRD created; instrumentation implementation in progress. |
| 2026-02-10 | M0        | Completed | Added runtime chunk diagnostics in `worldmap.tsx`, added helper+tests, verified targeted chunk test suites. |
| 2026-02-10 | M1        | Completed | Transactional chunk switch core implemented with commit-phase chunk authority, overlap bounds handoff, and token-keyed stale switch actions. |
