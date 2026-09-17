use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use crate::bitcoin::{
    ContributeLabor, ContributionKey, IBitcoinCommandsDispatcher, IBitcoinCommandsDispatcherTrait,
    IBitcoinCommandsSafeDispatcher, IBitcoinCommandsSafeDispatcherTrait, IBitcoinViewsDispatcher,
    IBitcoinViewsDispatcherTrait, PhaseKey, PhaseStatus,
};
use crate::commands::{Command, ExecutionContext};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceKey, ResourceSlot};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, grant, setup_with_rules};

fn setup() -> (super::Deployment, ResourceKey, ResourceKey) {
    let mut rules = super::recorded::rules();
    rules.tick_config.bitcoin_phase_in_seconds = 10;
    rules.battle_config.regular_immunity_ticks = 0;
    rules.troop_stamina_config.stamina_initial = 120;
    rules.bitcoin_mine_config.min_labor_per_contribution = 10;
    rules.bitcoin_mine_config.prize_per_phase = 1000;
    let (deployment, first, second) = setup_with_rules(rules);
    grant(deployment, first, 23, 1000);
    grant(deployment, second, 23, 1000);
    (deployment, first, second)
}
fn contribute(key: ResourceKey, amount: u128) -> Command {
    Command::ContributeBitcoinLabor(ContributeLabor { structure_id: key.entity_id, amount })
}
fn balance(deployment: super::Deployment, key: ResourceKey) -> u128 {
    IResourcesDispatcher { contract_address: deployment.peers.resources }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type: 23 })
}

#[test]
fn any_owned_structure_funds_one_player_share_without_a_mine_or_distance_requirement() {
    let (deployment, first, second) = setup();
    assert!(execute(deployment, contribute(first, 100), 30));
    assert!(execute(deployment, contribute(second, 250), 31));
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    let key = PhaseKey { game_id: 3, phase: 3 };
    assert_eq!(view.bitcoin_phase(key).total_labor, 350);
    assert_eq!(view.bitcoin_phase(key).contributors, 1);
    assert_eq!(view.bitcoin_contributor(key, 0), deployment.actor);
    assert_eq!(view.bitcoin_contribution(ContributionKey { game_id: 3, phase: 3, player: deployment.actor }), 350);
    assert_eq!(balance(deployment, first), 900);
    assert_eq!(balance(deployment, second), 750);
    assert_eq!(view.bitcoin_phase(PhaseKey { game_id: 2, phase: 3 }).total_labor, 0);
    assert!(execute(deployment, contribute(first, 10), 40));
    assert_eq!(view.bitcoin_phase(PhaseKey { game_id: 3, phase: 4 }).total_labor, 10);
    assert_eq!(view.bitcoin_phase(key).total_labor, 350);
}

