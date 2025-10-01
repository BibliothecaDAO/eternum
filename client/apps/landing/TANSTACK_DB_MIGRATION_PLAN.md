# TanStack DB Migration Plan: Eternum Client Performance Optimization

## Executive Summary

This document outlines a comprehensive strategy to migrate the Eternum blockchain gaming client from its current architecture to TanStack DB, achieving significant performance improvements through reactive collections, live queries, and optimistic mutations.

---

## Current Architecture Analysis

### Core Issues Identified

#### 1. **WorldUpdateListener Anti-Patterns** (`world-update-listener.ts:1-1294`)

**Problems:**
- **Sequential update bottleneck**: `processSequentialUpdate()` (lines 1233-1281) creates artificial serialization of parallel blockchain events
- **Race condition management overhead**: Map-based sequence tracking (`updateSequenceMap`, `pendingUpdates`) adds complexity without addressing root cause
- **Async waterfall chains**: Each update waits for MapDataStore queries, creating cascading delays
- **No incremental updates**: Full entity reconstruction on every change

**Impact:**
- Delayed UI updates during high-frequency blockchain events (battles, movements)
- Memory overhead from promise tracking and sequence maps
- Potential for dropped updates during rapid state changes

#### 2. **MapDataStore Inefficiencies** (`map-data-store.ts:1-641`)

**Problems:**
- **Singleton polling architecture**: 5-minute refresh interval (line 36) causes stale data windows
- **All-or-nothing fetches**: `fetchAllStructuresMapData()` and `fetchAllArmiesMapData()` (lines 350-354) load entire world state
- **Manual cache invalidation**: `_checkRefresh()` (lines 469-477) scattered throughout getters
- **No granular subscriptions**: Components can't subscribe to specific entities
- **Callback hell**: `refreshCallbacks` array (line 121) for manual change propagation

**Impact:**
- Poor scalability as world size grows (all structures + armies loaded on every refresh)
- Wasted bandwidth fetching unchanged data
- Stale data between refresh intervals
- No reactive updates - components must poll

#### 3. **DataEnhancer Layer Redundancy** (`data-enhancer.ts:1-220`)

**Problems:**
- **Wrapper around wrapper**: Adds abstraction layer without solving fundamental issues
- **Async data enrichment**: Every component update triggers additional async lookups
- **Duplicate data transformation**: Same parsing logic scattered across multiple methods

**Impact:**
- Additional latency on every entity update
- Harder to reason about data flow
- Maintenance burden from duplicated logic

#### 4. **Hook Patterns**

**Current State:**
- `use-data.tsx`: Good use of TanStack Query for simple REST endpoints
- `use-lords.tsx`: Uses `@starknet-react/core`'s `useCall` with 1-second polling (anti-pattern)
- No centralized query invalidation or cross-component state synchronization

---

## TanStack DB Architecture Design

### Core Principles

1. **Collections as Single Source of Truth**: Replace MapDataStore with reactive collections
2. **Live Queries for Derived State**: Replace manual data enrichment with declarative queries
3. **Optimistic Mutations**: Instant UI updates with automatic rollback on failure
4. **Differential Dataflow**: Incremental updates instead of full rebuilds

### Proposed Collection Schema

