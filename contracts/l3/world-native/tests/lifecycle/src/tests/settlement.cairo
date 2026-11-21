pub use world_test_support::tests::settlement::*;

#[test]
#[feature("safe_dispatcher")]
fn entry_entitlements_require_operator_and_compare_every_registration_field() {
    let deployment = setup(false);
    let operator = 0x444.try_into().unwrap();
    let game_id = seed_settlement(deployment, 'entry entitlements', rules());
    super::entry::set_operator(deployment, operator);
    let entry = crate::settlement::EntryEntitlement {
        realm_id: 1, metadata_1: 2, metadata_2: 3, metadata_3: 4, pass_kind: 0,
    };
    let key = crate::settlement::EntryKey { game_id, owner: 0x333.try_into().unwrap() };
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
    assert!(ledger.entry_entitlement(crate::settlement::EntryKey { game_id: game_id + 1, ..key }).unwrap().is_none());
}
