# Debug Report: Remaining Biome Flicker Timing Windows in Worldmap Chunk Transitions

Generated: 2026-03-20

## Symptom

Three subtle timing windows were identified as potentially causing biome flickering during chunk transitions in the
Three.js worldmap, beyond the 5 bugs already fixed.

## Investigation Steps

1. Read `updateVisibleChunks` (lines 5626-5724) to understand the `isChunkTransitioning` lifecycle
2. Read `refreshCurrentChunk` (lines 5961-6091) to trace the terrain commit + bounds update + manager catch-up flow
3. Read `performChunkSwitch` (lines 5726-5959) to compare the same flow on the cross-chunk path
4. Read `prepareTerrainChunk` (lines 4186-4386) to understand requestAnimationFrame batching and snapshot usage
5. Read `updateExploredHex` (lines 3065-3253) to trace the live-append path and the `isChunkTransitioning` guard
6. Read `resolveVisibleTerrainReconcileMode` (worldmap-visible-terrain-reconcile-policy.ts) to understand reconcile
   branching
7. Read `drainPostCommitManagerCatchUpQueue` (lines 3665-3709) and `deferManagerCatchUpForChunk` (lines 3610-3643)
8. Read `scheduleChunkRefreshExecution` (lines 5542-5563) and `flushChunkRefresh` (lines 5565-5623)
9. Read `requestChunkRefresh` (lines 5450-5485) to understand the deferred mechanism
10. Read `setVisibleTerrainMembership` (lines 5042-5053) to confirm it is a full atomic replacement

---

## Timing Window 1: `isChunkTransitioning` clears before manager drain completes

### Evidence

**Location:** `worldmap.tsx:5714-5716` (refresh path) and `5685-5691` (switch path)

The `finally` blocks:

```typescript
// Line 5714-5716 (refresh_current_chunk path):
} finally {
  this.globalChunkSwitchPromise = null;
  this.isChunkTransitioning = false;
}

// Line 5685-5691 (switch_chunk path):
} finally {
  ...
  this.globalChunkSwitchPromise = null;
  this.isChunkTransitioning = false;
}
```

When `WORLDMAP_STREAMING_ROLLOUT.stagedPathEnabled` is true, the manager catch-up is deferred via
`deferManagerCatchUpForChunk` at line 6074 (refresh path) and line 5916 (switch path). This pushes work into
`postCommitManagerCatchUpQueue` and schedules a `requestAnimationFrame` drain at line 3652.

The drain runs **after** the `finally` block sets `isChunkTransitioning = false`. At that point, a Torii stream tile
arriving via `updateExploredHex` will:

1. Pass the `isChunkTransitioning` guard at line 3215 (since it is now `false`)
2. Hit `resolveVisibleTerrainReconcileMode` at line 3196
3. If the tile is new (`currentOwner === null`), get `"append_if_absent"` and live-append at lines 3237-3239

### Can this cause visible flicker?

**No, this cannot cause visible biome flicker.** Here is why:

The manager catch-up (`armyManager.updateChunk`, `structureManager.updateChunk`, `chestManager.updateChunk`) manages
armies, structures, and chests -- NOT terrain biome tiles. The terrain commit (`applyPreparedTerrainChunk` at line 6051)
and the `setVisibleTerrainMembership` call (line 4450) have ALREADY completed synchronously before the `finally` block
runs. By the time `isChunkTransitioning` goes to `false`:

- Terrain instance buffers have the correct biome matrices (committed at line 4430)
- `visibleTerrainMembership` has been atomically replaced (line 4450/5052)
- World bounds have been updated (line 6052)

A Torii tile arriving after `isChunkTransitioning = false` will:

- Find the tile already in `visibleTerrainMembership` -> `resolveVisibleTerrainReconcileMode` returns `"none"` -> no-op
- OR it is genuinely a new tile not in the prepared chunk -> `"append_if_absent"` -> correct live append

The only inconsistency would be armies/structures not yet updated, which is a pop-in issue (armies appearing late), not
a biome flicker.

**Verdict: NOT a biome flicker risk. Severity: N/A for biome tiles. Low severity pop-in for armies/structures.**

---

## Timing Window 2: `prepareTerrainChunk` requestAnimationFrame batching vs live tile append

### Evidence

**Location:** `worldmap.tsx:4186-4386` (prepareTerrainChunk), lines 4204-4206 (snapshot), line 4384 (first rAF), lines
4356-4382 (processFrame loop)

