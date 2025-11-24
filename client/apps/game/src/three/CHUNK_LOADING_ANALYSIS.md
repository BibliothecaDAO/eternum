# Chunk-Loading Architecture Analysis & Refactor Report

## Executive Summary

The structure rendering bug during scrolling is caused by a **race condition between data hydration and visual rendering**, combined with **event-driven updates that don't guarantee rendering order**. Click events trigger a selection flow that forces immediate structure data re-fetch and visual refresh, exposing the underlying synchronization issue.

---

## Table of Contents

1. [Architecture Analysis](#1-architecture-analysis)
2. [Root Cause Analysis](#2-root-cause-analysis)
3. [Proposed Solution](#3-proposed-solution)
4. [Implementation Plan](#4-implementation-plan)
5. [Code Patches](#5-code-patches)
6. [Testing Recommendations](#6-testing-recommendations)
7. [Performance Considerations](#7-performance-considerations)
8. [Conclusion](#8-conclusion)

---

## 1. Architecture Analysis

### 1.1 Current Chunk System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CHUNK LOADING ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐     ┌──────────────────┐     ┌─────────────────────────┐  │
│  │   Camera    │────▶│ WorldmapScene    │────▶│ updateVisibleChunks()   │  │
│  │  Movement   │     │ (scroll/zoom)    │     │ (debounced 50ms)        │  │
│  └─────────────┘     └──────────────────┘     └───────────┬─────────────┘  │
│                                                           │                  │
│                           ┌───────────────────────────────┴─────────────┐   │
│                           ▼                                             │   │
│  ┌───────────────────────────────────────┐      ┌─────────────────────┐ │   │
│  │     performChunkSwitch()              │      │  refreshCurrentChunk│ │   │
│  │  (when chunk key changes)             │      │  (force refresh)    │ │   │
│  └───────────┬───────────────────────────┘      └────────────┬────────┘ │   │
│              │                                               │           │   │
│              ▼                                               ▼           │   │
│  ┌───────────────────────────────────────────────────────────────────┐  │   │
│  │                    PARALLEL OPERATIONS                             │  │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │  │   │
│  │  │ computeTile-   │  │ updateHexagon- │  │ refreshStructures- │   │  │   │
│  │  │ Entities()     │  │ Grid()         │  │ ForChunks()        │   │  │   │
│  │  │ (Torii fetch)  │  │ (biome render) │  │ (struct data)      │   │  │   │
│  │  └───────┬────────┘  └───────┬────────┘  └────────┬───────────┘   │  │   │
│  │          │                   │                    │               │  │   │
│  └──────────┼───────────────────┼────────────────────┼───────────────┘  │   │
│             ▼                   ▼                    ▼                  │   │
│  ┌───────────────────────────────────────────────────────────────────┐  │   │
│  │            updateManagersForChunk() [ASYNC PARALLEL]              │  │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │  │   │
│  │  │ ArmyManager    │  │ StructureMan.  │  │ QuestManager       │   │  │   │
│  │  │ .updateChunk() │  │ .updateChunk() │  │ .updateChunk()     │   │  │   │
│  │  └────────────────┘  └────────────────┘  └────────────────────┘   │  │   │
│  └───────────────────────────────────────────────────────────────────┘  │   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Paths

There are **THREE independent paths** for structure data to arrive:

| Path | Trigger | Flow |
|------|---------|------|
| **Initial Torii Fetch** | `getMapFromToriiExact` | Fetches Tile components → `WorldUpdateListener.Structure.onTileUpdate` → `StructureManager.onUpdate()` |
| **Structure Refresh** | `refreshStructuresForChunks` → `getStructuresDataFromTorii` | Fetches detailed data → `WorldUpdateListener.Structure.onStructureUpdate` → `StructureManager.updateStructureLabelFromStructureUpdate()` |
| **Real-time Subscription** | `defineComponentSystem` on `Tile` | Live changes → same callbacks as Path 1 |

### 1.3 Key Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `WorldmapScene` | `scenes/worldmap.tsx` | Orchestrates chunk loading, camera tracking, manager coordination |
| `StructureManager` | `managers/structure-manager.ts` | Manages structure instances, labels, visibility |
| `WorldUpdateListener` | `packages/core/.../world-update-listener.ts` | Translates Torii component updates to manager callbacks |
| `DataEnhancer` | `packages/core/.../data-enhancer.ts` | Enriches raw data with owner names, guild info, etc. |
| `Structures` (inner class) | `structure-manager.ts:1841` | Internal structure data store |

### 1.4 Chunk Coordinate System

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHUNK COORDINATE MAPPING                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  World Position (x, z)                                          │
│         │                                                        │
│         ▼                                                        │
│  worldToChunkCoordinates()                                      │
│         │                                                        │
│         ▼                                                        │
│  chunkX = floor(x / (chunkSize * HEX_SIZE * sqrt(3)))          │
│  chunkZ = floor(z / (chunkSize * HEX_SIZE * 1.5))              │
│         │                                                        │
│         ▼                                                        │
│  startCol = chunkX * chunkSize                                  │
│  startRow = chunkZ * chunkSize                                  │
│         │                                                        │
│         ▼                                                        │
│  chunkKey = `${startRow},${startCol}`                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5 Render Chunk vs Data Chunk

- **Data Chunk** (`chunkSize`): Unit for Torii data fetching
- **Render Chunk** (`renderChunkSize`): Larger area for visual rendering
- **Pinned Chunks**: 3x3 grid of surrounding chunks kept in memory

---

## 2. Root Cause Analysis

### 2.1 The Bug: Structures Don't Load While Scrolling

**Symptom**: Structures are invisible when scrolling into a new chunk. They appear after clicking on their expected location.

### 2.2 Root Cause: Fire-and-Forget Async Call

A **timing race condition** between three operations:

```
TIME ──────────────────────────────────────────────────────────────────────▶

performChunkSwitch():
  │
  ├── refreshStructuresForChunks([chunkKey])  ◀── (1) Fires fetch but doesn't await
  │
  ├── await updateToriiStreamBoundsForChunk() ◀── (2) Currently NO-OP (commented out)
  │
  ├── await updateHexagonGrid()               ◀── (3) Biome hexes render
  │
  └── await updateManagersForChunk()          ◀── (4) structureManager.updateChunk()
                                                       └── updateVisibleStructures()
                                                            └── getVisibleStructuresForChunk()
                                                                 ◀── READS structures.getStructures()
                                                                      BUT DATA NOT HYDRATED YET!
```

**The critical issue** is at `worldmap.tsx:3016`:

```typescript
this.refreshStructuresForChunks([chunkKey]);  // Fire-and-forget! No await!
```

This calls `getStructuresDataFromTorii` which triggers Torii queries, but:

1. The function is **not awaited**
2. The data arrives via **event callbacks** (`onTileUpdate`, `onStructureUpdate`)
3. By the time `updateManagersForChunk()` runs, the structure data hasn't been written to `structures` map yet

### 2.3 Why Click Fixes It

When you click on a hex:

```
Click Event
    │
    ▼
onStructureSelection()
    │
    ▼
state.updateEntityActionSelectedEntityId(selectedEntityId)
    │
    ▼
React re-render triggers hooks
    │
    ▼
Hooks call getStructuresDataFromTorii for selected entity
    │
    ▼
WorldUpdateListener callbacks fire
    │
    ▼
StructureManager.onUpdate() called with data
    │
    ▼
Structure now in structures map
    │
    ▼
Next render cycle shows it ✓
```

### 2.4 Secondary Issues Identified

#### Issue 1: Disabled Torii Stream Bounds

**Location**: `worldmap.tsx:3086-3096`

```typescript
// await this.toriiStreamManager.switchBounds({ ... });  ◀── COMMENTED OUT!
```

This was likely the original mechanism for bounded streaming.

#### Issue 2: Spatial Index Inconsistency

**Location**: `structure-manager.ts:1149-1178`

The `getVisibleStructuresForChunk` relies on `chunkToStructures` spatial index, but this index is only updated in `onUpdate()`, not during initial chunk load.

#### Issue 3: No Guaranteed Hydration Before Render

`performVisibleStructuresUpdate()` reads from `structures.getStructures()` but there's no mechanism to ensure data has arrived.

#### Issue 4: Event-Driven vs Pull-Driven Mismatch

The system uses `defineComponentSystem` (event-driven) but chunk loading is pull-driven (request → wait → render). These paradigms aren't synchronized.

---

## 3. Proposed Solution

### 3.1 Unified Chunk Lifecycle State Machine

Replace the current ad-hoc async flow with a deterministic state machine:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CHUNK LIFECYCLE STATE MACHINE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌────────────┐   │
│  │  IDLE    │───▶│ FETCHING  │───▶│ HYDRATING│───▶│  RENDERING │   │
│  │          │    │ DATA      │    │ MANAGERS │    │            │   │
│  └──────────┘    └───────────┘    └──────────┘    └─────┬──────┘   │
│       ▲                                                  │          │
│       │              ┌───────────┐                       │          │
│       └──────────────│  ACTIVE   │◀──────────────────────┘          │
│                      │           │                                   │
│                      └───────────┘                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Key Changes Overview

| Change | Risk | Impact |
|--------|------|--------|
| Await `refreshStructuresForChunks` | Low | Fixes the bug |
| Add timeout protection | Low | Prevents hangs |
| Add spatial index fallback | Medium | Ensures correctness |
| Re-enable Torii stream bounds | Medium | Better streaming |
| Full hydration state machine | Higher | Best long-term |

---

## 4. Implementation Plan

### Phase 1: Immediate Fix (Low Risk)

**Estimated effort**: 1-2 hours

1. **Await `refreshStructuresForChunks`** in `performChunkSwitch()` and `refreshCurrentChunk()`
2. Add `try/catch` around the await to prevent blocking on errors
3. Add timeout to prevent indefinite waits

### Phase 2: Robustness Improvements (Medium Risk)

**Estimated effort**: 4-6 hours

1. Add fallback to `getVisibleStructuresForChunk` to scan all structures
2. Add spatial index integrity checks
3. Add debug logging for hydration timing

### Phase 3: Full Refactor (Higher Risk, Better Long-Term)

**Estimated effort**: 2-3 days

1. Implement `ChunkHydrationState` machine
2. Add explicit hydration completion callbacks
3. Re-enable Torii stream bounds
4. Add chunk prefetching for smoother scrolling

---

## 5. Code Patches

### Patch 1: Immediate Fix for `performChunkSwitch`

**File**: `scenes/worldmap.tsx`
**Location**: Around line 3000-3020

#### Current Code (Problematic)

```typescript
private async performChunkSwitch(
  chunkKey: string,
  startCol: number,
  startRow: number,
  force: boolean,
  switchPosition?: Vector3,
) {
  // ...
  this.currentChunk = chunkKey;
  this.updateCurrentChunkBounds(startRow, startCol);
  this.refreshStructuresForChunks([chunkKey]);  // ❌ Fire-and-forget

  await this.updateToriiStreamBoundsForChunk(startRow, startCol);
  // ... rest
  await this.updateManagersForChunk(chunkKey, { force });
}
```

#### Fixed Code

```typescript
private async performChunkSwitch(
  chunkKey: string,
  startCol: number,
  startRow: number,
  force: boolean,
  switchPosition?: Vector3,
) {
  const memoryMonitor = (window as any).__gameRenderer?.memoryMonitor;
  const preChunkStats = memoryMonitor?.getCurrentStats(`chunk-switch-pre-${chunkKey}`);

  this.clearEntitySelection();

  this.currentChunk = chunkKey;
  this.updateCurrentChunkBounds(startRow, startCol);

  // ✅ FIX: Await structure refresh before proceeding
  await this.refreshStructuresForChunks([chunkKey]);

  await this.updateToriiStreamBoundsForChunk(startRow, startCol);

  if (force) {
    this.removeCachedMatricesForChunk(startRow, startCol);
  }

  const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);
  this.updatePinnedChunks(surroundingChunks);

  // ✅ Also await surrounding chunk fetches for smoother experience
  await Promise.all(surroundingChunks.map((chunk) => this.computeTileEntities(chunk)));

  await this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);

  const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
  this.interactiveHexManager.updateVisibleHexes(
    chunkCenterRow,
    chunkCenterCol,
    this.renderChunkSize.width,
    this.renderChunkSize.height,
  );

  await this.updateManagersForChunk(chunkKey, { force });

  // ... rest of method unchanged
}
```

### Patch 2: Update `refreshStructuresForChunks` to be Awaitable

**File**: `scenes/worldmap.tsx`
**Location**: Around line 2589-2627

#### Current Code

```typescript
private refreshStructuresForChunks(chunkKeys: string[]): void {
  // ... gathers structuresToSync ...

  void getStructuresDataFromTorii(toriiClient, contractComponents as any, structuresToSync).catch((error) => {
    console.error("[WorldmapScene] Failed to refresh structures for chunks", chunkKeys, error);
  });
}
```

#### Fixed Code

```typescript
private async refreshStructuresForChunks(chunkKeys: string[]): Promise<void> {
  const toriiClient = this.dojo.network?.toriiClient;
  const contractComponents = this.dojo.network?.contractComponents;

  if (!toriiClient || !contractComponents) {
    return;
  }

  const structuresToSync: { entityId: ID; position: HexPosition }[] = [];
  const seen = new Set<ID>();

  chunkKeys.forEach((chunkKey) => {
    const [startRow, startCol] = chunkKey.split(",").map(Number);
    const endRow = startRow + this.renderChunkSize.height - 1;
    const endCol = startCol + this.renderChunkSize.width - 1;

    this.structuresPositions.forEach((pos, entityId) => {
      if (seen.has(entityId)) {
        return;
      }
      if (pos.col >= startCol && pos.col <= endCol && pos.row >= startRow && pos.row <= endRow) {
        const contractCoords = new Position({ x: pos.col, y: pos.row }).getContract();
        structuresToSync.push({
          entityId,
          position: { col: contractCoords.x, row: contractCoords.y },
        });
        seen.add(entityId);
      }
    });
  });

  if (structuresToSync.length === 0) {
    return;
  }

  // ✅ FIX: Properly await with timeout
  try {
    await Promise.race([
      getStructuresDataFromTorii(toriiClient, contractComponents as any, structuresToSync),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Structure refresh timeout')), 5000)
      ),
    ]);
  } catch (error) {
    console.error("[WorldmapScene] Failed to refresh structures for chunks", chunkKeys, error);
    // Don't throw - allow chunk switch to continue with potentially stale data
  }
}
```

### Patch 3: Same Fix for `refreshCurrentChunk`

**File**: `scenes/worldmap.tsx`
**Location**: Around line 3099-3137

#### Current Code

```typescript
private async refreshCurrentChunk(chunkKey: string, startCol: number, startRow: number) {
  // ...
  this.updateCurrentChunkBounds(startRow, startCol);
  this.refreshStructuresForChunks([chunkKey]);  // ❌ Fire-and-forget

  const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);
  // ...
}
```

#### Fixed Code

```typescript
private async refreshCurrentChunk(chunkKey: string, startCol: number, startRow: number) {
  const memoryMonitor = (window as any).__gameRenderer?.memoryMonitor;
  const preChunkStats = memoryMonitor?.getCurrentStats(`chunk-refresh-pre-${chunkKey}`);

  this.updateCurrentChunkBounds(startRow, startCol);

  // ✅ FIX: Await structure refresh
  await this.refreshStructuresForChunks([chunkKey]);

  const surroundingChunks = this.getSurroundingChunkKeys(startRow, startCol);
  this.updatePinnedChunks(surroundingChunks);

  // ✅ Also await surrounding chunk fetches
  await Promise.all(surroundingChunks.map((chunk) => this.computeTileEntities(chunk)));

  await this.updateHexagonGrid(startRow, startCol, this.renderChunkSize.height, this.renderChunkSize.width);

  const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
  this.interactiveHexManager.updateVisibleHexes(
    chunkCenterRow,
    chunkCenterCol,
    this.renderChunkSize.width,
    this.renderChunkSize.height,
  );

  await this.updateManagersForChunk(chunkKey, { force: true });

  // ... rest unchanged
}
```

### Patch 4: Add Spatial Index Fallback (Phase 2)

**File**: `managers/structure-manager.ts`
**Location**: `getVisibleStructuresForChunk` method

```typescript
private getVisibleStructuresForChunk(startRow: number, startCol: number): StructureInfo[] {
  const visibleStructures: StructureInfo[] = [];
  const bounds = this.getChunkBounds(startRow, startCol);
  const seen = new Set<ID>();

  // 1. First try spatial index (fast path)
  const startBucketX = Math.floor(bounds.minCol / this.chunkStride);
  const endBucketX = Math.floor(bounds.maxCol / this.chunkStride);
  const startBucketY = Math.floor(bounds.minRow / this.chunkStride);
  const endBucketY = Math.floor(bounds.maxRow / this.chunkStride);

  for (let bx = startBucketX; bx <= endBucketX; bx++) {
    for (let by = startBucketY; by <= endBucketY; by++) {
      const key = `${bx},${by}`;
      const structureIds = this.chunkToStructures.get(key);
      if (structureIds) {
        for (const id of structureIds) {
          if (seen.has(id)) continue;
          const structure = this.structures.getStructureByEntityId(id);
          if (structure && this.isCoordInBounds(structure.hexCoords, bounds)) {
            visibleStructures.push(structure);
            seen.add(id);
          }
        }
      }
    }
  }

  // 2. Fallback: scan ALL structures if spatial index might be stale
  // (this runs rarely but ensures correctness)
  if (visibleStructures.length === 0) {
    this.structures.getStructures().forEach((typeMap) => {
      typeMap.forEach((structure, id) => {
        if (seen.has(id)) return;
        if (this.isCoordInBounds(structure.hexCoords, bounds)) {
          visibleStructures.push(structure);
          seen.add(id);
        }
      });
    });
  }

  return visibleStructures;
}

private isCoordInBounds(
  coord: { col: number; row: number },
  bounds: { minCol: number; maxCol: number; minRow: number; maxRow: number }
): boolean {
  return coord.col >= bounds.minCol && coord.col < bounds.maxCol &&
         coord.row >= bounds.minRow && coord.row < bounds.maxRow;
}
```

### Patch 5: Re-enable Torii Stream Bounds (Phase 2)

**File**: `scenes/worldmap.tsx:3086-3096`

```typescript
private async updateToriiStreamBoundsForChunk(startRow: number, startCol: number) {
  if (!this.toriiStreamManager) {
    return;
  }

  const { row: chunkCenterRow, col: chunkCenterCol } = this.getChunkCenter(startRow, startCol);
  const halfWidth = this.renderChunkSize.width / 2;
  const halfHeight = this.renderChunkSize.height / 2;

  const minCol = chunkCenterCol - halfWidth;
  const maxCol = chunkCenterCol + halfWidth;
  const minRow = chunkCenterRow - halfHeight;
  const maxRow = chunkCenterRow + halfHeight;

  const feltCenter = FELT_CENTER();

  try {
    // ✅ RE-ENABLE THIS
    await this.toriiStreamManager.switchBounds({
      minCol: minCol + feltCenter,
      maxCol: maxCol + feltCenter,
      minRow: minRow + feltCenter,
      maxRow: maxRow + feltCenter,
      padding: this.renderChunkSize.width,
      models: CHUNK_STREAM_MODELS,
    });
  } catch (error) {
    console.error("[WorldmapScene] Failed to update Torii stream bounds", error);
  }
}
```

### Patch 6: Hydration State Machine (Phase 3)

**New file**: `types/chunk-hydration.ts`

```typescript
export interface ChunkHydrationState {
  chunkKey: string;
  status: 'idle' | 'fetching' | 'hydrating' | 'ready' | 'error';
  structuresExpected: number;
  structuresHydrated: number;
  startTime: number;
  resolveHydration?: () => void;
  rejectHydration?: (error: Error) => void;
}

export interface ChunkHydrationManager {
  createHydrationPromise(chunkKey: string, expectedCount: number): Promise<void>;
  notifyStructureHydrated(entityId: ID, chunkKey: string): void;
  getState(chunkKey: string): ChunkHydrationState | undefined;
  cleanup(chunkKey: string): void;
}
```

**Add to WorldmapScene**:

```typescript
private chunkHydrationStates: Map<string, ChunkHydrationState> = new Map();

private createHydrationPromise(chunkKey: string, expectedStructureCount: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const state: ChunkHydrationState = {
      chunkKey,
      status: 'fetching',
      structuresExpected: expectedStructureCount,
      structuresHydrated: 0,
      startTime: Date.now(),
      resolveHydration: resolve,
      rejectHydration: reject,
    };
    this.chunkHydrationStates.set(chunkKey, state);

    // Timeout fallback (prevent indefinite hangs)
    setTimeout(() => {
      if (state.status !== 'ready') {
        console.warn(`[HYDRATION] Chunk ${chunkKey} hydration timeout after ${Date.now() - state.startTime}ms`);
        state.status = 'ready';
        resolve();
      }
    }, 5000);
  });
}

public notifyStructureHydrated(entityId: ID, chunkKey: string): void {
  const state = this.chunkHydrationStates.get(chunkKey);
  if (state && state.status === 'hydrating') {
    state.structuresHydrated++;
    if (state.structuresHydrated >= state.structuresExpected) {
      state.status = 'ready';
      state.resolveHydration?.();
    }
  }
}
```

---

## 6. Testing Recommendations

### 6.1 Manual Testing Checklist

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| **Scroll Test** | Rapidly scroll across multiple chunks | Structures appear immediately |
| **Zoom Test** | Zoom in/out while scrolling | No rendering glitches |
| **Click Test** | Click on structures | Selection works correctly |
| **Network Test** | Simulate slow network (DevTools) | Structures eventually appear (may be delayed) |
| **Boundary Test** | Scroll to chunk boundaries | Structures on edges render correctly |
| **Return Test** | Scroll away and back to same chunk | Structures still visible |

### 6.2 Debug Logging

Add these logs to trace the issue:

```typescript
// In performChunkSwitch
console.log(`[CHUNK] Starting switch to ${chunkKey}`);
console.log(`[CHUNK] Structure count before refresh: ${this.structureManager.getTotalStructures()}`);
await this.refreshStructuresForChunks([chunkKey]);
console.log(`[CHUNK] Structure count after refresh: ${this.structureManager.getTotalStructures()}`);

// In StructureManager.onUpdate
console.log(`[STRUCT] Hydrated structure ${entityId} at (${hexCoords.col}, ${hexCoords.row})`);

// In getVisibleStructuresForChunk
console.log(`[STRUCT] Found ${visibleStructures.length} visible structures for chunk`);
```

### 6.3 Automated Testing

```typescript
// Example test case
describe('Chunk Loading', () => {
  it('should render structures immediately after chunk switch', async () => {
    const scene = new WorldmapScene(/* ... */);

    // Simulate chunk switch
    await scene.updateVisibleChunks(true);

    // Verify structures are in the visible list
    const visibleStructures = scene.structureManager.getVisibleStructuresForChunk(0, 0);
    expect(visibleStructures.length).toBeGreaterThan(0);
  });
});
```

---

## 7. Performance Considerations

### 7.1 Current vs Fixed Behavior

| Aspect | Current | After Fix |
|--------|---------|-----------|
| Chunk switch speed | Fast (fire-and-forget) | Slightly slower (waits for data) |
| Structure visibility | Broken (requires click) | Correct (immediate) |
| Memory usage | Same | Same |
| Network requests | Same | Same |

### 7.2 Mitigation Strategies

1. **Chunk Prefetching**: Load adjacent chunks before user reaches them
   ```typescript
   private prefetchAdjacentChunks(currentChunkKey: string): void {
     const adjacent = this.getAdjacentChunkKeys(currentChunkKey);
     adjacent.forEach(key => this.computeTileEntities(key));  // Fire-and-forget for prefetch
   }
   ```

2. **Loading Indicator**: Show spinner during chunk switch
   ```typescript
   this.state.setLoading(LoadingStateKey.ChunkSwitch, true);
   await this.refreshStructuresForChunks([chunkKey]);
   this.state.setLoading(LoadingStateKey.ChunkSwitch, false);
   ```

3. **Optimistic Rendering**: Show placeholder, replace with real structure
   ```typescript
   // Add placeholder immediately
   this.structureManager.addPlaceholder(position);
   // Replace when data arrives
   this.structureManager.onUpdate(realData);
   ```

### 7.3 GPU/CPU Implications

- **GPU**: No change - same number of draw calls
- **CPU**: Slightly more work during chunk switch (await overhead)
- **Memory**: No change - same data structures

---

## 8. Conclusion

### Summary

The structure rendering bug is a classic **data/view synchronization issue** caused by fire-and-forget async calls. The core fix is straightforward: **await the data fetch before rendering**.

### Why Click-to-Fix Works

The click-to-fix behavior is a symptom, not a cause. It just happens to trigger a code path that synchronously fetches and renders the structure data.

### Recommended Approach

1. **Start with Patches 1-3** (the awaits)
2. **Test thoroughly** in all scenarios
3. **Consider Patches 4-6** based on remaining issues
4. **Monitor performance** and add prefetching if needed

### Risk Assessment

| Phase | Risk | Reward |
|-------|------|--------|
| Phase 1 (Awaits) | Low | High - fixes the bug |
| Phase 2 (Fallbacks) | Medium | Medium - adds robustness |
| Phase 3 (State Machine) | Higher | High - best long-term |

### Files to Modify

1. `scenes/worldmap.tsx` - Main chunk loading logic
2. `managers/structure-manager.ts` - Structure visibility
3. (Optional) New `types/chunk-hydration.ts` - State machine types

---

## Appendix: File References

| File | Key Methods | Line Numbers |
|------|-------------|--------------|
| `worldmap.tsx` | `performChunkSwitch` | ~3000-3067 |
| `worldmap.tsx` | `refreshStructuresForChunks` | ~2589-2627 |
| `worldmap.tsx` | `refreshCurrentChunk` | ~3099-3137 |
| `worldmap.tsx` | `updateToriiStreamBoundsForChunk` | ~3069-3097 |
| `structure-manager.ts` | `getVisibleStructuresForChunk` | ~1149-1178 |
| `structure-manager.ts` | `onUpdate` | ~563-800 |
| `structure-manager.ts` | `updateChunk` | ~816-860 |
| `world-update-listener.ts` | `Structure.onTileUpdate` | ~414-516 |
