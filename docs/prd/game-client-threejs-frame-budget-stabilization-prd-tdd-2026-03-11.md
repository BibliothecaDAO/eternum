# Game Client Three.js Frame-Budget Stabilization PRD + TDD

Status: Draft
Owner: Game Client
Target branch: `next`
Primary app: `client/apps/game`
Date: March 11, 2026
Related:

1. `docs/prd/game-client-threejs-hot-path-performance-prd-tdd-2026-03-10.md`
2. `docs/prd/game-client-memory-performance-prd-2026-02-22.md`

## 0. Implementation Tracker

- [x] Replace terrain cache snapshot round-trips with cache-owned dense buffers.
- [x] Stop resetting every loaded structure/cosmetic model on visible-structure refresh.
- [x] Limit army instance uploads and bounds recomputation to dirty model subsets.
- [x] Make army attachment transform updates dirty-driven instead of per-frame full visible scans.
- [x] Collapse renderer tone mapping to a single path on post-processing tiers.
- [x] Replace full interactive-hex window rebuilds with retained or strip-based updates.
- [x] Add regression tests and perf assertions for each workstream.
- [ ] Run targeted test slices and `tsc --noEmit`.

## 1. Summary

This document defines the next Three.js performance program for the game client after the March 10 hot-path cleanup.

The remaining issues are no longer primarily `O(total_entities)` table scans. The main cost centers are now:

1. CPU memory-bandwidth churn from terrain cache buffer round-trips.
2. Bounds and instance resets that scale with all loaded models, not the active dirty subset.
3. Per-frame attachment work that keeps running for stationary armies.
4. Redundant full-screen renderer work in the tone-mapping pipeline.
5. Repeated rebuild of interaction state for near-identical terrain windows.

The goal of this PRD is to stabilize chunk-switch and steady-state frame time by making the renderer pay for:

1. What is visible now.
2. What actually changed this frame.
3. One color pipeline, not two.

This document combines product requirements, technical design, and a test-driven delivery plan.

## 2. Problem Statement

The `client/apps/game/src/three` subsystem has already removed several first-order scaling bugs, but frame-time risk
still remains in second-order costs that are paid frequently:

1. Chunk switches and forced terrain refreshes still copy large instanced buffers multiple times.
2. Structure and army rendering still recompute bounds across historical model inventories.
3. Army attachments keep paying transform resolution cost while stationary.
4. World interaction state is rebuilt from scratch when adjacent chunks share most of their window.
5. The renderer still performs redundant tone mapping on post-processing tiers.

These issues are smaller than the previous global scans, but they occur on highly exercised paths:

1. Terrain commit and cache hit.
2. Visible structure reconciliation.
3. Army chunk uploads.
4. Every frame while armies are visible.
5. Every rendered frame through the composer.

Result:

1. Chunk-switch hitching remains higher than necessary.
2. Long sessions still accumulate cost as more model/cosmetic variants are loaded.
3. Camera motion and active armies keep non-trivial CPU work alive even when nothing meaningful changed.

## 3. Goals

### 3.1 Product Goals

1. Reduce chunk-switch hitching during pan, zoom, and shortcut navigation.
2. Lower steady-state frame cost during normal worldmap viewing with visible armies and structures.
3. Preserve gameplay correctness, labels, cosmetics, ownership color, interaction picking, and chunk hydration behavior.

### 3.2 Engineering Goals

1. Make terrain cache reuse avoid full instanced-buffer round-trips.
2. Make structure and army bounds work proportional to dirty model subsets.
3. Make attachment transform updates proportional to moving or changed armies.
4. Remove redundant full-screen tone-mapping work.
5. Introduce regression tests that fail on these specific asymptotic patterns before implementation.

## 4. Non-Goals

1. Rewriting the worldmap renderer from scratch.
2. Removing Three.js, CSS2D labels, or the post-processing stack globally.
3. Replacing all remaining `FrustumManager` call sites in this phase.
4. Art-pipeline changes to models, textures, or shaders.
5. Broad memory cleanup work outside the scoped systems below.

## 5. Verified Findings (Repo)

