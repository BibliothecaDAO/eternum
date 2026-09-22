use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use crate::commands::{Command, ExecutionContext};
use crate::exploration_rewards::{
    ExplorationReward, IExplorationGrantSafeDispatcher, IExplorationGrantSafeDispatcherTrait, IExtractionSafeDispatcher,
    IExtractionSafeDispatcherTrait,
};
use crate::map::{IMapDispatcher, IMapDispatcherTrait};
use crate::relics::{
    ApplyRelic, IRelicMapDispatcher, IRelicMapDispatcherTrait, IRelicMapSafeDispatcher, IRelicMapSafeDispatcherTrait,
    IRelicsDispatcher, IRelicsDispatcherTrait, IRelicsSafeDispatcher, IRelicsSafeDispatcherTrait, OpenChest, Recipient,
    RelicRule,
};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::troops::{Coord, ExplorerKey, ITroopsDispatcher, ITroopsDispatcherTrait};
use super::resource_commands::{
    assert_terminal_rejection, execute, execute_recorded_at, grant, set_fixture, setup_with_rules,
};

pub fn rules() -> Span<RelicRule> {
    let rates = array![
        5000_u16, 10000, 2000, 4000, 2000, 4000, 0, 0, 10000, 20000, 1500, 3000, 2000, 4000, 2000, 2000, 1500, 3000,
    ];
    let mut rules = array![];
    for index in 0..18_u32 {
        let uses = match index {
            0 | 1 => 3,
            6 => 1,
            7 => 2,
            _ => 0,
        };
        let draw_weight = match index {
            14 | 15 => 0,
            16 => 600,
            17 => 200,
            _ => if index % 2 == 0 {
                750
            } else {
                400
            },
        };
        rules
            .append(
                RelicRule {
                    rate_bps: *rates.at(index),
                    uses,
                    duration: if uses == 0 {
                        3
                    } else {
                        0
                    },
                    essence_cost: if index % 2 == 0 {
                        250
                    } else {
                        500
                    },
                    draw_weight,
                },
            );
    }
    rules.span()
}
fn setup(blitz: bool) -> (super::Deployment, ResourceKey, ResourceKey) {
    let mut config = super::recorded::rules();
    config.mode_rules = if blitz {
        super::recorded::BLITZ_RULES
    } else {
        super::recorded::ETERNUM_RULES
    };
    config
        .command_mask = if blitz {
            super::recorded::BLITZ_COMMAND_MASK
        } else {
            super::recorded::ETERNUM_COMMAND_MASK
        };
    config.entry_rule = if blitz {
        crate::rules::ENTRY_ROSTER
    } else {
        crate::rules::ENTRY_ENTITLEMENT
    };
    config.map_config.relic_discovery_interval_sec = 10;
    config.map_config.relic_hex_dist_from_center = 12;
    config.map_config.relic_chest_relics_per_chest = 3;
    config.tick_config.armies_tick_in_seconds = 10;
    config.victory_points_grant_config.relic_open_points = 77;
    let (deployment, home, _) = setup_with_rules(config);
    start_cheat_caller_address(deployment.peers.economy, super::authority());
    view(deployment).configure_relics(3, rules());
    stop_cheat_caller_address(deployment.peers.economy);
    grant(deployment, home, 26, 10 * RESOURCE_PRECISION);
    grant(deployment, home, 38, 10000 * RESOURCE_PRECISION);
    assert!(
        execute(
            deployment,
            Command::CreateExplorer(
                crate::commands::CreateExplorer {
                    structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
                },
            ),
            30,
        ),
    );
    let structures = crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures };
    let id = crate::structures::IStructuresDispatcherTrait::structure(structures, home).unwrap().troop_explorers.at(0);
    let explorer = ResourceKey { game_id: 3, entity_id: *id };
    for id in 39_u8..57 {
        grant(deployment, explorer, id, 3 * RESOURCE_PRECISION);
        grant(deployment, home, id, 3 * RESOURCE_PRECISION);
    }
    (deployment, home, explorer)
}
fn view(deployment: super::Deployment) -> IRelicsDispatcher {
    IRelicsDispatcher { contract_address: deployment.peers.economy }
}
fn troop(deployment: super::Deployment, key: ResourceKey) -> crate::troops::ExplorerTroops {
    ITroopsDispatcher { contract_address: deployment.peers.troops }
        .explorer(ExplorerKey { game_id: key.game_id, explorer_id: key.entity_id })
        .unwrap()
}
fn balance(deployment: super::Deployment, key: ResourceKey, id: u8) -> u128 {
    IResourcesDispatcher { contract_address: deployment.peers.resources }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type: id })
}
fn apply(key: ResourceKey, id: u8, recipient: Recipient) -> Command {
    Command::ApplyRelic(ApplyRelic { entity_id: key.entity_id, relic_id: id, recipient })
}
fn map_relics(deployment: super::Deployment) -> IRelicMapDispatcher {
    IRelicMapDispatcher { contract_address: deployment.peers.map }
}
fn chest(deployment: super::Deployment, origin: Coord, seed: u256, time: u64) -> Coord {
    let coord = crate::relics::chest_destination(origin, seed, time, 12);
    start_cheat_block_timestamp_global(time);
    start_cheat_caller_address(deployment.peers.map, deployment.peers.troops);
    map_relics(deployment).discover_relic_chest(3, origin, origin, seed, time);
    stop_cheat_caller_address(deployment.peers.map);
    coord
}
fn move_fixture(deployment: super::Deployment, key: ResourceKey, coord: Coord) {
    let explorer = troop(deployment, key);
    set_fixture(
        deployment.peers.troops,
        selector!("explorers"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        crate::troops::ExplorerTroops { coord, ..explorer },
    );
}
#[test]
fn explorer_relics_charge_the_home_and_use_the_recorded_tick_for_each_effect() {
    let (deployment, home, explorer) = setup(false);
    for id in array![39_u8, 40, 41, 42, 43, 44, 47, 48] {
        let before = balance(deployment, home, 38);
        assert!(execute_recorded_at(deployment, apply(explorer, id, Recipient::Explorer), 40, 5000));
        assert_eq!(balance(deployment, explorer, id), 2 * RESOURCE_PRECISION);
        let rule = *rules().at((id - 39).into());
        assert_eq!(balance(deployment, home, 38), before - rule.essence_cost * RESOURCE_PRECISION);
        let boost = troop(deployment, explorer).troops.boosts;
        match id {
            39 |
            40 => {
                assert_eq!(boost.incr_stamina_regen_percent_num, rule.rate_bps);
                assert_eq!(boost.incr_stamina_regen_tick_count, 3);
            },
            41 |
            42 => {
                assert_eq!(boost.incr_damage_dealt_percent_num, rule.rate_bps);
                assert_eq!(boost.incr_damage_dealt_end_tick, 7);
            },
            43 |
            44 => {
                assert_eq!(boost.decr_damage_gotten_percent_num, rule.rate_bps);
                assert_eq!(boost.decr_damage_gotten_end_tick, 7);
            },
            _ => {
                assert_eq!(boost.incr_explore_reward_percent_num, rule.rate_bps);
                assert_eq!(boost.incr_explore_reward_end_tick, 7);
            },
        }
    }
}
#[test]
fn production_relics_update_only_their_bonus_and_keep_inclusive_expiry() {
    let (deployment, home, _) = setup(false);
    let view = crate::production::IProductionRulesDispatcher { contract_address: deployment.peers.resources };
    for id in 51_u8..57 {
        assert!(execute_recorded_at(deployment, apply(home, id, Recipient::StructureProduction), 40, 5000));
        let bonus = crate::production::IProductionRulesDispatcherTrait::production_bonus(view, home);
        let resource = if id < 53 {
            2
        } else if id < 55 {
            23
        } else {
            26
        };
        let rule = *rules().at((id - 39).into());
        assert_eq!(
            crate::production::bonus_output(bonus, resource, 10000, 7), 10000 + Into::<u16, u128>::into(rule.rate_bps),
        );
        assert_eq!(crate::production::bonus_output(bonus, resource, 10000, 8), 10000);
        assert_eq!(balance(deployment, home, id), 2 * RESOURCE_PRECISION);
    }
}
#[test]
fn guard_relics_apply_to_all_four_slots_and_preserve_destroyed_ticks() {
    let (deployment, home, _) = setup(false);
    let key = crate::guards::GuardKey { game_id: 3, structure_id: home.entity_id, slot: 2 };
    let guard = crate::guards::Guard { destroyed_tick: 2, ..Default::default() };
    set_fixture(deployment.peers.troops, selector!("guards"), array![3, home.entity_id.into(), 2].span(), guard);
    for id in array![49_u8, 50] {
        assert!(execute(deployment, apply(home, id, Recipient::StructureGuard), 40));
        for slot in 0_u8..4 {
            let value = crate::guards::IGuardsDispatcherTrait::guard(
                crate::guards::IGuardsDispatcher { contract_address: deployment.peers.troops },
                crate::guards::GuardKey { slot, ..key },
            );
            assert_eq!(value.troops.boosts.decr_damage_gotten_end_tick, 7);
            assert_eq!(value.troops.boosts.decr_damage_gotten_percent_num, if id == 49 {
                1500
            } else {
                3000
            });
            assert_eq!(value.destroyed_tick, if slot == 2 {
                2
            } else {
                0
            });
        }
    }
}
#[test]
fn failed_payments_and_wrong_targets_revert_effects_and_consume_only_the_ticket() {
    let (deployment, home, explorer) = setup(false);
    let original = troop(deployment, explorer);
    for (id, recipient, key) in array![
        (56_u8, Recipient::Explorer, explorer), (39, Recipient::StructureGuard, home),
        (39, Recipient::StructureProduction, home), (38, Recipient::Explorer, explorer),
        (57, Recipient::Explorer, explorer),
    ] {
        assert_terminal_rejection(deployment, apply(key, id, recipient), 40);
    }
    assert!(
        execute(
            deployment,
            Command::BurnStructureResources(
                crate::resources::ResourceBurn {
                    entity_id: home.entity_id,
                    resources: array![
                        crate::resources::ResourceAmount { resource_type: 38, amount: 10000 * RESOURCE_PRECISION },
                    ]
                        .span(),
                },
            ),
            40,
        ),
    );
    assert_terminal_rejection(deployment, apply(explorer, 42, Recipient::Explorer), 40);
    assert_eq!(troop(deployment, explorer), original);
    assert_eq!(balance(deployment, explorer, 42), 3 * RESOURCE_PRECISION);
    move_fixture(deployment, explorer, Coord { alt: true, ..original.coord });
    assert_terminal_rejection(deployment, apply(explorer, 39, Recipient::Explorer), 40);
}
#[test]
fn reveal_relics_reveal_only_the_ring_without_points_or_discovery() {
    let (deployment, home, explorer) = setup(false);
    move_fixture(deployment, explorer, Coord { alt: false, x: 2000100, y: 2000100 });
    let origin = troop(deployment, explorer).coord;
    let before = crate::game::IPointsDispatcherTrait::player_points(
        crate::game::IPointsDispatcher { contract_address: deployment.peers.season }, 3, deployment.actor,
    );
    for id in array![45_u8, 46] {
        assert!(execute(deployment, apply(explorer, id, Recipient::Explorer), 40));
    }
    let map = IMapDispatcher { contract_address: deployment.peers.map };
    let mut revealed = 0;
    for x in 2000098_u32..2000103 {
        for y in 2000098_u32..2000103 {
            let coord = Coord { alt: false, x, y };
            if crate::geometry::distance(origin, coord) > 0 && crate::geometry::distance(origin, coord) <= 2 {
                let tile = map.tile(crate::geometry::tile_key(3, coord)).unwrap();
                assert!(tile.data % 0x20000000000 == 0);
                revealed += 1;
            }
        }
    }
    assert_eq!(revealed, 18);
    assert_eq!(
        crate::game::IPointsDispatcherTrait::player_points(
            crate::game::IPointsDispatcher { contract_address: deployment.peers.season }, 3, deployment.actor,
        ),
        before,
    );
    assert!(map.tile(crate::geometry::tile_key(3, origin)).is_none());
    assert_eq!(balance(deployment, home, 38), 9250 * RESOURCE_PRECISION);
}
#[test]
fn chest_discovery_is_surface_only_timed_and_skips_reserved_or_occupied_tiles() {
    let (deployment, _, _) = setup(true);
    let origin = Coord { alt: false, x: 2000200, y: 2000200 };
    let expected = crate::relics::chest_destination(origin, 321, 40, 12);
    set_fixture(
        deployment.peers.map, selector!("reserved"), array![3, expected.x.into(), expected.y.into()].span(), true,
    );
    chest(deployment, origin, 321, 40);
    let actual = crate::geometry::neighbor(expected, 0);
    let tile = IMapDispatcher { contract_address: deployment.peers.map }
        .tile(crate::geometry::tile_key(3, actual))
        .unwrap();
    assert_eq!(tile.data / 2 % 256, 34);
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 40);
    start_cheat_caller_address(deployment.peers.map, deployment.peers.troops);
    start_cheat_block_timestamp_global(49);
    map_relics(deployment).discover_relic_chest(3, origin, origin, 322, 49);
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 40);
    start_cheat_block_timestamp_global(50);
    map_relics(deployment).discover_relic_chest(3, Coord { alt: true, ..origin }, origin, 322, 50);
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 40);
    map_relics(deployment).discover_relic_chest(3, origin, origin, 322, 50);
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 50);
}
#[test]
fn opening_a_chest_draws_with_replacement_once_and_replay_cannot_reopen_it() {
    let (deployment, _, explorer) = setup(true);
    let coord = chest(deployment, Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40);
    move_fixture(deployment, explorer, crate::geometry::neighbor(coord, 0));
    let command = Command::OpenRelicChest(OpenChest { explorer_id: explorer.entity_id, coord });
    let mut root = super::context().raw_root;
    let games = crate::game::IGameDispatcher { contract_address: deployment.peers.registry };
    let seed = crate::random::game_root(ref root, 3, crate::game::IGameDispatcherTrait::game(games, 3).seed);
    let expected = crate::relics::draw_relics(rules(), seed, 50, 3);
    let points = crate::game::IPointsDispatcherTrait::player_points(
        crate::game::IPointsDispatcher { contract_address: deployment.peers.season }, 3, deployment.actor,
    );
    assert!(execute_recorded_at(deployment, command, 50, 5000));
    for id in 39_u8..57 {
        let mut count = 0_u128;
        for relic in expected {
            if *relic == id {
                count += 1;
            }
        }
        assert_eq!(balance(deployment, explorer, id), (3 + count) * RESOURCE_PRECISION);
    }
    assert_eq!(
        crate::game::IPointsDispatcherTrait::player_points(
            crate::game::IPointsDispatcher { contract_address: deployment.peers.season }, 3, deployment.actor,
        ),
        points + 77,
    );
    assert_terminal_rejection(deployment, command, 51);
    assert_eq!(
        IMapDispatcher { contract_address: deployment.peers.map }
            .tile(crate::geometry::tile_key(3, coord))
            .unwrap()
            .data % 0x20000000000,
        0,
    );
}

