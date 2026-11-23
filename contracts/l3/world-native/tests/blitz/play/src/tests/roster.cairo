use starknet::ContractAddress;
pub use world_test_support::tests::troop_management::*;
use super::fixture::{blitz_game, blitz_game_from, record_roster};
use super::play_fixture::{FIXTURE_START, encode, fixture_params};
use super::resource_commands::{assert_executes, execute_in_game};
use super::unlimited_production::settle;

const NOW: u64 = FIXTURE_START + 40;
const MAIN: u64 = FIXTURE_START + 3600;

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

fn labor(d: super::Deployment, realm: ResourceKey) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(
            ResourceSlot { game_id: realm.game_id, entity_id: realm.entity_id, resource_type: crate::resources::LABOR },
        )
}

#[test]
fn a_realm_seated_before_the_main_start_produces_from_the_main_start() {
    let (d, game_id) = blitz_game_from(
        crate::registrar::CreateGameParams { start_main_at: MAIN, ..fixture_params('blitz') },
    );
    record_roster(d, game_id, array![d.actor].span());
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    let realm = ResourceKey { game_id, entity_id: 1 };
    let seated = labor(d, realm);
    settle(d, realm, crate::resources::LABOR, MAIN);
    assert_eq!(labor(d, realm), seated);
    let production = settle(d, realm, crate::resources::LABOR, MAIN + 600);
    assert_eq!(labor(d, realm), seated + 600 * production.production_rate.into());
}