```typescript
// packages/core/src/collections/index.ts

import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { z } from 'zod'

// === SCHEMAS ===

const StructureSchema = z.object({
  entity_id: z.number(),
  coord_x: z.number(),
  coord_y: z.number(),
  structure_type: z.number(),
  level: z.number(),
  owner_address: z.string(),
  owner_name: z.string(),
  realm_id: z.number().optional(),
  // Guard armies (denormalized for performance)
  alpha_category: z.string().nullable(),
  alpha_tier: z.number(),
  alpha_count: z.string(),
  alpha_stamina_amount: z.string(),
  alpha_battle_cooldown_end: z.number(),
  bravo_category: z.string().nullable(),
  bravo_tier: z.number(),
  bravo_count: z.string(),
  bravo_stamina_amount: z.string(),
  bravo_battle_cooldown_end: z.number(),
  charlie_category: z.string().nullable(),
  charlie_tier: z.number(),
  charlie_count: z.string(),
  charlie_stamina_amount: z.string(),
  charlie_battle_cooldown_end: z.number(),
  delta_category: z.string().nullable(),
  delta_tier: z.number(),
  delta_count: z.string(),
  delta_stamina_amount: z.string(),
  delta_battle_cooldown_end: z.number(),
  // Production buildings
  packed_counts_1: z.string().nullable(),
  packed_counts_2: z.string().nullable(),
  packed_counts_3: z.string().nullable(),
  // Battle data
  latest_attacker_id: z.number().nullable(),
  latest_attack_timestamp: z.string().nullable(),
  latest_attacker_coord_x: z.number().nullable(),
  latest_attacker_coord_y: z.number().nullable(),
  latest_defender_id: z.number().nullable(),
  latest_defense_timestamp: z.string().nullable(),
  latest_defender_coord_x: z.number().nullable(),
  latest_defender_coord_y: z.number().nullable(),
})

const ArmySchema = z.object({
  entity_id: z.number(),
  coord_x: z.number(),
  coord_y: z.number(),
  owner_structure_id: z.number().nullable(),
  category: z.string().nullable(),
  tier: z.number(),
  count: z.string(),
  stamina_amount: z.string(),
  stamina_updated_tick: z.string(),
  owner_address: z.string(),
  owner_name: z.string(),
  battle_cooldown_end: z.number(),
  latest_attacker_id: z.number().nullable(),
  latest_attack_timestamp: z.string().nullable(),
  latest_attacker_coord_x: z.number().nullable(),
  latest_attacker_coord_y: z.number().nullable(),
  latest_defender_id: z.number().nullable(),
  latest_defense_timestamp: z.string().nullable(),
  latest_defender_coord_x: z.number().nullable(),
  latest_defender_coord_y: z.number().nullable(),
})

const TileSchema = z.object({
  col: z.number(),
  row: z.number(),
  biome: z.number(),
  occupier_type: z.number(),
  occupier_id: z.number(),
})

const PlayerSchema = z.object({
  address: z.string(),
  name: z.string(),
  guild_name: z.string().optional(),
})

// === COLLECTIONS ===

export const structureCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['structures'],
    queryFn: async () => {
      const sqlApi = getSqlApi() // Singleton accessor
      return sqlApi.fetchAllStructuresMapData()
    },
    getKey: (item) => item.entity_id,
    schema: StructureSchema,
    refetchInterval: 60000, // 1 minute instead of 5
    onUpdate: async ({ transaction }) => {
      // Handle optimistic structure updates
      const { modified } = transaction.mutations[0]
      await api.structures.update(modified)
    },
  })
)

export const armyCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['armies'],
    queryFn: async () => {
      const sqlApi = getSqlApi()
      return sqlApi.fetchAllArmiesMapData()
    },
    getKey: (item) => item.entity_id,
    schema: ArmySchema,
    refetchInterval: 60000,
    onUpdate: async ({ transaction }) => {
      const { modified } = transaction.mutations[0]
      await api.armies.update(modified)
    },
  })
)

export const tileCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['tiles'],
    queryFn: async () => {
      const sqlApi = getSqlApi()
      return sqlApi.fetchAllTiles()
    },
    getKey: (item) => `${item.col}-${item.row}`,
    schema: TileSchema,
  })
)

export const playerCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['players'],
    queryFn: async () => {
      const sqlApi = getSqlApi()
      return sqlApi.fetchAllPlayers()
    },
    getKey: (item) => item.address,
    schema: PlayerSchema,
  })
)
```

### Live Query Examples

#### 1. Replace DataEnhancer with Live Queries

**Before (DataEnhancer pattern):**
```typescript
// data-enhancer.ts:53-93
async enhanceArmyData(occupierId: ID, ...args): Promise<EnhancedArmyData> {
  const armyMapData = await this.mapDataStore.getArmyByIdAsync(occupierId)
  const currentStamina = this.calculateCurrentStamina(...)
  let owner = await this.getArmyOwnerData(armyMapData || null)
  // ... more async lookups
}
```

