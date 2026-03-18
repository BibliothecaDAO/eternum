# Chunking/Streaming Bugfix PRD + TDD

Status: Draft
Date: 2026-03-18
Scope: `client/apps/game/src/three`
Primary surfaces: chunk transition settling, hydration idle waits, chunk switch critical path serialization, directional prewarm tile fetch correctness, post-commit catch-up throughput, matrix cache eviction, chunk registration data structure

## 1. Summary

This document catalogs six confirmed bugs and performance regressions in the worldmap chunking/streaming system and converts them into a staged delivery plan with product requirements, technical design, file-level scope, and test-first implementation steps.

The core findings are:

- safety primitives (`waitForChunkTransitionToSettle`, `waitForStructureHydrationIdle`, `waitForTileHydrationIdle`) have unbounded loop or recursion behavior that can hang or overflow under sustained camera movement or hydration pressure
- the chunk switch critical path serializes redundant hydration drains, adding full drain latency on every switch
- directional presentation prewarm bypasses real tile fetch, causing terrain to be built from stale or empty data and cached as a hit
- the post-commit manager catch-up queue drains one task per frame with O(N) serial chaining, creating unbounded queue growth under rapid traversal
- matrix cache eviction burns iterations cycling through pinned entries without evicting anything
- `chunkRegistrationOrder` uses an array with O(n) `indexOf` + `splice`, called frequently during map traversal

The plan uses a staged approach where each stage ships a measurable improvement, preserves rollback paths, adds tests before behavior changes, and reduces risk before changing higher-level orchestration.

## 2. Problem Statement

### 2.1 Chunk transition settling can loop indefinitely

`waitForChunkTransitionToSettle` (worldmap-chunk-transition.ts:691-707) uses a `while(true)` loop that re-reads `getTransitionPromise()` after each await. Under sustained camera movement that keeps queueing chunk switches, `flushChunkRefresh` is permanently blocked because `chunkRefreshRunning` stays `true` and no further refresh scheduling occurs. There is no iteration limit, no timeout, and no `isSwitchedOff` guard inside the loop.

The function is called from `updateVisibleChunks` (worldmap.tsx:5553) where `isSwitchedOff` is checked before the call but not threaded into the settling loop itself.

### 2.2 Hydration idle waits use unbounded recursion

`waitForStructureHydrationIdle` (worldmap.tsx:4698-4727) and `waitForTileHydrationIdle` (worldmap.tsx:4730-4759) both use tail-recursive `await this.waitFor*HydrationIdle(chunkKey)` calls at the end of the function body. Under persistent hydration pressure where `fetchSettled` keeps flipping or `pendingCount` stays nonzero, the call stack grows without limit. These should be iterative `while` loops.

### 2.3 Double hydration drain in chunk switch critical path

In `hydrateWarpTravelChunk` (worldmap.tsx:5744-5758), the `waitForStructureHydrationIdle` callback awaits structure hydration drain. The `prewarmChunkAssets` callback (worldmap.tsx:5753-5758) independently awaits the same `this.waitForStructureHydrationIdle(targetChunkKey)` before calling `this.structureManager.prewarmChunkAssets`. Since these are run via `Promise.all` in the hydration pipeline, the prewarm leg is serialized behind its own redundant structure drain instead of running concurrently with the explicit structure drain. This adds a full hydration drain duration as extra latency on every chunk switch.

The same pattern appears in `refreshCurrentChunk` (worldmap.tsx:5917-5931).

### 2.4 Prewarm builds terrain from fake tile fetch

`prewarmDirectionalPresentationChunk` (worldmap.tsx:3530-3542) calls `prepareWorldmapChunkPresentation` with `tileFetchPromise: Promise.resolve(true)`, bypassing the real tile fetch. If tiles have not been fetched for that chunk key (i.e., `this.fetchedChunks` does not contain the fetch key), terrain matrices are built from stale or empty data, cached via `cachePreparedTerrain`, and served as a cache hit during the actual chunk switch. The real `computeTileEntities` call is never made in this path.

### 2.5 Post-commit catch-up queue drains one task per frame with serial chaining

