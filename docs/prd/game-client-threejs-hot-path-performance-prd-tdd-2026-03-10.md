# Game Client Three.js Hot-Path Performance PRD + TDD (O(n) Review Follow-Up)

Status: In Progress
Owner: Game Client
Target branch: `next`
Primary app: `client/apps/game`
Date: March 10, 2026

## 0. Implementation Tracker

- [x] Remove duplicate structure visible-set reconciliation from chunk updates.
- [x] Keep `StructureManager.showLabels()` label-only instead of retriggering a full reconcile.
- [x] Move visible structure ownership-bucket point icons incrementally.
- [x] Add chest spatial index and bucketed visible lookup parity tests.
- [x] Add Phase 1 structure/chest regression tests and run the surrounding structure-manager test slice.
- [x] Fix army draw-count high-water marks with dense live slot behavior.
- [x] Localize first-load base model and cosmetic replay to waiting entities only.
- [x] Enforce animation visibility context in `ArmyModel.updateAnimations()`.
- [x] Remove full point-cloud bounds recomputation from moving-icon updates.
- [x] Narrow army timer maintenance to active subsets.
- [ ] Segment army/structure label visibility scans.

## 1. Summary

This document defines a focused performance program for the Three.js game client to eliminate CPU hot paths whose cost
currently scales with total tracked entities, historical peak occupancy, or full visible-set rebuilds instead of the
active visible subset.

The program is driven by a code review completed on **March 10, 2026** against the `client/apps/game/src/three`
subsystem. The highest-impact findings are:

1. Structure chunk updates perform duplicate visible-set rebuilds.
2. Chest visibility still scans the full chest table on chunk updates and mutations.
3. Army animation and related mesh work scale with peak allocated slots, not live visible armies.
4. First-time model and cosmetic loads replay against the global army instance table.
5. Moving army point icons recompute whole point-cloud bounds every frame.
6. Army tick maintenance performs repeated full-map scans every second.
7. Label visibility maintenance scales with full label population during camera motion.

This PRD combines product requirements and technical design, then defines a test-driven delivery plan so fixes can be
implemented safely and benchmarked against explicit regression gates.

## 2. Problem Statement

Users see camera pan stutter, chunk-switch hitches, and performance degradation as world state grows. The issue is not
primarily one expensive shader or one oversized draw call. The larger problem is that several Three.js subsystems still
do work proportional to:

1. Total tracked chests or armies in memory.
2. Historical peak slot allocation instead of current visible occupancy.
3. Entire visible structure or label populations when a single item changes.
4. Entire global instance tables when one model or cosmetic becomes available.

This means scale problems compound over session time:

1. Chunk switches become slower as entity tables grow.
2. Frame cost can remain elevated after visibility drops.
3. Spectator and high-army sessions pay for offscreen state.
4. Repeated camera interaction keeps retriggering global label and visibility work.

## 3. Goals

### 3.1 Product Goals

1. Reduce visible chunk-switch hitching during pan, zoom, and shortcut navigation.
2. Keep frame-time cost proportional to the active visible subset, not total world history.
3. Prevent long-session degradation caused by historical high-water marks in render data structures.
4. Preserve gameplay correctness, labels, ownership coloring, timers, and chunk hydration behavior.

### 3.2 Engineering Goals

1. Eliminate known `O(total_entities)` hot paths from frequent update, render, and chunk-switch flows.
2. Replace peak-occupancy-driven loops with dense live counts or active subsets.
3. Introduce targeted tests that fail on asymptotic regressions before implementation.
4. Add repeatable instrumentation so changes can be compared against baseline worldmap benchmarks.

## 4. Non-Goals (V1)

1. Rewriting the full worldmap renderer.
2. Replacing Three.js, postprocessing, or CSS2D labels globally.
3. Large art-pipeline changes to models, shaders, or textures.
4. General bundle-size or memory work outside the scoped hot paths in this document.
5. Solving every constant-factor inefficiency in the rendering stack.

