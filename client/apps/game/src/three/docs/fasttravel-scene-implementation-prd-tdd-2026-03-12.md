# PRD: FastTravel Scene Implementation TDD

## Overview

- Feature: concrete `FastTravelScene` implementation on top of the shared `WarpTravel` runtime
- Status: Draft
- Owner: Three.js Team
- Created: 2026-03-12
- Last Updated: 2026-03-12

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                                                           |
| ------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| U1     | 2026-03-12 00:00 | Codex  | Created TDD PRD for the concrete fast-travel scene after the shared `WarpTravel` refactor landed and dedicated seam tests were verified green. |
| U2     | 2026-03-12 00:00 | Codex  | Resolved product direction: no terrain, fully explored pink warp-space shader layer, visible stubbed Spires, and map-first scope with interactions deferred. |
| U3     | 2026-03-12 00:00 | Codex  | Completed M0 by activating the fast-travel boundary, registering the concrete scene stub in `GameRenderer`, and locking renderer routing/update seams with fail-first tests. |
| U4     | 2026-03-12 00:00 | Codex  | Completed M1 by turning `FastTravelScene` into a named-hook `WarpTravel` lifecycle shell and locking the lifecycle seam with focused tests plus shared runtime regressions. |
| U5     | 2026-03-12 00:00 | Codex  | Completed M2 and M3 by adding fast-travel chunk hydration/render-state adapters, stubbed Spire and army scene visuals, and a no-ground fully explored warp-space render path. |
| U6     | 2026-03-12 00:00 | Codex  | Completed M4 by adding explicit Spire mapping/navigation policy modules plus world/travel navigation helpers that preserve non-Spire fallback behavior. |
| U7     | 2026-03-12 00:00 | Codex  | Completed M5 by rerunning the targeted/shared suites, updating the Three.js architecture note for the live fast-travel scene, and documenting the remaining unrelated module-gate blockers. |

## Executive Summary

The shared scene refactor is complete enough to start the actual fast-travel layer.

Current state:

1. `WarpTravel` exists as the shared runtime seam.
2. `SceneName.FastTravel` exists.
3. route parsing and navigation boundary scaffolding exist.
4. the concrete fast-travel scene is still not registered or implemented.

This PRD defines the next phase: build the real `FastTravelScene`, feed it data, wire Spire-driven navigation, and
protect the rollout with fail-first tests.

## Problem Statement

We now have the shared runtime needed to avoid a `worldmap.tsx` fork, but the actual player-facing fast-travel layer
does not exist yet.

Current gaps:

1. No `FastTravelScene` class is registered in the renderer.
2. Navigation boundary support for fast travel is still dormant.
3. No fast-travel chunk hydration or entity adapter exists.
4. No Spire enter/exit mapping exists between world map and the fast-travel layer.
5. No tests yet lock concrete fast-travel behavior.

## Goals

1. Implement a concrete `FastTravelScene` on top of `WarpTravel`.
2. Reuse existing managers and interaction patterns wherever possible.
3. Make entry and exit happen through Spires on the world map.
4. Keep the implementation TDD-first and regression-safe.
5. Preserve current world map behavior while adding the new layer.

## Non-Goals

1. Reworking the shared `WarpTravel` architecture unless concrete gaps are exposed by tests.
2. Redesigning army rendering or movement systems.
3. Large UI redesign outside fast-travel-specific flows.
4. Shipping every possible fast-travel gameplay rule in the first PR.
5. Replacing world-map navigation semantics unrelated to Spire travel.

## Current State

### Already Implemented

1. `WarpTravel` lifecycle scaffold
2. shared chunk-runtime helpers
3. shared prefetch helpers
4. shared fanout helpers
5. dormant `SceneName.FastTravel`
6. dormant route and navigation boundary support

### Not Yet Implemented

1. concrete `FastTravelScene`
2. renderer registration
3. scene rendering/update integration
4. fast-travel chunk hydration and entity source
5. Spire world-map to fast-travel navigation mapping
6. fast-travel click/selection behavior

