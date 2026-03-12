# PRD: Three Runtime Performance Hotspots TDD

## Overview

- Feature: performance hardening program for `client/apps/game/src/three`
- Status: Draft v0.1
- Owner: Three.js Team
- Created: 2026-03-12
- Last Updated: 2026-03-12

## Document Update Log

| Update | Date (AEDT)      | Author | Change                                                                                                  |
| ------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| U1     | 2026-03-12 20:05 | Codex  | Created PRD/TDD from a deep runtime performance review focused on hot-path `O(n)` work and optimizations. |

## Executive Summary

The Three runtime is not dominated by one catastrophic `O(n^2)` bug. The real problem is that several hot paths stack
avoidable `O(n)` work on top of each other:

1. Chunk hydration can render the same worldmap chunk twice.
2. Structure updates still escalate single-entity changes into full visible-set rebuilds.
3. Visibility invalidation recomputes every frame even when nothing changed.
4. Terrain rebuild and cache validation repeatedly rescan the same `48x48` render window.
5. Some subsystems already have indexes or caches, but fallback APIs still use linear scans.

The result is multiplicative work during the exact moments the runtime is already under pressure:

1. cold chunk entry
2. fast pan or zoom
3. live structure or army movement updates
4. pointer hover and selection
5. long-running sessions

This PRD defines a TDD-first hardening program that removes duplicate work before lower-risk micro-optimizations.

## Stage Tracker

- [x] M0: Baseline and guardrails
- [x] M1: Remove duplicated chunk and structure work
- [x] M2: Make structure and terrain updates incremental
- [x] M3: Restore true dirty-only frame behavior
- [x] M4: Replace remaining hot-path linear scans
- [x] M5: Batch DOM and point updates

## Problem Statement

`client/apps/game/src/three` has three broad runtime loops:

1. frame loop: `GameRenderer.animate()` updates controls, scenes, FX, labels, and HUD every render tick
2. chunk loop: worldmap chunk refresh decides whether to switch, prefetch, rebuild terrain, and fan out to managers
3. live-update loop: ECS or store changes mutate armies, structures, tiles, labels, and visibility state between chunk switches

Several subsystems currently do full-collection work in more than one of those loops:

1. worldmap re-enters a full chunk refresh after cold hydration already rendered the chunk
2. structure manager rebuilds all visible structures for both chunk switches and many single-structure updates
3. visibility recomputes and notifies listeners every frame regardless of whether state changed
4. terrain cache validation rescans the render window after terrain generation already traversed it
5. picking and label updates do broad scans or DOM rebuilds where indexed or incremental updates are possible

This creates five concrete risks:

1. frame spikes during cold chunk entry
2. sustained camera-motion churn while panning or tweening
3. slowdowns under bursty live structure updates
4. avoidable heap and DOM churn from label and cache rebuilds
5. degraded performance over long sessions due to monitoring and visibility work that never goes idle

## Runtime Flow Trace

### Scene activation

1. `GameRenderer.handleURLChange()` resolves the target route and calls `SceneManager.switchScene()`.
2. `SceneManager.completeTransition()` sets the active scene and awaits `WorldmapScene.setup()`.
3. `WarpTravel.setup()` enters the shared lifecycle, and worldmap activation immediately calls `updateVisibleChunks(true)`.

### Camera and frame loop

1. `GameRenderer.animate()` runs every frame.
2. It calls `controls.update()` before rendering.
3. During damping, pan, zoom, or scripted camera motion, `MapControls` emits `change`.
4. Renderer-level `change` listeners mark labels dirty and request a worldmap chunk refresh.
5. Worldmap also listens to the same controls changes for camera-target and zoom-threshold policy.

### Chunk refresh loop

1. `WorldmapScene.requestChunkRefresh()` debounces into `flushChunkRefresh()`.
2. `updateVisibleChunks()` waits for any in-flight switch, computes camera ground focus, and resolves one of:
   - no-op
   - directional prefetch
   - switch chunk
   - refresh current chunk
