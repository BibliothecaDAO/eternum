use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::agents::{
    AgentRules, IAgentsDispatcher, IAgentsDispatcherTrait, IAgentsSafeDispatcher, IAgentsSafeDispatcherTrait, draw,
};
use crate::commands::{Command, CreateExplorer, Explore, Move};
use crate::discovery::Discovery;
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::geometry::{neighbor, tile_key};
use crate::map::{IMapDispatcher, IMapDispatcherTrait};
use crate::ownership::{IAgentOwnershipDispatcher, IAgentOwnershipDispatcherTrait, TransferOwnership};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use crate::settlement::{ISettlementDisplacementDispatcher, ISettlementDisplacementDispatcherTrait};
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait};
use crate::troops::{
    Coord, ExplorerKey, ITroopsDispatcher, ITroopsDispatcherTrait, ITroopsSafeDispatcher, ITroopsSafeDispatcherTrait,
    TroopTier, TroopType,
};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, grant, setup_with_rules};

fn limits(lifetime: u16, current: u16) -> AgentRules {
    AgentRules { max_lifetime_count: lifetime, max_current_count: current, min_spawn_lords: 2, max_spawn_lords: 7 }
}
fn game_rules(blitz: bool) -> crate::rules::SliceRules {
    let mut rules = super::recorded::rules();
    rules.blitz_mode_on = blitz;
    rules.map_config.hyps_win_prob = 0;
    rules.map_config.hyps_fail_prob = 1;
    rules.map_config.shards_mines_win_probability = 0;
    rules.map_config.shards_mines_fail_probability = 1;
    rules.map_config.camp_win_probability = 0;
    rules.map_config.camp_fail_probability = 1;
    rules.map_config.agent_discovery_prob = 1;
    rules.map_config.agent_discovery_fail_prob = 0;
    rules.map_config.relic_discovery_interval_sec = 60000;
    rules
}
fn view(d: super::Deployment) -> IAgentsDispatcher {
    IAgentsDispatcher { contract_address: d.peers.troops }
}
fn troops(d: super::Deployment) -> ITroopsDispatcher {
    ITroopsDispatcher { contract_address: d.peers.troops }
}
fn ownership(d: super::Deployment) -> IAgentOwnershipDispatcher {
    IAgentOwnershipDispatcher { contract_address: d.peers.troops }
}
fn setup(blitz: bool, rules: AgentRules) -> (super::Deployment, ExplorerKey, ExplorerKey) {
    let (d, home, _) = setup_with_rules(game_rules(blitz));
    start_cheat_caller_address(d.peers.season, super::authority());
    ISeasonDispatcher { contract_address: d.peers.season }.set_agent_controller(d.actor);
    stop_cheat_caller_address(d.peers.season);
    start_cheat_caller_address(d.peers.troops, super::authority());
    view(d).configure_agents(3, rules);
    stop_cheat_caller_address(d.peers.troops);
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
    let explorer_id = *IStructuresDispatcher { contract_address: d.peers.structures }
        .structure(home)
        .unwrap()
        .troop_explorers
        .at(0);
    let explorer = ExplorerKey { game_id: 3, explorer_id };
    let origin = troops(d).explorer(explorer).unwrap().coord;
    assert!(execute_recorded_at(d, Command::Explore(Explore { explorer_id, direction: 0 }), 140, 5000));
    assert_eq!(troops(d).explorer(explorer).unwrap().coord, origin);
    let tile = IMapDispatcher { contract_address: d.peers.map }.tile(tile_key(3, neighbor(origin, 0))).unwrap();
    let agent = ExplorerKey { game_id: 3, explorer_id: (tile.data / 512 % 0x100000000).try_into().unwrap() };
    (d, explorer, agent)
}
fn remove_agent(d: super::Deployment, key: ExplorerKey) {
    let coord = troops(d).explorer(key).unwrap().coord;
    let map = IMapDispatcher { contract_address: d.peers.map };
    start_cheat_caller_address(d.peers.map, d.peers.troops);
    for direction in 0_u8..6 {
        let location = tile_key(3, neighbor(coord, direction));
        if map.tile(location).map(|row| row.data % 0x20000000000 == 0).unwrap_or(true) {
            map.occupy(location, 1000 + direction.into(), 15, false);
        }
    }
    stop_cheat_caller_address(d.peers.map);
    snforge_std::cheat_caller_address(d.peers.troops, d.peers.structures, snforge_std::CheatSpan::TargetCalls(1));
    ISettlementDisplacementDispatcher { contract_address: d.peers.troops }.displace_explorer(3, key.explorer_id);
}
#[test]
fn agent_draw_keeps_the_original_salts_type_order_tier_weights_and_reward_bounds() {
    let rules = game_rules(false);
    let limits = limits(10, 5);
    let mut seen_tiers = 0_u8;
    for seed in 0_u64..64 {
        let seed: u256 = seed.into();
        let rolled = draw(seed, 140, rules, limits);
        let tier_roll = crate::random::range(seed + 15, 158, 100);
        let tier = if tier_roll < 70 {
            TroopTier::T1
        } else if tier_roll < 90 {
            TroopTier::T2
        } else {
            TroopTier::T3
        };
        assert_eq!(rolled.tier, tier);
        let bit = match tier {
            TroopTier::T1 => 1,
            TroopTier::T2 => 2,
            TroopTier::T3 => 4,
        };
        if seen_tiers / bit % 2 == 0 {
            seen_tiers += bit;
        }
        let lower: u128 = rules.troop_limit_config.agents_troop_lower_bound.into();
        let upper: u128 = rules.troop_limit_config.agents_troop_upper_bound.into();
        assert_eq!(rolled.amount, (lower + crate::random::range(seed, 124, upper - lower)) * RESOURCE_PRECISION);
        assert_eq!(
            rolled.category,
            *array![TroopType::Knight, TroopType::Crossbowman, TroopType::Paladin]
                .at(crate::random::range(seed, 124, 3).try_into().unwrap()),
        );
        assert!(rolled.lords >= 2 && rolled.lords <= 7);
        assert_eq!(draw(seed, 140, rules, AgentRules { min_spawn_lords: 4, max_spawn_lords: 4, ..limits }).lords, 4);
    }
    assert_eq!(seen_tiers, 7);
}
#[test]
fn recorded_agent_discovery_on_both_modes_preserves_draws_ownership_and_rewards() {
    for blitz in array![false, true] {
        let (d, _, key) = setup(blitz, limits(2, 2));
        let explorer = troops(d).explorer(key).unwrap();
        let game = IGameDispatcher { contract_address: d.peers.season }.game(3);
        let mut root = super::context().raw_root;
        let seed = crate::random::game_root(ref root, 3, game.seed);
        let expected = draw(seed, 140, game_rules(blitz), limits(2, 2));
        assert_eq!(explorer.owner, crate::troops::AGENT_HOME);
        assert_eq!(explorer.troops.category, expected.category);
        assert_eq!(explorer.troops.tier, expected.tier);
        assert_eq!(explorer.troops.count, expected.amount);
        assert_eq!(explorer.troops.stamina.updated_tick, 2);
        assert_eq!(ownership(d).agent_owner(3, key.explorer_id), d.actor);
        let resources = IResourcesDispatcher { contract_address: d.peers.resources };
        assert_eq!(
            resources.resource_balance(ResourceSlot { game_id: 3, entity_id: key.explorer_id, resource_type: 37 }),
            Into::<u32, u128>::into(expected.lords) * RESOURCE_PRECISION,
        );
        assert_eq!(troops(d).agent_population(3).count, 1);
        assert_eq!(
            view(d).agent_discovery_stats(3),
            crate::agents::AgentDiscoveryStats { spawned: 1, lords_minted: expected.lords },
        );
        assert_eq!(view(d).agent_discovery_stats(2), Default::default());
    }
}
#[test]
fn current_limit_skips_the_lottery_and_allows_normal_exploration() {
    let (d, explorer, _) = setup(true, limits(3, 1));
    assert!(!view(d).can_discover_agent(3));
    let origin = troops(d).explorer(explorer).unwrap().coord;
    assert!(execute(d, Command::Explore(Explore { explorer_id: explorer.explorer_id, direction: 1 }), 180));
    assert_eq!(troops(d).explorer(explorer).unwrap().coord, neighbor(origin, 1));
    assert_eq!(troops(d).agent_population(3).count, 1);
    assert_eq!(view(d).agent_discovery_stats(3).spawned, 1);
}
#[test]
fn destruction_frees_current_capacity_without_refunding_lifetime_or_rewards() {
    for lifetime in array![1_u16, 2] {
        let (d, _, agent) = setup(false, limits(lifetime, 1));
        let stats = view(d).agent_discovery_stats(3);
        remove_agent(d, agent);
        assert!(troops(d).explorer(agent).is_none());
        assert_eq!(troops(d).agent_population(3).count, 0);
        assert_eq!(ownership(d).agent_owner(3, agent.explorer_id), 0.try_into().unwrap());
        assert!(
            !IResourcesDispatcher { contract_address: d.peers.resources }
                .has_resource(ResourceKey { game_id: 3, entity_id: agent.explorer_id }),
        );
        assert_eq!(view(d).agent_discovery_stats(3), stats);
        assert_eq!(view(d).can_discover_agent(3), lifetime == 2);
    }
}
#[test]
fn agents_move_without_a_home_food_balance_and_retain_agent_occupancy() {
    let (d, _, agent) = setup(false, limits(3, 2));
    let origin = troops(d).explorer(agent).unwrap().coord;
    let destination = neighbor(origin, 0);
    let map = IMapDispatcher { contract_address: d.peers.map };
    start_cheat_caller_address(d.peers.map, d.peers.troops);
    map.reveal(tile_key(3, destination), 1);
    stop_cheat_caller_address(d.peers.map);
    assert!(execute(d, Command::Move(Move { explorer_id: agent.explorer_id, directions: array![0_u8].span() }), 180));
    let explorer = troops(d).explorer(agent).unwrap();
    assert_eq!(explorer.coord, destination);
    let occupier = (map.tile(tile_key(3, destination)).unwrap().data / 2) % 256;
    assert!(occupier >= 24 && occupier <= 32);
    assert_eq!(view(d).agent_discovery_stats(3).spawned, 1);
}
#[test]
#[feature("safe_dispatcher")]
fn only_the_controller_can_transfer_an_agent_and_ownership_is_used_for_actions() {
    let (d, _, agent) = setup(false, limits(2, 1));
    let command = Command::TransferAgentOwnership(
        TransferOwnership { entity_id: agent.explorer_id, new_owner: 999.try_into().unwrap() },
    );
    assert!(execute(d, command, 150));
    let safe = ITroopsSafeDispatcher { contract_address: d.peers.troops };
    assert!(safe.authorized_explorer(agent, d.actor).is_err());
    assert!(safe.authorized_explorer(agent, 999.try_into().unwrap()).is_ok());
    assert_terminal_rejection(
        d, Command::Move(Move { explorer_id: agent.explorer_id, directions: array![0_u8].span() }), 180,
    );
    start_cheat_caller_address(d.peers.season, super::authority());
    ISeasonDispatcher { contract_address: d.peers.season }.set_agent_controller(888.try_into().unwrap());
    stop_cheat_caller_address(d.peers.season);
    assert_terminal_rejection(d, command, 180);
    assert_eq!(ownership(d).agent_owner(3, agent.explorer_id), 999.try_into().unwrap());
}
#[test]
#[feature("safe_dispatcher")]
fn configuration_is_authority_only_immutable_and_missing_configuration_is_not_a_disabled_pool() {
    let (d, _, _) = setup_with_rules(game_rules(false));
    let safe = IAgentsSafeDispatcher { contract_address: d.peers.troops };
    assert!(safe.can_discover_agent(3).is_err());
    assert!(safe.configure_agents(3, limits(0, 0)).is_err());
    start_cheat_caller_address(d.peers.troops, super::authority());
    assert!(safe.configure_agents(999, limits(0, 0)).is_err());
    assert!(safe.configure_agents(3, AgentRules { min_spawn_lords: 8, max_spawn_lords: 1, ..limits(1, 1) }).is_err());
    assert!(safe.configure_agents(3, limits(0, 0)).is_ok());
    assert!(safe.configure_agents(3, limits(1, 1)).is_err());
    assert!(!view(d).can_discover_agent(3));
    stop_cheat_caller_address(d.peers.troops);
    let map = IMapDispatcher { contract_address: d.peers.map };
    assert_eq!(map.discovery(tile_key(3, Coord { alt: false, x: 2000100, y: 2000100 }), 101, 0, 140), Discovery::None);
}

