use crate::rules::RESOURCE_PRECISION;

pub const LORDS: u8 = 37;
pub const UNLIMITED_OUTPUT: u128 = 0xffffffffffffffffffffffffffffffff;
pub const RESOURCE_RATE_SCALE: u128 = 0x10000000000000000;
const FIRST_TROOP_RESOURCE: u8 = 26;
const LAST_TROOP_RESOURCE: u8 = 34;

pub fn is_troop_resource(resource_type: u8) -> bool {
    resource_type >= FIRST_TROOP_RESOURCE && resource_type <= LAST_TROOP_RESOURCE
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ResourceAmount {
    pub resource_type: u8,
    pub amount: u128,
}


#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceBurn {
    pub entity_id: u32,
    pub resources: Span<ResourceAmount>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceTransfer {
    pub from_entity_id: u32,
    pub to_entity_id: u32,
    pub resources: Span<ResourceAmount>,
}

#[inline(never)]
pub fn assert_unique_resources(resources: Span<ResourceAmount>) {
    let mut seen: core::dict::Felt252Dict<u128> = Default::default();
    for resource in resources {
        let id = (*resource.resource_type).into();
        assert!(seen.get(id) == 0, "duplicate transfer resource");
        seen.insert(id, 1);
    }
}


#[derive(Copy, Drop, Serde, Default, PartialEq, Debug)]
pub struct Production {
    pub building_count: u8,
    pub production_rate: u64,
    pub output_amount_left: u128,
    pub last_updated_at: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ProductionReceiver {
    pub home: u32,
    pub end_at: u32,
}

const PRODUCTION_TIME_SCALE: u128 = 0x10000000000000000;
const PRODUCTION_COUNT_SCALE: u128 = 0x1000000000000000000000000;

// The cap occupies the low limb; rate, settlement time and building count use 104 high bits.
pub impl ProductionPacking of starknet::storage_access::StorePacking<Production, felt252> {
    fn pack(value: Production) -> felt252 {
        let high = value.production_rate.into()
            + value.last_updated_at.into() * PRODUCTION_TIME_SCALE
            + value.building_count.into() * PRODUCTION_COUNT_SCALE;
        u256 { low: value.output_amount_left, high }.try_into().unwrap()
    }
    fn unpack(value: felt252) -> Production {
        let value: u256 = value.into();
        Production {
            building_count: (value.high / PRODUCTION_COUNT_SCALE).try_into().unwrap(),
            production_rate: (value.high % PRODUCTION_TIME_SCALE).try_into().unwrap(),
            output_amount_left: value.low,
            last_updated_at: (value.high / PRODUCTION_TIME_SCALE % 0x100000000).try_into().unwrap(),
        }
    }
}
#[derive(Copy, Drop, Serde, Default, PartialEq, Debug, starknet::Store)]
pub struct Weight {
    pub capacity: u128,
    pub weight: u128,
}
#[derive(Copy, Drop, Serde, PartialEq, Debug)]
pub struct ResourceKey {
    pub game_id: u32,
    pub entity_id: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceSlot {
    pub game_id: u32,
    pub entity_id: u32,
    pub resource_type: u8,
}

#[derive(Copy, Drop)]
struct SettledResource {
    balance: u128,
    production: Production,
    weight: Weight,
}

fn assert_resource(resource_type: u8) {
    assert!(resource_type > 0 && resource_type <= 58, "invalid resource type");
}

fn assert_production(resource_type: u8) {
    assert_resource(resource_type);
    assert!(resource_type < 39 || resource_type > 56, "resource has no production");
}

fn has_production(resource_type: u8) -> bool {
    resource_type != LORDS && (resource_type < 39 || resource_type > 56)
}

#[starknet::component]
pub mod ResourceState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use crate::production::ProductionState::InternalTrait as RecipeInternal;
    use crate::production::{ProductionState, RecipeKey};
    use super::{
        Production, ProductionReceiver, ResourceKey, SettledResource, Weight, add, assert_production, assert_resource,
        has_production, settle, spend,
    };
    #[storage]
    pub struct Storage {
        pub resource_rules: Map<(u32, u8), (u128, u128)>,
        pub resources_configured: Map<u32, bool>,
        pub balances: Map<(u32, u32, u8), u128>,
        pub productions: Map<(u32, u32, u8), Production>,
        pub production_receivers: Map<(u32, u32, u8), Option<ProductionReceiver>>,
        pub incoming_count: Map<(u32, u32, u8), u32>,
        pub incoming_sources: Map<(u32, u32, u8, u32), u32>,
        pub weights: Map<(u32, u32), Weight>,
        pub resource_exists: Map<(u32, u32), bool>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>, impl Recipes: ProductionState::HasComponent<TContractState>,
    > of InternalTrait<TContractState> {
        fn rule(self: @ComponentState<TContractState>, game_id: u32, resource_type: u8) -> super::ResourceRule {
            assert!(self.resources_configured.read(game_id), "missing resource rules");
            assert_resource(resource_type);
            let (unit_weight, rates) = self.resource_rules.read((game_id, resource_type));
            super::ResourceRule {
                resource_type,
                unit_weight,
                realm_rate: (rates % super::RESOURCE_RATE_SCALE).try_into().unwrap(),
                village_rate: (rates / super::RESOURCE_RATE_SCALE).try_into().unwrap(),
            }
        }
        fn burn_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            unit_weight: u128,
        ) {
            // Explicit burns spend the stored balance; they never harvest pending production.
            let mut balance = self.balance(key, resource_type);
            let mut weight = self.weight(key);
            spend(resource_type, ref balance, ref weight, amount, unit_weight);
            self.write_balance(key, resource_type, balance);
            self.write_weight(key, weight);
        }
        fn destroy(ref self: ComponentState<TContractState>, key: ResourceKey) {
            self.assert_exists(key);
            for resource_type in 1_u8..59 {
                self.write_balance(key, resource_type, 0);
                self.write_production(key, resource_type, Default::default());
            }
            self.weights.write((key.game_id, key.entity_id), Default::default());
            self.resource_exists.write((key.game_id, key.entity_id), false);
            self
                .emit(
                    RowDeleted {
                        version: 1,
                        model: 'ResourceWeight',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                    },
                );
        }
        fn change_capacity(ref self: ComponentState<TContractState>, key: ResourceKey, amount: u128, increase: bool) {
            self.assert_exists(key);
            let mut weight = self.weights.read((key.game_id, key.entity_id));
            if weight.capacity != 0xffffffffffffffffffffffffffffffff {
                weight.capacity = if increase {
                    weight.capacity + amount
                } else {
                    weight.capacity - amount
                };
                self.write_weight(key, weight);
            }
        }
        fn initialize(ref self: ComponentState<TContractState>, key: ResourceKey, capacity: u128) {
            assert!(key.game_id != 0 && key.entity_id != 0, "reserved resource key");
            assert!(!self.resource_exists.read((key.game_id, key.entity_id)), "resources already initialized");
            let weight = Weight { capacity, weight: 0 };
            self.weights.write((key.game_id, key.entity_id), weight);
            self.resource_exists.write((key.game_id, key.entity_id), true);
            self.emit_weight(key, weight);
        }
        #[inline(never)]
        fn assert_exists(self: @ComponentState<TContractState>, key: ResourceKey) {
            assert!(self.resource_exists.read((key.game_id, key.entity_id)), "missing resource owner");
        }
        #[inline(never)]
        fn balance(self: @ComponentState<TContractState>, key: ResourceKey, resource_type: u8) -> u128 {
            self.assert_exists(key);
            assert_resource(resource_type);
            self.balances.read((key.game_id, key.entity_id, resource_type))
        }
        #[inline(never)]
        fn production(self: @ComponentState<TContractState>, key: ResourceKey, resource_type: u8) -> Production {
            self.assert_exists(key);
            assert_resource(resource_type);
            if !has_production(resource_type) {
                return Default::default();
            }
            self.productions.read((key.game_id, key.entity_id, resource_type))
        }
        fn weight(self: @ComponentState<TContractState>, key: ResourceKey) -> Weight {
            self.assert_exists(key);
            self.weights.read((key.game_id, key.entity_id))
        }

        fn settle_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) -> u128 {
            let resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            self.commit_resource(key, resource_type, resource);
            resource.balance
        }
        fn spend_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            spend(resource_type, ref resource.balance, ref resource.weight, amount, unit_weight);
            self.commit_resource(key, resource_type, resource);
        }
        fn grant_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) -> u128 {
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            let granted = add(resource_type, ref resource.balance, ref resource.weight, amount, unit_weight);
            self.commit_resource(key, resource_type, resource);
            granted
        }
        fn refill_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            output: u128,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            assert_production(resource_type);
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            resource.production.output_amount_left += output;
            self.commit_resource(key, resource_type, resource);
        }
        fn start_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            output: u128,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            assert_production(resource_type);
            if super::is_troop_resource(resource_type) && output == super::UNLIMITED_OUTPUT {
                self.settle_resource(key, 35, self.rule(key.game_id, 35).unit_weight, now, start_at);
            }
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            resource.production.building_count += 1;
            resource.production.production_rate += rate;
            resource
                .production
                .output_amount_left =
                    if output == super::UNLIMITED_OUTPUT {
                        output
                    } else {
                        resource.production.output_amount_left + output
                    };
            self.commit_resource(key, resource_type, resource);
        }
        fn stop_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            assert_production(resource_type);
            let mut resource = self.load_settled(key, resource_type, unit_weight, now, start_at);
            resource.production.building_count -= 1;
            resource.production.production_rate -= rate;
            self.commit_resource(key, resource_type, resource);
        }
        fn change_structure_capacity(
            ref self: ComponentState<TContractState>, key: ResourceKey, amount: u128, adding: bool,
        ) {
            self.assert_exists(key);
            let mut weight = self.weights.read((key.game_id, key.entity_id));
            if weight.capacity == 0xffffffffffffffffffffffffffffffff {
                return;
            }
            weight.capacity = if adding {
                weight.capacity + amount
            } else {
                weight.capacity - amount
            };
            if !adding {
                assert!(weight.weight <= weight.capacity, "structure exceeds reduced capacity");
            }
            self.write_weight(key, weight);
        }
        fn load_settled(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) -> SettledResource {
            if resource_type == 35 || super::is_troop_resource(resource_type) {
                self.settle_training(key, now, start_at);
            }
            let receiver = self.production_receivers.read((key.game_id, key.entity_id, resource_type));
            if let Some(receiver) = receiver {
                self
                    .settle_resource(
                        ResourceKey { game_id: key.game_id, entity_id: receiver.home },
                        resource_type,
                        unit_weight,
                        now,
                        start_at,
                    );
            }
            let mut resource = SettledResource {
                balance: self.balance(key, resource_type),
                production: self.production(key, resource_type),
                weight: self.weights.read((key.game_id, key.entity_id)),
            };
            resource
                .production
                .last_updated_at = core::cmp::max(resource.production.last_updated_at, core::cmp::min(now, start_at));
            if receiver.is_none() && resource.production.last_updated_at != now {
                settle(
                    resource_type, ref resource.balance, ref resource.production, ref resource.weight, unit_weight, now,
                );
            }
            self.settle_incoming_production(key, resource_type, ref resource, unit_weight, now);
            resource
        }

        fn settle_training(ref self: ComponentState<TContractState>, key: ResourceKey, now: u32, start_at: u32) {
            let mut trainers = array![];
            for resource_type in super::FIRST_TROOP_RESOURCE..(super::LAST_TROOP_RESOURCE + 1) {
                let production = self.production(key, resource_type);
                if production.output_amount_left == super::UNLIMITED_OUTPUT
                    && production.building_count != 0
                    && production.last_updated_at != now {
                    trainers.append((resource_type, production));
                }
            }
            if trainers.is_empty() {
                return;
            }

            let mut wheat = self.production(key, 35);
            let wheat_weight = self.rule(key.game_id, 35).unit_weight;
            let stored_wheat = self.balance(key, 35);
            let mut available = stored_wheat;
            if wheat.building_count != 0 {
                let since = core::cmp::max(wheat.last_updated_at, core::cmp::min(now, start_at));
                available += Into::<u32, u128>::into(now - since) * wheat.production_rate.into();
            }
            wheat.last_updated_at = now;
            let mut outputs = array![];
            for (resource_type, mut production) in trainers {
                let recipe = get_dep_component!(@self, Recipes)
                    .recipe(RecipeKey { game_id: key.game_id, resource_type });
                assert!(recipe.simple_output != 0 && recipe.simple_inputs.len() == 1, "training needs a simple recipe");
                let input = *recipe.simple_inputs.at(0);
                assert!(input.resource_type == 35 && input.amount != 0, "training requires wheat");
                let since = core::cmp::max(production.last_updated_at, core::cmp::min(now, start_at));
                let expected = Into::<u32, u128>::into(now - since) * production.production_rate.into();
                let per_cycle: u128 = recipe.simple_output.into();
                let trained = core::cmp::min(expected, available * per_cycle / input.amount);
                available -= (trained * input.amount + per_cycle - 1) / per_cycle;
                production.last_updated_at = now;
                outputs.append((resource_type, production, trained));
            }

            // Training consumes farm output before storage burns any surplus.
            let mut weight = self.weight(key);
            let mut wheat_balance = stored_wheat;
            spend(35, ref wheat_balance, ref weight, stored_wheat, wheat_weight);
            add(35, ref wheat_balance, ref weight, available, wheat_weight);
            self.write_balance(key, 35, wheat_balance);
            self.write_production(key, 35, wheat);
            for (resource_type, production, trained) in outputs {
                let mut balance = self.balance(key, resource_type);
                add(resource_type, ref balance, ref weight, trained, self.rule(key.game_id, resource_type).unit_weight);
                self.write_balance(key, resource_type, balance);
                self.write_production(key, resource_type, production);
            }
            self.write_weight(key, weight);
        }

        fn redirect_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            receiver: ProductionReceiver,
            rate: u64,
            unit_weight: u128,
            now: u32,
            start_at: u32,
        ) {
            self.assert_exists(key);
            let home = ResourceKey { game_id: key.game_id, entity_id: receiver.home };
            self.assert_exists(home);
            assert!(home.entity_id != key.entity_id, "production cannot receive itself");
            assert!(resource_type != 35 && resource_type != 36 && has_production(resource_type), "uncapped production");
            assert!(rate != 0 && receiver.end_at > now, "invalid production interval");
            let previous = self.production_receivers.read((key.game_id, key.entity_id, resource_type));
            if let Some(previous) = previous {
                self
                    .settle_resource(
                        ResourceKey { game_id: key.game_id, entity_id: previous.home },
                        resource_type,
                        unit_weight,
                        now,
                        start_at,
                    );
                if previous.home == receiver.home {
                    return;
                }
            }
            let mut production = self.production(key, resource_type);
            assert!(self.balance(key, resource_type) == 0, "redirected producer holds a balance");
            assert!(production.production_rate == 0 || previous.is_some(), "producer was not awaiting capture");
            if production.output_amount_left == 0 {
                return;
            }
            production.production_rate = rate;
            production.building_count = 1;
            production.last_updated_at = now;
            self.write_production(key, resource_type, production);
            let index = self.incoming_count.read((key.game_id, receiver.home, resource_type));
            self.incoming_sources.write((key.game_id, receiver.home, resource_type, index), key.entity_id);
            self.incoming_count.write((key.game_id, receiver.home, resource_type), index + 1);
            self.write_production_receiver(key, resource_type, Some(receiver));
        }

        fn settle_incoming_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            ref resource: SettledResource,
            unit_weight: u128,
            now: u32,
        ) {
            let initial_count = self.incoming_count.read((key.game_id, key.entity_id, resource_type));
            let mut count = initial_count;
            let mut index = 0;
            while index < count {
                let source_id = self.incoming_sources.read((key.game_id, key.entity_id, resource_type, index));
                let source = ResourceKey { game_id: key.game_id, entity_id: source_id };
                let receiver = self.production_receivers.read((key.game_id, source_id, resource_type));
                let mut finished = true;
                if let Some(receiver) = receiver {
                    if receiver.home == key.entity_id {
                        let mut production = self.production(source, resource_type);
                        let until = core::cmp::min(now, receiver.end_at);
                        if until > production.last_updated_at {
                            settle(
                                resource_type,
                                ref resource.balance,
                                ref production,
                                ref resource.weight,
                                unit_weight,
                                until,
                            );
                        }
                        finished = production.output_amount_left == 0 || until >= receiver.end_at;
                        if finished {
                            production = Default::default();
                            self.write_production_receiver(source, resource_type, None);
                        }
                        self.write_production(source, resource_type, production);
                    }
                }
                if finished {
                    count -= 1;
                    let last = self.incoming_sources.read((key.game_id, key.entity_id, resource_type, count));
                    self.incoming_sources.write((key.game_id, key.entity_id, resource_type, index), last);
                } else {
                    index += 1;
                }
            }
            if count != initial_count {
                self.incoming_count.write((key.game_id, key.entity_id, resource_type), count);
            }
        }

        fn write_production_receiver(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            receiver: Option<ProductionReceiver>,
        ) {
            self.production_receivers.write((key.game_id, key.entity_id, resource_type), receiver);
            let keys = array![key.game_id.into(), key.entity_id.into(), resource_type.into()].span();
            match receiver {
                Some(value) => {
                    let mut values = array![];
                    value.serialize(ref values);
                    self.emit(RowSet { version: 1, model: 'ProductionReceiver', keys, values: values.span() });
                },
                None => self.emit(RowDeleted { version: 1, model: 'ProductionReceiver', keys }),
            };
        }

        fn commit_resource(
            ref self: ComponentState<TContractState>, key: ResourceKey, resource_type: u8, resource: SettledResource,
        ) {
            self.write_balance(key, resource_type, resource.balance);
            self.write_production(key, resource_type, resource.production);
            self.write_weight(key, resource.weight);
        }
        #[inline(never)]
        fn write_balance(ref self: ComponentState<TContractState>, key: ResourceKey, resource_type: u8, balance: u128) {
            let storage_key = (key.game_id, key.entity_id, resource_type);
            if self.balances.read(storage_key) == balance {
                return;
            }
            self.balances.write(storage_key, balance);
            let keys = array![key.game_id.into(), key.entity_id.into(), resource_type.into()].span();
            if balance == 0 {
                self.emit(RowDeleted { version: 1, model: 'ResourceBalance', keys });
            } else {
                self.emit(RowSet { version: 1, model: 'ResourceBalance', keys, values: array![balance.into()].span() });
            }
        }
        #[inline(never)]
        fn write_production(
            ref self: ComponentState<TContractState>, key: ResourceKey, resource_type: u8, production: Production,
        ) {
            if !has_production(resource_type) {
                return;
            }
            let production = if production.building_count == 0 {
                Production { last_updated_at: 0, ..production }
            } else {
                production
            };
            let storage_key = (key.game_id, key.entity_id, resource_type);
            if self.productions.read(storage_key) == production {
                return;
            }
            self.productions.write(storage_key, production);
            let keys = array![key.game_id.into(), key.entity_id.into(), resource_type.into()].span();
            if production == Default::default() {
                self.emit(RowDeleted { version: 1, model: 'ResourceProduction', keys });
            } else {
                let mut values = array![];
                production.serialize(ref values);
                self.emit(RowSet { version: 1, model: 'ResourceProduction', keys, values: values.span() });
            }
        }
        #[inline(never)]
        fn write_weight(ref self: ComponentState<TContractState>, key: ResourceKey, weight: Weight) {
            if self.weights.read((key.game_id, key.entity_id)) == weight {
                return;
            }
            self.weights.write((key.game_id, key.entity_id), weight);
            self.emit_weight(key, weight);
        }
        fn emit_weight(ref self: ComponentState<TContractState>, key: ResourceKey, weight: Weight) {
            let mut values = array![];
            weight.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'ResourceWeight',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}

