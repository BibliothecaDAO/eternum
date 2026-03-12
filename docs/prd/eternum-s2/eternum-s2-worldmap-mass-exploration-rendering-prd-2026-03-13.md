# Eternum S2 Worldmap Mass-Exploration Rendering PRD

Date: 2026-03-13 Status: Draft Scope: `client/apps/game/src/three` render path and adjacent movement/pathfinding hot paths

## Implementation Tracking

- [x] Phase 0: Measurement and Guardrails
- [x] Phase 1: Worldmap Refresh Backpressure
- [ ] Phase 2: Army Delta Pipeline
- [ ] Phase 3: Foreign Trail Path Pipeline Optimization
- [ ] Phase 4: Point Icon and Label Batching
- [ ] Phase 5: Structure Incremental Refresh

## 1. Objective

Make the world map hold up when many players are exploring and moving at the same time, without removing foreign army
movement trails.

This PRD covers:

- worldmap chunk-refresh backpressure,
- army/structure manager scaling,
- foreign movement trail/path pipeline efficiency,
- point icon / label pipeline efficiency,
- render-path instrumentation and regression tests.

## 2. Confirmed Constraints

- Foreign army movement trails are required and must remain visible.
- Exploration automation is out of scope for this PRD.
- The target is crowd-scale performance improvement, not a gameplay or visual redesign.

## 3. Problem Statement

The current worldmap render path is correct in single-user and low-entity scenarios, but it does too much whole-chunk
work when the scene is under high live-update pressure.

The practical failure mode is:

1. many remote explorers generate `ExplorerTroopsTile` and `Tile` updates inside current Torii bounds,
2. `WorldmapScene` invalidates caches and sometimes forces immediate refreshes,
3. chunk refresh fans out into full army/structure/chest manager updates,
4. army movement updates also run client-side pathfinding and path rendering for foreign units,
5. point icons, labels, and per-frame movement work keep cost elevated even after the initial burst.

## 4. Current Code Audit Summary

### 4.1 Refresh coalescing is not consistently enforced

- `requestChunkRefresh()` is the intended latest-wins gate in `client/apps/game/src/three/scenes/worldmap.tsx`.
- Several hot event paths still call `updateVisibleChunks(true)` directly.
- Result: bursty tile / structure / cleanup events can replay the full refresh flow instead of collapsing to one
  in-flight update and one rerun.

Primary hot spots:

- `client/apps/game/src/three/scenes/worldmap.tsx:778`
- `client/apps/game/src/three/scenes/worldmap.tsx:901`
- `client/apps/game/src/three/scenes/worldmap.tsx:2879`
- `client/apps/game/src/three/scenes/worldmap.tsx:3332`
- `client/apps/game/src/three/scenes/worldmap.tsx:4987`

### 4.2 Army chunk refresh is still too expensive

- `ArmyManager.executeRenderForChunk()` computes visible armies, collects model info, preloads, then recomputes visible
  armies and model info again.
- Visible diffing uses array membership and removal operations on `visibleArmyOrder`.
- Result: chunk refresh cost trends toward quadratic with visible army count.

Primary hot spots:

- `client/apps/game/src/three/managers/army-manager.ts:1115`
- `client/apps/game/src/three/managers/army-manager.ts:1163`
- `client/apps/game/src/three/managers/army-manager.ts:843`
- `client/apps/game/src/three/managers/army-manager.ts:949`

### 4.3 Foreign movement updates currently pay for full pathfinding and path rendering

- Every `ExplorerTroopsTile` move goes through `ArmyManager.onTileUpdate()` and into `moveArmy()`.
- `moveArmy()` calls `gameWorkerManager.findPath()` even for foreign armies.
- The worker pathfinder is array-backed and rescans / resorts its queue repeatedly.
- Each movement also creates or updates a rendered path trail.

Primary hot spots:

- `client/apps/game/src/three/managers/army-manager.ts:564`
- `client/apps/game/src/three/managers/army-manager.ts:1636`
- `client/apps/game/src/workers/game-worker.ts:68`
- `client/apps/game/src/three/managers/path-renderer.ts:114`
- `client/apps/game/src/three/managers/path-renderer.ts:274`

### 4.4 Point icon updates are not uniformly batched

- `PointsLabelRenderer` supports batching, but non-batched `setPoint()` / `removePoint()` paths immediately refresh
  frustum visibility and may recompute the bounding sphere.