## Product Intent

The fast-travel layer is a world-map-like traversal surface for units.

Behavioral intent:

1. Units enter the layer from Spires on the world map.
2. Units move around this layer using the same broad interaction language as the world map.
3. Units exit the layer through corresponding Spires or travel nodes.
4. The user should experience it as a second map layer, not as a different game mode.

Visual intent:

1. The fast-travel layer has no terrain.
2. The layer is fully explored from the first frame.
3. The map identity is a pink glowing warp-space.
4. A dedicated shader should carry most of that visual identity.
5. Spires remain visible as anchors, with stubbed visuals acceptable in the first pass.

## Proposed Architecture

## Concrete Scene

Introduce:

1. `client/apps/game/src/three/scenes/fast-travel.ts`

Responsibilities:

1. extend `WarpTravel`
2. own fast-travel-specific scene data and subscriptions
3. configure fast-travel lifecycle adapter hooks
4. drive `ArmyManager` and any travel-node / structure manager reuse
5. expose scene-specific hex entity lookup and interaction behavior

## Data Boundary

Introduce a fast-travel-specific adapter module, tentatively:

1. `fast-travel-chunk-hydration.ts`
2. `fast-travel-navigation-policy.ts`
3. `fast-travel-spire-mapping.ts`

Responsibilities:

1. derive visible chunk data for the fast-travel layer
2. map world-map Spire positions to fast-travel entry nodes
3. map fast-travel exits back to world-map Spires
4. provide the entity state required by existing managers
5. prepare fully explored shader-friendly hex-layer state for warp-space rendering

## Reuse Strategy

Reuse as-is where possible:

1. `WarpTravel`
2. `HexagonScene`
3. `ArmyManager`
4. `HoverLabelManager`
5. `SelectedHexManager`
6. `SelectionPulseManager`
7. scene manager and transition flow

Avoid copying:

1. `WorldmapScene`
2. world-map ECS subscriptions
3. world-map action-path rules
4. world-map structure/chest assumptions

## TDD Operating Model

### Iron Rule

No fast-travel production code lands without a failing test first.

### Per-Slice Protocol

1. `RED`
   - add one failing test for one concrete fast-travel behavior
   - run only the targeted test
   - confirm failure is due to missing implementation
2. `GREEN`
   - implement the smallest change to pass
   - re-run the targeted test
3. `REFACTOR`
   - clean up names or extraction only after green
   - re-run the affected cluster

### Required Test Commands

1. Targeted loop:
   - `pnpm --dir client/apps/game test src/three/<path>/<file>.test.ts`
2. Focused fast-travel suite:
   - `pnpm --dir client/apps/game test src/three/scenes/fast-travel*.test.ts`
3. Shared regression suite:
   - `pnpm --dir client/apps/game test src/three/scenes/warp-travel*.test.ts src/three/scenes/worldmap-shared-runtime.test.ts`
4. Module gate:
   - `pnpm --dir client/apps/game test src/three`

## Scope

### In Scope

1. Concrete `FastTravelScene` class.
2. Renderer registration and active-scene rendering integration.
3. Navigation boundary activation for fast-travel routes.
4. Spire entry/exit mapping and policy.
5. Fast-travel chunk hydration and entity fanout.
6. Pink glowing warp-space hex rendering via shader-backed map layer.
7. Stubbed visible Spire anchors in the fast-travel scene.
8. Focused regression tests for world map and shared runtime.

### Out of Scope

1. Broad art direction work beyond the agreed warp-space shader treatment.
2. Deep economy/system-rule changes outside traversal.
3. Replacing current world-map structure or army manager implementations.
4. Non-Spire travel entry points.
5. Broad URL/router architecture changes beyond fast-travel support.
6. Full traversal interaction/action system in this first map-delivery PR.

## Milestones

