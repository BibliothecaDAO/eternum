# Plan: Pathfinder Unit Tests + Dynamic Stamina Costs

## Current State
- `pathfinder.ts`: A* with shared `@bibliothecadao/types`, hardcoded costs (explore=30, travel=10)
- `move-executor.ts`: pathfind → batch → execute sequentially
- `move_to` action: registered in action-registry, fetches world state on demand
- All compiles clean, 172/172 tests pass

## Phase 1: Pathfinder Unit Tests

**File:** `test/adapter/pathfinder.test.ts`

Tests to write:
1. **Trivial cases**
   - Start == end → empty path, cost 0
   - Adjacent tiles → single step
   - Target is impassable (ocean) → `found: false`

2. **Straight-line paths**
   - 5-hex straight east through explored tiles → one travel batch, cost 50
   - 5-hex straight through unexplored tiles → 5 explore batches, cost 150

3. **Obstacle avoidance**
   - Ocean wall between start/end → path routes around it
   - Single impassable tile → path detours by 1 hex

4. **Action batch grouping**
   - Mixed explored/unexplored → alternating travel/explore batches
   - All explored → single travel batch
   - All unexplored → N individual explore batches

5. **Heuristic correctness**
   - Verify `Coord.distance()` matches manual cube distance for known pairs
   - A* finds optimal path (not just any path) — compare cost against brute-force BFS on small grid

6. **Edge cases**
   - maxSteps exceeded → `found: false`
   - Large grid (50+ hex path) completes in reasonable time
   - No path exists (fully surrounded by ocean) → `found: false`

**Helper:** Build a `makeTileMap(tiles: {col, row, biome}[])` factory to construct test tile maps without boilerplate.

## Phase 2: Move Executor Unit Tests

**File:** `test/adapter/move-executor.test.ts`

Tests to write:
1. Explorer not found in world state → error result
2. Already at target → success, 0 steps
3. Path not found → `pathFound: false`
4. All batches succeed → full success summary
5. Batch fails mid-execution → `failedAtStep` set, partial steps returned

**Approach:** Mock `executeAction` (vi.mock the module) to return success/failure per call. Mock world state with known tile map and entity list.

## Phase 3: Dynamic Stamina Costs from Config

**Problem:** `ConfigManager` in `packages/core` is coupled to Dojo ECS (`getComponentValue`). The headless agent doesn't run a full Dojo world — it queries SQL APIs.

**Options:**

### Option A: Extract cost function, inject values (recommended)
1. Add a `PathfindingCostConfig` interface to `pathfinder.ts`:
   ```ts
   export interface PathCostConfig {
     exploreCost: number;          // default 30
     baseTravelCost: number;       // default 10
     biomeBonus: number;           // default 10
     troopType?: TroopType;        // for biome-specific modifiers
   }
   ```
2. Make `findPath` accept optional `costConfig` parameter
3. `getTileCost` uses config values instead of hardcoded constants
4. Biome-specific travel cost modifiers mirror `ConfigManager.getTravelStaminaCost` logic but without ECS dependency

### Option B: Query config from Torii SQL
- Fetch `WorldConfig` table via SQL to get `troop_stamina_config` values
- More accurate (live config) but adds a network call to pathfinding

### Recommendation: Option A
- Pathfinding should be a pure function — no network calls
- The caller (`move_to` action or adapter) fetches config once per tick and passes it in
- Keeps pathfinder testable without mocks

**Implementation:**
1. Add `PathCostConfig` interface with defaults
2. Update `findPath` signature: `findPath(..., tileMap, config?, maxSteps?)`
3. Port biome-modifier switch from `ConfigManager.getTravelStaminaCost` into a pure `getBiomeTravelCost(biome, troopType, config)` function
4. Update `move_to` action to pass config (hardcoded defaults initially, SQL-fetched later)
5. Add unit tests for biome-specific costs

## Phase 4: Wire SQL Config Fetch (stretch)

If Phase 3 Option A is done:
1. Add a `fetchStaminaConfig` function in `world-state.ts` that queries Torii SQL for `WorldConfig.troop_stamina_config`
2. Cache result per tick (it doesn't change often)
3. Pass into `findPath` from `move_to` action

## Execution Order
1. Phase 1 (pathfinder tests) — ~30 min
2. Phase 2 (executor tests) — ~20 min  
3. Phase 3 (cost config interface + biome modifiers) — ~20 min
4. Phase 4 (SQL config fetch) — ~15 min if needed

Total: ~1.5 hours, 4 commits.
