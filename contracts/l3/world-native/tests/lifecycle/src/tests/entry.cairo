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
    let villages = IVillagesSafeDispatcher { contract_address: d.games };
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
    let command = crate::commands::Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None });
    assert!(super::resource_commands::execute_in_game(d, game_id, command, 360));
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
    assert!(!super::resource_commands::execute_in_game(d, game_id, command, 360));
    let other = super::bind_authority(d);
    start_cheat_caller_address(d.games, authority());
    let other_key = EntryKey { game_id, owner: other.actor };
    assert!(ledger(d).register_entitlement(other_key, held).is_err());
    assert!(ledger(d).entry_entitlement(other_key).unwrap().is_none());
    assert!(super::resource_commands::execute_in_game(other, game_id, command, 360));
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
    let command = crate::commands::Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None });
    assert!(super::resource_commands::execute_in_game(buyer, game_id, command, 360));
    assert!(super::resource_commands::execute_in_game(d, game_id, command, 360));
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
fn a_free_settlement_cannot_become_a_held_realm_after_entry() {
    let (d, game_id) = super::registrar::setup_open_frontier();
    let command = crate::commands::Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None });
    assert!(super::resource_commands::execute_in_game(d, game_id, command, 360));
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    assert!(
        ledger(d)
            .register_entitlement(
                EntryKey { game_id, owner: d.actor },
                EntryEntitlement { realm_id: 711, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 },
            )
            .is_err(),
    );
    assert_eq!(ledger(d).settled_realm(game_id, 711).unwrap(), 0);
}

#[feature("safe_dispatcher")]
fn settle_labor_home(held: bool) -> (Deployment, crate::entry::LaborHome) {
    let (d, game_id) = super::registrar::setup_open_frontier_preset("devcon", 3);
    set_operator(d, authority());
    if held {
        start_cheat_caller_address(d.games, authority());
        ledger(d)
            .register_entitlement(
                EntryKey { game_id, owner: d.actor },
                EntryEntitlement { realm_id: 711, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: 2 },
            )
            .unwrap();
    }
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None }),
            360,
        ),
    );
    let home = snforge_std::interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    snforge_std::start_cheat_block_timestamp(d.games, 362);
    start_cheat_caller_address(d.games, authority());
    (d, crate::entry::LaborHome { game_id, home })
}

#[test]
#[feature("safe_dispatcher")]
fn a_held_settlement_receives_one_thousand_labor_per_day_and_retries_are_exact() {
    let (d, home) = settle_labor_home(true);
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    assert!(operator.grant_labor(home, 1, d.actor).is_err());
    assert!(operator.grant_labor(home, 0, authority()).is_err());
    let grant = operator.grant_labor(home, 0, d.actor).unwrap();
    assert_eq!(grant.amount, 1000 * crate::rules::RESOURCE_PRECISION);
    assert_eq!(grant.home, home.home);
    let mut spy = spy_events();
    assert_eq!(operator.grant_labor(home, 0, d.actor).unwrap(), grant);
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 0);
    assert_eq!(operator.labor_grant(home, 0).unwrap(), Some(grant));
    assert!(operator.grant_labor(home, 0, authority()).is_err());
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, home.game_id,
    );
    let mut today = crate::days::day_of(game, 4800, 362);
    // All fifteen seeded days reset at their own boundary, including multiple claims within one UTC date.
    for index in 1_u64..15 {
        snforge_std::start_cheat_block_timestamp(d.games, today.end - 1);
        assert!(operator.grant_labor(home, index, d.actor).is_err());
        snforge_std::start_cheat_block_timestamp(d.games, today.end);
        let next = operator.grant_labor(home, index, d.actor).unwrap();
        assert!(next.amount <= 1000 * crate::rules::RESOURCE_PRECISION);
        assert_eq!(operator.labor_grant(home, index).unwrap(), Some(next));
        assert_eq!(operator.grant_labor(home, index, d.actor).unwrap(), next);
        today = crate::days::day_of(game, 4800, today.end);
        assert_eq!(today.index, index);
    }
    assert_eq!(today.end, game.end_at);
    snforge_std::start_cheat_block_timestamp(d.games, game.end_at);
    assert!(operator.grant_labor(home, 15, d.actor).is_err());
    // A stored receipt is still an exact retry after the season; it cannot pay twice.
    assert_eq!(operator.grant_labor(home, 0, d.actor).unwrap(), grant);
    set_operator(d, 0.try_into().unwrap());
    assert!(operator.grant_labor(home, 1, d.actor).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn a_free_settlement_has_no_daily_labor_claim() {
    let (d, home) = settle_labor_home(false);
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    assert!(operator.grant_labor(home, 0, d.actor).is_err());
    assert_eq!(operator.labor_grant(home, 0).unwrap(), None);
}

#[test]
#[feature("safe_dispatcher")]
fn a_full_store_consumes_only_that_homes_daily_claim() {
    let (d, home) = settle_labor_home(true);
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::state::write()
                .resources
                .weights
                .write((home.game_id, home.home), crate::resources::Weight { capacity: 0, weight: 0 });
        },
    );
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    let grant = operator.grant_labor(home, 0, d.actor).unwrap();
    assert_eq!(grant.amount, 0);
    assert_eq!(operator.grant_labor(home, 0, d.actor).unwrap(), grant);
    assert_eq!(operator.labor_grant(crate::entry::LaborHome { game_id: home.game_id + 1, ..home }, 0).unwrap(), None);
}

#[test]
#[feature("safe_dispatcher")]
fn midnight_is_not_a_frontier_labor_reset() {
    let (d, home) = settle_labor_home(true);
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, home.game_id,
    );
    let day = crate::days::day_of(game, 4800, 86400);
    assert!(day.start < 86400 && day.end > 86400);
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    snforge_std::start_cheat_block_timestamp(d.games, 86399);
    let grant = operator.grant_labor(home, day.index, d.actor).unwrap();
    snforge_std::start_cheat_block_timestamp(d.games, 86400);
    assert_eq!(operator.grant_labor(home, day.index, d.actor).unwrap(), grant);
    assert!(operator.grant_labor(home, day.index + 1, d.actor).is_err());
}
