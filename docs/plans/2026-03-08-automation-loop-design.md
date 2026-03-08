# Automation Loop Design

Wire the agent's existing dry-run automation (build-order, runner, production planner) into a live background loop that executes transactions across all owned realms.

## Architecture

Single `createAutomationLoop()` function mirroring `createMapLoop()` pattern:

```
createAutomationLoop(client, provider, signer, playerAddress, dataDir, intervalMs=60_000) → AutomationLoop
  .start() / .stop() / .refresh() / .isRunning
```

Runs on a 60s interval. Each tick processes all realms the agent owns.

## Tick Phases

### Phase 1: Discovery

- `sql.fetchStructuresByOwner(playerAddress)` returns all owned entity IDs
- Filter to realms/villages by structure category
- For each realm, resolve biome from map data (drives build order + troop path)

### Phase 2: Fetch State (parallel across all realms)

- `sql.fetchResourceBalancesAndProduction([entityId])` per realm
- Parse hex balance columns into `Map<resourceId, number>`
- Parse building production columns into `Map<buildingType, number>` and `Set<buildingType>`

### Phase 3: Plan (pure, no async)

For each realm:

- `nextIntent(realmState)` from `runner.ts` → build / upgrade / idle
- `planProduction(balances, activeBuildings, troopPath)` from `production.ts` → production calls

### Phase 4: Execute (parallel across all realms)

All realms execute in parallel via `Promise.allSettled`:

1. **Build intent** → `provider.create_building({ entity_id, directions, building_category, use_simple: false, signer })`
2. **Upgrade intent** → `provider.upgrade_realm({ realm_entity_id, signer })`
3. **Production plan** → `provider.execute_realm_production_plan({ realm_entity_id, resource_to_resource, labor_to_resource, signer })`

### Phase 5: Status File

Write `automation-status.txt` to data dir with per-realm summary:

- What was built / upgraded / produced
- Build order progress (step N of M)
- Essence/wheat pulse
- Errors if any

The LLM agent reads this file via its scoped read/grep tools.

## Balance Parsing

`fetchResourceBalancesAndProduction` returns rows with columns like `WOOD_BALANCE` (hex string) and `WOOD_PRODUCTION` (building count object). A `parseRealmSnapshot(row)` function converts this to:

- `balances: Map<number, number>` — resource ID to human-readable amount
- `buildingCounts: Map<number, number>` — building type to count
- `activeBuildings: Set<number>` — building types with count > 0

## Building Placement

`create_building` requires `directions` — a path from realm center to an open build slot. Need to resolve available inner hex positions, distinct from army spawning which uses outer adjacent hexes.

## Files

| File | Purpose |
|------|---------|
| `src/automation/loop.ts` | Interval loop, orchestrates all phases |
| `src/automation/snapshot.ts` | Parse SQL response into balances and buildings |
| `src/automation/executor.ts` | Execute build/upgrade/production via provider |
| `src/automation/status.ts` | Format and write status file |
| Existing `build-order.ts`, `runner.ts`, `production.ts`, `pulse.ts`, `recipes.ts` | Unchanged planning logic |

## Error Handling

- Each realm executes independently; one failure does not block others
- `Promise.allSettled` captures per-realm errors
- Errors logged to status file
- Loop continues on next tick regardless

## Provider Methods Used

- `execute_realm_production_plan({ signer, realm_entity_id, resource_to_resource?, labor_to_resource? })`
- `create_building({ signer, entity_id, directions, building_category, use_simple })`
- `upgrade_realm({ signer, realm_entity_id })`

## Data Sources

- `sql.fetchStructuresByOwner(playerAddress)` — realm discovery
- `sql.fetchResourceBalancesAndProduction([entityId])` — balances + building counts
- Biome data from map snapshot or structure info
