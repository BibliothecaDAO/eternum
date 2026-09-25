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
use crate::resources::{IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey, ResourceSlot};
use crate::tests::StoryResultTestTrait;
use crate::tests::state::ResourceObservationTrait;
use crate::troops::Coord;
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
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type: 23 })
}

#[test]
fn any_owned_structure_funds_one_player_share_without_a_mine_or_distance_requirement() {
    let (deployment, first, second) = setup();
    assert!(execute(deployment, contribute(first, 100), 30));
    assert!(execute(deployment, contribute(second, 250), 31));
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    let key = PhaseKey { game_id: 3, phase: 3 };
    assert_eq!(view.bitcoin_phase(key).total_labor, 350);
    assert_eq!(view.bitcoin_phase(key).contributors, 1);
    assert_eq!(view.bitcoin_contributor(key, 0), deployment.actor);
    assert_eq!(
        view.bitcoin_contribution(ContributionKey { game_id: 3, phase: 3, player: deployment.actor }).labor, 350,
    );
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
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    assert_eq!(view.bitcoin_phase(PhaseKey { game_id: 3, phase: 3 }).total_labor, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn contribution_requires_the_source_owner() {
    let (deployment, first, _) = setup();
    let calls = IBitcoinCommandsSafeDispatcher { contract_address: deployment.games };
    let command = ContributeLabor { structure_id: first.entity_id, amount: 10 };
    let context = ExecutionContext { raw_root: 123, timestamp: 30, ..super::context(deployment.games, 3) };
    start_cheat_block_timestamp_global(30);
    start_cheat_caller_address(deployment.games, deployment.games);
    assert!(
        calls
            .contribute_bitcoin_labor(
                3,
                0x777.try_into().unwrap(),
                command,
                crate::commands::action_context(context),
                crate::tests::story_cursor(),
            )
            .is_err(),
    );
    assert_eq!(balance(deployment, first), 1000);
    stop_cheat_caller_address(deployment.games);
}

#[test]
fn binding_requires_a_closed_pool_and_cannot_replace_its_root() {
    let (deployment, first, _) = setup();
    assert!(execute(deployment, contribute(first, 100), 30));
    assert_terminal_rejection(deployment, Command::CloseBitcoinPhase(3), 38);
    assert_terminal_rejection(deployment, Command::BindBitcoinPhase(3), 39);
    assert!(execute(deployment, Command::CloseBitcoinPhase(3), 39));
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    let key = PhaseKey { game_id: 3, phase: 3 };
    assert_eq!(view.bitcoin_phase(key).state, PhaseStatus::Closed);
    assert!(execute(deployment, Command::BindBitcoinPhase(3), 40));
    let bound = view.bitcoin_phase(key);
    assert_eq!(bound.state, PhaseStatus::Bound);
    assert_eq!(bound.root, super::context(deployment.games, 3).raw_root);
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
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    let phase = view.bitcoin_phase(PhaseKey { game_id: 3, phase: 3 });
    assert_eq!(phase.total_labor, 100);
    assert_eq!(phase.root, super::context(deployment.games, 3).raw_root);
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
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let structure = crate::tests::state::StructureObservationTrait::structure(structures, key).unwrap();
    super::resource_commands::set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner, base: structure.base, resources_packed: structure.resources_packed, metadata: structure.metadata,
        },
    );
}

fn mine(deployment: super::Deployment, x: u32) -> ResourceKey {
    start_cheat_caller_address(deployment.games, deployment.games);
    let id = crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
        crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games },
        3,
        crate::troops::Coord { alt: true, x, y: 2000000 },
        crate::discovery::Discovery::BitcoinMine,
        99,
        30,
        crate::commands::action_context(
            crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(deployment.games, 3) },
        ),
    );
    stop_cheat_caller_address(deployment.games);
    ResourceKey { game_id: 3, entity_id: id }
}

fn capture(deployment: super::Deployment, mine: ResourceKey, owner: starknet::ContractAddress, timestamp: u64) {
    start_cheat_caller_address(deployment.games, deployment.games);
    crate::bitcoin::IBitcoinFundingDispatcherTrait::bitcoin_mine_captured(
        crate::bitcoin::IBitcoinFundingDispatcher { contract_address: deployment.games },
        mine,
        timestamp,
        crate::commands::action_context(
            crate::commands::ExecutionContext {
                timestamp: timestamp, ..crate::tests::context(deployment.games, (mine).game_id),
            },
        ),
    );
    stop_cheat_caller_address(deployment.games);
    set_owner(deployment, mine, owner);
}

