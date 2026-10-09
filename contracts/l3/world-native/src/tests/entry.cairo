use snforge_std::{EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
use crate::entry::{
    ILedgerOperatorDispatcher, ILedgerOperatorDispatcherTrait, ILedgerOperatorSafeDispatcher,
    ILedgerOperatorSafeDispatcherTrait,
};
use crate::settlement::{
    EntryEntitlement, EntryKey, ISettlementEntrySafeDispatcher, ISettlementEntrySafeDispatcherTrait,
};
use crate::tests::state::{GameState, TroopObservationTrait};
use crate::village::{IVillagesSafeDispatcher, IVillagesSafeDispatcherTrait, VillagePassKey};
use super::{Deployment, authority, setup};

pub fn set_operator(d: Deployment, operator: ContractAddress) {
    start_cheat_caller_address(d.games, authority());
    ILedgerOperatorDispatcher { contract_address: d.games }.set_ledger_operator(operator);
    stop_cheat_caller_address(d.games);
}
fn entry() -> EntryEntitlement {
    EntryEntitlement { realm_id: 711, metadata_1: 22, metadata_2: 33, metadata_3: 44, pass_kind: 1 }
}
fn ledger(d: Deployment) -> ISettlementEntrySafeDispatcher {
    ISettlementEntrySafeDispatcher { contract_address: d.games }
}

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
fn labor_uses_the_held_realm_day_key_and_retry_cannot_transfer_the_claim() {
    let (d, game_id, army) = super::registrar::setup_frontier_chests();
    let home = GameState { contract_address: d.games }.resolved_explorer(army).unwrap().owner;
    let realm = crate::entry::LaborRealm { game_id, realm_id: 711, home };
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::state::write()
                .resources
                .weights
                .write(
                    (game_id, home), crate::resources::Weight { capacity: core::num::traits::Bounded::MAX, weight: 0 },
                );
        },
    );
    snforge_std::start_cheat_block_timestamp(d.games, 362);
    assert!(operator.grant_labor(realm, 0, d.actor).is_err());
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    assert!(operator.grant_labor(realm, 1, d.actor).is_err());
    assert!(operator.grant_labor(crate::entry::LaborRealm { realm_id: 0, ..realm }, 0, d.actor).is_err());
    let grant = operator.grant_labor(realm, 0, d.actor).unwrap();
    assert_eq!(grant.amount, 1000 * crate::rules::RESOURCE_PRECISION);
    let mut spy = spy_events();
    assert_eq!(operator.grant_labor(realm, 0, d.actor).unwrap(), grant);
    assert_eq!(spy.get_events().emitted_by(d.games).events.len(), 0);
    assert!(operator.grant_labor(realm, 0, 444.try_into().unwrap()).is_err());
    assert_eq!(operator.labor_grant(realm, 0).unwrap(), Some(grant));
    // Unlimited by default, so the same account may claim another held Realm.
    assert!(operator.grant_labor(crate::entry::LaborRealm { realm_id: 712, ..realm }, 0, d.actor).is_ok());
    set_operator(d, 0.try_into().unwrap());
    assert!(operator.grant_labor(crate::entry::LaborRealm { realm_id: 713, ..realm }, 0, d.actor).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn a_full_labor_store_consumes_the_claim_and_the_preset_can_limit_held_realms() {
    let (d, game_id, army) = super::registrar::setup_frontier_chests();
    let home = GameState { contract_address: d.games }.resolved_explorer(army).unwrap().owner;
    let realm = crate::entry::LaborRealm { game_id, realm_id: 711, home };
    snforge_std::interact_with_state(
        d.games,
        || {
            let preset = crate::state::write()
                .presets
                .entry(crate::logic::game::preset_commitment(crate::logic::game::game(game_id)));
            preset.labor_rules.write(Some(crate::entry::LaborRules { amount: 1000, account_daily_limit: 1 }));
            let state = crate::state::write();
            state.resources.weights.write((game_id, home), crate::resources::Weight { capacity: 0, weight: 0 });
        },
    );
    snforge_std::start_cheat_block_timestamp(d.games, 362);
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    let grant = operator.grant_labor(realm, 0, d.actor).unwrap();
    assert_eq!(grant.amount, 0);
    assert_eq!(operator.grant_labor(realm, 0, d.actor).unwrap(), grant);
    assert!(operator.grant_labor(crate::entry::LaborRealm { realm_id: 712, ..realm }, 0, d.actor).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn a_realm_cannot_receive_daily_labor_in_two_games_on_one_shard() {
    let (d, game_id, army) = super::registrar::setup_frontier_chests();
    let home = GameState { contract_address: d.games }.resolved_explorer(army).unwrap().owner;
    let realm = crate::entry::LaborRealm { game_id, realm_id: 711, home };
    set_operator(d, authority());
    start_cheat_caller_address(d.games, authority());
    snforge_std::start_cheat_block_timestamp(d.games, 362);
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    let first = operator.grant_labor(realm, 0, d.actor).unwrap();
    let other = crate::entry::LaborRealm { game_id: game_id + 1, ..realm };
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            state
                .games
                .games
                .write(other.game_id, crate::game::GameRegistry { name: 'other', ..state.games.games.read(game_id) });
            state.games.overrides.write(other.game_id, state.games.overrides.read(game_id));
            state.game_releases.write(other.game_id, state.game_releases.read(game_id));
            let record = crate::logic::structures::record(crate::resources::ResourceKey { game_id, entity_id: home });
            crate::logic::structures::StructureState::create(
                crate::resources::ResourceKey { game_id: other.game_id, entity_id: home }, record,
            );
            state.resources.resource_exists.write((other.game_id, home), true);
            state
                .resources
                .weights
                .write(
                    (other.game_id, home),
                    crate::resources::Weight { capacity: core::num::traits::Bounded::MAX, weight: 0 },
                );
        },
    );
    assert_eq!(operator.labor_grant(other, 0).unwrap(), Some(first));
    assert!(operator.grant_labor(other, 0, d.actor).is_err());
    assert!(operator.grant_labor(other, 0, authority()).is_err());
    assert_eq!(operator.grant_labor(realm, 0, d.actor).unwrap(), first);
    assert_eq!(crate::entry::labor_day(86399), 0);
    assert_eq!(crate::entry::labor_day(86400), 1);
}