## 5. Users and Impact

### 5.1 User Impact

1. Players panning around dense maps should see smoother chunk transitions.
2. Spectators and high-entity sessions should avoid performance collapse tied to total world state.
3. Long sessions should not keep paying for no-longer-visible armies or indicator slots.

### 5.2 Engineering Impact

1. Performance work becomes measurable instead of anecdotal.
2. Hot-path ownership becomes clearer across `worldmap.tsx`, `army-manager.ts`, `structure-manager.ts`, and
   `chest-manager.ts`.
3. Future regressions can be caught in unit/perf tests before they reach manual QA.

## 6. Current-State Findings (Repo Verified)

### 6.1 Duplicate structure visible-set rebuilds

During chunk updates, `StructureManager.updateChunk()` awaits `updateVisibleStructures()` and then immediately calls
`showLabels()`, which calls `updateVisibleStructures()` again.

Relevant code:

1. `client/apps/game/src/three/managers/structure-manager.ts:1011`
2. `client/apps/game/src/three/managers/structure-manager.ts:1012`
3. `client/apps/game/src/three/managers/structure-manager.ts:1788`

Result:

1. Chunk switch and forced refresh structure work is duplicated.
2. Cost is effectively `2 x O(visible_structures)` for the same chunk commit.

### 6.2 Structure live updates trigger full visible rebuilds

Per-structure updates inside the current chunk still call `updateVisibleStructures()` for the entire visible set.

Relevant code:

1. `client/apps/game/src/three/managers/structure-manager.ts:926`

Result:

1. Single structure changes scale with the entire visible structure population.
2. This is avoidable because the changed entity is already known.

### 6.3 Chest visibility is full-table scan based

`ChestManager.getVisibleChestsForChunk()` builds visibility via `Array.from(chests.values()).filter(...).map(...)`.

Relevant code:

1. `client/apps/game/src/three/managers/chest-manager.ts:331`
2. `client/apps/game/src/three/managers/chest-manager.ts:349`
3. `client/apps/game/src/three/managers/chest-manager.ts:221`
4. `client/apps/game/src/three/managers/chest-manager.ts:598`

Result:

1. Chunk updates scale with `O(total_chests)`.
2. Chest insert/remove events also retrigger full-table scans.
3. Armies and structures already have spatial bucketing; chests do not.

### 6.4 Army animation work ignores visibility culling input

`ArmyManager.update()` passes animation visibility context, but `ArmyModel.updateAnimations()` ignores it and iterates
all loaded model groups.

Relevant code:

1. `client/apps/game/src/three/managers/army-manager.ts:2061`
2. `client/apps/game/src/three/managers/army-model.ts:861`
3. `client/apps/game/src/three/managers/army-model.ts:867`
4. `client/apps/game/src/three/managers/army-model.ts:929`
5. `client/apps/game/src/three/managers/army-model.ts:1003`

Result:

1. Frame-time animation cost stays tied to loaded model occupancy.
2. Visibility infrastructure is present but not actually used here.

### 6.5 Army draw count follows historical max slot, not live dense count

Freed slots go to a free list, but model draw count is still computed as `maxSlot + 1`.

Relevant code:

1. `client/apps/game/src/three/managers/army-model.ts:486`
2. `client/apps/game/src/three/managers/army-model.ts:634`
3. `client/apps/game/src/three/managers/army-model.ts:1828`

Result:

1. Chunk churn can leave `mesh.count` pinned to historical peak occupancy.
2. Animation scans, bounds work, and any draw-count-based loops inherit that inflated cost.

### 6.6 Model/cosmetic load replay is global

When a new base model or cosmetic model loads, replay helpers iterate the full `instanceData` map and reapply matching
instances.

Relevant code:

1. `client/apps/game/src/three/managers/army-model.ts:61`
2. `client/apps/game/src/three/managers/army-model.ts:187`
3. `client/apps/game/src/three/managers/army-model.ts:224`
4. `client/apps/game/src/three/managers/army-model.ts:244`
5. `client/apps/game/src/three/managers/army-model.ts:267`
6. `client/apps/game/src/three/managers/army-manager.ts:1233`
7. `client/apps/game/src/three/managers/army-manager.ts:1001`

Result:

1. A local chunk introducing one new model type can trigger `O(total_tracked_armies)` replay work.
2. Cost scales with total tracked army history, not chunk-local visibility.

### 6.7 Moving icons force full point-cloud bounds recomputation

Moving-army icon updates mark the whole renderer bounds dirty and `endBatch()` recomputes a full geometry bounding
sphere.

Relevant code:

1. `client/apps/game/src/three/managers/army-manager.ts:2146`
2. `client/apps/game/src/three/managers/army-manager.ts:2210`
3. `client/apps/game/src/three/managers/points-label-renderer.ts:115`
4. `client/apps/game/src/three/managers/points-label-renderer.ts:135`
5. `client/apps/game/src/three/managers/points-label-renderer.ts:181`

Result:

1. Per-frame moving-icon cost scales with total points in a renderer.
2. This is paid in an especially hot path.

### 6.8 Army tick maintenance is full-map scan based

Every second, armies recompute stamina for all tracked armies and then recompute battle timers for all tracked armies.

Relevant code:

1. `client/apps/game/src/three/managers/army-manager.ts:345`
2. `client/apps/game/src/three/managers/army-manager.ts:353`
3. `client/apps/game/src/three/managers/army-manager.ts:2651`
4. `client/apps/game/src/three/managers/army-manager.ts:2697`

Result:

1. Background work scales with `O(total_armies)` regardless of visibility.
2. Structure timers already demonstrate the better active-set approach.

### 6.9 Label visibility maintenance scales with full label maps

Frustum/visibility changes mark labels dirty, and the next interval walks every label to toggle DOM state and refresh
content.

Relevant code:

1. `client/apps/game/src/three/managers/army-manager.ts:232`
2. `client/apps/game/src/three/managers/army-manager.ts:238`
3. `client/apps/game/src/three/managers/army-manager.ts:2218`
4. `client/apps/game/src/three/managers/structure-manager.ts:267`
5. `client/apps/game/src/three/managers/structure-manager.ts:273`
6. `client/apps/game/src/three/managers/structure-manager.ts:1661`

Result:

1. Pan/zoom interaction keeps retriggering `O(label_count)` DOM-facing work.
2. The issue grows with label population in larger scenes.

## 7. Requirements

### 7.1 Functional Requirements

FR-001 Structure chunk reconciliation

1. A structure chunk update must perform visible-set reconciliation at most once per chunk switch or forced refresh.
2. Label-show behavior must not trigger a second full visible-structure rebuild.
3. Single-structure updates in the current chunk must update only the affected structure unless a true full rebuild is
   required.

FR-002 Chest visibility indexing

1. Chest visibility lookup must be spatially indexed, matching the asymptotic shape already used by armies and
   structures.
2. Chest add, remove, and chunk refresh must operate on visible/bucketed subsets instead of the full chest table.

FR-003 Army dense occupancy and animation culling

1. Army animation work must scale with current live visible army occupancy, not historical peak slot allocation.
2. Army animation must honor the supplied visibility context.
3. Freed army slots must not leave draw counts inflated indefinitely.

FR-004 Localized model replay

1. Loading one base model or cosmetic model must not walk the entire army instance table.
2. Replay bookkeeping must support direct lookup of the entities waiting on a given model or cosmetic.

FR-005 Point icon bounds efficiency

1. Moving icon updates must not require full point-cloud bounding-sphere recomputation every frame.
2. Frustum visibility for icon clouds must be maintained with either stable bounds, incremental bounds updates, or a
   bounded recomputation strategy.

FR-006 Army tick maintenance scoping

1. Stamina and battle-timer maintenance must operate on narrow tracked subsets where possible.
2. The background tick path must not scan all tracked armies when only a small active subset actually needs updates.