3. `performChunkSwitch()` prepares bounds, updates pinned chunks, hydrates tiles, rebuilds terrain, and then fans out to
   `armyManager.updateChunk()`, `structureManager.updateChunk()`, and `chestManager.updateChunk()`.
4. On cold fetches, `executeTileEntitiesFetch()` can later queue `scheduleHydratedChunkRefresh(this.currentChunk)`,
   which forces `updateVisibleChunks(true)` again for the same current chunk.

### Per-frame scene updates after chunk sync

1. `worldmapScene.update()` runs every render tick.
2. It calls `HexagonScene.update()` first.
3. `HexagonScene.update()` begins visibility work, updates interaction state, lights, thunder, biome animations, and
   instrumentation.
4. Worldmap then updates armies, FX, resource FX, selection pulses, selected hex state, structure animations, and chests.

## Goals

### Primary Goals

1. Remove duplicate chunk work from cold hydration and chunk-switch paths.
2. Make live structure and terrain updates incremental instead of full visible-set rebuilds where possible.
3. Restore dirty-only behavior for visibility and frame instrumentation.
4. Replace broad linear scans in hot paths with bounded overlap math, spatial indexes, or batched updates.
5. Protect each fix with targeted failing tests before production changes.

### Non-Goals

1. Full renderer architecture rewrite.
2. Visual redesign or material tuning.
3. Asset pipeline changes unrelated to runtime cost.
4. Broad gameplay changes outside `src/three`.

## Scope

### In Scope

1. `client/apps/game/src/three/game-renderer.ts`
2. `client/apps/game/src/three/scenes/worldmap.tsx`
3. `client/apps/game/src/three/scenes/warp-travel-*.ts`
4. `client/apps/game/src/three/scenes/worldmap-*.ts`
5. `client/apps/game/src/three/scenes/hexagon-scene.ts`
6. `client/apps/game/src/three/managers/army-manager.ts`
7. `client/apps/game/src/three/managers/army-model.ts`
8. `client/apps/game/src/three/managers/structure-manager.ts`
9. `client/apps/game/src/three/managers/chest-manager.ts`
10. `client/apps/game/src/three/managers/interactive-hex-manager.ts`
11. `client/apps/game/src/three/managers/points-label-renderer.ts`
12. `client/apps/game/src/three/utils/centralized-visibility-manager.ts`
13. `client/apps/game/src/three/utils/frustum-manager.ts`
14. `client/apps/game/src/three/utils/performance-monitor.ts`
15. `client/apps/game/src/three/utils/instanced-matrix-attribute-pool.ts`
16. `client/apps/game/src/three/utils/labels/*`
17. `client/apps/game/src/three/docs/*` updates needed to reflect final performance policy

### Out of Scope

1. Non-Three runtime services
2. UI work outside renderer-driven label behavior
3. Fast-travel product feature expansion unrelated to runtime cost

## Root Causes

### Root Cause 1: duplicate ownership of refresh triggering

Both `GameRenderer` and `WorldmapScene` wake the chunk-refresh pipeline from control changes. Cold fetch completion also
re-enters refresh for a chunk that was already rendered.

### Root Cause 2: full rebuilds where deltas should exist

Structure and terrain paths still prefer whole-window or whole-visible-set rebuilds even when the update payload touches
one entity or one hex.

### Root Cause 3: invalidation bugs negate caches

`CentralizedVisibilityManager` and `PerformanceMonitor` have APIs that look incremental but currently do work every
frame.

### Root Cause 4: indexes exist, but fallback access paths still scan

The runtime already maintains chunk spatial maps and cache keys, yet some hot paths still do broad scans:

1. cached chunk overlap invalidation
2. structure lookup by entity or by hex
3. chest visibility filtering
4. army picking across all loaded instanced meshes

