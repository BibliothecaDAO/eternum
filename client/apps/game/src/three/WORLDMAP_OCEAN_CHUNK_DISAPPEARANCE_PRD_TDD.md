# Worldmap Ocean Chunk Disappearance PRD + TDD

Status: Draft
Date: 2026-03-17
Scope: `client/apps/game/src/three`
Primary surfaces: worldmap chunk traversal, ocean and deep-ocean terrain continuity, duplicate tile reconciliation, terrain bounds and culling, cache replay, refresh diagnostics

## 1. Summary

Ocean and deep-ocean biomes can disappear during chunk switching even when other nearby terrain appears stable enough.

This is not because ocean uses a separate chunk-switch pipeline. The current runtime uses the same chunk selection and chunk presentation path for all biomes. What makes ocean look different is that the current shared terrain pipeline fails in ways that are much easier to see on large, flat, contiguous water surfaces.

The highest-probability runtime causes in the current codebase are:

1. duplicate visible tile updates in overlap zones can invalidate caches and early-return without restoring the visible terrain immediately
2. chunk bounds are too coarse and are reused for frustum culling, cache replay gating, and offscreen recovery
3. chunk stride and refresh sequencing make large contiguous ocean loss more visually obvious than mixed land terrain

This document defines a focused product and engineering plan to eliminate ocean-only disappearance during chunk traversal, while keeping the fix aligned with the broader worldmap terrain stability work already in the repo.

The target outcome is:

- ocean and deep-ocean tiles remain visible during ordinary chunk switching unless authoritative tile state truly changed
- duplicate visible ocean tiles converge in one safe path instead of disappearing until a later refresh
- terrain cache replay is not skipped because a too-tight bounds box was classified as offscreen
- ocean-heavy chunk transitions do not trigger a second visible terrain swap without an explicit reason
- the renderer exposes diagnostics that make ocean disappearance measurable instead of anecdotal

## 2. Problem Statement

### 2.1 User problem

When the player moves across worldmap chunk boundaries:

- ocean and deep-ocean surfaces can disappear while land around them appears relatively stable
- revisiting or overlapping chunk windows can produce visible water holes or ocean pop-out
- the same chunk switch can appear to "settle" and then repaint again

That creates the impression that ocean biomes are handled differently from the rest of the terrain, even though the root cause is more likely shared terrain presentation logic.

### 2.2 Why ocean looks different even when the pipeline is shared

The current code makes ocean failures easier to perceive for three reasons.

1. Ocean and deep-ocean are large, flat, contiguous surfaces, so any missing tile or culled batch reads as a large visual gap rather than natural variation.
2. Ocean and deep-ocean have render-specific behavior such as static animation policy, no shadows, and a lower render order, so they do not hide presentation errors behind animated detail.
3. The current chunk stride is half the render window, so every chunk authority switch recenters terrain by a large amount. Continuous water makes that shift especially obvious.

### 2.3 Relationship to the existing terrain stability PRD

`WORLDMAP_TERRAIN_STABILITY_PRD_TDD.md` already covers broad terrain instability. This document intentionally narrows the work to the ocean-disappearance symptom so the fix can be delivered as an independently testable slice.

The scope here is:

- visible ocean and deep-ocean loss during chunk traversal
- the duplicate tile, bounds, cache replay, and refresh behaviors most correlated with that symptom

The scope here is not:

- complete redesign of worldmap chunking
- fully camera-centered streaming
- art or asset changes to ocean meshes

## 3. Review Findings

### 3.1 Ocean is not on a separate chunk-switch path

The active chunk-switch path is generic:

- `updateVisibleChunks()` resolves a chunk decision from the camera focus point
- `performChunkSwitch()` prepares and commits the next terrain snapshot
- `refreshCurrentChunk()` reuses the same terrain preparation path for same-chunk refreshes

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/warp-travel-chunk-runtime.ts`

Effect:

- the root cause is unlikely to be "ocean has its own chunk runtime"
- fixes should target shared terrain presentation behavior rather than an ocean-only branch

### 3.2 Ocean and deep-ocean do have render-specific handling

Ocean and deep-ocean are treated specially in `InstancedBiome`:

- they never cast shadows
- they are treated as static biomes for animation throttling
- ocean meshes render at a lower render order
- deep-ocean forces `transparent = false`

Relevant file:

- `client/apps/game/src/three/managers/instanced-biome.tsx`

Effect:

- ocean and deep-ocean are visually distinct from other terrain
- these differences may amplify visibility problems
- these differences do not, by themselves, explain why ocean disappears only during chunk switching

Conclusion:

- ocean-specific render flags are sensitivity multipliers, not the primary chunking bug

### 3.3 Duplicate visible tiles in overlap zones can still resolve too late

`updateExploredHex()` checks whether an incoming tile is already known. When it is treated as a duplicate, the current behavior can:

1. invalidate overlapping caches
2. optionally request a refresh
3. return without directly restoring the visible terrain instance

The policy source already contains a comment describing this exact failure mode:

- visible same-biome duplicates need deferred refresh because the early-return skips the individual mesh add
- without that refresh, water and ocean tiles in chunk overlap zones stay invisible

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`

Effect:

- an ocean tile can be present in authoritative explored state but absent from the visible terrain for some interval
- large ocean overlap zones make this easy to notice
- repeated duplicate visible updates can produce refresh churn instead of deterministic convergence

### 3.4 The current coarse bounds are doing too many jobs

`computeChunkBounds()` currently creates a bounds box from the centers of the four corner hexes plus a fixed Y range. That same bounds object is then reused for:

- biome instanced mesh frustum culling
- cache replay visibility gating
- current chunk visibility checks
- offscreen recovery decisions
- centralized chunk visibility registration

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/instanced-biome.tsx`

Effect:

- edge-visible terrain can be classified as offscreen too early
- an entire instanced biome batch can disappear at once if the shared bounds are wrong
- ocean-heavy windows are especially sensitive because one missing batch reads as a large blank region

### 3.5 Cache replay can be skipped for visibility reasons that do not match the player-visible image

`applyCachedMatricesForChunk()` rejects a cached terrain replay if the cached bounds box is not visible according to the visibility manager.

That means the runtime can have valid terrain matrices available and still refuse to replay them because a coarse analytical box says "offscreen."

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-cache-safety.test.ts`

Effect:

- ocean-heavy current chunks can remain empty longer than necessary
- revisit behavior can look worse than it should, especially on water
- a later refresh may appear to "fix" ocean after an avoidable blank frame or partial frame

### 3.6 The chunk stride makes ocean loss highly visible

The world chunk config uses:

- stride `24`
- render window `48x48`

So each authority switch recenters the visible terrain window by half the screen.

Relevant files:

- `client/apps/game/src/three/constants/world-chunk-config.ts`
- `client/apps/game/src/three/utils/chunk-geometry.ts`

Effect:

- only half of the old and new windows overlap after a switch
- any missing or culled ocean tiles are exposed as a large visible patch
- this is perceptually worse on ocean than on mixed land because land has more silhouette variety

### 3.7 Offscreen recovery can turn one ocean problem into two visible swaps

The runtime already contains offscreen and self-heal recovery paths. If bounds are too tight or cache replay is skipped incorrectly, those recovery paths can trigger a second terrain repaint after the main chunk transition has already committed.