FR-007 Label visibility scaling

1. Camera-driven label maintenance must not rescan all labels on every visibility change.
2. Label visibility updates must operate on smaller active subsets, chunk-bounded groups, or reuse prior visibility
   state without whole-map DOM churn.

### 7.2 Non-Functional Requirements

NFR-001 Correctness

1. No army, structure, chest, ownership, timer, or label regression is acceptable.
2. Chunk transitions must remain visually correct during fast pan, zoom, and shortcut navigation.

NFR-002 Performance

1. All fixes must show measurable improvement in benchmark or instrumentation output.
2. No fix may trade one `O(total_entities)` path for another equivalent global scan.

NFR-003 Maintainability

1. New indexes and tracking sets must have explicit lifecycle ownership and cleanup semantics.
2. Dense-slot or active-subset logic must remain understandable to future contributors.

## 8. Success Metrics

### 8.1 Chunk and interaction metrics

1. Structure manager chunk reconciliation time reduced by >= 35% on chunk switch scenarios with dense visible
   structures.
2. Chest manager chunk update time remains approximately flat as offscreen chest count grows.
3. Shortcut navigation into a chunk with previously unseen army models/cosmetics does not show a hitch proportional to
   total tracked armies.

### 8.2 Frame-time metrics

1. Army animation update time scales with current visible army count, not historical peak slot count.
2. Moving icon updates do not trigger full point-cloud bounds recomputation every frame.
3. Camera pan/zoom label maintenance time reduced by >= 30% in dense-label benchmark scenes.

### 8.3 Background maintenance metrics

1. Per-second army maintenance work scales with active timers or moving/dirty armies, not all armies in memory.
2. No repeated full-scan path remains in the known hot flows documented in section 6.

## 9. Technical Design

### 9.1 Structure manager reconciliation redesign

#### Current

1. `updateChunk()` calls `updateVisibleStructures()`.
2. It then calls `showLabels()`.
3. `showLabels()` calls `updateVisibleStructures()` again.
4. Per-structure updates inside the active chunk also call full visible reconciliation.

#### Design

1. Remove the second full reconciliation from `showLabels()`.
2. Convert `showLabels()` into a label-only action or remove it from chunk update entirely.
3. Introduce targeted structure patch methods for:
   - label refresh
   - point icon move/update
   - attachment transform refresh
   - model matrix refresh for a single structure
4. Preserve a full rebuild path only for:
   - chunk switches
   - force refreshes
   - ownership bucket changes that require renderer migration

#### Notes

1. This area is the safest first fix because it removes known duplicate work without changing chunk policy.

### 9.2 Chest spatial index

#### Current

1. Chests are stored in a flat `Map<ID, ChestData>`.
2. Chunk updates filter the entire map.

#### Design

1. Add a chest bucket index keyed by the same chunk stride logic used by armies and structures.
2. Maintain index updates on:
   - chest add
   - chest remove
   - any chest move if introduced later
3. Replace full-table visibility scans with bucketed visible lookup.
4. Keep chest point/icon/label diffing based on the bucketed visible set.

#### Notes

1. This should make chest asymptotics consistent with the rest of the world entity managers.

### 9.3 Dense army occupancy and draw counts

#### Current

1. Army mesh draw counts are derived from `maxSlot + 1`.
2. Freed slots do not reduce `mesh.count` unless the high slot is reclaimed.

#### Design Options

Option A: Dense live-slot compaction

1. Maintain a dense visible slot region.
2. Move the last live slot into any removed slot.
3. Update entity-to-slot bookkeeping on swap.
4. Keep `mesh.count === live_visible_count`.

Option B: Sparse internal slots with dense per-model active slot arrays

1. Preserve sparse global slots if needed.
2. Maintain dense per-model draw order for animated/raycasted data.
3. Drive animation and raycast loops from dense active slot arrays, not `maxSlot + 1`.

#### Preferred direction