### Root Cause 5: DOM and buffer updates are not consistently batched

Label and points systems frequently rebuild nodes or refresh bounds one item at a time, which turns an otherwise linear
diff into repeated layout or geometry work.

## Baseline Findings

### P0: remove duplicated hot-path work first

#### P0.1 Cold-area hydration renders the current chunk twice

- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:3810`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3841`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3281`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3318`
  - `client/apps/game/src/three/scenes/worldmap.tsx:4613`
- Current behavior:
  - initial switch renders optimistically
  - fetch completion schedules `scheduleHydratedChunkRefresh(this.currentChunk)`
  - worldmap re-enters `updateVisibleChunks(true)` and `refreshCurrentChunk()`
- Cost:
  - second `updateHexagonGrid()`
  - second manager fanout to army, structure, and chest
- Required fix:
  - make cold hydration apply deltas directly to the already-active chunk, or delay first commit until the first fetch
    is ready

#### P0.2 Structure chunk switches perform two full visible-structure rebuilds

- Evidence:
  - `client/apps/game/src/three/managers/structure-manager.ts:1011`
  - `client/apps/game/src/three/managers/structure-manager.ts:1788`
- Current behavior:
  - `updateChunk()` awaits `updateVisibleStructures()`
  - then immediately calls `showLabels()`
  - `showLabels()` calls `updateVisibleStructures()` again
- Cost:
  - duplicate spatial query
  - duplicate model reset and repopulation
  - duplicate point and attachment sync
  - duplicate label diff/removal work
- Required fix:
  - remove the second rebuild from the chunk-switch path
  - redefine `showLabels()` as a visibility-only operation

#### P0.3 Active-chunk structure updates rebuild the whole visible set

- Evidence:
  - `client/apps/game/src/three/managers/structure-manager.ts:926`
  - `client/apps/game/src/three/managers/structure-manager.ts:1067`
- Current behavior:
  - single structure updates inside the current chunk call `updateVisibleStructures()`
  - full visible-structure rebuild follows even for one-entity changes
- Cost:
  - `O(visible structures)` per structure update burst
  - repeated model, point, attachment, and label churn
- Required fix:
  - introduce incremental patching for one-structure changes
  - if full rebuild remains temporarily, coalesce to one rebuild per animation frame

#### P0.4 Visibility recomputes every frame even when camera state is unchanged

- Evidence:
  - `client/apps/game/src/three/utils/centralized-visibility-manager.ts:176`
  - `client/apps/game/src/three/utils/centralized-visibility-manager.ts:522`
  - `client/apps/game/src/three/managers/army-manager.ts:218`
  - `client/apps/game/src/three/managers/structure-manager.ts:271`
- Current behavior:
  - `beginFrame()` increments `currentFrameId`
  - the `frameState.frameId !== this.currentFrameId` check is therefore always true
  - frustum, visible chunks, and listener notifications rerun every frame
- Cost:
  - removes dirty-only behavior from labels and visibility-driven systems
- Required fix:
  - split render frame identity from visibility version
  - recompute and notify only on camera or registration changes

#### P0.5 Performance monitor adds permanent per-frame overhead

- Evidence:
  - `client/apps/game/src/three/utils/performance-monitor.ts:39`
  - `client/apps/game/src/three/utils/performance-monitor.ts:69`
  - `client/apps/game/src/three/utils/performance-monitor.ts:176`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:908`
- Current behavior:
  - monitor is enabled by default
  - every `end()` does `performance.mark()` and `performance.measure()`
  - measures are not cleared
  - metrics use `shift()` plus `reduce()` across the sample window
- Cost:
  - added CPU in the hottest scene path
  - timeline growth across long sessions
- Required fix:
  - disable by default outside dev
  - clear measures immediately if retained
  - replace shift/reduce sampling with running totals or a ring buffer

### P1: collapse repeated linear scans and rebuild passes

#### P1.1 Terrain rebuild does repeated `48x48` scans

- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:3344`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3326`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3947`
  - `client/apps/game/src/three/scenes/worldmap.tsx:4007`
  - `client/apps/game/src/three/scenes/worldmap.tsx:4070`
