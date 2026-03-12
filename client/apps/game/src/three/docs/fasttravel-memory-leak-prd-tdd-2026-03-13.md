# PRD: Fast-Travel Memory Leak Stabilization

## Overview

- Feature: fast-travel memory stabilization and inactive-scene memory shedding for `client/apps/game/src/three`
- Status: Draft v0.1
- Owner: Three.js Team
- Created: 2026-03-13
- Scope: `FastTravelScene`, shared path rendering, scene-switch lifecycle, and worldmap retention that remains resident while fast travel is active

## Executive Summary

The current fast-travel memory spike is not one bug.

It is a stack of lifetime problems:

1. fast-travel allocates and rebuilds Three resources without fully disposing them
2. fast-travel teardown does not fully run on destroy or scene switch-off
3. `PathRenderer` is a process singleton even though multiple scenes initialize it with different scene ownership
4. entering fast travel does not shed the inactive worldmap cache footprint
5. worldmap hydration fetches can continue after switch-off, which keeps memory and network pressure alive behind fast travel

The consequence is predictable resident-memory growth:

1. worldmap memory remains resident
2. fast-travel adds its own chunk/render allocations on top
3. scene-local listeners and path resources are not fully released
4. repeated scene entry magnifies both retained memory and transient allocation spikes

## Problem Statement

Fast travel is expected to be a lightweight scene. In the current implementation it is not lightweight in lifecycle terms.

Three separate ownership models are mixed together:

1. scene-owned resources that should die on switch-off or destroy
2. shared singletons that silently change scene ownership
3. inactive scene caches that stay alive after route transitions

Because those models are not reconciled, memory does not return toward baseline after entering or leaving fast travel. This makes the scene appear to leak even when part of the spike is actually retained worldmap state.

## Goals

1. Make fast-travel switch-off and destroy deterministic.
2. Remove cross-scene resource ownership ambiguity from path rendering.
3. Dispose all fast-travel GPU resources created during chunk refreshes.
4. Ensure inactive worldmap memory is explicitly shed when fast travel becomes active.
5. Prevent in-flight worldmap hydration work from surviving into fast travel without ownership or cancellation.
6. Add regression tests that prove memory-related lifecycles without relying on manual profiling.

## Non-Goals

1. Rewriting all worldmap chunking behavior.
2. Changing gameplay semantics of travel or chunk hydration.
3. Broad renderer architecture changes outside the surfaces listed here.
4. Visual redesign of fast travel.

## Confirmed Findings

### P0: `PathRenderer` has invalid lifetime ownership across scenes

Evidence:

1. `GameRenderer` constructs `WorldmapScene` before `FastTravelScene`, so both scenes initialize the same singleton:
   - `client/apps/game/src/three/game-renderer.ts:847`
   - `client/apps/game/src/three/game-renderer.ts:851`
2. `ArmyManager` initializes the singleton for worldmap:
   - `client/apps/game/src/three/managers/army-manager.ts:248`
3. `FastTravelScene` initializes the same singleton again for a different scene:
   - `client/apps/game/src/three/scenes/fast-travel.ts:90`
   - `client/apps/game/src/three/scenes/fast-travel.ts:91`
4. `PathRenderer.initialize()` overwrites `scene`, creates a new mesh, and registers a new `resize` listener without disposing or detaching the previous mesh/listener when the scene changes:
   - `client/apps/game/src/three/managers/path-renderer.ts:82`
   - `client/apps/game/src/three/managers/path-renderer.ts:107`

Impact:

1. leaked mesh/material/geometry instances when ownership changes
2. leaked `window.resize` listeners
3. wrong-scene path attachment risk
4. retained path buffers across scene boundaries

Required fix:

Make path rendering scene-owned, not process-singleton. The preferred remediation is to remove `getInstance()` usage from scene code and instantiate a separate renderer per owner.

### P0: Fast-travel destroy bypasses its own switch-off cleanup

Evidence:

1. fast-travel registers a `MapControls` change listener and a debounced timeout:
   - `client/apps/game/src/three/scenes/fast-travel.ts:145`
   - `client/apps/game/src/three/scenes/fast-travel.ts:166`
