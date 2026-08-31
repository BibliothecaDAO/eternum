# A0 — Single-world schema audit (Blitz, `s2_blitz`)

**Status: A0 COMPLETE — all decisions signed off 2026-08-08.** D1, D2, D5, D6, D11, D15 approved as recommended; D13
amended (entry NFT stays — single shared collection, see D13); unmarked decisions ratified by default. This schema is
the A1 contract.

Scope: every `#[dojo::model]` and `#[dojo::event]` in `contracts/l3/game` (79 models incl. the inline `AntiBot`, 21
event models), all 43 `#[dojo::contract]`s (36 files), the `wf` factory world (13 models), the TS config pipeline (29
steps / ~146 calls per game), and the client engine's single-game assumptions. Method: nine parallel read-audits; the
full per-file evidence with `file:line` references lives in [appchain-single-world-a0/](./appchain-single-world-a0/) —
this document is the decision artifact.

Parent plan: [appchain-single-world.md](./appchain-single-world.md).

## 1. Headline

Every cross-game leak found funnels through **five mechanisms**. Fixing the mechanism fixes its whole family; A1's
guard-rail review checklist should be organized around these, not around individual bugs.

1. **The `WORLD_CONFIG_ID` singleton family.** One `WorldConfig` row (45 members, including the game clock, the
   settlement cursor, the registration counter) plus 11 satellite models keyed by the same constant
   (`AgentCount/LifetimeCount/LordsMinted`, `HyperstructureGlobals`, `WonderFaithWinners`, `WorldRecord`, `SeasonPrize`,
   `SeriesChestRewardState`, `GameChestReward`, `PlayersRankFinal`, `AgentConfig`). All access funnels through
   `WorldConfigUtilImpl::get_member/set_member` (models/config.cairo:232-241) — a single choke point, but every caller
   must learn to pass `game_id`.
2. **The coordinate space.** `TileOpt(alt, col, row)`, `Building(outer_col, outer_row, inner_col, inner_row)`,
   `StructureReservation(coord)` are keyed by absolute map coordinates; adjacency checks, spawn placement, the Blitz
   settlement cursor, and VRF salts (`TileImpl::to_seed`) are all pure coordinate math. Two games with the same preset
   generate the **identical spawn coordinate sequence** from the same `map_center`.
3. **Player-address keys.** `PlayerRegisteredPoints(address)` (the leaderboard), `BlitzSettlement(player)` (settling in
   game A locks you out of game B), `Liquidity(player, resource_type)`, `Guild/GuildMember/GuildWhitelist`,
   `StructureOwnerStats(owner)` — one row per wallet per world, consumed as if per game.
4. **Small-integer / constant keys.** `BlitzSettlementPosition(settlement_number)`, `BitcoinPhaseLabor(phase_id)`
   (wall-clock derived), caller-chosen `trial_id` on a permissionless entrypoint, per-game entry-token ids restarting at
   1, `Market(resource_type)` (the AMM has **no bank key at all**), regional-bank sentinel ids `u32::MAX-1..-6`,
   `QuestGameRegistry(VERSION)`.
5. **Pooled contract balances + external side effects.** `prize_distribution_systems` computes fee splits and payouts
   from `reward_token.balance_of(this)` — under one world that balance is every game's entry fees;
   `faith_prize_systems.distribute_wonder_prizes` is permissionless and drains the shared faith pool the moment the
   first game ends; per-game entry-token ERC721 deploys and loot-chest role grants are launch-time side effects.
   **`game_id` keys alone do not fix this class** — A1 needs per-game escrow accounting rows (fees in / paid out per
   `game_id`) so payouts debit a game's balance, never `balance_of(this)`.

A sixth, quieter finding: **determinism across games.** VRF salts derived from coordinates
(`Source::Salt(tile.to_seed())`, models/map.cairo:65-76) and from caller nonces mean two concurrent games would roll
correlated exploration outcomes tile-for-tile. Per-game map/biome seeds must be folded into every coord-derived seed.

## 2. Schema delta — model inventory

Classification: **PG** = per-game, gains `#[key] game_id: u32` as key[0] · **CFG** = config, becomes per-game row or
preset row (§4) · **GLOBAL** = cross-game, no `game_id` · **RETIRE** = deleted. Blitz column: **core** = must migrate in
A1 · **season** = Eternum-season-only, migrates in the Phase-3 port · **off** = not deployed/enabled for Blitz (decision
D14/D15).