- Current behavior:
  - one pass generates terrain matrices
  - another full-window pass validates explored coverage
  - another pass rebuilds interactive hexes
  - cached apply path still rescans for validation plus interactivity
- Required fix:
  - compute expected explored coverage during the main generation pass
  - keep interactive-hex bounds stable and avoid `clearHexes()` + repopulate when bounds did not change

#### P1.2 Cache invalidation scans every cached chunk key for one changed hex

- Evidence:
  - `client/apps/game/src/three/scenes/worldmap.tsx:2745`
  - `client/apps/game/src/three/scenes/worldmap.tsx:2760`
  - `client/apps/game/src/three/scenes/worldmap.tsx:2796`
  - `client/apps/game/src/three/scenes/worldmap.tsx:2812`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3091`
  - `client/apps/game/src/three/utils/chunk-geometry.ts:73`
- Current behavior:
  - `invalidateAllChunkCachesContainingHex()` scans `this.cachedMatrices.keys()`
  - movements invalidate old and new hexes, doubling the scan
- Required fix:
  - derive affected chunk keys analytically from overlap radius
  - or maintain a reverse index from rendered hex/window to cached chunk keys

#### P1.3 Camera motion wakes chunk refresh from two layers

- Evidence:
  - `client/apps/game/src/three/game-renderer.ts:758`
  - `client/apps/game/src/three/game-renderer.ts:1295`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:155`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:751`
  - `client/apps/game/src/three/scenes/worldmap.tsx:416`
  - `client/apps/game/src/three/scenes/worldmap.tsx:4270`
- Current behavior:
  - renderer-level controls listener always queues refreshes for worldmap
  - worldmap also listens to controls changes for its own policy decisions
- Required fix:
  - move chunk-refresh ownership into worldmap
  - renderer should only manage label dirtiness and active-scene routing

#### P1.4 Frustum invalidation runs twice during camera motion

- Evidence:
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:155`
  - `client/apps/game/src/three/scenes/hexagon-scene.ts:751`
  - `client/apps/game/src/three/utils/frustum-manager.ts:22`
  - `client/apps/game/src/three/managers/points-label-renderer.ts:104`
- Current behavior:
  - camera code dispatches `change`
  - then explicitly calls `frustumManager.forceUpdate()`
  - `FrustumManager` already recomputes in its `change` listener
- Required fix:
  - choose a single invalidation path
  - longer term, remove the second frustum cache or make it a thin adapter over centralized visibility

#### P1.5 Chest refresh still scans all chests on every chunk update

- Evidence:
  - `client/apps/game/src/three/managers/chest-manager.ts:331`
  - `client/apps/game/src/three/managers/chest-manager.ts:344`
- Current behavior:
  - `Array.from(chests.values()).filter(...)` runs on every chunk refresh
- Required fix:
  - add the same bucketed spatial index pattern already used by army and structure managers

#### P1.6 Army picking raycasts every loaded instanced mesh and sorts the hits

- Evidence:
  - `client/apps/game/src/three/managers/army-manager.ts:540`
  - `client/apps/game/src/three/managers/army-model.ts:1874`
- Current behavior:
  - pointer move and right click call `raycastAll()`
  - every mesh gets raycast
  - combined hits are sorted even though only the nearest hit is used
- Required fix:
  - track nearest hit while iterating
  - reuse a target array
  - restrict to currently pickable meshes or a dedicated pick surface

### P2: remove avoidable churn and fallback linear scans

#### P2.1 Labels rebuild DOM subtrees instead of mutating stable nodes