fn close_and_bind(deployment: super::Deployment, phase: u64) {
    assert!(execute(deployment, Command::CloseBitcoinPhase(phase), (phase + 1) * 10 - 1));
    assert!(execute(deployment, Command::BindBitcoinPhase(phase), (phase + 1) * 10));
}
fn claim(phase: u64, ids: Span<u32>) -> Command {
    Command::ClaimBitcoinPhase(crate::bitcoin::ClaimPhase { phase, mine_ids: ids })
}
fn sat(deployment: super::Deployment, key: ResourceKey) -> u128 {
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type: 58 })
}

#[test]
fn winner_share_carries_if_its_recorded_structure_changed_owner_while_owner_share_stays_in_mine() {
    let (deployment, winner_home, other_home) = setup();
    let owner = 0x777.try_into().unwrap();
    let mine = mine(deployment, 2000100);
    capture(deployment, mine, owner, 30);
    assert!(execute(deployment, contribute(winner_home, 100), 40));
    set_owner(deployment, winner_home, owner);
    close_and_bind(deployment, 4);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    assert_eq!(sat(deployment, winner_home), 0);
    // The winner still owns another realm; it must never replace the recorded destination.
    assert_eq!(sat(deployment, other_home), 0);
    assert_eq!(sat(deployment, mine), 200);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    assert_eq!(view.bitcoin_mine(mine).winner_carry, 800);
    assert!(execute(deployment, contribute(other_home, 100), 50));
    close_and_bind(deployment, 5);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    assert_eq!(sat(deployment, other_home), 1600);
    assert_eq!(sat(deployment, mine), 400);
    assert_eq!(view.bitcoin_mine(mine).winner_carry, 0);
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
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 1000);
    assert_eq!(sat(deployment, mine), 0);
    assert!(execute(deployment, contribute(winner_home, 100), 50));
    close_and_bind(deployment, 5);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    let after = view.bitcoin_mine(mine);
    assert_eq!(after.unsplit_carry, 0);
    assert_eq!(sat(deployment, winner_home), 1600);
    assert_eq!(sat(deployment, mine), 400);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 61));
    assert_terminal_rejection(deployment, claim(5, array![mine.entity_id, mine.entity_id].span()), 62);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 62));
    assert_eq!(view.bitcoin_mine(mine), after);
    assert_eq!(sat(deployment, winner_home), 1600);
    assert_eq!(sat(deployment, mine), 400);
}

#[test]
fn an_unowned_mine_never_funds_and_capture_begins_in_the_following_phase() {
    let (deployment, home, nearest_home) = setup();
    let mine = mine(deployment, 2000100);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
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
    assert_eq!(sat(deployment, home), 800);
    assert_eq!(sat(deployment, mine), 200);
    assert_eq!(sat(deployment, nearest_home), 0);
}

