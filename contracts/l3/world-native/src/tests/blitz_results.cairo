use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use crate::blitz_results::{
    IBlitzResultsDispatcher, IBlitzResultsDispatcherTrait, IBlitzResultsSafeDispatcher,
    IBlitzResultsSafeDispatcherTrait, RankedPlayer,
};
use crate::commands::{Command, ExecutionContext};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::registrar::RosterPlayer;
use super::resource_commands::{execute, set_fixture, setup_with_rules};

fn player(index: u32) -> ContractAddress {
    Into::<u32, felt252>::into(100 + index).try_into().unwrap()
}
fn result(index: u32, rank: u16) -> RankedPlayer {
    RankedPlayer { wallet: player(index), rank }
}
fn view(d: super::Deployment) -> IBlitzResultsDispatcher {
    IBlitzResultsDispatcher { contract_address: d.games }
}
fn games(d: super::Deployment) -> IGameDispatcher {
    IGameDispatcher { contract_address: d.games }
}
fn setup(scores: Span<u128>) -> super::Deployment {
    let (d, _, _) = setup_with_rules(
        crate::rules::SliceRules {
            mode_rules: super::play_fixture::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::play_fixture::BLITZ_COMMAND_MASK,
            ..super::play_fixture::rules(),
        },
    );
    set_fixture(d.games, selector!("registrar"), selector!("roster_sizes"), array![3].span(), scores.len());
    for index in 0..scores.len() {
        set_fixture(
            d.games,
            selector!("registrar"),
            selector!("roster_players"),
            array![3, index.into()].span(),
            RosterPlayer { account: player(index), wallet: player(index) },
        );
        set_fixture(
            d.games,
            selector!("season"),
            selector!("player_points"),
            array![3, player(index).into()].span(),
            *scores.at(index),
        );
    }
    set_fixture(
        d.games,
        selector!("games"),
        selector!("games"),
        array![3].span(),
        crate::game::GameRegistry { settled: true, ..games(d).game(3) },
    );
    d
}
fn submit(d: super::Deployment) -> bool {
    execute(d, Command::RecordBlitzResults, 500)
}

#[test]
fn the_shard_derives_all_competition_ties_and_zero_point_players_in_one_call() {
    let d = setup(array![600, 600, 400, 0, 0].span());
    assert!(submit(d));
    let complete = view(d).blitz_result(3);
    assert_eq!(complete.players, array![result(0, 1), result(1, 1), result(2, 3), result(3, 4), result(4, 4)].span());
    assert!(complete.complete);
    let expected = core::poseidon::poseidon_hash_span(
        array![
            'ETERNUM_BLITZ_RESULT', 3, starknet::get_tx_info().unbox().chain_id, 3, 5, 100, 1, 101, 1, 102, 3, 103, 4,
            104, 4,
        ]
            .span(),
    );
    assert_eq!(complete.commitment, expected);
    assert!(submit(d));
    assert_eq!(view(d).blitz_result(3), complete);
}

#[test]
fn a_maximum_roster_completes_atomically_without_caller_ranks_or_a_cursor() {
    let mut scores = array![];
    for _ in 0_u32..24 {
        scores.append(0);
    }
    let d = setup(scores.span());
    assert!(submit(d));
    let complete = view(d).blitz_result(3);
    assert!(complete.complete && complete.players.len() == 24);
    for index in 0_u32..24 {
        assert_eq!(*complete.players.at(index), result(index, 1));
    }
}

#[test]
#[feature("safe_dispatcher")]
fn results_require_finished_point_settlement_without_authority() {
    let d = setup(array![10].span());
    let safe = IBlitzResultsSafeDispatcher { contract_address: d.games };
    let context = ExecutionContext { timestamp: 500, raw_root: 1, ..super::context(d.games, 3) };
    start_cheat_caller_address(d.games, d.games);
    assert!(
        safe
            .record_blitz_results(
                3, d.actor, crate::commands::action_context(ExecutionContext { timestamp: 199, ..context }),
            )
            .is_err(),
    );
    stop_cheat_caller_address(d.games);
    let game = games(d).game(3);
    set_fixture(
        d.games,
        selector!("games"),
        selector!("games"),
        array![3].span(),
        crate::game::GameRegistry { settled: false, ..game },
    );
    assert!(!submit(d));
    assert!(view(d).blitz_result(3).players.is_empty());
    assert!(execute(d, Command::MarkGameSettled, 500));
    assert!(submit(d));
}

