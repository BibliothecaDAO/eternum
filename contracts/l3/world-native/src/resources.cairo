use crate::rules::RESOURCE_PRECISION;

pub const LORDS: u8 = 37;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ResourceAmount {
    pub resource_type: u8,
    pub amount: u128,
}

#[derive(Copy, Drop, Serde, Default, PartialEq, Debug, starknet::Store)]
pub struct Production {
    pub building_count: u8,
    pub production_rate: u64,
    pub output_amount_left: u128,
    pub last_updated_at: u32,
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

fn assert_resource(resource_type: u8) {
    assert!(resource_type > 0 && resource_type <= 58, "invalid resource type");
}

fn assert_production(resource_type: u8) {
    assert_resource(resource_type);
    assert!(resource_type < 39 || resource_type > 56, "resource has no production");
}

#[starknet::component]
pub mod ResourceState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use super::{LORDS, Production, ResourceKey, Weight, add, assert_production, assert_resource, settle, spend};
    #[storage]
    pub struct Storage {
        pub balances: Map<(u32, u32, u8), u128>,
        pub productions: Map<(u32, u32, u8), Production>,
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
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn destroy(ref self: ComponentState<TContractState>, key: ResourceKey) {
            self.assert_exists(key);
            for resource_type in 1_u8..59 {
                self.write_balance(key, resource_type, 0);
                if resource_type < 39 || resource_type > 56 {
                    self.write_production(key, resource_type, Default::default());
                }
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
        fn decrease_capacity(ref self: ComponentState<TContractState>, key: ResourceKey, amount: u128) {
            self.assert_exists(key);
            let mut weight = self.weights.read((key.game_id, key.entity_id));
            if weight.capacity != 0xffffffffffffffffffffffffffffffff {
                weight.capacity -= amount;
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
            assert_production(resource_type);
            self.productions.read((key.game_id, key.entity_id, resource_type))
        }
        fn weight(self: @ComponentState<TContractState>, key: ResourceKey) -> Weight {
            self.assert_exists(key);
            self.weights.read((key.game_id, key.entity_id))
        }

        fn settle_resource(
            ref self: ComponentState<TContractState>, key: ResourceKey, resource_type: u8, unit_weight: u128, now: u32,
        ) -> u128 {
            let mut balance = self.balance(key, resource_type);
            let mut production = self.production(key, resource_type);
            if production.last_updated_at == now {
                return balance;
            }
            let mut weight = self.weights.read((key.game_id, key.entity_id));
            settle(resource_type, ref balance, ref production, ref weight, unit_weight, now);
            self.write_balance(key, resource_type, balance);
            self.write_production(key, resource_type, production);
            self.write_weight(key, weight);
            balance
        }
        fn spend_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            unit_weight: u128,
            now: u32,
        ) {
            let mut balance = self.settle_resource(key, resource_type, unit_weight, now);
            let mut weight = self.weights.read((key.game_id, key.entity_id));
            spend(resource_type, ref balance, ref weight, amount, unit_weight);
            self.write_balance(key, resource_type, balance);
            self.write_weight(key, weight);
        }
        fn grant_resource(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            amount: u128,
            unit_weight: u128,
            now: u32,
        ) -> u128 {
            let mut balance = self.settle_resource(key, resource_type, unit_weight, now);
            let mut weight = self.weights.read((key.game_id, key.entity_id));
            let granted = add(resource_type, ref balance, ref weight, amount, unit_weight);
            self.write_balance(key, resource_type, balance);
            self.write_weight(key, weight);
            granted
        }
        fn start_production(
            ref self: ComponentState<TContractState>,
            key: ResourceKey,
            resource_type: u8,
            rate: u64,
            output: u128,
            unit_weight: u128,
            now: u32,
        ) {
            self.settle_resource(key, resource_type, unit_weight, now);
            let mut production = self.production(key, resource_type);
            production.building_count += 1;
            production.production_rate += rate;
            production.output_amount_left += output;
            self.write_production(key, resource_type, production);
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
            // The pinned resource store never persists a LORDS production record.
            if resource_type == LORDS {
                return;
            }
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