### 2.1 Per-game, uuid-entity-keyed (no collision today, but required for prefix-sync and pruning)

New key shape: `(game_id, …existing keys)`, `entity_id` staying at key[1] where it is the subject (client constraint
C1).

| Model                                                                                                                               | Current keys                                         | Blitz     | Notes                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------- | --------------------------------------------------------------------------------- |
| `Structure`                                                                                                                         | `entity_id`                                          | core      | 12 `ptr_from_keys` member-I/O sites                                               |
| `Resource`                                                                                                                          | `entity_id`                                          | core      | 6 `ptr_from_keys` sites; 59 balances + 40 production substructs                   |
| `ResourceAllowance`                                                                                                                 | `owner_entity_id, approved_entity_id, resource_type` | core      | plus same-game assert in approve/send/pickup                                      |
| `ResourceArrival`                                                                                                                   | `structure_id, day`                                  | core      | `day` derived from tick config → per-game tick threading                          |
| `StructureBuildings`                                                                                                                | `entity_id`                                          | core      | coord in value; spatial index is `TileOpt`                                        |
| `ProductionBoostBonus`                                                                                                              | `structure_id`                                       | core      | tick-compared end fields                                                          |
| `ExplorerTroops`                                                                                                                    | `explorer_id`                                        | core      | coord in value                                                                    |
| `AgentOwner`                                                                                                                        | `explorer_id`                                        | core      |                                                                                   |
| `Wonder`                                                                                                                            | `structure_id`                                       | core      |                                                                                   |
| `Hyperstructure`                                                                                                                    | `hyperstructure_id`                                  | core      | live in Blitz                                                                     |
| `HyperstructureRequirements`                                                                                                        | `hyperstructure_id`                                  | core      | 6 `ptr_from_keys` sites                                                           |
| `HyperstructureShareholders`                                                                                                        | `hyperstructure_id`                                  | core      |                                                                                   |
| `PlayerConstructionPoints`                                                                                                          | `address, hyperstructure_id`                         | core      |                                                                                   |
| `Trade`                                                                                                                             | `trade_id`                                           | off (D15) | accept_order needs same-game assert if kept                                       |
| `TradeCount`                                                                                                                        | `structure_id`                                       | off (D15) |                                                                                   |
| `QuestTile` / `Quest` / `QuestRegistrations`                                                                                        | uuid / `(game_token_id, game_address)` / 2 ids       | off (D14) | `Quest.game_address` = external Budokan contract — rename hazard vs our `game_id` |
| `StructureVillageSlots` / `VillageTroop` / `VillageRaidImmunity`                                                                    | realm/village ids                                    | season    | villages excluded from Blitz                                                      |
| `BitcoinMinePhaseLabor`                                                                                                             | `phase_id, mine_id`                                  | season    | discovery is season-only                                                          |
| `WonderFaith` / `WonderFaithPrize` / `WonderFaithBlacklist` / `FaithfulStructure` / `PlayerFaithPoints` / `PlayerFaithPrizeClaimed` | wonder/player ids                                    | season    | faith not in Blitz presets                                                        |

### 2.2 Per-game, colliding keys (active cross-game corruption today)

