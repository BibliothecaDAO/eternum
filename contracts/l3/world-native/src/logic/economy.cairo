#[starknet::contract]
pub mod EconomyLogic {
    use crate::logic::hyperstructures::HyperstructureState;
    use crate::logic::release::ReleaseState;
    use crate::logic::race::RaceState;
    component!(path: RaceState, storage: race, event: RaceEvent);
    #[abi(embed_v0)]
    impl Race = RaceState::RaceImpl<ContractState>;
    #[abi(embed_v0)]
    impl DeepRewards = RaceState::DeepRewardsImpl<ContractState>;
    component!(path: HyperstructureState, storage: hyperstructures, event: HyperstructureEvent);
    #[abi(embed_v0)]
    impl Hyperstructures = HyperstructureState::HyperstructuresImpl<ContractState>;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl LifecycleInternal = ReleaseState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        race: RaceState::Storage,
        #[substorage(v0)]
        hyperstructures: HyperstructureState::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RaceEvent: RaceState::Event,
        HyperstructureEvent: HyperstructureState::Event,
        ReleaseEvent: ReleaseState::Event,
    }
}
