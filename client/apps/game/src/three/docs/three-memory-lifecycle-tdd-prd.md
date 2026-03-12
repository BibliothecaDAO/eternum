# PRD: Three Memory and Lifecycle TDD Hardening

## Overview

- Feature: Memory-leak and lifecycle hardening program for `client/apps/game/src/three`.
- Status: Draft v0.1
- Owner: Three.js Team
- Created: 2026-03-12
- Last Updated: 2026-03-12

## Document Update Log

| Update | Date (AEDT)      | Author | Change                                                                                                                  |
| ------ | ---------------- | ------ | ----------------------------------------------------------------------------------------------------------------------- |
| U1     | 2026-03-12 19:05 | Codex  | Created PRD/TDD from deep memory leak review findings, with prioritized fixes, failing-test slices, and rollout plan. |

## Executive Summary

The Three.js client has many explicit `dispose()` paths, but the current runtime still has several lifetime bugs that
can retain renderer graphs, stack event listeners across remounts, and leave GPU resources alive after teardown.

The highest-risk issues are:

1. `WorldmapScene.destroy()` does not call the destroy paths for the managers and FX systems it owns.
2. `HexagonScene` wires both `FrustumManager` and the singleton `CentralizedVisibilityManager` into shared controls, but
   teardown never disposes them.
3. Multiple `window` globals retain destroyed scene and renderer graphs.
4. `ArmyManager` clears `PathRenderer` state but never disposes the singleton itself.
5. Global GUI folders are created without symmetric teardown and capture dead object graphs through closures.

This PRD defines a strict TDD-first hardening program that fixes lifetime ownership before any broader performance or
architecture refactor.

## Problem Statement

`client/apps/game/src/three` currently mixes three lifetime models:

1. Objects with explicit local ownership and cleanup (`destroy()` or `dispose()`).
2. Module singletons that survive scene/renderer recreation.
3. Global debug hooks and GUI registries that can capture instance closures.

Those models are not consistently reconciled during teardown. As a result, several high-value cleanup paths are never
invoked, singleton listeners can accumulate across mounts, and dead renderer or scene graphs can remain strongly
reachable after the user leaves the scene or destroys the renderer.

This creates four classes of production risk:

1. Long-session heap growth during navigation or scene recreation.
2. GPU resource retention after destroy/re-enter loops.
3. Hidden background work from stale timers, listeners, and async completions.
4. Reduced confidence when optimizing because lifecycle behavior is not protected by full integration tests.

## Goals

### Primary Goals

1. Make scene and renderer teardown deterministic and complete.
2. Ensure every long-lived singleton has an explicit ownership boundary and a tested cleanup policy.
3. Eliminate global references that keep destroyed Three.js graphs reachable.
4. Add integration tests that fail before each production fix and prove lifecycle behavior after each fix.
5. Establish repeatable verification for destroy/recreate loops, listener counts, and resource cleanup.

### Non-Goals

1. Full renderer architecture rewrite.
2. Asset pipeline redesign.
3. Material or visual-direction changes unrelated to lifecycle safety.
4. Broad non-`three` refactors, except for tightly-coupled lifecycle dependencies required to close a leak.

## Scope

### In Scope

1. `client/apps/game/src/three/scenes/worldmap.tsx`
2. `client/apps/game/src/three/scenes/hexagon-scene.ts`
3. `client/apps/game/src/three/game-renderer.ts`
4. `client/apps/game/src/three/managers/army-manager.ts`
5. `client/apps/game/src/three/managers/path-renderer.ts`
6. `client/apps/game/src/three/managers/structure-manager.ts`
7. `client/apps/game/src/three/managers/chest-manager.ts`
8. `client/apps/game/src/three/managers/fx-manager.ts`
9. `client/apps/game/src/three/managers/points-label-renderer.ts`
10. `client/apps/game/src/three/utils/centralized-visibility-manager.ts`
11. `client/apps/game/src/three/utils/frustum-manager.ts`
12. `client/apps/game/src/three/utils/gui-manager.ts`
13. `client/apps/game/src/three/utils/memory-monitor.ts`
14. `client/apps/game/src/three/docs/*` updates required to reflect final ownership rules

