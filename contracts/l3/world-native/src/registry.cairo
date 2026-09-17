#[starknet::contract]
pub mod RegistryDomain {
    use crate::entry::EntryAdministration;
    use crate::guilds::GuildState;
    use crate::lifecycle::Lifecycle;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: GuildState, storage: guilds, event: GuildEvent);
    component!(path: EntryAdministration, storage: entry, event: EntryEvent);
    #[abi(embed_v0)]
    impl Entry = EntryAdministration::LedgerOperatorImpl<ContractState>;
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
        #[substorage(v0)]
        entry: EntryAdministration::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        GuildEvent: GuildState::Event,
        EntryEvent: EntryAdministration::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: starknet::ContractAddress) {
        self.lifecycle.initialize(authority);
    }
}