pub fn settle(
    resource_type: u8, ref balance: u128, ref production: Production, ref weight: Weight, unit_weight: u128, now: u32,
) {
    let start_at = production.last_updated_at;
    production.last_updated_at = now;
    if resource_type == LORDS || production.building_count == 0 {
        return;
    }
    let mut produced = (now - start_at).into() * production.production_rate.into();
    if resource_type != 35 && resource_type != 36 {
        produced = core::cmp::min(produced, production.output_amount_left);
        production.output_amount_left -= produced;
    }
    if produced != 0 {
        add(resource_type, ref balance, ref weight, produced, unit_weight);
    }
}

fn add(resource_type: u8, ref balance: u128, ref weight: Weight, amount: u128, unit_weight: u128) -> u128 {
    let unlimited = weight.capacity == 0xffffffffffffffffffffffffffffffff;
    let remaining = if unlimited {
        weight.capacity
    } else {
        weight.capacity - core::cmp::min(weight.capacity, weight.weight)
    };
    let total_weight = amount * unit_weight;
    let storable = if remaining < total_weight {
        remaining / unit_weight
    } else {
        amount
    };
    balance += storable;
    assert_relic_precision(resource_type, balance);
    if !unlimited {
        weight.weight += storable * unit_weight;
    }
    storable
}

