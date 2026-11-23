pub use world_test_support::tests::entry::*;

#[test]
#[feature("safe_dispatcher")]
fn only_authority_rotates_the_deployment_operator_without_emitting_metadata() {
    let d = setup(true);
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    assert_eq!(operator.ledger_operator().unwrap(), 0.try_into().unwrap());
    start_cheat_caller_address(d.games, d.actor);
    assert!(operator.set_ledger_operator(d.actor).is_err());
    let mut spy = spy_events();
    set_operator(d, 123.try_into().unwrap());
    assert_eq!(operator.ledger_operator().unwrap(), 123.try_into().unwrap());
    let events = spy.get_events().emitted_by(d.games);
    assert_eq!(events.events.len(), 0);
    set_operator(d, 456.try_into().unwrap());
    assert_eq!(operator.ledger_operator().unwrap(), 456.try_into().unwrap());
    set_operator(d, 0.try_into().unwrap());
    assert_eq!(operator.ledger_operator().unwrap(), 0.try_into().unwrap());
}

#[test]
#[feature("safe_dispatcher")]
fn registration_rotation_preserves_entitlements_and_retries_emit_no_duplicate_rows() {
    let d = setup(true);
    let key = EntryKey { game_id: 1, owner: d.actor };
    set_operator(d, 123.try_into().unwrap());
    start_cheat_caller_address(d.games, 123.try_into().unwrap());
    ledger(d).register_entitlement(key, entry()).unwrap();
    let mut spy = spy_events();
    ledger(d).register_entitlement(key, entry()).unwrap();
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 0);
    set_operator(d, 456.try_into().unwrap());
    start_cheat_caller_address(d.games, 123.try_into().unwrap());
    assert!(ledger(d).register_entitlement(key, entry()).is_err());
    start_cheat_caller_address(d.games, 456.try_into().unwrap());
    ledger(d).register_entitlement(key, entry()).unwrap();
    ledger(d)
        .register_entitlement(EntryKey { game_id: 2, ..key }, EntryEntitlement { realm_id: 999, ..entry() })
        .unwrap();
    assert_eq!(ledger(d).entry_entitlement(key).unwrap(), Some(entry()));
    assert_eq!(ledger(d).entry_entitlement(EntryKey { game_id: 2, ..key }).unwrap().unwrap().realm_id, 999);
    assert!(ledger(d).register_entitlement(key, EntryEntitlement { pass_kind: 0, ..entry() }).is_err());
    set_operator(d, 0.try_into().unwrap());
    assert!(ledger(d).register_entitlement(key, entry()).is_err());
    assert_eq!(ledger(d).entry_entitlement(key).unwrap(), Some(entry()));
}

