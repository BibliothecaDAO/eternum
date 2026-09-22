use snforge_std::{ContractClassTrait, DeclareResultTrait, EventSpyTrait, EventsFilterTrait, declare, spy_events};
use starknet::storage_access::Store;
use crate::resources::{Production, ProductionPacking, ResourceKey, Weight};
use crate::rules::RESOURCE_PRECISION;

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
    fn grant_at(ref self: T, key: ResourceKey, resource_type: u8, amount: u128, unit_weight: u128, now: u32) -> u128;
    fn spend_at(ref self: T, key: ResourceKey, resource_type: u8, amount: u128, unit_weight: u128, now: u32);
    fn start_at(ref self: T, key: ResourceKey, resource_type: u8, rate: u64, output: u128, now: u32);
    fn read_slot(self: @T, key: ResourceKey, resource_type: u8) -> (u128, Production, Weight);
}

#[starknet::contract]
mod ResourceFixture {
    use crate::resources::{Production, ResourceKey, ResourceState, Weight};
    component!(path: ResourceState, storage: resources, event: ResourceEvent);
    component!(path: crate::production::ProductionState, storage: recipes, event: RecipeEvent);
    impl Internal = ResourceState::InternalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        resources: ResourceState::Storage,
        #[substorage(v0)]
        recipes: crate::production::ProductionState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RecipeEvent: crate::production::ProductionState::Event,
        #[flat]
        ResourceEvent: ResourceState::Event,
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
        fn balance(self: @ContractState, key: ResourceKey) -> u128 {
            self.resources.balance(key, 23)
        }
        fn production(self: @ContractState, key: ResourceKey) -> Production {
            self.resources.production(key, 23)
        }
        fn weight(self: @ContractState, key: ResourceKey) -> Weight {
            self.resources.weight(key)
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
                self.resources.balance(key, resource_type),
                self.resources.production(key, resource_type),
                self.resources.weight(key),
            )
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

#[test]
fn production_storage_preserves_all_232_bits_in_one_slot() {
    assert_eq!(Store::<Production>::size(), 1);
    assert_eq!(ProductionPacking::pack(Default::default()), 0);
    let maximum = Production {
        building_count: 0xff,
        production_rate: 0xffffffffffffffff,
        output_amount_left: 0xffffffffffffffffffffffffffffffff,
        last_updated_at: 0xffffffff,
    };
    let packed: u256 = ProductionPacking::pack(maximum).into();
    assert_eq!(packed, u256 { low: 0xffffffffffffffffffffffffffffffff, high: 0xffffffffffffffffffffffffff });
    assert_eq!(ProductionPacking::unpack(packed.try_into().unwrap()), maximum);
}

#[test]
#[fuzzer(runs: 256)]
fn packed_production_fields_do_not_overlap(buildings: u8, rate: u64, cap: u128, time: u32) {
    let production = Production {
        building_count: buildings, production_rate: rate, output_amount_left: cap, last_updated_at: time,
    };
    assert_eq!(ProductionPacking::unpack(ProductionPacking::pack(production)), production);
}

#[test]
#[feature("safe_dispatcher")]
fn spending_settles_once_and_emits_only_the_final_resource_facts() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    resources.initialize(key, 100);
    resources.start(key);
    let mut spy = spy_events();
    resources.spend_at(key, 23, 5, 1, 20);
    let events = spy.get_events().emitted_by(resources.contract_address);
    assert_eq!(events.events.len(), 3);
    let (_, balance) = events.events.at(0);
    assert_eq!(balance.keys.span(), array![selector!("RowSet"), 1, 'ResourceBalance'].span());
    assert_eq!(balance.data.span(), array![3, 1, 7, 23, 1, 15].span());
    assert_eq!(resources.balance(key), 15);
    assert_eq!(resources.weight(key), Weight { capacity: 100, weight: 15 });
    assert_eq!(
        resources.production(key),
        Production { building_count: 1, production_rate: 2, output_amount_left: 80, last_updated_at: 20 },
    );
    let mut spy = spy_events();
    resources.grant_at(key, 23, 10, 1, 25);
    assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 3);
    let expected = resources.read_slot(key, 23);
    let (balance, production, _) = expected;
    assert_eq!(balance, 35);
    assert_eq!(production.output_amount_left, 70);
    let mut spy = spy_events();
    let rejected = IResourceFixtureSafeDispatcher { contract_address: resources.contract_address };
    assert!(rejected.spend_at(key, 23, 100, 1, 30).is_err());
    assert_eq!(resources.read_slot(key, 23), expected);
    assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn relic_balances_keep_precision_without_production_rows() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    resources.initialize(key, 10 * RESOURCE_PRECISION);
    for resource_type in 39_u8..57 {
        let mut spy = spy_events();
        assert_eq!(resources.grant_at(key, resource_type, 2 * RESOURCE_PRECISION, 1, 100), 2 * RESOURCE_PRECISION);
        assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 2);
        let before = resources.read_slot(key, resource_type);
        let (_, production, _) = before;
        assert_eq!(production, Default::default());
        let rejected = IResourceFixtureSafeDispatcher { contract_address: resources.contract_address };
        let mut spy = spy_events();
        assert!(rejected.spend_at(key, resource_type, 1, 1, 101).is_err());
        assert_eq!(resources.read_slot(key, resource_type), before);
        assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 0);
        resources.spend_at(key, resource_type, 2 * RESOURCE_PRECISION, 1, 102);
        assert_eq!(
            resources.read_slot(key, resource_type),
            (0, Default::default(), Weight { capacity: 10 * RESOURCE_PRECISION, weight: 0 }),
        );
    }
}