#[test]
fn explorer_battles_use_agent_ownership_without_reading_a_fictitious_home() {
    let (d, explorer, agent) = setup(false, limits(2, 1));
    let command = Command::Battle(
        crate::combat_actions::AttackExplorer {
            attacker_id: explorer.explorer_id, defender_id: agent.explorer_id, steal_resources: array![].span(),
        },
    );
    assert_terminal_rejection(d, command, 180);
    assert!(
        execute(
            d,
            Command::TransferAgentOwnership(
                TransferOwnership { entity_id: agent.explorer_id, new_owner: 999.try_into().unwrap() },
            ),
            180,
        ),
    );
    let mut attacker = troops(d).explorer(explorer).unwrap();
    attacker.troops.stamina.amount = 120;
    attacker.troops.stamina.updated_tick = 3;
    super::resource_commands::set_fixture(
        d.peers.troops, selector!("explorers"), array![3, explorer.explorer_id.into()].span(), attacker,
    );
    let mut rules = game_rules(false);
    rules.battle_config.regular_immunity_ticks = 0;
    super::resource_commands::set_fixture(d.peers.season, selector!("rules"), array![3].span(), rules);
    assert!(execute(d, command, 180));
    assert!(troops(d).explorer(agent).is_some());
    assert_eq!(troops(d).agent_population(3).count, 1);
}
