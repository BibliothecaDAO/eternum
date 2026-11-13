pub use snforge_std::{EventSpyTrait, EventsFilterTrait, spy_events};
pub use crate::resources::{Production, ProductionPacking, ResourceKey, Weight};
pub use crate::rules::RESOURCE_PRECISION;

#[starknet::interface]
pub trait IResourceFixture<T> {
    fn initialize(ref self: T, key: ResourceKey, capacity: u128);
    fn grant(ref self: T, key: ResourceKey, amount: u128);
    fn spend(ref self: T, key: ResourceKey, amount: u128);
    fn start(ref self: T, key: ResourceKey);
    fn settle(ref self: T, key: ResourceKey);
    fn destroy(ref self: T, key: ResourceKey);
    fn change_capacity(ref self: T, key: ResourceKey, amount: u128, increase: bool);
    fn stop_at(ref self: T, key: ResourceKey, resource_type: u8, rate: u64, now: u32);
    fn balance(self: @T, key: ResourceKey) -> u128;
    fn production(self: @T, key: ResourceKey) -> Production;
    fn weight(self: @T, key: ResourceKey) -> Weight;
    fn grant_at(ref self: T, key: ResourceKey, resource_type: u8, amount: u128, unit_weight: u128, now: u32) -> u128;
    fn spend_at(ref self: T, key: ResourceKey, resource_type: u8, amount: u128, unit_weight: u128, now: u32);
    fn start_at(ref self: T, key: ResourceKey, resource_type: u8, rate: u64, output: u128, now: u32);
    fn read_slot(self: @T, key: ResourceKey, resource_type: u8) -> (u128, Production, Weight);
}

#[starknet::contract]
pub mod ResourceFixture {
    use starknet::ContractAddress;
    use crate::games::Authentication;
    use crate::games_entry::GamesEntry;
    use crate::logic::release::ReleaseState;
    use crate::logic::resources::ResourceState;
    use crate::resources::{Production, ResourceKey, Weight};
    component!(path: ResourceState, storage: resources, event: ResourceEvent);
    component!(path: GamesEntry, storage: entry, event: EntryEvent);
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    impl EntryInternal = GamesEntry::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Registrar = GamesEntry::RegistrarImpl<ContractState>;
    #[abi(embed_v0)]
    impl Releases = ReleaseState::ReleasesImpl<ContractState>;
    impl Internal = ResourceState::InternalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        resources: ResourceState::Storage,
        #[substorage(v0)]
        entry: GamesEntry::Storage,
        #[substorage(v0)]
        release: ReleaseState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ResourceEvent: ResourceState::Event,
        EntryEvent: GamesEntry::Event,
        ReleaseEvent: ReleaseState::Event,
    }
    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        launcher: ContractAddress,
        authentication: Authentication,
        release_id: u32,
        release: crate::logic::release::Release,
        vrf_public_key: realms_vrf_verifier::vendor::ecvrf::Point,
        l2_gas_bound: u64,
    ) {
        self.entry.initializer(owner, launcher, authentication, release_id, release, vrf_public_key, l2_gas_bound);
    }
    #[abi(embed_v0)]
    impl Fixture of super::IResourceFixture<ContractState> {
        fn initialize(ref self: ContractState, key: ResourceKey, capacity: u128) {
            self.resources.initialize(key, capacity);
        }
        fn grant(ref self: ContractState, key: ResourceKey, amount: u128) {
            self.resources.grant_resource(key, 23, amount, 1, 10, 0);
        }
        fn spend(ref self: ContractState, key: ResourceKey, amount: u128) {
            self.resources.spend_resource(key, 23, amount, 1, 10, 0);
        }
        fn start(ref self: ContractState, key: ResourceKey) {
            self.resources.start_production(key, 23, 2, 100, 1, 10, 0);
        }
        fn settle(ref self: ContractState, key: ResourceKey) {
            self.resources.settle_resource(key, 23, 1, 10, 0);
        }
        fn destroy(ref self: ContractState, key: ResourceKey) {
            self.resources.destroy(key);
        }
        fn change_capacity(ref self: ContractState, key: ResourceKey, amount: u128, increase: bool) {
            self.resources.change_capacity(key, amount, increase);
        }
        fn stop_at(ref self: ContractState, key: ResourceKey, resource_type: u8, rate: u64, now: u32) {
            self.resources.stop_production(key, resource_type, rate, 1, now, 0);
        }
        fn balance(self: @ContractState, key: ResourceKey) -> u128 {
            crate::logic::resources::balance(key, 23)
        }
        fn production(self: @ContractState, key: ResourceKey) -> Production {
            crate::logic::resources::production(key, 23)
        }
        fn weight(self: @ContractState, key: ResourceKey) -> Weight {
            crate::logic::resources::weight(key)
        }
        fn grant_at(
            ref self: ContractState, key: ResourceKey, resource_type: u8, amount: u128, unit_weight: u128, now: u32,
        ) -> u128 {
            self.resources.grant_resource(key, resource_type, amount, unit_weight, now, 0)
        }
        fn spend_at(
            ref self: ContractState, key: ResourceKey, resource_type: u8, amount: u128, unit_weight: u128, now: u32,
        ) {
            self.resources.spend_resource(key, resource_type, amount, unit_weight, now, 0);
        }
        fn start_at(ref self: ContractState, key: ResourceKey, resource_type: u8, rate: u64, output: u128, now: u32) {
            self.resources.start_production(key, resource_type, rate, output, 1, now, 0);
        }
        fn read_slot(self: @ContractState, key: ResourceKey, resource_type: u8) -> (u128, Production, Weight) {
            (
                crate::logic::resources::balance(key, resource_type),
                crate::logic::resources::production(key, resource_type),
                crate::logic::resources::weight(key),
            )
        }
    }
}
pub fn fixture() -> IResourceFixtureDispatcher {
    let d = super::setup_with_host(true, "MapLogic", "TroopFixture", "ResourceFixture");
    IResourceFixtureDispatcher { contract_address: d.games }
}