### Out of Scope

1. Weather/ambient behavior changes unrelated to memory or lifetime management.
2. Chunking policy tuning unrelated to stale-retention cleanup.
3. New rendering features.

## Baseline Findings

### P0: Worldmap teardown bypasses manager cleanup

- `WorldmapScene` constructs `FXManager`, `ResourceFXManager`, `ArmyManager`, `StructureManager`, and `ChestManager`,
  but destroy only tears down `resourceFXManager`, selection pulses, some listeners, and base-scene resources.
- The manager cleanup paths that own timers, pooled renderers, labels, models, and textures are not invoked.
- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:565`
  - `client/apps/game/src/three/scenes/worldmap.tsx:606`
  - `client/apps/game/src/three/scenes/worldmap.tsx:630`
  - `client/apps/game/src/three/scenes/worldmap.tsx:643`
  - `client/apps/game/src/three/scenes/worldmap.tsx:5084`
  - `client/apps/game/src/three/managers/army-manager.ts:2764`
  - `client/apps/game/src/three/managers/structure-manager.ts:500`
  - `client/apps/game/src/three/managers/chest-manager.ts:156`
  - `client/apps/game/src/three/managers/fx-manager.ts:677`

### P0: Scene teardown leaks control listeners through frustum/visibility ownership

- Each `HexagonScene` creates a `FrustumManager` and initializes the process-wide `CentralizedVisibilityManager`.
- Both managers attach `controls` listeners, but `HexagonScene.destroy()` does not dispose either manager.
- Because `CentralizedVisibilityManager` is a module singleton, repeated scene or renderer creation can stack listener
  registrations and retain old camera/control references.
- Evidence:
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:138`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:145`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:1187`
  - `client/apps/game/src/three/utils/frustum-manager.ts:19`
  - `client/apps/game/src/three/utils/centralized-visibility-manager.ts:139`
  - `client/apps/game/src/three/utils/centralized-visibility-manager.ts:568`

### P0: Global roots retain destroyed scenes and renderers

