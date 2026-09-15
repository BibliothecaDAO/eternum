use snforge_std::{ContractClassTrait, DeclareResultTrait, EventSpyTrait, EventsFilterTrait, declare, spy_events};
use crate::resources::{Production, ResourceKey, Weight};

#[starknet::interface]
trait IResourceFixture<T> {
    fn initialize(ref self: T, key: ResourceKey, capacity: u128);
    fn grant(ref self: T, key: ResourceKey, amount: u128);
    fn spend(ref self: T, key: ResourceKey, amount: u128);
    fn start(ref self: T, key: ResourceKey);
    fn settle(ref self: T, key: ResourceKey);
    fn destroy(ref self: T, key: ResourceKey);
    fn balance(self: @T, key: ResourceKey) -> u128;
    fn production(self: @T, key: ResourceKey) -> Production;
    fn weight(self: @T, key: ResourceKey) -> Weight;
}

#[starknet::contract]
mod ResourceFixture {
    use crate::resources::{Production, ResourceKey, ResourceState, Weight};
    component!(path: ResourceState, storage: resources, event: ResourceEvent);
    impl Internal = ResourceState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        resources: ResourceState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        ResourceEvent: ResourceState::Event,
    }
    #[abi(embed_v0)]
    impl Fixture of super::IResourceFixture<ContractState> {
        fn initialize(ref self: ContractState, key: ResourceKey, capacity: u128) {
            self.resources.initialize(key, capacity);
        }
        fn grant(ref self: ContractState, key: ResourceKey, amount: u128) {
            self.resources.grant_resource(key, 23, amount, 1, 10);
        }
        fn spend(ref self: ContractState, key: ResourceKey, amount: u128) {
            self.resources.spend_resource(key, 23, amount, 1, 10);
        }
        fn start(ref self: ContractState, key: ResourceKey) {
            self.resources.start_production(key, 23, 2, 100, 1, 10);
        }
        fn settle(ref self: ContractState, key: ResourceKey) {
            self.resources.settle_resource(key, 23, 1, 10);
        }
        fn destroy(ref self: ContractState, key: ResourceKey) {
            self.resources.destroy(key);
        }
        fn balance(self: @ContractState, key: ResourceKey) -> u128 {
            self.resources.balance(key, 23)
        }
        fn production(self: @ContractState, key: ResourceKey) -> Production {
            self.resources.production(key, 23)
        }
        fn weight(self: @ContractState, key: ResourceKey) -> Weight {
            self.resources.weight(key)
        }
    }
}

fn fixture() -> IResourceFixtureDispatcher {
    let (contract_address, _) = declare("ResourceFixture").unwrap().contract_class().deploy(@array![]).unwrap();
    IResourceFixtureDispatcher { contract_address }
}

#[test]
fn sparse_resources_emit_typed_rows_and_skip_unchanged_values() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    let mut spy = spy_events();
    resources.initialize(key, 100);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 1);
    let (_, weight) = events.events.at(0);
    assert_eq!(weight.keys.span(), array![selector!("RowSet"), 1, 'ResourceWeight'].span());
    assert_eq!(weight.data.span(), array![2, 1, 7, 2, 100, 0].span());
    resources.start(key);
    let mut spy = spy_events();
    resources.settle(key);
    assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 0);
    resources.grant(key, 10);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 2);
    let (_, balance) = events.events.at(0);
    assert_eq!(balance.keys.span(), array![selector!("RowSet"), 1, 'ResourceBalance'].span());
    assert_eq!(balance.data.span(), array![3, 1, 7, 23, 1, 10].span());
    let mut spy = spy_events();
    resources.spend(key, 10);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 2);
    let (_, balance) = events.events.at(0);
    assert_eq!(balance.keys.span(), array![selector!("RowDeleted"), 1, 'ResourceBalance'].span());
    assert_eq!(balance.data.span(), array![3, 1, 7, 23].span());
    assert_eq!(resources.balance(key), 0);
    assert_eq!(resources.weight(key).weight, 0);
}

#[test]
fn resource_deletion_clears_production_without_affecting_another_game() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    let other = ResourceKey { game_id: 2, ..key };
    resources.initialize(key, 100);
    resources.initialize(other, 200);
    resources.start(key);
    resources.grant(key, 10);
    resources.grant(other, 20);
    let mut spy = spy_events();
    resources.destroy(key);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 3);
    for index in 0_u32..3 {
        let (_, event) = events.events.at(index);
        assert_eq!(*event.keys.at(0), selector!("RowDeleted"));
    }
    resources.initialize(key, 50);
    assert_eq!(resources.balance(key), 0);
    assert_eq!(resources.production(key), Default::default());
    assert_eq!(resources.weight(key), Weight { capacity: 50, weight: 0 });
    assert_eq!(resources.balance(other), 20);
    assert_eq!(resources.weight(other), Weight { capacity: 200, weight: 20 });
}