- Army and chest flows still hit those paths directly.
- Result: repeated add/remove loops can degrade toward `O(k^2)` work per renderer.

Primary hot spots:

- `client/apps/game/src/three/managers/points-label-renderer.ts:110`
- `client/apps/game/src/three/managers/points-label-renderer.ts:149`
- `client/apps/game/src/three/managers/points-label-renderer.ts:198`
- `client/apps/game/src/three/managers/army-manager.ts:986`
- `client/apps/game/src/three/managers/chest-manager.ts:405`

### 4.5 Structure refresh is a whole-visible-set rebuild

- `StructureManager.updateVisibleStructures()` rebuilds the full visible structure set, resets model counts, then
  repopulates models, points, labels, and attachments.
- `InstancedModel.setCount()` recomputes bounding spheres.
- Result: visible structure churn scales with whole chunk size, not changed-entity count.

Primary hot spots:

- `client/apps/game/src/three/managers/structure-manager.ts:1074`
- `client/apps/game/src/three/managers/structure-manager.ts:1099`
- `client/apps/game/src/three/managers/structure-manager.ts:1163`
- `client/apps/game/src/three/managers/instanced-model.tsx:278`

### 4.6 Per-frame work stays linear after the burst

- `ArmyManager.update()` walks visible armies every frame for movement, indicators, attachments, paths, and labels.
- `PathRenderer.updateFrustumCulling()` walks all active paths every few frames.
- Army and structure label visibility passes iterate every live label while dirty.

Primary hot spots:

- `client/apps/game/src/three/managers/army-manager.ts:1933`
- `client/apps/game/src/three/managers/army-manager.ts:1975`
- `client/apps/game/src/three/managers/path-renderer.ts:288`
- `client/apps/game/src/three/managers/structure-manager.ts:1632`
- `client/apps/game/src/three/managers/structure-manager.ts:1693`
- `client/apps/game/src/three/game-renderer.ts:1231`

### 4.7 Not the first place to tune

- `CentralizedVisibilityManager` is bounded by registered chunk count and is not the primary crowd bottleneck.
- Prefetch queues are array-backed but intentionally small and bounded.

## 5. Bottleneck Trace

### 5.1 Full refresh path

`GameRenderer controls change / world event -> WorldmapScene.requestChunkRefresh or updateVisibleChunks(true) ->
updateVisibleChunks -> performChunkSwitch or refreshCurrentChunk -> updateManagersForChunk -> ArmyManager.updateChunk +
StructureManager.updateChunk + ChestManager.updateChunk`

This is the main path that must be backpressured and made incremental.

### 5.2 Remote exploration path

`WorldUpdateListener.ExplorerTroopsTile -> WorldmapScene.updateArmyHexes + ArmyManager.onTileUpdate -> moveArmy ->
worker findPath -> ArmyModel.startMovement + PathRenderer.createPath`

This is the path that makes high player concurrency expensive even when the local user is only observing.

### 5.3 Tile update path

`WorldUpdateListener.Tile -> WorldmapScene.updateExploredHex -> cache invalidation -> visible-tile incremental add or
full refresh fallback`

This is the path that can convert exploration churn into terrain cache churn and forced manager fanout.

## 6. Goals

1. Preserve foreign army movement trails while reducing the CPU and renderer cost of producing them.
2. Ensure bursty live updates collapse into a bounded amount of chunk refresh work.
3. Make steady-state army and structure updates proportional to changed entities, not the whole visible set.
4. Reduce point-icon and label overhead enough that frame time can recover after update bursts.
5. Add repeatable perf instrumentation and test coverage so regressions are caught early.

## 7. Non-Goals

- Removing foreign army trails.
- Replacing the chunking model or camera/navigation model.
- Rewriting the full rendering stack or swapping out Three.js.
- Tuning exploration automation.

## 8. Success Metrics

### 8.1 Refresh behavior

1. Burst of 100 mixed `Tile` / `ExplorerTroopsTile` / structure updates yields at most 1 active chunk refresh and 1
   queued rerun.
2. No direct subscription path bypasses the central refresh scheduler in worldmap runtime code.

### 8.2 Crowd-scale render behavior

1. Adding or moving 1 foreign army in a chunk with 300 visible armies does not trigger a full visible-army rebuild.
2. Single structure ownership / tile update does not rebuild unrelated visible structure buckets.
3. Bulk point icon updates are linear and do at most 1 bounding-sphere recompute per renderer batch.