The snapshot is taken at line 4204:

```typescript
const prepSnapshot = snapshotExploredTilesRegion(this.exploredTiles, {
  centerCol: prepCenterCol,
  centerRow: prepCenterRow,
  halfCols: prepHalfCols,
  halfRows: prepHalfRows,
});
```

Then the entire matrix computation is yielded across multiple `requestAnimationFrame` calls (lines 4377-4384):

```typescript
if (currentIndex < totalHexes) {
  frameHandle = requestAnimationFrame(processFrame); // yield to next frame
} else {
  finalizeSuccess();
}
```

During these yield points, `updateExploredHex` CAN run and live-append a tile. However, the critical question is: does
`isChunkTransitioning` protect against this?

**Yes, it does.** When `prepareTerrainChunk` is running, it is called from within `refreshCurrentChunk` (line 6014) or
`performChunkSwitch` (via `hydrateWarpTravelChunk`). At this point, `isChunkTransitioning` is `true` (set at line 5708
or 5670). The guard at line 3215:

```typescript
if (this.isChunkTransitioning) {
  this.requestChunkRefresh(false, "deferred_transition_tile");
  return;
}
```

This means any Torii tile arriving during `prepareTerrainChunk` will be deferred to a post-transition chunk refresh
rather than live-appended. The tile will not be appended to the GPU buffer, so there is no race between the
snapshot-based preparation and live appends.

Additionally, `prepareTerrainChunk` now uses `snapshotExploredTilesRegion` (line 4204) to read from a frozen snapshot
rather than live `exploredTiles`, and the `processCell` function reads via `lookupSnapshotBiome(prepSnapshot, ...)` at
line 4313 rather than `this.exploredTiles.get(...)`. This means even if tiles were somehow appended during the rAF
yields, the preparation would produce consistent results from its snapshot.

**Verdict: NOT a visible flicker risk during chunk transitions.** The `isChunkTransitioning` guard prevents the race,
AND the snapshot mechanism provides a second layer of protection. **Confidence: High.**

---

## Timing Window 3: Biome key mismatch triggers atomic refresh

### Evidence

**Location:** `worldmap-visible-terrain-reconcile-policy.ts:17-37` and `worldmap.tsx:3207-3212`

The reconcile logic:

```typescript
// worldmap-visible-terrain-reconcile-policy.ts
if (!input.currentOwner) {
  return "append_if_absent"; // No owner -> append
}
if (input.currentOwner.biomeKey === input.nextBiomeKey) {
  return "none"; // Same biome -> no-op
}
if (input.canDirectReplace) {
  return "replace_same_hex"; // Direct replace supported
}
return "atomic_chunk_refresh"; // Biome mismatch, can't direct-replace
```

At line 3200, `canDirectReplace` is hardcoded to `false`:

```typescript
const visibleTerrainReconcileMode = resolveVisibleTerrainReconcileMode({
  isVisibleInCurrentChunk: true,
  currentOwner: this.visibleTerrainMembership.get(hexKey) ?? null,
  nextBiomeKey: biomeVariant,
  canDirectReplace: false, // <-- always false
});
```

When a tile arrives with a DIFFERENT biome key than what is in `visibleTerrainMembership`, the code takes the
`"atomic_chunk_refresh"` branch (line 3207), which calls `requestChunkRefresh(true, "tile_overlap_repair")` and returns.

### Can this cause visible flicker?

**Yes, but severity is very low.** Here is the sequence:

1. Tile at position (col, row) is already rendered with biome "Grassland" (from prepared terrain)
2. Torii stream delivers an update for the same tile with biome "Beach" (correction/delta)
3. `resolveVisibleTerrainReconcileMode` returns `"atomic_chunk_refresh"`
4. `requestChunkRefresh(true, "tile_overlap_repair")` is called at line 3211
5. The old "Grassland" tile remains rendered until the refresh completes

**Duration of wrong biome visibility:**

- `requestChunkRefresh` goes through the debounce/scheduling mechanism (lines 5450-5484)
- `resolveWorldmapChunkRefreshDebounceMs` computes a delay (force + tile_overlap_repair likely gets a short debounce)
- Then `flushChunkRefresh` -> `updateVisibleChunks` -> `refreshCurrentChunk` runs
- The refresh includes `prepareTerrainChunk` with requestAnimationFrame batching (multi-frame)
- Total: likely 2-10 frames (33-166ms at 60fps)

