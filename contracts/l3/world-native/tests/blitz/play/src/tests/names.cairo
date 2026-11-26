pub use world_test_support::tests::troop_management::*;
use super::fixture::{blitz_realm, rival_realm};
use super::play_fixture::FIXTURE_START;
use super::resource_commands::{execute_in_game, grant};

const NOW: u64 = FIXTURE_START + 40;
const KNIGHT_T1: u8 = 26;

fn name(entity_id: u64, name: felt252) -> Command {
    Command::SetEntityName(SetEntityName { entity_id, name })
}

fn named(d: super::Deployment, home: ResourceKey, entity_id: u64) -> felt252 {
    INamesDispatcher { contract_address: d.games }.entity_name(ResourceKey { entity_id, ..home }).name
}

#[test]
fn a_player_names_a_realm_and_its_army() {
    let (d, home) = blitz_realm();
    grant(d, home, KNIGHT_T1, 100 * RESOURCE_PRECISION);
    let raise = Command::CreateExplorer(
        CreateExplorer {
            slot: 0, structure_id: home.entity_id, category: 0, tier: 0, amount: 100 * RESOURCE_PRECISION, direction: 0,
        },
    );
    assert!(execute_in_game(d, home.game_id, raise, NOW));
    let army = *IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home).at(0);
    assert!(execute_in_game(d, home.game_id, name(home.entity_id, 'Home'), NOW));
    assert!(execute_in_game(d, home.game_id, name(army, 'Vanguard'), NOW));
    assert_eq!(named(d, home, home.entity_id), 'Home');
    assert_eq!(named(d, home, army), 'Vanguard');
}

#[test]
fn a_player_does_not_name_a_realm_of_another() {
    let (d, home) = blitz_realm();
    let (_, rival_home) = rival_realm(d, home);
    assert!(!execute_in_game(d, home.game_id, name(rival_home.entity_id, 'Taken'), NOW));
    assert_eq!(named(d, home, rival_home.entity_id), 0);
}

#[test]
fn blitz_buy_seal_and_move_dispatch_to_their_handlers() {
    let mut encoded = array![];
    Command::BuySeal.serialize(ref encoded);
    let (_, route, payload) = crate::commands::route_command(encoded.span()).unwrap();
    assert_eq!(route.selector, selector!("buy_seal"));
    assert!(payload.is_empty());
    let mut encoded = array![];
    Command::Move(crate::commands::Move { explorer_id: 7, directions: array![0_u8].span() }).serialize(ref encoded);
    let (_, route, payload) = crate::commands::route_command(encoded.span()).unwrap();
    assert_eq!(route.selector, selector!("move_explorer"));
    assert_eq!(payload, array![7, 1, 0].span());
}

#[test]
fn frontier_realm_skin_tag_has_no_blitz_route() {
    let values = array![79, 7, crate::names::BASE_REALM_SKIN.into()];
    assert_eq!(crate::commands::route_command(values.span()).unwrap_err(), 'INVALID_COMMAND');
    assert!(!crate::rules::command_enabled(crate::balance::rules::SWITCHES.command_mask, 79));
}
