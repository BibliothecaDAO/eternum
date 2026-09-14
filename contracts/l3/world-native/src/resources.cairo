use crate::rules::RESOURCE_PRECISION;

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
#[derive(Copy, Drop, Serde, Default, PartialEq, Debug)]
pub struct Resource {
    pub STONE_BALANCE: u128,
    pub COAL_BALANCE: u128,
    pub WOOD_BALANCE: u128,
    pub COPPER_BALANCE: u128,
    pub IRONWOOD_BALANCE: u128,
    pub OBSIDIAN_BALANCE: u128,
    pub GOLD_BALANCE: u128,
    pub SILVER_BALANCE: u128,
    pub MITHRAL_BALANCE: u128,
    pub ALCHEMICAL_SILVER_BALANCE: u128,
    pub COLD_IRON_BALANCE: u128,
    pub DEEP_CRYSTAL_BALANCE: u128,
    pub RUBY_BALANCE: u128,
    pub DIAMONDS_BALANCE: u128,
    pub HARTWOOD_BALANCE: u128,
    pub IGNIUM_BALANCE: u128,
    pub TWILIGHT_QUARTZ_BALANCE: u128,
    pub TRUE_ICE_BALANCE: u128,
    pub ADAMANTINE_BALANCE: u128,
    pub SAPPHIRE_BALANCE: u128,
    pub ETHEREAL_SILICA_BALANCE: u128,
    pub DRAGONHIDE_BALANCE: u128,
    pub LABOR_BALANCE: u128,
    pub EARTHEN_SHARD_BALANCE: u128,
    pub DONKEY_BALANCE: u128,
    pub KNIGHT_T1_BALANCE: u128,
    pub KNIGHT_T2_BALANCE: u128,
    pub KNIGHT_T3_BALANCE: u128,
    pub CROSSBOWMAN_T1_BALANCE: u128,
    pub CROSSBOWMAN_T2_BALANCE: u128,
    pub CROSSBOWMAN_T3_BALANCE: u128,
    pub PALADIN_T1_BALANCE: u128,
    pub PALADIN_T2_BALANCE: u128,
    pub PALADIN_T3_BALANCE: u128,
    pub WHEAT_BALANCE: u128,
    pub FISH_BALANCE: u128,
    pub LORDS_BALANCE: u128,
    pub ESSENCE_BALANCE: u128,
    pub RELIC_E1_BALANCE: u128,
    pub RELIC_E2_BALANCE: u128,
    pub RELIC_E3_BALANCE: u128,
    pub RELIC_E4_BALANCE: u128,
    pub RELIC_E5_BALANCE: u128,
    pub RELIC_E6_BALANCE: u128,
    pub RELIC_E7_BALANCE: u128,
    pub RELIC_E8_BALANCE: u128,
    pub RELIC_E9_BALANCE: u128,
    pub RELIC_E10_BALANCE: u128,
    pub RELIC_E11_BALANCE: u128,
    pub RELIC_E12_BALANCE: u128,
    pub RELIC_E13_BALANCE: u128,
    pub RELIC_E14_BALANCE: u128,
    pub RELIC_E15_BALANCE: u128,
    pub RELIC_E16_BALANCE: u128,
    pub RELIC_E17_BALANCE: u128,
    pub RELIC_E18_BALANCE: u128,
    pub RESEARCH_BALANCE: u128,
    pub SATOSHI_BALANCE: u128,
    pub weight: Weight,
    pub STONE_PRODUCTION: Production,
    pub COAL_PRODUCTION: Production,
    pub WOOD_PRODUCTION: Production,
    pub COPPER_PRODUCTION: Production,
    pub IRONWOOD_PRODUCTION: Production,
    pub OBSIDIAN_PRODUCTION: Production,
    pub GOLD_PRODUCTION: Production,
    pub SILVER_PRODUCTION: Production,
    pub MITHRAL_PRODUCTION: Production,
    pub ALCHEMICAL_SILVER_PRODUCTION: Production,
    pub COLD_IRON_PRODUCTION: Production,
    pub DEEP_CRYSTAL_PRODUCTION: Production,
    pub RUBY_PRODUCTION: Production,
    pub DIAMONDS_PRODUCTION: Production,
    pub HARTWOOD_PRODUCTION: Production,
    pub IGNIUM_PRODUCTION: Production,
    pub TWILIGHT_QUARTZ_PRODUCTION: Production,
    pub TRUE_ICE_PRODUCTION: Production,
    pub ADAMANTINE_PRODUCTION: Production,
    pub SAPPHIRE_PRODUCTION: Production,
    pub ETHEREAL_SILICA_PRODUCTION: Production,
    pub DRAGONHIDE_PRODUCTION: Production,
    pub LABOR_PRODUCTION: Production,
    pub EARTHEN_SHARD_PRODUCTION: Production,
    pub DONKEY_PRODUCTION: Production,
    pub KNIGHT_T1_PRODUCTION: Production,
    pub KNIGHT_T2_PRODUCTION: Production,
    pub KNIGHT_T3_PRODUCTION: Production,
    pub CROSSBOWMAN_T1_PRODUCTION: Production,
    pub CROSSBOWMAN_T2_PRODUCTION: Production,
    pub CROSSBOWMAN_T3_PRODUCTION: Production,
    pub PALADIN_T1_PRODUCTION: Production,
    pub PALADIN_T2_PRODUCTION: Production,
    pub PALADIN_T3_PRODUCTION: Production,
    pub WHEAT_PRODUCTION: Production,
    pub FISH_PRODUCTION: Production,
    pub LORDS_PRODUCTION: Production,
    pub ESSENCE_PRODUCTION: Production,
    pub RESEARCH_PRODUCTION: Production,
    pub SATOSHI_PRODUCTION: Production,
}