#[test]
fn bitcoin_discovery_reveals_six_biomes_without_points_or_neighbor_discoveries() {
    let (deployment, _, _) = setup();
    let mine = mine(deployment, 2000100);
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let origin = crate::tests::state::StructureObservationTrait::position(structures, mine).unwrap();
    let map = crate::map::IMapLogicDispatcher { contract_address: deployment.games };
    for direction in 0_u8..6 {
        let coord = crate::geometry::neighbor(origin, direction);
        let tile = crate::tests::state::MapObservationTrait::tile(map, crate::geometry::tile_key(3, coord)).unwrap();
        assert!(tile.data / 0x20000000000 % 256 != 0);
        assert_eq!(tile.data % 0x20000000000, 0);
    }
    assert_eq!(
        crate::game::IPointsDispatcherTrait::player_points(
            crate::game::IPointsDispatcher { contract_address: deployment.games }, 3, deployment.actor,
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
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    assert_eq!(view.bitcoin_mine(mine).winner_carry, 800);
    assert_eq!(sat(deployment, mine), 200);
    assert!(execute(deployment, Command::CloseBitcoinPhase(5), 59));
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    let carried = view.bitcoin_mine(mine);
    assert_eq!(carried.winner_carry, 800);
    assert_eq!(carried.unsplit_carry, 1000);
    set_owner(deployment, winner_home, deployment.actor);
    assert!(execute(deployment, contribute(winner_home, 100), 60));
    close_and_bind(deployment, 6);
    assert!(execute(deployment, claim(6, array![mine.entity_id].span()), 70));
    assert_eq!(sat(deployment, winner_home), 2400);
    assert_eq!(sat(deployment, mine), 600);
}

#[test]
fn an_invalid_batch_rolls_back_all_awards_but_consumes_the_ticket() {
    let (deployment, home, nearest) = setup();
    let mine = mine(deployment, 2000100);
    capture(deployment, mine, deployment.actor, 30);
    assert!(execute(deployment, contribute(home, 100), 40));
    close_and_bind(deployment, 4);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    let before = view.bitcoin_mine(mine);
    assert_terminal_rejection(deployment, claim(4, array![mine.entity_id, 999999].span()), 50);
    assert_eq!(sat(deployment, nearest), 0);
    assert_eq!(view.bitcoin_mine(mine), before);
    assert!(!view.bitcoin_claimed(crate::bitcoin::ClaimKey { game_id: 3, phase: 4, mine_id: mine.entity_id }));
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 51));
    assert_eq!(sat(deployment, home), 800);
    assert_eq!(sat(deployment, mine), 200);
    assert_eq!(sat(deployment, nearest), 0);
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
    let calls = IBitcoinCommandsDispatcher { contract_address: deployment.games };
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    let mut expected_first = 0_u128;
    let mut expected_second = 0_u128;
    let mut first_wins = 0_u32;
    let mut second_wins = 0_u32;
    let mut repeated_winner = false;
    for phase in 4_u64..16 {
        start_cheat_block_timestamp_global(phase * 10);
        start_cheat_caller_address(deployment.games, deployment.games);
        let context = ExecutionContext {
            timestamp: phase * 10, raw_root: phase.into(), ..super::context(deployment.games, 3),
        };
        calls
            .contribute_bitcoin_labor(
                3,
                deployment.actor,
                ContributeLabor { structure_id: first.entity_id, amount: 10 },
                crate::commands::action_context(context),
                crate::tests::story_cursor(),
            );
        calls
            .contribute_bitcoin_labor(
                3,
                other,
                ContributeLabor { structure_id: second.entity_id, amount: 10 },
                crate::commands::action_context(context),
                crate::tests::story_cursor(),
            );
        calls
            .contribute_bitcoin_labor(
                3,
                other,
                ContributeLabor { structure_id: second.entity_id, amount: 20 },
                crate::commands::action_context(context),
                crate::tests::story_cursor(),
            );
        let key = PhaseKey { game_id: 3, phase };
        assert_eq!(view.bitcoin_phase(key).contributors, 2);
        assert_eq!(view.bitcoin_phase(key).total_labor, 40);
        assert_eq!(view.bitcoin_contribution(ContributionKey { game_id: 3, phase, player: other }).labor, 30);
        let context = ExecutionContext { timestamp: (phase + 1) * 10, ..context };
        start_cheat_block_timestamp_global(context.timestamp);
        calls
            .close_bitcoin_phase(
                3, deployment.actor, phase, crate::commands::action_context(context), crate::tests::story_cursor(),
            );
        calls
            .bind_bitcoin_phase(
                3, other, phase, crate::commands::action_context(context), crate::tests::story_cursor(),
            );
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
        }
        repeated_winner = repeated_winner || winners.at(0) == winners.at(1);
        let unrelated_context = crate::commands::action_context(ExecutionContext { raw_root: 999999, ..context });
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
                    crate::tests::story_cursor(),
                )
                .story_result();
        } else {
            for id in array![first_mine.entity_id, second_mine.entity_id] {
                calls
                    .claim_bitcoin_phase(
                        3,
                        other,
                        crate::bitcoin::ClaimPhase { phase, mine_ids: array![id].span() },
                        unrelated_context,
                        crate::tests::story_cursor(),
                    )
                    .story_result();
            }
        }
        calls
            .claim_bitcoin_phase(
                3,
                deployment.actor,
                crate::bitcoin::ClaimPhase {
                    phase, mine_ids: array![first_mine.entity_id, second_mine.entity_id].span(),
                },
                crate::commands::action_context(context),
                crate::tests::story_cursor(),
            )
            .story_result();
        stop_cheat_caller_address(deployment.games);
        assert_eq!(sat(deployment, first), expected_first);
        assert_eq!(sat(deployment, second), expected_second);
    }
    assert!(first_wins > 0 && second_wins > 0 && repeated_winner);
    assert_eq!(expected_first + expected_second, 19200);
    assert_eq!(sat(deployment, first_mine), 2400);
    assert_eq!(sat(deployment, second_mine), 2400);
}