#[test]
#[feature("safe_dispatcher")]
fn ledger_rejects_zero_game_and_owner_and_requires_a_prepared_game() {
    let d = setup(true);
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    let key = EntryKey { game_id: 999, owner: d.actor };
    assert!(ledger(d).register_entitlement(EntryKey { game_id: 0, ..key }, entry()).is_err());
    assert!(ledger(d).register_entitlement(EntryKey { owner: 0.try_into().unwrap(), ..key }, entry()).is_err());
    assert!(ledger(d).register_entitlement(key, entry()).is_err());
    let prepared = EntryKey { game_id: 1, ..key };
    ledger(d).register_entitlement(prepared, entry()).unwrap();
    assert_eq!(ledger(d).entry_entitlement(prepared).unwrap(), Some(entry()));
    assert!(ledger(d).entry_entitlement(key).unwrap().is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn village_passes_share_operator_rotation_without_sharing_realm_entitlements() {
    let d = setup(true);
    let villages = IVillagePassesSafeDispatcher { contract_address: d.games };
    let key = VillagePassKey { game_id: 1, pass_id: 7 };
    set_operator(d, 123.try_into().unwrap());
    start_cheat_caller_address(d.games, d.actor);
    assert!(villages.register_village_pass(key, d.actor).is_err());
    start_cheat_caller_address(d.games, 123.try_into().unwrap());
    assert!(villages.register_village_pass(VillagePassKey { game_id: 0, ..key }, d.actor).is_err());
    assert!(villages.register_village_pass(key, 0.try_into().unwrap()).is_err());
    villages.register_village_pass(key, d.actor).unwrap();
    let mut spy = spy_events();
    villages.register_village_pass(key, d.actor).unwrap();
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 0);
    set_operator(d, 456.try_into().unwrap());
    start_cheat_caller_address(d.games, 123.try_into().unwrap());
    assert!(villages.register_village_pass(key, d.actor).is_err());
    start_cheat_caller_address(d.games, 456.try_into().unwrap());
    villages.register_village_pass(key, d.actor).unwrap();
    assert!(villages.register_village_pass(key, authority()).is_err());
    villages.register_village_pass(VillagePassKey { game_id: 2, ..key }, authority()).unwrap();
    assert_eq!(villages.village_pass(key).unwrap().unwrap().owner, d.actor);
    assert_eq!(villages.village_pass(VillagePassKey { game_id: 2, ..key }).unwrap().unwrap().owner, authority());
    assert!(ledger(d).entry_entitlement(EntryKey { game_id: 1, owner: d.actor }).unwrap().is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn held_realm_settlement_uses_catalogue_traits_and_cannot_be_repeated() {
    let (d, game_id) = super::registrar::setup_open_frontier();
    let key = EntryKey { game_id, owner: d.actor };
    let held = EntryEntitlement { realm_id: 711, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 };
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    ledger(d).register_entitlement(key, held).unwrap();
    let mut spy = spy_events();
    ledger(d).register_entitlement(key, held).unwrap();
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 0);
    let command = crate::commands::Command::SettleSeason(
        crate::realms::SettleSeason { selected_realm: None, order: None },
    );
    assert!(super::resource_commands::execute_in_game(d, game_id, command, super::play_fixture::FIXTURE_START));
    let home = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    assert_eq!(ledger(d).settled_realm(game_id, 711).unwrap(), home);
    snforge_std::interact_with_state(
        d.games,
        || {
            let record = crate::logic::structures::record(crate::resources::ResourceKey { game_id, entity_id: home });
            assert_eq!(record.metadata.realm_id, 711);
            assert_eq!(record.metadata.order, 1);
            assert_eq!(record.owner, d.actor);
        },
    );
    assert!(!super::resource_commands::execute_in_game(d, game_id, command, super::play_fixture::FIXTURE_START));
    let other = super::bind_authority(d);
    start_cheat_caller_address(d.games, authority());
    let other_key = EntryKey { game_id, owner: other.actor };
    assert!(ledger(d).register_entitlement(other_key, held).is_err());
    assert!(ledger(d).entry_entitlement(other_key).unwrap().is_none());
    let free = crate::commands::Command::SettleSeason(
        crate::realms::SettleSeason { selected_realm: None, order: Some(super::registrar::aspect_order(1)) },
    );
    assert!(!super::resource_commands::execute_in_game(other, game_id, command, super::play_fixture::FIXTURE_START));
    assert!(super::resource_commands::execute_in_game(other, game_id, free, super::play_fixture::FIXTURE_START));
    assert_eq!(ledger(d).settled_realm(game_id, 711).unwrap(), home);
}

#[feature("safe_dispatcher")]
fn resume_reserved_realm_after_a_second_owner_attempts_entry(alternative: Option<u32>) {
    let (d, game_id) = super::registrar::setup_open_frontier();
    let buyer = super::bind_authority(d);
    let first = EntryKey { game_id, owner: d.actor };
    let second = EntryKey { game_id, owner: buyer.actor };
    let held = EntryEntitlement { realm_id: 711, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 };
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    ledger(d).register_entitlement(first, held).unwrap();
    assert_eq!(ledger(d).settled_realm(game_id, 711).unwrap(), 0);
    // Entry stopped after registration. The operator now verifies the NFT's buyer for the same Realm.
    assert!(ledger(d).register_entitlement(second, held).is_err());
    assert!(ledger(d).entry_entitlement(second).unwrap().is_none());
    ledger(d).register_entitlement(first, held).unwrap();
    if let Some(realm_id) = alternative {
        ledger(d).register_entitlement(second, EntryEntitlement { realm_id: realm_id.into(), ..held }).unwrap();
    }
    let held_command = crate::commands::Command::SettleSeason(
        crate::realms::SettleSeason { selected_realm: None, order: None },
    );
    let buyer_command = if alternative.is_some() {
        held_command
    } else {
        crate::commands::Command::SettleSeason(
            crate::realms::SettleSeason { selected_realm: None, order: Some(super::registrar::aspect_order(1)) },
        )
    };
    assert!(
        super::resource_commands::execute_in_game(buyer, game_id, buyer_command, super::play_fixture::FIXTURE_START),
    );
    assert!(super::resource_commands::execute_in_game(d, game_id, held_command, super::play_fixture::FIXTURE_START));
    let first_home = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    let second_home = snforge_std::interact_with_state(
        d.games, || crate::entity_ids::home_for_actor(game_id, buyer.actor),
    );
    assert!(first_home != second_home);
    assert_eq!(ledger(d).settled_realm(game_id, 711).unwrap(), first_home);
    if let Some(realm_id) = alternative {
        assert_eq!(ledger(d).settled_realm(game_id, realm_id).unwrap(), second_home);
    } else {
        assert!(ledger(d).entry_entitlement(second).unwrap().is_none());
    }
}

#[test]
#[feature("safe_dispatcher")]
fn interrupted_held_entry_keeps_its_claim_and_the_buyer_can_found_a_free_home() {
    resume_reserved_realm_after_a_second_owner_attempts_entry(None);
}

#[test]
#[feature("safe_dispatcher")]
fn interrupted_held_entry_keeps_its_claim_and_the_buyer_can_register_another_realm() {
    resume_reserved_realm_after_a_second_owner_attempts_entry(Some(1));
}

#[test]
#[feature("safe_dispatcher")]
fn a_free_settlement_attaches_only_the_chosen_held_realm_once() {
    let (d, game_id) = super::registrar::setup_open_frontier();
    let command = crate::commands::Command::SettleSeason(
        crate::realms::SettleSeason { selected_realm: None, order: Some(super::registrar::aspect_order(1)) },
    );
    assert!(super::resource_commands::execute_in_game(d, game_id, command, super::play_fixture::FIXTURE_START));
    let home = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    let key = EntryKey { game_id, owner: d.actor };
    let chosen = EntryEntitlement { realm_id: 712, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 };
    ledger(d).register_entitlement(key, chosen).unwrap();
    assert_eq!(ledger(d).settled_realm(game_id, 712).unwrap(), home);
    assert_eq!(ledger(d).settled_realm(game_id, 711).unwrap(), 0);
    assert!(ledger(d).register_entitlement(key, EntryEntitlement { realm_id: 711, ..chosen }).is_err());
    assert_eq!(ledger(d).entry_entitlement(key).unwrap(), Some(chosen));
    ledger(d).register_entitlement(key, chosen).unwrap();
    assert_eq!(ledger(d).settled_realm(game_id, 712).unwrap(), home);
    assert_eq!(ledger(d).settled_realm(game_id, 711).unwrap(), 0);
}
