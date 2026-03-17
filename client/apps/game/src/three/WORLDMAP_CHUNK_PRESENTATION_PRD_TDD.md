# Worldmap Chunk Presentation Synchronization PRD + TDD

Status: Implemented (Stages 0-3 complete; Stage 4 pending)
Date: 2026-03-17
Scope: `client/apps/game/src/three`
Primary surfaces: worldmap chunk traversal, terrain/building synchronization, chunk hydration barriers, structure asset prewarm, transition diagnostics

## 1. Summary

The current worldmap chunk pipeline does not present a chunk as one visual unit.

Today the terrain grid for the next chunk is prepared and applied before the structure, army, and chest managers are allowed to update. That sequencing makes chunk traversal feel unstable because the player can see:

- new biome terrain before buildings
- new terrain under old entities during the handoff window
- terrain cutouts and structure placement resolve on different frames
- bigger pop-in on revisits where terrain cache replay is immediate but structure work still waits

This document turns that review into a concrete product and engineering plan. The target outcome is an atomic chunk presentation contract:

- keep the previous chunk fully visible while the next chunk prepares
- do not expose the next chunk until terrain, structures, and other visible managers are ready together
- prewarm structure and cosmetic assets before the visible swap
- add diagnostics and tests that measure presentation skew directly

## 2. Problem Statement

### 2.1 User problem

When the player crosses a chunk boundary on the world map:

- the ground often appears first
- buildings arrive later
- on some switches, the visual stack feels like it is resolving in layers rather than moving through one coherent world

That creates a cheap streaming feel even when total load time is acceptable.

### 2.2 Current implementation issues

The current behavior comes from five concrete issues.

1. Terrain is updated before chunk authority and manager fanout.
2. The chunk hydration barrier waits for tile fetch completion, but not for async structure processing to drain.
3. Structure and cosmetic models are lazily loaded on the visible update path.
4. Terrain hiding under structures depends on live `structureHexCoords` during grid generation, which races with structure updates.
5. Existing tests encode the staggered terrain-first sequencing, so the wrong contract is currently protected.

## 3. Review Findings

### 3.1 Terrain is applied before structures by design

`hydrateWarpTravelChunk()` starts the tile fetch, then immediately awaits `updateHexagonGrid()`, and only afterwards waits for the tile fetch to finish. The commit path then advances `currentChunk` and runs manager fanout after hydration is complete.

Relevant files:

- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`

Effect:

- the terrain layer can switch before structures, armies, and chests
- cached terrain makes the mismatch even more obvious because the terrain path is faster than manager updates

### 3.2 The fetch barrier is incomplete for structures

`computeTileEntities()` resolves when `getMapFromToriiExact()` returns. Separately, the world update listener processes structure tile updates with an async callback that awaits `structureManager.onUpdate(value)`. There is no explicit barrier proving that all structure updates caused by a fetch are finished before the chunk is considered hydrated.

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`

Effect:

- structure placement can still be converging after the fetch promise reports success
- terrain generation and manager updates can observe different structure state snapshots

This is an inference from the async ownership in the current source. Even if Torii usually delivers updates quickly enough, the pipeline does not enforce it.

### 3.3 Structure model loading happens on the visible path

`StructureManager.performVisibleStructuresUpdate()` preloads missing structure and cosmetic models inside the active chunk update before it repopulates visible instances.

Relevant file:

- `client/apps/game/src/three/managers/structure-manager.ts`

Effect:

- first entry into a chunk containing a new structure type or cosmetic skin pushes visible building appearance behind GLTF load time
- the terrain layer has no equivalent delay because biome models are preloaded at worldmap startup

### 3.4 Terrain masking races with structure data