#[test]
fn bad_labor_contributions_are_terminal_without_partial_burns_or_pool_changes() {
    let (deployment, first, _) = setup();
    for amount in array![0_u128, 9, 1001] {
        assert_terminal_rejection(deployment, contribute(first, amount), 30);
    }
    assert_terminal_rejection(deployment, contribute(ResourceKey { entity_id: 999999, ..first }, 10), 30);
    assert_terminal_rejection(deployment, contribute(first, 10), 39);
    assert_eq!(balance(deployment, first), 1000);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    assert_eq!(view.bitcoin_phase(PhaseKey { game_id: 3, phase: 3 }).total_labor, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn contribution_requires_the_authenticated_domain_and_source_owner() {
    let (deployment, first, _) = setup();
    let calls = IBitcoinCommandsSafeDispatcher { contract_address: deployment.peers.prizes };
    let command = ContributeLabor { structure_id: first.entity_id, amount: 10 };
    let context = ExecutionContext { raw_root: 123, timestamp: 30 };
    start_cheat_block_timestamp_global(30);
    assert!(calls.contribute_bitcoin_labor(3, deployment.actor, command, context).is_err());
    start_cheat_caller_address(deployment.peers.prizes, deployment.peers.season);
    assert!(calls.contribute_bitcoin_labor(3, 0x777.try_into().unwrap(), command, context).is_err());
    assert_eq!(balance(deployment, first), 1000);
    stop_cheat_caller_address(deployment.peers.prizes);
}

#[test]
fn binding_requires_a_closed_pool_and_cannot_replace_its_root() {
    let (deployment, first, _) = setup();
    assert!(execute(deployment, contribute(first, 100), 30));
    assert_terminal_rejection(deployment, Command::CloseBitcoinPhase(3), 38);
    assert_terminal_rejection(deployment, Command::BindBitcoinPhase(3), 39);
    assert!(execute(deployment, Command::CloseBitcoinPhase(3), 39));
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    let key = PhaseKey { game_id: 3, phase: 3 };
    assert_eq!(view.bitcoin_phase(key).state, PhaseStatus::Closed);
    assert!(execute(deployment, Command::BindBitcoinPhase(3), 40));
    let bound = view.bitcoin_phase(key);
    assert_eq!(bound.state, PhaseStatus::Bound);
    assert_eq!(bound.root, super::context().raw_root);
    assert_terminal_rejection(deployment, Command::BindBitcoinPhase(3), 41);
    assert!(execute(deployment, Command::CloseBitcoinPhase(3), 42));
    assert_eq!(view.bitcoin_phase(key), bound);
}

#[test]
fn delayed_contribution_and_phase_binding_keep_recorded_context_after_game_end() {
    let (deployment, first, _) = setup();
    assert!(execute_recorded_at(deployment, contribute(first, 100), 30, 5000));
    assert!(execute_recorded_at(deployment, Command::CloseBitcoinPhase(3), 39, 5001));
    assert!(execute_recorded_at(deployment, Command::BindBitcoinPhase(3), 40, 5002));
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    let phase = view.bitcoin_phase(PhaseKey { game_id: 3, phase: 3 });
    assert_eq!(phase.total_labor, 100);
    assert_eq!(phase.root, super::context().raw_root);
    assert_eq!(phase.state, PhaseStatus::Bound);
    assert_eq!(balance(deployment, first), 900);
}

#[test]
fn phases_outside_game_and_contributions_after_end_are_rejected() {
    let (deployment, first, _) = setup();
    assert_terminal_rejection(deployment, Command::CloseBitcoinPhase(0), 30);
    assert_terminal_rejection(deployment, Command::CloseBitcoinPhase(1), 30);
    assert_terminal_rejection(deployment, contribute(first, 10), 200);
    assert_terminal_rejection(deployment, Command::CloseBitcoinPhase(20), 210);
    assert_eq!(balance(deployment, first), 1000);
}

fn set_owner(deployment: super::Deployment, key: ResourceKey, owner: starknet::ContractAddress) {
    let structures = crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures };
    let structure = crate::structures::IStructuresDispatcherTrait::structure(structures, key).unwrap();
    super::resource_commands::set_fixture(
        deployment.peers.structures,
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner, base: structure.base, resources_packed: structure.resources_packed, metadata: structure.metadata,
        },
    );
}

fn mine(deployment: super::Deployment, x: u32) -> ResourceKey {
    start_cheat_caller_address(deployment.peers.structures, deployment.peers.troops);
    let id = crate::structures::IStructuresDispatcherTrait::create_discovery(
        crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures },
        3,
        crate::troops::Coord { alt: true, x, y: 2000000 },
        crate::discovery::Discovery::BitcoinMine,
        99,
        30,
    );
    stop_cheat_caller_address(deployment.peers.structures);
    ResourceKey { game_id: 3, entity_id: id }
}

fn capture(deployment: super::Deployment, mine: ResourceKey, owner: starknet::ContractAddress, timestamp: u64) {
    set_owner(deployment, mine, owner);
    start_cheat_caller_address(deployment.peers.prizes, deployment.peers.structures);
    crate::bitcoin::IBitcoinFundingDispatcherTrait::bitcoin_mine_captured(
        crate::bitcoin::IBitcoinFundingDispatcher { contract_address: deployment.peers.prizes }, mine, timestamp,
    );
    stop_cheat_caller_address(deployment.peers.prizes);
}