Relevant files:

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/worldmap-zoom-hardening.ts`

Effect:

- the player can see ocean disappear during the main switch and then reappear during a later "recovery" refresh
- that makes the system feel nondeterministic even if the final steady state is eventually correct

## 4. Goals

### 4.1 Product goals

- ocean and deep-ocean should remain visually continuous during ordinary chunk traversal
- ocean-heavy chunk switches should feel like one coherent presentation move
- revisits to cached or overlapping terrain should not temporarily blank ocean surfaces
- the user should no longer infer that ocean biomes are on a broken special-case path

### 4.2 Technical goals

- ensure duplicate visible terrain updates converge without leaving missing ocean tiles on screen
- replace coarse runtime bounds with conservative terrain presentation bounds
- stop current chunk terrain replay from being rejected only because an analytical bounds box is too tight
- route any required same-chunk repair through the same presentation gate used by chunk switching
- add diagnostics that can prove whether ocean disappearance came from duplicate reconcile, bounds visibility, replay skip, or offscreen recovery

## 5. Non-goals

- redesigning ocean or deep-ocean assets
- changing ocean materials, colors, or art direction as the primary fix
- replacing the entire chunk system with camera-centered streaming
- rewriting unrelated army, structure, chest, or UI logic outside the terrain-presentation surface
- shipping an ocean-only hack that bypasses the shared terrain correctness problem

## 6. Product Requirements

### 6.1 Ocean continuity contract

For any chunk transition where the authoritative biome data for a visible ocean tile did not change:

- that ocean tile must not disappear because it was treated as a duplicate
- that ocean tile must not depend on a later unrelated refresh to become visible again
- a current chunk commit must not leave ocean-only gaps in the visible window

### 6.2 Duplicate tile convergence contract

For duplicate terrain updates:

- duplicate biome deltas must update authoritative state before any early return
- visible same-biome duplicates must not be allowed to remain invisible in the current chunk
- the reconcile strategy must choose a deterministic correctness path before any optimization path

Recommended priority:

1. correctness now
2. refresh churn reduction next
3. local patch optimization last

### 6.3 Bounds and culling contract

- terrain presentation bounds must conservatively cover the visible footprint of the rendered terrain window
- biome instanced meshes must not be culled using a box that is smaller than the player-visible terrain footprint
- ocean-heavy windows must be handled by the same padded analytical policy as any other terrain window

### 6.4 Cache replay contract

- replay of the current chunk or a just-prepared visible chunk must not be skipped solely because coarse bounds say "offscreen"
- current chunk replay should prefer correctness over a visibility gate that is known to be approximate
- replay decisions must be explainable through diagnostics

### 6.5 Refresh contract

- if a same-chunk repair is needed to restore missing ocean, it must commit through the chunk presentation gate
- offscreen recovery must not trigger while padded current terrain bounds are still visibly valid
- no settled chunk transition should produce more than one visible ocean repaint without an explicit recorded reason

### 6.6 Diagnostics contract

The renderer must expose diagnostics for:

- duplicate visible tile reconcile counts
- bounds-based cache replay skips
- current chunk ocean and deep-ocean visible instance counts
- offscreen recovery refresh count
- terrain-visible commit count per chunk
- stale same-chunk repair drops

## 7. Success Metrics

### 7.1 Behavior metrics

- zero observed cases where ocean or deep-ocean disappears during steady pan traversal across chunk boundaries under normal conditions
- zero observed cases where a visible ocean overlap tile remains missing after the owning chunk presentation commits
- zero observed second ocean repaint after a stable chunk switch unless a logged refresh reason explains it

### 7.2 Instrumentation metrics

- `terrainVisibleCommitCount`
- `terrainVisibleCommitCountPerChunk`
- `duplicateTileReconcileCount.{invalidate_only, atomic_chunk_refresh, local_terrain_patch}`
- `cacheReplaySkippedForBoundsVisibility`
- `oceanVisibleInstanceCount`
- `deepOceanVisibleInstanceCount`
- `refreshReasonCount.{duplicate_tile, hydrated_chunk, offscreen_chunk, terrain_self_heal}`
- `staleTerrainRefreshDropped`

### 7.3 Regression metrics

- no increase in failed chunk rollback behavior
- no increase in stale prepared terrain leaks
- no sustained refresh loop caused by duplicate visible ocean tiles

## 8. Proposed Technical Design

### 8.1 Fix shared terrain correctness first, not ocean visuals

The initial fix should not be an ocean-only render workaround.

Recommended principle:

- if ocean disappears because shared terrain state, bounds, or replay logic is wrong, fix that shared logic first
- only consider ocean-specific render adjustments after the shared pipeline is correct

This avoids building a special-case patch that leaves the underlying terrain instability unresolved for other biomes.

### 8.2 Introduce an explicit "visible duplicate tile repair" path

The current duplicate tile policy already distinguishes:

- no-op
- invalidate only
- invalidate plus refresh

That is not enough for this bug because a visible duplicate can still represent a correctness gap in the current scene.

Recommended reconcile modes:

```ts
type DuplicateTileReconcileMode =
  | "none"
  | "invalidate_only"
  | "local_terrain_patch"
  | "atomic_chunk_refresh";