#[test]
fn production_spends_its_cap_before_capacity_truncation_and_food_is_uncapped() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    resources.initialize(key, 10);
    resources.start_at(key, 23, 2, 50, 10);
    assert_eq!(resources.grant_at(key, 23, 4, 1, 20), 0);
    let (balance, production, weight) = resources.read_slot(key, 23);
    assert_eq!(balance, 10);
    assert_eq!(production.output_amount_left, 30);
    assert_eq!(weight.weight, 10);
    resources.spend_at(key, 23, 10, 1, 20);
    resources.start_at(key, 35, 2, 0, 20);
    resources.spend_at(key, 35, 3, 1, 25);
    let (balance, production, weight) = resources.read_slot(key, 35);
    assert_eq!(balance, 7);
    assert_eq!(production.output_amount_left, 0);
    assert_eq!(weight.weight, 7);
    let mut spy = spy_events();
    let _ = resources.read_slot(key, 35);
    assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 0);
}

#[test]
fn inactive_resources_have_no_clock_and_activation_starts_at_the_recorded_time() {
    let resources = fixture();
    let key = ResourceKey { game_id: 1, entity_id: 7 };
    resources.initialize(key, 100);
    let mut spy = spy_events();
    resources.grant_at(key, 1, 10, 1, 50);
    assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 2);
    let (_, production, _) = resources.read_slot(key, 1);
    assert_eq!(production, Default::default());
    let mut spy = spy_events();
    resources.spend_at(key, 1, 2, 1, 100);
    assert_eq!(spy.get_events().emitted_by(resources.contract_address).events.len(), 2);
    resources.start_at(key, 1, 2, 100, 200);
    let (balance, production, _) = resources.read_slot(key, 1);
    assert_eq!(balance, 8);
    assert_eq!(
        production, Production { building_count: 1, production_rate: 2, output_amount_left: 100, last_updated_at: 200 },
    );
    resources.spend_at(key, 1, 0, 1, 205);
    let (balance, production, weight) = resources.read_slot(key, 1);
    assert_eq!(balance, 18);
    assert_eq!(weight.weight, 18);
    assert_eq!(production.output_amount_left, 90);
    assert_eq!(production.last_updated_at, 205);
}