#[test]
fn the_first_contributing_structure_receives_the_winner_share_even_after_another_contribution() {
    let (deployment, first, second) = setup();
    let mine = mine(deployment, 2000005);
    capture(deployment, mine, deployment.actor, 30);
    assert!(execute(deployment, contribute(second, 100), 40));
    assert!(execute(deployment, contribute(first, 100), 41));
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    let contribution = view.bitcoin_contribution(ContributionKey { game_id: 3, phase: 4, player: deployment.actor });
    assert_eq!(contribution.structure_id, second.entity_id);
    assert_eq!(contribution.labor, 200);
    close_and_bind(deployment, 4);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    assert_eq!(sat(deployment, second), 800);
    assert_eq!(sat(deployment, mine), 200);
    assert_eq!(sat(deployment, first), 0);
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
    assert_eq!(sat(deployment, second), 0);
    assert_eq!(sat(deployment, mine), 200);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    assert_eq!(view.bitcoin_contribution(ContributionKey { game_id: 3, phase: 4, player: owner }).labor, 0);
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
            stamina: crate::troops::Stamina { amount: 120, updated_tick: 0 }.into(),
            ..Default::default(),
        },
    };
    crate::tests::resource_commands::set_explorer_fixture(
        deployment.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: id }, explorer,
    );
    start_cheat_caller_address(deployment.games, deployment.games);
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .initialize_resources(
            ResourceKey { game_id: 3, entity_id: id },
            100000000000000000000,
            0,
            30,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(deployment.games, 3) },
            ),
        );
    stop_cheat_caller_address(deployment.games);
    id
}