| Model                                                    | Current keys                                 | New keys                                                 | Blitz  | Collision mechanism                               |
| -------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------- | ------ | ------------------------------------------------- |
| `TileOpt`                                                | `alt, col, row`                              | `game_id, alt, col, row`                                 | core   | the map itself — worst case                       |
| `Building`                                               | `outer_col, outer_row, inner_col, inner_row` | `game_id, +4` (D3: add `alt`?)                           | core   | absolute coords; 4 tuple-read sites               |
| `StructureReservation`                                   | `coord`                                      | `game_id, coord`                                         | core   | reservation blocks all games                      |
| `BlitzSettlementPosition`                                | `settlement_number: u16`                     | `game_id, settlement_number`                             | core   | open-pool rows shared; claim/swap corrupts both   |
| `BlitzSettlement`                                        | `player`                                     | `game_id, player`                                        | core   | settle-once check spans games                     |
| `BlitzEntryTokenRegister`                                | `token_id: u128`                             | `game_id, token_id`                                      | core   | per-game collections restart at 1                 |
| `BlitzCosmeticAttrsRegister`                             | `player`                                     | `game_id, player` (D8)                                   | core   | concurrent registrations overwrite                |
| `PlayerRegisteredPoints`                                 | `address`                                    | `game_id, address`                                       | core   | THE leaderboard row                               |
| `SeasonPrize`                                            | `config_id` (=CONST)                         | `game_id`                                                | core   | two games sum points into one pot                 |
| `WorldRecord`                                            | `world_id` (=CONST)                          | `game_id`                                                | core   | relic cadence + fee-split-once flag shared        |
| `HyperstructureGlobals`                                  | `world_id` (=CONST)                          | `game_id`                                                | core   | count feeds discovery probability                 |
| `GameChestReward`                                        | `world_id` (=CONST)                          | `game_id`                                                | core   | chest allocation per game                         |
| `PlayersRankTrial`                                       | `trial_id` (caller-chosen!)                  | `game_id` (+nonce field, D5)                             | core   | permissionless id squatting                       |
| `PlayersRankFinal`                                       | `world_id` (=CONST)                          | absorbed into `GameRegistry` (D5)                        | core   | **hard blocker: only one game can ever finalize** |
| `PlayerRank`                                             | `trial_id, player`                           | `game_id, player`                                        | core   |                                                   |
| `RankPrize` / `RankList`                                 | `trial_id, rank(, index)`                    | `game_id, rank(, index)`                                 | core   | key-range iteration must scope                    |
| `MMRGameMeta` / `MMRClaimed`                             | `world_id: u128` (actually trial_id)         | `game_id`                                                | core   | key name lies — rename to what it is              |
| `StructureOwnerStats`                                    | `owner`                                      | split (D7): `game_id, owner` count; name → `AddressName` | core   | guild gating reads the count                      |
| `AgentCount` / `AgentLifetimeCount` / `AgentLordsMinted` | `id` (=CONST)                                | `game_id`                                                | core   | one game exhausts caps for all                    |
| `Market`                                                 | `resource_type` — **no bank key**            | `game_id, resource_type` (D15)                           | off    | one AMM for the entire world today                |
| `Liquidity`                                              | `player, resource_type`                      | `game_id, player, resource_type` (D15)                   | off    | LP shares fungible across games                   |
| `BitcoinPhaseLabor`                                      | `phase_id` (wall-clock)                      | `game_id, phase_id`                                      | season | shared prize pool + denominator                   |
| `WonderFaithWinners`                                     | `world_id` (=CONST)                          | `game_id`                                                | season |                                                   |
| `Guild` / `GuildMember` / `GuildWhitelist`               | wallet addresses                             | D6 decision                                              | core   | one guild identity across all games               |

### 2.3 Config models (representation per §4)

| Model                                                                 | Current keys                    | Disposition                                        |
| --------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| `WorldConfig` (45 members)                                            | `config_id` (=CONST)            | **split** — see §3                                 |
| `AgentConfig`                                                         | `id` (=CONST)                   | per-game row (mutable caps interact with counts)   |
| `WeightConfig` / `ResourceFactoryConfig` / `HyperstrtConstructConfig` | `resource_type`                 | preset row `(preset_id, resource_type)` (D2)       |
| `BuildingCategoryConfig`                                              | `category`                      | preset row                                         |
| `StructureLevelConfig`                                                | `level`                         | preset row                                         |
| `ResourceList` / `ResourceMinMaxList`                                 | uuid list id, `index`           | keep uuid-keyed; pointers live in preset rows (D2) |
| `QuestGameRegistry` / `QuestLevels` / `QuestFeatureFlag`              | const `VERSION` / contract addr | off (D14) — world-global if ever revived           |
| `ResourceBridgeWtlConfig` / `ResourceRevBridgeWtlConfig`              | token / resource_type           | season, chain-global — stay singleton              |

### 2.4 Global — must NOT gain `game_id`