### 8.3 Frame stability

1. Per-frame army work scales primarily with moving / dirty entities, not all visible entities.
2. Active path count, active label count, and forced refresh count are observable from debug stats.

## 9. Product Requirements

### R1. Enforce one refresh gate for all worldmap refresh requests

- All worldmap force-refresh callers must use one latest-wins scheduling API.
- Direct `updateVisibleChunks(true)` calls from hot subscriptions must be removed or wrapped.
- Refresh reasons must be tracked for diagnostics.

Acceptance:

- No hot subscription path forces an uncapped full refresh.
- Refresh bursts are collapsed predictably.

### R2. Make army updates incremental in steady state

- Chunk switches may still rebuild visible state.
- Steady-state army add/move/remove/owner updates must patch the current visible set instead of rebuilding it.
- `visibleArmyOrder` must stop using quadratic array diff behavior.

Acceptance:

- Single-entity army updates do not trigger whole-chunk visible-army recomputation.
- Chunk-switch diff is linear or near-linear in visible army count.

### R3. Preserve foreign trails with a cheaper movement pipeline

- Foreign movement trails remain visible.
- Foreign movement should not require the same pathfinding cost as locally selected gameplay actions.
- Movement/path rendering must have bounded active-path overhead.

Acceptance:

- Foreign trail visuals remain present.
- Worker pathfinding load is materially reduced under remote-army bursts.

### R4. Make point icons and labels batch-friendly by default

- Bulk point mutations must be batched.
- Label visibility updates should avoid unnecessary DOM churn.
- Hover leave should operate on active labels only.

Acceptance:

- Bulk icon changes are linear.
- Label visibility updates do not dominate frame recovery after bursts.

### R5. Make structure refresh incremental

- Visible structure refreshes must be patch-based where possible.
- Model count / bounds updates must be batched per model group.

Acceptance:

- Small structure changes do not rebuild the whole visible structure set.

## 10. Implementation Plan

## Phase 0: Measurement and Guardrails

Deliverables:

- Add timings and counters for:
  - `WorldmapScene.updateVisibleChunks`
  - `WorldmapScene.performChunkSwitch`
  - `WorldmapScene.updateManagersForChunk`
  - `ArmyManager.executeRenderForChunk`
  - `StructureManager.performVisibleStructuresUpdate`
  - worker `findPath`
  - `PathRenderer.createPath`
- Add debug counters for forced refresh reasons, active paths, visible armies, visible structures, active labels.

Primary files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/managers/path-renderer.ts`
- `client/apps/game/src/workers/game-worker.ts`

TDD:

- Add unit tests for telemetry bookkeeping.
- Add a deterministic replay fixture that feeds worldmap 100+ update events and asserts refresh counts.

Definition of done:

- Crowd-scale hot paths are measurable before behavior changes begin.

## Phase 1: Worldmap Refresh Backpressure

Deliverables:

- Introduce one refresh scheduler API for all worldmap refresh causes.
- Replace direct hot-path `updateVisibleChunks(true)` usage with scheduled requests.
- Preserve correctness for stale-token dropping and refresh reruns.

Primary files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
- `client/apps/game/src/three/scenes/worldmap-*`

TDD:

- Add / extend tests for latest-wins refresh behavior, stale transition rejection, rerun scheduling, and duplicate tile
  burst collapse.
- Add integration coverage for mixed `Tile`, `ExplorerTroopsTile`, and structure update bursts.

Definition of done:

- Refresh bursts collapse into bounded work without visual corruption.

## Phase 2: Army Delta Pipeline

Deliverables:

- Replace `visibleArmyOrder` quadratic membership/removal logic with map/set-based slot bookkeeping.
- Split full chunk rebuild logic from steady-state add/move/remove paths.
- Make `addArmy()` and owner updates patch visible state directly.

Primary files:

- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/army-model.ts`
- `client/apps/game/src/three/managers/manager-update-convergence.ts`

TDD:

- Extend army manager lifecycle tests to cover:
  - add one army to a populated visible set,
  - remove one army from a populated visible set,
  - owner/color update for one visible army,
  - chunk switch with large visible set.
- Assert that single-entity updates do not call the full visible-army rebuild path.

Definition of done:

- Steady-state army updates are proportional to changed entities.

## Phase 3: Foreign Trail Path Pipeline Optimization

Deliverables:

- Preserve foreign trails while decoupling them from expensive general pathfinding.
- Introduce a cheaper remote-movement path strategy:
  - direct segment path,
  - bounded local interpolation,
  - or cached worker path reuse keyed by source/destination/bucket.
- Cap active path bookkeeping and avoid unnecessary path churn for invisible / expired trails.

Primary files:

- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/managers/game-worker-manager.ts`
- `client/apps/game/src/workers/game-worker.ts`
- `client/apps/game/src/three/managers/path-renderer.ts`

TDD:

- Add worker/path tests to prove remote move bursts do not trigger full general path search for each update.
- Extend path renderer tests for:
  - large active path counts,
  - culling stability,
  - path reuse,
  - selected vs moving display state preservation.

Definition of done:

- Foreign trails remain visible, but remote movement bursts no longer dominate CPU.

## Phase 4: Point Icon and Label Batching

Deliverables:

- Add bulk mutation APIs or enforced batch wrappers to `PointsLabelRenderer`.
- Ensure one bounding-sphere recompute per batch.
- Restrict hover leave to active labels instead of all manager labels.
- Reduce CSS label visibility churn where state is unchanged.

Primary files:

- `client/apps/game/src/three/managers/points-label-renderer.ts`
- `client/apps/game/src/three/managers/hover-label-manager.ts`
- `client/apps/game/src/three/managers/army-manager.ts`
- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/managers/chest-manager.ts`
- `client/apps/game/src/three/game-renderer.ts`

TDD:

- Add tests proving 500 icon adds/removes trigger 1 visibility refresh per batch, not 500.
- Add hover-manager tests proving `onHexLeave()` only hides active labels.
- Add renderer cadence tests proving label render work stays idle when no active labels exist.

Definition of done:

- Icon and label overhead is no longer a crowd-scale multiplier.

## Phase 5: Structure Incremental Refresh

Deliverables:

- Convert visible structure refresh from rebuild-all to diff-and-patch.
- Batch model count / bounds updates once per affected model group.
- Keep points, labels, and attachments synchronized with changed structure entities only.

Primary files:

- `client/apps/game/src/three/managers/structure-manager.ts`
- `client/apps/game/src/three/managers/instanced-model.tsx`
- `client/apps/game/src/three/managers/points-label-renderer.ts`

TDD:

- Extend structure lifecycle tests to cover:
  - one visible structure moving,
  - one visible structure changing ownership bucket,
  - one cosmetic attachment change,
  - one structure entering/leaving visibility.
- Assert unrelated model buckets are untouched.

Definition of done:

- Small structure changes do not cause whole-chunk rebuild work.

## 11. Test Plan

### 11.1 Unit tests

- Refresh scheduler and stale-token behavior.
- Army diff bookkeeping.
- Path worker queue strategy.
- Points label batching semantics.
- Hover label active-only teardown.
- Structure diff logic.

### 11.2 Integration tests

- Burst replay of mixed world updates into an initialized worldmap scene.
- Chunk switch with high visible army and structure counts.
- Remote movement trail preservation under heavy movement.

### 11.3 Perf regression tests

- Scripted “crowded chunk” fixture with:
  - 300 visible armies,
  - 100+ moving remote armies,
  - 250 visible structures,
  - repeated tile updates inside current bounds.
- Capture:
  - forced refresh count,
  - manager update duration,
  - active path count,
  - frame-time budget breaches.

## 12. Risks and Mitigations

- Risk: batching or delta logic introduces stale visuals.
  - Mitigation: preserve one explicit force-refresh fallback and keep it covered by tests.
- Risk: cheaper remote-movement path logic changes trail appearance.
  - Mitigation: lock visual parity for selected and nearby foreign trails first; validate with before/after capture.
- Risk: structure diffing becomes harder to reason about than rebuild-all.
  - Mitigation: keep a debug mode that can compare incremental output against full rebuild output.

## 13. Recommended Order

1. Phase 0 instrumentation
2. Phase 1 refresh backpressure
3. Phase 2 army delta pipeline
4. Phase 3 foreign trail path optimization
5. Phase 4 point icon / label batching
6. Phase 5 structure incremental refresh

This order addresses the largest crowd-scale regressions first while preserving the required feature set.