- `WorldmapScene` writes debug closures to `window`.
- `GameRenderer` writes the renderer instance to `window` when memory monitoring is enabled.
- Those globals are not removed during destroy.
- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:618`
  - `client/apps/game/src/three/scenes/worldmap.tsx:622`
  - `client/apps/game/src/three/scenes/worldmap.tsx:5084`
  - `client/apps/game/src/three/game-renderer.ts:392`
  - `client/apps/game/src/three/utils/memory-monitor.ts:160`
  - `client/apps/game/src/three/game-renderer.ts:1324`

### P1: `PathRenderer` cleanup exists but is not used by its owner

- `ArmyManager.destroy()` clears path state but does not call `PathRenderer.dispose()`.
- The actual dispose path owns resize-listener removal, geometry/material cleanup, buffer disposal, and singleton reset.
- Evidence:
  - `client/apps/game/src/three/managers/army-manager.ts:245`
  - `client/apps/game/src/three/managers/army-manager.ts:2815`
  - `client/apps/game/src/three/managers/path-renderer.ts:82`
  - `client/apps/game/src/three/managers/path-renderer.ts:346`

### P1: Global GUI folders capture dead object graphs

- `GUIManager` is a module-global `lil-gui` instance.
- `GameRenderer` and `ArmyManager` create folders with callbacks that close over `this`.
- Their destroy paths do not remove those folders.
- Evidence:
  - `client/apps/game/src/three/utils/gui-manager.ts:4`
  - `client/apps/game/src/three/game-renderer.ts:176`
  - `client/apps/game/src/three/game-renderer.ts:214`
  - `client/apps/game/src/three/managers/army-manager.ts:251`
  - `client/apps/game/src/three/managers/army-manager.ts:367`
  - `client/apps/game/src/three/game-renderer.ts:1324`
  - `client/apps/game/src/three/managers/army-manager.ts:2764`

### P2: Points icon textures are not explicitly disposed

- `PointsLabelRenderer.dispose()` releases geometry and material but not the sprite texture that seeded the material.
- This becomes visible on destroy/recreate loops and any future in-place renderer rebuilds.
- Evidence:
  - `client/apps/game/src/three/managers/points-label-renderer.ts:50`
  - `client/apps/game/src/three/managers/points-label-renderer.ts:82`
  - `client/apps/game/src/three/managers/points-label-renderer.ts:368`
  - `client/apps/game/src/three/managers/army-manager.ts:2332`
  - `client/apps/game/src/three/managers/structure-manager.ts:302`
  - `client/apps/game/src/three/managers/chest-manager.ts:121`

## Target Ownership Model

The post-fix runtime must obey these rules:

1. `GameRenderer.destroy()` is the only top-level renderer teardown entrypoint.
2. `WorldmapScene.destroy()` and `HexceptionScene.destroy()` must fully destroy scene-owned managers and FX systems
   before delegating to `HexagonScene.destroy()`.
3. Any object that registers external listeners, timers, RAFs, DOM roots, or global references must own a matching
   teardown path in the same class.
4. Module singletons must define one of two policies:
   - Persistent singleton with explicit reset/clear and no captured instance closures.
   - Ref-counted/per-render singleton with explicit `dispose()` when last owner leaves.
5. `window` globals are DEV-only diagnostics and must be installed through named registration helpers with symmetric
   removal.

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                      | Priority |
| ---- | ------------------------------------------------------------------------------------------------ | -------- |
| FR-1 | Destroying `WorldmapScene` must destroy all scene-owned managers and FX systems exactly once.    | P0       |
| FR-2 | Destroying any `HexagonScene` must detach all frustum and visibility listeners from `controls`.  | P0       |
| FR-3 | Destroying `GameRenderer` must remove all `window` globals created by renderer memory/debug code. | P0       |
| FR-4 | `ArmyManager.destroy()` must fully dispose path-renderer singleton state or transfer ownership.   | P1       |
| FR-5 | GUI folders created by renderer/managers must be tracked and removed during teardown.             | P1       |
| FR-6 | Points icon renderers must dispose owned sprite textures deterministically.                       | P2       |

### Non-Functional Requirements

| ID    | Requirement                                                                                           | Priority |
| ----- | ----------------------------------------------------------------------------------------------------- | -------- |
| NFR-1 | No production code lands in this effort without a failing test first.                                 | P0       |
| NFR-2 | Destroy/recreate loops must show no net listener growth across the tested lifecycle surfaces.         | P0       |
| NFR-3 | Teardown must be idempotent; repeat destroy calls may warn but must not re-register or rethrow.      | P0       |
| NFR-4 | DEV diagnostics must not retain production scene/renderer graphs after destroy.                       | P1       |
| NFR-5 | Memory/lifecycle fixes must not regress chunking correctness or visible rendering behavior.           | P1       |

## TDD Operating Model (Mandatory)

### Iron Rule

No production code without a failing test first.

### Per-Slice Protocol

1. RED
   - Add one minimal failing test for one lifetime behavior.
   - Run only that file or test name.
   - Confirm the failure is caused by missing cleanup, not harness drift.
2. GREEN
   - Implement the minimum code needed to pass the test.
   - Re-run the target test until green.
3. REFACTOR
   - Extract helper/policy seams only after green.
   - Re-run the target file and impacted cluster.

### Required Commands

1. Targeted test loop:
   - `pnpm --dir client/apps/game exec vitest run src/three/<path>/<file>.test.ts`
2. Cluster gate:
   - `pnpm --dir client/apps/game exec vitest run src/three`
3. Quality gate:
   - `pnpm --dir client/apps/game exec eslint src/three`

## M0 RED Behavior Matrix

| Slice | Target test file                           | Expected behavior                                                                 | Current outcome from review                                                            |
| ----- | ------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| S1    | `src/three/scenes/worldmap-lifecycle.test.ts` | `WorldmapScene.destroy()` destroys `armyManager`, `structureManager`, `chestManager`, and `fxManager`. | Fails on current design: destroy omits those calls and only tears down partial scene state. |
| S2    | `src/three/scenes/hexagon-scene.lifecycle.test.ts` | `HexagonScene.destroy()` removes frustum/visibility listeners from shared controls. | Fails on current design: `frustumManager` and `visibilityManager` are never disposed. |
| S3    | `src/three/scenes/worldmap-lifecycle.test.ts` | Worldmap debug hooks are installed through named helpers and removed during destroy. | Fails on current design: globals are assigned directly on `window` and never removed. |
| S4    | `src/three/game-renderer.lifecycle.test.ts` | Memory-monitor globals are cleared by `GameRenderer.destroy()` when monitoring is enabled. | Fails on current design: globals are installed but not cleaned up. |
| S5    | `src/three/managers/army-manager.lifecycle.test.ts` | `ArmyManager.destroy()` fully disposes `PathRenderer`. | Fails on current design: owner only calls `clearAll()`. |
| S6    | `src/three/managers/points-label-renderer.test.ts` | `PointsLabelRenderer.dispose()` frees geometry, material, and owned sprite texture. | Fails on current design: texture ownership is implicit and not disposed. |
| S7    | `src/three/game-renderer.lifecycle.test.ts` or `src/three/managers/army-manager.lifecycle.test.ts` | GUI folder count is stable across create/destroy loops. | Fails on current design: folders are created on a global GUI singleton with no teardown. |

## Milestones

### M0: Baseline Harness and Ownership Spec (0.5-1 day)

Objective:

Codify expected ownership and teardown behavior before touching production code.

Status:

- [x] Complete

Deliverables:

1. New lifecycle test files and/or expansions for:
   - `src/three/scenes/worldmap-lifecycle.test.ts`
   - `src/three/scenes/hexagon-scene.lifecycle.test.ts`
   - `src/three/game-renderer.lifecycle.test.ts`
   - `src/three/managers/army-manager.lifecycle.test.ts`
   - `src/three/managers/points-label-renderer.test.ts`
2. Baseline failure matrix recorded in this document.

Exit Criteria:

1. The new tests fail first on current behavior.
2. Every P0 finding has a direct failing integration or lifecycle test.

### M1: Worldmap Teardown Completeness (1-2 days)

Objective:

Close the biggest leak by making `WorldmapScene.destroy()` the actual owner teardown for all scene-local systems.

Status:

- [x] Complete

Deliverables:

1. `WorldmapScene.destroy()` explicitly destroys:
   - `armyManager`
   - `structureManager`
   - `chestManager`
   - `fxManager`
   - `resourceFXManager`
2. Scene-owned collections that are not covered by manager teardown are cleared.
3. Idempotency guards prevent double-destroy regressions.

Exit Criteria:

1. A failing test proves manager destroy methods were previously skipped.
2. The test passes only after all required destroy calls are wired.

### M2: Frustum and Visibility Lifetime Hardening (1-2 days)

Objective:

Stop listener accumulation through shared controls and singleton visibility ownership.

Status:

- [x] Complete

Deliverables:

1. `HexagonScene.destroy()` disposes `frustumManager`.
2. `CentralizedVisibilityManager` gets an explicit reinitialize-safe lifecycle:
   - either dispose previous controls listener before each `initialize()`
   - or add explicit `reset` / `attach` / `detach` semantics
3. Scene creation and destroy tests prove no net `change` listener growth.

Exit Criteria:

1. Repeated create/destroy cycles do not increase listener count.
2. Singleton visibility state no longer holds stale camera/control references after destroy.

### M3: Global Root Cleanup (1 day)

Objective:

Remove `window`-anchored leaks for debug and monitoring flows.

Deliverables:

1. Named registration helpers for worldmap debug hooks.
2. Symmetric cleanup in `WorldmapScene.destroy()`.
3. When memory monitoring is enabled, `GameRenderer.destroy()` clears:
   - `window.__gameRenderer`
   - `window.__memoryMonitorRenderer`
   - any related stats/debug hook state

Exit Criteria:

1. Tests prove globals are present after setup and absent after destroy.
2. Constructor-path lifecycle tests cover the real setup path, not prototype-only fixtures.

### M4: Singleton and GUI Hardening (1-2 days)

Objective:

Close remaining retained roots from singleton render helpers and global GUI folders.

Deliverables:

1. `ArmyManager.destroy()` fully disposes `PathRenderer` or introduces explicit ownership transfer/ref counting.
2. `GameRenderer` and `ArmyManager` track GUI folder handles and destroy them during teardown.
3. Any remaining singleton helpers are documented with ownership rules in code comments or README notes.

Exit Criteria:

1. Path renderer tests prove owner-triggered disposal, not just isolated `dispose()`.
2. GUI tests prove folders are removed and do not retain stale callbacks after destroy.

### M5: Resource Disposal Gaps and Closeout (0.5-1 day)

Objective:

Fix residual GPU cleanup gaps and publish final verification.

Deliverables:

1. `PointsLabelRenderer` explicitly owns and disposes its sprite texture, or documents transferred ownership and removes
   duplicate disposal risk.
2. Final verification report and residual-risk backlog.

Exit Criteria:

1. Points-label renderer tests pass for texture disposal semantics.
2. `src/three` lifecycle suite and lint gates are green in the implementation environment.

## Detailed TDD Slice Backlog

### S1 (P0): Worldmap destroys owned managers

RED:

1. Add a `WorldmapScene.destroy()` lifecycle test that injects fake manager instances with `destroy` spies.
2. Assert all scene-owned manager/FX destroy methods are called exactly once.

GREEN:

1. Wire the destroy calls in `WorldmapScene.destroy()`.
2. Add idempotent guards if double-destroy becomes possible.

Status:

- [x] Complete

### S2 (P0): `HexagonScene.destroy()` disposes frustum and visibility state

RED:

1. Add a test that constructs/destroys a scene and verifies `controls.removeEventListener("change", ...)` occurs for
   both manager types.
2. Add a repeated create/destroy test that asserts no listener-count growth.

GREEN:

1. Dispose `frustumManager` in `HexagonScene.destroy()`.
2. Refactor `CentralizedVisibilityManager.initialize()` so it detaches any previous controls listener before reattach.

Status:

- [x] Complete

### S3 (P0): Window debug hooks are symmetric

RED:

1. Add a worldmap lifecycle test asserting `window.testMaterialSharing` and `window.testTroopDiffFx` exist after setup.
2. Assert they are removed after destroy.

GREEN:

1. Extract named install/uninstall helpers.
2. Call uninstall from `WorldmapScene.destroy()`.

### S4 (P0): Memory monitor globals are removed on renderer destroy

RED:

1. Expand `game-renderer.lifecycle.test.ts` to run through the real setup path for memory monitoring or a dedicated
   helper path.
2. Assert `window.__gameRenderer` and `window.__memoryMonitorRenderer` are removed in destroy.

GREEN:

1. Clear those globals during `GameRenderer.destroy()`.
2. Ensure cleanup is safe when monitoring is disabled.

### S5 (P1): `ArmyManager.destroy()` disposes `PathRenderer`

RED:

1. Add an integration lifecycle test around `ArmyManager.destroy()`.
2. Assert `PathRenderer.dispose()` is called, not only `clearAll()`.

GREEN:

1. Replace `clearAll()`-only cleanup with `dispose()` or a new owner-safe teardown API.
2. Keep idempotency guarantees.

### S6 (P1): GUI folder ownership is explicit

RED:

1. Add a test around renderer and manager setup/destroy that tracks folder creation/destruction against `GUIManager`.
2. Assert no folder count growth after destroy/recreate loops.

GREEN:

1. Store created folder handles as fields.
2. Destroy them in the owning class teardown.

### S7 (P2): Points label textures are cleaned up

RED:

1. Add a `PointsLabelRenderer` test that passes a texture with a `dispose` spy.
2. Assert destroy/dispose frees geometry, material, and texture exactly once.

GREEN:

1. Implement explicit texture ownership in `PointsLabelRenderer`.
2. Update call sites if ownership must be transferred.

## Test Plan

### New or Expanded Tests

1. `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`
   - verifies manager destroy coverage
   - verifies debug hook install/uninstall symmetry
2. `client/apps/game/src/three/scenes/hexagon-scene.lifecycle.test.ts`
   - verifies frustum/visibility detach on destroy
   - verifies no control-listener growth across remount loops
3. `client/apps/game/src/three/game-renderer.lifecycle.test.ts`
   - verifies memory-monitor globals are cleared
   - verifies GUI folders are cleaned when created
4. `client/apps/game/src/three/managers/army-manager.lifecycle.test.ts`
   - verifies `PathRenderer.dispose()` is invoked by owner teardown
5. `client/apps/game/src/three/managers/points-label-renderer.test.ts`
   - verifies texture disposal semantics

### Verification Scenarios

1. Recreate loop:
   - create renderer
   - initialize scenes
   - destroy renderer
   - recreate renderer
   - assert stable listener/global/folder counts
2. Worldmap-only teardown:
   - instantiate worldmap
   - call destroy
   - assert all scene-owned managers were destroyed
3. Memory monitor enabled path:
   - enable feature flag in test
   - assert globals exist after init
   - assert globals removed after destroy

## Acceptance Criteria

1. Every P0 finding is protected by a failing-first lifecycle test.
2. Destroying `WorldmapScene` invokes all owned manager/FX destroy methods exactly once.
3. Destroying `HexagonScene` fully detaches frustum/visibility listeners from shared controls.
4. No reviewed `window` globals survive destroy.
5. `ArmyManager.destroy()` fully tears down `PathRenderer`.
6. GUI folder count does not grow after destroy/recreate loops in test.
7. Points-label renderers explicitly dispose or transfer texture ownership with tests documenting the rule.
8. `pnpm --dir client/apps/game exec vitest run src/three` passes in the implementation environment.
9. `pnpm --dir client/apps/game exec eslint src/three` passes for touched files with no new debt.

## Risks and Mitigations

1. Risk: Teardown fixes break scene re-entry because some singletons were implicitly persistent.
   - Mitigation: Add recreate-loop tests before refactoring singleton ownership.
2. Risk: Overlapping ownership causes double-dispose on shared textures/materials.
   - Mitigation: Document ownership in code and enforce it with explicit tests.
3. Risk: GUI cleanup changes break dev tooling workflows.
   - Mitigation: Treat GUI folders as tracked resources rather than removing GUI support.
4. Risk: Visibility-manager changes regress worldmap chunk visibility behavior.
   - Mitigation: Keep current visibility behavior tests green and add listener-count tests alongside.

## Rollout Strategy

1. Land P0 lifecycle fixes first behind tests, without combining with unrelated optimization work.
2. Land singleton and GUI cleanup second once top-level destroy ownership is stable.
3. Land residual resource-disposal fixes last.

## Residual Follow-Up Backlog

1. Review destroy-race behavior around transition fade callbacks and async environment-map loading.
2. Audit non-`three` but tightly-coupled teardown surfaces, especially Torii stream shutdown behavior.
3. Add a lightweight DEV diagnostic for listener/global/folder counts after renderer destroy.
