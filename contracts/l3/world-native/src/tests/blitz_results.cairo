use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use crate::blitz_results::{
    IBlitzResultsDispatcher, IBlitzResultsDispatcherTrait, IBlitzResultsSafeDispatcher,
    IBlitzResultsSafeDispatcherTrait, PlayerResult, RecordBlitzResults,
};
use crate::commands::{Command, ExecutionContext};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::games::{IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait};
use crate::registrar::RosterPlayer;
use super::resource_commands::{execute, set_fixture, setup_with_rules};

fn player(index: u32) -> ContractAddress {
    Into::<u32, felt252>::into(100 + index).try_into().unwrap()
}
fn result(index: u32, points: u128, rank: u8) -> PlayerResult {
    PlayerResult { player: player(index), points, rank }
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
            mode_rules: super::recorded::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::recorded::BLITZ_COMMAND_MASK,
            ..super::recorded::rules(),
        },
    );
    set_fixture(d.games, selector!("registrar"), selector!("roster_sizes"), array![3].span(), scores.len());
    for index in 0..scores.len() {
        set_fixture(
            d.games,
            selector!("registrar"),
            selector!("roster_players"),
            array![3, index.into()].span(),
            RosterPlayer { account: player(index) },
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
fn submit(d: super::Deployment, start: u8, players: Span<PlayerResult>) -> bool {
    let season = IGamesAuthenticationDispatcher { contract_address: d.games };
    let nonce = season.next_nonce(3, d.actor);
    let order = super::recorded::head(d.games, 3).order;
    let passed = execute(d, Command::RecordBlitzResults(RecordBlitzResults { start, players }), 500);
    assert_eq!(season.next_nonce(3, d.actor), nonce + 1);
    assert_eq!(super::recorded::head(d.games, 3).order, order + 1);
    passed
}

#[test]
fn results_resume_with_competition_ties_and_zero_point_players_tied_last() {
    let d = setup(array![600, 600, 400, 0, 0].span());
    let first = array![result(0, 600, 1), result(1, 600, 1)].span();
    assert!(submit(d, 0, first));
    let partial = view(d).blitz_result(3);
    assert_eq!(partial.players, first);
    assert!(!partial.complete && partial.commitment == 0);
    assert!(submit(d, 0, first));
    assert_eq!(view(d).blitz_result(3), partial);
    assert!(submit(d, 2, array![result(2, 400, 3), result(3, 0, 4), result(4, 0, 4)].span()));
    let complete = view(d).blitz_result(3);
    assert!(complete.complete);
    let expected = core::poseidon::poseidon_hash_span(
        array!['ETERNUM_BLITZ_RESULT', 1, 3, 5, 100, 600, 1, 101, 600, 1, 102, 400, 3, 103, 0, 4, 104, 0, 4].span(),
    );
    assert_eq!(complete.commitment, expected);
    assert!(submit(d, 2, array![result(2, 400, 3), result(3, 0, 4), result(4, 0, 4)].span()));
    assert_eq!(view(d).blitz_result(3), complete);
}

#[test]
fn results_reject_wrong_points_ranks_order_duplicates_and_foreign_players_atomically() {
    let d = setup(array![100, 80, 20].span());
    for players in array![
        array![result(0, 99, 1)].span(), array![result(0, 100, 2)].span(),
        array![result(1, 80, 1), result(0, 100, 2)].span(), array![result(0, 100, 1), result(0, 100, 1)].span(),
        array![result(0, 100, 1), result(99, 0, 2)].span(),
    ] {
        assert!(!submit(d, 0, players));
        assert!(view(d).blitz_result(3).players.is_empty());
    }
    assert!(submit(d, 0, array![result(0, 100, 1)].span()));
    assert!(!submit(d, 1, array![result(0, 100, 1)].span()));
    assert!(!submit(d, 0, array![result(1, 80, 1)].span()));
    assert_eq!(view(d).blitz_result(3).players.len(), 1);
}

#[test]
fn omitted_players_never_finalize_and_batches_cannot_skip_or_overlap_the_cursor() {
    let d = setup(array![100, 80, 0].span());
    assert!(!submit(d, 0, array![result(1, 80, 2)].span()));
    assert!(!submit(d, 1, array![result(1, 80, 2)].span()));
    assert!(!submit(d, 0, array![].span()));
    assert!(submit(d, 0, array![result(0, 100, 1)].span()));
    assert!(!submit(d, 0, array![result(0, 100, 1), result(1, 80, 2)].span()));
    assert!(submit(d, 1, array![result(1, 80, 2)].span()));
    assert!(!view(d).blitz_result(3).complete);
    assert!(!submit(d, 3, array![result(2, 0, 3)].span()));
    assert!(submit(d, 2, array![result(2, 0, 3)].span()));
    assert!(view(d).blitz_result(3).complete);
}

#[test]
fn the_full_roster_stays_bounded_to_eight_results_per_ticket() {
    let mut scores = array![];
    for _ in 0_u32..24 {
        scores.append(0);
    }
    let d = setup(scores.span());
    let mut too_many = array![];
    for index in 0_u32..9 {
        too_many.append(result(index, 0, 1));
    }
    assert!(!submit(d, 0, too_many.span()));
    for batch in 0_u32..3 {
        let mut players = array![];
        for index in (batch * 8)..(batch * 8 + 8) {
            players.append(result(index, 0, 1));
        }
        super::season_lifecycle::execute_batch(
            d,
            Command::RecordBlitzResults(
                RecordBlitzResults { start: (batch * 8).try_into().unwrap(), players: players.span() },
            ),
            500,
            (16 - batch * 8).into(),
        );
    }
    let recorded = view(d).blitz_result(3);
    assert!(recorded.complete && recorded.players.len() == 24);
}

#[test]
#[feature("safe_dispatcher")]
fn results_require_finished_point_settlement_without_authority() {
    let d = setup(array![10].span());
    let safe = IBlitzResultsSafeDispatcher { contract_address: d.games };
    let command = RecordBlitzResults { start: 0, players: array![result(0, 10, 1)].span() };
    let context = ExecutionContext { timestamp: 500, raw_root: 1, ..super::context(d.games, 3) };
    start_cheat_caller_address(d.games, d.games);
    assert!(
        safe
            .record_blitz_results(
                3,
                d.actor,
                command,
                crate::commands::action_context(ExecutionContext { timestamp: 199, ..context }),
                crate::tests::story_cursor(),
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
    assert!(!submit(d, 0, command.players));
    assert!(execute(d, Command::MarkGameSettled, 500));
    assert!(submit(d, 0, command.players));
}

#[test]
#[feature("safe_dispatcher")]
fn results_are_game_scoped_and_an_absent_roster_rejects() {
    let d = setup(array![100].span());
    assert!(submit(d, 0, array![result(0, 100, 1)].span()));
    let safe = IBlitzResultsSafeDispatcher { contract_address: d.games };
    assert!(safe.blitz_result(4).is_err());
    set_fixture(d.games, selector!("registrar"), selector!("roster_sizes"), array![4].span(), 1_u32);
    set_fixture(
        d.games,
        selector!("registrar"),
        selector!("roster_players"),
        array![4, 0].span(),
        RosterPlayer { account: player(0) },
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
    let players = array![result(0, 0, 1)].span();
    let mut spy = snforge_std::spy_events();
    assert!(submit(d, 0, players));
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
    assert!(submit(d, 0, players));
    assert_eq!(view(d).blitz_result(3), complete);
    for (_, event) in retry.get_events().emitted_by(d.games).events {
        assert!(*event.keys.at(0) != selector!("BlitzEvent"), "retry re-emitted final result");
    }
}


#[test]
fn result_batches_have_one_canonical_boundary_and_commitment_for_any_caller() {
    let first = setup(array![600, 600, 400, 0].span());
    let second = setup(array![600, 600, 400, 0].span());
    let creator = super::bind_authority(second);
    assert!(first.actor != games(first).game(3).creator);
    assert_eq!(creator.actor, games(second).game(3).creator);
    let ordered = array![result(0, 600, 1), result(1, 600, 1), result(2, 400, 3), result(3, 0, 4)].span();
    assert!(submit(first, 0, ordered.slice(0, 1)));
    let partial = view(first).blitz_result(3);
    // A new batch may neither restart an equal-score group nor jump over its next account.
    assert!(!submit(first, 1, ordered.slice(0, 1)));
    assert!(!submit(first, 1, ordered.slice(2, 1)));
    assert!(!submit(first, 0, ordered.slice(0, 2)));
    assert_eq!(view(first).blitz_result(3), partial);
    assert!(submit(first, 1, ordered.slice(1, 3)));
    assert!(submit(creator, 0, ordered.slice(0, 3)));
    assert!(submit(creator, 3, ordered.slice(3, 1)));
    assert_eq!(view(first).blitz_result(3), view(second).blitz_result(3));
    assert!(view(first).blitz_result(3).complete);
}

#[test]
fn tied_result_accounts_cannot_skip_the_canonical_first_player() {
    let d = setup(array![100, 100, 100].span());
    assert!(!submit(d, 0, array![result(1, 100, 1)].span()));
    assert!(view(d).blitz_result(3).players.is_empty());
    assert!(submit(d, 0, array![result(0, 100, 1)].span()));
    assert!(!submit(d, 1, array![result(2, 100, 1)].span()));
    assert_eq!(view(d).blitz_result(3).players, array![result(0, 100, 1)].span());
}
