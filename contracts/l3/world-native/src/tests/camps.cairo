use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use crate::camps::{ICampRulesSafeDispatcher, ICampRulesSafeDispatcherTrait};
use crate::commands::{Command, CreateExplorer, Explore};
use crate::discovery::{Discovery, surface};
use crate::game::{IGameDispatcherTrait, IPointsDispatcherTrait};
use crate::geometry::{neighbor, tile_key};
use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use crate::map::IMapLogicDispatcher;
use crate::registrar::IRegistrarSafeDispatcherTrait;
use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait};
use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
use crate::troops::{Coord, ExplorerKey, TroopTier, TroopType};
use super::resource_commands::{execute, execute_recorded_at, grant, setup_with_rules};

pub fn rules(blitz: bool) -> crate::rules::SliceRules {
    let mut rules = super::recorded::rules();
    rules.mode_rules = if blitz {
        super::recorded::BLITZ_RULES
    } else {
        super::recorded::ETERNUM_RULES
    };
    rules
        .command_mask = if blitz {
            super::recorded::BLITZ_COMMAND_MASK
        } else {
            super::recorded::ETERNUM_COMMAND_MASK
        };
    rules.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    rules.map_config.hyps_win_prob = 0;
    rules.map_config.hyps_fail_prob = 1;
    rules.map_config.shards_mines_win_probability = 0;
    rules.map_config.shards_mines_fail_probability = 1;
    rules.map_config.camp_win_probability = 1;
    rules.map_config.camp_fail_probability = 0;
    rules.map_config.relic_discovery_interval_sec = 60000;
    rules
}
fn setup(blitz: bool) -> (super::Deployment, ResourceKey) {
    let mut preset = super::resource_commands::fixture_preset(rules(blitz));
    preset.structures.buildings = super::building_commands::rules();
    preset.structures.board = None;
    preset
        .structures
        .camps =
            array![ResourceAmount { resource_type: 1, amount: 100 }, ResourceAmount { resource_type: 2, amount: 20 }]
        .span();
    preset
        .exploration =
            array![
                crate::exploration_rewards::ExplorationReward {
                    resource_type: 2, amount: 10, amount_max: 10, weight: 1,
                },
            ]
        .span();
    let (d, home, _) = super::resource_commands::setup_with_preset(preset);
    (d, home)
}
fn coord() -> Coord {
    Coord { alt: false, x: 2000100, y: 2000100 }
}
fn create(d: super::Deployment, coord: Coord) -> ResourceKey {
    start_cheat_block_timestamp_global(30);
    start_cheat_caller_address(d.games, d.games);
    let id = IStructureOperationsDispatcher { contract_address: d.games }
        .create_discovery(
            3,
            coord,
            Discovery::Camp,
            101,
            30,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(d.games, 3) },
            ),
        );
    stop_cheat_caller_address(d.games);
    ResourceKey { game_id: 3, entity_id: id }
}
#[test]
fn camp_lottery_obeys_discoverable_rules_after_mines() {
    let mut config = rules(true).map_config;
    for seed in 0_u64..32 {
        assert_eq!(surface(config, seed.into(), 30, 1, 0, crate::rules::DISCOVER_CAMPS), Discovery::Camp);
        assert_eq!(surface(config, seed.into(), 30, 1, 0, crate::rules::DISCOVER_HYPERSTRUCTURES), Discovery::None);
    }
    config.camp_win_probability = 3;
    config.camp_fail_probability = 7;
    for seed in 0_u64..32 {
        let won = crate::random::lottery(seed.into(), 7, 3, 7, 30);
        assert_eq!(
            surface(config, seed.into(), 30, 1, 0, crate::rules::DISCOVER_CAMPS),
            if won {
                Discovery::Camp
            } else {
                Discovery::None
            },
        );
    }
    config.hyps_win_prob = 1;
    config.hyps_fail_prob = 0;
    config.hyps_fail_prob_increase_p_hex = 10000;
    config.shards_mines_win_probability = 1;
    config.shards_mines_fail_probability = 0;
    assert_eq!(surface(config, 101, 30, 0, 0, crate::rules::DISCOVER_CAMPS), Discovery::Mine);
    assert_eq!(surface(config, 101, 30, 0, 0, crate::rules::DISCOVER_HYPERSTRUCTURES), Discovery::Hyperstructure);
}
#[test]
fn camps_grant_configured_resources_labor_and_one_crossbow_guard() {
    let (d, _) = setup(true);
    let key = create(d, coord());
    let structure = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    assert_eq!(structure.owner, 0.try_into().unwrap());
    assert_eq!(structure.base.category, crate::camps::CAMP_CATEGORY);
    assert_eq!(structure.base.level, 0);
    assert_eq!(structure.base.troop_max_guard_count, 1);
    assert_eq!(structure.base.troop_max_explorer_count, 1);
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let slot = ResourceSlot { game_id: 3, entity_id: key.entity_id, resource_type: 1 };
    assert_eq!(resources.resource_balance(slot), 100);
    assert_eq!(resources.resource_balance(ResourceSlot { resource_type: 2, ..slot }), 20);
    assert_eq!(resources.resource_weight(key).weight, 120);
    assert_eq!(
        resources.resource_weight(key).capacity,
        Into::<u64, u128>::into(rules(true).structure_capacity_config.camp_capacity) * RESOURCE_PRECISION,
    );
    let production = resources.resource_production(ResourceSlot { resource_type: 23, ..slot });
    assert_eq!(production.production_rate, resources.resource_rule(3, 23).village_rate);
    assert_eq!(production.output_amount_left, 0xffffffffffffffffffffffffffffffff);
    assert_eq!(production.building_count, 1);
    assert_eq!(production.last_updated_at, 30);
    let guards = IGuardsDispatcher { contract_address: d.games };
    let guard = guards.guard(GuardKey { game_id: 3, structure_id: key.entity_id, slot: 0 });
    assert_eq!(guard.troops.category, TroopType::Crossbowman);
    assert_eq!(guard.troops.tier, TroopTier::T1);
    let bounds = rules(true).troop_limit_config;
    let expected = crate::random::range(
        101, 1, Into::<u16, u128>::into(bounds.mercenaries_troop_upper_bound - bounds.mercenaries_troop_lower_bound),
    )
        + bounds.mercenaries_troop_lower_bound.into();
    assert_eq!(guard.troops.count, expected * RESOURCE_PRECISION);
    for slot in 1_u8..4 {
        assert_eq!(guards.guard(GuardKey { game_id: 3, structure_id: key.entity_id, slot }), Default::default());
    }
}
#[test]
fn camp_reveals_six_biomes_without_neighbor_lotteries_or_points() {
    let (d, _) = setup(true);
    let key = create(d, coord());
    let map = IMapLogicDispatcher { contract_address: d.games };
    assert_eq!((map.tile(tile_key(3, coord())).unwrap().data / 2) % 256, crate::camps::CAMP_OCCUPIER.into());
    for direction in 0_u8..6 {
        let tile = map.tile(tile_key(3, neighbor(coord(), direction))).unwrap();
        assert_eq!(tile.data % 0x20000000000, 0);
        assert!((tile.data / 0x20000000000) % 256 != 0);
    }
    assert_eq!(crate::game::IPointsDispatcher { contract_address: d.games }.season_points(3), 0);
    assert_eq!(key.game_id, 3);
}
#[test]
#[feature("safe_dispatcher")]
fn camp_configuration_is_immutable_scoped_and_requires_authority() {
    let (d, _, _) = setup_with_rules(rules(true));
    let safe = ICampRulesSafeDispatcher { contract_address: d.games };
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: d.games };
    let mut preset = super::resource_commands::fixture_preset(rules(true));
    preset.structures.camps = array![].span();
    start_cheat_caller_address(d.games, d.actor);
    assert!(registrar.register_preset(20000, preset).is_err());
    start_cheat_caller_address(d.games, super::authority());
    let mut invalid = preset;
    invalid.structures.camps = array![ResourceAmount { resource_type: 99, amount: 1 }].span();
    assert!(registrar.register_preset(20000, invalid).is_err());
    assert!(registrar.register_preset(20000, preset).is_ok());
    assert!(registrar.register_preset(20000, preset).is_err());
    stop_cheat_caller_address(d.games);
    let games = crate::game::IGameDispatcher { contract_address: d.games };
    super::recorded::seed_game_with_preset(d.games, 4, games.game(3), preset);
    assert!(safe.camp_resources(4).unwrap().is_empty());
    assert!(safe.camp_resources(999).is_err());
}

