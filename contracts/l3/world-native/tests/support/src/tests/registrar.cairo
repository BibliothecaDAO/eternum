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
use crate::logic::release::{IReleasesDispatcher, IReleasesDispatcherTrait};
pub use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait, TileKey};
pub use crate::registrar::{
    CreateGameParams, IRegistrarDispatcher, IRegistrarDispatcherTrait, IRegistrarSafeDispatcher,
    IRegistrarSafeDispatcherTrait,
};
pub use crate::relics::ChestTiers;
pub use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey, ResourceRule, ResourceSlot,
};
pub use crate::rules::{DISCOVER_CAMPS, HOME_REWARDS, RESOURCE_PRECISION};
pub use crate::settlement::{
    ISettlementCreationDispatcher, ISettlementCreationDispatcherTrait, ISettlementViewsDispatcher,
    ISettlementViewsDispatcherTrait, RealmCreation, SettlementCreation, SettlementMode,
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
pub fn bag_seconds() -> u64 {
    crate::days::UNITS_PER_BAG * crate::balance::rules::SWITCHES.day_unit_seconds.into()
}
pub fn lore(tier: u8) -> u64 {
    let mut learned = 0;
    for _ in 0..tier {
        learned = crate::research::learn(learned, crate::research::ROW_LORE);
    }
    learned
}

pub fn learn_spire_lore(d: super::Deployment, home: crate::resources::ResourceKey, timestamp: u64) {
    let learned = snforge_std::interact_with_state(
        d.games, || crate::research::tier(crate::logic::research::learned(home), crate::research::ROW_LORE),
    );
    let budget = snforge_std::interact_with_state(
        d.games,
        || {
            let mut cost = 0;
            for tier in learned + 1..crate::research::LORE_SPIRES + 1 {
                cost += crate::logic::research::price(crate::research::ROW_LORE, tier).essence;
            }
            cost
        },
    );
    super::resource_commands::grant(d, home, crate::resources::ESSENCE, budget);
    for _ in learned..crate::research::LORE_SPIRES {
        let buy = Command::Research(
            crate::research::Research { structure_id: home.entity_id, row: crate::research::ROW_LORE },
        );
        assert!(execute_in_game(d, home.game_id, buy, timestamp), "Spire lore purchase refused");
    }
}

pub fn day_start(d: super::Deployment, game_id: u32, index: u64) -> u64 {
    let game = IGameDispatcher { contract_address: d.games }.game(game_id);
    let unit = IGameDispatcher { contract_address: d.games }.rules(game_id).day_unit_seconds;
    let mut day = crate::days::day_of(game, unit, game.start_main_at);
    while day.index != index {
        day = crate::days::day_of(game, unit, day.end);
    }
    day.start
}
pub fn expedition_home(d: super::Deployment) -> (u32, ResourceKey, u8) {
    let game_id = super::play_fixture::create_game(d.games, super::play_fixture::fixture_params('expedition'));
    let home = super::play_fixture::settled_home(d, game_id, d.actor, 1, super::play_fixture::FIXTURE_START);
    (game_id, home, held_troop(d, home).into())
}
pub fn held_troop(d: super::Deployment, home: ResourceKey) -> crate::troops::TroopType {
    let army = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
    GameState { contract_address: d.games }
        .explorer(ExplorerKey { game_id: home.game_id, explorer_id: army })
        .unwrap()
        .troops
        .category
}
pub fn muster_command(home: ResourceKey, category: u8, direction: u8, slot: u8) -> Command {
    Command::CreateExplorer(
        CreateExplorer { slot, structure_id: home.entity_id, category, tier: 0, amount: RESOURCE_PRECISION, direction },
    )
}
pub fn expedition_armies(d: super::Deployment, home: ResourceKey) -> (ExplorerKey, ExplorerKey) {
    let explorers = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
    let game_id = home.game_id;
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
// A free home-ring neighbour and the direction to it.
pub fn free_ring_neighbor(
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
pub fn grant_troop_recipe(d: super::Deployment, home: ResourceKey, troop: u8, troops: u128, timestamp: u64) {
    let recipe = crate::production::IProductionRulesDispatcherTrait::production_recipe(
        crate::production::IProductionRulesDispatcher { contract_address: d.games },
        crate::production::RecipeKey { game_id: home.game_id, resource_type: troop },
    );
    for input in recipe.simple_inputs {
        IResourceOperationsDispatcher { contract_address: d.games }
            .grant_resource(
                home,
                *input.resource_type,
                *input.amount * troops / recipe.simple_output.into(),
                timestamp,
                crate::commands::resource_context(
                    crate::commands::ExecutionContext { timestamp, ..crate::tests::context(d.games, home.game_id) },
                ),
            );
    }
}
pub fn stamina_after_capture(reveal_at: u64, capture_at: u64) -> u64 {
    let stamina = crate::balance::rules::TROOP_STAMINA_CONFIG;
    let explored: u64 = (stamina.stamina_knight_max - stamina.stamina_explore_stamina_cost).into();
    stamina_after_attack(explored, reveal_at, capture_at)
}
pub fn stamina_after_attack(bar: u64, settled_at: u64, attack_at: u64) -> u64 {
    let stamina = crate::balance::rules::TROOP_STAMINA_CONFIG;
    let tick = crate::balance::rules::TICK_CONFIG.armies_tick_in_seconds;
    let regained: u64 = (attack_at / tick - settled_at / tick) * stamina.stamina_gain_per_tick.into();
    let ready = core::cmp::min(stamina.stamina_knight_max.into(), bar + regained);
    ready - stamina.stamina_attack_req.into() + stamina.capture_stamina_refund.into()
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
// Search roll inputs, never the gameplay clock. Every chosen input is passed to the action unchanged.
pub fn discovery_root(
    game_id: u32,
    rules: crate::expeditions::FrontierDiscoveryRules,
    find_percent: u16,
    empty_reveals: u8,
    relic: Option<crate::army_relics::ArmyRelic>,
    expected: crate::discovery::Discovery,
) -> u256 {
    for sample in 0_u64..10000 {
        let raw_root: u256 = sample.into();
        let mut root = raw_root;
        let seed = crate::random::game_root(ref root, game_id);
        if crate::discovery::frontier(rules, find_percent, empty_reveals, relic, seed) == expected {
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
// Settles on day 1's first second and captures in its first minute, or with `late` in its last.
pub fn assert_capture_at(
    depth: u8, count: u128, tier: crate::troops::TroopTier, reveal_amount: u128, late: bool, labor_room: Option<u128>,
) {
    let d = setup();
    let game_id = super::play_fixture::create_game(d.games, super::play_fixture::fixture_params('capture'));
    let opening = day_start(d, game_id, 1);
    let capture_at = if late {
        day_start(d, game_id, 2) - 60
    } else {
        opening + 60
    };
    let home = super::play_fixture::settled_home(d, game_id, d.actor, 1, opening);
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.home_armies(home).at(0);
    let troops = GameState { contract_address: d.games };
    let army_key = ExplorerKey { game_id, explorer_id };
    let mut army = troops.resolved_explorer(army_key).unwrap();
    let map = IMapLogicDispatcher { contract_address: d.games };
    army.troops.count = count;
    army.troops.tier = tier;
    let original = army.coord;
    army.coord.y += Into::<u8, u32>::into(depth) * crate::logic::settlement::spacing();
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
                                timestamp: opening, ..crate::tests::context(d.games, (location).game_id),
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
    let labor_supply = ResourceSlot { game_id, entity_id: home.entity_id, resource_type: crate::resources::LABOR };
    let essence_supply = ResourceSlot { game_id, entity_id: home.entity_id, resource_type: crate::resources::ESSENCE };
    let reveal_at = opening + 2;
    for resource_type in array![crate::resources::LABOR, crate::resources::ESSENCE] {
        super::frontier_economy::settle(d, home, resource_type, reveal_at);
    }
    let before_supplies = resources.resource_balance(labor_supply) + resources.resource_balance(essence_supply);
    let root = discovery_root(
        game_id, home_discovery(d, home), 100, 0, Some(any_relic()), crate::discovery::Discovery::Camp,
    );
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
    let guard = guards.guard(GuardKey { game_id, structure_id: camp_id, slot: 0 }).troops.count;
    assert_on_site_guard_grid(depth, guard);
    let essence = essence_supply;
    super::frontier_economy::settle(d, home, crate::resources::LABOR, capture_at);
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
    assert_eq!(site_before.initial_guard_count, guard);
    strong_frontier_army(d, game_id, army_key);
    assert!(site_before.clear.is_none());
    assert_eq!(site_before.category, crate::taxonomy::CAMP_CATEGORY);
    assert_eq!((site_before.col, site_before.row, site_before.alt), (coord.x, coord.y, coord.alt));
    let labor_limit = snforge_std::interact_with_state(
        d.games, || crate::logic::resources::store_limit(home, crate::resources::LABOR).unwrap(),
    );
    let store_room = labor_limit - resources.resource_balance(labor_supply);
    let camp_credit = labor_room
        .unwrap_or(
            core::cmp::min(site_before.initial_guard_count / 2 * (2 + Into::<u8, u128>::into(depth)) / 2, store_room),
        );
    let camp_reward = Some(
        crate::resources::ResourceAmount { resource_type: crate::resources::LABOR, amount: camp_credit },
    );
    let attack = Command::BattleGuard(
        crate::commands::Battle { attacker_id: explorer_id, defender_id: camp_id, relic_slot: None },
    );
    let mut payout_events = snforge_std::spy_events();
    super::resource_commands::assert_executes(d, game_id, attack, capture_at);
    assert_site_removed(d, camp);
    assert_eq!(
        troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount,
        stamina_after_capture(reveal_at, capture_at),
    );
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
    assert_eq!(
        map.occupancy(crate::geometry::tile_key(game_id, coord)),
        Some(
            crate::map::TileOccupancy {
                entity_id: camp_id, category: crate::taxonomy::SUPPLY_POST_OCCUPIER, is_structure: true,
            },
        ),
    );
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
    assert_eq!(
        troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount,
        stamina_after_capture(reveal_at, capture_at),
    );
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
    super::resource_commands::assert_executes(
        d,
        game_id,
        Command::BattleGuard(
            crate::commands::Battle { attacker_id: explorer_id, defender_id: mine_id, relic_slot: None },
        ),
        capture_at + 1,
    );
    assert_eq!(
        troops.resolved_explorer(army_key).unwrap().troops.stamina.inline().amount,
        stamina_after_attack(stamina_after_capture(reveal_at, capture_at), capture_at, capture_at + 1),
    );
    assert_site_removed(d, ResourceKey { game_id, entity_id: mine_id });
    let mut total_relics = 0_u128;
    for id in 39_u8..57 {
        total_relics += resources.resource_balance(ResourceSlot { game_id, entity_id: explorer_id, resource_type: id });
    }
    assert_eq!(total_relics, 0);
    assert_eq!(
        resources.resource_balance(essence) - before_rift,
        rift.initial_guard_count * 3 * (2 + Into::<u8, u128>::into(depth)) / 2,
    );
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
                        crate::expeditions::site_reward(category, expected, depth, false)
                    },
                );
            }
        }
    }
    assert_eq!(paid, 2);
    if labor_room.is_none() && !late && depth == 0 && count == 1000
        * RESOURCE_PRECISION && tier == crate::troops::TroopTier::T1 {
        let mut survivors = troops.resolved_explorer(army_key).unwrap();
        survivors.troops.count = count;
        crate::tests::resource_commands::set_explorer_fixture(d.games, army_key, survivors);
        let mut refused = snforge_std::spy_events();
        assert!(
            !execute_in_game(
                d,
                game_id,
                Command::Move(crate::commands::Move { explorer_id, directions: array![0].span() }),
                capture_at + 140,
            ),
        );
        assert_eq!(super::play_fixture::rejection(ref refused, d.games).reason, "movement tile occupied");
        assert_eq!(troops.resolved_explorer(army_key).unwrap().coord, army.coord);
        let retained = snforge_std::interact_with_state(d.games, || crate::logic::expeditions::expedition_site(camp));
        assert_eq!(retained, Some(site_after));
    }
}
pub fn setup_frontier_relics() -> (super::Deployment, u32, ExplorerKey) {
    let d = setup();
    let (game_id, home, _) = expedition_home(d);
    let (army, _) = expedition_armies(d, home);
    (d, game_id, army)
}

pub fn any_relic() -> crate::army_relics::ArmyRelic {
    RELIC
}
pub const RELIC: crate::army_relics::ArmyRelic = crate::army_relics::ArmyRelic {
    kind: crate::army_relics::RelicKind::Blade, rank: 1,
};
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
pub fn home_discovery(d: super::Deployment, home: ResourceKey) -> crate::expeditions::FrontierDiscoveryRules {
    snforge_std::interact_with_state(
        d.games, || crate::logic::discovery::lore_rules(crate::logic::research::require(home).learned),
    )
}
pub fn assert_on_site_guard_grid(depth: u8, guard: u128) {
    let rules = crate::logic::expeditions::depth_rules(depth);
    let count = guard / RESOURCE_PRECISION;
    let (lower, upper): (u128, u128) = (rules.site_guard_lower.into(), rules.site_guard_upper.into());
    assert!(guard % RESOURCE_PRECISION == 0 && lower <= count && count <= upper, "guard outside the depth's range");
    assert_eq!((count - lower) % rules.guard_step.into(), 0);
}
pub fn place_ruin(
    d: super::Deployment,
    home: ResourceKey,
    coord: crate::troops::Coord,
    relic: crate::army_relics::ArmyRelic,
    timestamp: u64,
) -> ResourceKey {
    let context = crate::commands::ExecutionContext { timestamp, ..crate::tests::context(d.games, home.game_id) };
    start_cheat_caller_address(d.games, d.games);
    let site = IStructureOperationsDispatcher { contract_address: d.games }
        .create_discovery(
            home.game_id,
            home.entity_id,
            coord,
            crate::discovery::Discovery::Ruin(relic),
            123,
            timestamp,
            crate::commands::action_context(context),
        );
    stop_cheat_caller_address(d.games);
    ResourceKey { game_id: home.game_id, entity_id: site }
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

pub fn setup_open_frontier() -> (super::Deployment, u32) {
    setup_open_frontier_for(super::play_fixture::FIXTURE_SEASON_SECONDS)
}

pub fn setup_open_frontier_for(duration_seconds: u64) -> (super::Deployment, u32) {
    let d = setup();
    let game_id = super::play_fixture::create_game(
        d.games, CreateGameParams { duration_seconds, ..super::play_fixture::fixture_params('open-frontier') },
    );
    let mut traits = array![];
    for _ in 0..crate::realms::CANONICAL_REALM_COUNT {
        traits.append(0x4000001);
    }
    super::realms::seed_catalogue(d, traits.span());
    (d, game_id)
}

pub fn apply_ruin_depth_release(d: super::Deployment, game_id: u32) {
    let releases = IReleasesDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, super::authority());
    for release_id in 2..crate::logic::release::RUIN_DEPTH_LIMIT_RELEASE + 1 {
        releases
            .register_release(
                release_id,
                crate::logic::release::Release { previous: release_id - 1, ..releases.release(1) },
                releases.release_classes(1),
            );
        releases.apply_release(game_id, release_id);
    }
    stop_cheat_caller_address(d.games);
}

pub fn aspect_order(aspect: u8) -> u8 {
    order_in_aspect(crate::logic::aspects::rules(), aspect)
}

pub fn order_in_aspect(orders: u128, aspect: u8) -> u8 {
    for order in 1_u8..17 {
        if crate::aspects::order_aspect(orders, order) == aspect {
            return order;
        }
    }
    panic!("Aspect has no Order")
}