**After (Live Query):**
```typescript
// hooks/use-enhanced-army.ts
import { useLiveQuery, eq } from '@tanstack/react-db'
import { armyCollection, structureCollection, playerCollection } from '@/collections'

export const useEnhancedArmy = (armyId: number) => {
  return useLiveQuery((q) =>
    q
      .from({ army: armyCollection })
      .join(
        { player: playerCollection },
        ({ army, player }) => eq(player.address, army.owner_address),
        'left'
      )
      .join(
        { structure: structureCollection },
        ({ army, structure }) => eq(structure.entity_id, army.owner_structure_id),
        'left'
      )
      .where(({ army }) => eq(army.entity_id, armyId))
      .select(({ army, player, structure }) => ({
        entityId: army.entity_id,
        coords: { x: army.coord_x, y: army.coord_y },
        category: army.category,
        tier: army.tier,
        count: divideByPrecision(Number(BigInt(army.count))),
        stamina: calculateCurrentStamina(army, currentTick()),
        owner: {
          address: player.address,
          name: player.name,
          guildName: player.guild_name,
        },
        ownerStructure: structure ? {
          id: structure.entity_id,
          name: structure.owner_name,
          coords: { x: structure.coord_x, y: structure.coord_y },
        } : null,
      }))
  )
}
```

#### 2. Structures by Owner (Replaces MapDataStore method)

**Before:**
```typescript
// map-data-store.ts:517-521
public getStructuresByOwner(ownerAddress: string): StructureMapData[] {
  this._checkRefresh()
  const normalizedAddress = BigInt(ownerAddress).toString()
  return Array.from(this.structuresMap.values()).filter(
    (structure) => structure.ownerAddress === normalizedAddress
  )
}
```

**After:**
```typescript
// hooks/use-player-structures.ts
export const usePlayerStructures = (ownerAddress: string) => {
  return useLiveQuery((q) =>
    q
      .from({ structure: structureCollection })
      .where(({ structure }) => eq(structure.owner_address, ownerAddress))
      .select(({ structure }) => ({
        entityId: structure.entity_id,
        coords: { x: structure.coord_x, y: structure.coord_y },
        type: structure.structure_type,
        level: structure.level,
        guardArmies: parseGuardArmies(structure),
        activeProductions: parseActiveProductions(structure),
      }))
  )
}
```

#### 3. Entities in Radius with Derived Collection

**Before:**
```typescript
// map-data-store.ts:529-550
public getEntitiesInRadius(centerX: number, centerY: number, radius: number) {
  this._checkRefresh()
  const radiusSquared = radius * radius
  const structures = Array.from(this.structuresMap.values()).filter(...)
  const armies = Array.from(this.armiesMap.values()).filter(...)
  return { structures, armies }
}
```

**After:**
```typescript
// collections/derived/entities-in-radius.ts
import { createLiveQueryCollection } from '@tanstack/db'

export const createEntitiesInRadiusCollection = (
  centerX: number,
  centerY: number,
  radius: number
) => {
  const radiusSquared = radius * radius

  return createLiveQueryCollection({
    startSync: true,
    query: (q) =>
      q
        .from({ structure: structureCollection })
        .where(({ structure }) => {
          const dx = structure.coord_x - centerX
          const dy = structure.coord_y - centerY
          return dx * dx + dy * dy <= radiusSquared
        })
        .select(({ structure }) => ({
          type: 'structure' as const,
          entityId: structure.entity_id,
          coords: { x: structure.coord_x, y: structure.coord_y },
          ownerName: structure.owner_name,
        }))
        .union((q) =>
          q
            .from({ army: armyCollection })
            .where(({ army }) => {
              const dx = army.coord_x - centerX
              const dy = army.coord_y - centerY
              return dx * dx + dy * dy <= radiusSquared
            })
            .select(({ army }) => ({
              type: 'army' as const,
              entityId: army.entity_id,
              coords: { x: army.coord_x, y: army.coord_y },
              ownerName: army.owner_name,
            }))
        ),
  })
}

// Usage in component
const { data: nearbyEntities } = useLiveQuery(
  createEntitiesInRadiusCollection(playerX, playerY, 50)
)
```

### Optimistic Mutation Patterns

#### Move Army (Instant UI Update)