1. Use the minimal design that makes animation, bounds, and raycast work proportional to live active instances.
2. Avoid large refactors unless tests show they are necessary.

### 9.4 Army animation visibility enforcement

#### Current

1. `ArmyManager` passes visibility context.
2. `ArmyModel` ignores it.

#### Design

1. Wire `AnimationVisibilityContext` into `ArmyModel.updateAnimations()`.
2. Skip entire model groups that fail chunk or visibility checks.
3. Ensure per-model loops operate on dense active instance counts only.
4. Keep current graphics-tier throttling on top of real visibility culling, not instead of it.

### 9.5 Localized replay indexes for model and cosmetic loads

#### Current

1. When a model finishes loading, replay walks all `instanceData`.

#### Design

1. Maintain reverse indexes:
   - `modelType -> Set<entityId>`
   - `cosmeticId -> Set<entityId>`
2. Update these indexes when:
   - assigning a model to an entity
   - clearing model/cosmetic assignments
   - removing an entity
3. Replay only the entities registered for the newly loaded model/cosmetic.

#### Notes

1. This change is highly leverageable because it removes a chunk hitch tied to total tracked armies.

### 9.6 Point icon bounds strategy

#### Current

1. `setPoint()` dirties bounds.
2. `endBatch()` recomputes full geometry bounds.

#### Design Options

Option A: Chunk-bounded fixed spheres

1. For chunk-scoped icon renderers, use conservative stable bounds tied to chunk bounds.
2. Skip per-frame geometry-wide recomputation unless point count changes materially.

Option B: Incremental bounds update

1. Maintain min/max extents during batch update.
2. Rebuild bounding sphere only if updated points escape the prior bounds threshold.

#### Preferred direction

1. Use stable chunk-relative bounds where practical.
2. Fall back to incremental rebuild only when count or chunk ownership changes.

### 9.7 Army maintenance active subsets

#### Current

1. Stamina recomputation walks all armies once per tick advance.
2. Battle-timer recomputation walks all armies every second.

#### Design

1. Introduce active tracking sets for:
   - armies with active battle timers
   - armies whose stamina UI can actually change in visible or label-relevant ways
   - optionally, armies currently visible or selected if UI semantics allow it
2. Recompute battle timers from active timer set only.
3. Reevaluate whether stamina must be eagerly updated for all armies or can be:
   - lazily derived on label render
   - updated for visible/selected armies only
   - refreshed on-demand from tick delta

#### Notes

1. Battle timers are the low-risk first step because structure manager already demonstrates the pattern.

### 9.8 Label visibility segmentation

#### Current

1. Visibility changes dirty whole label maps.
2. The next pass walks every active label.

#### Design

1. Segment label tracking by chunk or manager-local visible sets.
2. Only re-evaluate labels whose owning chunk/manager visibility changed.
3. Avoid re-running DOM content refresh unless label data actually changed.
4. Preserve current label data-key memoization.

#### Notes

1. This should be approached after the more structural entity-index fixes because label count naturally drops once full
   rebuilds are removed.

## 10. Delivery Plan (Phased)

### Phase 0: Baseline + guardrails

1. Capture current worldmap benchmark artifacts for:
   - dense structures
   - dense armies
   - dense chests
   - first-time model/cosmetic load
2. Add instrumentation hooks where needed so each scoped subsystem exposes:
   - visible count
   - total tracked count
   - peak slot count
   - active timer count
3. Freeze benchmark inputs for before/after comparison.

### Phase 1: Safe duplication and indexing fixes

1. Remove duplicate structure full rebuild on chunk update.
2. Add chest spatial index.
3. Add unit tests proving bucketed chest lookup matches previous visible results.
4. Add unit tests proving structure chunk update triggers a single reconciliation.

### Phase 2: Army occupancy and replay fixes

1. Fix army draw-count/high-water-mark behavior.
2. Introduce model/cosmetic reverse indexes for localized replay.
3. Add regression tests for chunk churn, slot reuse, and replay locality.