| Model                                       | Keys                                           | Why global                                                                             |
| ------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `AddressName` (player half, after D6 split) | `address`                                      | player identity                                                                        |
| `BiomeDiscovered`                           | `by_address, biome`                            | trophy dedupe (D9: global-once semantics)                                              |
| `RNG`                                       | `tx_hash`                                      | tx hashes are chain-unique — **the documented exception**; unbounded growth → A3 prune |
| `AntiBot`                                   | `caller, tx_hash`                              | replay protection, chain-unique                                                        |
| `SeriesChestRewardState`                    | `world_id` (=CONST) → `series_id`              | series-scoped aggregate (D10); the factory cross-world chain retires                   |
| Player MMR                                  | external soul-bound ERC20 (`contracts/l2/mmr`) | already global; only its **auth** changes (factory-oracle → fixed allowlist)           |
| Achievement/trophy events                   | player-keyed                                   | declared once at `dojo_init`                                                           |

### 2.5 Retire

`Quantity`, `QuantityTracker` (dead code, still costing torii tables in every manifest), `WonderProductionBonusConfig`
(dead struct), `WorldConfig.factory_address` member + `set_factory_address`, and the entire `wf` factory world:
`FactoryConfig(+Contract/Model/Event/Library)`, `FactoryDeploymentCursor`, `WorldContract`,
`SeriesContract/BySelector/SeriesGame`. `WorldDeployed` → `GameRegistry`; `Series` + `MMRRegistration` → registrar-held
rows.

### 2.6 Event models (21 in-repo + 2 achievement-package)

`StoryEvent` (the activity feed) currently keys `(id, owner, entity_id, tx_hash)` — `game_id` becomes key[0], pushing
all four down a slot; ~19 emit sites. All other per-game events (`ExplorerMoveEvent`, `ExplorerRewardEvent`,
`BattleEvent`, `ExplorerNewRaidEvent`/`ExplorerRaidEvent`, `OpenRelicChestEvent`, `BurnResearchForRelicEvent`,
`SwapEvent`, `LiquidityEvent`, `CreateOrder`/`AcceptOrder`/`CancelOrder`, `SeasonEnded`, `BlitzSettlementEvent`,
donkey/troop utils events, `ExplicitResourceBurn` + its sibling) get `game_id` as key[0] the same way.
`MMRGameCommitted(trial_id)` / `PlayerMMRChanged(player, trial_id)` re-key on `game_id` per D5. `SeasonEnded` today has
no game discriminator — the client treats one ended game as "the game ended" everywhere (leaderboard-manager.ts:473).

## 3. `WorldConfig` split

The 45-member god-struct splits three ways. **Mutable-at-runtime members are state, not config** — they must live in
per-game rows regardless of the preset decision.

- **Per-game state row (mutable):** `season_config` (the game clock — becomes `GameRegistry` phase fields, §5),
  `blitz_settlement_config` (live cursor), `blitz_hypers_settlement_config` (live cursor), `realm_count_config`
  (counter), the per-game half of `blitz_registration_config` (`entry_token_address`, `registration_count`,
  `registration_start_at`), `map_center_offset`, `biome_climate_config` (per-game seeds), `blitz_mode_on`,
  `settlement_config` (season path, mutable).
- **Preset rows (static per preset):** tick, map probabilities, troop damage/stamina/limit, battle, capacity, structure
  capacity, speed, building (+base), trade, quest, victory-points grant/win, hyperstructure (+cost), structure max
  level, starting/camp resources, bank, artificer, faith rates, bitcoin prize params, `blitz_exploration_config` profile
  id, mercenaries name (today hidden in `AddressName[0]` — move here).
- **Chain-global singletons (unchanged):** `vrf_provider_address`, `agent_controller_config`, `mmr_config`, the address
  half of `blitz_registration_config` (fee token/recipient, 4 collectibles contracts), `season_addresses_config` +
  bridge configs (season-only), village configs (season-only), `admin_address` (D12).

Ordering dependencies to kill in A1: `set_settlement_config` reads `blitz_exploration_config`;
`set_blitz_exploration_config` back-patches `blitz_settlement_config.base_distance`; `set_season_config` is write-once
(`if end_at == 0` — the contract-level clock bug). Registrar presets are written atomically, so all three quirks
disappear.

## 4. Preset representation (D2 — recommendation)

