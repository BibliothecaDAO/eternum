# A0 slice F — factory world + TS config pipeline

## Factory models (namespace "wf")

RETIRE: FactoryConfig{version} + FactoryConfigContract/Model/Event/Library{version,index} (recipe/version tracking),
FactoryDeploymentCursor{version,name} (resumable deploy), WorldContract{name,selector} (per-game address directory;
patchManifestWithFactory), SeriesContract/SeriesContractBySelector/SeriesGame (cross-world address lookups). BECOMES
GameRegistry: WorldDeployed{name → address, block_number, tx_hash} — THE games list (wf-WorldDeployed polled by
launcher/client). REGISTRAR KEEPS: Series{name, owner, game_count} (numbering + sequence validation asserts);
MMRRegistration{address, version} → collapses to single allowlisted mmr_systems address.

## Player MMR lives in contracts/l2/mmr — plain Starknet soul-bound ERC20 (balances Map<addr,u256>, INITIAL_MMR, MIN_MMR), authorized via is_factory_mmr_contract(caller) → factory version check. Already global. With one world: replace factory-oracle auth with single-address allowlist (set_factory_details-style) or move in-world (loses ERC20 surface).

## create_game flow today (factory.cairo:276-410)

create_game(game_name, max_actions, factory_config_version, series_name, series_game_number): cursor read → series
validation (owner, game_number == count|count+1) → config revision pin → deploy_syscall(world_class_hash,
salt=game_name) + register_namespace → phase 1 contracts (register_contract + WorldContract write + MMR/Series hooks +
grant_writer) → phase 2 series count++ → phase 3 libraries/models/events registration → phase 4 init_contract ×42 →
WorldDeployed write, completed=true. Current appchain manifest: 42 contracts + 5 libraries + 79 models + 23 events + 42
inits = 191 actions; max_actions=20 → ~10 txs; launcher 15 submissions × 5 retries, 10s spacing.

## Series chest chain (runtime): prize_distribution:69 → WorldConfig.factory_address → get_series_game_data(self) → get_series_game_address_by_class_hash(series, n-1, class_hash) → SAFE-DISPATCHER CALL into previous game's world → fallback new(). Single-world: SeriesChestRewardState keyed (series_id), GameChestReward (game_id), previous-game pointer = registry lookup; NUM_GAMES_IN_SERIES=8, TOTAL_NUM_CHESTS=584, CAP_RATIO_BPS are module CONSTANTS → per-series data. Series.game_count also iteration bound (get_all_series_game_addresses loops 1..=count).

## Launch step chain (config/deployer/clean/types.ts:16)

create-world → wait-for-factory-index → configure-world → reserve-blitz-hyperstructures → grant-lootchest-role →
[eternum: grant-village-pass-role, create-banks] → create-indexer → [mainnet: sync-paymaster]. Every step preceded by
pnpm config:sync:<network>.

## Config replay per game: 29 steps for appchain.blitz, ≈146 system calls, ONE multicall tx in batched mode (beginBatch/endBatch, no chunking on this path). Consequence: worldConfigTxHash == blitzRegistrationTxHash == batch tx hash → both map_center_offset and entry-token salt derive from it.

Multi-call setters: weight ×39, building-category ×39, resource-factory ×39, structure-level ×3, victory-points ×2.
Blitz-skipped: vrf (mainnet only), village/trade/bank/faith (eternum only).

## Preset values source

config/generated/blitz.appchain.json (checked-in) ← pnpm config:sync:appchain ←
config/source/blitz/{base,chains,resources,building,troop,levels,points,hyperstructures,exploration,shared}.ts +
official-60.ts / official-90.ts (TWO balance presets selected by durationSeconds: 3600→60, 5400→90; applied at
generation AND launch, config-loader.ts:170-189). base.ts registration: fee 10e18, count_max 24, delay 10s, period 3h,
cosmetics max 5.

## Per-game varying (create_game calldata / GameRegistry fields)

startMainAt (--start-time), durationSeconds (--duration-seconds; ALSO selects balance preset), registration window (end
= startMainAt-1, start = end - period; native-steps.ts:150-170), dev_mode_on, single_realm_mode/two_player_mode
(mutually exclusive; changes hyperstructure target 3 vs ring formula), biome seeds/scales
(--biome-climate-overrides-json, per-game-number variant), map probabilities (--map-config-overrides-json, pair sums
U16_MAX|100000), registration overrides (count_max/fee_token/fee_amount; rejected in two_player), map_center_offset
(tx-hash-derived on-chain, mirrored off-chain deriveMapCenterOffsetFromWorldConfigTx for bank placement), entry-token
address (pedersen(config_systems, reg_tx_hash)), factory_address, admin (signer), game/series names.

## Static per preset (→ on-chain preset rows): 39 recipes, 39 weights, 39 building costs, building base, 3 level costs, troop configs, battle, capacity, speed, hyperstructure, victory points, camp+starting resources, quest, tick intervals, max levels, mercenaries name, bridge fee split, agent, mmr, game-mode flag, exploration profile id, settlement geometry, registration fee recipient/period/delay/collectibles/cosmetics, chain addresses.

## Non-config per-game state written by pipeline (registrar absorbs)

1. map_center_offset (inside set_world_config: offset = (tx_hash % (CENTER_COL/2))/10\*10 when 0)
2. Entry-token ERC721 deploy (inside set_blitz_registration_config when fee>0; calldata bakes per-world
   blitz_realm_systems + config_systems addresses — blitz/entry-token.ts:34,61)
3. Hyperstructure placeholder tiles (reserve_hyperstructures(19) × ceil(target/19), 10s cooldown; target = 1+3r(r+1)
   from count_max, or 3 two-player; real map state + cursor)
4. Loot-chest MINTER_ROLE grant to per-game prize_distribution address → one-time under single world
5. [eternum] village-pass roles; 6 banks at 15\*21 steps from derived center (blitz skips — banks disabled in
   blitzTradeConfig!)
6. Torii create-indexer → retired
7. [mainnet] paymaster policy sync (entry token addr per game)

NOTE: blitz does NOT run create-banks (banks disabled in blitzTradeConfig) — bank/AMM collision relevant to
eternum-on-appchain, still fix keys.
