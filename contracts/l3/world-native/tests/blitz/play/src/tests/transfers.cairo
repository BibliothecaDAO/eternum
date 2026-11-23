pub use world_test_support::tests::troop_management::*;
use crate::resources::ResourceAmount;
use super::fixture::{REALM_COORD, SECOND_COORD, WOOD, blitz_realm, rival_realm, second_realm};
use super::play_fixture::FIXTURE_START;
use super::resource_commands::{execute_in_game, grant};

const NOW: u64 = FIXTURE_START + 40;
const WHEAT: u8 = 35;
const KNIGHT_T1: u8 = 26;

fn amount(units: u128) -> u128 {
    units * RESOURCE_PRECISION
}

fn wood(units: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type: WOOD, amount: amount(units) }].span()
}

fn balance(d: super::Deployment, key: ResourceKey, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type })
}

fn send(from: ResourceKey, to: ResourceKey, resources: Span<ResourceAmount>) -> Command {
    Command::SendResources(
        crate::resources::ResourceTransfer { from_entity_id: from.entity_id, to_entity_id: to.entity_id, resources },
    )
}

fn raise(home: ResourceKey, direction: u8) -> Command {
    Command::CreateExplorer(
        CreateExplorer { slot: 0, structure_id: home.entity_id, category: 0, tier: 0, amount: amount(100), direction },
    )
}

fn armies_beside(d: super::Deployment, home: ResourceKey) -> (ResourceKey, ResourceKey) {
    assert!(execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), NOW));
    grant(d, home, KNIGHT_T1, amount(200));
    assert!(execute_in_game(d, home.game_id, raise(home, 0), NOW));
    assert!(execute_in_game(d, home.game_id, raise(home, 1), NOW));
    let armies = IStructureOperationsDispatcher { contract_address: d.games }.home_armies(home);
    (ResourceKey { entity_id: *armies.at(0), ..home }, ResourceKey { entity_id: *armies.at(1), ..home })
}

#[test]
fn a_realm_sends_resources_to_another_of_its_realms_and_they_arrive() {
    let (d, home) = blitz_realm();
    let second = second_realm(d, home, d.actor);
    grant(d, home, WOOD, amount(100));
    grant(d, home, crate::transport::DONKEY, amount(10));
    assert!(execute_in_game(d, home.game_id, send(home, second, wood(100)), NOW));
    assert_eq!(balance(d, home, WOOD), 0);
    let travel = crate::transport::travel_time(
        REALM_COORD, SECOND_COORD, wood(100), crate::balance::rules::SPEED_CONFIG, false,
    );
    let tick = crate::balance::rules::TICK_CONFIG.delivery_tick_in_seconds;
    let arrival = crate::arrivals::arrival_key(home.game_id, second.entity_id, tick, NOW, travel);
    let offload = Command::OffloadArrival(
        crate::arrivals::OffloadArrival {
            entity_id: second.entity_id, day: arrival.day, slot: arrival.slot, resource_count: 1,
        },
    );
    assert!(execute_in_game(d, home.game_id, offload, NOW + travel + 2 * tick));
    assert_eq!(balance(d, second, WOOD), amount(100));
}

#[test]
fn a_realm_sends_nothing_to_a_realm_of_another() {
    let (d, home) = blitz_realm();
    let (_, rival_home) = rival_realm(d, home);
    grant(d, home, WOOD, amount(100));
    grant(d, home, crate::transport::DONKEY, amount(10));
    assert!(!execute_in_game(d, home.game_id, send(home, rival_home, wood(100)), NOW));
    assert_eq!(balance(d, home, WOOD), amount(100));
}

#[test]
fn a_realm_burns_its_own_resources() {
    let (d, home) = blitz_realm();
    grant(d, home, WOOD, amount(100));
    let burn = Command::BurnStructureResources(
        crate::resources::ResourceBurn { entity_id: home.entity_id, resources: wood(40) },
    );
    assert!(execute_in_game(d, home.game_id, burn, NOW));
    assert_eq!(balance(d, home, WOOD), amount(60));
}

#[test]
fn an_army_unloads_into_its_realm_and_hands_over_to_an_army_beside_it() {
    let (d, home) = blitz_realm();
    let (first, second) = armies_beside(d, home);
    grant(d, first, WHEAT, amount(30));
    let hand_over = Command::TransferExplorerResources(
        crate::resources::ResourceTransfer {
            from_entity_id: first.entity_id,
            to_entity_id: second.entity_id,
            resources: array![ResourceAmount { resource_type: WHEAT, amount: amount(10) }].span(),
        },
    );
    assert!(execute_in_game(d, home.game_id, hand_over, NOW));
    let unload = Command::TransferExplorerResourcesToStructure(
        crate::resources::ResourceTransfer {
            from_entity_id: first.entity_id,
            to_entity_id: home.entity_id,
            resources: array![ResourceAmount { resource_type: WHEAT, amount: amount(20) }].span(),
        },
    );
    assert!(execute_in_game(d, home.game_id, unload, NOW));
    assert_eq!(balance(d, first, WHEAT), 0);
    assert_eq!(balance(d, second, WHEAT), amount(10));
    assert_eq!(balance(d, home, WHEAT), amount(20));
}
