pub use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_caller_address, stop_cheat_caller_address,
};
pub use starknet::ContractAddress;
pub use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
pub use crate::entry::{
    ILedgerOperatorDispatcher, ILedgerOperatorDispatcherTrait, ILedgerOperatorSafeDispatcher,
    ILedgerOperatorSafeDispatcherTrait,
};
pub use crate::settlement::{
    EntryEntitlement, EntryKey, ISettlementEntrySafeDispatcher, ISettlementEntrySafeDispatcherTrait,
};
pub use crate::tests::state::{GameState, TroopObservationTrait};
pub use crate::village::{IVillagesSafeDispatcher, IVillagesSafeDispatcherTrait, VillagePassKey};
pub use super::{Deployment, authority, setup};
pub fn set_operator(d: Deployment, operator: ContractAddress) {
    start_cheat_caller_address(d.games, authority());
    ILedgerOperatorDispatcher { contract_address: d.games }.set_ledger_operator(operator);
    stop_cheat_caller_address(d.games);
}
pub fn entry() -> EntryEntitlement {
    EntryEntitlement { realm_id: 711, metadata_1: 22, metadata_2: 33, metadata_3: 44, pass_kind: 1 }
}
pub fn ledger(d: Deployment) -> ISettlementEntrySafeDispatcher {
    ISettlementEntrySafeDispatcher { contract_address: d.games }
}