#[test]
#[feature("safe_dispatcher")]
fn relic_configuration_and_internal_effects_reject_foreign_callers() {
    let (deployment, home, explorer) = setup(false);
    let safe = IRelicsSafeDispatcher { contract_address: deployment.peers.economy };
    assert!(safe.configure_relics(1, rules()).is_err());
    assert!(
        safe
            .apply_relic(
                3,
                deployment.actor,
                ApplyRelic { entity_id: explorer.entity_id, relic_id: 39, recipient: Recipient::Explorer },
                super::context(),
            )
            .is_err(),
    );
    start_cheat_caller_address(deployment.peers.economy, super::authority());
    assert!(safe.configure_relics(3, rules()).is_err());
    assert!(safe.configure_relics(1, array![].span()).is_err());
    stop_cheat_caller_address(deployment.peers.economy);
    let map = IRelicMapSafeDispatcher { contract_address: deployment.peers.map };
    let coord = troop(deployment, explorer).coord;
    assert!(map.discover_relic_chest(3, coord, coord, 123, 40).is_err());
    assert!(map.consume_relic_chest(3, coord).is_err());
    assert!(map.reveal_relic_ring(3, coord, 2).is_err());
    let troops = crate::relics::IRelicTroopsSafeDispatcher { contract_address: deployment.peers.troops };
    assert!(
        crate::relics::IRelicTroopsSafeDispatcherTrait::apply_troop_relic(
            troops,
            3,
            deployment.actor,
            ApplyRelic { entity_id: explorer.entity_id, relic_id: 39, recipient: Recipient::Explorer },
            *rules().at(0),
            40,
        )
            .is_err(),
    );
    let resources = crate::relics::IRelicProductionSafeDispatcher { contract_address: deployment.peers.resources };
    assert!(
        crate::relics::IRelicProductionSafeDispatcherTrait::apply_production_relic(
            resources, home, 51, *rules().at(12), 40,
        )
            .is_err(),
    );
    start_cheat_caller_address(deployment.peers.economy, deployment.peers.season);
    start_cheat_block_timestamp_global(40);
    assert!(
        safe
            .apply_relic(
                3,
                987.try_into().unwrap(),
                ApplyRelic { entity_id: explorer.entity_id, relic_id: 39, recipient: Recipient::Explorer },
                ExecutionContext { timestamp: 40, ..super::context() },
            )
            .is_err(),
    );
}

