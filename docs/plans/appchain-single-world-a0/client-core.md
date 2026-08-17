# A0 slice C — client-engine single-game assumption audit

## 1. ClientConfigManager (packages/core/src/managers/config-manager.ts)

- Static singleton `_instance` (:32-75); `setDojo` snapshots all cost/weight/production tables from RECS ONCE at
  bootstrap (:56-67) → needs gameId param + refilter.
- Module-level export `configManager` (:1267) imported by **350 call sites / 125 files** — keep export shape, scope
  internally (recommended) to avoid touching all.
- `getValueOrDefault` (:77-89) silently returns defaults on miss → wrong-game reads look like "not loaded"; add dev
  assert.
- **39 `WorldConfig[WORLD_CONFIG_ID]` reads** (lines
  92,195,287-288,294,308,322,367,462-463,471,482-488,557,602-608,650-651,660-661,670-671,680-681,704-705,738-739,754-759,776-777,793-799,842-843,856,867,970,987-993,1014,1055,1098,1160,1171)
  — all become `WorldConfig[gameId]`. Includes getTick (:735-751), getSeasonConfig (:1166-1171),
  getSeasonMainGameStartAt (:471 — the clock-bug field), getBlitzConfig (:864-876, also reads
  HyperstructureGlobals[WORLD_CONFIG_ID] at :876).
- Domain-keyed config reads: WeightConfig[rt] :102, ResourceFactoryConfig[rt] :111-113/:1039-1043,
  ResourceList[listId,index] :122-254 (5 sites), HyperstrtConstructConfig[rt] :179, StructureLevelConfig[level] :199,
  BuildingCategoryConfig :1020-1025 + **whole-model runQuery scan at :220**. If rulebook stays preset-keyed these DON'T
  change — schema decision drives ~1 day of A4.

## 2. Tick math

- packages/core/src/utils/timestamp.ts:25-37 getBlockTimestamp → configManager.getTick; no TickManager class; fixing
  getTick + getSeasonConfig transitively fixes tick math. **Cheapest high-value fix.**

## 3. Other core singletons / scans

- LeaderboardManager static instance (:36); runQuery all HyperstructureShareholders :187,:337; all
  PlayerRegisteredPoints :273,:385; all Hyperstructure :460; **SeasonEnded :473 — one ended game marks every game
  ended**.
- MapDataStore static instance (map-data-store.ts:127,260,273 — already has destroy/recreate hack for world switching).
- banks.ts:13, players.ts:26, resource-arrivals.ts:125, market-manager.ts:266, tile-manager.ts:98 — unscoped queries.
- world-update-listener.ts:65,246 — reacts to every RECS write; cost depends entirely on subscription scoping being
  airtight.

## 4. UI constant-keyed reads

- packages/react use-bank.ts:20; client utils/config.ts:21; **store-managers.tsx:615 SeasonTimerStoreManager —
  client-side origin of wrong-clock bug**; use-game-mode-config.ts:9 module-level WORLD_CONFIG_ENTITY_ID constant (must
  become per-render); use-season-start.ts:5 empty-deps useMemo.
- **WorldConfig-as-first-row pattern** (useEntityQuery(Has(WorldConfig))[0]): social.tsx:75-79, prize-panel.tsx:102-105,
  claim-blitz-prize-button.tsx:56-58, blitz-mmr-table.tsx:44-47.

## 5. Sync/subscription (client/apps/game/src/dojo) — core of A4

- sync.ts:144-169 BOUNDED_SYNC_GLOBAL_ENTITY_STREAM_MODELS: 24 models with keyCount 1|2 — every keyCount +1,
  key[0]=game_id. sync.ts:137-142 GLOBAL_EVENT_MODELS → prefix. Clauses are MODULE CONSTANTS (:170-175) → must become
  factories(gameId).
- **:174-175: WORLDMAP_BOUNDED_SPATIAL_SYNC off → clause undefined → subscribe to EVERYTHING (`legacy_all_entities`
  :798) — the ghost-settlement mechanism; delete branch.**
- torii-stream-manager.ts:739-777 buildModelKeysClause — groups by (patternMatching, keyCount); **single chokepoint**:
  keys: [gameId, ...fill(undefined)].