- Evidence:
  - `client/apps/game/src/three/utils/labels/label-factory.ts:367`
  - `client/apps/game/src/three/utils/labels/label-factory.ts:694`
  - `client/apps/game/src/three/utils/labels/label-components.ts:852`
- Current behavior:
  - army label updates clear `innerHTML`
  - structure label updates replace blocks and recreate direction indicators
- Required fix:
  - cache node references at creation time
  - update `textContent`, classes, and styles in place
  - patch direction indicators instead of removing and recreating them

#### P2.2 Structure point removals are unbatched

- Evidence:
  - `client/apps/game/src/three/managers/structure-manager.ts:1401`
  - `client/apps/game/src/three/managers/points-label-renderer.ts:201`
- Current behavior:
  - each `removePoint()` refreshes frustum visibility immediately
- Required fix:
  - add `removeMany()` or batch removal mode
  - refresh bounds once per renderer diff

#### P2.3 Structure visibility checks recompute chunk bounds per candidate

- Evidence:
  - `client/apps/game/src/three/managers/structure-manager.ts:1452`
  - `client/apps/game/src/three/managers/structure-manager.ts:1514`
- Current behavior:
  - `getVisibleStructuresForChunk()` computes bounds once
  - `isStructureVisible()` recomputes them again through `isInCurrentChunk()`
- Required fix:
  - pass precomputed bounds into visibility checks

#### P2.4 `Structures.getStructureByEntityId()` still scans type maps

- Evidence:
  - `client/apps/game/src/three/managers/structure-manager.ts:2300`
- Current behavior:
  - lookup walks all structure-type maps
  - many higher-level flows call it repeatedly during diffs and label refresh
- Required fix:
  - add a direct `entityId -> structure` index maintained alongside typed maps

#### P2.5 `InstancedMatrixAttributePool.acquire()` is linear in free-list size

- Evidence:
  - `client/apps/game/src/three/utils/instanced-matrix-attribute-pool.ts:24`
  - `client/apps/game/src/three/scenes/worldmap.tsx:3977`
- Current behavior:
  - `findIndex()` plus `splice()` over the free list
- Required fix:
  - bucket by rounded capacity for `O(1)` acquire/release by size class

#### P2.6 Interactive hex resizing churns shared geometry

- Evidence:
  - `client/apps/game/src/three/managers/interactive-hex-manager.ts:179`
  - `client/apps/game/src/three/utils/hex-geometry-pool.ts:91`
- Current behavior:
  - growth releases the pooled geometry and reacquires it immediately
- Required fix:
  - hold geometry for manager lifetime and release only on destroy

#### P2.7 Hover-label leave path duplicates hide work

- Evidence:
  - `client/apps/game/src/three/managers/hover-label-manager.ts:75`
  - `client/apps/game/src/three/managers/hover-label-manager.ts:87`
- Current behavior:
  - active labels are hidden individually
  - then every controller receives `hideAll()`
- Required fix:
  - choose one teardown path

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                           | Priority |
| ---- | ----------------------------------------------------------------------------------------------------- | -------- |
| FR-1 | Cold chunk entry must render terrain and manager fanout at most once per committed chunk transition. | P0       |
| FR-2 | Structure chunk switches must perform exactly one visible-structure rebuild.                          | P0       |
| FR-3 | Single active-chunk structure updates must not trigger a full visible-structure rebuild by default.  | P0       |
| FR-4 | Visibility recompute and listener notification must be dirty-driven, not frame-driven.               | P0       |
| FR-5 | Frame instrumentation must be disabled or near-zero overhead in non-dev runtime.                     | P0       |
| FR-6 | Terrain rebuild must not rescan the full render window for data already computed in the same pass.   | P1       |
| FR-7 | Single-hex cache invalidation must be bounded by overlap radius, not total cached chunk count.       | P1       |
| FR-8 | Chunk refresh triggering must have one authoritative owner.                                           | P1       |
| FR-9 | Chest visibility refresh must use a spatial index.                                                   | P1       |
| FR-10 | Label and point diff application must support batched updates and removals.                          | P2       |