#[test]
fn pinned_draw_vectors_keep_weights_timestamp_salts_and_direction_retry_order() {
    assert_eq!(crate::relics::draw_relics(rules(), 12345, 1234, 6), array![43_u8, 48, 47, 42, 40, 55].span());
    assert_eq!(
        crate::relics::chest_destination(Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40, 12),
        Coord { alt: false, x: 2000211, y: 2000198 },
    );
    let mut repeated = false;
    for seed in 1_u64..32 {
        let chosen = crate::relics::draw_relics(rules(), seed.into(), 40, 3);
        for index in 0..chosen.len() {
            assert!(*chosen.at(index) != 53 && *chosen.at(index) != 54);
            for previous in 0..index {
                repeated = repeated || *chosen.at(index) == *chosen.at(previous);
            }
        }
    }
    assert!(repeated);
}
pub fn configure_extraction(deployment: super::Deployment, id: u8, amount: u128) {
    start_cheat_caller_address(deployment.peers.map, super::authority());
    crate::exploration_rewards::IExtractionDispatcherTrait::configure_extraction(
        crate::exploration_rewards::IExtractionDispatcher { contract_address: deployment.peers.map },
        3,
        array![
            crate::exploration_rewards::ExplorationReward { resource_type: id, amount, amount_max: amount, weight: 1 },
        ]
            .span(),
    );
    stop_cheat_caller_address(deployment.peers.map);
}

