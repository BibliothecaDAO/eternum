# Chunk System Full Refactor Specification

## Executive Summary

This document outlines a complete refactor of the chunk-loading system to solve the structure rendering bug and establish a robust, deterministic, and performant chunk lifecycle. The refactor introduces a **Chunk Lifecycle Controller** that orchestrates all data fetching and rendering through explicit state transitions.

---

## Table of Contents

1. [Current Problems](#1-current-problems)
2. [Refactor Goals](#2-refactor-goals)
3. [Architecture Overview](#3-architecture-overview)
4. [Detailed Design](#4-detailed-design)
5. [New Interfaces & Types](#5-new-interfaces--types)
6. [Implementation Steps](#6-implementation-steps)
7. [Migration Strategy](#7-migration-strategy)
8. [Code Examples](#8-code-examples)
9. [Performance Considerations](#9-performance-considerations)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Current Problems

### 1.1 Root Cause: Fire-and-Forget Data Fetching

```typescript
// worldmap.tsx:3016 - THE BUG
this.refreshStructuresForChunks([chunkKey]);  // Not awaited!
```

### 1.2 Systemic Issues

| Problem | Impact | Location |
|---------|--------|----------|
| **Fire-and-forget fetches** | Structures don't render | `performChunkSwitch()` |
| **No hydration guarantee** | Race conditions | All managers |
| **Event-driven chaos** | Unpredictable timing | `WorldUpdateListener` callbacks |
| **Scattered state** | Hard to debug | Multiple maps across managers |
| **No chunk lifecycle** | No clear phases | `WorldmapScene` |
| **Duplicate spatial indexes** | Memory waste | Each manager has its own |
| **No prefetching** | Jarring scroll experience | Missing entirely |

### 1.3 Current Data Flow (Broken)

```
Camera Move → updateVisibleChunks() → performChunkSwitch()
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
          refreshStructures()      updateHexagonGrid()     updateManagers()
          (fire-and-forget)        (awaited)               (awaited)
                    │                       │                       │
                    │                       ▼                       ▼
                    │               Biomes render           Managers try to render
                    │                                       BUT NO DATA YET!
                    │
                    └─────────▶ Event callbacks fire LATER
                                        │
                                        ▼
                               Data finally arrives
                               (structures still invisible)
```

---

## 2. Refactor Goals

### 2.1 Primary Goals

1. **Deterministic chunk lifecycle** - Clear phases with explicit transitions
2. **Guaranteed data hydration** - No rendering until data is ready
3. **Single source of truth** - Unified chunk state management
4. **Predictable performance** - Known timing characteristics

### 2.2 Secondary Goals

1. **Prefetching** - Load adjacent chunks before user reaches them
2. **Graceful degradation** - Handle network failures elegantly
3. **Memory efficiency** - Shared spatial indexes, smart caching
4. **Debug visibility** - Clear logging and state inspection

---

## 3. Architecture Overview

### 3.1 New Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CHUNK LIFECYCLE CONTROLLER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         ChunkStateManager                              │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  │
│  │  │  IDLE   │─▶│PREFETCH │─▶│ FETCH   │─▶│ HYDRATE │─▶│ RENDER  │    │  │
│  │  │         │  │         │  │         │  │         │  │         │    │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │  │
│  │       │                                                    │         │  │
│  │       │              ┌───────────────┐                     │         │  │
│  │       └─────────────▶│    ACTIVE     │◀────────────────────┘         │  │
│  │                      │               │                               │  │
│  │                      └───────┬───────┘                               │  │
│  │                              │                                       │  │
│  │                              ▼                                       │  │
│  │                      ┌───────────────┐                               │  │
│  │                      │   UNLOADING   │─────▶ IDLE                    │  │
│  │                      │               │                               │  │
│  │                      └───────────────┘                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         DataFetchCoordinator                           │  │
│  │  • Batches Torii requests                                              │  │
│  │  • Tracks pending fetches                                              │  │
│  │  • Returns Promises that resolve when data is hydrated                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         EntityHydrationRegistry                        │  │
│  │  • Tracks expected vs received entities per chunk                      │  │
│  │  • Resolves hydration promises when all entities received              │  │
│  │  • Handles timeouts and partial hydration                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         UnifiedSpatialIndex                            │  │
│  │  • Single spatial index for ALL entity types                           │  │
│  │  • O(1) chunk-to-entities lookup                                       │  │
│  │  • Shared across all managers                                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         ManagerOrchestrator                            │  │
│  │  • Coordinates all entity managers                                     │  │
│  │  • Ensures render order                                                │  │
│  │  • Handles manager dependencies                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 New Data Flow (Fixed)

```
Camera Move → ChunkLifecycleController.onCameraMove()
                        │
                        ▼
              ChunkStateManager.requestChunk(chunkKey)
                        │
                        ▼
              ┌─────────────────────────────────────┐
              │   PREFETCH (optional, for adjacent) │
              │   DataFetchCoordinator.prefetch()   │
              └─────────────┬───────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────────────┐
              │              FETCH                   │
              │   DataFetchCoordinator.fetchChunk() │
              │   Returns Promise<ChunkData>        │
              └─────────────┬───────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────────────┐
              │             HYDRATE                  │
              │   EntityHydrationRegistry.await()   │
              │   Waits for WorldUpdateListener     │
              │   callbacks to populate managers    │
              └─────────────┬───────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────────────┐
              │             RENDER                   │
              │   ManagerOrchestrator.render()      │
              │   All managers render in order      │
              └─────────────┬───────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────────────┐
              │             ACTIVE                   │
              │   Chunk is now visible and ready    │
              │   Live updates flow through         │
              └─────────────────────────────────────┘
```

---

## 4. Detailed Design

### 4.1 ChunkStateManager

The central orchestrator for all chunk state transitions.

```typescript
class ChunkStateManager {
  private chunks: Map<string, ChunkState> = new Map();
  private activeChunk: string | null = null;
  private prefetchQueue: string[] = [];

  // State transition methods
  async transitionTo(chunkKey: string, targetState: ChunkLifecyclePhase): Promise<void>;

  // Query methods
  getState(chunkKey: string): ChunkState | undefined;
  isReady(chunkKey: string): boolean;
  getActiveChunk(): string | null;

  // Lifecycle methods
  async activateChunk(chunkKey: string): Promise<void>;
  async deactivateChunk(chunkKey: string): Promise<void>;
  async prefetchChunks(chunkKeys: string[]): Promise<void>;
}
```

### 4.2 DataFetchCoordinator

Coordinates all data fetching with batching and deduplication.

```typescript
class DataFetchCoordinator {
  private pendingFetches: Map<string, Promise<ChunkData>> = new Map();
  private batchQueue: Map<string, { entities: EntityRequest[], resolve: () => void }> = new Map();
  private batchTimeout: number | null = null;

  // Fetch methods
  async fetchChunk(chunkKey: string, bounds: ChunkBounds): Promise<ChunkData>;
  async prefetchChunk(chunkKey: string, bounds: ChunkBounds): Promise<void>;

  // Batching
  private scheduleBatch(): void;
  private executeBatch(): Promise<void>;

  // Deduplication
  private getOrCreateFetch(chunkKey: string, fetchFn: () => Promise<ChunkData>): Promise<ChunkData>;
}
```

### 4.3 EntityHydrationRegistry

Tracks entity hydration to know when a chunk is fully loaded.

```typescript
class EntityHydrationRegistry {
  private chunkExpectations: Map<string, ChunkExpectation> = new Map();
  private entityToChunk: Map<ID, string> = new Map();

  // Registration
  expectEntities(chunkKey: string, entityType: EntityType, count: number): void;
  expectEntity(chunkKey: string, entityId: ID, entityType: EntityType): void;

  // Notification (called by managers when they receive data)
  notifyEntityHydrated(entityId: ID, entityType: EntityType): void;
  notifyEntityRemoved(entityId: ID): void;

  // Waiting
  async waitForHydration(chunkKey: string, timeoutMs?: number): Promise<HydrationResult>;
  isFullyHydrated(chunkKey: string): boolean;
  getHydrationProgress(chunkKey: string): HydrationProgress;
}
```

### 4.4 UnifiedSpatialIndex

Single spatial index for all entity types.

```typescript
class UnifiedSpatialIndex {
  private buckets: Map<string, Map<EntityType, Set<ID>>> = new Map();
  private entityPositions: Map<ID, { col: number; row: number; type: EntityType }> = new Map();
  private bucketSize: number;

  // Indexing
  addEntity(entityId: ID, type: EntityType, col: number, row: number): void;
  updateEntity(entityId: ID, col: number, row: number): void;
  removeEntity(entityId: ID): void;

  // Queries
  getEntitiesInBounds(bounds: ChunkBounds, type?: EntityType): ID[];
  getEntitiesInChunk(chunkKey: string, type?: EntityType): ID[];
  getEntityPosition(entityId: ID): { col: number; row: number } | undefined;

  // Bulk operations
  clear(): void;
  getStats(): SpatialIndexStats;
}
```

### 4.5 ManagerOrchestrator

Coordinates all entity managers with defined render order.

```typescript
class ManagerOrchestrator {
  private managers: Map<EntityType, EntityManager> = new Map();
  private renderOrder: EntityType[] = [
    EntityType.Biome,      // First: terrain
    EntityType.Structure,  // Second: buildings
    EntityType.Army,       // Third: units
    EntityType.Quest,      // Fourth: quests
    EntityType.Chest,      // Fifth: chests
  ];

  // Registration
  registerManager(type: EntityType, manager: EntityManager): void;

  // Chunk operations
  async prepareChunk(chunkKey: string, bounds: ChunkBounds): Promise<void>;
  async renderChunk(chunkKey: string): Promise<void>;
  async unloadChunk(chunkKey: string): Promise<void>;

  // Update loop
  update(deltaTime: number): void;
}
```

### 4.6 Updated Manager Interface

All managers must implement this interface:

```typescript
interface EntityManager {
  readonly entityType: EntityType;

  // Lifecycle
  prepareForChunk(chunkKey: string, bounds: ChunkBounds): Promise<void>;
  renderChunk(chunkKey: string): Promise<void>;
  unloadChunk(chunkKey: string): Promise<void>;

  // Data hydration
  onEntityHydrated(entityId: ID, data: unknown): void;
  onEntityRemoved(entityId: ID): void;

  // Queries
  getEntitiesInChunk(chunkKey: string): ID[];
  hasEntity(entityId: ID): boolean;

  // Update
  update(deltaTime: number): void;

  // Cleanup
  destroy(): void;
}
```

---

## 5. New Interfaces & Types

### 5.1 Core Types

```typescript
// Chunk lifecycle phases
enum ChunkLifecyclePhase {
  IDLE = 'idle',
  PREFETCHING = 'prefetching',
  FETCHING = 'fetching',
  HYDRATING = 'hydrating',
  RENDERING = 'rendering',
  ACTIVE = 'active',
  UNLOADING = 'unloading',
  ERROR = 'error',
}

// Entity types
enum EntityType {
  Biome = 'biome',
  Structure = 'structure',
  Army = 'army',
  Quest = 'quest',
  Chest = 'chest',
}

// Chunk state
interface ChunkState {
  chunkKey: string;
  phase: ChunkLifecyclePhase;
  bounds: ChunkBounds;
  startTime: number;
  lastTransition: number;
  error?: Error;

  // Hydration tracking
  expectedEntities: Map<EntityType, number>;
  hydratedEntities: Map<EntityType, Set<ID>>;

  // Rendering
  isRendered: boolean;
  renderTime?: number;
}

// Chunk bounds
interface ChunkBounds {
  minCol: number;
  maxCol: number;
  minRow: number;
  maxRow: number;
}

// Chunk data (returned from fetch)
interface ChunkData {
  chunkKey: string;
  tiles: TileData[];
  structures: StructureData[];
  armies: ArmyData[];
  quests: QuestData[];
  chests: ChestData[];
  fetchTime: number;
}

// Hydration result
interface HydrationResult {
  success: boolean;
  timedOut: boolean;
  progress: HydrationProgress;
  duration: number;
}

interface HydrationProgress {
  total: number;
  hydrated: number;
  percentage: number;
  byType: Map<EntityType, { expected: number; received: number }>;
}

// Spatial index stats
interface SpatialIndexStats {
  totalEntities: number;
  bucketCount: number;
  avgEntitiesPerBucket: number;
  byType: Map<EntityType, number>;
}
```

### 5.2 Event Types

```typescript
// Events emitted by ChunkLifecycleController
interface ChunkLifecycleEvents {
  'chunk:phase-change': { chunkKey: string; from: ChunkLifecyclePhase; to: ChunkLifecyclePhase };
  'chunk:activated': { chunkKey: string; duration: number };
  'chunk:deactivated': { chunkKey: string };
  'chunk:error': { chunkKey: string; error: Error; phase: ChunkLifecyclePhase };
  'chunk:hydration-progress': { chunkKey: string; progress: HydrationProgress };
  'prefetch:started': { chunkKeys: string[] };
  'prefetch:completed': { chunkKeys: string[]; duration: number };
}
```

---

## 6. Implementation Steps

### Phase 1: Foundation (Week 1)

#### Step 1.1: Create Core Types
- [ ] Create `types/chunk-lifecycle.ts` with all type definitions
- [ ] Create `types/entity-manager.ts` with manager interface

#### Step 1.2: Implement UnifiedSpatialIndex
- [ ] Create `utils/unified-spatial-index.ts`
- [ ] Implement bucket-based spatial hashing
- [ ] Add comprehensive tests

#### Step 1.3: Implement EntityHydrationRegistry
- [ ] Create `utils/entity-hydration-registry.ts`
- [ ] Implement expectation tracking
- [ ] Implement promise-based waiting
- [ ] Add timeout handling

### Phase 2: Data Coordination (Week 1-2)

#### Step 2.1: Implement DataFetchCoordinator
- [ ] Create `utils/data-fetch-coordinator.ts`
- [ ] Implement batching logic
- [ ] Implement deduplication
- [ ] Connect to existing Torii fetch functions

#### Step 2.2: Update WorldUpdateListener Integration
- [ ] Add hydration notification hooks
- [ ] Ensure callbacks notify EntityHydrationRegistry
- [ ] Add entity type tagging to updates

### Phase 3: State Management (Week 2)

#### Step 3.1: Implement ChunkStateManager
- [ ] Create `utils/chunk-state-manager.ts`
- [ ] Implement state machine
- [ ] Implement transition validation
- [ ] Add event emission

#### Step 3.2: Implement ManagerOrchestrator
- [ ] Create `utils/manager-orchestrator.ts`
- [ ] Define render order
- [ ] Implement coordination logic

### Phase 4: Manager Refactoring (Week 2-3)

#### Step 4.1: Refactor StructureManager
- [ ] Implement `EntityManager` interface
- [ ] Remove internal spatial index (use UnifiedSpatialIndex)
- [ ] Add hydration notifications
- [ ] Update chunk methods

#### Step 4.2: Refactor ArmyManager
- [ ] Implement `EntityManager` interface
- [ ] Remove internal spatial index
- [ ] Add hydration notifications
- [ ] Update chunk methods

#### Step 4.3: Refactor Other Managers
- [ ] QuestManager
- [ ] ChestManager
- [ ] BiomeModels (as pseudo-manager)

### Phase 5: Controller Integration (Week 3)

#### Step 5.1: Create ChunkLifecycleController
- [ ] Create `chunk-lifecycle-controller.ts`
- [ ] Wire all components together
- [ ] Implement camera tracking

#### Step 5.2: Update WorldmapScene
- [ ] Replace ad-hoc chunk logic with controller
- [ ] Remove scattered state
- [ ] Update event listeners

### Phase 6: Prefetching & Polish (Week 3-4)

#### Step 6.1: Implement Prefetching
- [ ] Add prefetch queue to ChunkStateManager
- [ ] Implement predictive prefetching based on camera velocity
- [ ] Add prefetch priority

#### Step 6.2: Error Handling & Fallbacks
- [ ] Implement graceful degradation
- [ ] Add retry logic
- [ ] Add user feedback for slow loads

#### Step 6.3: Performance Optimization
- [ ] Profile and optimize hot paths
- [ ] Add performance metrics
- [ ] Tune batch sizes and timeouts

---

## 7. Migration Strategy

### 7.1 Parallel Implementation

Run old and new systems in parallel during development:

```typescript
class WorldmapScene {
  private legacyChunkSystem: LegacyChunkSystem; // Old code
  private chunkController: ChunkLifecycleController; // New code
  private useNewSystem = false; // Feature flag

  async updateVisibleChunks(force: boolean) {
    if (this.useNewSystem) {
      return this.chunkController.onCameraMove();
    } else {
      return this.legacyUpdateVisibleChunks(force);
    }
  }
}
```

### 7.2 Feature Flags

```typescript
// In env or config
const CHUNK_SYSTEM_FLAGS = {
  USE_NEW_LIFECYCLE: false,      // Master switch
  USE_UNIFIED_SPATIAL_INDEX: false,
  USE_HYDRATION_TRACKING: false,
  ENABLE_PREFETCHING: false,
  DEBUG_CHUNK_TRANSITIONS: true,
};
```

### 7.3 Incremental Rollout

1. **Alpha**: Enable for dev environment only
2. **Beta**: Enable for 10% of users via feature flag
3. **GA**: Enable for all users, remove old code

---

## 8. Code Examples

### 8.1 ChunkLifecycleController Usage

```typescript
// In WorldmapScene constructor
this.chunkController = new ChunkLifecycleController({
  spatialIndex: this.spatialIndex,
  hydrationRegistry: this.hydrationRegistry,
  fetchCoordinator: this.fetchCoordinator,
  stateManager: this.stateManager,
  orchestrator: this.orchestrator,
  chunkSize: this.chunkSize,
  renderChunkSize: this.renderChunkSize,
});

// Subscribe to events
this.chunkController.on('chunk:activated', ({ chunkKey, duration }) => {
  console.log(`Chunk ${chunkKey} activated in ${duration}ms`);
});

this.chunkController.on('chunk:error', ({ chunkKey, error, phase }) => {
  console.error(`Chunk ${chunkKey} failed in ${phase}:`, error);
  // Show user feedback
});

// In camera change handler
this.controls.addEventListener('change', () => {
  this.chunkController.onCameraMove(this.getCameraPosition());
});
```

### 8.2 Manager Implementation

```typescript
class StructureManager implements EntityManager {
  readonly entityType = EntityType.Structure;

  private structures: Map<ID, StructureInfo> = new Map();
  private chunkStructures: Map<string, Set<ID>> = new Map();

  constructor(
    private scene: Scene,
    private spatialIndex: UnifiedSpatialIndex,
    private hydrationRegistry: EntityHydrationRegistry,
  ) {}

  async prepareForChunk(chunkKey: string, bounds: ChunkBounds): Promise<void> {
    // Pre-allocate instance buffer space if needed
    const existingIds = this.spatialIndex.getEntitiesInChunk(chunkKey, EntityType.Structure);
    this.ensureCapacity(existingIds.length + 50); // Buffer for new structures
  }

  async renderChunk(chunkKey: string): Promise<void> {
    const structureIds = this.chunkStructures.get(chunkKey) || new Set();

    this.clearInstancedMeshes();

    for (const id of structureIds) {
      const structure = this.structures.get(id);
      if (structure) {
        this.renderStructure(structure);
      }
    }

    this.updateInstancedMeshes();
  }

  onEntityHydrated(entityId: ID, data: StructureData): void {
    const structure = this.dataToStructureInfo(data);
    this.structures.set(entityId, structure);

    // Update chunk mapping
    const chunkKey = this.getChunkKeyForPosition(structure.hexCoords);
    if (!this.chunkStructures.has(chunkKey)) {
      this.chunkStructures.set(chunkKey, new Set());
    }
    this.chunkStructures.get(chunkKey)!.add(entityId);

    // Update spatial index
    this.spatialIndex.addEntity(entityId, EntityType.Structure, structure.hexCoords.col, structure.hexCoords.row);

    // Notify hydration registry
    this.hydrationRegistry.notifyEntityHydrated(entityId, EntityType.Structure);
  }

  // ... rest of implementation
}
```

### 8.3 Hydration Waiting

```typescript
// In ChunkLifecycleController
async activateChunk(chunkKey: string): Promise<void> {
  const state = this.stateManager.getState(chunkKey);
  if (!state) {
    throw new Error(`Unknown chunk: ${chunkKey}`);
  }

  // Transition to FETCHING
  await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.FETCHING);

  // Fetch data from Torii
  const chunkData = await this.fetchCoordinator.fetchChunk(chunkKey, state.bounds);

  // Register expected entities
  this.hydrationRegistry.expectEntities(chunkKey, EntityType.Structure, chunkData.structures.length);
  this.hydrationRegistry.expectEntities(chunkKey, EntityType.Army, chunkData.armies.length);
  // ... etc

  // Transition to HYDRATING
  await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.HYDRATING);

  // Wait for hydration (data flows through WorldUpdateListener → managers → registry)
  const hydrationResult = await this.hydrationRegistry.waitForHydration(chunkKey, 5000);

  if (!hydrationResult.success) {
    console.warn(`Chunk ${chunkKey} hydration incomplete:`, hydrationResult.progress);
    // Continue anyway with partial data
  }

  // Transition to RENDERING
  await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.RENDERING);

  // Render all managers in order
  await this.orchestrator.renderChunk(chunkKey);

  // Transition to ACTIVE
  await this.stateManager.transitionTo(chunkKey, ChunkLifecyclePhase.ACTIVE);
}
```

### 8.4 Prefetching

```typescript
// Predictive prefetching based on camera velocity
class PrefetchPredictor {
  private lastPosition: Vector3 = new Vector3();
  private velocity: Vector3 = new Vector3();
  private lastTime: number = 0;

  update(currentPosition: Vector3, currentTime: number): string[] {
    if (this.lastTime === 0) {
      this.lastPosition.copy(currentPosition);
      this.lastTime = currentTime;
      return [];
    }

    const dt = currentTime - this.lastTime;
    this.velocity.subVectors(currentPosition, this.lastPosition).divideScalar(dt);

    this.lastPosition.copy(currentPosition);
    this.lastTime = currentTime;

    // Predict position in 500ms
    const predictedPosition = currentPosition.clone().add(this.velocity.clone().multiplyScalar(0.5));

    // Get chunks in predicted direction
    const currentChunks = this.getChunksForPosition(currentPosition);
    const predictedChunks = this.getChunksForPosition(predictedPosition);

    // Return chunks that are in predicted path but not current
    return predictedChunks.filter(c => !currentChunks.includes(c));
  }
}
```

---

## 9. Performance Considerations

### 9.1 Timing Budgets

| Operation | Target | Max |
|-----------|--------|-----|
| Chunk fetch (network) | 200ms | 2000ms |
| Hydration wait | 100ms | 5000ms |
| Render (all managers) | 16ms | 50ms |
| Total chunk switch | 400ms | 3000ms |

### 9.2 Memory Budgets

| Resource | Target | Max |
|----------|--------|-----|
| Spatial index | 1MB | 5MB |
| Chunk state cache | 500KB | 2MB |
| Prefetch queue | 3 chunks | 9 chunks |
| Cached matrices | 16 chunks | 32 chunks |

### 9.3 Optimization Strategies

1. **Batch Torii requests**: Group multiple entity fetches into single request
2. **Lazy rendering**: Only render entities in frustum
3. **Instance pooling**: Reuse instanced mesh slots
4. **Progressive hydration**: Render partial data, update as more arrives
5. **Chunk LOD**: Lower detail for distant chunks

---

## 10. Testing Strategy

### 10.1 Unit Tests

```typescript
describe('ChunkStateManager', () => {
  it('should transition through lifecycle phases in order', async () => {
    const manager = new ChunkStateManager();
    const chunkKey = '0,0';

    await manager.transitionTo(chunkKey, ChunkLifecyclePhase.FETCHING);
    expect(manager.getState(chunkKey)?.phase).toBe(ChunkLifecyclePhase.FETCHING);

    await manager.transitionTo(chunkKey, ChunkLifecyclePhase.HYDRATING);
    expect(manager.getState(chunkKey)?.phase).toBe(ChunkLifecyclePhase.HYDRATING);

    // ... etc
  });

  it('should reject invalid transitions', async () => {
    const manager = new ChunkStateManager();
    const chunkKey = '0,0';

    // Can't go from IDLE to RENDERING directly
    await expect(
      manager.transitionTo(chunkKey, ChunkLifecyclePhase.RENDERING)
    ).rejects.toThrow();
  });
});

describe('EntityHydrationRegistry', () => {
  it('should resolve when all expected entities are hydrated', async () => {
    const registry = new EntityHydrationRegistry();
    const chunkKey = '0,0';

    registry.expectEntities(chunkKey, EntityType.Structure, 2);

    const hydrationPromise = registry.waitForHydration(chunkKey);

    registry.notifyEntityHydrated(1, EntityType.Structure);
    registry.notifyEntityHydrated(2, EntityType.Structure);

    const result = await hydrationPromise;
    expect(result.success).toBe(true);
  });

  it('should timeout if entities never arrive', async () => {
    const registry = new EntityHydrationRegistry();
    const chunkKey = '0,0';

    registry.expectEntities(chunkKey, EntityType.Structure, 2);

    const result = await registry.waitForHydration(chunkKey, 100);

    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
  });
});
```

### 10.2 Integration Tests

```typescript
describe('ChunkLifecycleController', () => {
  it('should fully activate a chunk with structures', async () => {
    const controller = createTestController();

    // Mock Torii response
    mockToriiResponse('0,0', {
      structures: [mockStructure(1), mockStructure(2)],
      armies: [],
    });

    await controller.activateChunk('0,0');

    expect(controller.isChunkActive('0,0')).toBe(true);
    expect(controller.getRenderedStructureCount('0,0')).toBe(2);
  });

  it('should handle chunk transitions during scroll', async () => {
    const controller = createTestController();

    // Simulate scroll
    await controller.onCameraMove({ x: 0, z: 0 });
    await controller.onCameraMove({ x: 100, z: 0 });
    await controller.onCameraMove({ x: 200, z: 0 });

    // Should have one active chunk and prefetched neighbors
    expect(controller.getActiveChunks().length).toBe(1);
    expect(controller.getPrefetchedChunks().length).toBeGreaterThan(0);
  });
});
```

### 10.3 E2E Tests

```typescript
describe('WorldMap Chunk Loading', () => {
  it('should show structures immediately when scrolling', async () => {
    await loadWorldMap();

    // Get initial structure count
    const initialCount = await getVisibleStructureCount();

    // Scroll to new area with known structures
    await scrollTo(100, 100);

    // Wait for chunk to load
    await waitForChunkActive('3,3');

    // Structures should be visible
    const newCount = await getVisibleStructureCount();
    expect(newCount).toBeGreaterThan(0);
  });

  it('should not require click to see structures', async () => {
    await loadWorldMap();
    await scrollTo(100, 100);
    await waitForChunkActive('3,3');

    // Get structure at known position WITHOUT clicking
    const structure = await getStructureAtPosition(105, 105);
    expect(structure).toBeDefined();
    expect(structure.isVisible).toBe(true);
  });
});
```

---

## 11. File Structure

```
src/three/
├── chunk-system/
│   ├── index.ts                           # Re-exports
│   ├── chunk-lifecycle-controller.ts      # Main controller
│   ├── chunk-state-manager.ts             # State machine
│   ├── data-fetch-coordinator.ts          # Torii coordination
│   ├── entity-hydration-registry.ts       # Hydration tracking
│   ├── manager-orchestrator.ts            # Manager coordination
│   ├── prefetch-predictor.ts              # Predictive prefetching
│   └── types.ts                           # All chunk system types
├── utils/
│   └── unified-spatial-index.ts           # Shared spatial index
├── managers/
│   ├── entity-manager.interface.ts        # Base interface
│   ├── army-manager.ts                    # Updated
│   ├── structure-manager.ts               # Updated
│   ├── quest-manager.ts                   # Updated
│   └── chest-manager.ts                   # Updated
└── scenes/
    └── worldmap.tsx                       # Updated to use controller
```

---

## 12. Summary

This refactor transforms the chunk-loading system from an ad-hoc collection of fire-and-forget async calls into a **deterministic state machine** with:

1. **Clear lifecycle phases**: IDLE → FETCH → HYDRATE → RENDER → ACTIVE
2. **Guaranteed data availability**: Rendering only happens after hydration completes
3. **Single source of truth**: All state in ChunkStateManager
4. **Unified spatial indexing**: One index for all entity types
5. **Predictive prefetching**: Smoother scroll experience
6. **Testable architecture**: Clear interfaces, mockable components

The key insight is that the bug isn't just a missing `await` - it's a symptom of a system that lacks explicit lifecycle management. This refactor addresses the root cause while also improving maintainability, performance, and user experience.