### Non-Functional Requirements

| ID    | Requirement                                                                                       | Priority |
| ----- | ------------------------------------------------------------------------------------------------- | -------- |
| NFR-1 | No production code lands in this effort without a failing test first.                            | P0       |
| NFR-2 | Stationary camera must not trigger visibility listener fanout after the first settled frame.     | P0       |
| NFR-3 | Panning into an uncached area must not trigger two full current-chunk rebuilds.                  | P0       |
| NFR-4 | Chunk refresh latency must decrease or remain flat after each milestone.                          | P1       |
| NFR-5 | The fixes must preserve visible-world correctness for chunking, labels, hover, and selection.    | P1       |

## TDD Operating Model

### Iron Rule

No production code without a failing test first.

### Per-Slice Protocol

1. `RED`
   - add one failing test for one behavior
   - run only the smallest relevant test target
   - verify failure is due to the missing optimization or guard
2. `GREEN`
   - implement the smallest production change to satisfy that test
   - rerun the targeted test
3. `REFACTOR`
   - only after green, extract or simplify
   - rerun the local cluster plus affected regressions

### Required Test Commands

1. Targeted scene tests:
   - `pnpm --dir client/apps/game test src/three/scenes/worldmap*.test.ts`
2. Targeted manager tests:
   - `pnpm --dir client/apps/game test src/three/managers/*.test.ts`
3. Targeted utility tests:
   - `pnpm --dir client/apps/game test src/three/utils/*.test.ts`
4. Focused regression clusters per milestone:
   - `pnpm --dir client/apps/game test src/three/scenes/worldmap*.test.ts src/three/managers/*visibility*.test.ts`
5. Module gate:
   - `pnpm --dir client/apps/game test src/three`

## Milestones

### M0: Baseline and guardrails

Objective:

Make the current performance bugs observable and lock the intended behavior before refactoring.

Deliverables:

1. focused failing tests for the duplicated refresh, duplicated structure rebuild, and visibility dirty bug
2. lightweight test instrumentation hooks for:
   - worldmap terrain rebuild count
   - manager fanout count
   - structure visible-set rebuild count
   - visibility notification count

Fail-first tests:

1. `src/three/scenes/worldmap-hydrated-refresh-regression.test.ts`
   - fails because one cold fetch causes two current-chunk refreshes
2. `src/three/managers/structure-manager.chunk-switch-regression.test.ts`
   - fails because `updateChunk()` triggers two visible-structure rebuilds
3. `src/three/utils/centralized-visibility-manager.idle-frame.test.ts`
   - fails because idle frames still recompute and notify listeners

Exit criteria:

1. Reproducible tests exist for the current hot-path regressions.

### M1: Remove duplicated chunk and structure work

Objective:

Stop the most expensive duplicate work before tuning smaller loops.

Deliverables:

1. worldmap no longer performs a full hydrated re-refresh after cold fetch completion
2. structure chunk switch performs exactly one visible-structure rebuild
3. `showLabels()` is reduced to a visibility concern or removed from the hot path

Fail-first tests:

1. worldmap cold fetch triggers one terrain rebuild and one manager fanout
2. structure manager chunk switch triggers one visible rebuild

Exit criteria:

1. cold chunk entry no longer doubles the core chunk cost
2. structure chunk switch cost is cut roughly in half

### M2: Make structure and terrain updates incremental

Objective:

Remove whole-set rebuilds for single-entity or single-window updates.

Deliverables:

1. active-chunk structure updates patch one structure instead of rebuilding all visible structures
2. terrain generation computes validation counters in the main pass
3. interactive-hex refresh avoids full repopulation on unchanged bounds

Fail-first tests:

1. `src/three/managers/structure-manager.incremental-update.test.ts`
   - fails because one structure update rebuilds all visible structures
