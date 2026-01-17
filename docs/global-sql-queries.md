# Global SQL Queries (Remaining, Uncached)

This list covers global or near-global SQL queries that are still uncached after the recent
leaderboard/story-events/tiles/hyperstructures caching work. "Global" here means the query
reads most or all rows in a table or uses only broad filters (e.g., category filters).

## Remaining Global Queries (Uncached)

- STRUCTURE_AND_EXPLORER_DETAILS
  - Query: `packages/torii/src/queries/sql/structure.ts`
  - API: `packages/torii/src/queries/sql/api.ts` → `fetchGlobalStructureExplorerAndGuildDetails()`
  - Usage (main game): `client/apps/game/src/three/managers/player-data-store.ts`
  - Notes: No WHERE clause; GROUP BY owner with multiple joins. Scales with total structures.

- REALM_VILLAGE_SLOTS
  - Query: `packages/torii/src/queries/sql/structure.ts`
  - API: `packages/torii/src/queries/sql/api.ts` → `fetchRealmVillageSlots()`
  - Usage (main game): `client/apps/game/src/ui/features/settlement/components/mint-village-pass-modal.tsx`
  - Notes: No WHERE clause; returns all village slots across the world.

- REALM_SETTLEMENTS
  - Query: `packages/torii/src/queries/sql/structure.ts`
  - API: `packages/torii/src/queries/sql/api.ts` → `fetchRealmSettlements()`
  - Usage (main game): `client/apps/game/src/ui/features/settlement/utils/settlement-utils.ts`
  - Notes: Global read with category filter; still returns all realms.

- ALL_STRUCTURES_MAP_DATA
  - Query: `packages/torii/src/queries/sql/structure.ts`
  - API: `packages/torii/src/queries/sql/api.ts` → `fetchAllStructuresMapData()`
  - Usage (main game): not found in source; referenced in `client/apps/landing/TANSTACK_DB_MIGRATION_PLAN.md` and
    appears in mobile bundles.
  - Notes: Full-table read + joins; likely very heavy if enabled.

- ALL_ARMIES_MAP_DATA
  - Query: `packages/torii/src/queries/sql/structure.ts`
  - API: `packages/torii/src/queries/sql/api.ts` → `fetchAllArmiesMapData()`
  - Usage (main game): not found in source; referenced in `client/apps/landing/TANSTACK_DB_MIGRATION_PLAN.md` and
    appears in mobile bundles.
  - Notes: Full-table read + joins; likely very heavy if enabled.

- HYPERSTRUCTURES_WITH_REALM_COUNT
  - Query: `packages/torii/src/queries/sql/hyperstructure.ts`
  - API: `packages/torii/src/queries/sql/api.ts` → `fetchHyperstructuresWithRealmCount()`
  - Usage (main game): not found in source.
  - Notes: Global join across structures and battles; computed with a radius parameter but still heavy.

## Already Cached Global Queries

- Leaderboard + related global tables (cached via `/api/cache/leaderboard`).
- Story events (cached via `/api/cache/story-events`).
- Tiles (cached via `/api/cache/tiles`).
- Hyperstructures list (cached via `/api/cache/hyperstructures`).