#[test]
fn recorded_exploration_discovers_a_camp_without_moving_the_explorer_into_it() {
    let (d, home) = setup(true);
    for resource in array![26_u8, 35, 36] {
        grant(d, home, resource, 100 * RESOURCE_PRECISION);
    }
    assert!(
        execute(
            d,
            Command::CreateExplorer(
                CreateExplorer {
                    structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
                },
            ),
            80,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.structure(home).unwrap().troop_explorers.at(0);
    let key = ExplorerKey { game_id: 3, explorer_id };
    let troops = GameState { contract_address: d.games };
    let origin = troops.explorer(key).unwrap().coord;
    assert!(execute_recorded_at(d, Command::Explore(Explore { explorer_id, direction: 0 }), 140, 5000));
    assert_eq!(troops.explorer(key).unwrap().coord, origin);
    let destination = neighbor(origin, 0);
    let tile = IMapLogicDispatcher { contract_address: d.games }.tile(tile_key(3, destination)).unwrap();
    assert_eq!((tile.data / 2) % 256, crate::camps::CAMP_OCCUPIER.into());
    let camp_id: u32 = (tile.data / 512 % 0x100000000).try_into().unwrap();
    assert_eq!(structures.structure(ResourceKey { game_id: 3, entity_id: camp_id }).unwrap().base.created_at, 140);
    assert_eq!(
        crate::game::IPointsDispatcher { contract_address: d.games }.player_points(3, d.actor),
        rules(true).victory_points_grant_config.explore_tiles_points.into(),
    );
}

#[test]
fn recorded_eternum_exploration_does_not_create_a_camp() {
    let (d, home) = setup(false);
    for resource in array![26_u8, 35, 36] {
        grant(d, home, resource, 100 * RESOURCE_PRECISION);
    }
    assert!(
        execute(
            d,
            Command::CreateExplorer(
                CreateExplorer {
                    structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
                },
            ),
            80,
        ),
    );
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let explorer_id = *structures.structure(home).unwrap().troop_explorers.at(0);
    let key = ExplorerKey { game_id: 3, explorer_id };
    let troops = GameState { contract_address: d.games };
    let destination = neighbor(troops.explorer(key).unwrap().coord, 0);
    assert!(execute_recorded_at(d, Command::Explore(Explore { explorer_id, direction: 0 }), 140, 5000));
    let tile = IMapLogicDispatcher { contract_address: d.games }.tile(tile_key(3, destination)).unwrap();
    assert!(crate::map::structure_occupant(tile).is_none());
}