#[test]
fn a_single_guard_in_the_highest_slot_must_be_fought_before_capture() {
    let (deployment, home, _) = setup();
    let mine = mine(deployment, 2000100);
    let explorer = attacking_explorer(deployment, home, 2000085);
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let guard = crate::guards::IGuardsDispatcherTrait::guard(
        crate::guards::IGuardsDispatcher { contract_address: deployment.games },
        crate::guards::GuardKey { game_id: 3, structure_id: mine.entity_id, slot: 0 },
    );
    for slot in 0_u8..4 {
        super::resource_commands::set_fixture(
            deployment.games,
            selector!("guards"),
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
    let events = spy.get_events().emitted_by(deployment.games);
    let mut fought = false;
    for (_, event) in events.events.span() {
        if *event.keys.at(0) == selector!("BattleEvent") {
            fought = true;
        }
    }
    assert!(fought, "occupied guard slot was skipped");
    assert_eq!(
        crate::tests::state::StructureObservationTrait::structure(structures, mine).unwrap().owner, deployment.actor,
    );
}

#[test]
fn defeating_the_last_guard_captures_the_mine_and_defers_funding_to_the_next_phase() {
    let (deployment, home, nearest) = setup();
    let mine = mine(deployment, 2000100);
    let explorer = attacking_explorer(deployment, home, 2000085);
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let guards = crate::guards::IGuardsDispatcher { contract_address: deployment.games };
    // Begin with the final surviving guard after earlier attacks.
    for slot in 1_u8..4 {
        super::resource_commands::set_fixture(
            deployment.games,
            selector!("guards"),
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
    let captured = crate::tests::state::StructureObservationTrait::structure(structures, mine).unwrap();
    assert_eq!(captured.owner, deployment.actor);
    for slot in 0_u8..4 {
        assert_eq!(
            crate::guards::IGuardsDispatcherTrait::guard(
                guards, crate::guards::GuardKey { game_id: 3, structure_id: mine.entity_id, slot },
            ),
            Default::default(),
        );
    }
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
    assert_eq!(view.bitcoin_mine(mine).eligible_from, 5);
    assert!(execute(deployment, contribute(home, 100), 40));
    close_and_bind(deployment, 4);
    assert!(execute(deployment, claim(4, array![mine.entity_id].span()), 50));
    assert_eq!(sat(deployment, nearest), 0);
    assert!(execute(deployment, contribute(home, 100), 50));
    close_and_bind(deployment, 5);
    assert!(execute(deployment, claim(5, array![mine.entity_id].span()), 60));
    assert_eq!(sat(deployment, home), 800);
    assert_eq!(sat(deployment, mine), 200);
    assert_eq!(sat(deployment, nearest), 0);
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
    let troop_view = crate::tests::state::GameState { contract_address: deployment.games };
    let key = crate::troops::ExplorerKey { game_id: 3, explorer_id: explorer };
    let mut row = crate::tests::state::TroopObservationTrait::explorer(troop_view, key).unwrap();
    row.coord = crate::troops::Coord { alt: false, x: 2000085, y: 2000000 };
    crate::tests::resource_commands::set_explorer_fixture(
        deployment.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: explorer }, row,
    );
    assert_terminal_rejection(deployment, attack, 40);
    assert_eq!(crate::tests::state::TroopObservationTrait::explorer(troop_view, key).unwrap(), row);
    let view = IBitcoinViewsDispatcher { contract_address: deployment.games };
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

#[test]
#[feature("safe_dispatcher")]
fn discovery_guard_initialization_rejects_more_guards_than_the_structure_allows() {
    let (d, _, _) = setup();
    let key = mine(d, 2000100);
    let original = crate::tests::state::StructureObservationTrait::structure(
        crate::structures::IStructureOperationsDispatcher { contract_address: d.games }, key,
    )
        .unwrap();
    super::resource_commands::set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, key.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { troop_max_guard_count: 2, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    for slot in 0_u8..4 {
        super::resource_commands::set_fixture(
            d.games,
            selector!("guards"),
            selector!("guards"),
            array![3, key.entity_id.into(), slot.into()].span(),
            Default::<crate::guards::Guard>::default(),
        );
    }
    start_cheat_caller_address(d.games, d.games);
    assert!(
        crate::guards::IGuardsSafeDispatcherTrait::initialize_structure_guards(
            crate::guards::IGuardsSafeDispatcher { contract_address: d.games },
            key,
            99,
            30,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp: 30, ..crate::tests::context(d.games, (key).game_id) },
            ),
        )
            .is_err(),
    );
    assert_eq!(
        crate::guards::IGuardsDispatcherTrait::guard(
            crate::guards::IGuardsDispatcher { contract_address: d.games },
            crate::guards::GuardKey { game_id: 3, structure_id: key.entity_id, slot: 0 },
        ),
        Default::default(),
    );
}

#[test]
fn capture_many_phases_after_discovery_starts_at_its_first_eligible_phase() {
    let (d, home, _) = setup();
    let mine = mine(d, 2000100);
    capture(d, mine, d.actor, 170);
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(mine).next_phase, 18);
    assert!(execute(d, contribute(home, 100), 180));
    close_and_bind(d, 18);
    assert!(execute(d, claim(18, array![mine.entity_id].span()), 190));
    assert_eq!(sat(d, home), 800);
    assert_eq!(sat(d, mine), 200);
    assert_eq!(view.bitcoin_mine(mine).next_phase, 19);
}

#[test]
fn mixed_mine_cursors_settle_all_ready_phases_independently() {
    let (d, home, _) = setup();
    let first = mine(d, 2000100);
    let second = mine(d, 2000130);
    capture(d, first, d.actor, 30);
    capture(d, second, d.actor, 30);
    assert!(execute(d, contribute(home, 100), 40));
    close_and_bind(d, 4);
    assert!(execute(d, claim(4, array![first.entity_id].span()), 50));
    for phase in 5_u64..7 {
        assert!(execute(d, contribute(home, 100), phase * 10));
        close_and_bind(d, phase);
    }
    assert!(execute(d, claim(6, array![first.entity_id, second.entity_id].span()), 70));
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(first).next_phase, 7);
    assert_eq!(view.bitcoin_mine(second).next_phase, 7);
    assert_eq!(sat(d, first), 600);
    assert_eq!(sat(d, second), 600);
    assert_eq!(sat(d, home), 4800);
    assert!(execute(d, claim(6, array![second.entity_id, first.entity_id].span()), 71));
    assert_eq!(sat(d, home), 4800);
}

#[test]
fn a_claim_stops_before_an_unbound_phase_and_resumes_without_rerolling() {
    let (d, home, _) = setup();
    let mine = mine(d, 2000100);
    capture(d, mine, d.actor, 30);
    assert!(execute(d, contribute(home, 100), 40));
    close_and_bind(d, 4);
    assert!(execute(d, contribute(home, 100), 50));
    assert!(execute(d, Command::CloseBitcoinPhase(5), 59));
    assert!(execute(d, contribute(home, 100), 60));
    close_and_bind(d, 6);
    assert!(execute(d, claim(6, array![mine.entity_id].span()), 70));
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(mine).next_phase, 5);
    assert_eq!(sat(d, home), 800);
    assert!(execute(d, Command::BindBitcoinPhase(5), 71));
    assert!(execute(d, claim(6, array![mine.entity_id].span()), 72));
    assert_eq!(view.bitcoin_mine(mine).next_phase, 7);
    assert_eq!(sat(d, home), 2400);
    assert_eq!(sat(d, mine), 600);
}