#[feature("safe_dispatcher")]
fn extract_reward(deployment: super::Deployment, explorer_id: u32, timestamp: u64, executed_at: u64) -> bool {
    start_cheat_block_timestamp_global(executed_at);
    start_cheat_caller_address(deployment.peers.map, deployment.peers.troops);
    let result = IExtractionSafeDispatcher { contract_address: deployment.peers.map }
        .extract_exploration_reward(
            3, deployment.actor, explorer_id, None, ExecutionContext { timestamp, ..super::context() },
        );
    stop_cheat_caller_address(deployment.peers.map);
    result.is_ok()
}

#[test]
#[feature("safe_dispatcher")]
fn only_movement_can_extract_a_reward() {
    let (deployment, _, explorer) = setup(false);
    configure_extraction(deployment, 2, 10);
    start_cheat_block_timestamp_global(40);
    let map = IExtractionSafeDispatcher { contract_address: deployment.peers.map };
    let before = balance(deployment, explorer, 2);
    for caller in array![deployment.actor, deployment.peers.season, deployment.peers.economy] {
        start_cheat_caller_address(deployment.peers.map, caller);
        assert!(
            map
                .extract_exploration_reward(
                    3,
                    deployment.actor,
                    explorer.entity_id,
                    None,
                    ExecutionContext { timestamp: 40, ..super::context() },
                )
                .is_err(),
        );
        assert_eq!(balance(deployment, explorer, 2), before);
    }
    stop_cheat_caller_address(deployment.peers.map);
    assert!(extract_reward(deployment, explorer.entity_id, 40, 40));
    assert_eq!(balance(deployment, explorer, 2), before + 10 * RESOURCE_PRECISION);
}

