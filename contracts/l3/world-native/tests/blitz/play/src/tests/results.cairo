use crate::logic::blitz::results::{BlitzResult, RankedPlayer};
use super::fixture::{blitz_game, record_roster};
use super::play_fixture::FIXTURE_START;
use super::resource_commands::assert_executes;

const NOW: u64 = FIXTURE_START + 40;
const LEDGER_RESULT_COMMITMENT: felt252 = 0x5d912378a36e87b3b4331c33a3cb97ad23ddfbcab670825f2fa18743f34c6d6;

pub fn result(d: super::Deployment, game_id: u32) -> BlitzResult {
    let mut output = crate::games::IGamesSlotsDispatcherTrait::view_call(
        crate::games::IGamesSlotsDispatcher { contract_address: d.games },
        game_id,
        crate::slots::PRIZES,
        array![].span(),
    );
    Serde::deserialize(ref output).unwrap()
}

pub fn settle(d: super::Deployment, game_id: u32) {
    let end_at = snforge_std::interact_with_state(d.games, || crate::logic::game::game(game_id).end_at);
    assert_executes(d, game_id, super::Command::MarkGameSettled(()), end_at + 600);
}

pub fn commitment(d: super::Deployment, game_id: u32, players: Span<RankedPlayer>) -> felt252 {
    snforge_std::interact_with_state(
        d.games,
        || crate::logic::blitz::results::result_commitment(starknet::get_tx_info().unbox().chain_id, game_id, players),
    )
}

fn seated_pair() -> (super::Deployment, u32, starknet::ContractAddress) {
    let (d, game_id) = blitz_game();
    let (rival, _) = super::deploy_player(3, super::GUARDIAN);
    record_roster(d, game_id, array![d.actor, rival].span());
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    (d, game_id, rival)
}

#[test]
fn a_game_has_no_result_before_its_settlement() {
    let (d, game_id, _) = seated_pair();
    assert_eq!(result(d, game_id), BlitzResult { players: array![].span(), complete: false, commitment: 0 });
}

#[test]
fn players_level_on_points_share_the_first_rank_in_wallet_order() {
    let (d, game_id, rival) = seated_pair();
    settle(d, game_id);
    let (low, high) = if d.actor < rival {
        (d.actor, rival)
    } else {
        (rival, d.actor)
    };
    let players = array![RankedPlayer { wallet: low, rank: 1 }, RankedPlayer { wallet: high, rank: 1 }].span();
    assert_eq!(
        result(d, game_id), BlitzResult { players, complete: true, commitment: commitment(d, game_id, players) },
    );
}

#[test]
#[should_panic(expected: "results take no calldata")]
fn the_result_view_takes_no_calldata() {
    let (d, game_id, _) = seated_pair();
    crate::games::IGamesSlotsDispatcherTrait::view_call(
        crate::games::IGamesSlotsDispatcher { contract_address: d.games },
        game_id,
        crate::slots::PRIZES,
        array![1].span(),
    );
}

#[test]
fn the_result_commitment_is_the_ledgers() {
    let players = array![
        RankedPlayer { wallet: 1000.try_into().unwrap(), rank: 1 },
        RankedPlayer { wallet: 1001.try_into().unwrap(), rank: 1 },
    ];
    assert_eq!(crate::logic::blitz::results::result_commitment('shard', 7, players.span()), LEDGER_RESULT_COMMITMENT);
}