`drainPostCommitManagerCatchUpQueue` (worldmap.tsx:3605-3645) processes one task per invocation. Each completed task chains the next drain via `.finally()`, introducing O(N) rescheduling latency for N queued tasks. Under rapid traversal, the queue grows unboundedly while only one task is processed per frame. There is no mechanism to drain multiple tasks within a single frame budget or to cap the queue size.

### 2.6 Matrix cache eviction burns iterations on pinned entries

`ensureMatrixCacheLimit` (worldmap.tsx:4904-4930) uses a safety counter that counts all iterations, including iterations that only re-enqueue pinned keys. When all or most cached entries are pinned, the loop exhausts its entire budget cycling through the same pinned keys without evicting anything, performing `O(cachedMatrixOrder.length)` wasted iterations every time.

### 2.7 O(n) chunk registration order operations

`CentralizedVisibilityManager.unregisterChunk` (centralized-visibility-manager.ts:244-248) uses `indexOf` + `splice` on a `string[]` for `chunkRegistrationOrder`. Both operations are O(n). This is called frequently during map traversal as chunks are registered and unregistered. The same array is iterated during `enforceChunkLimit` (line 556).

## 3. Goals

### 3.1 Product goals

- eliminate indefinite hangs during sustained camera movement caused by unbounded transition settling
- prevent call stack overflow under persistent hydration pressure
- reduce chunk switch latency by removing redundant serialized hydration drains
- ensure directional prewarm produces correct terrain data from real tile fetches
- improve post-commit manager catch-up throughput to keep up with rapid traversal
- reduce CPU waste from futile cache eviction cycling

### 3.2 Technical goals

- make all waiting primitives bounded with explicit limits and early-exit guards
- convert recursive hydration waits to iterative loops
- deduplicate hydration drain awaits in the chunk switch critical path
- ensure prewarm uses real tile data or correctly skips caching when data is unavailable
- allow multi-task drain within a frame budget for the post-commit catch-up queue
- make matrix cache eviction aware of the non-pinned entry count to bail early
- replace O(n) array operations with O(1) `Set` operations for chunk registration

## 4. Non-goals

- redesigning the chunk streaming architecture or chunk key contract
- changing the chunk boundary policy or hysteresis behavior (covered by WORLDMAP_CHUNK_STREAMING_PRD_TDD.md)
- adding new diagnostics or observability (covered by WORLDMAP_CHUNK_STREAMING_PRD_TDD.md Stage 0)
- moving terrain generation to workers
- changing gameplay rules, pathfinding, or Dojo/Torii data ownership

## 5. Architecture Assessment

All fixes operate on existing code paths without introducing new architectural seams.

- `waitForChunkTransitionToSettle` is a standalone utility in `worldmap-chunk-transition.ts` with a clean function signature that already accepts a getter and an error callback. Adding an options parameter for limits and guards is straightforward.
- The hydration idle waits in `worldmap.tsx` are private methods with well-defined termination conditions that can be converted to `while` loops without changing their external contract.
- The redundant `waitForStructureHydrationIdle` in `prewarmChunkAssets` is a simple removal.
- The prewarm tile fetch fix requires threading the existing `computeTileEntities` method into the prewarm path, which is already available on the same class.
- The post-commit catch-up queue already has budget-aware drain infrastructure via `drainBudgetedDeferredManagerCatchUpQueue`; the fix extends it to drain multiple tasks within the budget.
- The matrix cache eviction fix is a pure algorithmic improvement to the existing loop.
- The chunk registration order fix is a data structure swap from `string[]` to `Set<string>`.

## 6. Success Metrics

### 6.1 Safety metrics

- `waitForChunkTransitionToSettle` never exceeds the configured iteration limit
- hydration idle waits never grow the call stack beyond a single frame
- no indefinite blocking of `flushChunkRefresh` under sustained camera movement

### 6.2 Correctness metrics

- directional prewarm terrain matches terrain built from real tile data for the same chunk
- no stale or empty terrain is cached and served as a hit during chunk switches
- all existing stale-token, rollback, and latest-wins guarantees remain intact

### 6.3 Performance metrics

- chunk switch critical path latency reduced by removing one full hydration drain duration
- post-commit catch-up queue drains proportionally to frame budget, not one-per-frame
- matrix cache eviction bails early when only pinned entries remain
- chunk unregistration drops from O(n) to O(1)

