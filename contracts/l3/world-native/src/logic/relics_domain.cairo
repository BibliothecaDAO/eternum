#[starknet::contract]
pub mod RelicsLogic {
    use crate::logic::release::ReleaseState;
    use crate::logic::relics::RelicState;

    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: RelicState, storage: relics, event: RelicEvent);
    impl LifecycleInternal = ReleaseState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Relics = RelicState::RelicsImpl<ContractState>;
    #[abi(embed_v0)]
    impl CaptureRewards = RelicState::CaptureRewardsImpl<ContractState>;
    #[abi(embed_v0)]
    impl Artificer = RelicState::ArtificerImpl<ContractState>;

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        relics: RelicState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        RelicEvent: RelicState::Event,
    }
}