### 5.1 Terrain cache snapshot round-trip

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:3841`
2. `client/apps/game/src/three/scenes/worldmap.tsx:3874`
3. `client/apps/game/src/three/scenes/worldmap.tsx:4644`
4. `client/apps/game/src/three/scenes/worldmap.tsx:4746`
5. `client/apps/game/src/three/managers/instanced-biome.tsx:240`
6. `client/apps/game/src/three/managers/instanced-biome.tsx:252`

Current behavior:

1. `updateHexagonGrid()` writes per-biome matrices into live instanced meshes.
2. `cacheMatricesForChunk()` immediately copies those instance buffers back out into cached snapshots.
3. `applyCachedMatricesForChunk()` copies those cached buffers back into meshes on reuse.

Result:

1. Chunk build and cache hit both pay large copy costs.
2. Terrain cache reuse is cheaper than rebuild, but still more expensive than it should be.

### 5.2 Structure refresh resets all loaded models

Relevant code:

1. `client/apps/game/src/three/managers/structure-manager.ts:1218`
2. `client/apps/game/src/three/managers/instanced-model.tsx:278`
3. `client/apps/game/src/three/managers/instanced-model.tsx:296`

Current behavior:

1. `performVisibleStructuresUpdate()` calls `setCount(0)` on every loaded base model and cosmetic model.
2. `InstancedModel.setCount()` triggers `needsUpdate()`.
3. `needsUpdate()` recomputes bounding spheres for each instanced mesh and contact shadow.

Result:

1. A small visible structure change pays cost proportional to all loaded structure variants.
2. Long sessions get slower as more cosmetic and structure families are loaded.

### 5.3 Army upload and bounds work scales with loaded model inventory

Relevant code:

1. `client/apps/game/src/three/managers/army-manager.ts:1390`
2. `client/apps/game/src/three/managers/army-model.ts:1912`
3. `client/apps/game/src/three/managers/army-model.ts:2014`

Current behavior:

1. When chunk reconcile dirties buffers, `ArmyManager` calls `updateAllInstances()` and `computeBoundingSphere()`.
2. `ArmyModel` iterates all base models and all cosmetic models for those operations.

Result:

1. A local dirty subset still pays for the full loaded army model catalog.
2. Chunk-switch cost rises with session-time model diversity.

### 5.4 Army attachment transforms are not dirty-driven

Relevant code:

1. `client/apps/game/src/three/managers/army-manager.ts:2211`
2. `client/apps/game/src/three/managers/army-manager.ts:2270`

Current behavior:

1. `updateVisibleArmiesBatched()` iterates all visible armies every frame.
2. Attached armies recompute base transforms, biome, resolved model type, mount transforms, and then push updates into
   `attachmentManager`.

Result:

1. Stationary armies with attachments keep paying frame-time CPU cost.
2. The cost grows with visible attached armies instead of changed attached armies.

### 5.5 Double tone mapping in renderer pipeline

Relevant code:

1. `client/apps/game/src/three/game-renderer.ts:341`
2. `client/apps/game/src/three/game-renderer.ts:849`
3. `client/apps/game/src/three/game-renderer.ts:1451`

Current behavior:

1. `WebGLRenderer` uses `ACESFilmicToneMapping`.
2. The composer also adds `ToneMappingEffect`.

Result:

1. The renderer does redundant full-screen color work.
2. Exposure, bloom, and grading become harder to reason about.

### 5.6 Interactive hex window is rebuilt from scratch

Relevant code:

1. `client/apps/game/src/three/scenes/worldmap.tsx:3441`
2. `client/apps/game/src/three/scenes/worldmap.tsx:3606`
3. `client/apps/game/src/three/scenes/worldmap.tsx:3891`

Current behavior:

1. `computeInteractiveHexes()` clears all interactive hexes.
2. It then repopulates the whole rendered window and recomputes visible hexes.
3. This runs after fresh terrain commits and cached terrain applies.

Result:

1. Adjacent chunk moves still rebuild nearly identical interaction state.
2. String-key and set churn is paid repeatedly on a chunk-hot path.

## 6. Requirements

### 6.1 Functional Requirements

FR-001 Terrain cache ownership

1. Terrain cache must store reusable dense instance data directly.
2. Cache hit must not require copying from live mesh buffers back into cache-owned buffers.
3. Cache hit must restore terrain state without re-running per-cell matrix generation.

FR-002 Dirty-scoped structure refresh

1. Visible structure refresh must not reset every loaded structure/cosmetic model by default.
2. Bounds recomputation must be limited to models whose counts or matrices changed.
3. Structure labels and point ownership renderers must remain correct after dirty-scoped refresh.

FR-003 Dirty-scoped army upload

1. Army uploads must track dirty model subsets.
2. Bounds recomputation must be limited to dirty model subsets.
3. Cosmetic and base model correctness must remain unchanged.

FR-004 Dirty-scoped attachment updates

1. Stationary attached armies must not recompute transforms every frame.
2. Attachment transforms must still update correctly for:
   - moving armies
   - model-type changes
   - cosmetic changes
   - ownership/coloring changes that affect attachment state

FR-005 Single tone-mapping path

1. Post-processing tiers must use one tone-mapping path only.
2. Visual output must remain consistent with existing quality settings after retuning.

FR-006 Incremental interactive hex updates

1. Adjacent chunk movement must reuse most existing interactive hex state.
2. Interaction picking correctness must remain unchanged across chunk switches and cache hits.

### 6.2 Non-Functional Requirements

NFR-001 Frame-time

1. Chunk-switch and force-refresh instrumentation must show reduced CPU time in terrain commit/cache-hit paths.
2. Steady-state frame cost with visible attached armies must decrease measurably in perf instrumentation.

NFR-002 Memory churn

1. Terrain cache flow must reduce transient allocation and buffer-copy churn.
2. No new unbounded cache growth may be introduced.

NFR-003 Safety

1. Existing terrain correctness, fog-of-war, structure hiding, and spectator behavior must remain intact.
2. No selection, label, or interaction regressions may be introduced.

## 7. Acceptance Criteria

1. Terrain cache no longer snapshots live instanced terrain buffers after every commit.
2. Structure refresh no longer calls `setCount(0)` across every loaded model family on every visible refresh.
3. Army upload/bounds work can be constrained to dirty model subsets.
4. Attachment transforms stop updating for stationary armies after initial stabilization.
5. Renderer uses one tone-mapping path on all post-processing tiers.
6. Interactive hex updates no longer rebuild the full rendered window for simple adjacent chunk shifts.
7. Targeted regression tests pass.
8. TypeScript check passes.

## 8. Technical Design

### 8.1 Workstream A: Terrain cache owns the instance buffers

Proposed change:

1. Introduce a terrain cache snapshot type that owns dense matrix and land-color buffers per biome.
2. Build or fill those buffers during terrain generation instead of committing to meshes first and snapshotting later.
3. Make terrain cache apply bind or copy from cache-owned buffers to live meshes only once per cache hit.

Design notes:

1. Keep current validation logic for terrain revision, expected counts, and spectator safety.
2. Keep the cache keyed by chunk/render area as it is today.
3. Reuse `InstancedMatrixAttributePool` where it helps, but the cache should be the source of truth for terrain
   instance data.

Expected payoff:

1. Lower CPU memory-bandwidth cost on chunk build.
2. Lower cache-hit cost.
3. Clearer ownership between generated terrain state and live mesh state.

### 8.2 Workstream B: Dirty-scoped structure model updates

Proposed change:

1. Track model families touched in the previous visible set and current visible set.
2. Only zero or hide models that actually transition from used to unused.
3. Only call bounds recomputation for models whose count or matrix contents changed.

Design notes:

1. Keep the shared render-preparation helper already introduced.
2. Do not regress point-renderer batching or attachment retention behavior.
3. If necessary, add an `InstancedModel` API that can set count or mark matrices dirty without forcing immediate full
   bounds work.

Expected payoff:

1. Structure refresh cost becomes proportional to active visible structure types.
2. Sessions with many cosmetics stop paying a global reset tax.

### 8.3 Workstream C: Dirty-scoped army upload and bounds

Proposed change:

1. Track dirty `ModelData` during add/remove/move/rebind/refresh flows.
2. Replace global `updateAllInstances()` and `computeBoundingSphere()` calls with dirty-subset variants.
3. Keep per-model draw counts correct without requiring global mesh iteration on every dirty reconcile.

Design notes:

1. Dirty tracking must cover both base models and cosmetics.
2. Contact-shadow meshes must stay in sync with the same dirty model subsets.
3. This workstream should reuse existing model ownership maps rather than add new parallel indexes.

Expected payoff:

1. Chunk upload cost becomes proportional to the models actually touched.
2. Session-time model variety stops inflating every reconcile.

### 8.4 Workstream D: Dirty-driven attachment transforms

Proposed change:

1. Maintain an attachment-dirty set keyed by army entity id.
2. Mark entries dirty when:
   - movement changes pose or position
   - model type changes
   - cosmetic or attachment templates change
   - scale or rotation changes
3. Only recompute mount transforms for dirty attached armies in the render loop.

Design notes:

1. Moving armies may remain always-dirty until movement completes.
2. Stationary armies should drop out of the dirty set after one stable transform update.
3. Attachment cleanup on removal must remain immediate.

Expected payoff:

1. Visible attached-army frame cost stops scaling with all attached armies.
2. Idle worldmap viewing becomes cheaper.

### 8.5 Workstream E: Single tone-mapping path

Proposed change:

1. Use the composer tone-mapping effect as the single tone-mapping path on post-processing tiers.
2. Set renderer tone mapping to `NoToneMapping` whenever `ToneMappingEffect` is active.
3. Preserve current low-quality behavior if post-processing is disabled there.

Design notes:

1. This is the least behaviorally risky option because grading is already composer-driven.
2. Bloom thresholds and exposure should be retuned once the duplicate path is removed.

Expected payoff:

1. One less redundant full-screen color transform.
2. Cleaner visual tuning and fewer grade surprises.

### 8.6 Workstream F: Incremental interactive-hex window updates

Proposed change:

1. Add an incremental `InteractiveHexManager` window-update API.
2. For adjacent chunk shifts, add incoming strip(s), remove outgoing strip(s), and retain shared interior cells.
3. Keep a fallback full rebuild path for non-adjacent teleports or forced resets.

Design notes:

1. This can align with the existing terrain strip-update concept already used for worldmap terrain.
2. Full rebuild should still be used for scene switch, render-size change, and hard invalidation.

Expected payoff:

1. Reduced interaction-state churn during normal camera travel.
2. Lower string/set pressure in chunk-hot paths.

## 9. Instrumentation and Metrics

Add or extend instrumentation for:

1. Terrain cache copies avoided or performed.
2. Dirty model count per structure refresh.
3. Dirty model count per army upload.
4. Attached armies updated this frame vs. total visible attached armies.
5. Interactive hex add/remove counts per chunk shift.

Benchmarks to compare before and after:

1. `chunkSwitch.terrainBuild`
2. `hexGrid.cacheSnapshot`
3. `chunkSwitch.managerUpdate`
4. `armyFrame.batchedVisible`
5. `armyChunk.upload`

## 10. Risks and Mitigations

Risk: terrain cache ownership refactor can break correctness in fog-of-war or spectator mode.

Mitigation:

1. Preserve current validation gates.
2. Add regression coverage for terrain convergence and cache safety before refactor.

Risk: dirty-scoped bounds updates can leave stale bounds and cause culling bugs.

Mitigation:

1. Add explicit tests for dirty and untouched model subsets.
2. Keep a temporary debug assertion mode that can compare dirty-only vs. full recompute behavior.

Risk: dirty-driven attachment updates can miss pose changes.

Mitigation:

1. Tie dirty flags to the authoritative movement/model update paths.
2. Keep a forced full refresh hook for fallback and debugging.

Risk: single tone-mapping path changes the look of the game.

Mitigation:

1. Treat this as a controlled visual retune.
2. Verify against existing quality tiers and worldmap/hexception scenes.

## 11. TDD Strategy

### 11.1 TDD policy

1. No production code before a failing test.
2. Each workstream starts with the smallest regression or behavior test that proves the change is missing.
3. Perf-oriented tests may use source inspection, instrumentation counters, or bounded-call assertions when direct
   runtime perf measurement is too unstable.

### 11.2 New failing tests to add first

TDD-001 Terrain cache avoids live-mesh snapshot round-trip

1. Extend `client/apps/game/src/three/scenes/worldmap-performance-regression.test.ts`.
2. Assert the worldmap terrain cache path no longer depends on `cacheMatricesForChunk()` snapshotting live mesh state
   after every commit, or equivalent instrumentation proving zero snapshot round-trips on cacheable terrain commits.

TDD-002 Structure refresh does not zero all loaded models

1. Extend `client/apps/game/src/three/managers/structure-manager.performance-regression.test.ts`.
2. Assert visible structure refresh no longer starts with sweeping `setCount(0)` across all base and cosmetic model
   families.

TDD-003 Dirty-only army upload and bounds

1. Extend `client/apps/game/src/three/managers/army-manager-performance-regression.test.ts`.
2. Extend `client/apps/game/src/three/managers/army-model.performance-regression.test.ts`.
3. Assert chunk upload can target dirty model subsets instead of all loaded models/cosmetics.

TDD-004 Stationary attachment transforms stop updating every frame

1. Extend `client/apps/game/src/three/managers/army-manager-performance-regression.test.ts`.
2. Assert attachment transform updates are gated by dirty state rather than full visible-army iteration for stationary
   attached armies.

TDD-005 Single tone-mapping path

1. Extend `client/apps/game/src/three/game-renderer.lifecycle.test.ts`.
2. Assert that when post-processing tone mapping is enabled, renderer tone mapping is `NoToneMapping`, or equivalent
   single-path behavior.

TDD-006 Interactive hex updates retain shared window state

1. Add or extend `client/apps/game/src/three/scenes/worldmap-performance-regression.test.ts`.
2. Add or extend `client/apps/game/src/three/managers/interactive-hex-manager` test coverage if needed.
3. Assert adjacent window shifts do not call a full clear-and-rebuild path.

### 11.3 Suggested implementation order

1. Workstream E: single tone-mapping path.
2. Workstream B: dirty-scoped structure model updates.
3. Workstream C: dirty-scoped army upload and bounds.
4. Workstream D: dirty-driven attachment transforms.
5. Workstream F: incremental interactive-hex window updates.
6. Workstream A: terrain cache ownership refactor.

Reasoning:

1. Tone-mapping cleanup is isolated and low-risk.
2. Structure and army dirty-scoping reduce chunk-switch cost without changing terrain correctness.
3. Attachment dirtying lowers steady-state frame cost.
4. Interactive-hex diffing is localized.
5. Terrain cache ownership is the biggest refactor and should land after the surrounding behavior is more stable.

### 11.4 Verification commands

Run targeted tests:

```bash
pnpm --dir client/apps/game test \
  src/three/game-renderer.lifecycle.test.ts \
  src/three/managers/structure-manager.performance-regression.test.ts \
  src/three/managers/army-manager-performance-regression.test.ts \
  src/three/managers/army-model.performance-regression.test.ts \
  src/three/scenes/worldmap-performance-regression.test.ts \
  src/three/scenes/worldmap-cache-safety.test.ts \
  src/three/scenes/worldmap-terrain-convergence.test.ts \
  src/three/scenes/worldmap-runtime-lifecycle.test.ts
```

Then run typecheck:

```bash
pnpm --dir client/apps/game exec tsc --noEmit --pretty false
```

If interactive-hex tests are introduced in a new file, append that file explicitly to the test command.

## 12. Delivery Notes

1. This PRD intentionally scopes the next performance phase to concrete, repo-verified issues only.
2. It should be executed after or alongside the prior March 10 Three.js hot-path PRD, not as a replacement for it.
3. The most likely highest-value wins are:
   - terrain buffer ownership
   - structure dirty-scoped refresh
   - army dirty-scoped upload/bounds