#[test]
fn a_large_backlog_advances_by_eight_phases_per_claim() {
    let (d, _, _) = setup();
    let mine = mine(d, 2000100);
    capture(d, mine, d.actor, 30);
    for phase in 4_u64..13 {
        assert!(execute(d, Command::CloseBitcoinPhase(phase), (phase + 1) * 10));
    }
    super::season_lifecycle::execute_batch(d, claim(12, array![mine.entity_id].span()), 130, 1);
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(mine).next_phase, 12);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 8000);
    super::season_lifecycle::execute_batch(d, claim(12, array![mine.entity_id].span()), 131, 0);
    assert_eq!(view.bitcoin_mine(mine).next_phase, 13);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 9000);
}

#[test]
fn weighted_draws_include_appended_players_and_later_updates_to_earlier_contributors() {
    let (d, first, second) = setup();
    let mine = mine(d, 2000100);
    let other = 0x777.try_into().unwrap();
    let third = 0x888.try_into().unwrap();
    set_owner(d, second, other);
    capture(d, mine, third, 30);
    grant(d, mine, 23, 1000);
    let calls = IBitcoinCommandsDispatcher { contract_address: d.games };
    let mut expected_first = 0_u128;
    let mut expected_second = 0_u128;
    let mut expected_mine = 0_u128;
    for phase in 4_u64..16 {
        let context = ExecutionContext { timestamp: phase * 10, raw_root: phase.into(), ..super::context(d.games, 3) };
        start_cheat_block_timestamp_global(context.timestamp);
        start_cheat_caller_address(d.games, d.games);
        for (actor, source, amount) in array![
            (d.actor, first.entity_id, 10_u128), (other, second.entity_id, 30), (third, mine.entity_id, 20),
            (d.actor, first.entity_id, 20),
        ] {
            calls
                .contribute_bitcoin_labor(
                    3,
                    actor,
                    ContributeLabor { structure_id: source, amount },
                    crate::commands::action_context(context),
                    crate::tests::story_cursor(),
                );
        }
        let context = ExecutionContext { timestamp: (phase + 1) * 10, ..context };
        start_cheat_block_timestamp_global(context.timestamp);
        calls
            .close_bitcoin_phase(
                3, d.actor, phase, crate::commands::action_context(context), crate::tests::story_cursor(),
            );
        calls
            .bind_bitcoin_phase(
                3, d.actor, phase, crate::commands::action_context(context), crate::tests::story_cursor(),
            );
        let roll: u256 = core::poseidon::poseidon_hash_span(
            array!['BITCOIN_DRAW', 1, 3, phase.into(), mine.entity_id.into(), phase.into(), 0].span(),
        )
            .into();
        // Original lottery intervals follow insertion order, with weights 30, 30, 20.
        if roll % 80 < 30 {
            expected_first += 800;
        } else if roll % 80 < 60 {
            expected_second += 800;
        } else {
            expected_mine += 800;
        }
        expected_mine += 200;
        calls
            .claim_bitcoin_phase(
                3,
                d.actor,
                crate::bitcoin::ClaimPhase { phase, mine_ids: array![mine.entity_id].span() },
                crate::commands::action_context(context),
                crate::tests::story_cursor(),
            )
            .story_result();
        stop_cheat_caller_address(d.games);
        assert_eq!(sat(d, first), expected_first);
        assert_eq!(sat(d, second), expected_second);
        assert_eq!(sat(d, mine), expected_mine);
    }
    assert!(expected_first > 0 && expected_second > 0 && expected_mine > 2400);
    assert_eq!(expected_first + expected_second + expected_mine, 12000);
}