## 7. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | Chunk Transition Safety Guards | Bounded settling and stack-safe hydration waits |
| 1 | Chunk Switch Critical Path — Remove Serialized Redundancy | Eliminate double hydration drain on every switch |
| 2 | Prewarm Correctness — Real Tile Fetch | Prewarm produces correct terrain from real data |
| 3 | Post-Commit Catch-Up Queue Throughput | Multi-task drain within frame budget |
| 4 | Matrix Cache Eviction Under Pinning Pressure | Early bail when no evictable entries remain |
| 5 | Chunk Registration Order Data Structure | O(1) registration and unregistration |

### Delivery Tracker

- [x] Stage 0: Chunk Transition Safety Guards
- [x] Stage 1: Chunk Switch Critical Path — Remove Serialized Redundancy
- [x] Stage 2: Prewarm Correctness — Real Tile Fetch
- [x] Stage 3: Post-Commit Catch-Up Queue Throughput
- [x] Stage 4: Matrix Cache Eviction Under Pinning Pressure
- [x] Stage 5: Chunk Registration Order Data Structure

### Dependencies

- Stage 0 is a prerequisite for all other stages (safety guards must be in place before behavior changes)
- Stage 1 depends on Stage 0 (cannot speed up the critical path if transition settling can hang)
- Stage 2 depends on Stage 0 (prewarm correctness relies on hydration idle being stack-safe)
- Stage 3 is independent of Stages 1 and 2 but should come after Stage 0
- Stage 4 is independent, can be done in parallel with any stage after Stage 0
- Stage 5 is fully independent, can be done in parallel with any stage

## 8. Detailed Stages

### 8.1 Stage 0: Chunk Transition Safety Guards

#### Objective

Make all waiting primitives bounded and stack-safe so that no sustained workload can hang the chunk refresh pipeline or overflow the call stack.

#### Scope

- add `isSwitchedOff` guard and max-iteration cap to `waitForChunkTransitionToSettle`
- convert `waitForStructureHydrationIdle` and `waitForTileHydrationIdle` from tail recursion to `while` loops
- add configurable limits with sensible defaults

#### Files to change

Source files:
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.ts` — `waitForChunkTransitionToSettle` function (lines 691-707)
- `client/apps/game/src/three/scenes/worldmap.tsx` — `waitForStructureHydrationIdle` (lines 4698-4727) and `waitForTileHydrationIdle` (lines 4730-4759)

Test files:
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.test.ts` — extend existing tests
- new: `client/apps/game/src/three/scenes/worldmap-hydration-idle-safety.test.ts`

#### TDD plan

Write tests first:

1. `waitForChunkTransitionToSettle` returns after max iterations when `getTransitionPromise` always returns a new promise — proves the iteration cap terminates the loop
2. `waitForChunkTransitionToSettle` returns immediately when `isSwitchedOff` returns `true` before the first iteration — proves the guard exits early
3. `waitForChunkTransitionToSettle` returns when `isSwitchedOff` becomes `true` mid-loop — proves the guard is checked on each iteration
4. `waitForChunkTransitionToSettle` still returns on first iteration when `getTransitionPromise` returns `null` — proves existing behavior is preserved
5. `waitForStructureHydrationIdle` resolves without stack growth when hydration state oscillates N times — proves the `while` loop does not grow the stack
6. `waitForTileHydrationIdle` resolves without stack growth when hydration state oscillates N times — proves the `while` loop does not grow the stack
7. both hydration idle waits still resolve immediately when state is already settled — proves existing fast-path behavior is preserved

Implementation steps:

1. extend `waitForChunkTransitionToSettle` signature to accept an options object with `isSwitchedOff?: () => boolean` and `maxIterations?: number` (default 100)
2. add `isSwitchedOff()` check at the top of each loop iteration, returning early if true
3. add iteration counter that increments on each loop pass, returning early with a warning when the cap is reached
4. update the call site in `worldmap.tsx:5553` to pass `isSwitchedOff: () => this.isSwitchedOff`
5. convert `waitForStructureHydrationIdle` from:
   ```
   // recursive tail call
   if (refreshed && (!refreshed.fetchSettled || refreshed.pendingCount > 0)) {
     await this.waitForStructureHydrationIdle(chunkKey);
   }
   ```
   to a `while` loop wrapping the entire function body