**However**, this scenario requires a genuine biome change for an already-known tile, which is rare in normal gameplay.
It happens primarily when:

- Server corrects a biome value (data inconsistency)
- Chunk boundary subscription overlap delivers tiles with different computation results
- A provisional biome (from army spawn Grassland override) is corrected by the real tile data

The old biome is displayed, not a blank or missing tile -- so the visual impact is a tile showing the wrong biome type
for a brief period, not a flash/disappearance.

**Verdict: CAN cause wrong-biome display for 2-10 frames. Severity: Low. Likelihood: Rare (requires biome delta on
existing tile). Not a flash/flicker per se, more of a brief stale display.**

---

## Additional Timing Window Analysis

### Check 1: `chunkTransitionToken` staleness gaps

**Location:** `worldmap.tsx:5667` (increment), `5699` (increment for refresh), `6036-6047` (staleness check in
refreshCurrentChunk)

The token is incremented atomically at line 5667/5699 before the async operation starts. The staleness check at line
6036 (`resolveSameChunkRefreshCommit`) compares `transitionToken` (captured at call time) against
`this.chunkTransitionToken` (live value). If a newer transition has started, the refresh is dropped as stale at
line 6044.

**Gap analysis:** The token is a monotonically increasing integer. Between `++this.chunkTransitionToken` and the
staleness check, a newer `updateVisibleChunks` call could increment it again. This is correctly handled -- the stale
refresh is dropped. No gap found.

**Verdict: No issue. The token mechanism is sound.**

### Check 2: `globalChunkSwitchPromise` serialization bypass

**Location:** `worldmap.tsx:5634-5638` (waitForChunkTransitionToSettle)

```typescript
await waitForChunkTransitionToSettle(
  () => this.globalChunkSwitchPromise,
  (error) => console.warn(`Previous global chunk switch failed:`, error),
  { isSwitchedOff: () => this.isSwitchedOff },
);
```

This waits for any in-flight transition to complete before starting a new one. There is a TOCTOU window between
`waitForChunkTransitionToSettle` resolving and `this.globalChunkSwitchPromise` being assigned (line 5671 or 5709).
However, the callers of `updateVisibleChunks` are serialized:

- `flushChunkRefresh` has a `chunkRefreshRunning` mutex (lines 5579/5592)
- Shortcut navigation awaits the promise
- Legacy path uses setTimeout debouncing

Multiple concurrent entries into `updateVisibleChunks` are theoretically possible but practically prevented by the
scheduling mechanisms.

**Verdict: Theoretically possible but practically unexploitable. No fix needed.**

### Check 3: `requestChunkRefresh` deferred mechanism -- force flag gap

**Location:** `worldmap.tsx:3216` and `5450-5484`

When `requestChunkRefresh(false, "deferred_transition_tile")` is called from line 3216 (the `isChunkTransitioning`
guard), the `force` flag is `false`. This flows to `scheduleChunkRefreshExecution` with a debounce delay. The key
question: does this refresh always result in actual work?

The `scheduleChunkRefreshExecution` at line 5542 sets a `setTimeout`. When the timeout fires, `flushChunkRefresh` runs.
The accumulated `shouldForce` is read from `this.pendingChunkRefreshForce` (line 5593). Since the deferred tile call
used `force = false`, and no other caller set `force = true` in the interim, then `updateVisibleChunks(false, ...)` is
called. This means the chunk decision at line 5641 (`resolveWarpTravelVisibleChunkDecision`) evaluates whether a
switch/refresh is needed based on camera position.

If the camera has NOT moved (player is stationary), `chunkDecision.action` will be `"noop"` and the refresh returns
`false` without doing any work. The deferred tile is never picked up.

**However**, this gap is significantly mitigated by the fact that the chunk transition itself triggers a forced refresh.
Looking at the flow:

1. `refreshCurrentChunk` at line 6049 checks `commitDecision.shouldCommit` and if true, calls
   `applyPreparedTerrainChunk` which calls `setVisibleTerrainMembership` with the full prepared ownership
2. After the `finally` block at line 6079, the transition is done
3. The tile that was deferred during transition was also added to `exploredTiles` (line 3166) even though the visual
   append was skipped
4. The next `prepareTerrainChunk` (from any refresh) will pick it up from the snapshot