#[test]
fn claim_execution_cost_does_not_grow_with_unrelated_settlements() {
    let (d, home, _) = setup();
    let first = mine(d, 2000100);
    let second = mine(d, 2000130);
    capture(d, first, d.actor, 30);
    capture(d, second, d.actor, 30);
    for key in array![home, first, second] {
        grant(d, key, 58, 1);
    }
    assert!(execute(d, contribute(home, 100), 40));
    close_and_bind(d, 4);
    let calls = IBitcoinCommandsDispatcher { contract_address: d.games };
    let context = ExecutionContext { timestamp: 50, raw_root: 123, ..super::context(d.games, 3) };
    start_cheat_caller_address(d.games, d.games);
    let initial_claim = crate::bitcoin::ClaimPhase { phase: 4, mine_ids: array![first.entity_id].span() };
    let initial_cost = measured_claim(calls, d.actor, initial_claim, context);
    stop_cheat_caller_address(d.games);
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: d.games };
    let home_row = crate::tests::state::StructureObservationTrait::structure(structures, home).unwrap();
    start_cheat_caller_address(d.games, d.games);
    for index in 0_u32..32 {
        let id = 900000 + index;
        super::resource_commands::set_fixture(
            d.games,
            selector!("structures"),
            selector!("structures"),
            array![3, id.into()].span(),
            crate::structures::StructureRecord {
                owner: d.actor,
                base: home_row.base,
                resources_packed: home_row.resources_packed,
                metadata: home_row.metadata,
            },
        );
        snforge_std::interact_with_state(
            d.games,
            || crate::logic::map::MapState::relocate_fixture(
                ResourceKey { game_id: 3, entity_id: id },
                Coord { alt: false, x: 2000300 + 10 * index, y: 2000000 },
                home_row.base.category,
                true,
            ),
        );
        IResourceOperationsDispatcher { contract_address: d.games }
            .initialize_resources(
                ResourceKey { game_id: 3, entity_id: id },
                1000000,
                1,
                50,
                crate::commands::action_context(
                    crate::commands::ExecutionContext { timestamp: 50, ..crate::tests::context(d.games, 3) },
                ),
            );
    }
    stop_cheat_caller_address(d.games);
    start_cheat_caller_address(d.games, d.games);
    let later_claim = crate::bitcoin::ClaimPhase { phase: 4, mine_ids: array![second.entity_id].span() };
    let later_cost = measured_claim(calls, d.actor, later_claim, context);
    stop_cheat_caller_address(d.games);
    assert!(initial_cost > 0, "claim cost must be measured");
    assert_eq!(later_cost, initial_cost);
    assert_eq!(sat(d, first), 201);
    assert_eq!(sat(d, second), 201);
    assert_eq!(sat(d, home), 1601);
}

#[inline(never)]
fn measured_claim(
    calls: IBitcoinCommandsDispatcher,
    actor: starknet::ContractAddress,
    command: crate::bitcoin::ClaimPhase,
    context: ExecutionContext,
) -> u128 {
    let before = core::testing::get_available_gas();
    calls
        .claim_bitcoin_phase(3, actor, command, crate::commands::action_context(context), crate::tests::story_cursor())
        .story_result();
    before - core::testing::get_available_gas()
}

#[test]
fn capture_carries_unpaid_closed_prizes_once_and_old_claims_cannot_pay_them() {
    let (d, home, _) = setup();
    let mine = mine(d, 2000100);
    capture(d, mine, d.actor, 30);
    assert!(execute(d, contribute(home, 100), 40));
    close_and_bind(d, 4);
    capture(d, mine, 0x777.try_into().unwrap(), 51);
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 1000);
    assert_eq!(view.bitcoin_mine(mine).next_phase, 6);
    assert!(execute(d, claim(4, array![mine.entity_id].span()), 51));
    assert_eq!(sat(d, home) + sat(d, mine), 0);
    capture(d, mine, d.actor, 52);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 1000);
    assert!(execute(d, contribute(home, 100), 60));
    close_and_bind(d, 6);
    assert!(execute(d, claim(6, array![mine.entity_id].span()), 70));
    assert_eq!(sat(d, home), 1600);
    assert_eq!(sat(d, mine), 400);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 0);
    assert!(execute(d, claim(6, array![mine.entity_id].span()), 71));
    assert_eq!(sat(d, home) + sat(d, mine), 2000);
}