### M0: Registration and Dormant-to-Active Bootstrap (0.5-1 day) [x]

Objective:

Turn the existing dormant bootstrap into a real scene registration path without breaking current scenes.

Deliverables:

1. failing-first tests for route resolution and renderer registration
2. `FastTravelScene` stub registered in `GameRenderer`
3. active-scene render/update path handles fast travel without affecting current scenes

Exit Criteria:

1. Fast-travel route can resolve to a registered scene.
2. Existing world map and hex scenes still behave correctly.

Completion Notes:

1. `scene-navigation-boundary.test.ts` now locks the enabled-by-default fast-travel route while preserving the explicit disable override.
2. `game-renderer.fast-travel-registration.test.ts` locks renderer registration, boundary-aware URL handling, and active fast-travel update/render branching.
3. `FastTravelScene` is now registered in `GameRenderer` and receives environment, weather, quality, update, and destroy lifecycle handling alongside the existing scenes.

### M1: Scene Skeleton and Lifecycle Wiring (1 day) [x]

Objective:

Create the concrete scene shell on top of `WarpTravel`.

Deliverables:

1. `FastTravelScene extends WarpTravel`
2. lifecycle adapter implementation
3. label-group and manager lifecycle parity with worldmap-style behavior
4. failing-first tests for setup, resume, and switch-off

Exit Criteria:

1. `FastTravelScene` participates in scene switching correctly.
2. Shared runtime tests stay green.

Completion Notes:

1. `fast-travel.test.ts` now locks `FastTravelScene` as a concrete `WarpTravel` scene with named lifecycle hooks rather than anonymous inline adapter lambdas.
2. `FastTravelScene` now has explicit setup, initial-setup, label attach/detach, refresh, error-report, and subscription lifecycle methods that match the shared `WarpTravelLifecycleAdapter` seam.
3. `warp-travel.test.ts` and `worldmap-shared-runtime.test.ts` were rerun green to keep the scene shell aligned with the shared runtime contract.

### M2: Fast-Travel Chunk Hydration and Entity Runtime (2-3 days) [x]

Objective:

Feed the scene with real fast-travel-layer data while reusing existing managers.

Deliverables:

1. fast-travel chunk hydration adapter
2. army/entity fanout into existing managers
3. fast-travel hex entity lookup
4. failing-first tests for chunk hydration, manager updates, and empty-chunk behavior
5. visible stubbed Spire anchors in hydrated scene state

Exit Criteria:

1. Units can appear and update correctly in the fast-travel layer.
2. Shared `WarpTravel` runtime does not require further architectural churn.

Completion Notes:

1. `fast-travel-hydration.ts` now hydrates visible armies and stubbed Spire anchors into a chunk-scoped entity lookup plus stable manager payloads.
2. `FastTravelScene` now refreshes itself from the hydration adapter and exposes hydrated chunk/entity lookup state for follow-on interaction work.
3. Stubbed army and Spire visuals are now rendered into the scene from hydrated chunk state, with controls-driven refresh support in `GameRenderer`.

### M3: Warp-Space Map Rendering (1-2 days) [x]

Objective:

Render the layer as a fully explored glowing warp-space hex field without terrain.

Deliverables:

1. shader-backed pink glowing hex map layer
2. no-terrain render path for fast travel
3. failing-first tests for fully explored visibility assumptions and render-state preparation
4. visual seam ready for future polish without changing core scene contracts

Exit Criteria:

1. The fast-travel layer is visually distinct from the world map.
2. No terrain-specific world-map assumptions leak into the fast-travel scene.

Completion Notes:

1. `fast-travel-rendering.ts` now prepares a fully explored `terrainMode: "none"` render state plus explicit pink warp-space shader uniforms for the visible hex window.
2. `HexagonScene` now exposes a `shouldCreateGroundMesh()` hook, and `FastTravelScene` opts out so the shared worldmap terrain mesh is not created.
3. `FastTravelScene` uses the render-state palette to color the warp-space background plus the stubbed Spire and army markers.

