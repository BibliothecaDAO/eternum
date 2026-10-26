pub use snforge_std::{ContractClassTrait, DeclareResultTrait, EventSpyTrait, EventsFilterTrait, declare, spy_events};
pub use crate::realms::{RealmCatalogue, RealmTraits};

#[starknet::interface]
pub trait IRealmPoolFixture<T> {
    fn initialize(ref self: T, first: u32, traits: Span<u32>);
    fn catalogue(self: @T) -> RealmCatalogue;
    fn traits(self: @T, id: u32) -> RealmTraits;
    fn reserve(ref self: T, game: u32, id: u32, settled: u16);
    fn available(self: @T, game: u32, index: u32, settled: u16) -> u32;
}

#[starknet::contract]
pub mod RealmPoolFixture {
    use starknet::storage::StoragePointerReadAccess;
    use crate::logic::realms::RealmState;
    use crate::realms::{RealmCatalogue, RealmTraits};
    component!(path: RealmState, storage: realms, event: RealmEvent);
    impl Internal = RealmState::InternalImpl<ContractState>;
    #[storage]
    pub struct Storage {
        #[substorage(v0)]
        pub realms: RealmState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        #[flat]
        RealmEvent: RealmState::Event,
    }
    #[abi(embed_v0)]
    impl Fixture of super::IRealmPoolFixture<ContractState> {
        fn initialize(ref self: ContractState, first: u32, traits: Span<u32>) {
            self.realms.initialize(first, traits);
        }
        fn catalogue(self: @ContractState) -> RealmCatalogue {
            RealmCatalogue {
                initialized: self.realms.data.realms.catalogue_count.read(),
                digest: self.realms.data.realms.catalogue_digest.read(),
            }
        }
        fn traits(self: @ContractState, id: u32) -> RealmTraits {
            self.realms.traits(id)
        }
        fn reserve(ref self: ContractState, game: u32, id: u32, settled: u16) {
            self.realms.reserve(game, id, settled);
        }
        fn available(self: @ContractState, game: u32, index: u32, settled: u16) -> u32 {
            self.realms.available(game, index, settled)
        }
    }
}
pub fn fixture() -> IRealmPoolFixtureDispatcher {
    let (contract_address, _) = declare("RealmPoolFixture").unwrap().contract_class().deploy(@array![]).unwrap();
    IRealmPoolFixtureDispatcher { contract_address }
}