```

Recommended phase-one behavior:

- same-biome duplicate offscreen: `invalidate_only`
- same-biome duplicate visible: `atomic_chunk_refresh` if the runtime cannot prove the tile is already visible
- biome-delta duplicate visible: `atomic_chunk_refresh`
- biome-delta duplicate offscreen: update authoritative state now, defer visible reconcile until needed

Recommended phase-two optimization:

- once the runtime can prove current visible terrain membership cheaply, downgrade safe visible duplicates to `local_terrain_patch` or no-op

The key principle is:

- a visible duplicate that may correspond to a missing ocean tile is a correctness problem first, not just a cache invalidation problem

### 8.3 Add visible terrain membership or an equivalent correctness proof

Today the runtime can count instances per biome, but it does not maintain a cheap authoritative answer to:

- "Is hex `col,row` already present in the currently visible terrain snapshot?"

Recommended options:

1. add a current visible terrain membership index keyed by `hexKey`
2. add prepared-terrain metadata that can answer tile presence by hex
3. if neither is ready in phase one, always route uncertain visible duplicates through atomic same-chunk refresh

Recommended phase-one choice:

- do not block the bug fix on a full local patch index
- use atomic same-chunk repair for any visible duplicate whose presence cannot be proven

Recommended phase-two choice:

- add a membership index to unlock `local_terrain_patch` and reduce refresh churn

### 8.4 Replace `computeChunkBounds()` with policy-owned terrain presentation bounds

The repo already contains `worldmap-terrain-bounds-policy.ts`, but runtime chunk bounds are still computed from corner hex centers.

Recommended change:

1. resolve padded terrain presentation bounds in hex space
2. convert those padded bounds into a `Box3` and `Sphere`
3. use those bounds as the authoritative terrain bounds for:
   - `currentChunkBounds`
   - prepared terrain metadata
   - cached terrain metadata
   - biome mesh world bounds
   - visibility registration

This keeps terrain bounds tied to the visible footprint of the terrain window rather than a coarse four-corner approximation.

### 8.5 Narrow the jobs that bounds visibility is allowed to do

The current bounds box should not be allowed to veto every terrain path.

Recommended policy:

- current chunk replay should not be skipped solely because `isBoxVisible(bounds.box)` returned `false`
- replay of freshly prepared visible terrain should not require a separate analytical visibility test
- offscreen recovery should require stronger evidence than coarse bounds invisibility alone

This reduces false negatives where valid ocean terrain exists but the runtime chooses not to show it.

### 8.6 Keep ocean repair on the atomic presentation path

If a same-chunk terrain repair is required to restore visible ocean:

- prepare offscreen terrain
- wait for the required presentation readiness
- verify the refresh token is still current
- commit through the same chunk presentation gate used by ordinary chunk switches

This avoids a terrain-first patch that could reintroduce a second visible swap.

### 8.7 Add reason-aware ocean diagnostics

The fix should ship with enough diagnostics to answer:

- was ocean missing because the tile was treated as a duplicate?
- was terrain replay skipped because bounds visibility rejected it?
- did offscreen recovery fire while the current padded terrain window was still valid?
- how many ocean and deep-ocean instances were visible before and after the commit?

Suggested diagnostics additions:

- visible ocean instance count by frame or commit
- duplicate visible tile repair count
- bounds replay skip count
- stale repair drop count
- refresh reason with chunk key and area key

## 9. File-Level Change Plan

### 9.1 Core runtime

- `client/apps/game/src/three/scenes/worldmap.tsx`
  - tighten duplicate visible tile handling
  - route uncertain visible duplicate repair through atomic same-chunk refresh
  - replace coarse bounds creation with padded terrain presentation bounds
  - relax or remove current chunk cache replay gating that depends on coarse bounds visibility
  - emit ocean-specific diagnostics

### 9.2 Duplicate tile policy

- `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts`
  - extend duplicate reconcile policy so visible duplicate correctness is explicit
  - distinguish between cheap invalidate-only paths and correctness-critical visible repair paths

### 9.3 Bounds policy

- `client/apps/game/src/three/scenes/worldmap-terrain-bounds-policy.ts`
  - extend if needed so runtime can convert padded analytical terrain bounds into `Box3` and `Sphere`
  - keep ownership of terrain bounds out of ad hoc scene code

### 9.4 Rendering support

- `client/apps/game/src/three/managers/instanced-biome.tsx`
  - continue to accept runtime-owned world bounds
  - verify that expanded terrain presentation bounds flow through cleanly

### 9.5 Tests

- `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`
  - extend duplicate visible tile wiring coverage
- `client/apps/game/src/three/scenes/worldmap-duplicate-tile-reconcile.integration.test.ts`
  - extend duplicate converge behavior for visible same-biome terrain
- `client/apps/game/src/three/scenes/worldmap-terrain-bounds-policy.test.ts`
  - keep ocean-heavy bounds coverage and extend for runtime conversion if needed
- `client/apps/game/src/three/scenes/worldmap-cache-safety.test.ts`
  - enforce replay safety against overly tight bounds rejection
- `client/apps/game/src/three/scenes/worldmap-hydrated-refresh-regression.test.ts`
  - verify repairs stay on the presentation gate
- optional new: `client/apps/game/src/three/scenes/worldmap-ocean-chunk-disappearance.test.ts`
  - focused regression fixture for ocean-heavy overlap scenarios

## 10. TDD Plan

This fix must follow strict red-green-refactor sequencing.

No runtime changes should be written before the failing tests pin the bug in a way that distinguishes:

- duplicate visible ocean gap
- bounds-driven replay rejection
- second visible ocean repaint caused by recovery or same-chunk refresh

### 10.1 Red: duplicate visible ocean overlap tests

Add or extend tests first:

- `client/apps/game/src/three/scenes/worldmap-duplicate-tile-reconcile.integration.test.ts`
  - "visible same-biome duplicate in current chunk chooses a correctness-preserving repair path"
  - "visible ocean duplicate does not stay on invalidate_only when tile presence cannot be proven"
  - "offscreen ocean duplicate remains on invalidate_only when no visible repair is needed"

- `client/apps/game/src/three/scenes/worldmap-update-explored-hex.integration.test.ts`
  - "visible duplicate repair requests atomic current chunk refresh instead of leaving terrain absent"
  - "duplicate visible ocean tile does not rely on unrelated later refresh to become visible"

These are the first tests because they pin the symptom most directly.

### 10.2 Red: bounds and replay tests

Add tests before runtime bounds edits:

- `client/apps/game/src/three/scenes/worldmap-terrain-bounds-policy.test.ts`
  - "runtime terrain presentation bounds convert to a conservative 3D box for ocean-heavy windows"
  - "padded analytical bounds include edge-visible ocean footprint"

- `client/apps/game/src/three/scenes/worldmap-cache-safety.test.ts`
  - "current chunk replay is not rejected solely due to analytical bounds invisibility"
  - "cached ocean-heavy terrain snapshot remains replayable when padded terrain bounds are still valid"

- optional new: `client/apps/game/src/three/managers/instanced-biome.visibility.test.ts`
  - "expanded world bounds keep visible edge terrain eligible for rendering"

### 10.3 Red: presentation and recovery regression tests

Add or extend regression tests:

- `client/apps/game/src/three/scenes/worldmap-hydrated-refresh-regression.test.ts`
  - "hydrated repair of an ocean-heavy current chunk routes through the chunk presentation gate"

- `client/apps/game/src/three/scenes/worldmap-same-chunk-refresh-commit.test.ts`
  - "visible duplicate repair commits only if the refresh token is still current"
  - "stale same-chunk ocean repair does not mutate visible terrain"

- optional new: `client/apps/game/src/three/scenes/worldmap-ocean-chunk-disappearance.test.ts`
  - "ocean-heavy overlap chunk switch does not produce a visible water-only gap after commit"
  - "ocean-heavy chunk revisit does not blank cached terrain before replay"

### 10.4 Verify red before implementation

Before production code changes:

- run the new and changed tests
- confirm they fail for the expected reasons
- confirm at least one test fails because the runtime still allows visible duplicate ocean gaps
- confirm at least one test fails because bounds-driven replay rejection is still too strict

### 10.5 Green: implementation order

Implement in this order:

1. extend duplicate reconcile tests for visible ocean overlap behavior
2. change duplicate reconcile policy so visible correctness wins over invalidate-only behavior
3. route visible duplicate repair through atomic same-chunk refresh
4. extend bounds tests and wire padded terrain presentation bounds into runtime chunk bounds
5. relax replay gating so current chunk replay is not rejected solely by approximate bounds visibility
6. add diagnostics for ocean instance counts, replay skips, and repair reasons
7. add focused regression fixture if the smaller tests do not fully pin the user-visible bug

### 10.6 Refactor after green

After the tests pass:

- collapse duplicate helper logic if the runtime gained redundant checks
- move bounds conversion into a policy-owned helper if scene code still computes it ad hoc
- only then consider local patch optimization for visible duplicate terrain

## 11. Staged Delivery Plan

### Stage 0: Failing tests and diagnostics baseline

Objective:

- prove the ocean-disappearance bug in tests
- add diagnostics that distinguish duplicate repair from bounds replay rejection

Exit criteria:

- at least one failing test pins duplicate visible ocean loss
- at least one failing test pins cache replay rejection due to bounds visibility
- diagnostics counters exist even if the behavior is not yet fixed

### Stage 1: Bounds correctness

Objective:

- stop terrain from being culled or replay-rejected by overly tight chunk bounds

Exit criteria:

- runtime chunk bounds come from padded terrain presentation bounds
- current chunk replay is not skipped solely due to analytical bounds visibility

### Stage 2: Duplicate visible ocean convergence

Objective:

- ensure visible duplicate terrain updates cannot leave missing ocean tiles on screen

Exit criteria:

- visible duplicate same-biome ocean tiles choose a correctness-preserving repair path
- visible duplicate biome-delta ocean tiles converge without data loss
- no visible ocean gap remains after the repair commit for the current chunk

### Stage 3: Recovery hardening

Objective:

- prevent the fix from turning into a second visible repaint path

Exit criteria:

- same-chunk repair commits through the presentation gate
- stale repairs drop safely
- offscreen recovery does not produce unexplained second ocean swaps

### Stage 4: Optional optimization

Objective:

- reduce refresh churn after correctness is established

Possible follow-ups:

- visible terrain membership index
- `local_terrain_patch` for proven-safe visible duplicates
- more precise per-biome terrain diagnostics

## 12. Risks and Open Questions

### 12.1 Correctness versus churn

Risk:

- the simplest correctness fix may temporarily increase same-chunk refresh frequency for visible duplicates

Recommended direction:

- accept the temporary cost in phase one
- optimize only after the visible ocean gap is eliminated and covered by tests

### 12.2 Missing visible terrain membership proof

Risk:

- without a visible terrain membership index, the runtime may not know whether a duplicate visible tile is already present

Recommended direction:

- treat uncertainty as a correctness problem and repair through atomic refresh first

### 12.3 Expanded bounds may affect performance

Risk:

- conservative terrain bounds can increase the number of frames where terrain remains eligible for rendering and animation checks

Mitigation:

- keep animation throttling separate from terrain correctness
- measure any regression with diagnostics before trying to shrink bounds again

### 12.4 The bug may have a shortcut-navigation variant

Open question:

- if the user reproduces this primarily during shortcut-driven camera jumps rather than ordinary pan traversal, does the older raw world-floor chunk key path in shortcut helpers contribute?

Recommended direction:

- treat that as a follow-up verification step after the shared duplicate and bounds fixes land
- do not expand the first fix scope unless tests prove it is part of the same user-visible failure

## 13. Recommendation

The implementation should start with the smallest fix that guarantees correctness:

1. write failing tests for visible duplicate ocean overlap and bounds-driven replay rejection
2. wire padded terrain presentation bounds into runtime chunk bounds and replay decisions
3. route uncertain visible duplicate terrain repair through atomic same-chunk refresh
4. add diagnostics that prove why any future ocean disappearance happened

That sequence fixes the highest-signal failure modes first and keeps the work aligned with the repo's existing terrain stability direction without requiring a full chunk-system redesign.
