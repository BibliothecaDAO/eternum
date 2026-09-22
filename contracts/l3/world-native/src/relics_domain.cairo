#[starknet::contract]
pub mod RelicsDomain {
    use starknet::ContractAddress;
    use crate::lifecycle::Lifecycle;
    use crate::relics::RelicState;

    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: RelicState, storage: relics, event: RelicEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifecycleInternal = Lifecycle::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Relics = RelicState::RelicsImpl<ContractState>;
    #[abi(embed_v0)]
    impl Artificer = RelicState::ArtificerImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        relics: RelicState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        RelicEvent: RelicState::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
}