#[test]
fn capture_excludes_paid_phases_from_the_unpaid_prefix() {
    let (d, home, _) = setup();
    let mine = mine(d, 2000100);
    capture(d, mine, d.actor, 30);
    for phase in 4_u64..6 {
        assert!(execute(d, contribute(home, 100), phase * 10));
        close_and_bind(d, phase);
        if phase == 4 {
            assert!(execute(d, claim(4, array![mine.entity_id].span()), 50));
        }
    }
    capture(d, mine, 0x777.try_into().unwrap(), 60);
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(sat(d, home) + sat(d, mine), 1000);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 1000);
    assert!(execute(d, claim(5, array![mine.entity_id].span()), 61));
    assert_eq!(sat(d, home) + sat(d, mine), 1000);
    assert!(execute(d, contribute(home, 100), 70));
    close_and_bind(d, 7);
    assert!(execute(d, claim(7, array![mine.entity_id].span()), 80));
    assert_eq!(sat(d, home) + sat(d, mine), 3000);
}

#[test]
fn capture_carries_more_than_eight_unpaid_phases_without_a_scan() {
    let (d, _, _) = setup();
    let mine = mine(d, 2000100);
    capture(d, mine, d.actor, 30);
    for phase in 4_u64..14 {
        assert!(execute(d, Command::CloseBitcoinPhase(phase), (phase + 1) * 10));
    }
    capture(d, mine, 0x777.try_into().unwrap(), 140);
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 10000);
    assert_eq!(view.bitcoin_mine(mine).next_phase, 15);
    capture(d, mine, d.actor, 141);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 10000);
}

#[test]
fn capture_with_no_closed_eligible_phase_creates_no_carry() {
    let (d, _, _) = setup();
    let mine = mine(d, 2000100);
    capture(d, mine, d.actor, 30);
    capture(d, mine, 0x777.try_into().unwrap(), 31);
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 0);
    assert_eq!(view.bitcoin_mine(mine).next_phase, 4);
}

#[test]
fn capture_preserves_already_split_winner_carry_without_a_second_owner_cut() {
    let (d, first, second) = setup();
    let mine = mine(d, 2000100);
    let other = 0x777.try_into().unwrap();
    capture(d, mine, d.actor, 30);
    assert!(execute(d, contribute(first, 100), 40));
    set_owner(d, first, other);
    close_and_bind(d, 4);
    assert!(execute(d, claim(4, array![mine.entity_id].span()), 50));
    assert_eq!(sat(d, mine), 200);
    assert!(execute(d, Command::CloseBitcoinPhase(5), 59));
    capture(d, mine, other, 60);
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(mine).winner_carry, 800);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 1000);
    assert!(execute(d, contribute(second, 100), 70));
    close_and_bind(d, 7);
    assert!(execute(d, claim(7, array![mine.entity_id].span()), 80));
    assert_eq!(sat(d, second), 2400);
    assert_eq!(sat(d, mine), 600);
    assert_eq!(view.bitcoin_mine(mine).winner_carry, 0);
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 0);
}

#[test]
fn capture_at_the_inclusive_phase_end_carries_that_closed_phase() {
    let (d, home, _) = setup();
    let mine = mine(d, 2000100);
    capture(d, mine, d.actor, 30);
    assert!(execute(d, contribute(home, 100), 40));
    assert!(execute(d, Command::CloseBitcoinPhase(4), 49));
    assert!(execute(d, Command::BindBitcoinPhase(4), 49));
    capture(d, mine, 0x777.try_into().unwrap(), 49);
    let view = IBitcoinViewsDispatcher { contract_address: d.games };
    assert_eq!(view.bitcoin_mine(mine).unsplit_carry, 1000);
    assert_eq!(view.bitcoin_mine(mine).next_phase, 5);
    assert!(execute(d, claim(4, array![mine.entity_id].span()), 49));
    assert_eq!(sat(d, home) + sat(d, mine), 0);
}