6. apply the same conversion to `waitForTileHydrationIdle`

Exit criteria:

- all new tests pass
- existing `worldmap-chunk-transition.test.ts` tests pass without modification
- no test requires more than one stack frame for the hydration idle wait
- sustained camera movement in manual testing no longer hangs `flushChunkRefresh`

### 8.2 Stage 1: Chunk Switch Critical Path — Remove Serialized Redundancy

#### Objective

Eliminate the double `waitForStructureHydrationIdle` in the chunk switch hot path so that structure hydration drain and asset prewarm run concurrently.

#### Scope

- remove the redundant `await this.waitForStructureHydrationIdle(targetChunkKey)` inside the `prewarmChunkAssets` callback in `hydrateWarpTravelChunk` (worldmap.tsx:5753-5754)
- remove the same redundant await in `refreshCurrentChunk` (worldmap.tsx:5926-5927)
- the explicit `waitForStructureHydrationIdle` callback (worldmap.tsx:5744-5751 and 5917-5924) already drains structure hydration and runs via `Promise.all` alongside `prewarmChunkAssets`, so the drain inside prewarm is purely redundant

#### Files to change

Source files:
- `client/apps/game/src/three/scenes/worldmap.tsx` — `hydrateWarpTravelChunk` prewarmChunkAssets callback (line 5754) and `refreshCurrentChunk` prewarmChunkAssets callback (line 5927)

Test files:
- new: `client/apps/game/src/three/scenes/worldmap-chunk-switch-redundancy.test.ts`

#### TDD plan

Write tests first:

1. `prewarmChunkAssets` callback does not await structure hydration drain independently — proves the redundant wait is removed (mock `waitForStructureHydrationIdle` and assert it is called exactly once per switch, not twice)
2. `prewarmChunkAssets` and `waitForStructureHydrationIdle` run concurrently via `Promise.all` — proves that asset prewarm starts as soon as the hydration pipeline emits it, not after the drain completes twice
3. chunk switch still waits for structure hydration drain before terrain preparation — proves correctness is preserved
4. same assertions hold for the `refreshCurrentChunk` path

Implementation steps:

1. in the `prewarmChunkAssets` callback at worldmap.tsx:5753-5758, remove the line `await this.waitForStructureHydrationIdle(targetChunkKey);` so the callback becomes:
   ```typescript
   prewarmChunkAssets: async (targetChunkKey) => {
     const startedAt = performance.now();
     await this.structureManager.prewarmChunkAssets(targetChunkKey);
     presentationPhaseDurations.structureAssetPrewarmMs = performance.now() - startedAt;
     recordWorldmapRenderDuration("structureAssetPrewarmMs", presentationPhaseDurations.structureAssetPrewarmMs);
   },
   ```
2. apply the same removal in the `refreshCurrentChunk` path at worldmap.tsx:5926-5931
3. verify that the hydration pipeline's `Promise.all` already includes the explicit `waitForStructureHydrationIdle` callback that provides the drain guarantee

Exit criteria:

- chunk switch p95 latency measurably decreases by approximately one hydration drain duration
- no change to terrain correctness or stale-token behavior
- all existing chunk transition tests pass
- manual traversal shows no new artifacts at chunk boundaries

### 8.3 Stage 2: Prewarm Correctness — Real Tile Fetch

#### Objective

Ensure directional presentation prewarm builds terrain from real tile data rather than from a hardcoded `Promise.resolve(true)`.

#### Scope

- replace the fake `tileFetchPromise: Promise.resolve(true)` in `prewarmDirectionalPresentationChunk` (worldmap.tsx:3535) with a real tile fetch or a fetch-status guard
- prevent stale terrain from being cached and served as a hit during actual chunk switches

#### Files to change

Source files:
- `client/apps/game/src/three/scenes/worldmap.tsx` — `prewarmDirectionalPresentationChunk` method (lines 3520-3547)

Test files:
- new: `client/apps/game/src/three/scenes/worldmap-prewarm-tile-fetch.test.ts`

#### TDD plan

Write tests first:

1. prewarm calls `computeTileEntities` for the target chunk key when tiles have not been fetched — proves real tile data is used
2. prewarm skips terrain preparation when tile fetch fails — proves no stale data is cached
3. prewarm reuses existing tile data when `fetchedChunks` already contains the fetch key — proves no redundant fetch for already-fetched chunks
4. cached terrain from prewarm matches terrain built by the real chunk switch path for the same chunk — proves data equivalence
5. prewarm still respects `isLatestToken` and `isSwitchedOff` guards — proves existing safety is preserved

Implementation steps:

1. in `prewarmDirectionalPresentationChunk`, replace:
   ```typescript
   tileFetchPromise: Promise.resolve(true),
   ```
   with:
   ```typescript
   tileFetchPromise: this.computeTileEntities(chunkKey),
   ```
2. alternatively, if the full tile fetch is too expensive for speculative prewarm, add a guard that checks `this.fetchedChunks.has(fetchKey)` before terrain preparation and skips caching when tiles are not available:
   ```typescript
   const fetchKey = this.getRenderAreaKeyForChunk(chunkKey);
   const hasTileData = this.fetchedChunks.has(fetchKey);
   tileFetchPromise: hasTileData ? Promise.resolve(true) : this.computeTileEntities(chunkKey),
   ```
3. ensure `cachePreparedTerrain` is only called when `tileFetchPromise` resolves to `true` (i.e., tiles were actually fetched)

Exit criteria:

- no prewarm terrain cache entry is built from empty or stale tile data
- prewarm cache hits produce visually identical terrain to cold chunk switches
- tile fetch volume increase is bounded (monitored via existing tile fetch volume regression helpers)
- all existing prewarm tests pass

### 8.4 Stage 3: Post-Commit Catch-Up Queue Throughput

#### Objective

Allow the post-commit manager catch-up queue to drain multiple tasks per frame within a budget, preventing unbounded queue growth under rapid traversal.

#### Scope

- modify `drainPostCommitManagerCatchUpQueue` (worldmap.tsx:3605-3645) to drain multiple tasks within the frame budget instead of exactly one
- add optional queue length cap to reject or coalesce old entries when the queue exceeds a threshold
- preserve the existing budget-aware deferral behavior for oversized individual tasks

#### Files to change

Source files:
- `client/apps/game/src/three/scenes/worldmap.tsx` — `drainPostCommitManagerCatchUpQueue` method (lines 3605-3645) and `schedulePostCommitManagerCatchUpDrain` (lines 3580-3603)

Test files:
- new: `client/apps/game/src/three/scenes/worldmap-post-commit-drain-throughput.test.ts`

#### TDD plan

Write tests first:

1. queue with N small tasks drains all N in a single frame when total size is within budget — proves multi-drain works
2. queue with tasks exceeding the frame budget drains up to the budget and schedules the remainder — proves budget enforcement
3. queue length cap discards oldest entries when the queue exceeds the configured threshold — proves unbounded growth is prevented
4. stale transition tokens in queued tasks are skipped during drain — proves correctness under rapid traversal
5. single oversized task is still deferred to the next frame — proves existing deferral behavior is preserved
6. drain ordering remains deterministic (FIFO) — proves no ordering regression

Implementation steps:

1. wrap the single-task drain in a `while` loop that continues draining while the budget has remaining capacity and the queue is non-empty
2. track cumulative budget consumption across tasks within the same drain invocation
3. move the `.finally()` reschedule from per-task to per-drain-invocation to avoid O(N) serial chaining
4. add a configurable `maxQueueLength` (default 32) that trims the queue from the front (oldest entries) when exceeded
5. log a warning counter when queue trimming occurs

Exit criteria:

- queue length stays bounded under rapid traversal
- post-commit catch-up latency is proportional to task count, not O(N) serial chain depth
- all existing manager catch-up tests pass
- manual rapid traversal shows managers updating within a few frames of terrain commit

### 8.5 Stage 4: Matrix Cache Eviction Under Pinning Pressure

#### Objective

Make `ensureMatrixCacheLimit` bail early when no evictable entries remain, instead of burning iterations cycling through pinned keys.

#### Scope

- modify `ensureMatrixCacheLimit` (worldmap.tsx:4904-4930) to count non-pinned entries and terminate immediately when all remaining entries are pinned