fn close_and_bind(deployment: super::Deployment, phase: u64) {
    assert!(execute(deployment, Command::CloseBitcoinPhase(phase), (phase + 1) * 10 - 1));
    assert!(execute(deployment, Command::BindBitcoinPhase(phase), (phase + 1) * 10));
}
fn claim(phase: u64, ids: Span<u32>) -> Command {
    Command::ClaimBitcoinPhase(crate::bitcoin::ClaimPhase { phase, mine_ids: ids })
}
fn sat(deployment: super::Deployment, key: ResourceKey) -> u128 {
    IResourcesDispatcher { contract_address: deployment.peers.resources }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type: 58 })
}

fn assert_independent_forfeiture(winner_has_destination: bool, owner_has_destination: bool) {
    let (deployment, winner_home, owner_home) = setup();
    let owner = 0x777.try_into().unwrap();
    let other = 0x888.try_into().unwrap();
    let mine = mine(deployment, 2000100);
    capture(deployment, mine, owner, 30);
    assert!(execute(deployment, contribute(winner_home, 100), 40));
    if !winner_has_destination {
        set_owner(deployment, winner_home, other);
    }
    set_owner(deployment, owner_home, if owner_has_destination {
        owner
    } else {
        other
    });
    close_and_bind(deployment, 4);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    assert_eq!(sat(deployment, winner_home), if winner_has_destination {
        800
    } else {
        0
    });
    assert_eq!(sat(deployment, owner_home), if owner_has_destination {
        200
    } else {
        0
    });
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    let carry = view.bitcoin_mine(mine);
    assert_eq!(carry.unsplit_carry, 0);
    assert_eq!(carry.winner_carry, if winner_has_destination {
        0
    } else {
        800
    });
    assert_eq!(carry.owner_carry, if owner_has_destination {
        0
    } else {
        200
    });
    set_owner(deployment, winner_home, deployment.actor);
    set_owner(deployment, owner_home, owner);
    assert!(execute(deployment, contribute(winner_home, 100), 50));
    close_and_bind(deployment, 5);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    assert_eq!(sat(deployment, winner_home), 1600);
    assert_eq!(sat(deployment, owner_home), 400);
    assert_eq!(view.bitcoin_mine(mine).winner_carry, 0);
    assert_eq!(view.bitcoin_mine(mine).owner_carry, 0);
}

#[test]
fn forfeiture_with_winner_false_owner_false() {
    assert_independent_forfeiture(false, false);
}

#[test]
fn forfeiture_with_winner_false_owner_true() {
    assert_independent_forfeiture(false, true);
}

#[test]
fn forfeiture_with_winner_true_owner_false() {
    assert_independent_forfeiture(true, false);
}

#[test]
fn forfeiture_with_winner_true_owner_true() {
    assert_independent_forfeiture(true, true);
}

#[test]
fn zero_contributor_prize_rolls_unsplit_then_pays_once_and_retries_do_nothing() {
    let (deployment, winner_home, owner_home) = setup();
    let owner = 0x777.try_into().unwrap();
    let mine = mine(deployment, 2000100);
    capture(deployment, mine, owner, 30);
    set_owner(deployment, owner_home, owner);
    assert!(execute(deployment, Command::CloseBitcoinPhase(4), 49));
    assert_terminal_rejection(deployment, claim(4, array![mine.entity_id, mine.entity_id].span()), 50);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 1000);
    assert_eq!(sat(deployment, owner_home), 0);
    assert!(execute(deployment, contribute(winner_home, 100), 50));
    close_and_bind(deployment, 5);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    let after = view.bitcoin_mine(mine);
    assert_eq!(after.unsplit_carry, 0);
    assert_eq!(sat(deployment, winner_home), 1600);
    assert_eq!(sat(deployment, owner_home), 400);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 61));
    assert_terminal_rejection(deployment, claim(5, array![mine.entity_id, mine.entity_id].span()), 62);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 62));
    assert_eq!(view.bitcoin_mine(mine), after);
    assert_eq!(sat(deployment, winner_home), 1600);
    assert_eq!(sat(deployment, owner_home), 400);
}