**Recommended: `(preset_id, …)` shared rulebook rows + one per-game state row.** The registrar stores presets once
(`register_preset(preset_id, …)`, admin-only, ~146 calls but rare) and `create_game` only writes the per-game state row
plus `GameRegistry` — this is what makes "game exists in 1–2 tx, <30 s" achievable, since per-game copies of the
rulebook (~120+ rows: 39 recipes + 39 weights + 39 building costs + …) would blow the tx budget and grow torii per game.
Cost: every rulebook lookup becomes two-level (`game → preset_id → row`); client keeps its current config-manager arity
for rulebook models (client audit §1.3 confirms this is the cheaper path there too).

Per-game calldata (`create_game`): name, series ref, `start_main_at`, `duration_seconds` (which also selects the
official-60/official-90 preset today — make preset explicit instead), `dev_mode_on`, `single_realm/two_player` mode,
`registration_count_max`/fee overrides, biome seeds + map-probability overrides, and a per-game randomness seed
(replaces the tx-hash-derived `map_center_offset`). Everything else is the preset.

## 5. `GameRegistry` + registrar spec

`GameRegistry` row (key `game_id: u32`): `name`, `series_id`, `game_number_in_series`, `preset_id`, `creator`, `status`
(Created/Registration/Settling/Live/Ended/Settled), the six `SeasonConfig` fields (`dev_mode_on`, `start_settling_at`,
`start_main_at`, `end_at`, `end_grace_seconds`, `registration_grace_seconds`), `final_trial_id` (absorbs
`PlayersRankFinal`), `map_center_offset`/seed, and escrow accounting (`fees_collected`, `fees_paid_out` — mechanism 5).

`create_game` absorbs, in order (all evidence in [systems-3](./appchain-single-world-a0/systems-3-realm-lifecycle.md)
and [factory-and-presets](./appchain-single-world-a0/factory-and-presets.md)):

1. Game id assignment + `GameRegistry` write (replaces `WorldDeployed`; series sequence asserts from the factory's
   `validate_create_game_series`).
2. Per-game state row from preset + calldata overrides (replaces the 146-call config replay).
3. Hyperstructure ring reservation — today `reserve_hyperstructures(19)` × `ceil((1+3r(r+1))/19)` launch-workflow
   batches; becomes registrar-internal, keyed writes.
4. Registration bookkeeping (replaces the entry-token ERC721 deploy — D13).
5. (Eternum port only: banks, spires, village roles.)

The Blitz launch pipeline steps `create-world`, `wait-for-factory-index`, `configure-world`,
`reserve-blitz-hyperstructures`, `create-indexer` collapse into `create_game` + one `GameRegistry`-row poll (A2). The
`grant-lootchest-role` step becomes a one-time grant (single `prize_distribution` address forever).

Today's cost for calibration: factory `create_game` = 191 actions ÷ `max_actions 20` ≈ 10 txs, plus 1 config multicall,
plus reservation batches — ~10 minutes. Target: 1–2 txs, <30 s.

## 6. Systems audit summary

Full entrypoint tables: [systems-1](./appchain-single-world-a0/systems-1-combat-bank.md),
[systems-2](./appchain-single-world-a0/systems-2-config-econ.md),
[systems-3](./appchain-single-world-a0/systems-3-realm-lifecycle.md). Patterns:

- **DERIVABLE (majority of gameplay fns):** the fn receives an entity id; once entities carry `game_id`, read it off the
  subject. **But ownership ≠ game**: `assert_caller_owner` does not separate games (same wallet plays both), so every
  **multi-entity fn needs `assert(a.game_id == b.game_id)`** — this is A1's guard-rail rule. Known missing-same-game
  sites: all three battle fns (one has its defender-ownership assert commented out), raid, `pledge_faith`, `contribute`,
  `claim_share_points` (caller-supplied id span), trade `create/accept_order`, resource `approve/send/pickup`, all
  adjacent transfers (one has its recipient-owner check commented out), `explorer_guard_swap` (same-structure assert
  deliberately disabled), `dev mint`.
- **MUST_PASS (creation/registration/admin/coord-only fns):** `settle`, `obtain_entry_token`, discovery fan-out
  (`ITroopMovementUtilSystems::find_treasure` passes `Tile` **by value** — the trait signature must gain `game_id`;
  prerequisite for all 7 discovery contracts), `create_banks`, config setters, rank/MMR/prize entrypoints,
  `season_close`.