fn balance_member(resource_type: u8) -> felt252 {
    match resource_type {
        1 => 'STONE_BALANCE',
        2 => 'COAL_BALANCE',
        3 => 'WOOD_BALANCE',
        4 => 'COPPER_BALANCE',
        5 => 'IRONWOOD_BALANCE',
        6 => 'OBSIDIAN_BALANCE',
        7 => 'GOLD_BALANCE',
        8 => 'SILVER_BALANCE',
        9 => 'MITHRAL_BALANCE',
        10 => 'ALCHEMICAL_SILVER_BALANCE',
        11 => 'COLD_IRON_BALANCE',
        12 => 'DEEP_CRYSTAL_BALANCE',
        13 => 'RUBY_BALANCE',
        14 => 'DIAMONDS_BALANCE',
        15 => 'HARTWOOD_BALANCE',
        16 => 'IGNIUM_BALANCE',
        17 => 'TWILIGHT_QUARTZ_BALANCE',
        18 => 'TRUE_ICE_BALANCE',
        19 => 'ADAMANTINE_BALANCE',
        20 => 'SAPPHIRE_BALANCE',
        21 => 'ETHEREAL_SILICA_BALANCE',
        22 => 'DRAGONHIDE_BALANCE',
        23 => 'LABOR_BALANCE',
        24 => 'EARTHEN_SHARD_BALANCE',
        25 => 'DONKEY_BALANCE',
        26 => 'KNIGHT_T1_BALANCE',
        27 => 'KNIGHT_T2_BALANCE',
        28 => 'KNIGHT_T3_BALANCE',
        29 => 'CROSSBOWMAN_T1_BALANCE',
        30 => 'CROSSBOWMAN_T2_BALANCE',
        31 => 'CROSSBOWMAN_T3_BALANCE',
        32 => 'PALADIN_T1_BALANCE',
        33 => 'PALADIN_T2_BALANCE',
        34 => 'PALADIN_T3_BALANCE',
        35 => 'WHEAT_BALANCE',
        36 => 'FISH_BALANCE',
        37 => 'LORDS_BALANCE',
        38 => 'ESSENCE_BALANCE',
        39 => 'RELIC_E1_BALANCE',
        40 => 'RELIC_E2_BALANCE',
        41 => 'RELIC_E3_BALANCE',
        42 => 'RELIC_E4_BALANCE',
        43 => 'RELIC_E5_BALANCE',
        44 => 'RELIC_E6_BALANCE',
        45 => 'RELIC_E7_BALANCE',
        46 => 'RELIC_E8_BALANCE',
        47 => 'RELIC_E9_BALANCE',
        48 => 'RELIC_E10_BALANCE',
        49 => 'RELIC_E11_BALANCE',
        50 => 'RELIC_E12_BALANCE',
        51 => 'RELIC_E13_BALANCE',
        52 => 'RELIC_E14_BALANCE',
        53 => 'RELIC_E15_BALANCE',
        54 => 'RELIC_E16_BALANCE',
        55 => 'RELIC_E17_BALANCE',
        56 => 'RELIC_E18_BALANCE',
        57 => 'RESEARCH_BALANCE',
        58 => 'SATOSHI_BALANCE',
        _ => panic!("invalid resource type"),
    }
}

