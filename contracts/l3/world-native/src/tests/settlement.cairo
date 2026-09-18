use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::map::{IMapDispatcher, IMapDispatcherTrait};
use crate::realms::{
    ISeasonPlacementDispatcher, ISeasonPlacementDispatcherTrait, ISeasonPlacementSafeDispatcher,
    ISeasonPlacementSafeDispatcherTrait,
};
use crate::settlement::{
    IBlitzReservationsSafeDispatcher, IBlitzReservationsSafeDispatcherTrait, ISettlementConfigurationDispatcher,
    ISettlementConfigurationDispatcherTrait, ISettlementConfigurationSafeDispatcher,
    ISettlementConfigurationSafeDispatcherTrait, ISettlementEntrySafeDispatcherTrait, ISettlementPoolDispatcher,
    ISettlementPoolDispatcherTrait, ISettlementPoolSafeDispatcher, ISettlementPoolSafeDispatcherTrait,
    ISettlementViewsDispatcher, ISettlementViewsDispatcherTrait, SettlementMode, SettlementRules,
};
use super::{Deployment, authority, context, recorded, setup};

pub fn grants() -> crate::settlement::RealmGrants {
    let data = read_txt(@FileTrait::new("tests/fixtures/settlement.txt"));
    let mut fields = data.span();
    let grants = Serde::deserialize(ref fields).unwrap();
    assert!(fields.is_empty(), "trailing settlement fixture");
    grants
}

fn rules() -> SettlementRules {
    SettlementRules { registration_start: 10, registration_limit: 96, mode: SettlementMode::Single, reward_profile: 1 }
}

fn configure(deployment: Deployment, game_id: u32, rules: SettlementRules) {
    start_cheat_caller_address(deployment.peers.settlement, authority());
    ISettlementConfigurationDispatcher { contract_address: deployment.peers.settlement }
        .configure_settlement(game_id, rules, grants());
    stop_cheat_caller_address(deployment.peers.settlement);
}

