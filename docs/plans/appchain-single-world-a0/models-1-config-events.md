# A0 slice 1 — config.cairo + events.cairo + constants.cairo

## Models in config.cairo (12)

Group 1 — WORLD_CONFIG_ID singleton:

- `WorldConfig` (config.cairo:23) — key `config_id: ID` (=u32::MAX). 45-member god-struct: every config + mutable
  runtime cursors. CONFIG_ROW, COLLIDES. All access via `WorldConfigUtilImpl::get_member/set_member`
  (config.cairo:232-241) using ptr_from_keys(WORLD_CONFIG_ID) — single choke point but every caller must supply game_id.

Group 2 — keyed by resource_type (rulebook):

- `HyperstrtConstructConfig` (:270) CONFIG_ROW COLLIDES (read models/hyperstructure.cairo:75,81)
- `WeightConfig` (:1176) CONFIG_ROW COLLIDES (~58 rows; read resource.cairo:50)
- `ResourceFactoryConfig` (:1185) CONFIG_ROW COLLIDES (production rates + uuid list-id pointers;
  production.cairo:284,348,353,431, building.cairo:564)
- `ResourceRevBridgeWtlConfig` (:1294) CONFIG_ROW/GLOBAL COLLIDES — season bridging only

Group 3 — other scalar keys:

- `BuildingCategoryConfig` (:1203, key category) CONFIG_ROW COLLIDES (building.cairo:621,789,837)
- `StructureLevelConfig` (:1309, key level) CONFIG_ROW COLLIDES (structure/contracts.cairo:60)
- `ResourceBridgeWtlConfig` (:1286, key token addr) GLOBAL-ish — season bridging

Group 4 — Blitz per-game runtime state in config.cairo (all COLLIDES, PER_GAME):

- `BlitzSettlementPosition` (:1319, key settlement_number: u16) — open settlement slot coords;
  realm/blitz/contracts.cairo:424,455,457,458 (swap-delete)
- `BlitzSettlement` (:1327, key player) — player's settled structure ids; :85,133,196 + prize_distribution:168
- `BlitzEntryTokenRegister` (:1335, key token_id: u128) — entry NFT consumed; per-game UDC-deployed token → ids restart
  at 1 → identical keys
- `BlitzCosmeticAttrsRegister` (:1343, key player) — UNSURE: global loadout vs per-game locked snapshot; write-only
  on-chain (realm/blitz/contracts.cairo:382)

## WorldConfig member classification (45 members — key ones)

- PER_GAME critical: `map_center_offset` (tx-hash-derived at first set_world_config, config/contracts.cairo:386-391;
  feeds position.cairo:212 map center — SLEEPER BUG: same center = same hexes), `biome_climate_config` (seeds),
  `season_config` (SeasonConfig :110 — THE game clock: dev_mode_on, start_settling_at, start_main_at, end_at,
  end_grace_seconds, registration_grace_seconds; predicates config.cairo:125-215 called from dozens of systems),
  `blitz_settlement_config` (MUT cursor :511, next() :591), `blitz_hypers_settlement_config` (MUT :735),
  `blitz_registration_config` (:921 MIXED — split chain-global addrs from per-game
  entry_token_address/registration_count/registration_start_at), `realm_count_config` (MUT counter), `settlement_config`
  (MUT, season path), `tick_config` (:1017, TickImpl::\_tick_config :1118), `blitz_mode_on`, `blitz_exploration_config`,
  `bitcoin_mine_config`, `faith_config` (rates per-game; reward_token global)
- CONFIG_ROW preset: hyperstructure_config/cost, speed, map_config, bank_config, structure_max_level, building,
  troop_damage/stamina/limit, capacity, structure_capacity, trade, battle, quest_config, victory_points_grant/win,
  realm/village start resources
- GLOBAL stay singleton: vrf*provider_address, agent_controller_config, mmr_config, admin_address (UNSURE: per-game
  admin?), season_addresses_config (season-only), bridge configs (season-only), village*\* (season-only)
- RETIRE: `factory_address` (:66; set config/contracts.cairo:1021; read prize_distribution:87),
  `WonderProductionBonusConfig` (:84 dead struct)

## events.cairo (1 event)

- `StoryEvent` (events.cairo:8, historical:false) — keys: `id: ID` (uuid), `owner: Option<addr>`,
  `entity_id: Option<ID>`, `tx_hash`. Whole activity feed (Story enum, 26 variants). PER_GAME, UNIQUE-BUT-UNSCOPED.
  game_id must become key #0 → reorders all 4 keys; ~19 emit sites (faith 562,627,935; production 323,403,488;
  troop_battle 351,364,636,649,897,910; troop_movement 307; …).

## constants.cairo

- `WORLD_CONFIG_ID` (:11) = u32::MAX — keys: WorldConfig, AgentConfig/Count/LifetimeCount/LordsMinted, WorldRecord,
  SeasonPrize, HyperstructureGlobals, WonderFaithWinners, SeriesChestRewardState, GameChestReward, PlayersRankFinal
- `REGIONAL_BANK_ONE..SIX_ID` (:12-17) = MAX-1..MAX-6 — FIXED structure entity ids (bank.cairo:53-55, is_bank :35-42).
  Two games' banks collide hard. Either game_id keys everywhere (planned) or uuid bank ids at create_game.
- `DAYDREAMS_AGENT_ID` (:18) = MAX-7 — sentinel owner id (many compare sites); not a key, but reserved range must
  survive.
- `DEFAULT_NS()` = "s1_eternum" (:429-435) → "s2_blitz".
- uuid() id space: u32; reserved top range needs explicit assert (4.29B headroom).

## Flags

1. map_center_offset decision BEFORE A1: per-game offset with spacing > max radius, or drop coord-space separation
   (game_id key on tiles is the isolation).
2. Bank sentinel ids MAX-1..6 collide — switch to uuid at create_game or rely on game_id keys.
3. WorldConfig migration concentrated in get_member/set_member + every caller passes game_id. Grep:
   `WorldConfigUtilImpl::`.
4. Rulebook configs (Weight/ResourceFactory/BuildingCategory/StructureLevel/HyperstrtConstruct, ~100+ static rows):
   (game_id, x) per-game copies vs (preset_id, x) shared + game→preset_id indirection. DECISION.
5. Chain-global keep-singleton list: vrf, agent controller, mmr_config, fee/collectibles addrs, UDC, velords burner.
6. BlitzRegistrationConfig split (global addrs vs per-game state).
7. Season-only configs likely not deployed for Blitz — confirm preset coverage.
8. StoryEvent key reorder breaks client key-position queries.
9. PlayersRankFinal.world_id is u128 read with u32 constant — mixed .into() usage (prize_distribution
   158,243,372,579,596 vs 185) — verify same key encoding; latent bug.
10. BlitzCosmeticAttrsRegister: global loadout vs per-game snapshot — human decision (client reads off-chain).