```typescript
// hooks/use-move-army.ts
import { createOptimisticAction } from '@tanstack/react-db'
import { armyCollection } from '@/collections'

export const useMoveArmy = () => {
  const moveArmy = createOptimisticAction<{
    armyId: number
    targetX: number
    targetY: number
  }>({
    onMutate: ({ armyId, targetX, targetY }) => {
      // Instantly update UI
      armyCollection.update(armyId, (draft) => {
        draft.coord_x = targetX
        draft.coord_y = targetY
      })
    },
    mutationFn: async ({ armyId, targetX, targetY }, params) => {
      // Send to blockchain
      const tx = await dojoSystem.move_army(armyId, targetX, targetY)

      // Wait for blockchain confirmation
      await tx.wait()

      // Refetch to get updated stamina/state from chain
      await armyCollection.utils.refetch()
    },
  })

  return moveArmy
}

// Component usage
const MoveArmyButton = ({ army }) => {
  const moveArmy = useMoveArmy()

  return (
    <button onClick={() => moveArmy({
      armyId: army.id,
      targetX: 100,
      targetY: 200
    })}>
      Move (instant UI update!)
    </button>
  )
}
```

---

## Migration Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Set up TanStack DB infrastructure without breaking existing code

#### Tasks:
1. **Install dependencies**
   ```bash
   pnpm add @tanstack/db @tanstack/react-db @tanstack/query-db-collection zod
   ```

2. **Create collection definitions** (`packages/core/src/collections/`)
   - `structures.ts` - Structure collection with schema
   - `armies.ts` - Army collection with schema
   - `tiles.ts` - Tile collection with schema
   - `players.ts` - Player collection with schema
   - `index.ts` - Export all collections

3. **Set up providers** (`client/apps/landing/src/providers/collections-provider.tsx`)
   ```typescript
   import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 60000, // 1 minute
         refetchOnWindowFocus: false,
       },
     },
   })

   export const CollectionsProvider = ({ children }) => {
     useEffect(() => {
       // Preload critical collections
       structureCollection.preload()
       armyCollection.preload()
     }, [])

     return (
       <QueryClientProvider client={queryClient}>
         {children}
       </QueryClientProvider>
     )
   }
   ```

4. **Create migration helpers** (`packages/core/src/collections/migrate.ts`)
   ```typescript
   // Bridge between old MapDataStore and new collections
   export class CollectionBridge {
     static async syncFromMapDataStore(mapDataStore: MapDataStore) {
       const structures = mapDataStore.getAllStructures()
       const armies = mapDataStore.getAllArmies()

       // Bulk insert into collections
       structures.forEach(s => structureCollection.insert(s, { optimistic: false }))
       armies.forEach(a => armyCollection.insert(a, { optimistic: false }))
     }
   }
   ```

**Success Criteria:**
- Collections can be queried alongside existing MapDataStore
- No production code changes yet, only new infrastructure
- Unit tests pass for collection schemas

---

### Phase 2: Replace MapDataStore Reads (Week 3-4)

**Goal**: Migrate read operations to live queries while keeping MapDataStore for writes

#### Tasks:

1. **Migrate simple getters** (Low risk)
   - `getStructureById()` → `useLiveQuery` with entity_id filter
   - `getArmyById()` → `useLiveQuery` with entity_id filter
   - `getPlayerName()` → `useLiveQuery` on playerCollection

2. **Create custom hooks** (`packages/core/src/hooks/`)
   - `use-structure.ts` - Single structure by ID
   - `use-army.ts` - Single army by ID
   - `use-player-structures.ts` - All structures for a player
   - `use-player-armies.ts` - All armies for a player
   - `use-entities-in-radius.ts` - Spatial query

3. **Update WorldUpdateListener** (High impact)
   - Remove `DataEnhancer` calls from update handlers
   - Replace with direct collection updates:
     ```typescript
     // OLD: world-update-listener.ts:183-227
     const enhancedData = await this.dataEnhancer.enhanceArmyData(...)

     // NEW:
     armyCollection.update(currentState.occupier_id, (draft) => {
       draft.coord_x = currentState.col
       draft.coord_y = currentState.row
       draft.count = newCount
       // ... direct updates, no async
     })
     ```
   - **Remove `processSequentialUpdate()` entirely** - no longer needed with reactive collections

4. **Deprecate MapDataStore reads**
   - Add deprecation warnings to getter methods
   - Keep MapDataStore running in parallel for safety
   - Monitor logs for any remaining usage