- torii-stream-manager.ts:239-266 bounded spatial sync uses MemberClause col/row only → must AndCompose
  MemberClause(model,"game_id","Eq",gameId) — **REQUIRES torii to expose key members to MemberClause — verify on target
  torii version in A3 (constraint on A1)**.
- queries.ts: getConfigFromTorii :199-300 (arities +1; **sessionStorage cache key :20 must include game_id**);
  getHyperstructureFromTorii :401-418 wildcard arity-1/2/3 models:[] — worst offender; getEntitiesFromTorii :472-486
  `keys:[entityId] VariableLen models:[]` — THE hydrate-everything mechanism → keys:[gameId,entityId];
  getBuildingsFromTorii :571-574 keys:[col,row]; getMarketFromTorii :503-506; getBankStructuresFromTorii :525
  MemberClause category only; spatial member ranges :593-649; getQuestsFromTorii :670-673; tiles :72-73.
- army-authoritative-reconciler.ts:232; debounced-queries.ts:86,101,117.

## 6. Shared-torii machinery to DELETE

world-torii.ts (isSharedWorldTorii :21, worldScopeCondition internal_id LIKE :31-40, withWorldScope :43-47,
resolveAppchainWorldAddress :51-79); use-world-availability.ts:17-27 regex scope injector; appchain-worlds-summary.ts:49
internal_id JOIN hack; factory-worlds.ts:7 wf-WorldDeployed; types.ts WorldProfile → GameProfile; manifest-patcher.ts;
dojo-config.ts:22-23.

## 7. LIMIT 1 WorldConfig SQL (→ WHERE game_id = ?)

profile-builder.ts:69; use-world-availability.ts:37,40,44; world-banks.ts:4-5; use-market-servers.ts:12;
winners-table.tsx:21,27,33; game-review-service.ts ×10; game-review-stats-utils.ts ×5; packages/torii
leaderboard.ts:263; blitz-settlement-sql.ts:13,20; use-player-world-registrations.ts:77; use-player-ranks.ts:51.
Out-of-A4-scope same defect: realtime-server ×2, onchain-agent ×5, eternum-mobile queries.ts:100.
**packages/torii/src/queries/sql: ~71 FROM clauses / 13 files — all need game_id; JOINs need game_id on BOTH sides**
(structure.ts:101-104,139-143; relics.ts:28-29,56-58; trading.ts:12-13; hyperstructure.ts:56-57).

## 8. Namespace churn

contract-components.ts autogenerated 2418 lines namespace "s1_eternum"; **521 "s1_eternum-…" literals across 64 non-test
files**; regen handles game_id fields; hand-written schemas (QuestLevelsSchema :13-16) manual.

## 9. getEntityIdFromKeys

poseidon(key tuple) → order-sensitive; **266 call sites / 102 files** (config-manager 49, tile-manager 13,
world-update-listener 7…). Missed prepend = silent miss. **Mitigation: gameEntityKey(...) wrapper prepending active
game_id + codemod; raw getEntityIdFromKeys becomes lint signal for global models.**

## 10. Cairo key-design constraints (A1 inputs, ranked)

1. game_id MUST be key[0] on every per-game model; entity_id MUST be key[1] on entity-keyed models (getEntitiesFromTorii
   VariableLen prefix hydration breaks otherwise — silent missing components).
2. Per-model key-arity table needed from A1 (sync list groups by arity; generate not hand-maintain).
3. MemberClause on key members (game_id) — confirm torii support before A4 spatial design, else bounded spatial sync has
   no scoping mechanism.
4. Rulebook preset-global vs per-game decision changes ~15 config-manager sites + queries.ts arity split (~1 day swing).
5. ResourceList becomes 3-key — new arity group; confirm SDK path handles ≥3.
6. Definitive global-models list needed (AddressName, Guild?, MMR family, rank family currently treated as game models
   in sync.ts:144-169).
7. Reserve game_id != MAX_U32 (WORLD_CONFIG_ID); start at 1.
8. Grep Cairo for WORLD_CONFIG_ID (~24 files) for stragglers.

## 11. A4 size

~60-80 files with recommended approach (internal scoping of configManager, gameEntityKey codemod, namespace
find/replace, sync-level isolation as boundary + dev-mode asserts instead of per-hook filters); ~150 files if
hand-edited everywhere. "~1 week" only on first path with schema frozen first.