#### Files to change

Source files:
- `client/apps/game/src/three/scenes/worldmap.tsx` — `ensureMatrixCacheLimit` method (lines 4904-4930)

Test files:
- new: `client/apps/game/src/three/scenes/worldmap-matrix-cache-eviction.test.ts`

#### TDD plan

Write tests first:

1. eviction completes in O(1) when all entries are pinned — proves early bail (assert loop iteration count is zero or one, not `cachedMatrixOrder.length`)
2. eviction still evicts unpinned entries correctly when a mix of pinned and unpinned entries exists — proves eviction correctness is preserved
3. eviction stops after removing enough entries to meet the limit — proves no over-eviction
4. warning is still emitted when pinned entries exceed capacity — proves diagnostic behavior is preserved
5. eviction handles empty cache gracefully — proves edge case safety

Implementation steps:

1. before the eviction loop, count non-pinned entries:
   ```typescript
   const nonPinnedCount = this.cachedMatrixOrder.filter(k => !this.pinnedChunkKeys.has(k)).length;
   const evictableCount = nonPinnedCount - 0; // all non-pinned are evictable
   ```
2. if `this.cachedMatrixOrder.length - evictableCount <= this.maxMatrixCacheSize`, bail early with the existing warning
3. alternatively, replace the safety counter with a counter that only counts non-pinned keys seen, and break when all non-pinned keys have been processed:
   ```typescript
   let nonPinnedSeen = 0;
   while (this.cachedMatrixOrder.length > this.maxMatrixCacheSize && nonPinnedSeen < nonPinnedCount) {
     const oldestKey = this.cachedMatrixOrder.shift();
     if (!oldestKey) break;
     if (this.pinnedChunkKeys.has(oldestKey)) {
       this.cachedMatrixOrder.push(oldestKey);
       continue;
     }
     nonPinnedSeen++;
     this.disposeCachedMatrices(oldestKey);
     this.cachedMatrices.delete(oldestKey);
   }
   ```

Exit criteria:

- `ensureMatrixCacheLimit` performs at most `nonPinnedCount` iterations, not `cachedMatrixOrder.length` iterations
- all existing matrix cache tests pass
- no change to eviction behavior when unpinned entries are available

### 8.6 Stage 5: Chunk Registration Order Data Structure

#### Objective

Replace the O(n) array-based `chunkRegistrationOrder` with an insertion-ordered `Set<string>` for O(1) delete operations.

#### Scope

- replace `chunkRegistrationOrder: string[]` with a `Set<string>` in `CentralizedVisibilityManager`
- update all access patterns: `push` becomes `add`, `indexOf` + `splice` becomes `delete`, `shift` becomes iteration to first element + `delete`, `length` becomes `size`

#### Files to change

Source files:
- `client/apps/game/src/three/utils/centralized-visibility-manager.ts` — `chunkRegistrationOrder` declaration (line 109), `registerChunk` (line 224), `unregisterChunk` (lines 245-247), `enforceChunkLimit` (lines 556-557)

Test files:
- `client/apps/game/src/three/utils/centralized-visibility-manager.idle-frame.test.ts` — extend or verify existing tests
- new: `client/apps/game/src/three/utils/centralized-visibility-manager.registration-order.test.ts`

#### TDD plan

Write tests first:

1. `unregisterChunk` removes a key in O(1) — proves the `Set.delete` path works (benchmark N=1000 unregistrations to confirm linear time scaling, not quadratic)
2. `registerChunk` preserves insertion order — proves `Set` iteration order matches registration order
3. `enforceChunkLimit` evicts the oldest registered chunk — proves FIFO order is maintained via `Set` iteration
4. duplicate registration does not create duplicate entries — proves `Set` deduplication (the array version could push duplicates if `registerChunk` is called twice)
5. `hasChunk` still works correctly after registration order changes — proves no regression in chunk lookup

Implementation steps:

1. change the declaration from:
   ```typescript
   private chunkRegistrationOrder: string[] = [];
   ```
   to:
   ```typescript
   private chunkRegistrationOrder: Set<string> = new Set();
   ```
2. update `registerChunk`:
   ```typescript
   // Before: this.chunkRegistrationOrder.push(chunkKey);
   this.chunkRegistrationOrder.add(chunkKey);
   ```