- **AMBIENT (singleton reads to re-point):** every `SeasonConfigImpl::get` / `assert_*` phase gate (~25+ entrypoints in
  slice 3 alone), every tick read, `CoordImpl::center`, `blitz_mode_on` branches, agent caps, relic cadence.
- **Permissionless danger fns** (today's design leans on "one world = one game" for safety): `distribute_wonder_prizes`
  (no params, pays `balance_of(this)`), `blitz_prize_player_rank` (caller-chosen trial, global finalize latch,
  pooled-fee split), `commit_game_mmr_meta`/`claim_game_mmr` (no auth, no season gate), `claim_phase_reward`
  (caller-supplied mine list, mutates future phase rows), `reserve_hyperstructures`, `create_spires`,
  `structure_regularize_weight` (arbitrary id list, no ownership check), `velords_claim` (sweeps the whole bridge
  balance).

### Adversarial two-game test suite (A1 acceptance, seeded from the riskiest fns)

Two concurrent games A/B, same preset, overlapping wall-clock. Assert zero cross-effects for each:

1. Settle in both games with the same wallet (today: locked out; spawn coords identical).
2. A explores (x,y) → B still sees it unexplored, can move/settle there; extract reward at same coord in both.
3. Battle/raid attempts across games at "adjacent" coords (incl. the commented-out-assert paths).
4. Trade: B accepts A's public order; approve/send/pickup across games.
5. Points: contribute + `claim_share_points` with mixed-game id spans; assert per-game `SeasonPrize` totals.
6. Finalize rankings in A, then B (today: B reverts "already finalized"); `blitz_prize_claim` payouts debit only A's
   escrow; series chest `game_index` advances once per game with two games ending in the same block.
7. MMR commit/claim for A names only A's trial; B's ratings untouched until B settles.
8. Clocks: A and B run different `start_main_at`/`end_at`; `get_current_phase`-class reads and every phase gate use the
   caller's game row.
9. Discovery probability/caps: exhaust agent caps in A → B unaffected; hyperstructure counts independent; relic cadence
   independent; VRF outcomes differ at the same coord (per-game seed folded in).
10. `season_close`/end: ending A leaves B live (client `SeasonEnded` handling included).
11. Registrar: `create_game` while A is live; registration windows independent; escrow accounting per game.
12. Guild scope per D6; `StructureOwnerStats` count per game (guild gating uses the caller's game).

## 7. Id strategy

- `game_id: u32`, assigned by the registrar counter starting at **1**; reserve `0` (unset sentinel) and `u32::MAX` (=
  `WORLD_CONFIG_ID`, avoids any legacy-row collision during A5 transition; client constraint C7).
- Entity ids stay `world.dispatcher.uuid()` (u32, world-global, 103 call sites unchanged) — globally unique across
  games, so cross-game _references_ are representable; isolation comes from keys + the same-game guard rule, not id
  partitioning. Add a one-time assert that uuid stays below `u32::MAX - 8` (the reserved sentinel band:
  `WORLD_CONFIG_ID`, 6 bank ids, `DAYDREAMS_AGENT_ID`).
- Regional-bank sentinel ids (`MAX-1..-6`) retire with banks for Blitz (D15); the Eternum port allocates bank ids via
  `uuid()` at `create_game`.
- `DAYDREAMS_AGENT_ID` (sentinel _owner_, not a key) survives unchanged.
- Namespace: `s2_blitz` (`DEFAULT_NS()` constant); fresh manifest, `s1_eternum` untouched upstream.

## 8. Decisions required before A1

Recommendations included; items marked ⚠ need explicit sign-off, the rest are ratifications.

- **D1 ✅ Coordinate isolation = keys, not offsets.** Put `game_id` in tile/building/reservation keys and keep one
  logical coordinate plane per game (identical centers are then harmless). Keep `map_center_offset` (now per-game,
  seeded from `create_game` randomness) for variety only. Fold `game_id`/per-game seed into `TileImpl::to_seed` and
  every coord-derived VRF salt (§1 mechanism 6).
- **D2 ✅ Preset rows, not per-game copies**, for the rulebook (§4).
- **D3 Building key**: fix the pre-existing dropped-`alt` bug while re-keying (alt+regular structures at the same (x,y)
  already alias today). Recommended: yes, add `alt`.
- **D4 Same-game guard rule**: every entrypoint touching ≥2 entities asserts equal `game_id`; the three
  deliberately-disabled ownership asserts (battle :677, swap :622, transfer :361) are re-examined in A1 — they are
  exactly where cross-game attacks land.
- **D5 ✅ `trial_id` → `game_id`.** One final ranking per game; absorb `PlayersRankFinal` into
  `GameRegistry.final_trial_id`/`status`; keep a caller nonce as a plain field for idempotency. Kills the permissionless
  id-squatting surface.
- **D6 ✅ Guilds become per-game** with a synthetic uuid `guild_id` (wallet-keyed today = one guild identity across all
  games, and `GuildOnly` hyperstructure access in game A honoring a guild formed in game B). UX/client change.
- **D7 `StructureOwnerStats` splits**: `(game_id, owner) → structures_num`; display name lives only in global
  `AddressName`. Guild/name gates then read the caller's-game count.
- **D8 `BlitzCosmeticAttrsRegister` is a per-game snapshot** `(game_id, player)` — matches current write semantics
  (locked-for-this-game attrs); the global loadout stays off-chain/collectibles.
- **D9 `BiomeDiscovered` stays global-once** (trophy semantics; behavior change vs fresh-world-per-game re-earning —
  flag to trophy owner).
- **D10 Series become first-class**: `series_id`-keyed rows (state + the currently-hardcoded constants
  `NUM_GAMES_IN_SERIES`, chest supply, cap ratios as per-series config); previous-game chest chaining becomes a
  same-world registry read; concurrency guard on `game_index` advancement.
- **D11 ✅ Per-game escrow accounting** for every payout path (entry fees, prize pools, faith pools if ever enabled):
  fees credit `GameRegistry.fees_collected`; payouts assert against and debit it. No `balance_of(this)` arithmetic
  anywhere.
- **D12 Admin model**: one chain admin (registrar owner) for presets and ops; `GameRegistry.creator` recorded but
  carries no special authority in A1 (creator-rights are a later product decision).
- **D13 ✅ (amended 2026-08-08) Entry token NFT stays — as one shared collection.** The NFT is a product requirement and
  load-bearing for Phase 2 (settlement/prizes). Implementation: a **single entry-token ERC721 deployed once**, minted by
  the registrar at registration with the `game_id` bound on-chain (`BlitzEntryTokenRegister` re-keyed
  `(game_id, token_id)` remains the source of truth; `game_id` also exposed in token metadata). No per-game UDC deploys
  — `create_game` stays 1–2 tx, and the Controller/paymaster policy references one contract address forever instead of
  one per game.
- **D14 Quests: retire from `s2_blitz`** (`start_quest` is already commented out; the feature flag is a world-global
  toggle).
- **D15 ✅ The new world deploys the Blitz-core contract set only** (confirmed with the constraint: valid as long as
  Blitz needs no Eternum models — the audit verified Blitz presets never enable the excluded systems, and A1 re-checks
  at manifest time that no core system reads an excluded model). **Amended 2026-08-08:** the compile-time cut is
  best-effort — if excluding the season systems from the build costs more than migrating them, A1 may migrate the full
  set (season models re-key per §2's `season` rows) and defer contract exclusion to the deploy manifest at A5. The
  deployed world stays Blitz-core either way. Namespace note: `s2_blitz` does **not** exist yet — it is the working name
  for the new world's namespace. This is still "improving s1": the same Cairo source in `contracts/l3/game` evolves in
  place; only the deployed namespace string (`DEFAULT_NS()`) changes. A new namespace/world is forced, not stylistic:
  adding `#[key] game_id` changes every model's storage layout and entity identity (poseidon of keys), which Dojo cannot
  upgrade in place — a fresh world deploy is required regardless; during A5 the new world and the legacy `s1_eternum`
  worlds coexist on the same chain and torii, so reusing the `s1_eternum` name would make every table/selector
  ambiguous; and upstream mainnet keeps deploying `s1_eternum` untouched until they adopt the single-world schema.
  Excluded contracts: `resource_bridge_systems` (unsafe pooled balance + `velords_claim`), `village_systems`, season
  `realm_systems` + `season_systems.season_close` (Blitz ends by timestamp), `spire_systems`, `bitcoin_mine` (both),
  `faith_systems` + `faith_prize_systems`, `quest_systems`, `bank/swap/liquidity` + `trade_systems` (disabled in Blitz
  presets today — banks are never created). This roughly halves A1: ~45 core models instead of 79. The excluded set
  migrates with the Eternum port (Phase 3) using the same rules.
- **D16 Torii `MemberClause` on key members** (`game_id`) must be verified on the target torii version before A4's
  bounded-spatial-sync design (client constraint C3) — schedule the check in A3, it can invalidate the spatial scoping
  approach.

## 9. Client constraints on the Cairo schema (from [client-core](./appchain-single-world-a0/client-core.md))

- **C1** `game_id` is key[0] on every per-game model with zero exceptions; `entity_id` stays key[1] on entity-keyed
  models — `getEntitiesFromTorii` hydrates by VariableLen key-prefix `[game_id, entity_id]`; a model that deviates
  silently drops out of entity hydration.
- **C2** A1 delivers a definitive per-model key-arity table; the client sync list groups subscriptions by arity and
  should be generated from it, not hand-maintained.
- **C3** = D16 (MemberClause on `game_id`).
- **C4** The definitive global-model list (§2.4) feeds the client's `gameEntityKey` wrapper split — global models keep
  raw `getEntityIdFromKeys`, per-game models use the wrapper (266 call sites become 1 codemod).
- **C5** `ResourceList` at 3 keys is a new arity group — confirm the SDK path handles it.
- **C6** `getConfigFromTorii`'s sessionStorage cache key must include `game_id`.
- **C7** `game_id ∈ [1, u32::MAX)` (§7).

A4 sizing from the audit: ~60–80 files on the recommended path (config-manager scoped internally behind the existing
`configManager` export; `gameEntityKey` codemod; namespace regen for 521 `s1_eternum-` literals; sync-level scoping as
the isolation boundary with dev-mode asserts, not per-hook filters). The `~71` SQL `FROM` clauses in `packages/torii`
all gain `game_id = ?`, with JOIN predicates carrying `game_id` on **both** sides.

## 10. A1 mechanical checklist (greps)

| Check                          | Command / target                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Member-pointer key tuples      | `grep -rn "ptr_from_keys" contracts/l3/game/src` — 29+ bare-scalar sites (Resource ×6, Structure ×12, HyperstructureRequirements ×6, ResourceArrival ×5, WorldConfig/WorldRecord accessors) |
| Singleton accessors            | `grep -rn "WorldConfigUtilImpl::\|WorldRecordImpl::\|SeasonConfigImpl::get" contracts/l3/game/src` — every caller gains a `game_id` argument                                                |
| Constant-key stragglers        | `grep -rn "WORLD_CONFIG_ID" contracts/l3/game/src` (~24 files) — must reduce to the chain-global singletons only                                                                            |
| `world_id`/`config_id` renames | models in §2.2 — rename to `game_id` (MMR pair renames to what it actually holds per D5)                                                                                                    |
| Coord-tuple reads              | `world.read_model((…col, …row))` sites for `TileOpt`/`Building` — arity +1                                                                                                                  |
| Same-game guards               | every multi-entity entrypoint (§6 list) — new assert; snforge suite §6 is the acceptance test                                                                                               |
| Seed derivations               | `to_seed\|Source::Salt\|Source::Nonce` — fold per-game seed                                                                                                                                 |
| Event key reorder              | all §2.6 emit sites                                                                                                                                                                         |
| StoryEvent key[0]              | client `story.ts` queries change with it                                                                                                                                                    |
| Dead code                      | delete `Quantity`/`QuantityTracker`/`WonderProductionBonusConfig` + manifest entries                                                                                                        |

## 11. Exit

A0 exits when the decisions in §8 are signed off and this schema stands as the A1 contract. No unclassified model
remains: 79/79 models and 21/21 in-repo events are classified above (§2), the factory world's 13 models are
dispositioned (§2.5, §5), and the `WorldConfig` member split is total (§3).