### M4: Spire Navigation Boundary (1-2 days) [x]

Objective:

Make world-map Spires the entry and exit points for the new layer.

Deliverables:

1. Spire mapping policy
2. enter-fast-travel transition path from world map
3. exit path back to world map
4. failing-first tests for scene target resolution and mapping edge cases

Exit Criteria:

1. Spire travel transitions are deterministic and test-protected.
2. Non-Spire navigation remains unchanged.

Completion Notes:

1. `fast-travel-spire-mapping.ts` now owns deterministic lookup between world-map Spire coordinates and fast-travel entry/exit coordinates.
2. `fast-travel-navigation-policy.ts` now resolves world-to-travel entry and travel-to-world exit transitions with explicit scene/coordinate outputs.
3. `three/utils/navigation.ts` now exposes `navigateIntoFastTravelSpire()` and `navigateOutOfFastTravelSpire()` while preserving the default non-Spire map/hex navigation paths.

### M5: Hardening and Closeout (0.5-1 day) [x]

Objective:

Verify the new scene and capture follow-up work.

Deliverables:

1. targeted fast-travel test suite green
2. shared runtime regression suite green
3. residual risks and follow-up backlog documented
4. next interaction-focused phase clearly split out

Exit Criteria:

1. Fast-travel scene is integrated without regressions in shared runtime behavior.
2. Remaining interaction work is documented as the next explicit phase, not hidden debt.

Completion Notes:

1. The focused fast-travel plus shared-runtime regression cluster was rerun green across 56 tests covering the boundary, fast-travel adapters, `WarpTravel`, and `worldmap-shared-runtime`.
2. The full `pnpm --dir client/apps/game test src/three` module gate was attempted and remains blocked by unrelated pre-existing issues outside this slice:
   - `army-model.visibility.test.ts` fails on the `ResourcesIds` circular-import path inside `packages/types`
   - several jsdom suites still trip the `html-encoding-sniffer` / `@exodus/bytes` ESM loader error
3. `README.md` now reflects that `FastTravelScene` is registered and active rather than describing it as a dormant bootstrap.

## Prioritized Slice Backlog

1. [x] S1 (P0): Add failing test proving `/travel` resolves to `SceneName.FastTravel` only when boundary activation is
   enabled.
2. [x] S2 (P0): Add failing test proving `GameRenderer` registers a concrete fast-travel scene.
3. [x] S3 (P0): Add failing test proving active-scene render/update path handles fast-travel the same way it handles map/hex.
4. [x] S4 (P0): Add failing test proving `FastTravelScene` setup/resume/switch-off lifecycle delegates through `WarpTravel`.
5. [x] S5 (P1): Add failing test proving empty fast-travel chunks do not break manager fanout.
6. [x] S6 (P1): Add failing test proving fast-travel chunk hydration can populate armies into the scene.
7. [x] S7 (P1): Add failing test proving fast-travel scene prepares a fully explored no-terrain render state.
8. [x] S8 (P1): Add failing test proving warp-space shader inputs are prepared for the visible hex window.
9. [x] S9 (P1): Add failing test proving stubbed Spire anchors appear in fast-travel hydrated scene state.
10. [x] S10 (P1): Add failing test proving Spire mapping resolves world-map entry to fast-travel destination.
11. [x] S11 (P1): Add failing test proving exit travel maps back to the correct world-map Spire.
12. [x] S12 (P1): Add failing test proving non-Spire world-map navigation remains unchanged.
13. [x] S13 (P2): Document residual risks and the next interaction-focused backlog.

## Test Strategy

### New Test Files

1. `client/apps/game/src/three/scenes/fast-travel.test.ts`
2. `client/apps/game/src/three/scenes/fast-travel-hydration.test.ts`
3. `client/apps/game/src/three/scenes/fast-travel-navigation-policy.test.ts`
4. `client/apps/game/src/three/scene-navigation-boundary.test.ts`
5. `client/apps/game/src/three/scenes/fast-travel-rendering.test.ts`