#[test]
fn an_unowned_mine_never_funds_and_capture_begins_in_the_following_phase() {
    let (deployment, home, nearest_home) = setup();
    let mine = mine(deployment, 2000100);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    assert_eq!(view.bitcoin_mine(mine).eligible_from, 4);
    assert!(execute(deployment, contribute(home, 100), 40));
    close_and_bind(deployment, 4);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    assert_eq!(sat(deployment, home), 0);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 0);
    capture(deployment, mine, deployment.actor, 51);
    assert_eq!(view.bitcoin_mine(mine).eligible_from, 6);
    assert!(execute(deployment, contribute(home, 100), 51));
    close_and_bind(deployment, 5);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    assert_eq!(sat(deployment, home), 0);
    assert!(execute(deployment, contribute(home, 100), 60));
    close_and_bind(deployment, 6);
    assert!(execute(deployment, claim(6, array![mine.entity_id].span()), 70));
    assert_eq!(sat(deployment, home), 0);
    assert_eq!(sat(deployment, nearest_home), 1000);
}

#[test]
fn bitcoin_discovery_reveals_six_biomes_without_points_or_neighbor_discoveries() {
    let (deployment, _, _) = setup();
    let mine = mine(deployment, 2000100);
    let structures = crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures };
    let row = crate::structures::IStructuresDispatcherTrait::structure(structures, mine).unwrap();
    let origin = crate::structures::structure_coord(row.base);
    let map = crate::map::IMapDispatcher { contract_address: deployment.peers.map };
    for direction in 0_u8..6 {
        let coord = crate::geometry::neighbor(origin, direction);
        let tile = crate::map::IMapDispatcherTrait::tile(map, crate::geometry::tile_key(3, coord)).unwrap();
        assert!(tile.data / 0x20000000000 % 256 != 0);
        assert_eq!(tile.data % 0x20000000000, 0);
    }
    assert_eq!(
        crate::game::IGameDispatcherTrait::player_points(
            crate::game::IGameDispatcher { contract_address: deployment.peers.season }, 3, deployment.actor,
        ),
        0,
    );
}

#[test]
fn a_forfeited_share_survives_an_empty_phase_without_another_owner_cut() {
    let (deployment, winner_home, owner_home) = setup();
    let owner = 0x777.try_into().unwrap();
    let mine = mine(deployment, 2000100);
    capture(deployment, mine, owner, 30);
    assert!(execute(deployment, contribute(winner_home, 100), 40));
    set_owner(deployment, winner_home, owner);
    set_owner(deployment, owner_home, owner);
    close_and_bind(deployment, 4);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    assert_eq!(view.bitcoin_mine(mine).winner_carry, 800);
    assert_eq!(sat(deployment, owner_home), 200);
    assert!(execute(deployment, Command::CloseBitcoinPhase(5), 59));
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    let carried = view.bitcoin_mine(mine);
    assert_eq!(carried.winner_carry, 800);
    assert_eq!(carried.owner_carry, 0);
    assert_eq!(carried.unsplit_carry, 1000);
    set_owner(deployment, winner_home, deployment.actor);
    assert!(execute(deployment, contribute(winner_home, 100), 60));
    close_and_bind(deployment, 6);
    assert!(execute(deployment, claim(6, array![mine.entity_id].span()), 70));
    assert_eq!(sat(deployment, winner_home), 2400);
    assert_eq!(sat(deployment, owner_home), 600);
}

#[test]
fn an_invalid_batch_rolls_back_all_awards_but_consumes_the_ticket() {
    let (deployment, home, nearest) = setup();
    let mine = mine(deployment, 2000100);
    capture(deployment, mine, deployment.actor, 30);
    assert!(execute(deployment, contribute(home, 100), 40));
    close_and_bind(deployment, 4);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    let before = view.bitcoin_mine(mine);
    assert_terminal_rejection(deployment, claim(4, array![mine.entity_id, 999999].span()), 50);
    assert_eq!(sat(deployment, nearest), 0);
    assert_eq!(view.bitcoin_mine(mine), before);
    assert!(!view.bitcoin_claimed(crate::bitcoin::ClaimKey { game_id: 3, phase: 4, mine_id: mine.entity_id }));
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 51));
    assert_eq!(sat(deployment, nearest), 1000);
}

