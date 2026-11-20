pub use world_test_support::tests::settlement::*;


#[test]
#[feature("safe_dispatcher")]
fn settlement_pool_claims_are_distinct_and_game_scoped() {
    let deployment = setup(true);
    seed_settlement(deployment, 1, rules());
    seed_settlement(deployment, 2, rules());
    let map = deployment.games;
    let _ = ISeasonPlacementSafeDispatcher { contract_address: map };
    start_cheat_caller_address(map, deployment.actor);
    start_cheat_caller_address(map, deployment.games);
    let pool = ISettlementPoolDispatcher { contract_address: map };
    let placement = ISeasonPlacementDispatcher { contract_address: map };
    let mut seen = array![];
    for registered in 0_u16..96 {
        let selected = array![
            placement
                .claim_season_settlement(
                    1, registered, registered.into() + 17, crate::tests::map_center(deployment.games, 1),
                ),
        ]
            .span();
        assert!(selected.len() == 1);
        for previous in seen.span() {
            assert!(*previous != *selected.at(0), "settlement repeated");
        }
        seen.append(*selected.at(0));
        assert!(pool.settlement_pool(2, crate::tests::map_center(deployment.games, 2)).available.is_empty());
        assert!(pool.settlement_pool(2, crate::tests::map_center(deployment.games, 2)).opened == 0);
    }
    assert!(pool.settlement_pool(1, crate::tests::map_center(deployment.games, 1)).opened >= 96);
}

#[test]
#[feature("safe_dispatcher")]
fn entry_entitlements_require_operator_and_compare_every_registration_field() {
    let deployment = setup(true);
    let operator = 0x444.try_into().unwrap();
    seed_settlement(deployment, 1, rules());
    super::entry::set_operator(deployment, operator);
    let entry = crate::settlement::EntryEntitlement {
        realm_id: 1, metadata_1: 2, metadata_2: 3, metadata_3: 4, pass_kind: 0,
    };
    let key = crate::settlement::EntryKey { game_id: 1, owner: 0x333.try_into().unwrap() };
    let ledger = crate::settlement::ISettlementEntrySafeDispatcher { contract_address: deployment.games };
    assert!(ledger.register_entitlement(key, entry).is_err());
    start_cheat_caller_address(deployment.games, operator);
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
#[should_panic(expected: "entry entitlement required")]
fn a_missing_ledger_operator_never_bypasses_eternum_entitlements() {
    let d = setup(true);
    let games = IGameDispatcher { contract_address: d.games };
    let game_rules = crate::rules::SliceRules {
        mode_rules: super::play_fixture::TEST_RULES,
        entry_rule: crate::rules::ENTRY_ENTITLEMENT,
        command_mask: super::play_fixture::BLITZ_COMMAND_MASK,
        ..play_fixture::rules(),
    };
    super::play_fixture::seed_game(
        d.games, 3, crate::game::GameRegistry { dev_mode_on: false, ..games.game(1) }, game_rules,
    );
    seed_settlement(d, 3, rules());
    start_cheat_caller_address(d.games, d.games);
    crate::realms::ISeasonRealmsDispatcherTrait::settle_season(
        crate::realms::ISeasonRealmsDispatcher { contract_address: d.games },
        3,
        d.actor,
        crate::realms::SettleSeason { selected_realm: None, order: None },
        crate::commands::action_context(context(d.games, 3)),
    );
}