#[test]
fn extraction_applies_active_boost_once_and_routes_eternum_rewards_to_the_explorer() {
    let (deployment, home, explorer) = setup(false);
    configure_extraction(deployment, 2, 10);
    assert!(execute(deployment, apply(explorer, 48, Recipient::Explorer), 40));
    let before = balance(deployment, explorer, 2);
    let home_before = balance(deployment, home, 2);
    assert!(extract_reward(deployment, explorer.entity_id, 70, 5000));
    assert_eq!(balance(deployment, explorer, 2), before + 30 * RESOURCE_PRECISION);
    assert_eq!(balance(deployment, home, 2), home_before);
    assert!(extract_reward(deployment, explorer.entity_id, 71, 71));
    assert_eq!(balance(deployment, explorer, 2), before + 30 * RESOURCE_PRECISION);
}
#[test]
fn extraction_after_bonus_expiry_routes_blitz_resources_to_home() {
    let (deployment, home, explorer) = setup(true);
    configure_extraction(deployment, 2, 10);
    assert!(execute(deployment, apply(explorer, 48, Recipient::Explorer), 40));
    let before = balance(deployment, home, 2);
    assert!(extract_reward(deployment, explorer.entity_id, 80, 80));
    assert_eq!(balance(deployment, home, 2), before + 10 * RESOURCE_PRECISION);
    assert_eq!(balance(deployment, explorer, 2), 0);
}
#[test]
fn blitz_relic_rewards_stay_with_the_explorer() {
    let (deployment, home, explorer) = setup(true);
    configure_extraction(deployment, 39, 1);
    let before = balance(deployment, explorer, 39);
    let home_before = balance(deployment, home, 39);
    assert!(extract_reward(deployment, explorer.entity_id, 40, 40));
    assert_eq!(balance(deployment, explorer, 39), before + RESOURCE_PRECISION);
    assert_eq!(balance(deployment, home, 39), home_before);
}
#[test]
fn extraction_rejects_wrong_layer_dead_explorer_and_mismatched_tile() {
    let (deployment, _, explorer) = setup(false);
    configure_extraction(deployment, 2, 10);
    let original = troop(deployment, explorer);
    move_fixture(deployment, explorer, Coord { alt: true, ..original.coord });
    assert!(!extract_reward(deployment, explorer.entity_id, 40, 40));
    move_fixture(deployment, explorer, crate::geometry::neighbor(original.coord, 0));
    assert!(!extract_reward(deployment, explorer.entity_id, 40, 40));
    set_fixture(
        deployment.peers.troops,
        selector!("explorers"),
        array![3, explorer.entity_id.into()].span(),
        crate::troops::ExplorerTroops { troops: crate::troops::Troops { count: 0, ..original.troops }, ..original },
    );
    assert!(!extract_reward(deployment, explorer.entity_id, 40, 40));
    set_fixture(deployment.peers.troops, selector!("explorers"), array![3, explorer.entity_id.into()].span(), original);
    assert!(extract_reward(deployment, explorer.entity_id, 40, 40));
}

