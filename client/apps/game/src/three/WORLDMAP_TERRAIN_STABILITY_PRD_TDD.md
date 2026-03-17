# Worldmap Terrain Stability PRD + TDD

Status: Draft
Date: 2026-03-17
Scope: `client/apps/game/src/three`
Primary surfaces: worldmap chunk traversal, terrain presentation, water and ocean stability, chunk selection, duplicate tile reconciliation, visibility bounds, refresh scheduling

## 1. Summary

Worldmap chunk traversal is functionally working, but the current terrain presentation still has visible instability.

The user-visible symptoms are:

- water and ocean tiles can disappear and reappear while moving
- the terrain can feel like it shifts by a large amount when a chunk switch lands
- after a chunk switch appears to finish, the terrain can visibly change again inside the same chunk

This document defines a detailed product and engineering plan to make worldmap terrain traversal stable, predictable, and testable.

The target outcome is:

- chunk traversal should not feel like half the map is being swapped underneath the camera
- water and ocean surfaces should remain visually stable unless terrain data truly changed
- the system should perform at most one visible terrain commit per settled chunk transition in steady state
- same-chunk refreshes should obey the same atomic presentation contract as cross-chunk switches
- refresh churn, duplicate tile reconciliation, and self-heal behavior should be measurable through diagnostics rather than anecdotal

## 2. Problem Statement

### 2.1 User problem

When the player moves across worldmap chunk boundaries:

- large contiguous terrain, especially ocean and deep ocean, can pop in or out
- the world can look like it re-centers or shifts mid traversal
- some switches appear to commit twice: once for the initial chunk change and again for a later refresh

Even when total load time is acceptable, that creates a visually unstable streaming feel.

### 2.2 Current implementation issues

The current behavior comes from six concrete issues.

1. Chunk authority uses a stride of `24`, while the visible render window is `48x48`, so each committed switch recenters terrain by half the visible window.
2. Chunk selection is derived from raw world-space floor math instead of the parity-aware hex conversion used elsewhere in the renderer.
3. Forced same-chunk refreshes can repaint terrain after the primary chunk switch has already committed.
4. Duplicate tile updates invalidate caches aggressively and can trigger full refreshes for already-known visible terrain.
5. **Critical data loss:** Duplicate tile updates carrying real biome deltas currently return before authoritative terrain state is updated. The early return at the duplicate check exits before the biome write, so changed biome values are silently dropped from `exploredTiles`.
6. Current chunk bounds are too coarse for terrain culling, cache replay gating, and offscreen recovery decisions.

## 3. Review Findings

### 3.1 The visible terrain window shifts by half the screen on every stride change

The world chunk configuration uses:

- stride `24`
- render window `48x48`

Relevant files:

- `client/apps/game/src/three/constants/world-chunk-config.ts`
- `client/apps/game/src/three/utils/chunk-geometry.ts`

Effect:

- each time chunk authority changes, the rendered terrain window moves by `24` hexes
- only half of the old and new windows overlap
- large continuous biomes make that shift highly visible

This is an inference from the current config and render-bounds math. For example, a switch from chunk `0,0` to `24,24` moves the render bounds from approximately `-12..35` to `12..59`, so only `24` columns and `24` rows overlap.

### 3.2 Chunk switch timing is not aligned with the hex coordinate model

The current chunk key is derived from:

- raw world `x/z`
- `Math.floor(...)` against world chunk width and depth

Meanwhile, actual hex conversion and placement use row-parity-aware offsets.

Relevant files:

- `client/apps/game/src/three/scenes/warp-travel-chunk-runtime.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/utils/utils.ts`

Effect:

- chunk ownership can change at a visually surprising moment
- odd-row and diagonal movement paths are more likely to feel inconsistent
- the rendered terrain can appear to shift before the camera feels fully inside the next logical hex region

### 3.3 The primary chunk switch is coordinated, but same-chunk refresh is not

The main chunk switch path already prepares terrain before commit and commits through a shared finalize helper. However, the forced same-chunk refresh path still:

1. prepares terrain
2. applies terrain
3. updates managers afterwards

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.ts`

Effect:

- the player can see a second terrain swap after the initial chunk transition
- same-chunk refreshes can still expose terrain-first behavior
- hydrated refreshes, duplicate tile refreshes, and self-heal refreshes all reintroduce visible presentation skew

### 3.4 Duplicate tile reconciliation causes refresh churn and drops biome deltas (CRITICAL)

`updateExploredHex()` currently treats an already-known visible tile as a duplicate, invalidates overlapping caches, optionally requests refresh, and returns before writing the new biome to `exploredTiles`. This is not just a presentation issue — it is silent data loss. The biome write happens after the duplicate early-return branch, so any incoming biome delta on a known tile is discarded from authoritative state while a refresh is simultaneously scheduled against the stale data.

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`

Effect:

- repeated fetches for already-known visible terrain can trigger full refresh churn
- authoritative biome changes can be requested for reconcile without the terrain state actually being updated first
- duplicate tile handling currently optimizes for "something might be stale" rather than "first converge data, then decide how expensive reconcile must be"

### 3.5 Chunk bounds are currently too coarse for the jobs they are doing

Current chunk bounds are created from the centers of the four corner hexes with a fixed Y range, then reused for:

- biome mesh frustum culling
- cache replay visibility gating
- offscreen chunk recovery
- centralized chunk visibility registration

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/instanced-biome.tsx`
- `client/apps/game/src/three/utils/centralized-visibility-manager.ts`

Effect:

- edge-visible terrain can be classified as offscreen too early
- current chunk cache replay can be skipped for visibility reasons that do not match the player-visible image
- self-heal can be triggered by bounds inaccuracies rather than real terrain loss

### 3.6 Current switch delay is a tiny post-switch cooldown, not a real traversal hysteresis policy

The current chunk switch delay compares the camera against the last switch position with a `0.05` padding factor.

Relevant file:

- `client/apps/game/src/three/scenes/worldmap-chunk-switch-delay-policy.ts`

Effect:

- the policy does not define a stable hold band inside the current render window
- it does not reason in hex-space or render-bounds-space
- it does not materially reduce the visual shock of a half-window recenter

## 4. Goals

### 4.1 Product goals

- water and ocean surfaces should stay visually stable during ordinary pan traversal
- chunk switches should feel like one coherent move, not a world recenter plus a later correction
- authoritative terrain changes should converge cleanly without visible thrash
- traversal across odd-row boundaries should feel as stable as traversal across even-row boundaries

### 4.2 Technical goals

- derive chunk ownership and switch decisions from the same hex-space model used by rendering and interaction
- ensure every terrain-visible commit, including same-chunk refreshes, uses one atomic presentation contract
- make duplicate tile reconciliation data-first and reason-aware
- replace coarse terrain visibility bounds with conservative presentation bounds
- add diagnostics for refresh reason, terrain commit count, stale refresh drops, and bounds-triggered recovery

## 5. Non-goals

- redesigning worldmap art direction, ocean assets, or biome meshes
- replacing Torii, ECS subscriptions, or the chunk neighborhood pin policy in the first phase
- rewriting the entire chunk system around fully continuous camera-centered streaming in the first rollout
- changing unrelated army, chest, or UI systems outside their terrain-presentation interactions
- shipping an animated dissolve or blend effect before correctness is established

## 6. Product Requirements

### 6.1 Terrain stability contract

For ordinary camera traversal:

- terrain that remains inside the active presentation window must not disappear and reappear because of refresh churn
- water and ocean surfaces should remain continuous unless authoritative tile state truly changed
- no settled traversal path should produce more than one visible terrain commit for the same chunk authority without an explicit refresh reason

### 6.2 Presentation contract

For any terrain-visible update:

- terrain and visible manager state must commit through one gate
- same-chunk refreshes must obey the same contract as cross-chunk switches
- no frame may show:
  - new terrain with old visible structures
  - old terrain with new visible structures
  - terrain masking that does not match the visible structures

### 6.3 Chunk ownership contract

- chunk selection must use parity-aware hex-space conversion
- chunk switching must use a stable hysteresis policy that is defined against current rendered space, not only distance from the last switch point
- authority chunk, render window, and interactive window decisions must use shared geometry rules

### 6.4 Duplicate tile convergence contract

- duplicate tile updates with biome delta must update authoritative terrain state before reconcile work is scheduled
- duplicate tile updates without biome delta must not default to expensive full refresh if a cheaper reconcile path is sufficient
- cache invalidation must remain correct for overlapping render windows

### 6.5 Bounds and recovery contract

- terrain presentation bounds must conservatively cover the visible footprint of the rendered terrain window
- cache replay must not be skipped just because a too-tight analytical bounds box is offscreen
- offscreen recovery and terrain self-heal must not fire while the current presentation is still visibly valid

### 6.6 Diagnostics contract

The renderer must expose diagnostics for:

- terrain commits per chunk authority
- refresh reason counts by source
- duplicate tile reconcile counts
- bounds-based cache replay skips
- offscreen recovery triggers
- self-heal triggers
- stale prepared refresh drops

## 7. Success Metrics

### 7.1 Behavior metrics

- zero observed water flicker during steady pan traversal across chunk boundaries in normal conditions
- zero observed second terrain swap after a stable chunk switch unless an explicit authoritative refresh reason is logged
- zero observed cases where duplicate biome delta is dropped from authoritative terrain state

### 7.2 Instrumentation metrics

- `terrainVisibleCommitCount`
- `terrainVisibleCommitCountPerChunk`
- `refreshReasonCount.{default, hydrated_chunk, duplicate_tile, offscreen_chunk, terrain_self_heal}`
- `duplicateTileReconcileCount.{invalidate_only, local_reconcile, full_refresh}`
- `cacheReplaySkippedForBoundsVisibility`
- `terrainBoundsRecoveryCount`
- `staleTerrainRefreshDropped`

### 7.3 Diagnostics surfacing

All instrumentation metrics must be accessible through at least one of:

- an in-game debug overlay toggled via a dev-mode key or URL parameter
- structured console logging that can be filtered by prefix (e.g. `[terrain-diag]`)
- a per-session JSON dump retrievable from the diagnostics manager for automated regression comparison

The choice of surfacing mechanism should be decided during Stage 0 implementation, but the diagnostics contract must not be considered complete until at least one read path exists.

### 7.4 Regression metrics

- no increase in failed chunk rollback behavior
- no increase in stale visibility leaks after interrupted switches
- no sustained refresh loop caused by duplicate tile churn or self-heal

## 8. Proposed Technical Design

### 8.1 Normalize chunk selection in hex space

Introduce a shared pure helper that:

1. derives the focus hex from world position using the existing parity-aware conversion rules
2. derives authority chunk key from that focus hex
3. becomes the only owner for worldmap chunk selection

Suggested file:

- new: `client/apps/game/src/three/scenes/worldmap-chunk-selection-policy.ts`

Responsibilities:

- convert world focus point to hex coordinates
- convert hex coordinates to authority chunk key
- eliminate raw world-floor chunk ownership logic from runtime paths

This should replace direct world-space floor math in:

- `resolveWarpTravelChunkCoordinates()`
- `worldToChunkCoordinates()`

### 8.2 Replace last-switch cooldown with render-aware hysteresis

Add a pure switch policy that evaluates whether the focus hex is still inside a stable hold band within the current rendered window.

Suggested policy outputs:

```ts
interface WorldmapChunkHysteresisDecision {
  shouldStayInCurrentChunk: boolean;
  shouldSwitchToTargetChunk: boolean;
  targetChunkKey: string | null;
}
```

Recommended behavior:

- define a hold band inside the current render bounds
- stay in the current chunk while focus hex remains inside that hold band
- switch only once focus exits the hold band and the target chunk is unambiguous
- consider making the hold band asymmetric: tighter in the direction of camera travel, wider against it — this reduces perceived lag when panning deliberately in one direction while still preventing flapping on reversal

This is different from the current behavior:

- it is derived from render geometry rather than just camera travel since last switch
- it is explainable in terms of what the player sees on screen

### 8.3 Make same-chunk refresh use the same atomic presentation gate

`refreshCurrentChunk()` should stop owning a separate terrain-first commit flow.

Instead:

- extract a shared terrain presentation commit path
- use that path for:
  - cross-chunk switch
  - hydrated same-chunk refresh
  - duplicate tile forced refresh
  - terrain self-heal refresh
  - offscreen recovery refresh

Minimum contract:

1. prepare terrain offscreen
2. wait for required manager readiness
3. verify the transition or refresh token is still current
4. commit terrain and managers together

This should build on the existing presentation-oriented seams rather than bypass them.

### 8.4 Reconcile duplicate tiles data-first

Change duplicate tile handling into an explicit three-stage policy:

1. update authoritative terrain state if the incoming update changes biome data
2. invalidate exactly the overlapping caches that are affected
3. choose the cheapest safe reconcile path

Suggested reconcile modes:

```ts
type DuplicateTileReconcileMode =
  | "none"
  | "invalidate_only"
  | "local_terrain_patch"
  | "atomic_chunk_refresh";