So the deferred tile IS in `exploredTiles` and WILL appear on the next refresh that actually runs `prepareTerrainChunk`.
The question is just: when does that next refresh happen?

If the chunk transition itself produced a `preparedTerrain` that included the tile (because it was added to
`exploredTiles` before the snapshot at line 4204), the tile is already rendered correctly. If the tile arrived AFTER the
snapshot was taken, it is in `exploredTiles` but not in the current render. It will appear on the next chunk refresh.

**Verdict: CAN cause a tile to be missing for an extended period if the camera is stationary and no other forced refresh
triggers. Severity: Medium for tile visibility (tile missing, not flickering). Likelihood: Low-Medium. This is NOT biome
flicker -- it is a delayed tile appearance.**

### Check 4: Interaction between `performChunkSwitch` and `refreshCurrentChunk` running close together

The serialization through `globalChunkSwitchPromise` and `waitForChunkTransitionToSettle` prevents these from running
concurrently. A rapid camera movement that triggers `switch_chunk` followed immediately by `refresh_current_chunk`
would:

1. First switch runs, sets `globalChunkSwitchPromise`
2. Second call hits `waitForChunkTransitionToSettle`, waits for first to complete
3. By the time second runs, `chunkDecision` is re-evaluated from scratch
4. The re-evaluation may produce a different decision (or noop)

This is correct behavior. No timing issue found.

### Check 5: `visibleTerrainMembership` NOT cleared during transitions (post-fix)

The original Bug 2.3 documented `visibleTerrainMembership.clear()` in `clearCache()`. I searched for
`visibleTerrainMembership.clear()` and found NO matches in the current code. The `clearCache()` method at line 3738 does
NOT clear `visibleTerrainMembership`. The membership is only replaced atomically via `setVisibleTerrainMembership` at
lines 3973, 4450, and 5288. This confirms Bug 2.3 has been fixed.

---

## Root Cause Summary

| Window                                              | Can Cause Visible Biome Flicker?                        | Severity            | Confidence |
| --------------------------------------------------- | ------------------------------------------------------- | ------------------- | ---------- |
| 1: isChunkTransitioning clears before manager drain | No (managers handle armies/structures, not biome tiles) | N/A                 | High       |
| 2: prepareTerrainChunk rAF batching race            | No (isChunkTransitioning guard + snapshot mechanism)    | N/A                 | High       |
| 3: Biome key mismatch atomic refresh delay          | Yes - wrong biome for 2-10 frames                       | Low                 | High       |
| NEW: Deferred tile refresh fires as non-forced noop | No biome flicker, but delayed tile appearance           | Medium (visibility) | Medium     |

## Recommended Fixes

### Fix for Window 3 (optional, low priority)

No immediate fix recommended. The 2-10 frame stale biome display on an already-rare event (biome delta on known tile) is
acceptable. Implementing in-place biome replacement (`canDirectReplace = true`) would require:

1. Removing the instance from the old biome InstancedMesh (compacting the array)
2. Appending to the new biome InstancedMesh
3. Updating all `visibleTerrainMembership` instanceIndex references for the old mesh (indices shift after removal)

The complexity is not justified for the frequency of this event.

### Fix for NEW finding: Deferred tile refresh force flag

**Files to modify:**

- `client/apps/game/src/three/scenes/worldmap.tsx` (line 3216)

**Change:**

```typescript
// Before (line 3216):
this.requestChunkRefresh(false, "deferred_transition_tile");

// After:
this.requestChunkRefresh(true, "deferred_transition_tile");
```

This ensures the deferred refresh for tiles arriving during transitions is always forced, preventing the noop scenario
when the camera is stationary. The debounce mechanism will still coalesce multiple deferred tiles into a single refresh.

**Risk:** Slightly more forced refreshes during rapid chunk transitions. This is mitigated by the debounce mechanism and
the `resolveSameChunkRefreshCommit` staleness check which will drop stale refreshes.

## Prevention

1. When deferring work with a "retry later" pattern, ensure the retry path has enough authority to actually execute
   (force flags should be preserved through deferral)
2. Manager catch-up (armies, structures) being deferred after terrain commit is architecturally correct -- terrain is
   the visual priority, managers are secondary
3. The `canDirectReplace: false` hardcoding is a deliberate safety choice; consider revisiting only if biome deltas
   become more frequent