**Success Criteria:**
- All components use `useLiveQuery` hooks instead of MapDataStore getters
- MapDataStore logs show zero read operations
- UI updates are instant (no async lookup delays)
- No regressions in functionality

---

### Phase 3: Optimistic Mutations (Week 5-6)

**Goal**: Enable instant UI updates with automatic rollback

#### Tasks:

1. **Identify mutation operations**
   - Army movements
   - Structure attacks/defenses
   - Resource transfers
   - Building construction

2. **Create optimistic action hooks** (`packages/core/src/hooks/mutations/`)
   - `use-move-army.ts` - Instant army movement
   - `use-attack-structure.ts` - Battle actions
   - `use-build.ts` - Construction
   - `use-transfer-resources.ts` - Resource management

3. **Implement mutation handlers**
   ```typescript
   // Example: use-attack-structure.ts
   export const useAttackStructure = () => {
     return createOptimisticAction<{
       attackerId: number
       defenderId: number
     }>({
       onMutate: ({ attackerId, defenderId }) => {
         // Instant UI feedback
         armyCollection.update(attackerId, (draft) => {
           draft.battle_cooldown_end = currentTick() + COOLDOWN
         })
         structureCollection.update(defenderId, (draft) => {
           draft.latest_attacker_id = attackerId
           draft.latest_attack_timestamp = Date.now()
         })
       },
       mutationFn: async ({ attackerId, defenderId }) => {
         const tx = await dojoSystem.attack(attackerId, defenderId)
         await tx.wait()

         // Sync battle results from chain
         await Promise.all([
           armyCollection.utils.refetch(),
           structureCollection.utils.refetch(),
         ])
       },
     })
   }
   ```

4. **Remove manual state management**
   - Delete `explorerMoveEventCache` from WorldUpdateListener
   - Delete `updateSequenceMap` and `pendingUpdates`
   - Simplify update handlers to direct collection mutations

**Success Criteria:**
- All user actions show instant UI feedback
- Failed transactions automatically rollback UI state
- No race conditions or stale state issues
- Reduced WorldUpdateListener complexity by 50%+

---

### Phase 4: Derived Collections & Spatial Queries (Week 7-8)

**Goal**: Replace complex filtering logic with materialized views

#### Tasks:

1. **Create derived collections** (`packages/core/src/collections/derived/`)
   - `active-battles.ts` - Ongoing battles with cooldowns
   - `player-entities.ts` - All entities for current player
   - `map-viewport.ts` - Visible entities based on camera position
   - `leaderboards.ts` - Top players by various metrics

2. **Spatial indexing**
   ```typescript
   // collections/derived/spatial-index.ts
   export const createSpatialGrid = (gridSize = 100) => {
     return createLiveQueryCollection({
       startSync: true,
       query: (q) =>
         q
           .from({ structure: structureCollection })
           .select(({ structure }) => ({
             gridX: Math.floor(structure.coord_x / gridSize),
             gridY: Math.floor(structure.coord_y / gridSize),
             entities: [structure],
           }))
           .groupBy(({ gridX, gridY }) => `${gridX},${gridY}`)
     })
   }
   ```

3. **Performance benchmarking**
   - Measure query response times (target: <1ms for incremental updates)
   - Compare memory usage vs old MapDataStore
   - Test with 10,000+ entities

4. **Three.js integration**
   - Subscribe to viewport collection for visible entities
   - Instant model updates on collection changes
   - Remove polling from render loop

**Success Criteria:**
- Spatial queries complete in <1ms for incremental updates
- Three.js renders update only changed entities
- Memory usage reduced by 30%+ (no duplicate data structures)

---

### Phase 5: Deprecate Legacy Code (Week 9-10)

**Goal**: Remove old MapDataStore and DataEnhancer

#### Tasks:

1. **Verify zero usage**
   - Run codebase search for MapDataStore imports
   - Check runtime logs for any remaining calls
   - Ensure all tests pass with collections only

2. **Delete deprecated code**
   - `map-data-store.ts` (641 lines)
   - `data-enhancer.ts` (220 lines)
   - `processSequentialUpdate()` and related tracking (lines 1229-1281)