#[test]
fn an_explore_action_discovers_a_chest_while_eternum_does_not() {
    let (deployment, home, explorer) = setup(true);
    configure_extraction(deployment, 2, 10);
    grant(deployment, home, 35, 1000 * RESOURCE_PRECISION);
    grant(deployment, home, 36, 1000 * RESOURCE_PRECISION);
    assert!(
        execute(
            deployment,
            Command::Explore(crate::commands::Explore { explorer_id: explorer.entity_id, direction: 0 }),
            40,
        ),
    );
    assert_eq!(map_relics(deployment).relic_discovery_time(3), 40);
    let (eternum, _, _) = setup(false);
    chest(eternum, Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40);
    assert_eq!(map_relics(eternum).relic_discovery_time(3), 0);
}

#[test]
fn chest_rejections_leave_the_chest_and_points_untouched() {
    let (deployment, _, explorer) = setup(true);
    let coord = chest(deployment, Coord { alt: false, x: 2000200, y: 2000200 }, 321, 40);
    let command = Command::OpenRelicChest(OpenChest { explorer_id: explorer.entity_id, coord });
    let map = IMapDispatcher { contract_address: deployment.peers.map };
    let key = crate::geometry::tile_key(3, coord);
    let before = map.tile(key);
    assert_terminal_rejection(deployment, command, 40);
    assert_eq!(map.tile(key), before);
    move_fixture(deployment, explorer, crate::geometry::neighbor(coord, 0));
    assert_terminal_rejection(
        deployment,
        Command::OpenRelicChest(
            OpenChest { explorer_id: explorer.entity_id, coord: crate::geometry::neighbor(coord, 1) },
        ),
        40,
    );
    assert_eq!(map.tile(key), before);
    assert!(execute(deployment, command, 40));
}