2. those are only cleaned by `disposeFastTravelStoreSubscriptions()`
3. `destroy()` does not call `onSwitchOff()` or `runWarpTravelSwitchOffLifecycle()` before delegating to base destroy:
   - `client/apps/game/src/three/scenes/fast-travel.ts:266`

Impact:

1. retained control listeners when the renderer is destroyed while fast travel is active
2. retained pending timeout callbacks
3. stale scene references remaining reachable through listener closures

Required fix:

`FastTravelScene.destroy()` must run switch-off cleanup exactly once before scene teardown.

### P0: Fast-travel switch-off does not release fast-travel runtime memory

Evidence:

1. scene transitions only call `previousScene.onSwitchOff()`:
   - `client/apps/game/src/three/scene-manager.ts:68`
2. fast-travel `onSwitchOff()` only delegates to the shared warp-travel lifecycle:
   - `client/apps/game/src/three/scenes/fast-travel.ts:238`
3. that lifecycle only removes subscriptions/label attachments; it does not clear fast-travel surface/content groups, interactive hexes, hydrated chunk state, anchors, demo entity arrays, or path state
4. fast-travel render state is only cleared during `prepareFastTravelInitialSetup()` or `destroy()`:
   - `client/apps/game/src/three/scenes/fast-travel.ts:130`
   - `client/apps/game/src/three/scenes/fast-travel.ts:266`

Impact:

1. fast-travel keeps its rendered chunk resident after leaving the scene
2. entering worldmap again layers worldmap residency on top of retained fast-travel residency
3. memory appears to "spike and stay high" across scene toggles

Required fix:

Add a fast-travel runtime reset on switch-off that clears render groups, interactive hexes, hydrated state, selected-state helpers, and path state.

### P1: Fast-travel chunk refresh leaks line resources and churns excessive geometry

Evidence:

1. `disposeGroupChildren()` only disposes `Mesh` instances directly or in traversal:
   - `client/apps/game/src/three/scenes/fast-travel.ts:579`
2. the floor is built from `LineSegments`, `EdgesGeometry`, and `LineBasicMaterial`:
   - `client/apps/game/src/three/scenes/fast-travel.ts:609`
   - `client/apps/game/src/three/scenes/fast-travel.ts:615`
3. the temporary `ShapeGeometry` used to derive edges is never disposed:
   - `client/apps/game/src/three/scenes/fast-travel.ts:607`

Impact:

1. chunk refreshes leak line geometries/materials
2. even when not strictly leaked, per-refresh geometry churn is much higher than necessary
3. chunk traversal can generate large transient heap pressure

Required fix:

Dispose all renderable `Object3D` geometry/material types, not just `Mesh`, and replace per-tile geometry/material creation with shared or pooled resources.

### P1: `SelectedHexManager` does not expose teardown even though `Particles` does

Evidence:

1. fast-travel creates `SelectedHexManager` during construction:
   - `client/apps/game/src/three/scenes/fast-travel.ts:88`
2. `SelectedHexManager` wraps `Particles` but exposes no `dispose()`
   - `client/apps/game/src/three/managers/selected-hex-manager.ts:4`
3. `Particles` explicitly owns scene-attached `Points` and `PointLight` and has a real `dispose()`:
   - `client/apps/game/src/three/managers/particles.ts:56`
   - `client/apps/game/src/three/managers/particles.ts:115`

Impact:

1. particle geometry/material/light are only removed indirectly by `scene.clear()`
2. fast-travel cannot explicitly release that resource during switch-off or destroy

Required fix:

Add `SelectedHexManager.dispose()` and call it from fast-travel runtime reset and destroy.

### P1: Inactive worldmap cache footprint survives while fast travel is active

Evidence:

1. switching scenes only calls `onSwitchOff()`, not `destroy()`:
   - `client/apps/game/src/three/scene-manager.ts:68`
2. `WorldmapScene.onSwitchOff()` clears request bookkeeping but does not call `clearCache()`:
   - `client/apps/game/src/three/scenes/worldmap.tsx:2410`
   - `client/apps/game/src/three/scenes/worldmap.tsx:2444`