### Existing Test Files Likely To Expand

1. `client/apps/game/src/three/game-renderer-policy.test.ts`
2. `client/apps/game/src/three/scene-manager.test.ts`
3. `client/apps/game/src/three/scenes/warp-travel.test.ts`
4. `client/apps/game/src/three/scenes/worldmap-shared-runtime.test.ts`

### Test Method

1. Lock route and registration behavior first.
2. Use narrow seam tests for scene lifecycle and policy modules.
3. Add focused rendering-state tests for the no-terrain fully explored warp-space layer.
4. Add scene-level tests only where integration behavior matters.
5. Re-run shared `WarpTravel` regression suites after every fast-travel slice.

## Functional Requirements

1. Fast-travel routes resolve to a real concrete scene.
2. `FastTravelScene` participates correctly in setup, resume, switch-off, and transitions.
3. Units can appear and move in the fast-travel layer using reused managers.
4. World-map Spires can enter and exit the fast-travel layer.
5. The fast-travel map renders as a fully explored no-terrain pink glowing warp-space layer.
6. Existing world-map and hex behavior does not regress.

## Non-Functional Requirements

1. Preserve current shared runtime contracts.
2. Avoid net-new duplication of worldmap logic.
3. Keep test suites deterministic and focused.
4. Do not introduce route ambiguity between `map`, `hex`, and `travel`.
5. Keep shader integration isolated so later visual polish does not destabilize scene logic.

## Risks

1. Concrete fast-travel requirements may still expose missing seams in `WarpTravel`.
2. Spire mapping rules may be under-specified and cause churn until a real client-side Spire ECS/model layer lands.
3. Scene registration could accidentally affect current map/hex rendering.
4. Interaction parity could tempt copying worldmap selection logic too directly.
5. Shader work could sprawl into a broader visual rewrite if not kept tightly scoped.
6. The wider `src/three` module gate still has unrelated baseline failures, so a fully clean top-level Three suite is not yet restored by this feature work alone.

## Mitigations

1. Add failing tests before each new fast-travel slice.
2. Keep Spire mapping in dedicated policy modules.
3. Re-run shared runtime regression tests after each slice.
4. Favor adapter modules over copying worldmap logic.
5. Treat the first shader pass as a constrained map identity layer, not a full art pass.

## Success Criteria

1. A concrete `FastTravelScene` is registered and reachable.
2. Spire entry/exit works through explicit mapping and navigation policy.
3. Units are visible and traversable in the fast-travel layer.
4. The map layer renders as the agreed pink glowing warp-space without terrain.
5. Shared runtime and current scene behavior remain green.

## Follow-Up Backlog

1. Replace the scene-local demo Spire/army hydration source with an authoritative client-side Spire/runtime query layer.
2. Reuse the existing `ArmyManager`/label managers for real fast-travel entities once the backing data contract exists.
3. Add the interaction-focused phase: Spire click affordances, selection behavior, and exit confirmation flows on top of the current navigation policy.
4. Clean the unrelated `src/three` module-gate blockers:
   - break the `ResourcesIds` circular import path in `packages/types`
   - resolve the jsdom `html-encoding-sniffer` / `@exodus/bytes` ESM loader failure

## Confirmed Product Decisions

1. Fast travel has no terrain and is fully explored.
2. The map identity is a pink glowing warp-space driven by a shader.
3. Spires are visible and may be stubbed initially.
4. Map delivery comes before interaction delivery.

## Recommended Execution Order

1. Execute M0 and M1 first to make the scene real and switchable.
2. Execute M2 next so the scene can render real unit data and stubbed Spires.
3. Execute M3 to land the warp-space map identity.
4. Execute M4 to wire Spire entry/exit.
5. Close with M5 and split the next interaction-focused phase into a follow-up PRD/implementation.