### Phase 3: Animation and point-icon hot paths

1. Enforce visibility-aware army animation updates.
2. Remove full point-cloud bounds recomputation from moving-icon frame updates.
3. Add perf-oriented tests around visible-count scaling.

### Phase 4: Background maintenance and label scaling

1. Move army battle timers to active-set maintenance.
2. Narrow or lazify stamina recomputation.
3. Segment label visibility updates.
4. Re-benchmark camera pan/zoom and long-session maintenance overhead.

### Phase 5: Harden and gate

1. Add perf regression checks to the worldmap benchmark loop.
2. Document subsystem invariants for future contributors.
3. Publish follow-up notes in the performance docs if further work remains.

## 11. Test-Driven Delivery Strategy

### 11.1 TDD policy

1. No production change ships without a failing test first.
2. Each fix area below must begin with a targeted failing regression test.
3. Perf-sensitive refactors must prove both correctness and bounded work shape.

### 11.2 Red-Green-Refactor sequence by workstream

#### Workstream A: structure reconciliation

RED

1. Add a regression test that fails if `StructureManager.updateChunk()` causes more than one visible reconciliation for
   the same chunk.
2. Add a regression test that updates one structure inside the current chunk and fails if a full visible rebuild is
   triggered unnecessarily.

GREEN

1. Remove duplicate `showLabels()`-driven rebuild.
2. Introduce targeted structure patch path where required.

REFACTOR

1. Simplify label-only APIs so they cannot accidentally trigger data reconciliation.

#### Workstream B: chest indexing

RED

1. Add tests showing visible chest lookup cost depends on bucketed candidates, not all stored chests.
2. Add parity tests comparing old and new visible chest results for representative chunk bounds.

GREEN

1. Introduce chest spatial index and switch visibility lookups to it.

REFACTOR

1. Consolidate shared chunk/bucket math with armies and structures where practical.

#### Workstream C: army high-water-mark and animation

RED

1. Add tests where visible armies shrink after churn but mesh draw count remains inflated.
2. Add tests where `updateAnimations()` receives visibility context and should skip offscreen model groups.
3. Add tests showing animation iteration count tracks live active instances, not peak slots.

GREEN

1. Implement dense occupancy or equivalent active-slot iteration.
2. Honor visibility context.

REFACTOR

1. Clean up slot bookkeeping and documentation once tests pass.

#### Workstream D: localized replay

RED

1. Add tests proving first-time model load only replays entities registered for that model type.
2. Add equivalent tests for cosmetics.

GREEN

1. Add reverse indexes and replace global `instanceData` replay walks.

REFACTOR

1. Centralize model-assignment bookkeeping.

#### Workstream E: point icon bounds

RED

1. Add tests proving moving icon updates do not recompute full geometry bounds every frame.
2. Add visibility parity tests so frustum culling behavior remains correct after the optimization.

GREEN

1. Introduce stable bounds or incremental bounds maintenance.

REFACTOR

1. Unify the chosen bounds strategy across point renderers where beneficial.

#### Workstream F: background army maintenance

RED

1. Add tests proving battle timer recomputation touches only active timer armies.
2. Add tests documenting intended stamina update scope.

GREEN

1. Move battle timers to active sets.
2. Narrow or lazify stamina updates based on agreed behavior.

REFACTOR

1. Share active-set patterns with structure timers.

#### Workstream G: label visibility scaling

RED

1. Add tests proving camera visibility changes do not require full label-map rescans when unchanged subsets remain
   stable.
2. Add tests preserving label show/hide correctness during pan/zoom and chunk switches.

GREEN

1. Segment visibility tracking and avoid whole-map DOM churn.

REFACTOR

1. Consolidate label visibility machinery between armies and structures where helpful.

## 12. Test Plan

### 12.1 Unit tests