#[test]
fn each_mine_draws_from_the_complete_player_pool_regardless_of_batch_claimant_or_action_root() {
    let (deployment, first, second) = setup();
    let other = 0x777.try_into().unwrap();
    set_owner(deployment, second, other);
    let first_mine = mine(deployment, 2000100);
    let second_mine = mine(deployment, 2000130);
    capture(deployment, first_mine, other, 30);
    capture(deployment, second_mine, other, 30);
    let calls = IBitcoinCommandsDispatcher { contract_address: deployment.peers.prizes };
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    let mut expected_first = 0_u128;
    let mut expected_second = 0_u128;
    let mut first_wins = 0_u32;
    let mut second_wins = 0_u32;
    let mut repeated_winner = false;
    for phase in 4_u64..16 {
        start_cheat_block_timestamp_global(phase * 10);
        start_cheat_caller_address(deployment.peers.prizes, deployment.peers.season);
        let context = ExecutionContext { timestamp: phase * 10, raw_root: phase.into() };
        calls
            .contribute_bitcoin_labor(
                3, deployment.actor, ContributeLabor { structure_id: first.entity_id, amount: 10 }, context,
            );
        calls
            .contribute_bitcoin_labor(
                3, other, ContributeLabor { structure_id: second.entity_id, amount: 10 }, context,
            );
        calls
            .contribute_bitcoin_labor(
                3, other, ContributeLabor { structure_id: second.entity_id, amount: 20 }, context,
            );
        let key = PhaseKey { game_id: 3, phase };
        assert_eq!(view.bitcoin_phase(key).contributors, 2);
        assert_eq!(view.bitcoin_phase(key).total_labor, 40);
        assert_eq!(view.bitcoin_contribution(ContributionKey { game_id: 3, phase, player: other }), 30);
        let context = ExecutionContext { timestamp: (phase + 1) * 10, ..context };
        start_cheat_block_timestamp_global(context.timestamp);
        calls.close_bitcoin_phase(3, deployment.actor, phase, context);
        calls.bind_bitcoin_phase(3, other, phase, context);
        let mut winners = array![];
        for id in array![first_mine.entity_id, second_mine.entity_id] {
            let roll: u256 = core::poseidon::poseidon_hash_span(
                array!['BITCOIN_DRAW', 1, 3, phase.into(), id.into(), phase.into(), 0].span(),
            )
                .into();
            let first_won = roll % 40 < 10;
            winners.append(first_won);
            if first_won {
                expected_first += 800;
                first_wins += 1;
            } else {
                expected_second += 800;
                second_wins += 1;
            }
            expected_second += 200;
        }
        repeated_winner = repeated_winner || winners.at(0) == winners.at(1);
        let unrelated_context = ExecutionContext { raw_root: 999999, ..context };
        // Alternate one reversed batch and separate calls; neither can select contributors or reroll.
        if phase % 2 == 0 {
            calls
                .claim_bitcoin_phase(
                    3,
                    0x999.try_into().unwrap(),
                    crate::bitcoin::ClaimPhase {
                        phase, mine_ids: array![second_mine.entity_id, first_mine.entity_id].span(),
                    },
                    unrelated_context,
                );
        } else {
            for id in array![first_mine.entity_id, second_mine.entity_id] {
                calls
                    .claim_bitcoin_phase(
                        3, other, crate::bitcoin::ClaimPhase { phase, mine_ids: array![id].span() }, unrelated_context,
                    );
            }
        }
        calls
            .claim_bitcoin_phase(
                3,
                deployment.actor,
                crate::bitcoin::ClaimPhase {
                    phase, mine_ids: array![first_mine.entity_id, second_mine.entity_id].span(),
                },
                context,
            );
        stop_cheat_caller_address(deployment.peers.prizes);
        assert_eq!(sat(deployment, first), expected_first);
        assert_eq!(sat(deployment, second), expected_second);
    }
    assert!(first_wins > 0 && second_wins > 0 && repeated_winner);
    assert_eq!(expected_first + expected_second, 24000);
}

