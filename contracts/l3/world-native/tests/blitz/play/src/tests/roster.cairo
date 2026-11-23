use starknet::ContractAddress;
pub use world_test_support::tests::troop_management::*;
use crate::games::{IGamesSlotsDispatcher, IGamesSlotsDispatcherTrait};
use super::fixture::blitz_game;
use super::play_fixture::{FIXTURE_START, encode};
use super::resource_commands::{assert_executes, execute_in_game};

const NOW: u64 = FIXTURE_START + 40;

fn record_roster(d: super::Deployment, game_id: u32, players: Span<ContractAddress>) {
    let mut calldata = array![];
    (game_id, players).serialize(ref calldata);
    start_cheat_caller_address(d.games, super::authority());
    IGamesSlotsDispatcher { contract_address: d.games }
        .authority_call(crate::game::BLITZ, crate::slots::SETTLEMENT, calldata.span());
    stop_cheat_caller_address(d.games);
}

fn two_player_roster() -> (super::Deployment, u32, ContractAddress) {
    let (d, game_id) = blitz_game();
    let (rival, _) = super::deploy_player(3, super::GUARDIAN);
    record_roster(d, game_id, array![d.actor, rival].span());
    (d, game_id, rival)
}

fn realm_owner_and_troop(d: super::Deployment, game_id: u32, entity_id: u64) -> (ContractAddress, TroopType) {
    let key = ResourceKey { game_id, entity_id };
    let realm = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    assert_eq!(realm.base.category, crate::taxonomy::REALM_CATEGORY);
    let guard = IGuardsDispatcher { contract_address: d.games }
        .guard(GuardKey { game_id, structure_id: entity_id, slot: 0 });
    (realm.owner, guard.troops.category)
}

#[test]
fn a_recorded_roster_seats_each_player_on_three_realms_dealt_one_troop_type_each() {
    let (d, game_id, rival) = two_player_roster();
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    let mut seated = array![];
    for first in array![1_u64, 4] {
        let (owner, one) = realm_owner_and_troop(d, game_id, first);
        let (second_owner, two) = realm_owner_and_troop(d, game_id, first + 1);
        let (third_owner, three) = realm_owner_and_troop(d, game_id, first + 2);
        assert!(owner == second_owner && owner == third_owner, "a seat's three realms have one owner");
        assert!(one != two && two != three && one != three, "a seat is dealt each troop type once");
        seated.append(owner);
    }
    assert!(
        (*seated[0] == d.actor && *seated[1] == rival) || (*seated[0] == rival && *seated[1] == d.actor),
        "every roster player is seated once",
    );
}

#[test]
fn a_seated_roster_takes_no_further_seat() {
    let (d, game_id, _) = two_player_roster();
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    assert!(!execute_in_game(d, game_id, super::Command::SeatBlitzRoster(()), NOW));
}

#[test]
fn a_game_seating_its_roster_refuses_every_other_command() {
    let (d, game_id, _) = two_player_roster();
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    let name = SetEntityName { entity_id: 1, name: 'home' };
    super::assert_entry_refusal(d, game_id, 1, encode(super::Command::SetEntityName(name)), "roster not seated");
}

#[test]
#[should_panic(expected: "roster already recorded")]
fn a_game_records_its_roster_once() {
    let (d, game_id, rival) = two_player_roster();
    record_roster(d, game_id, array![rival].span());
}

#[test]
#[should_panic(expected: "duplicate roster player")]
fn a_roster_names_each_player_once() {
    let (d, game_id) = blitz_game();
    record_roster(d, game_id, array![d.actor, d.actor].span());
}
