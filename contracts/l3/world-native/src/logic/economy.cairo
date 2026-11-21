#[starknet::contract]
pub mod EconomyLogic {
    use crate::events::RowSet;
    use crate::logic::race::RaceState;
    use crate::logic::release::ReleaseState;
    component!(path: RaceState, storage: race, event: RaceEvent);
    #[abi(embed_v0)]
    impl Race = RaceState::RaceImpl<ContractState>;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifecycleInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        race: RaceState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RaceEvent: RaceState::Event,
        ReleaseEvent: ReleaseState::Event,
        BattleEvent: crate::troops::BattleEvent,
        OwnershipRow: crate::events::RowSet,
        RowSet: RowSet,
        MapEvent: crate::logic::map::MapState::Event,
    }
}