#[test]
fn payouts_choose_nearest_owned_settlement_then_lowest_id_including_villages() {
    let (deployment, first, second) = setup();
    let mine = mine(deployment, 2000005);
    capture(deployment, mine, deployment.actor, 30);
    assert!(execute(deployment, contribute(second, 100), 40));
    close_and_bind(deployment, 4);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    assert!(first.entity_id < second.entity_id);
    assert_eq!(sat(deployment, first), 1000);
    assert_eq!(sat(deployment, second), 0);
    start_cheat_caller_address(deployment.peers.settlement, super::authority());
    crate::village::IVillagesDispatcherTrait::configure_villages(
        crate::village::IVillagesDispatcher { contract_address: deployment.peers.settlement },
        3,
        super::village::village_rules(),
    );
    stop_cheat_caller_address(deployment.peers.settlement);
    start_cheat_caller_address(deployment.peers.structures, super::authority());
    crate::buildings::IBuildingRulesDispatcherTrait::configure_buildings(
        crate::buildings::IBuildingRulesDispatcher { contract_address: deployment.peers.structures },
        3,
        super::building_commands::rules(),
    );
    start_cheat_caller_address(deployment.peers.structures, deployment.peers.settlement);
    let village_id = crate::settlement::ISettlementCreationDispatcherTrait::create_settlement(
        crate::settlement::ISettlementCreationDispatcher { contract_address: deployment.peers.structures },
        3,
        deployment.actor,
        crate::troops::Coord { alt: false, x: 2000004, y: 2000000 },
        crate::settlement::SettlementCreation::Village(
            crate::settlement::VillageCreation { connected_realm: first.entity_id, resource: 1 },
        ),
        ExecutionContext { raw_root: 1, timestamp: 50 },
    );
    stop_cheat_caller_address(deployment.peers.structures);
    assert!(execute(deployment, contribute(second, 100), 50));
    close_and_bind(deployment, 5);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    assert_eq!(sat(deployment, ResourceKey { game_id: 3, entity_id: village_id }), 1000);
    assert_eq!(sat(deployment, first), 1000);
}

#[test]
fn owner_cut_uses_current_owner_and_does_not_require_owner_labor() {
    let (deployment, first, second) = setup();
    let mine = mine(deployment, 2000100);
    capture(deployment, mine, deployment.actor, 30);
    assert!(execute(deployment, contribute(first, 100), 40));
    close_and_bind(deployment, 4);
    let owner = 0x777.try_into().unwrap();
    set_owner(deployment, mine, owner);
    set_owner(deployment, second, owner);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    assert_eq!(sat(deployment, first), 800);
    assert_eq!(sat(deployment, second), 200);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    assert_eq!(view.bitcoin_contribution(ContributionKey { game_id: 3, phase: 4, player: owner }), 0);
}

fn attacking_explorer(deployment: super::Deployment, home: ResourceKey, x: u32) -> u32 {
    let id = 900000;
    let coord = crate::troops::Coord { alt: true, x, y: 2000000 };
    let explorer = crate::troops::ExplorerTroops {
        owner: home.entity_id,
        coord,
        troops: crate::troops::Troops {
            count: 3000 * crate::rules::RESOURCE_PRECISION,
            tier: crate::troops::TroopTier::T3,
            stamina: crate::troops::Stamina { amount: 120, updated_tick: 0 },
            ..Default::default(),
        },
    };
    super::resource_commands::set_fixture(
        deployment.peers.troops, selector!("explorers"), array![3, id.into()].span(), explorer,
    );
    super::resource_commands::set_fixture(
        deployment.peers.troops, selector!("exists"), array![3, id.into()].span(), true,
    );
    start_cheat_caller_address(deployment.peers.resources, deployment.peers.structures);
    IResourcesDispatcher { contract_address: deployment.peers.resources }
        .initialize_resources(ResourceKey { game_id: 3, entity_id: id }, 100000000000000000000, 0, 30);
    stop_cheat_caller_address(deployment.peers.resources);
    start_cheat_caller_address(deployment.peers.map, deployment.peers.troops);
    let map = crate::map::IMapDispatcher { contract_address: deployment.peers.map };
    let tile = crate::geometry::tile_key(3, coord);
    crate::map::IMapDispatcherTrait::occupy(map, tile, id, 17, false);
    stop_cheat_caller_address(deployment.peers.map);
    id
}