2. `src/three/scenes/worldmap-hex-grid-pass-count.test.ts`
   - fails because one hex-grid refresh requires multiple full-window passes

Exit criteria:

1. one structure update does not touch unrelated visible structures
2. terrain refresh performs one main window pass plus bounded follow-up work only when required

### M3: Restore true dirty-only frame behavior

Objective:

Make idle frames cheap again.

Deliverables:

1. centralized visibility recomputes only on camera or chunk-registration change
2. frustum invalidation has one authoritative path
3. performance monitor is dev-only or low-overhead

Fail-first tests:

1. idle camera over multiple frames emits one visibility recompute
2. one scripted camera tween step does not trigger double frustum refresh
3. performance monitor leaves no accumulating measures in the timeline API

Exit criteria:

1. stationary worldmap frames no longer wake label/visibility subsystems

### M4: Replace remaining hot-path linear scans

Objective:

Bound runtime costs by visible or overlapping work instead of total cached or loaded work.

Deliverables:

1. analytic chunk-overlap invalidation or reverse index for cache eviction
2. chest spatial index
3. direct structure entity lookup index
4. army picking nearest-hit iteration without global sort
5. bucketed instanced-matrix-attribute pool

Fail-first tests:

1. moving one entity invalidates only the bounded overlapping chunk keys
2. chest visibility refresh queries only indexed buckets
3. army picking does not sort a full result set to find one nearest hit

Exit criteria:

1. no hot path in this scope scales with total cached chunks unless the product requirement truly needs it

### M5: Batch DOM and point updates

Objective:

Reduce layout and geometry churn after the major CPU fixes land.

Deliverables:

1. label update APIs mutate stable nodes instead of recreating whole subtrees
2. points renderers support batched removals
3. hover-label leave path uses one teardown path

Fail-first tests:

1. label update retains the same content nodes across data refresh
2. removing many points triggers one frustum visibility refresh

Exit criteria:

1. visible label and point diffs are batched and allocation-light

## Implementation Order

Order matters:

1. M0 first so the current regressions are pinned down
2. M1 before M2 because duplicate rebuilds distort all later measurements
3. M3 before deep micro-optimization so idle-frame noise does not hide real wins
4. M4 after M1-M3 because the biggest returns come from eliminating redundant top-level work
5. M5 last because DOM churn matters, but it is not the first bottleneck to remove

## Validation Plan

### Functional validation

1. chunk switching still renders the correct terrain, structures, armies, chests, labels, and hover state
2. active-chunk structure updates still reflect ownership, cosmetics, labels, and attachments correctly
3. picking still returns the same nearest army

### Performance validation

1. compare chunk-switch counts before and after on uncached and cached chunk entry
2. compare visibility recompute counts over 300 idle frames
3. compare visible-structure rebuild counts during a burst of structure updates
4. compare pointer-move cost over dense visible army scenes

### Rollout safety

1. land M1 and M3 before broader refactors
2. keep debug counters behind dev-only hooks
3. avoid mixing feature work with performance hardening in the same PR

## Open Questions

1. Should cold chunk entry prefer delayed visual commit over optimistic render plus delta patching?
2. Is the product requirement for labels compatible with a fully cached node tree, or do any label variants still need
   full reconstruction?
3. Can chest visibility reuse a generic indexed-entity helper shared with army and structure managers?

## Recommended PR Breakdown

1. PR1: tests and instrumentation hooks for duplicated chunk refresh, duplicated structure rebuild, and idle visibility recompute
2. PR2: worldmap cold-refresh fix plus structure chunk-switch duplicate rebuild fix
3. PR3: incremental structure updates and terrain pass collapse
4. PR4: visibility/frustum/performance-monitor hardening
5. PR5: cache invalidation, chest indexing, army picking, and pool improvements
6. PR6: label DOM patching and batched point removals