fn production_member(resource_type: u8) -> felt252 {
    match resource_type {
        1 => 'STONE_PRODUCTION',
        2 => 'COAL_PRODUCTION',
        3 => 'WOOD_PRODUCTION',
        4 => 'COPPER_PRODUCTION',
        5 => 'IRONWOOD_PRODUCTION',
        6 => 'OBSIDIAN_PRODUCTION',
        7 => 'GOLD_PRODUCTION',
        8 => 'SILVER_PRODUCTION',
        9 => 'MITHRAL_PRODUCTION',
        10 => 'ALCHEMICAL_SILVER_PRODUCTION',
        11 => 'COLD_IRON_PRODUCTION',
        12 => 'DEEP_CRYSTAL_PRODUCTION',
        13 => 'RUBY_PRODUCTION',
        14 => 'DIAMONDS_PRODUCTION',
        15 => 'HARTWOOD_PRODUCTION',
        16 => 'IGNIUM_PRODUCTION',
        17 => 'TWILIGHT_QUARTZ_PRODUCTION',
        18 => 'TRUE_ICE_PRODUCTION',
        19 => 'ADAMANTINE_PRODUCTION',
        20 => 'SAPPHIRE_PRODUCTION',
        21 => 'ETHEREAL_SILICA_PRODUCTION',
        22 => 'DRAGONHIDE_PRODUCTION',
        23 => 'LABOR_PRODUCTION',
        24 => 'EARTHEN_SHARD_PRODUCTION',
        25 => 'DONKEY_PRODUCTION',
        26 => 'KNIGHT_T1_PRODUCTION',
        27 => 'KNIGHT_T2_PRODUCTION',
        28 => 'KNIGHT_T3_PRODUCTION',
        29 => 'CROSSBOWMAN_T1_PRODUCTION',
        30 => 'CROSSBOWMAN_T2_PRODUCTION',
        31 => 'CROSSBOWMAN_T3_PRODUCTION',
        32 => 'PALADIN_T1_PRODUCTION',
        33 => 'PALADIN_T2_PRODUCTION',
        34 => 'PALADIN_T3_PRODUCTION',
        35 => 'WHEAT_PRODUCTION',
        36 => 'FISH_PRODUCTION',
        37 => 'LORDS_PRODUCTION',
        38 => 'ESSENCE_PRODUCTION',
        57 => 'RESEARCH_PRODUCTION',
        58 => 'SATOSHI_PRODUCTION',
        _ => panic!("resource has no production"),
    }
}