#[test]
fn a_single_guard_in_the_highest_slot_must_be_fought_before_capture() {
    let (deployment, home, _) = setup();
    let mine = mine(deployment, 2000100);
    let explorer = attacking_explorer(deployment, home, 2000085);
    let structures = crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures };
    let mut target = crate::structures::IStructuresDispatcherTrait::structure(structures, mine).unwrap();
    target.base.troop_max_guard_count = 1;
    super::resource_commands::set_fixture(
        deployment.peers.structures,
        selector!("structures"),
        array![3, mine.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: target.owner,
            base: target.base,
            resources_packed: target.resources_packed,
            metadata: target.metadata,
        },
    );
    let guard = crate::guards::IGuardsDispatcherTrait::guard(
        crate::guards::IGuardsDispatcher { contract_address: deployment.peers.troops },
        crate::guards::GuardKey { game_id: 3, structure_id: mine.entity_id, slot: 0 },
    );
    for slot in 0_u8..4 {
        super::resource_commands::set_fixture(
            deployment.peers.troops,
            selector!("guards"),
            array![3, mine.entity_id.into(), slot.into()].span(),
            if slot == 3 {
                guard
            } else {
                Default::default()
            },
        );
    }
    let mut spy = spy_events();
    assert!(
        execute(
            deployment,
            Command::BattleGuard(crate::commands::Battle { attacker_id: explorer, defender_id: mine.entity_id }),
            40,
        ),
    );
    let events = spy.get_events().emitted_by(deployment.peers.troops);
    let mut fought = false;
    for (_, event) in events.events.span() {
        if *event.keys.at(0) == selector!("BattleEvent") {
            fought = true;
        }
    }
    assert!(fought, "occupied guard slot was skipped");
    assert_eq!(
        crate::structures::IStructuresDispatcherTrait::structure(structures, mine).unwrap().owner, deployment.actor,
    );
}

#[test]
fn defeating_the_last_guard_captures_the_mine_and_defers_funding_to_the_next_phase() {
    let (deployment, home, nearest) = setup();
    let mine = mine(deployment, 2000100);
    let explorer = attacking_explorer(deployment, home, 2000085);
    let structures = crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures };
    let guards = crate::guards::IGuardsDispatcher { contract_address: deployment.peers.troops };
    // Begin with the final surviving guard after earlier attacks.
    for slot in 1_u8..4 {
        super::resource_commands::set_fixture(
            deployment.peers.troops,
            selector!("guards"),
            array![3, mine.entity_id.into(), slot.into()].span(),
            Default::<crate::guards::Guard>::default(),
        );
    }
    assert!(
        crate::guards::IGuardsDispatcherTrait::guard(
            guards, crate::guards::GuardKey { game_id: 3, structure_id: mine.entity_id, slot: 0 },
        )
            .troops
            .count > 0,
    );
    assert!(
        execute(
            deployment,
            Command::BattleGuard(crate::commands::Battle { attacker_id: explorer, defender_id: mine.entity_id }),
            40,
        ),
    );
    let captured = crate::structures::IStructuresDispatcherTrait::structure(structures, mine).unwrap();
    assert_eq!(captured.owner, deployment.actor);
    for slot in 0_u8..4 {
        assert_eq!(
            crate::guards::IGuardsDispatcherTrait::guard(
                guards, crate::guards::GuardKey { game_id: 3, structure_id: mine.entity_id, slot },
            ),
            Default::default(),
        );
    }
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    assert_eq!(view.bitcoin_mine(mine).eligible_from, 5);
    assert!(execute(deployment, contribute(home, 100), 40));
    close_and_bind(deployment, 4);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    assert_eq!(sat(deployment, nearest), 0);
    assert!(execute(deployment, contribute(home, 100), 50));
    close_and_bind(deployment, 5);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    assert_eq!(sat(deployment, nearest), 1000);
}

