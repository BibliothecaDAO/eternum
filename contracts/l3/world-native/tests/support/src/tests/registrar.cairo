pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
pub use starknet::storage::{
    StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess,
};
pub use crate::combat::TroopsTrait;
pub use crate::commands::{Command, CreateExplorer, Explore};
pub use crate::game::{GameStatus, IGameDispatcher, IGameDispatcherTrait, status_at};
pub use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
pub use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait, TileKey};
pub use crate::presets::{
    EconomyPreset, PresetDefinition, ResourcePreset, SettlementPreset, StructurePreset, WithdrawalPreset,
};
pub use crate::registrar::{
    CreateGameParams, IRegistrarDispatcher, IRegistrarDispatcherTrait, IRegistrarSafeDispatcher,
    IRegistrarSafeDispatcherTrait, RosterPlayer,
};
pub use crate::relics::{ChestTiers, IRelicsDispatcher, IRelicsDispatcherTrait, SiteChest};
pub use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey, ResourceRule, ResourceSlot,
};
pub use crate::rules::{DISCOVER_CAMPS, DISCOVER_CHESTS, HOME_REWARDS, RESOURCE_PRECISION};
pub use crate::settlement::{
    ISettlementCommandsDispatcher, ISettlementCommandsDispatcherTrait, ISettlementCommandsSafeDispatcher,
    ISettlementCommandsSafeDispatcherTrait, ISettlementCreationDispatcher, ISettlementCreationDispatcherTrait,
    ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait, RealmCreation, SettlementCreation, SettlementMode,
};
pub use crate::stamina::StaminaSourceTrait;
pub use crate::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait};
pub use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
pub use crate::troops::{
    ExplorerKey, ExplorerRecordTrait, IBattleResolutionDispatcherTrait, IBattleResolutionLibraryDispatcher,
};
pub use super::resource_commands::execute_in_game;
pub fn setup() -> super::Deployment {
    let d = super::setup_with_domains(false, "StructuresLogic", "TroopsLogic");
    start_cheat_block_timestamp_global(100);
    d
}
pub fn registry(d: super::Deployment) -> IRegistrarDispatcher {
    snforge_std::cheat_caller_address(d.games, super::authority(), snforge_std::CheatSpan::TargetCalls(1));
    IRegistrarDispatcher { contract_address: d.games }
}
pub fn safe(d: super::Deployment, caller: starknet::ContractAddress) -> IRegistrarSafeDispatcher {
    snforge_std::cheat_caller_address(d.games, caller, snforge_std::CheatSpan::TargetCalls(1));
    IRegistrarSafeDispatcher { contract_address: d.games }
}
pub fn definition(blitz: bool) -> PresetDefinition {
    let mut resources = array![];
    for resource_type in 1_u8..59 {
        resources.append(ResourceRule { resource_type, unit_weight: 1, realm_rate: 10, village_rate: 5 });
    }
    PresetDefinition {
        rules: crate::rules::SliceRules {
            mode_rules: if blitz {
                super::play_fixture::BLITZ_RULES
            } else {
                super::play_fixture::ETERNUM_RULES
            },
            command_mask: if blitz {
                super::play_fixture::BLITZ_COMMAND_MASK
            } else {
                super::play_fixture::ETERNUM_COMMAND_MASK
            },
            entry_rule: if blitz {
                crate::rules::ENTRY_ROSTER
            } else {
                crate::rules::ENTRY_ENTITLEMENT
            },
            ..super::play_fixture::rules(),
        },
        resources: ResourcePreset {
            resources: resources.span(),
            production: super::production::recipes(),
            mine_kinds: super::mines::kinds(),
            surface_mines: array![crate::mines::MineWeight { kind: 1, weight: 1 }].span(),
        },
        structures: StructurePreset {
            research: array![].span(),
            board: None,
            buildings: super::building_commands::rules(),
            camps: crate::camps::CampRules { resources: array![].span(), labor_rate: 5 },
            faith: crate::faith::FaithRules {
                wonder_rate: 500, realm_rate: 100, village_rate: 10, owner_share_bps: 3000,
            },
            upgrade_limits: crate::upgrades::UpgradeLimits { realm_max: 1, village_max: 1 },
            upgrades: array![crate::upgrades::UpgradeRecipe { costs: array![].span() }].span(),
        },
        settlement: SettlementPreset {
            mode: if blitz {
                SettlementMode::Triple
            } else {
                SettlementMode::Single
            },
            spacing: 6,
            depths: array![].span(),
            realms: super::settlement::grants_for(
                if blitz {
                    crate::rules::ENTRY_ROSTER
                } else {
                    crate::rules::ENTRY_ENTITLEMENT
                },
            ),
            villages: super::village::village_rules(),
            spires: if blitz {
                None
            } else {
                Some(crate::spires::SpireLayout { count: 1, base_distance: 0, layer_distance: 0, max_layer: 0 })
            },
        },
        economy: EconomyPreset {
            labor: None,
            progression: None,
            discovery: None,
            trade: crate::trade::TradeRules { max_count: 2 },
            banks: crate::market::BankRules {
                lp_fee_num: 3, lp_fee_denom: 1000, owner_fee_num: 1, owner_fee_denom: 100,
            },
            hyperstructures: if blitz {
                crate::hyperstructures::HyperstructureRules { initialize_shards: 0, resources: array![].span() }
            } else {
                super::hyperstructures::rules()
            },
            relics: super::relics::rules(),
            chests: None,
            research_cost: 100,
            withdrawals: if blitz {
                None
            } else {
                Some(
                    WithdrawalPreset {
                        deposits: crate::bridge::DepositRules {
                            paused: false,
                            realm_fee_bps: 500,
                            velords_fee_bps: 100,
                            season_fee_bps: 200,
                            client_fee_bps: 300,
                        },
                        rules: crate::withdrawals::WithdrawalRules {
                            paused: false,
                            bank_fee_bps: 0,
                            velords_fee_bps: 0,
                            season_fee_bps: 0,
                            client_fee_bps: 0,
                            velords_recipient: super::authority(),
                            season_recipient: super::authority(),
                            retention: array![crate::withdrawals::Retention { troop_percent: 95, resource_percent: 95 }]
                                .span(),
                        },
                        tokens: array![].span(),
                    },
                )
            },
        },
        exploration: array![
            crate::exploration_rewards::ExplorationReward { resource_type: 1, percent: 10, percent_max: 10, weight: 1 },
        ]
            .span(),
        season_win_points: 1000,
    }
}
pub fn roster(count: u32) -> Span<RosterPlayer> {
    let mut players = array![];
    for index in 1..count + 1 {
        let account = Into::<u32, felt252>::into(2000 + index).try_into().unwrap();
        players.append(RosterPlayer { account, wallet: account });
    }
    players.span()
}
pub fn params(blitz: bool) -> CreateGameParams {
    CreateGameParams {
        name: 'native',
        preset_id: 1,
        start_settling_at: 200,
        start_main_at: 300,
        duration_seconds: 100,
        end_grace_seconds: if blitz {
            0
        } else {
            10
        },
        dev_mode_on: false,
        roster: if blitz {
            roster(2)
        } else {
            array![].span()
        },
        seater: if blitz {
            super::authority()
        } else {
            0.try_into().unwrap()
        },
        registration_start: 10,
        biome_climate: super::play_fixture::rules().biome_climate_config,
        map_override: None,
        seed: 42,
    }
}
pub const DAY_UNIT: u32 = 60;
pub const BAG_SECONDS: u64 = 1200;
pub const FRONTIER_DAY_UNIT: u32 = 14400;
pub const FRONTIER_BAG_SECONDS: u64 = 288000;
pub fn day_start(d: super::Deployment, game_id: u32, index: u64) -> u64 {
    let game = IGameDispatcher { contract_address: d.games }.game(game_id);
    let unit = IGameDispatcher { contract_address: d.games }.rules(game_id).day_unit_seconds;
    let mut day = crate::days::day_of(game, unit, game.start_main_at);
    while day.index != index {
        day = crate::days::day_of(game, unit, day.end);
    }
    day.start
}
pub /// Open entry draws starting troops from the biome table, which a fixed-roster definition leaves empty.
 fn open_entry(ref preset: PresetDefinition) {
    preset.rules.entry_rule = crate::rules::ENTRY_OPEN;
    preset.settlement.realms = super::settlement::grants_for(crate::rules::ENTRY_OPEN);
}
pub // The expedition preset uses seeded day bags.
 fn expedition_preset() -> PresetDefinition {
    let mut preset = definition(true);
    open_entry(ref preset);
    preset.rules.command_mask = preset.rules.command_mask
        | (*read_txt(@FileTrait::new("../fixtures/frontier-command-mask.txt")).at(0)).try_into().unwrap();
    preset.rules.day_unit_seconds = DAY_UNIT;
    preset.rules.tick_config.armies_tick_in_seconds = 60;
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    preset.economy.chests = frontier.economy.chests;
    preset.economy.labor = frontier.economy.labor;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.structures.board = frontier.structures.board;
    preset.structures.research = frontier.structures.research;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset.rules.mode_rules = HOME_REWARDS | crate::rules::DEPTH_CONTENTS;
    preset.settlement.spacing = 1024;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset.rules.troop_limit_config.settlement_armies = 2;
    preset
}
pub fn expedition_home(d: super::Deployment) -> (u32, PresetDefinition, u8) {
    let preset = expedition_preset();
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams {
                dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 2 * BAG_SECONDS, ..params(false),
            },
        );
    super::play_fixture::reserve_fixture_homes(d.games, game_id, d.actor);
    // The catalogue is already loaded by deployment; this fixture pins its first realm.
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            350,
        ),
    );
    let guards = IGuardsDispatcher { contract_address: d.games };
    let category: u8 = guards.guard(GuardKey { game_id, structure_id: 1, slot: 0 }).troops.category.into();
    (game_id, preset, category)
}
pub fn muster_command(category: u8, direction: u8) -> Command {
    muster_slot_command(category, direction, 0)
}
pub fn muster_slot_command(category: u8, direction: u8, slot: u8) -> Command {
    Command::CreateExplorer(
        CreateExplorer { slot, structure_id: 1, category, tier: 0, amount: RESOURCE_PRECISION, direction },
    )
}
pub fn expedition_armies(d: super::Deployment, game_id: u32, category: u8) -> (ExplorerKey, ExplorerKey) {
    let home = ResourceKey { game_id, entity_id: 1 };
    start_cheat_caller_address(d.games, d.games);
    for troop in array![26_u8, 29, 32] {
        IResourceOperationsDispatcher { contract_address: d.games }
            .grant_resource(
                home,
                troop,
                1000 * RESOURCE_PRECISION,
                351,
                crate::commands::resource_context(
                    crate::commands::ExecutionContext {
                        timestamp: 351, ..crate::tests::context(d.games, (home).game_id),
                    },
                ),
            );
    }
    stop_cheat_caller_address(d.games);
    for direction in array![0_u8, 1] {
        let muster = Command::CreateExplorer(
            CreateExplorer {
                slot: direction, structure_id: 1, category, tier: 0, amount: 3 * RESOURCE_PRECISION, direction,
            },
        );
        assert!(execute_in_game(d, game_id, muster, 351));
    }
    let explorers = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
    (ExplorerKey { game_id, explorer_id: *explorers.at(0) }, ExplorerKey { game_id, explorer_id: *explorers.at(1) })
}
pub fn transfer(source: ExplorerKey, target: ExplorerKey, troops: u128) -> Command {
    Command::ManageTroops(
        crate::troop_management::ManageTroops::Transfer(
            crate::troop_management::TransferTroops {
                source: crate::troop_management::Army::Explorer(source.explorer_id),
                target: crate::troop_management::Army::Explorer(target.explorer_id),
                amount: troops * RESOURCE_PRECISION,
            },
        ),
    )
}
pub // A free home-ring neighbour and the direction to it.
fn free_ring_neighbor(
    map: IMapLogicDispatcher, game_id: u32, from: crate::troops::Coord, site: crate::troops::Coord, spacing: u32,
) -> (u8, crate::troops::Coord) {
    let mut found = Option::None;
    for direction in 0_u8..6 {
        let coord = crate::geometry::neighbor(from, direction);
        if found.is_none()
            && coord != site
            && crate::expeditions::is_home_ring(coord, spacing)
            && map.tile(crate::geometry::tile_key(game_id, coord)).is_some()
            && map.occupancy(crate::geometry::tile_key(game_id, coord)).is_none() {
            found = Some((direction, coord));
        }
    }
    found.expect('no free ring neighbour')
}
pub fn assert_expedition_capture(depth: u8) {
    assert_capture_with_reveal(
        depth,
        1000 * RESOURCE_PRECISION,
        crate::troops::TroopTier::T1,
        (100 + Into::<u8, u128>::into(depth) * 50) * RESOURCE_PRECISION,
    );
}
pub fn assert_capture_with_reveal(depth: u8, count: u128, tier: crate::troops::TroopTier, reveal_amount: u128) {
    assert_capture_at(depth, count, tier, reveal_amount, false, None);
}
pub // Search roll inputs, never the gameplay clock. Every chosen input is passed to the action unchanged.
fn discovery_root(
    game_id: u32,
    rules: crate::expeditions::FrontierDiscoveryRules,
    empty_reveals: u8,
    chest: Option<SiteChest>,
    expected: crate::discovery::Discovery,
) -> u256 {
    for sample in 0_u64..10000 {
        let raw_root: u256 = sample.into();
        let mut root = raw_root;
        let seed = crate::random::game_root(ref root, game_id);
        if crate::discovery::frontier(rules, 0, 0, 0, empty_reveals, chest, seed) == expected {
            return raw_root;
        }
    }
    panic!("no matching discovery root in bounded fixture search")
}
pub fn explore_with_root(d: super::Deployment, game_id: u32, explorer_id: u64, root: u256, timestamp: u64) -> bool {
    super::play_fixture::play(
        d.games,
        super::play_fixture::TestAction {
            game_id, actor: d.actor, command: Command::Explore(Explore { explorer_id, direction: 0 }),
        },
        root,
        timestamp,
    )
}
pub // Settles on day 1's first second and captures in its first minute, or with `late` in its last.
fn assert_capture_at(
    depth: u8, count: u128, tier: crate::troops::TroopTier, reveal_amount: u128, late: bool, labor_room: Option<u128>,
) {
    let d = setup();
    let mut preset = definition(true);
    // Isolate the reveal/capture delta from the realm's passive labor and Essence.
    let mut resource_rules = array![];
    for rule in preset.resources.resources {
        resource_rules
            .append(
                ResourceRule {
                    realm_rate: if *rule.resource_type == crate::resources::LABOR
                        || *rule.resource_type == crate::resources::ESSENCE {
                        0
                    } else {
                        *rule.realm_rate
                    },
                    ..*rule,
                },
            );
    }
    preset.resources.resources = resource_rules.span();
    open_entry(ref preset);
    preset.rules.day_unit_seconds = FRONTIER_DAY_UNIT;
    preset.economy.discovery = Some(super::preset_projection::frontier_discovery_rules());
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    if labor_room.is_some() {
        preset.structures.board = frontier.structures.board;
        preset.structures.research = frontier.structures.research;
    }
    preset.economy.chests = frontier.economy.chests;
    preset.economy.labor = frontier.economy.labor;
    preset.economy.relics = array![].span();
    preset.settlement.depths = frontier.settlement.depths;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DEPTH_CONTENTS;
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset.rules.mode_rules = HOME_REWARDS
        | DISCOVER_CAMPS
        | crate::rules::UNOWNED_TARGETS
        | crate::rules::DEPTH_CONTENTS
        | crate::rules::REVEAL_SUPPLIES;
    preset.exploration = array![].span();
    preset.settlement.spacing = 1024;
    preset.rules.troop_limit_config.camp_armies = 0;
    preset.rules.troop_limit_config.starting_guard = 0;
    preset.rules.troop_limit_config.settlement_deployment_cap = 3000;
    preset.rules.troop_limit_config.t1_tier_modifier = 100;
    preset.rules.troop_limit_config.t2_tier_strength = 3;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    preset
        .rules
        .troop_stamina_config =
            crate::rules::TroopStaminaConfig {
                stamina_initial: 150,
                stamina_gain_per_tick: 0,
                stamina_knight_max: 150,
                stamina_attack_req: 50,
                stamina_explore_stamina_cost: 30,
                stamina_bonus_value: 0,
                damage_stamina_refund: false,
                capture_stamina_refund: 25,
                ..preset.rules.troop_stamina_config,
            };
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset
        .economy
        .discovery =
            Some(
                crate::expeditions::FrontierDiscoveryRules {
                    camp_bps: 4000,
                    rift_bps: 1,
                    ruin_bps: 1,
                    beasts_bps: 0,
                    shrine_bps: 0,
                    well_bps: 0,
                    empty_reveal_limit: 7,
                },
            );
    preset.rules.map_config.camp_fail_probability = 0;
    let mut depths = array![];
    for index in 0_u16..4 {
        depths
            .append(
                crate::expeditions::DepthRules {
                    ruin_guard_lower: 2000,
                    ruin_guard_upper: 4000,
                    guard_step: 1,
                    beast_weak_lower: 1,
                    beast_weak_upper: 1,
                    beast_strong_lower: 2,
                    beast_strong_upper: 2,
                    reveal_percent: 10 + index * 5,
                    site_guard_lower: index + 3,
                    site_guard_upper: index + 3,
                    reveal_site_neighbors: false,
                    entry_stamina: 0,
                    chest: ChestTiers { common: 10000, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
                },
            );
    }
    preset.settlement.depths = depths.span();
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams {
                dev_mode_on: true, end_grace_seconds: 0, duration_seconds: FRONTIER_BAG_SECONDS, ..params(false),
            },
        );
    let opening = day_start(d, game_id, 1);
    let capture_at = if late {
        day_start(d, game_id, 2) - 60
    } else {
        opening + 60
    };
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    super::play_fixture::reserve_fixture_homes(d.games, game_id, d.actor);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            opening,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    resources
        .grant_resource(
            home,
            26,
            1000 * RESOURCE_PRECISION,
            opening,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: opening, ..crate::tests::context(d.games, (home).game_id),
                },
            ),
        );
    stop_cheat_caller_address(d.games);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer {
                    slot: 0, structure_id: 1, category: 0, tier: 0, amount: 1000 * RESOURCE_PRECISION, direction: 0,
                },
            ),
            opening + 1,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let army_key = ExplorerKey { game_id, explorer_id };
    let mut army = troops.resolved_explorer(army_key).unwrap();
    let map = IMapLogicDispatcher { contract_address: d.games };
    army.troops.count = count;
    army.troops.tier = tier;
    let original = army.coord;
    army.coord.y += Into::<u8, u32>::into(depth) * preset.settlement.spacing;
    if depth != 0 {
        start_cheat_caller_address(d.games, d.games);
        let occupier = map.occupancy(crate::geometry::tile_key(game_id, original)).unwrap().category;
        map.vacate(crate::geometry::tile_key(game_id, original), explorer_id);
        let location = crate::geometry::tile_key(game_id, army.coord);
        map
            .reveal(
                location,
                map
                    .biome(
                        location,
                        crate::commands::biome_context(
                            crate::commands::ExecutionContext {
                                timestamp: 100, ..crate::tests::context(d.games, (location).game_id),
                            },
                        ),
                    ),
            );
        map.occupy(location, explorer_id, occupier, false);
        stop_cheat_caller_address(d.games);
    }
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: game_id.into(), explorer_id: explorer_id }, army,
    );
    let labor_supply = ResourceSlot { game_id, entity_id: 1, resource_type: 23 };
    let essence_supply = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    let before_supplies = resources.resource_balance(labor_supply) + resources.resource_balance(essence_supply);
    let discovery_rules = preset.economy.discovery.unwrap();
    let root = discovery_root(game_id, discovery_rules, 0, None, crate::discovery::Discovery::Camp);
    let reveal_at = opening + 2;
    assert!(reveal_at < capture_at, "camp draw must precede the fixture capture");
    assert!(explore_with_root(d, game_id, explorer_id, root, reveal_at));
    let coord = crate::geometry::neighbor(army.coord, 0);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let _tile = map.tile(crate::geometry::tile_key(game_id, coord)).unwrap();
    let camp_id = map.occupancy(crate::geometry::tile_key(game_id, coord)).unwrap().entity_id;
    // An explore's reveal and the site placed on it keep the biome the terrain derives for them.
    assert!(super::terrain::assert_biomes_match_terrain(d, game_id, array![army.coord, coord].span()) != 0);
    let camp = ResourceKey { game_id, entity_id: camp_id };
    assert_eq!(structures.structure(camp).unwrap().base.category, crate::taxonomy::CAMP_CATEGORY);
    assert_eq!(structures.structure(camp).unwrap().base.troop_max_explorer_count, 0);
    assert_eq!(troops.resolved_explorer(army_key).unwrap().coord, army.coord);
    assert_eq!(
        resources.resource_balance(labor_supply) + resources.resource_balance(essence_supply) - before_supplies,
        reveal_amount,
    );
    let guards = IGuardsDispatcher { contract_address: d.games };
    assert_eq!(
        guards.guard(GuardKey { game_id, structure_id: camp_id, slot: 0 }).troops.count,
        (Into::<u8, u128>::into(depth) + 3) * RESOURCE_PRECISION,
    );
    let essence = ResourceSlot { game_id, entity_id: 1, resource_type: 38 };
    if let Some(room) = labor_room {
        let limit = snforge_std::interact_with_state(
            d.games, || crate::logic::resources::store_limit(home, crate::resources::LABOR).unwrap(),
        );
        super::resource_commands::set_fixture(
            d.games,
            selector!("resources"),
            selector!("balances"),
            array![game_id.into(), home.entity_id.into(), crate::resources::LABOR.into()].span(),
            limit - room,
        );
    }
    let mut home_before = array![];
    for resource_type in 1_u8..39 {
        home_before.append(resources.resource_balance(ResourceSlot { resource_type, ..essence }));
    }
    let site_before = snforge_std::interact_with_state(
        d.games, || {
            crate::logic::expeditions::expedition_site(camp).unwrap()
        },
    );
    assert_eq!(site_before.initial_guard_count, (Into::<u8, u128>::into(depth) + 3) * RESOURCE_PRECISION);
    assert!(site_before.clear.is_none());
    assert_eq!(site_before.category, crate::taxonomy::CAMP_CATEGORY);
    assert_eq!((site_before.col, site_before.row, site_before.alt), (coord.x, coord.y, coord.alt));
    let camp_credit = labor_room.unwrap_or(site_before.initial_guard_count / 2);
    let camp_reward = Some(
        crate::resources::ResourceAmount { resource_type: crate::resources::LABOR, amount: camp_credit },
    );
    let attack = Command::BattleGuard(crate::commands::Battle { attacker_id: explorer_id, defender_id: camp_id });
    let mut payout_events = snforge_std::spy_events();
    assert!(execute_in_game(d, game_id, attack, capture_at));
    assert_site_removed(d, camp);
    assert_eq!(troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount, 95);
    let site_after = snforge_std::interact_with_state(
        d.games, || {
            crate::logic::expeditions::expedition_site(camp).unwrap()
        },
    );
    assert_eq!(
        site_after,
        crate::expeditions::ExpeditionSite {
            clear: Some(crate::expeditions::SiteClear { explorer_id, home_id: home.entity_id, reward: camp_reward }),
            ..site_before,
        },
    );
    assert!(map.occupancy(crate::geometry::tile_key(game_id, coord)).is_none());
    assert_eq!(map.tile(crate::geometry::tile_key(game_id, coord)).unwrap(), _tile);
    for resource_type in 1_u8..39 {
        let reward = if resource_type == crate::resources::LABOR {
            camp_credit
        } else {
            0
        };
        assert_eq!(
            resources.resource_balance(ResourceSlot { resource_type, ..essence }),
            *home_before.at((resource_type - 1).into()) + reward,
        );
    }
    assert!(!execute_in_game(d, game_id, attack, capture_at));
    assert_eq!(troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount, 95);
    let mut relics = 0_u128;
    for id in 39_u8..57 {
        relics += resources.resource_balance(ResourceSlot { game_id, entity_id: explorer_id, resource_type: id });
    }
    assert_eq!(relics, 0);
    let mine_coord = crate::geometry::neighbor(army.coord, 1);
    start_cheat_block_timestamp_global(capture_at + 1);
    start_cheat_caller_address(d.games, d.games);
    let mine_id = structures
        .create_discovery(
            game_id,
            1,
            mine_coord,
            crate::discovery::Discovery::Rift,
            101,
            capture_at + 1,
            crate::commands::action_context(
                crate::commands::ExecutionContext {
                    timestamp: capture_at + 1, ..crate::tests::context(d.games, game_id),
                },
            ),
        );
    stop_cheat_caller_address(d.games);
    let mine = ResourceSlot { game_id, entity_id: mine_id, resource_type: 38 };
    assert_eq!(resources.resource_production(mine), Default::default());
    let before_rift = resources.resource_balance(essence);
    let rift = snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::expeditions::expedition_site(ResourceKey { game_id, entity_id: mine_id }).unwrap()
        },
    );
    assert_eq!(
        structures.structure(ResourceKey { game_id, entity_id: mine_id }).unwrap().base.category,
        crate::taxonomy::RIFT_CATEGORY,
    );
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::BattleGuard(crate::commands::Battle { attacker_id: explorer_id, defender_id: mine_id }),
            capture_at + 1,
        ),
    );
    assert_eq!(troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount, 70);
    assert_site_removed(d, ResourceKey { game_id, entity_id: mine_id });
    let mut total_relics = 0_u128;
    for id in 39_u8..57 {
        total_relics += resources.resource_balance(ResourceSlot { game_id, entity_id: explorer_id, resource_type: id });
    }
    assert_eq!(total_relics, 0);
    assert_eq!(resources.resource_balance(essence) - before_rift, rift.initial_guard_count * 3);
    let baseline = resources.resource_balance(essence);
    for time in array![capture_at + 4, capture_at + 29, capture_at + 89, capture_at + 139] {
        start_cheat_block_timestamp_global(time);
        start_cheat_caller_address(d.games, d.games);
        // The home earns nothing further, and the cleared site has no resource owner.
        resources
            .grant_resource(
                home,
                38,
                0,
                time,
                crate::commands::resource_context(
                    crate::commands::ExecutionContext {
                        timestamp: time, ..crate::tests::context(d.games, (home).game_id),
                    },
                ),
            );
        stop_cheat_caller_address(d.games);
        assert_eq!(resources.resource_balance(essence), baseline);
        assert!(!resources.has_resource(ResourceKey { game_id, entity_id: mine_id }));
    }
    let mut paid = 0;
    for (_, event) in payout_events.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            if let crate::ownership::Story::StructureCapturedStory(_) = story.story {
                panic!("clear is not a capture");
            }
            if let crate::ownership::Story::SitePayout(payout) = story.story {
                paid += 1;
                assert_eq!(story.owner, Some(d.actor));
                assert_eq!(story.entity_id, Some(payout.site_id));
                assert_eq!(payout.structure_id, home.entity_id);
                assert_eq!(payout.explorer_id, explorer_id);
                let (category, expected) = if payout.site_id == camp_id {
                    (crate::taxonomy::CAMP_CATEGORY, site_before)
                } else {
                    assert_eq!(payout.site_id, mine_id);
                    (crate::taxonomy::RIFT_CATEGORY, rift)
                };
                assert_eq!(payout.category, category);
                assert_eq!(
                    payout.reward,
                    if payout.site_id == camp_id {
                        camp_reward
                    } else {
                        crate::expeditions::site_reward(category, expected)
                    },
                );
            }
        }
    }
    assert_eq!(paid, 2);
    if labor_room.is_none() && !late && depth == 0 && count == 1000
        * RESOURCE_PRECISION && tier == crate::troops::TroopTier::T1 {
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::Move(crate::commands::Move { explorer_id, directions: array![0].span() }),
                capture_at + 140,
            ),
        );
        assert_eq!(troops.resolved_explorer(army_key).unwrap().coord, coord);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::Move(crate::commands::Move { explorer_id, directions: array![3].span() }),
                capture_at + 141,
            ),
        );
        assert_eq!(troops.resolved_explorer(army_key).unwrap().coord, army.coord);
        let retained = snforge_std::interact_with_state(d.games, || crate::logic::expeditions::expedition_site(camp));
        assert_eq!(retained, Some(site_after));
    }
}
pub fn setup_frontier_chests() -> (super::Deployment, u32, ExplorerKey) {
    setup_frontier_chests_with_rules(None)
}
pub fn setup_frontier_chests_with_rules(
    discovery: Option<crate::expeditions::FrontierDiscoveryRules>,
) -> (super::Deployment, u32, ExplorerKey) {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    let result = setup_frontier_chests_with_preset(discovery, frontier);
    let (d, game_id, _) = result;
    publish_test_pool(d, game_id, 1000000, 350);
    result
}
pub fn setup_unfunded_frontier_chests() -> (super::Deployment, u32, ExplorerKey) {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    setup_frontier_chests_with_preset(None, frontier)
}
pub fn publish_test_pool(d: super::Deployment, game_id: u32, amount: u128, timestamp: u64) {
    super::entry::set_operator(d, super::authority());
    start_cheat_caller_address(d.games, super::authority());
    snforge_std::start_cheat_block_timestamp(d.games, timestamp);
    crate::entry::ILedgerOperatorDispatcherTrait::publish_frontier_pool(
        crate::entry::ILedgerOperatorDispatcher { contract_address: d.games }, game_id, amount,
    );
    snforge_std::stop_cheat_block_timestamp(d.games);
    stop_cheat_caller_address(d.games);
}
pub fn setup_frontier_chests_with_preset(
    discovery: Option<crate::expeditions::FrontierDiscoveryRules>, frontier: PresetDefinition,
) -> (super::Deployment, u32, ExplorerKey) {
    let chests = frontier.economy.chests.unwrap();
    let ground = *frontier.settlement.depths.at(0).chest;
    let d = setup();
    let mut preset = definition(true);
    open_entry(ref preset);
    preset.rules.day_unit_seconds = DAY_UNIT;
    preset.rules.tick_config.armies_tick_in_seconds = 60;
    preset
        .economy
        .discovery =
            Some(
                crate::expeditions::FrontierDiscoveryRules {
                    camp_bps: 1,
                    rift_bps: 0,
                    ruin_bps: 0,
                    beasts_bps: 4000,
                    shrine_bps: 0,
                    well_bps: 0,
                    empty_reveal_limit: 7,
                },
            );
    preset.rules.map_config.camp_win_probability = 0;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.economy.progression = Some(super::preset_projection::frontier_progression_rules());
    preset
        .rules
        .command_mask = (*read_txt(@FileTrait::new("../fixtures/frontier-command-mask.txt")).at(0))
        .try_into()
        .unwrap();
    preset.rules.mode_rules = DISCOVER_CAMPS
        | crate::rules::UNOWNED_TARGETS
        | HOME_REWARDS
        | DISCOVER_CHESTS
        | crate::rules::REVEAL_SUPPLIES
        | crate::rules::DEPTH_CONTENTS;
    preset.exploration = array![].span();
    preset.settlement.spacing = 1024;
    preset.rules.troop_limit_config.starting_guard = 0;
    preset.rules.troop_limit_config.settlement_armies = 2;
    preset.rules.map_config.shards_mines_win_probability = 0;
    preset.rules.map_config.shards_mines_fail_probability = 1;
    preset.rules.troop_stamina_config.stamina_initial = 150;
    preset.rules.troop_stamina_config.stamina_knight_max = 150;
    preset.rules.troop_stamina_config.stamina_gain_per_tick = 0;
    preset.rules.troop_stamina_config.stamina_explore_stamina_cost = 1;
    preset.rules.troop_stamina_config.stamina_explore_wheat_cost = 0;
    preset.rules.troop_stamina_config.stamina_explore_fish_cost = 0;
    preset.rules.troop_stamina_config.stamina_travel_wheat_cost = 0;
    preset.rules.troop_stamina_config.stamina_travel_fish_cost = 0;
    preset.rules.battle_config.cooldown_seconds = 0;
    preset.rules.battle_config.regular_immunity_ticks = 0;
    let mut depths = array![];
    for _depth in 0_u16..4 {
        depths
            .append(
                crate::expeditions::DepthRules {
                    ruin_guard_lower: 2000,
                    ruin_guard_upper: 4000,
                    guard_step: 1,
                    beast_weak_lower: 1,
                    beast_weak_upper: 1,
                    beast_strong_lower: 2,
                    beast_strong_upper: 2,
                    reveal_percent: 1,
                    site_guard_lower: 3,
                    site_guard_upper: 3,
                    reveal_site_neighbors: false,
                    entry_stamina: 0,
                    chest: ground,
                },
            );
    }
    preset.settlement.depths = depths.span();
    preset.economy.chests = Some(chests);
    preset.economy.labor = frontier.economy.labor;
    preset.economy.relics = array![].span();
    if let Some(discovery) = discovery {
        preset.economy.discovery = Some(discovery);
    }
    registry(d).register_preset(1, preset);
    let game_id = registry(d)
        .create_game(
            CreateGameParams {
                dev_mode_on: true, end_grace_seconds: 0, duration_seconds: 2 * BAG_SECONDS, ..params(false),
            },
        );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("catalogue_count"), array![].span(), 8000_u32,
    );
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), 0x4000001_u32,
    );
    super::play_fixture::reserve_fixture_homes(d.games, game_id, d.actor);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { name: 'home', selected_realm: Some(1) }),
            350,
        ),
    );
    let home = ResourceKey { game_id, entity_id: 1 };
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, d.games);
    resources
        .grant_resource(
            home,
            26,
            10 * RESOURCE_PRECISION,
            350,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 350, ..crate::tests::context(d.games, (home).game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    let muster = Command::CreateExplorer(
        CreateExplorer { slot: 0, structure_id: 1, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0 },
    );
    assert!(execute_in_game(d, game_id, muster, 351));
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.home_armies(home).at(0);
    (d, game_id, ExplorerKey { game_id, explorer_id })
}
pub fn assert_zero_pool_never_funds_a_ruin_or_payout_over_a_day() {
    let (_, frontier) = super::preset_projection::current_definition("frontier");
    let rules = ruin_discovery_rules();
    let (d, game_id, key) = setup_frontier_chests_with_preset(Some(rules), frontier);
    let army = strong_frontier_army(d, game_id, key);
    let (ruin, _) = reveal_ruin(d, key, rules, 360);
    let budget = IRelicsDispatcher { contract_address: d.games }.lords_budget(game_id).unwrap();
    assert_eq!((budget.pool, budget.pool_left, budget.open), (0, 0, 0));
    let before = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let mut refused = snforge_std::spy_events();
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::BattleGuard(crate::commands::Battle { attacker_id: key.explorer_id, defender_id: ruin.entity_id }),
            361,
        ),
    );
    assert_eq!(super::play_fixture::rejection(ref refused, d.games).reason, "day's LORDS budget cannot fund this ruin");
    assert_eq!(GameState { contract_address: d.games }.resolved_explorer(key).unwrap(), before);
    assert!(IStructureOperationsDispatcher { contract_address: d.games }.structure(ruin).is_some());
    assert_eq!(
        IResourceOperationsDispatcher { contract_address: d.games }
            .resource_balance(ResourceSlot { game_id, entity_id: army.owner, resource_type: crate::resources::LORDS }),
        0,
    );
}
pub // Any chest a draw can carry; its tier and amount never change the draw.
 fn any_chest() -> SiteChest {
    SiteChest { tier: 0, amount: 50, reservation_day: 0 }
}
pub const CHEST: SiteChest = SiteChest { tier: 3, amount: 500, reservation_day: 0 };
pub fn strong_frontier_army(d: super::Deployment, game_id: u32, key: ExplorerKey) -> crate::troops::ExplorerTroops {
    let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    army.troops.count = 100000 * RESOURCE_PRECISION;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .change_explorer_capacity(
            ResourceKey { game_id, entity_id: key.explorer_id },
            99999 * RESOURCE_PRECISION,
            true,
            crate::commands::resource_context(crate::tests::context(d.games, game_id)),
        );
    stop_cheat_caller_address(d.games);
    army
}
pub fn place_ruin(d: super::Deployment, game_id: u32, coord: crate::troops::Coord, chest: SiteChest) -> ResourceKey {
    let context = crate::commands::ExecutionContext { timestamp: 360, ..crate::tests::context(d.games, game_id) };
    start_cheat_caller_address(d.games, d.games);
    let site = IStructureOperationsDispatcher { contract_address: d.games }
        .create_discovery(
            game_id,
            1,
            coord,
            crate::discovery::Discovery::Ruin(chest),
            123,
            360,
            crate::commands::action_context(context),
        );
    stop_cheat_caller_address(d.games);
    ResourceKey { game_id, entity_id: site }
}
pub fn ruin_discovery_rules() -> crate::expeditions::FrontierDiscoveryRules {
    crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 1, camp_bps: 0, rift_bps: 0, ruin_bps: 8000, shrine_bps: 0, well_bps: 0, empty_reveal_limit: 7,
    }
}
pub fn reveal_ruin(
    d: super::Deployment, key: ExplorerKey, rules: crate::expeditions::FrontierDiscoveryRules, timestamp: u64,
) -> (ResourceKey, u8) {
    let army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    let root = discovery_root(key.game_id, rules, 0, Some(any_chest()), crate::discovery::Discovery::Ruin(any_chest()));
    for direction in 0_u8..6 {
        let tile = crate::geometry::tile_key(key.game_id, crate::geometry::neighbor(army.coord, direction));
        let unseen = snforge_std::interact_with_state(d.games, || crate::logic::map::tile(tile).is_none());
        if !unseen {
            continue;
        }
        let mut refused = snforge_std::spy_events();
        let applied = super::play_fixture::play(
            d.games,
            super::play_fixture::TestAction {
                game_id: key.game_id,
                actor: d.actor,
                command: Command::Explore(Explore { explorer_id: key.explorer_id, direction }),
            },
            root,
            timestamp,
        );
        if !applied {
            panic!(
                "ruin Explore at {} refused: {}",
                timestamp,
                super::play_fixture::rejection(ref refused, d.games).reason,
            );
        }
        let occupied = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile).unwrap());
        assert_eq!(occupied.category, crate::taxonomy::RUIN_OCCUPIER);
        return (ResourceKey { game_id: key.game_id, entity_id: occupied.entity_id }, direction);
    }
    panic!("fixture has no unrevealed adjacent tile")
}
pub fn next_setup_entity(d: super::Deployment, game_id: u32) -> u32 {
    snforge_std::interact_with_state(d.games, || crate::state::read().games.next_entity.read(game_id))
}
pub fn assert_site_removed(d: super::Deployment, key: ResourceKey) {
    assert!(IStructureOperationsDispatcher { contract_address: d.games }.structure(key).is_none());
    let guards = IGuardsDispatcher { contract_address: d.games };
    for slot in 0_u8..4 {
        assert_eq!(
            guards.guard(GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot }), Default::default(),
        );
    }
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    assert!(!resources.has_resource(key));
}