`updateHexagonGrid()` hides terrain tiles by checking `this.structureManager.structureHexCoords` while generating biome instances.

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/structure-manager.ts`

Effect:

- the terrain cutout decision is based on whatever structure coords happen to be available during grid generation
- this can produce inconsistent intermediate states:
  - full terrain first, then buildings
  - terrain holes before building instances
  - different results between cold and warm traversals

### 3.5 The test suite currently protects the wrong sequencing

The current tests explicitly assert that:

- grid update happens before manager update
- chunk authority is committed only after that path completes

Relevant files:

- `client/apps/game/src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.test.ts`
- `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.test.ts`

Effect:

- the current pop-in contract is partially codified as expected behavior
- any fix must start by replacing those expectations

## 4. Goals

### 4.1 Product goals

- chunk traversal should feel like one scene move, not a layered rebuild
- buildings should not visibly arrive after the biome floor for the same chunk
- revisiting prefetched or cached chunks should feel especially stable
- chunk transitions should preserve continuity even when loads are slow

### 4.2 Technical goals

- define one presentation-ready barrier for chunk swaps
- keep old visuals live until the new chunk is ready to present
- move structure and cosmetic loading out of the visible swap path
- make terrain and manager commit happen together
- add diagnostics that measure terrain-ready, structure-ready, and presentation-commit timing separately

## 5. Non-goals

- changing chunk geometry, stride, or render-window policy
- redesigning worldmap art direction, terrain assets, or building assets
- rewriting the entire manager architecture outside the chunk handoff path
- shipping a fancy crossfade or dissolve as the first fix
- replacing Torii or the ECS update model in this project

## 6. Product Requirements

### 6.1 Presentation contract

For any chunk switch:

- the previous chunk remains fully visible until the target chunk is presentation-ready
- the target chunk must not become visible in a mixed state
- no frame may show:
  - new terrain with old structures
  - new structures with old terrain
  - terrain masking that does not match the structures shown

### 6.2 Readiness contract

A target chunk is presentation-ready only when all of the following are true:

- target terrain snapshot is prepared
- target fetch area completed successfully
- async structure updates for the target fetch generation are drained
- required structure models for the visible target chunk are loaded
- required cosmetic models for the visible target chunk are loaded, or a fallback presentation rule is explicitly chosen
- target bounds subscription and visibility bounds are ready

### 6.3 Performance contract

- cached terrain replay must still obey the atomic presentation contract
- the visible commit must happen in one commit phase after readiness is satisfied
- structure prewarm should happen during chunk preparation and prefetch, not after the swap

### 6.4 Reliability contract

- stale transitions must drop prepared work without leaking visibility state
- rollback on fetch failure must restore the previous presentation cleanly
- diagnostics must make phase skew measurable

## 7. Proposed Technical Design

### 7.1 Introduce a chunk presentation seam

Add a small chunk-presentation layer that splits the current switch into:

1. prepare
2. ready
3. commit

Suggested file:

- new: `client/apps/game/src/three/scenes/worldmap-chunk-presentation.ts`

Responsibilities:

- own the readiness state for a target chunk
- collect terrain snapshot, structure drain, and asset prewarm promises
- decide whether a target chunk may be committed
- expose a single commit payload for terrain plus manager fanout

### 7.2 Prepare terrain offscreen, not directly into the live scene

The current `updateHexagonGrid()` mutates live biome instances during preparation. That needs to become a two-step flow:

1. prepare a `PreparedTerrainChunk`
2. apply that prepared terrain during commit

Suggested types:

```ts
interface PreparedTerrainChunk {
  chunkKey: string;
  startRow: number;
  startCol: number;
  biomeMatrices: Map<string, { matrices: InstancedBufferAttribute | null; count: number; landColors: Float32Array | null }>;
  bounds: { box: Box3; sphere: Sphere };
  expectedExploredTerrainInstances: number;
}
```

The live biome meshes should only be mutated during the final commit path.

### 7.3 Add an explicit structure hydration drain barrier

The current fetch promise is not a sufficient barrier for presentation readiness. Add a worldmap-owned structure hydration tracker keyed by fetch generation or area key.

Minimum contract:

- when a fetch starts, a generation token is assigned
- structure tile updates triggered for that generation increment in-flight work
- `awaitStructureHydrationIdle(fetchGeneration, fetchKey)` resolves only when all associated async structure updates finish

That gives the chunk pipeline a real answer to: "Are structure coords and structure manager state ready for this fetch?"

### 7.4 Prewarm visible structure and cosmetic assets during preparation

Add a structure-manager prewarm API.

Suggested API:

```ts
prewarmChunkAssets(chunkKey: string): Promise<void>
```

Responsibilities:

- compute the structures that would be visible for the target chunk
- load missing base models for those structures
- load missing cosmetic models for those structures
- avoid redoing work already cached or in flight

This should be called:

- during target chunk preparation
- optionally during directional prefetch for nearby pinned chunks

### 7.5 Commit terrain and managers through one presentation gate

Once readiness is satisfied, the commit path should:

1. verify the transition token is still current
2. set chunk authority
3. apply the prepared terrain snapshot
4. update current chunk bounds
5. fan out manager updates
6. unregister the previous chunk on the next frame

The key difference from today is that step 3 must not happen before readiness, and the whole presentation commit must happen as one coordinated handoff.

### 7.6 Preserve a simple fallback path

If any part of cold-load prewarm is too slow:

- keep the previous chunk visible longer
- do not partially reveal the next chunk

That is a better failure mode than layered pop-in.

Optional phase-two improvement:

- low-detail placeholder structures or silhouette markers if cold-load latency is unacceptable

## 8. File-Level Change Plan

### 8.1 Core pipeline

- `client/apps/game/src/three/scenes/worldmap.tsx`
  - stop mutating live terrain during pre-commit hydration
  - add structure hydration drain tracking
  - route chunk switches through a presentation-ready gate
  - add diagnostics for phase timing and skew
- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.ts`
  - return prepared terrain and readiness primitives instead of applying terrain directly
