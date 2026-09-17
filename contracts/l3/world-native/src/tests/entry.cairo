use snforge_std::{EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use crate::entry::{
    ILedgerOperatorDispatcher, ILedgerOperatorDispatcherTrait, ILedgerOperatorSafeDispatcher,
    ILedgerOperatorSafeDispatcherTrait,
};
use crate::settlement::{
    EntryEntitlement, EntryKey, ISettlementEntrySafeDispatcher, ISettlementEntrySafeDispatcherTrait,
};
use crate::village::{IVillagesSafeDispatcher, IVillagesSafeDispatcherTrait, VillagePassKey};
use super::{Deployment, authority, setup};

pub fn set_operator(d: Deployment, operator: ContractAddress) {
    start_cheat_caller_address(d.peers.registry, authority());
    ILedgerOperatorDispatcher { contract_address: d.peers.registry }.set_ledger_operator(operator);
    stop_cheat_caller_address(d.peers.registry);
}
fn entry() -> EntryEntitlement {
    EntryEntitlement { realm_id: 711, metadata_1: 22, metadata_2: 33, metadata_3: 44, pass_kind: 1 }
}
fn ledger(d: Deployment) -> ISettlementEntrySafeDispatcher {
    ISettlementEntrySafeDispatcher { contract_address: d.peers.settlement }
}

#[test]
#[feature("safe_dispatcher")]
fn only_authority_rotates_the_deployment_operator_and_emits_the_current_value() {
    let d = setup(true);
    let registry = ILedgerOperatorSafeDispatcher { contract_address: d.peers.registry };
    assert_eq!(registry.ledger_operator().unwrap(), 0.try_into().unwrap());
    start_cheat_caller_address(d.peers.registry, d.actor);
    assert!(registry.set_ledger_operator(d.actor).is_err());
    let mut spy = spy_events();
    set_operator(d, 123.try_into().unwrap());
    assert_eq!(registry.ledger_operator().unwrap(), 123.try_into().unwrap());
    let events = spy.get_events().emitted_by(d.peers.registry);
    assert_eq!(events.events.len(), 1);
    let (_, event) = events.events.at(0);
    assert_eq!(event.keys.span(), array![selector!("EntryEvent"), selector!("RowSet"), 1, 'LedgerOperator'].span());
    assert_eq!(event.data.span(), array![1, d.peers.registry.into(), 1, 123].span());
    set_operator(d, 456.try_into().unwrap());
    assert_eq!(registry.ledger_operator().unwrap(), 456.try_into().unwrap());
    set_operator(d, 0.try_into().unwrap());
    assert_eq!(registry.ledger_operator().unwrap(), 0.try_into().unwrap());
}

#[test]
#[feature("safe_dispatcher")]
fn registration_rotation_preserves_entitlements_and_retries_emit_no_duplicate_rows() {
    let d = setup(true);
    let key = EntryKey { game_id: 1, owner: d.actor };
    set_operator(d, 123.try_into().unwrap());
    start_cheat_caller_address(d.peers.settlement, 123.try_into().unwrap());
    ledger(d).register_entitlement(key, entry()).unwrap();
    let mut spy = spy_events();
    ledger(d).register_entitlement(key, entry()).unwrap();
    assert_eq!(spy.get_events().emitted_by(d.peers.settlement).events.len(), 0);
    set_operator(d, 456.try_into().unwrap());
    assert!(ledger(d).register_entitlement(key, entry()).is_err());
    start_cheat_caller_address(d.peers.settlement, 456.try_into().unwrap());
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
fn ledger_rejects_zero_game_and_owner_but_can_relay_before_game_configuration() {
    let d = setup(true);
    set_operator(d, authority());
    start_cheat_caller_address(d.peers.settlement, authority());
    let key = EntryKey { game_id: 999, owner: d.actor };
    assert!(ledger(d).register_entitlement(EntryKey { game_id: 0, ..key }, entry()).is_err());
    assert!(ledger(d).register_entitlement(EntryKey { owner: 0.try_into().unwrap(), ..key }, entry()).is_err());
    ledger(d).register_entitlement(key, entry()).unwrap();
    assert_eq!(ledger(d).entry_entitlement(key).unwrap(), Some(entry()));
    assert!(ledger(d).entry_entitlement(EntryKey { game_id: 998, ..key }).unwrap().is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn village_passes_share_operator_rotation_without_sharing_realm_entitlements() {
    let d = setup(true);
    let villages = IVillagesSafeDispatcher { contract_address: d.peers.settlement };
    let key = VillagePassKey { game_id: 1, pass_id: 7 };
    set_operator(d, 123.try_into().unwrap());
    start_cheat_caller_address(d.peers.settlement, d.actor);
    assert!(villages.register_village_pass(key, d.actor).is_err());
    start_cheat_caller_address(d.peers.settlement, 123.try_into().unwrap());
    assert!(villages.register_village_pass(VillagePassKey { game_id: 0, ..key }, d.actor).is_err());
    assert!(villages.register_village_pass(key, 0.try_into().unwrap()).is_err());
    villages.register_village_pass(key, d.actor).unwrap();
    let mut spy = spy_events();
    villages.register_village_pass(key, d.actor).unwrap();
    assert_eq!(spy.get_events().emitted_by(d.peers.settlement).events.len(), 0);
    set_operator(d, 456.try_into().unwrap());
    assert!(villages.register_village_pass(key, d.actor).is_err());
    start_cheat_caller_address(d.peers.settlement, 456.try_into().unwrap());
    villages.register_village_pass(key, d.actor).unwrap();
    assert!(villages.register_village_pass(key, authority()).is_err());
    villages.register_village_pass(VillagePassKey { game_id: 2, ..key }, authority()).unwrap();
    assert_eq!(villages.village_pass(key).unwrap().unwrap().owner, d.actor);
    assert_eq!(villages.village_pass(VillagePassKey { game_id: 2, ..key }).unwrap().unwrap().owner, authority());
    assert!(ledger(d).entry_entitlement(EntryKey { game_id: 1, owner: d.actor }).unwrap().is_none());
}