3. the actual matrix/pool disposal is in `clearCache()`:
   - `client/apps/game/src/three/scenes/worldmap.tsx:3272`

Impact:

1. fast travel inherits the last worldmap memory peak
2. resident memory remains high even if fast-travel itself is fixed

Required fix:

Introduce scene-switch memory shedding for worldmap when the destination is fast travel, or a general inactive-scene cache-release contract.

### P1: Worldmap hydration fetches survive scene switch-off

Evidence:

1. chunk hydration starts the primary fetch and surrounding prefetch work:
   - `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.ts:21`
   - `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.ts:25`
2. worldmap tracks fetches in `pendingChunks`:
   - `client/apps/game/src/three/scenes/worldmap.tsx:3793`
3. switch-off clears the dedupe maps but does not abort underlying Torii work:
   - `client/apps/game/src/three/scenes/worldmap.tsx:2444`
   - `client/apps/game/src/three/scenes/worldmap.tsx:3844`

Impact:

1. stale fetches can finish after the scene is inactive
2. rapid scene toggles can trigger duplicated area fetches
3. memory and network pressure continue behind fast travel

Required fix:

Track abortable fetch ownership and cancel or invalidate in-flight work during switch-off.

### P2: Hydrated refresh queues can survive switch-off

Evidence:

1. hydrated refresh keys are queued in `hydratedChunkRefreshes`:
   - `client/apps/game/src/three/scenes/worldmap.tsx:3284`
2. the flush policy intentionally preserves keys when `currentChunk === "null"`:
   - `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts:405`
3. switch-off does not clear `hydratedChunkRefreshes` or `hydratedRefreshSuppressionAreaKeys`

Impact:

1. stale refresh work can resume after scene re-entry
2. extra forced chunk refreshes increase memory churn

Required fix:

Reset hydrated-refresh queues and suppression state during switch-off memory shedding.

### P3: Global debug hooks and process-lifetime shared caches pollute memory baselines

Evidence:

1. some debug helpers still install globals outside the normal renderer debug-global lifecycle:
   - `client/apps/game/src/three/utils/hex-geometry-debug.ts:83`
   - `client/apps/game/src/three/utils/easing.ts:123`
   - `client/apps/game/src/three/managers/army-model.ts:1999`
2. contact-shadow resources are cached for process lifetime and are not cleared by `GameRenderer.destroy()`:
   - `client/apps/game/src/three/utils/contact-shadow.ts:8`
   - `client/apps/game/src/three/game-renderer.ts:1416`

Impact:

1. renderer recreation is not a full cleanup boundary
2. leak baselines become noisy in dev profiling
3. retained memory is probably bounded, but it makes regression analysis harder

Required fix:

Keep this as a follow-up hardening slice after the P0/P1 work. The immediate fast-travel program should at least document these residual global roots so memory validation accounts for them.

## Product Requirements

### Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | `FastTravelScene.destroy()` must always run fast-travel switch-off cleanup before base scene destroy. | P0 |
| FR-2 | Switching away from fast travel must release fast-travel render groups, interactive hexes, selected-state helpers, and path state. | P0 |
| FR-3 | Path rendering must have explicit per-scene ownership with no singleton scene handoff. | P0 |
| FR-4 | Fast-travel chunk refresh teardown must dispose `LineSegments` resources and temporary geometries. | P1 |
| FR-5 | `SelectedHexManager` must expose and run deterministic disposal. | P1 |
| FR-6 | Switching from worldmap to fast travel must release inactive worldmap caches according to a defined policy. | P1 |
| FR-7 | In-flight worldmap tile fetches must be abortable or invalidated on switch-off so they cannot outlive scene ownership. | P1 |
| FR-8 | Hydrated refresh queues must reset on switch-off. | P2 |