#[test]
#[feature("safe_dispatcher")]
fn results_are_game_scoped_and_an_absent_roster_rejects() {
    let d = setup(array![100].span());
    assert!(submit(d));
    let safe = IBlitzResultsSafeDispatcher { contract_address: d.games };
    assert!(safe.blitz_result(4).is_err());
    set_fixture(d.games, selector!("registrar"), selector!("roster_sizes"), array![4].span(), 1_u32);
    set_fixture(
        d.games,
        selector!("registrar"),
        selector!("roster_players"),
        array![4, 0].span(),
        RosterPlayer { account: player(0), wallet: player(0) },
    );
    let other = view(d).blitz_result(4);
    assert!(other.players.is_empty());
    assert!(!other.complete);
    assert_eq!(other.commitment, 0);
    assert!(view(d).blitz_result(3).complete);
}

#[test]
fn final_history_is_emitted_once_and_retry_does_not_rewrite_the_result() {
    let d = setup(array![0].span());
    let mut spy = snforge_std::spy_events();
    assert!(submit(d));
    let mut result_events = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events {
        if *event.keys.at(0) == selector!("BlitzEvent") {
            result_events += 1;
        }
    }
    assert_eq!(result_events, 2);
    let complete = view(d).blitz_result(3);
    assert!(complete.complete);
    let mut retry = snforge_std::spy_events();
    assert!(submit(d));
    assert_eq!(view(d).blitz_result(3), complete);
    for (_, event) in retry.get_events().emitted_by(d.games).events {
        assert!(*event.keys.at(0) != selector!("BlitzEvent"), "retry re-emitted final result");
    }
}

#[test]
fn any_caller_gets_the_same_immutable_result_from_the_frozen_roster() {
    let first = setup(array![600, 600, 400, 0].span());
    let second = setup(array![600, 600, 400, 0].span());
    let owner = super::bind_authority(second);
    assert!(first.actor != super::authority());
    assert_eq!(owner.actor, super::authority());
    assert!(submit(first));
    assert!(submit(owner));
    assert_eq!(view(first).blitz_result(3), view(second).blitz_result(3));
}

#[test]
fn result_commitment_matches_the_ledger_v3_golden_vector_and_separates_shards() {
    let players = array![
        RankedPlayer { wallet: 1000.try_into().unwrap(), rank: 1 },
        RankedPlayer { wallet: 1001.try_into().unwrap(), rank: 1 },
    ]
        .span();
    let commitment = crate::blitz_results::result_commitment('shard', 7, players);
    assert_eq!(commitment, 0x5d912378a36e87b3b4331c33a3cb97ad23ddfbcab670825f2fa18743f34c6d6);
    assert!(crate::blitz_results::result_commitment('OTHER_SHARD', 7, players) != commitment);
}

#[test]
fn tied_results_sort_by_frozen_payout_wallet_instead_of_shard_account() {
    let d = setup(array![100, 100].span());
    set_fixture(
        d.games,
        selector!("registrar"),
        selector!("roster_players"),
        array![3, 0].span(),
        RosterPlayer { account: player(0), wallet: player(1) },
    );
    set_fixture(
        d.games,
        selector!("registrar"),
        selector!("roster_players"),
        array![3, 1].span(),
        RosterPlayer { account: player(1), wallet: player(0) },
    );
    assert!(submit(d));
    assert_eq!(view(d).blitz_result(3).players, array![result(0, 1), result(1, 1)].span());
    assert!(view(d).blitz_result(3).complete);
}

#[test]
fn results_resolve_scores_through_the_frozen_wallet_to_account_binding() {
    let d = setup(array![100, 80].span());
    set_fixture(
        d.games,
        selector!("registrar"),
        selector!("roster_players"),
        array![3, 0].span(),
        RosterPlayer { account: player(0), wallet: player(1) },
    );
    set_fixture(
        d.games,
        selector!("registrar"),
        selector!("roster_players"),
        array![3, 1].span(),
        RosterPlayer { account: player(1), wallet: player(0) },
    );
    assert!(submit(d));
    assert_eq!(view(d).blitz_result(3).players, array![result(1, 1), result(0, 2)].span());
    assert!(view(d).blitz_result(3).complete);
}


#[test]
fn result_command_has_no_payload_and_old_caller_ranks_refuse_at_decode() {
    let command = super::play_fixture::encode(Command::RecordBlitzResults);
    assert_eq!(command.len(), 1);
    assert!(crate::commands::validated_command(command).is_ok());
    let mut old = array![];
    for field in command {
        old.append(*field);
    }
    // The old start/length/wallet/rank payload can neither select ranks nor reach the roll.
    old.append(0);
    old.append(1);
    old.append(100);
    old.append(1);
    assert!(crate::commands::validated_command(old.span()).is_err());
}