```

Recommended defaults:

- same-biome duplicate offscreen: `invalidate_only`
- same-biome duplicate visible: prefer `local_terrain_patch` or debounced no-op if presentation already matches
- biome-delta duplicate visible: `atomic_chunk_refresh`
- biome-delta duplicate offscreen: update data now, defer visible reconcile until needed

This keeps correctness while removing refresh storms for benign duplicates.

### 8.5 Replace coarse chunk bounds with conservative terrain presentation bounds

Current chunk bounds should be replaced or extended with a more conservative presentation bounds policy.

Recommended direction:

- start from render bounds in hex space
- expand by the analytical footprint of a hex tile
- include model-height padding suitable for terrain details
- optionally compute tighter actual bounds from prepared terrain matrices in later phases

Suggested file:

- new: `client/apps/game/src/three/scenes/worldmap-terrain-bounds-policy.ts`

Responsibilities:

- build padded analytical terrain bounds
- provide chunk and prepared-terrain bounds consistently
- keep bounds ownership out of ad hoc scene code

These bounds should be used for:

- `currentChunkBounds`
- cached terrain metadata
- biome mesh world bounds
- centralized visibility registration
- offscreen recovery eligibility

### 8.6 Narrow the jobs that bounds visibility is allowed to do

Bounds visibility should not directly decide every terrain path.

Recommended policy:

- current visible chunk replay should not be skipped solely because the analytical bounds box is offscreen
- self-heal should require sustained evidence of visible terrain collapse, not just bounds invisibility
- offscreen recovery should be suppressed during known transition phases and for recently committed chunks unless additional evidence confirms a real presentation failure

This reduces false-positive recovery loops caused by geometry approximation.

### 8.7 Add reason-aware terrain refresh diagnostics

Extend diagnostics so every forced terrain refresh records:

- reason
- current chunk
- current area key
- current terrain instance count
- reference terrain instance count
- current chunk bounds visible yes or no
- whether the refresh committed terrain
- whether it was dropped as stale

This allows the team to answer:

- was the visible change due to chunk authority change or same-chunk reconcile?
- was the trigger duplicate data, hydration completion, offscreen recovery, or self-heal?
- did bounds visibility disagreement contribute?

### 8.8 Optional phase-two: decouple presentation anchor from authority chunk

If phase-one hardening removes thrash but the traversal still feels like a half-window snap, introduce a separate presentation anchor.

Recommended principles:

- keep `authorityChunkKey` for fetch, pinning, and manager ownership
- add `presentationWindowKey` or `presentationAnchor`
- allow the presentation window to move on a smaller sub-stride or camera-centered hold band
- prepare and commit presentation windows independently of authority changes

This is intentionally phase two because it changes more assumptions about caching, visible manager windows, and test fixtures.

## 9. File-Level Change Plan

### 9.1 Core runtime

- `client/apps/game/src/three/scenes/worldmap.tsx`
  - remove raw world-floor chunk ownership logic
  - route same-chunk refresh through atomic presentation commit
  - rewrite duplicate tile reconciliation flow
  - replace coarse bounds usage with policy-owned terrain bounds
  - emit reason-aware refresh diagnostics
- `client/apps/game/src/three/scenes/warp-travel-chunk-runtime.ts`
  - stop deriving chunk coordinates from raw world floor math
  - use shared chunk-selection policy
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
  - replace duplicate tile reconcile policy with data-first explicit modes
  - add chunk hysteresis decision helpers

### 9.2 New pure-policy modules

- new: `client/apps/game/src/three/scenes/worldmap-chunk-selection-policy.ts`
  - hex-space chunk ownership and target chunk derivation
- new: `client/apps/game/src/three/scenes/worldmap-chunk-hysteresis-policy.ts`
  - hold-band and switch-band logic
- new: `client/apps/game/src/three/scenes/worldmap-terrain-bounds-policy.ts`
  - padded presentation bounds
- optional later: `client/apps/game/src/three/scenes/worldmap-presentation-anchor-policy.ts`
  - phase-two presentation anchor decoupling

### 9.3 Terrain presentation seams

- `client/apps/game/src/three/scenes/warp-travel-chunk-switch-commit.ts`
  - expose or reuse atomic commit helper for same-chunk refresh
- `client/apps/game/src/three/scenes/worldmap-chunk-presentation.ts`
  - extend to support same-chunk refresh readiness and commit
- `client/apps/game/src/three/scenes/warp-travel-chunk-hydration.ts`
  - keep preparation reusable for both chunk switches and same-chunk refreshes

### 9.4 Rendering and visibility support

- `client/apps/game/src/three/managers/instanced-biome.tsx`
  - accept terrain presentation bounds cleanly
  - avoid relying on too-tight shared geometry bounds
- `client/apps/game/src/three/utils/centralized-visibility-manager.ts`
  - add diagnostics or helper support if needed for terrain-bounds-specific visibility decisions

### 9.5 Diagnostics

- `client/apps/game/src/three/perf/worldmap-render-diagnostics.ts`
  - add terrain commit and refresh-reason metrics
- `client/apps/game/src/three/scenes/worldmap-chunk-diagnostics.ts`
  - add duplicate reconcile and bounds-recovery counters

## 10. TDD Plan

This work should be delivered test-first. The current behavior has multiple overlapping causes, so the tests must pin each failure mode separately instead of only asserting end-to-end chunk switching.

### 10.1 Red: chunk selection and hysteresis tests

Add new pure-policy tests first:

- new: `client/apps/game/src/three/scenes/worldmap-chunk-selection-policy.test.ts`
  - "derives authority chunk from parity-aware focus hex, not raw world floor coordinates"
  - "returns the same chunk key for equivalent odd-row and even-row focus positions"
  - "handles negative or offset world positions without desynchronizing hex and chunk ownership"
- new: `client/apps/game/src/three/scenes/worldmap-chunk-hysteresis-policy.test.ts`
  - "keeps the current chunk while focus remains inside the hold band"
  - "switches once focus exits the hold band into the next chunk"
  - "does not flap when focus oscillates near the switch boundary"

### 10.2 Red: same-chunk atomic presentation tests

Extend or add presentation tests before implementation:

- `client/apps/game/src/three/scenes/worldmap-chunk-presentation.test.ts`
  - "does not expose same-chunk prepared terrain before manager readiness completes"
  - "commits same-chunk refresh terrain and managers through one gate"
  - "drops stale same-chunk refresh work without mutating visible terrain"
- new: `client/apps/game/src/three/scenes/worldmap-same-chunk-refresh.test.ts`
  - "hydrated current-area refresh does not repaint terrain ahead of manager convergence"
  - "terrain self-heal refresh uses atomic presentation commit"
  - "offscreen recovery refresh uses atomic presentation commit"

### 10.3 Red: duplicate tile reconciliation tests

Extend existing worldmap transition tests:

- `client/apps/game/src/three/scenes/worldmap-chunk-transition.test.ts`
  - "duplicate visible tile with same biome does not force full atomic chunk refresh by default"
  - "duplicate tile with biome delta updates authoritative explored state before reconcile scheduling"
  - "offscreen duplicate biome delta updates state without immediate visible repaint"
  - "duplicate visible biome delta chooses atomic chunk refresh when current chunk is stable"

Add worldmap scene behavior tests:

- new: `client/apps/game/src/three/scenes/worldmap-duplicate-tile-reconcile.integration.test.ts`
  - "repeated duplicate updates do not create refresh storms"
  - "duplicate biome delta converges terrain state after one atomic refresh"

### 10.4 Red: terrain bounds and culling tests

Add new bounds-policy tests:

- new: `client/apps/game/src/three/scenes/worldmap-terrain-bounds-policy.test.ts`
  - "padded bounds include edge hex extents"
  - "padded bounds include required terrain height margin"
  - "prepared terrain bounds remain conservative for ocean-heavy windows"

Extend scene tests:

- `client/apps/game/src/three/scenes/worldmap-cache-safety.test.ts`
  - add coverage that current chunk replay is not rejected solely due to overly tight bounds visibility
- `client/apps/game/src/three/scenes/worldmap-zoom-hardening.test.ts`
  - "does not trigger offscreen recovery while current padded terrain bounds remain visible"
  - "does not trigger terrain self-heal when terrain counts are stable but coarse bounds disagree"

### 10.5 Red: diagnostics tests

Extend diagnostics suites:

- `client/apps/game/src/three/perf/worldmap-render-diagnostics.test.ts`
  - add expectations for terrain commit count and refresh-reason metrics
- `client/apps/game/src/three/scenes/worldmap-chunk-diagnostics.test.ts`
  - add counters for duplicate reconcile mode, bounds recovery, and stale refresh drops

### 10.6 Green: implementation order

Implement in this order:

1. add pure chunk-selection and hysteresis policy modules
2. switch runtime chunk ownership to the new hex-space policy
3. refactor same-chunk refresh to use atomic presentation commit
4. rewrite duplicate tile reconciliation to be data-first
5. introduce conservative terrain bounds policy
6. tighten self-heal and offscreen recovery gates
7. extend diagnostics and remove obsolete assumptions from tests

### 10.7 Refactor: cleanup after green

After the new behavior is passing:

- collapse any duplicated transition and refresh token bookkeeping
- remove now-obsolete last-switch cooldown helpers if hysteresis fully replaces them
- consolidate bounds ownership into one policy seam
- simplify any duplicate diagnostics event names

## 11. Staged Delivery Plan

### Stage 0: Diagnostics, contract reset, and critical data-loss fix

Status: Pending

Objective:

- stop the tests from protecting terrain-first same-chunk refresh behavior
- add counters that distinguish authority switch from same-chunk repaint
- fix the duplicate biome delta data loss immediately — this is a correctness bug, not a presentation issue, and should not wait for Stage 3's full reconciliation redesign

Minimum data-loss fix:

- move the `exploredTiles` biome write above the duplicate early-return branch so that incoming biome deltas are always persisted to authoritative state regardless of reconcile path

Exit criteria:

- failing tests exist for the current bugs
- diagnostics can report terrain commit count and refresh reason
- duplicate biome deltas are no longer silently dropped (verified by test)

### Stage 1: Chunk selection alignment

Status: Pending

Objective:

- make chunk ownership and switch timing consistent with hex-space rendering

Exit criteria:

- raw world-floor chunk ownership logic is removed from runtime paths
- odd-row parity cases pass in pure tests
- hysteresis is defined against rendered space

### Stage 2: Same-chunk atomic presentation

Status: Pending

Objective:

- remove terrain-first presentation from forced same-chunk refreshes

Exit criteria:

- same-chunk refresh commits terrain and manager state through one gate
- hydrated refresh, duplicate-tile refresh, and self-heal refresh all obey the same contract

### Stage 3: Duplicate tile convergence

Status: Pending

Prerequisite: The critical biome delta data-loss fix is already applied in Stage 0. This stage focuses on the remaining reconciliation policy and churn reduction.

Objective:

- make duplicate tile handling reason-aware and reduce refresh churn
- implement explicit reconcile mode selection (none / invalidate_only / local_terrain_patch / atomic_chunk_refresh)

Exit criteria:

- benign duplicates do not force unnecessary full refresh
- no duplicate-tile refresh storm appears in tests
- reconcile mode counters are reported through diagnostics

### Stage 4: Terrain bounds and recovery hardening

Status: Pending

Objective:

- stop false-positive culling and recovery behavior from analytical bounds mismatch

Exit criteria:

- padded terrain bounds replace coarse chunk-center bounds for presentation use
- cache replay and self-heal no longer depend on too-tight bounds

### Stage 5: Optional presentation anchor decoupling

Status: Optional

Objective:

- remove the remaining half-window snap if phase-one hardening still leaves traversal visually abrupt

Exit criteria:

- presentation anchor is separate from authority chunk
- terrain window shift magnitude is materially reduced without breaking manager ownership or fetch caching

## 12. Acceptance Criteria

The terrain stability work is complete when all of the following are true:

- water and ocean tiles do not visibly disappear and reappear during ordinary chunk traversal
- the scene does not perform an unexplained second visible terrain swap after a stable chunk switch
- same-chunk refreshes obey the same atomic presentation rules as cross-chunk switches
- duplicate biome deltas update authoritative terrain state before reconcile work is chosen
- chunk switch timing is derived from parity-aware hex-space policy
- terrain bounds are conservative enough that offscreen recovery is only triggered for real presentation failures
- all new and modified tests pass

## 13. Manual QA Matrix

Required manual checks after automated green:

1. Straight-line traversal across ocean-heavy boundaries.
2. Straight-line traversal across mixed land and water boundaries.
3. Diagonal traversal across odd-row boundaries.
4. Slow pan back and forth near a chunk boundary.
5. Fast pan across multiple boundaries.
6. Re-entry into a recently visited chunk with warm cache.
7. Traversal while duplicate tile updates are arriving.
8. Traversal while hydrated refresh and self-heal diagnostics are enabled.

Observe and record:

- current chunk key
- refresh reason
- terrain commit count
- whether offscreen recovery fired
- whether duplicate tile reconcile fired

## 14. Risks and Open Questions

### 14.1 How much instability remains after phase-one hardening?

Risk:

- even after same-chunk refresh and bounds fixes, the stride `24` and render `48x48` coupling may still feel too abrupt

Recommended direction:

- treat presentation-anchor decoupling as a deliberate phase-two decision, not a hidden side effect of phase one

### 14.2 How conservative should padded terrain bounds be?

Risk:

- too small and false-positive culling remains
- too large and frustum culling becomes less effective

Recommended direction:

- start with analytical tile-footprint padding plus explicit terrain-height margin
- only move to matrix-derived bounds if analytical padding is insufficient

### 14.3 What is the cheapest safe reconcile path for duplicate visible tiles?

Open question:

- is a local terrain patch sufficient for same-biome visible duplicates, or should those remain invalidate-only until proven stale?

Recommended direction:

- implement the safer low-churn path first, instrument heavily, and only add local patching if needed

### 14.4 How much existing fixture coverage assumes raw world-floor chunk ownership?

Risk:

- changing chunk selection to hex-space may shift expected chunk keys in tests and fixtures

Mitigation:

- rewrite pure policy expectations first
- use fixture-driven tests to make the new behavior explicit rather than incidental
- **pre-work:** before starting Stage 1, run a grep for hardcoded chunk keys (e.g. `"0,0"`, `"24,0"`, `startRow`, `startCol` literals) across all test fixtures in `src/three/scenes/*.test.ts` to scope the migration cost

## 15. Recommendation

Do not try to solve this by only tuning `chunkSwitchPadding`, debounce, or ocean material render order.

Those knobs may hide the problem temporarily, but they do not address the real causes:

- half-window terrain recentering
- chunk selection mismatch with hex geometry
- terrain-first same-chunk refreshes
- duplicate-tile refresh churn
- overly coarse terrain bounds

The right first implementation sequence is:

1. align chunk selection with hex space
2. make same-chunk refresh atomic
3. fix duplicate tile convergence
4. harden bounds and recovery
5. only then decide whether presentation-anchor decoupling is still necessary