fn spend(resource_type: u8, ref balance: u128, ref weight: Weight, amount: u128, unit_weight: u128) {
    assert!(balance >= amount, "insufficient resource balance");
    balance -= amount;
    assert_relic_precision(resource_type, balance);
    if weight.capacity != 0xffffffffffffffffffffffffffffffff {
        weight.weight -= amount * unit_weight;
    }
}

fn assert_relic_precision(resource_type: u8, balance: u128) {
    if resource_type >= 39 && resource_type <= 56 {
        assert!(balance % RESOURCE_PRECISION == 0, "fractional relic balance");
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceRule {
    pub resource_type: u8,
    pub unit_weight: u128,
    pub realm_rate: u64,
    pub village_rate: u64,
}

#[starknet::interface]
pub trait IResources<T> {
    fn resource_arrival(self: @T, key: crate::arrivals::ArrivalKey) -> crate::arrivals::Arrival;
    fn has_resource(self: @T, key: ResourceKey) -> bool;
    fn resource_balance(self: @T, key: ResourceSlot) -> u128;
    fn resource_production(self: @T, key: ResourceSlot) -> Production;
    fn production_receiver(self: @T, key: ResourceSlot) -> Option<ProductionReceiver>;
    fn redirect_production(
        ref self: T, key: ResourceKey, resource_type: u8, receiver: ProductionReceiver, rate: u64, timestamp: u64,
    );
    fn resource_weight(self: @T, key: ResourceKey) -> Weight;
    fn resource_rule(self: @T, game_id: u32, resource_type: u8) -> ResourceRule;
    fn configure_resources(ref self: T, game_id: u32, rules: Span<ResourceRule>);
    fn initialize_resources(ref self: T, key: ResourceKey, capacity: u128, category: u8, timestamp: u64);
    fn initialize_explorer_resources(ref self: T, key: ResourceKey, amount: u128);
    fn destroy_resources(ref self: T, key: ResourceKey);
    fn change_explorer_capacity(ref self: T, key: ResourceKey, amount: u128, increase: bool);
    fn grant_resource(ref self: T, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64) -> u128;
    fn spend_resource(ref self: T, key: ResourceKey, resource_type: u8, amount: u128, timestamp: u64);
    fn start_production(ref self: T, key: ResourceKey, resource_type: u8, rate: u64, output: u128, timestamp: u64);
    fn stop_production(ref self: T, key: ResourceKey, resource_type: u8, rate: u64, timestamp: u64);
    fn change_structure_capacity(ref self: T, key: ResourceKey, amount: u128, adding: bool);
    fn spend_food(ref self: T, key: ResourceKey, wheat: u128, fish: u128, timestamp: u64);
    fn spend_spire_fee(ref self: T, key: ResourceKey, timestamp: u64);
}