### Non-Functional Requirements

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-1 | No production change lands without a failing test first. | P0 |
| NFR-2 | Ten `WorldMap -> FastTravel -> WorldMap` cycles must show no net listener growth for `controls` and `window.resize`. | P0 |
| NFR-3 | Fast-travel exit must return retained heap toward pre-entry baseline after cleanup; target delta is under 50 MB in the browser harness after explicit GC. | P0 |
| NFR-4 | GPU resource counts (`renderer.info.memory`) must not monotonically increase across repeated fast-travel chunk refreshes. | P1 |
| NFR-5 | Fixes must not regress chunk hydration correctness or scene-switch behavior. | P1 |

## Proposed Design

### D1: Make path rendering scene-owned

Preferred direction:

1. remove `PathRenderer` singleton usage from `ArmyManager` and `FastTravelScene`
2. instantiate one `PathRenderer` per scene owner
3. treat `PathRenderer.dispose()` as local owner cleanup

Rationale:

1. two scenes exist at once in the renderer
2. both scenes can legitimately own path visuals
3. singleton scene reassignment is the core lifetime flaw

Fallback direction if singleton removal is too broad:

1. add an explicit ownership-transfer API that disposes prior mesh/listener state before rebind
2. still forbid simultaneous multi-scene use

This fallback is not preferred because it preserves a fragile global resource.

### D2: Add fast-travel runtime reset on switch-off

Add a named helper, for example `resetFastTravelRuntimeState()`, called from switch-off and destroy. It must:

1. clear travel surface/content groups
2. clear interactive hexes
3. clear current hydrated chunk/render state/entity anchors
4. clear selected army / preview target / scene armies / scene spires
5. clear any fast-travel path renderer state owned by the scene
6. dispose or reset selected-hex visuals
7. cancel pending debounce timeouts

### D3: Replace per-refresh geometry churn with reusable render assets

Fast-travel currently recreates tile edges and entity meshes per chunk refresh. Replace this with:

1. shared hex edge geometry and line material
2. shared army marker geometry/material
3. shared spire geometries/materials
4. explicit disposal only when the scene owner dies

This reduces both transient heap churn and GPU object churn.

### D4: Add worldmap inactive-scene memory shedding

There are two viable approaches:

1. extend `onSwitchOff(nextScene)` so worldmap can shed caches only when entering fast travel
2. add a second scene-manager hook such as `releaseInactiveResources(nextScene)`

Preferred direction:

Use `onSwitchOff(nextScene)` so the release policy stays close to the scene that owns the memory.

Worldmap release for fast-travel transitions must:

1. call `clearCache()`
2. clear tile-entity cache if safe
3. reset hydrated refresh queues
4. unregister tracked visibility chunks

### D5: Make worldmap fetches abortable

Introduce fetch ownership objects keyed by render area:

1. `promise`
2. `abortController`
3. `ownerToken`

Switch-off must abort all active fetches before dropping dedupe maps. Completion handlers must ignore aborted or stale-owner results.

## TDD Plan

### T0: Baseline lifecycle coverage

Write failing tests first for the bugs above.

New tests:

1. `client/apps/game/src/three/scenes/fast-travel.lifecycle.test.ts`
   - `destroy()` runs switch-off cleanup
   - `onSwitchOff()` clears fast-travel runtime state
   - no net `controls` listener growth after setup/switch-off loops
2. `client/apps/game/src/three/managers/path-renderer.scene-ownership.test.ts`
   - initializing on a second scene fails under old behavior
   - final expected behavior proves scene-local ownership and cleanup
3. `client/apps/game/src/three/scenes/fast-travel-render-resource-cleanup.test.ts`
   - line resources and temp geometries are disposed on refresh/reset
4. `client/apps/game/src/three/managers/selected-hex-manager.test.ts`
   - `dispose()` delegates to `Particles.dispose()`
5. `client/apps/game/src/three/scenes/worldmap-switch-off-memory.test.ts`
   - switching to fast travel releases inactive caches
   - hydrated refresh queues are cleared
6. `client/apps/game/src/three/scenes/worldmap-fetch-abort.test.ts`
   - switch-off aborts active fetch ownership
   - stale completions do not repopulate caches

### T1: Fix fast-travel teardown first

Red:

1. add failing `FastTravelScene.destroy()` and `onSwitchOff()` lifecycle tests

Green:

1. centralize fast-travel switch-off cleanup
2. make destroy idempotent
3. dispose selected-hex visuals

Refactor:

1. extract a small pure helper if state reset becomes dense

### T2: Fix path-renderer ownership second

Red:

1. prove that a second `initialize(scene)` currently creates an extra listener / mesh without releasing the first owner

Green:

1. remove singleton usage or add explicit ownership transfer
2. update worldmap army manager and fast travel to own distinct instances

Refactor:

1. collapse ownership cleanup into manager/scene lifecycle helpers

### T3: Fix fast-travel render-resource leakage and churn

Red:

1. prove `LineSegments` resources are not disposed by current cleanup
2. prove temp `ShapeGeometry` leaks under current creation path

Green:

1. teach cleanup to dispose line renderables
2. remove temp geometry leak
3. replace repeated geometry/material creation with reusable assets

Refactor:

1. extract reusable mesh factories or scene-owned shared assets

### T4: Fix worldmap retention under fast travel

Red:

1. prove worldmap cache memory state remains populated after switch-off-to-fast-travel
2. prove in-flight fetch ownership survives switch-off

Green:

1. release caches on switch-off to fast travel
2. abort or invalidate active fetches
3. clear hydrated refresh queues

Refactor:

1. isolate worldmap memory-shedding policy behind named helpers

## Verification Plan

### Automated

1. targeted tests for each slice during red-green-refactor
2. touched cluster:
   - `pnpm --dir client/apps/game test src/three/scenes/fast-travel*.test.ts`
   - `pnpm --dir client/apps/game test src/three/managers/path-renderer*.test.ts`
   - `pnpm --dir client/apps/game test src/three/scenes/worldmap-*memory*.test.ts`
   - `pnpm --dir client/apps/game test src/three/scenes/worldmap-runtime-lifecycle.test.ts`
   - `pnpm --dir client/apps/game test src/three/game-renderer.lifecycle.test.ts`

### Browser Validation

1. record a baseline heap snapshot in worldmap
2. enter fast travel, pan across several chunk boundaries, exit, repeat 10 times
3. verify:
   - retained heap returns near baseline after GC
   - `renderer.info.memory.geometries` and `textures` stabilize
   - listener counts remain flat
   - no duplicate tile fetches continue after scene switch

Recommended harness:

1. Chromium with exposed GC in a local profiling run
2. one scripted route-switch scenario for reproducibility

## Implementation Progress

- [x] M1: Fast-travel ownership cleanup
- [x] M2: Path-renderer de-singletonization
- [ ] M3: Fast-travel render-path stabilization
- [ ] M4: Worldmap inactive-scene shedding

## Milestones

### M0: Lock failing tests

Deliverables:

1. lifecycle coverage for fast travel
2. scene-ownership coverage for path renderer
3. switch-off worldmap memory-shedding coverage

### M1: Fast-travel ownership cleanup

Deliverables:

1. fast-travel switch-off runtime reset
2. deterministic destroy path
3. selected-hex disposal

### M2: Path-renderer de-singletonization

Deliverables:

1. per-scene path renderer ownership
2. no leaked `resize` listeners
3. no cross-scene mesh retention

### M3: Fast-travel render-path stabilization

Deliverables:

1. line resource disposal fix
2. shared/pool-based geometry/material reuse
3. stable resource counts during chunk traversal

### M4: Worldmap inactive-scene shedding

Deliverables:

1. cache release on fast-travel transition
2. abortable tile fetches
3. hydrated refresh queue reset

## Risks

1. Releasing worldmap caches on every switch could hurt resume latency if applied too broadly.
2. De-singletonizing `PathRenderer` may surface hidden assumptions in army-path selection behavior.
3. Abortable fetch ownership needs careful stale-result handling to avoid empty or partially hydrated chunks after quick scene toggles.

## Open Questions

1. Should worldmap cache shedding happen only when the destination is `FastTravel`, or for every inactive scene transition?
2. Is fast-travel expected to preserve any state across switch-off, or can it always rebuild from URL/camera state?
3. Do we want a permanent browser-memory regression harness in CI, or only deterministic unit/lifecycle tests plus manual profiling?
