use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use crate::blitz_results::{
    IBlitzResultsDispatcher, IBlitzResultsDispatcherTrait, IBlitzResultsSafeDispatcher,
    IBlitzResultsSafeDispatcherTrait, PlayerResult, RecordBlitzResults,
};
use crate::commands::{Command, ExecutionContext};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::registrar::RosterPlayer;
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use super::resource_commands::{execute, set_fixture, setup_with_rules};

fn player(index: u32) -> ContractAddress {
    Into::<u32, felt252>::into(100 + index).try_into().unwrap()
}
fn result(index: u32, points: u128, rank: u8) -> PlayerResult {
    PlayerResult { player: player(index), points, rank }
}
fn view(d: super::Deployment) -> IBlitzResultsDispatcher {
    IBlitzResultsDispatcher { contract_address: d.peers.prizes }
}
fn games(d: super::Deployment) -> IGameDispatcher {
    IGameDispatcher { contract_address: d.peers.season }
}
fn setup(scores: Span<u128>) -> super::Deployment {
    let (d, _, _) = setup_with_rules(crate::rules::SliceRules { blitz_mode_on: true, ..super::recorded::rules() });
    let d = super::bind_authority(d);
    set_fixture(d.peers.registry, selector!("roster_sizes"), array![3].span(), scores.len());
    for index in 0..scores.len() {
        set_fixture(
            d.peers.registry,
            selector!("roster_players"),
            array![3, index.into()].span(),
            RosterPlayer { owner: player(index), account: player(index) },
        );
        set_fixture(
            d.peers.season, selector!("player_points"), array![3, player(index).into()].span(), *scores.at(index),
        );
    }
    set_fixture(
        d.peers.season,
        selector!("games"),
        array![3].span(),
        crate::game::GameRegistry { settled: true, ..games(d).game(3) },
    );
    d
}
fn submit(d: super::Deployment, start: u8, players: Span<PlayerResult>) -> bool {
    let season = ISeasonDispatcher { contract_address: d.peers.season };
    let nonce = season.next_nonce(3, d.actor);
    let order = season.execution_head().order;
    let passed = execute(d, Command::RecordBlitzResults(RecordBlitzResults { start, players }), 500);
    assert_eq!(season.next_nonce(3, d.actor), nonce + 1);
    assert_eq!(season.execution_head().order, order + 1);
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
fn results_require_the_authority_domain_path_and_finished_point_settlement() {
    let d = setup(array![10].span());
    let safe = IBlitzResultsSafeDispatcher { contract_address: d.peers.prizes };
    let command = RecordBlitzResults { start: 0, players: array![result(0, 10, 1)].span() };
    let context = ExecutionContext { timestamp: 500, raw_root: 1 };
    assert!(safe.record_blitz_results(3, d.actor, command, context).is_err());
    start_cheat_caller_address(d.peers.prizes, d.peers.season);
    assert!(safe.record_blitz_results(3, player(99), command, context).is_err());
    assert!(safe.record_blitz_results(3, d.actor, command, ExecutionContext { timestamp: 199, ..context }).is_err());
    stop_cheat_caller_address(d.peers.prizes);
    let game = games(d).game(3);
    set_fixture(
        d.peers.season, selector!("games"), array![3].span(), crate::game::GameRegistry { settled: false, ..game },
    );
    assert!(!submit(d, 0, command.players));
    assert!(execute(d, Command::MarkGameSettled, 500));
    assert!(submit(d, 0, command.players));
}

#[test]
fn final_history_is_emitted_once_and_retry_does_not_rewrite_the_result() {
    let d = setup(array![0].span());
    let players = array![result(0, 0, 1)].span();
    let mut spy = snforge_std::spy_events();
    assert!(submit(d, 0, players));
    let events = spy.get_events().emitted_by(d.peers.prizes).events;
    assert_eq!(events.len(), 2);
    assert!(view(d).blitz_result(3).complete);
    let mut retry = snforge_std::spy_events();
    assert!(submit(d, 0, players));
    assert!(retry.get_events().emitted_by(d.peers.prizes).events.is_empty());
}

#[test]
#[feature("safe_dispatcher")]
fn results_are_game_scoped_and_an_absent_roster_rejects() {
    let d = setup(array![100].span());
    assert!(submit(d, 0, array![result(0, 100, 1)].span()));
    let safe = IBlitzResultsSafeDispatcher { contract_address: d.peers.prizes };
    assert!(safe.blitz_result(4).is_err());
    set_fixture(d.peers.registry, selector!("roster_sizes"), array![4].span(), 1_u32);
    set_fixture(
        d.peers.registry,
        selector!("roster_players"),
        array![4, 0].span(),
        RosterPlayer { owner: player(0), account: player(0) },
    );
    let other = view(d).blitz_result(4);
    assert!(other.players.is_empty());
    assert!(!other.complete);
    assert_eq!(other.commitment, 0);
    assert!(view(d).blitz_result(3).complete);
}