#[test]
#[feature("safe_dispatcher")]
fn extraction_requires_configuration_and_rejects_foreign_grants() {
    let (deployment, _, explorer) = setup(false);
    assert!(!extract_reward(deployment, explorer.entity_id, 40, 40));
    let map = IExtractionSafeDispatcher { contract_address: deployment.peers.map };
    let rewards = array![ExplorationReward { resource_type: 2, amount: 10, amount_max: 10, weight: 1 }].span();
    assert!(map.configure_extraction(3, rewards).is_err());
    start_cheat_caller_address(deployment.peers.map, super::authority());
    assert!(map.configure_extraction(3, array![].span()).is_err());
    assert!(map.configure_extraction(3, rewards).is_ok());
    assert!(map.configure_extraction(3, rewards).is_err());
    stop_cheat_caller_address(deployment.peers.map);
    assert!(
        IExplorationGrantSafeDispatcher { contract_address: deployment.peers.resources }
            .grant_exploration_reward(explorer, 2, 100, 40)
            .is_err(),
    );
    assert!(extract_reward(deployment, explorer.entity_id, 40, 40));
}

#[test]
fn exploration_grants_a_surface_reward_atomically_and_extraction_cannot_pay_twice() {
    for blitz in array![true, false] {
        let (deployment, home, explorer) = setup(blitz);
        configure_extraction(deployment, 2, 10);
        grant(deployment, home, 35, 1000 * RESOURCE_PRECISION);
        grant(deployment, home, 36, 1000 * RESOURCE_PRECISION);
        let recipient = if blitz {
            home
        } else {
            explorer
        };
        let before = balance(deployment, recipient, 2);
        assert!(
            execute_recorded_at(
                deployment,
                Command::Explore(crate::commands::Explore { explorer_id: explorer.entity_id, direction: 0 }),
                40,
                5000,
            ),
        );
        assert_eq!(balance(deployment, recipient, 2), before + 10 * RESOURCE_PRECISION);
        assert!(extract_reward(deployment, explorer.entity_id, 41, 5001));
        assert_eq!(balance(deployment, recipient, 2), before + 10 * RESOURCE_PRECISION);
    }
}

#[test]
fn chest_search_skips_the_explorers_vacated_start_tile() {
    let (deployment, _, _) = setup(true);
    let origin = Coord { alt: false, x: 2000200, y: 2000200 };
    let vacated = Coord { alt: false, x: 2000211, y: 2000198 };
    start_cheat_block_timestamp_global(40);
    start_cheat_caller_address(deployment.peers.map, deployment.peers.troops);
    map_relics(deployment).discover_relic_chest(3, origin, vacated, 321, 40);
    let map = IMapDispatcher { contract_address: deployment.peers.map };
    assert!(map.tile(crate::geometry::tile_key(3, vacated)).is_none());
    let tile = map.tile(crate::geometry::tile_key(3, Coord { x: 2000212, ..vacated })).unwrap();
    assert_eq!(tile.data / 2 % 256, 34);
}