1. `StructureManager.updateChunk()` reconciles once per chunk update.
2. Structure patch updates do not trigger full visible rebuild when a targeted update is sufficient.
3. Chest bucket lookup returns the same visible results as the current full-scan logic.
4. Army model draw count shrinks with live active occupancy after removals.
5. Army animation respects visibility context.
6. Model replay only touches entities registered to the loaded model type.
7. Cosmetic replay only touches entities registered to the loaded cosmetic id.
8. Point icon renderer avoids full bounding-sphere recomputation on pure positional updates.
9. Army battle timer maintenance iterates active timers only.

### 12.2 Integration tests

1. Chunk switch with dense structures still renders correct labels, points, attachments, and wonders.
2. Dense chest worlds render the correct visible subset after pan and forced refresh.
3. First entry into a chunk with unseen models/cosmetics keeps armies rendered correctly after preload completes.
4. Fast back-and-forth chunk movement does not break army slot reuse or animation state.
5. Pan/zoom keeps army and structure labels correct without flicker or stale hidden state.

### 12.3 Performance tests

1. Extend the worldmap benchmark with synthetic stress inputs for:
   - high offscreen chest count
   - high historical army churn
   - first-time model/cosmetic load
   - dense active labels
2. Track:
   - chunk switch duration
   - manager update duration
   - animation update duration
   - icon update duration
   - label visibility update duration
3. Fail perf regression checks when cost grows with offscreen totals after the fix is in place.

## 13. Instrumentation and Benchmarking

1. Reuse the existing worldmap optimization loop in `client/apps/game/WORLDMAP_OPTIMIZATION_LOOP.md`.
2. Add debug counters for:
   - `trackedArmies`
   - `visibleArmies`
   - `peakArmySlot`
   - `activeArmyTimerCount`
   - `trackedChests`
   - `visibleChests`
   - `visibleStructureRebuildCount`
   - `modelReplayEntityCount`
   - `labelVisibilityCheckedCount`
3. Emit these counters into benchmark JSON so regressions can be compared automatically.

## 14. Risks and Mitigations

### 14.1 Dense slot compaction risk

Risk

1. Slot compaction can break entity-to-instance mappings, cosmetics, or movement state.

Mitigation

1. Cover slot reassignment with targeted tests before refactor.
2. Preserve a clear swap/update contract for all slot owners.

### 14.2 Over-optimizing label behavior

Risk

1. Label batching changes can introduce stale DOM or missing hover labels.

Mitigation

1. Preserve behavior tests for hover, re-show, chunk switch, and camera view changes.

### 14.3 Chest index correctness drift

Risk

1. Index updates can desynchronize from chest storage.

Mitigation

1. Add parity tests against existing full-scan results.
2. Add invariant checks in development builds if needed.

### 14.4 Stamina semantics ambiguity

Risk

1. Narrowing stamina updates can accidentally change UI semantics for offscreen armies.

Mitigation

1. Decide intended behavior before implementation.
2. Encode that behavior in tests first.

## 15. Rollout Plan

1. Land instrumentation and safe regression tests first.
2. Ship Phase 1 and Phase 2 behind standard review with before/after benchmark artifacts.
3. Validate on dense spectator and debug-army sessions before continuing to later phases.
4. Merge perf benchmark threshold updates only after a clean post-fix baseline is captured.

## 16. Acceptance Criteria

This initiative is complete when:

1. All section 11 regression tests were written first, failed correctly, then passed.
2. No hot path listed in section 6 still scales with total tracked entities where an active subset is available.
3. Worldmap benchmark artifacts show meaningful improvement against baseline.
4. Gameplay correctness remains intact across worldmap chunking, labels, timers, and ownership visuals.

## 17. Immediate Implementation Order

Recommended first implementation sequence:

1. Remove duplicate structure visible reconciliation.
2. Add chest spatial index.
3. Fix army draw-count high-water marks.
4. Localize model/cosmetic replay indexes.
5. Make army animation visibility-aware.
6. Fix moving-icon bounds recomputation.
7. Narrow army timer and stamina maintenance.
8. Segment label visibility updates last.