- `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.ts`
  - commit prepared terrain and manager fanout together
- new: `client/apps/game/src/three/scenes/worldmap-chunk-presentation.ts`
  - readiness state machine and commit payload helpers

### 8.2 Manager support

- `client/apps/game/src/three/managers/structure-manager.ts`
  - add chunk asset prewarm
  - separate asset warmup from visible update
  - optionally expose a visible-structure query suitable for preparation
- `client/apps/game/src/three/managers/structure-update-policy.ts`
  - extend if needed for prewarm or visibility snapshot policy

### 8.3 Diagnostics

- `client/apps/game/src/three/perf/worldmap-render-diagnostics.ts`
  - add counters and durations for:
    - terrain prepared
    - structure drain completed
    - structure assets prewarmed
    - presentation committed
    - presentation skew

## 9. TDD Plan

The current tests encode the old contract, so the first step is to replace them with tests for atomic presentation.

### 9.1 Red: replace the wrong expectations

Update existing tests first:

- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.test.ts`
  - replace "waits for grid plus bounds readiness" with "prepares terrain without exposing it before commit"
- `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.test.ts`
  - replace "commits the hydrated chunk, refreshes bounds, and fans out manager updates" with a test that verifies prepared terrain and managers are committed through one gate
- `client/apps/game/src/three/scenes/worldmap-chunk-orchestration-fixture.test.ts`
  - replace the assertion that manager update is absent after grid preparation with an assertion that previous visuals remain active until presentation commit

### 9.2 Red: add new regression tests

Add tests before implementation:

- new: `client/apps/game/src/three/scenes/worldmap-chunk-presentation.test.ts`
  - "does not expose target terrain before structure barrier and asset prewarm complete"
  - "keeps previous chunk presentation active while target chunk prepares"
  - "drops stale prepared presentations without mutating visible scene"
  - "rolls back cleanly when fetch fails after terrain preparation"
- new: `client/apps/game/src/three/managers/structure-manager.chunk-prewarm.test.ts`
  - "loads visible chunk structure models before visible update"
  - "loads visible chunk cosmetic models before visible update"
  - "dedupes concurrent prewarm requests for the same chunk assets"
- `client/apps/game/src/three/perf/worldmap-render-diagnostics.test.ts`
  - add expectations for presentation phase durations and skew metrics

### 9.3 Red: add worldmap integration-level behavior tests

Add or extend fixture-driven tests:

- `client/apps/game/src/three/scenes/worldmap-chunk-latency-regression.test.ts`
  - "cached terrain replay still waits for structure readiness before commit"
- `client/apps/game/src/three/scenes/worldmap-hydrated-refresh-regression.test.ts`
  - "hydrated refresh does not reveal terrain before structure convergence"
- `client/apps/game/src/three/scenes/worldmap-visibility-frame-ownership.test.ts`
  - "only one chunk presentation owns the visible frame state at a time"

### 9.4 Green: implementation order

Implement in this order:

1. add a pure chunk-presentation policy module and tests
2. add structure hydration drain tracking in `worldmap.tsx`
3. refactor terrain preparation so live terrain is only applied in commit
4. add structure-manager chunk asset prewarm
5. wire perform-chunk-switch through the new readiness and commit contract
6. add diagnostics for phase timing and skew
7. remove any now-obsolete assumptions in fixture tests

### 9.5 Refactor: cleanup after green

After the atomic behavior is passing:

- simplify any redundant hydration helpers
- collapse any duplicate chunk-ready bookkeeping
- move presentation-specific state out of `worldmap.tsx` where practical

## 10. Staged Delivery Plan

### Stage 0: Diagnostics and contract reset

Status: Complete

Objective:

- stop the current tests from protecting the wrong sequencing
- add phase timing so progress is measurable

Exit criteria:

- tests describe atomic presentation, not terrain-first presentation
- diagnostics can report terrain-ready, structure-ready, and commit timing separately

### Stage 1: Structure readiness barrier

Status: Complete

Objective:

- make chunk hydration wait for structure processing, not just Torii fetch completion

Exit criteria:

- structure update drain is explicitly tracked
- target chunk cannot commit while structure processing is still in flight

### Stage 2: Asset prewarm

Status: Complete

Objective:

- remove visible-path GLTF load from structure chunk updates

Exit criteria:

- visible structure update does not have to load missing chunk-critical models on the hot path
- prewarm requests dedupe correctly

### Stage 3: Atomic terrain plus manager commit

Status: Complete

Objective:

- remove the live terrain mutation from pre-commit preparation

Exit criteria:

- no visible new-terrain-before-buildings behavior
- previous chunk remains on screen until commit
- cached terrain replay obeys the same contract

### Stage 4: Optional polish

Status: Pending

Objective:

- improve perceived latency if cold loads remain long

Possible follow-ups:

- placeholder structure silhouettes
- subtle swap animation after atomic correctness is established
- prewarm expansion into pinned-neighborhood strategy

## 11. Success Metrics

### 11.1 Behavior metrics

- zero observed frames where the target terrain is visible while target structures are not yet ready
- zero observed frames where old structures remain over new terrain
- reduced subjective pop-in during cross-chunk traversal

### 11.2 Instrumentation metrics

- `presentationCommitCount`
- `terrainPreparedMs`
- `structureHydrationDrainMs`
- `structureAssetPrewarmMs`
- `presentationSkewMs`

Target:

- `presentationSkewMs` should be effectively zero at visible commit

### 11.3 Regression metrics

- no stale chunk visibility leaks after interrupted switches
- no increase in chunk rollback failures
- no spike in forced refresh loops caused by new readiness tracking

## 12. Risks and Open Questions

### 12.1 Structure drain ownership

Open question:

- what is the narrowest reliable place to track "all structure updates caused by this fetch are done" without over-coupling to Torii internals?

Recommended direction:

- track async structure listener work in worldmap-owned generation counters first

### 12.2 Memory cost of prepared terrain

Risk:

- offscreen terrain preparation can temporarily hold more matrix data than the current direct-apply path

Mitigation:

- reuse the existing matrix pools and release prepared snapshots immediately after commit or drop

### 12.3 Cosmetic cold-load latency

Risk:

- some chunks may contain enough cosmetic variation that prewarm pushes commit latency higher than expected

Mitigation:

- measure separately for base vs cosmetic assets
- if needed, allow a clearly defined fallback presentation mode in a later phase

### 12.4 Existing tests will need intentional rewrites

Risk:

- several current tests are asserting behavior that is part of the bug

Mitigation:

- rewrite those tests first so the implementation can move safely

## 13. Recommendation

Do not try to tune this by only changing debounce, chunk padding, or manager ordering.

The root problem is not just timing variance. The root problem is that the current pipeline exposes partial chunk state by design.

The right fix is to make chunk presentation atomic, add a real structure-readiness barrier, and prewarm structure assets before the visible swap.
