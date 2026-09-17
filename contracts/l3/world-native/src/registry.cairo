#[starknet::contract]
pub mod RegistryDomain {
    use crate::guilds::GuildState;
    use crate::lifecycle::Lifecycle;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: GuildState, storage: guilds, event: GuildEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Guilds = GuildState::GuildsImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        guilds: GuildState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        GuildEvent: GuildState::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: starknet::ContractAddress) {
        self.lifecycle.initialize(authority);
    }
}