3. update `unregisterChunk`:
   ```typescript
   // Before: const idx = this.chunkRegistrationOrder.indexOf(chunkKey);
   //         if (idx !== -1) { this.chunkRegistrationOrder.splice(idx, 1); }
   this.chunkRegistrationOrder.delete(chunkKey);
   ```
4. update `enforceChunkLimit`:
   ```typescript
   // Before: while (this.chunkRegistrationOrder.length > this.config.maxRegisteredChunks) {
   //           const oldest = this.chunkRegistrationOrder.shift();
   while (this.chunkRegistrationOrder.size > this.config.maxRegisteredChunks) {
     const oldest = this.chunkRegistrationOrder.values().next().value;
     if (!oldest) break;
     this.chunkRegistrationOrder.delete(oldest);
   ```
5. update any `.length` references to `.size`

Exit criteria:

- all existing `centralized-visibility-manager` tests pass
- chunk unregistration is O(1) instead of O(n)
- insertion order is preserved for eviction purposes
- no change to chunk visibility behavior

## 9. Test Strategy

### 9.1 Core testing principles

- no production behavior change without a failing test first
- keep tests focused on explicit behavior boundaries
- prefer unit tests over integration tests for algorithmic fixes
- preserve existing stale-token, rollback, and latest-wins protections

### 9.2 Test categories

- safety tests:
  - bounded iteration in `waitForChunkTransitionToSettle`
  - stack-safe hydration idle waits
  - early bail in matrix cache eviction
- correctness tests:
  - prewarm terrain data equivalence with real tile fetch
  - queue drain ordering and stale-token skipping
  - chunk registration insertion order preservation
- performance tests:
  - multi-task drain throughput
  - O(1) chunk unregistration
  - bounded eviction iteration count

### 9.3 Manual validation checklist

- pan steadily across several chunk boundaries under sustained camera movement and verify no indefinite hang in the console
- verify chunk switch timing in debug diagnostics shows reduced latency (one fewer hydration drain)
- traverse to a new chunk via directional movement and verify terrain matches expectations (no empty or stale terrain from prewarm)
- perform rapid multi-chunk traversal and verify post-commit manager catch-up completes within a few frames
- pin multiple chunks and verify matrix cache eviction does not consume excessive CPU time
- register and unregister many chunks rapidly and verify no performance degradation

## 10. Risks and Mitigations

### 10.1 Risk: iteration cap in transition settling could drop legitimate transitions

Mitigation:
- set the default cap high enough (100 iterations) that only pathological sustained movement triggers it
- log a warning when the cap is reached so the issue is observable
- the caller (`updateVisibleChunks`) will reschedule via the existing rerun mechanism

### 10.2 Risk: removing redundant hydration drain exposes a race condition

Mitigation:
- the explicit `waitForStructureHydrationIdle` callback already provides the drain guarantee via `Promise.all`
- the redundant drain in `prewarmChunkAssets` is purely additive latency, not a correctness guard
- test explicitly that structure hydration is fully drained before terrain preparation begins

### 10.3 Risk: real tile fetch in prewarm increases network/CPU load

Mitigation:
- use the `fetchedChunks` guard to skip redundant fetches for already-fetched chunks
- prewarm already respects `isLatestToken` and `isSwitchedOff` guards
- monitor tile fetch volume via existing regression helpers

### 10.4 Risk: multi-task drain in catch-up queue causes frame hitching

Mitigation:
- drain is already budget-aware via `drainBudgetedDeferredManagerCatchUpQueue`
- multi-drain respects the same budget, just processes multiple small tasks within it
- if a single task exceeds the budget, it is still deferred

## 11. Open Questions

- should the `waitForChunkTransitionToSettle` iteration cap be configurable per call site, or a single global default?
- should prewarm always call `computeTileEntities`, or only when `fetchedChunks` does not contain the key (lazy fetch vs eager fetch)?
- should the post-commit catch-up queue cap trigger coalescing (merging old tasks for the same chunk) or simple FIFO trimming?
- is the `Set` iteration order guarantee (insertion order per spec) sufficient for all `chunkRegistrationOrder` consumers, or does any consumer rely on array index access?