#[test]
#[feature("safe_dispatcher")]
fn settlement_configuration_is_immutable_and_game_scoped() {
    let deployment = setup(true);
    let safe = ISettlementConfigurationSafeDispatcher { contract_address: deployment.peers.settlement };
    start_cheat_caller_address(deployment.peers.settlement, deployment.actor);
    assert!(safe.configure_settlement(1, rules(), grants()).is_err());
    configure(deployment, 1, rules());
    configure(deployment, 2, SettlementRules { mode: SettlementMode::Triple, ..rules() });
    let views = ISettlementViewsDispatcher { contract_address: deployment.peers.settlement };
    assert!(views.settlement_rules(1).mode == SettlementMode::Single);
    assert_eq!(views.realm_grants(1), grants());
    assert_eq!(views.realm_grants(2), grants());
    assert!(views.settlement_rules(2).mode == SettlementMode::Triple);
    start_cheat_caller_address(deployment.peers.settlement, authority());
    assert!(safe.configure_settlement(1, SettlementRules { registration_limit: 2, ..rules() }, grants()).is_err());
    assert!(safe.configure_settlement(3, rules(), grants()).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn settlement_pool_claim_requires_season_and_keeps_games_separate() {
    let deployment = setup(true);
    configure(deployment, 1, rules());
    configure(deployment, 2, rules());
    let map = deployment.peers.map;
    let safe = ISeasonPlacementSafeDispatcher { contract_address: map };
    start_cheat_caller_address(map, deployment.actor);
    assert!(safe.claim_season_settlement(1, 0, 17).is_err());
    start_cheat_caller_address(map, deployment.peers.settlement);
    let pool = ISettlementPoolDispatcher { contract_address: map };
    let placement = ISeasonPlacementDispatcher { contract_address: map };
    let mut seen = array![];
    for registered in 0_u16..96 {
        let selected = array![placement.claim_season_settlement(1, registered, registered.into() + 17)].span();
        assert!(selected.len() == 1);
        for previous in seen.span() {
            assert!(*previous != *selected.at(0), "settlement repeated");
        }
        seen.append(*selected.at(0));
        assert!(pool.settlement_pool(2).available.is_empty());
        assert!(pool.settlement_pool(2).opened == 0);
    }
    assert!(pool.settlement_pool(1).opened >= 96);
}

#[test]
#[feature("safe_dispatcher")]
fn only_game_creation_initializes_reservations_and_repeated_initialization_is_idempotent() {
    let deployment = setup(true);
    let games = IGameDispatcher { contract_address: deployment.peers.season };
    let mut game_rules = recorded::rules();
    game_rules.blitz_mode_on = true;
    start_cheat_caller_address(deployment.peers.settlement, authority());
    start_cheat_caller_address(deployment.peers.season, authority());
    games.create_game(3, games.game(1), game_rules);
    configure(deployment, 3, SettlementRules { mode: SettlementMode::Triple, registration_limit: 2, ..rules() });
    let map = deployment.peers.map;
    let safe = IBlitzReservationsSafeDispatcher { contract_address: map };
    start_cheat_caller_address(map, deployment.actor);
    assert!(safe.initialize_reservations(3).is_err());
    start_cheat_caller_address(map, deployment.peers.registry);
    safe.initialize_reservations(3).unwrap();
    let pool = ISettlementPoolDispatcher { contract_address: map };
    assert!(pool.reserved_hyperstructures(3) == 7);
    assert!(pool.reserved_hyperstructures(1) == 0);
    safe.initialize_reservations(3).unwrap();
    assert!(pool.reserved_hyperstructures(3) == 7);
    let center = 2147483646 - game_rules.map_center_offset;
    let key = crate::map::TileKey { game_id: 3, alt: false, col: center, row: center };
    let tile = IMapDispatcher { contract_address: map }.tile(key).unwrap();
    assert!((tile.data / 2) % 256 == 39);
    assert!(tile.data % 2 == 1);
    assert!((tile.data / 512) % 0x100000000 == 0);
    start_cheat_caller_address(map, deployment.actor);
    assert!(safe.release_hyperstructure(3, crate::troops::Coord { alt: false, x: center, y: center }).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn starting_troop_table_must_be_complete_before_configuration_commits() {
    let deployment = setup(true);
    let safe = ISettlementConfigurationSafeDispatcher { contract_address: deployment.peers.settlement };
    let mut incomplete = grants();
    incomplete.starting_troops = incomplete.starting_troops.slice(0, 16);
    start_cheat_caller_address(deployment.peers.settlement, authority());
    assert!(safe.configure_settlement(1, rules(), incomplete).is_err());
    safe.configure_settlement(1, rules(), grants()).unwrap();
    let views = ISettlementViewsDispatcher { contract_address: deployment.peers.settlement };
    assert_eq!(views.realm_grants(1), grants());
}

#[test]
#[feature("safe_dispatcher")]
fn realm_resource_table_rejects_invalid_ids_and_packing_overflow() {
    let deployment = setup(true);
    let safe = ISettlementConfigurationSafeDispatcher { contract_address: deployment.peers.settlement };
    start_cheat_caller_address(deployment.peers.settlement, authority());
    for resource in array![0_u8, 59, 255].span() {
        let invalid = crate::settlement::RealmGrants { realm_resources: array![*resource].span(), ..grants() };
        assert!(safe.configure_settlement(1, rules(), invalid).is_err());
    }
    let mut too_many = array![];
    for _ in 0_u32..17 {
        too_many.append(3_u8);
    }
    let invalid = crate::settlement::RealmGrants { realm_resources: too_many.span(), ..grants() };
    assert!(safe.configure_settlement(1, rules(), invalid).is_err());
    safe.configure_settlement(1, rules(), grants()).unwrap();
    let views = ISettlementViewsDispatcher { contract_address: deployment.peers.settlement };
    assert_eq!(views.realm_grants(1), grants());
}

#[test]
#[feature("safe_dispatcher")]
fn entry_entitlements_require_operator_and_compare_every_registration_field() {
    let deployment = setup(true);
    let operator = 0x444.try_into().unwrap();
    configure(deployment, 1, rules());
    super::entry::set_operator(deployment, operator);
    let entry = crate::settlement::EntryEntitlement {
        realm_id: 1, metadata_1: 2, metadata_2: 3, metadata_3: 4, pass_kind: 0,
    };
    let key = crate::settlement::EntryKey { game_id: 1, owner: 0x333.try_into().unwrap() };
    let ledger = crate::settlement::ISettlementEntrySafeDispatcher { contract_address: deployment.peers.settlement };
    assert!(ledger.register_entitlement(key, entry).is_err());
    start_cheat_caller_address(deployment.peers.settlement, operator);
    ledger.register_entitlement(key, entry).unwrap();
    ledger.register_entitlement(key, entry).unwrap();
    assert!(ledger.register_entitlement(key, crate::settlement::EntryEntitlement { metadata_3: 5, ..entry }).is_err());
    assert!(ledger.register_entitlement(key, crate::settlement::EntryEntitlement { metadata_2: 5, ..entry }).is_err());
    assert!(ledger.register_entitlement(key, crate::settlement::EntryEntitlement { metadata_1: 5, ..entry }).is_err());
    assert!(ledger.register_entitlement(key, crate::settlement::EntryEntitlement { realm_id: 5, ..entry }).is_err());
    assert!(ledger.register_entitlement(key, crate::settlement::EntryEntitlement { pass_kind: 1, ..entry }).is_err());
    assert!(ledger.entry_entitlement(key).unwrap() == Some(entry));
    assert!(ledger.entry_entitlement(crate::settlement::EntryKey { game_id: 2, ..key }).unwrap().is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn village_placement_shares_reservations_with_fixed_blitz_and_eternum_entries() {
    let deployment = setup(true);
    let games = IGameDispatcher { contract_address: deployment.peers.season };
    start_cheat_caller_address(deployment.peers.season, authority());
    games.create_game(3, games.game(1), crate::rules::SliceRules { blitz_mode_on: true, ..recorded::rules() });
    stop_cheat_caller_address(deployment.peers.season);
    configure(deployment, 1, SettlementRules { registration_limit: 2, ..rules() });
    configure(deployment, 3, SettlementRules { mode: SettlementMode::Triple, registration_limit: 2, ..rules() });
    let map = deployment.peers.map;
    let pool = ISettlementPoolDispatcher { contract_address: map };
    let safe = ISettlementPoolSafeDispatcher { contract_address: map };
    start_cheat_caller_address(map, deployment.actor);
    assert!(safe.claim_village(1, 0, 17).is_err());
    start_cheat_caller_address(map, deployment.peers.registry);
    crate::settlement::IBlitzReservationsDispatcherTrait::initialize_reservations(
        crate::settlement::IBlitzReservationsDispatcher { contract_address: map }, 3,
    );
    start_cheat_caller_address(map, deployment.peers.settlement);
    let game_rules = IGameDispatcher { contract_address: deployment.peers.season }.rules(3);
    let center = 2147483646 - game_rules.map_center_offset;
    for game_id in array![1_u32, 3] {
        let mut seen = array![];
        if game_id == 3 {
            for index in 0..2_u32 {
                remember_distinct(
                    ref seen,
                    crate::settlement_grid::settlement_location(
                        crate::troops::Coord { alt: false, x: center, y: center },
                        SettlementMode::Triple,
                        rules().reward_profile,
                        index,
                    ),
                );
            }
        }
        for village in 0..8_u32 {
            remember_distinct(ref seen, array![pool.claim_village(game_id, 0, village.into() + 100)].span());
        }
        if game_id == 1 {
            let placement = ISeasonPlacementDispatcher { contract_address: map };
            for registered in 0..2_u16 {
                remember_distinct(
                    ref seen,
                    array![placement.claim_season_settlement(game_id, registered, registered.into() + 17)].span(),
                );
            }
        }
        for village in 0..8_u32 {
            remember_distinct(ref seen, array![pool.claim_village(game_id, 2, village.into() + 300)].span());
        }
        assert!(pool.village_pool(game_id).available.len() == 5);
        let progress = ISettlementViewsDispatcher { contract_address: deployment.peers.settlement }
            .settlement_progress(game_id);
        assert!(progress.registered == 0 && progress.realm_count == 0, "planner changed entry counters");
    }
}

fn remember_distinct(ref seen: Array<crate::troops::Coord>, added: Span<crate::troops::Coord>) {
    for coord in added {
        for previous in seen.span() {
            assert!(*previous != *coord, "realm and village reservation overlap");
        }
        seen.append(*coord);
    }
}

#[test]
#[should_panic(expected: "entry entitlement required")]
fn a_missing_ledger_operator_never_bypasses_eternum_entitlements() {
    let d = setup(true);
    let games = IGameDispatcher { contract_address: d.peers.season };
    let game_rules = crate::rules::SliceRules { blitz_mode_on: false, ..recorded::rules() };
    start_cheat_caller_address(d.peers.season, authority());
    games.create_game(3, crate::game::GameRegistry { dev_mode_on: false, ..games.game(1) }, game_rules);
    configure(d, 3, rules());
    start_cheat_caller_address(d.peers.settlement, d.peers.season);
    crate::realms::ISeasonRealmsDispatcherTrait::settle_season(
        crate::realms::ISeasonRealmsDispatcher { contract_address: d.peers.settlement },
        3,
        d.actor,
        crate::realms::SettleSeason { name: 'Player', selected_realm: None },
        context(),
    );
}