3. **Simplify WorldUpdateListener**
   - Remove DataEnhancer dependency
   - Remove MapDataStore dependency
   - Direct collection updates only
   - Target: Reduce from 1294 lines to ~600 lines

4. **Update documentation**
   - Migrate guide for future developers
   - Collection usage examples
   - Best practices for live queries

**Success Criteria:**
- MapDataStore and DataEnhancer deleted
- WorldUpdateListener reduced by 50%+
- All tests passing
- Documentation complete

---

## Expected Performance Improvements

### Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Army move UI latency** | 50-200ms (async lookup) | <5ms (optimistic) | **10-40x faster** |
| **Structure update latency** | 100-300ms (sequential processing) | <5ms (reactive) | **20-60x faster** |
| **Query filtering (1000 entities)** | 5-10ms (full scan) | <1ms (incremental) | **5-10x faster** |
| **Memory overhead** | High (duplicate Maps) | Low (single source) | **30-50% reduction** |
| **Code complexity** | 2155 lines (3 files) | ~600 lines (1 file) | **72% reduction** |
| **Stale data window** | 0-300 seconds (polling) | 0ms (reactive) | **Infinite improvement** |

### Developer Experience

- **Declarative queries**: Replace imperative loops with SQL-like syntax
- **Automatic reactivity**: No manual subscription management
- **Type safety**: Zod schemas provide runtime validation + TypeScript types
- **Debugging**: TanStack Query DevTools for query inspection

---

## Risk Mitigation

### Rollback Plan

1. **Keep MapDataStore in parallel during Phase 2-3**
   - Feature flag to toggle between implementations
   - A/B test with subset of users

2. **Incremental migration**
   - Migrate one component at a time
   - Easy to revert individual changes

3. **Monitoring**
   - Add performance metrics to production
   - Alert on query times >10ms
   - Track collection memory usage

### Known Challenges

1. **Learning curve**: Team needs to understand live queries
   - **Solution**: Pair programming sessions, code reviews

2. **Schema migrations**: Changing collection schemas requires careful planning
   - **Solution**: Versioned schemas, migration helpers

3. **TanStack DB is new**: Relatively new library, potential for bugs
   - **Solution**: Thorough testing, upstream bug reports

---

## Alternative: ElectricSQL Integration (Future)

For even better performance, consider migrating from REST API queries to Electric sync:

```typescript
// Instead of queryCollectionOptions (REST)
import { electricCollectionOptions } from '@tanstack/electric-db-collection'

export const structureCollection = createCollection(
  electricCollectionOptions({
    id: 'structures',
    shapeOptions: {
      url: 'https://electric.eternum.com/v1/shape',
      params: {
        table: 'structures',
      },
    },
    getKey: (item) => item.entity_id,
    schema: StructureSchema,
  })
)
```

**Benefits:**
- Real-time sync with automatic conflict resolution
- Offline-first support
- Reduced server load (clients sync incrementally)
- Better for mobile app

**Timeline**: Consider after Phase 5 completion (Week 11+)

---

## Success Metrics & KPIs

### Phase Completion Criteria

- **Phase 1**: Collections queryable, tests passing
- **Phase 2**: Zero MapDataStore read calls, UI updates instant
- **Phase 3**: All mutations optimistic, no race conditions
- **Phase 4**: Spatial queries <1ms, Three.js integration complete
- **Phase 5**: Legacy code deleted, docs updated

### Production Metrics

- Query response time p95 < 5ms
- Zero stale data incidents
- Memory usage reduced by 30%+
- Developer velocity: 50% faster for new features using collections

---

## Conclusion

This migration represents a fundamental architectural shift from imperative, polling-based state management to reactive, declarative data flow. The benefits extend far beyond raw performance:

1. **Instant UI updates** via optimistic mutations
2. **Simplified codebase** with 70%+ less state management code
3. **Better scalability** as the game world grows
4. **Improved developer experience** with declarative queries

The phased approach minimizes risk while delivering incremental value. Phase 2 alone will provide significant UX improvements, making the full migration worthwhile even if later phases are deferred.

**Recommended Start Date**: Immediately
**Estimated Completion**: 10 weeks (2.5 months)
**Team Size**: 2 engineers (1 lead, 1 support)