#[starknet::component]
pub mod ResourceState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowMemberSet, RowSet};
    use super::{Production, Resource, ResourceKey, Weight, add, balance_member, production_member, settle, spend};
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
        RowMemberSet: RowMemberSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn destroy(ref self: ComponentState<TContractState>, key: ResourceKey) {
            self.assert_exists(key);
            for resource_type in 1_u8..59 {
                self.balances.write((key.game_id, key.entity_id, resource_type), 0);
                if resource_type < 39 || resource_type > 56 {
                    self.productions.write((key.game_id, key.entity_id, resource_type), Default::default());
                }
            }
            self.weights.write((key.game_id, key.entity_id), Default::default());
            self.resource_exists.write((key.game_id, key.entity_id), false);
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowDeleted { version: 1, model: 'Resource', keys: keys.span() });
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
            let mut resource: Resource = Default::default();
            resource.weight = weight;
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            resource.serialize(ref values);
            self.emit(RowSet { version: 1, model: 'Resource', keys: keys.span(), values: values.span() });
        }
        #[inline(never)]
        fn assert_exists(self: @ComponentState<TContractState>, key: ResourceKey) {
            assert!(self.resource_exists.read((key.game_id, key.entity_id)), "missing resource owner");
        }
        #[inline(never)]
        fn balance(self: @ComponentState<TContractState>, key: ResourceKey, resource_type: u8) -> u128 {
            self.assert_exists(key);
            let _ = balance_member(resource_type);
            self.balances.read((key.game_id, key.entity_id, resource_type))
        }
        #[inline(never)]
        fn production(self: @ComponentState<TContractState>, key: ResourceKey, resource_type: u8) -> Production {
            self.assert_exists(key);
            let _ = production_member(resource_type);
            self.productions.read((key.game_id, key.entity_id, resource_type))
        }
        fn resource(self: @ComponentState<TContractState>, key: ResourceKey) -> Resource {
            self.assert_exists(key);
            // Materialize in wire order to avoid keeping every resource member live on the stack.
            let mut values = array![];
            for resource_type in 1_u8..59 {
                self.balance(key, resource_type).serialize(ref values);
            }
            self.weights.read((key.game_id, key.entity_id)).serialize(ref values);
            for resource_type in 1_u8..39 {
                self.production(key, resource_type).serialize(ref values);
            }
            self.production(key, 57).serialize(ref values);
            self.production(key, 58).serialize(ref values);
            let mut serialized = values.span();
            Serde::<Resource>::deserialize(ref serialized).expect('invalid resource projection')
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
            self.balances.write((key.game_id, key.entity_id, resource_type), balance);
            self.emit_member(key, balance_member(resource_type), array![balance.into()].span());
        }
        #[inline(never)]
        fn write_production(
            ref self: ComponentState<TContractState>, key: ResourceKey, resource_type: u8, production: Production,
        ) {
            // The pinned resource store never persists a LORDS production record.
            if resource_type == 37 {
                return;
            }
            self.productions.write((key.game_id, key.entity_id, resource_type), production);
            let mut values = array![];
            production.serialize(ref values);
            self.emit_member(key, production_member(resource_type), values.span());
        }
        #[inline(never)]
        fn write_weight(ref self: ComponentState<TContractState>, key: ResourceKey, weight: Weight) {
            self.weights.write((key.game_id, key.entity_id), weight);
            let mut values = array![];
            weight.serialize(ref values);
            self.emit_member(key, 'weight', values.span());
        }
        #[inline(never)]
        fn emit_member(
            ref self: ComponentState<TContractState>, key: ResourceKey, member: felt252, values: Span<felt252>,
        ) {
            let mut keys = array![];
            key.serialize(ref keys);
            self.emit(RowMemberSet { version: 1, model: 'Resource', member, keys: keys.span(), values });
        }
    }
}

pub fn settle(
    resource_type: u8, ref balance: u128, ref production: Production, ref weight: Weight, unit_weight: u128, now: u32,
) {
    let start_at = production.last_updated_at;
    production.last_updated_at = now;
    if resource_type == 37 || production.building_count == 0 {
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