#[test]
#[feature("safe_dispatcher")]
fn guard_and_funding_mutations_reject_foreign_domains() {
    let (deployment, home, _) = setup();
    let mine = mine(deployment, 2000100);
    assert!(
        crate::bitcoin::IBitcoinFundingSafeDispatcherTrait::register_bitcoin_structure(
            crate::bitcoin::IBitcoinFundingSafeDispatcher { contract_address: deployment.peers.prizes }, mine, 8, 30,
        )
            .is_err(),
    );
    let guards = crate::guards::IGuardsSafeDispatcher { contract_address: deployment.peers.troops };
    assert!(crate::guards::IGuardsSafeDispatcherTrait::initialize_structure_guards(guards, mine, 99, 30).is_err());
    assert!(
        crate::guards::IGuardsSafeDispatcherTrait::add_starting_guard(
            guards, home, crate::troops::TroopType::Knight, 1, 30,
        )
            .is_err(),
    );
    assert!(
        crate::guards::IStructureCaptureSafeDispatcherTrait::capture_structure(
            crate::guards::IStructureCaptureSafeDispatcher { contract_address: deployment.peers.structures },
            mine,
            home.entity_id,
            30,
        )
            .is_err(),
    );
    assert!(
        crate::bitcoin::IBitcoinFundingSafeDispatcherTrait::bitcoin_mine_captured(
            crate::bitcoin::IBitcoinFundingSafeDispatcher { contract_address: deployment.peers.prizes }, mine, 50,
        )
            .is_err(),
    );
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    assert_eq!(view.bitcoin_mine(mine).eligible_from, 4);
}

#[test]
fn guard_attacks_reject_owned_wrong_layer_and_out_of_range_targets_without_advancing_funding() {
    let (deployment, home, _) = setup();
    let mine = mine(deployment, 2000100);
    let explorer = attacking_explorer(deployment, home, 2000000);
    let attack = Command::BattleGuard(crate::commands::Battle { attacker_id: explorer, defender_id: mine.entity_id });
    assert_terminal_rejection(deployment, attack, 40);
    set_owner(deployment, mine, deployment.actor);
    assert_terminal_rejection(deployment, attack, 40);
    set_owner(deployment, mine, 0.try_into().unwrap());
    let troop_view = crate::troops::ITroopsDispatcher { contract_address: deployment.peers.troops };
    let key = crate::troops::ExplorerKey { game_id: 3, explorer_id: explorer };
    let mut row = crate::troops::ITroopsDispatcherTrait::explorer(troop_view, key).unwrap();
    row.coord = crate::troops::Coord { alt: false, x: 2000085, y: 2000000 };
    super::resource_commands::set_fixture(
        deployment.peers.troops, selector!("explorers"), array![3, explorer.into()].span(), row,
    );
    assert_terminal_rejection(deployment, attack, 40);
    assert_eq!(crate::troops::ITroopsDispatcherTrait::explorer(troop_view, key).unwrap(), row);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.peers.prizes };
    assert_eq!(view.bitcoin_mine(mine).eligible_from, 4);
}

#[test]
fn configured_owner_cut_preserves_every_unit_including_rounding() {
    assert_eq!(crate::bitcoin::split_prize(1001, 2000), (801, 200));
    assert_eq!(crate::bitcoin::split_prize(1001, 0), (1001, 0));
    assert_eq!(crate::bitcoin::split_prize(1001, 10000), (0, 1001));
    let maximum = 0xffffffffffffffffffffffffffffffff_u128;
    let (winner, owner) = crate::bitcoin::split_prize(maximum, 2000);
    assert_eq!(winner + owner, maximum);
}
