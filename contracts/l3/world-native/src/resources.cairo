use crate::rules::RESOURCE_PRECISION;

pub const LORDS: u8 = 37;
pub const UNLIMITED_OUTPUT: u128 = 0xffffffffffffffffffffffffffffffff;
pub const RESOURCE_RATE_SCALE: u128 = 0x10000000000000000;
pub(crate) const FIRST_TROOP_RESOURCE: u8 = 26;
pub(crate) const LAST_TROOP_RESOURCE: u8 = 34;

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
pub(crate) struct SettledResource {
    pub(crate) balance: u128,
    pub(crate) production: Production,
    pub(crate) weight: Weight,
}

pub(crate) fn assert_resource(resource_type: u8) {
    assert!(resource_type > 0 && resource_type <= 58, "invalid resource type");
}

pub(crate) fn assert_production(resource_type: u8) {
    assert_resource(resource_type);
    assert!(resource_type < 39 || resource_type > 56, "resource has no production");
}

pub(crate) fn has_production(resource_type: u8) -> bool {
    resource_type != LORDS && (resource_type < 39 || resource_type > 56)
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

pub(crate) fn add(resource_type: u8, ref balance: u128, ref weight: Weight, amount: u128, unit_weight: u128) -> u128 {
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

pub(crate) fn spend(resource_type: u8, ref balance: u128, ref weight: Weight, amount: u128, unit_weight: u128) {
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
pub trait IResourceOperations<T> {
    fn redirect_production(
        ref self: T,
        key: ResourceKey,
        resource_type: u8,
        receiver: ProductionReceiver,
        rate: u64,
        timestamp: u64,
        game_context: crate::commands::ResourceContext,
    );
    fn initialize_resources(
        ref self: T,
        key: ResourceKey,
        capacity: u128,
        category: u8,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
    fn initialize_explorer_resources(
        ref self: T, key: ResourceKey, amount: u128, game_context: crate::commands::ResourceContext,
    );
    fn destroy_resources(ref self: T, key: ResourceKey);
    fn change_explorer_capacity(
        ref self: T, key: ResourceKey, amount: u128, increase: bool, game_context: crate::commands::ResourceContext,
    );
    fn grant_resource(
        ref self: T,
        key: ResourceKey,
        resource_type: u8,
        amount: u128,
        timestamp: u64,
        game_context: crate::commands::ResourceContext,
    ) -> u128;
    fn spend_resource(
        ref self: T,
        key: ResourceKey,
        resource_type: u8,
        amount: u128,
        timestamp: u64,
        game_context: crate::commands::ResourceContext,
    );
    fn start_production(
        ref self: T,
        key: ResourceKey,
        resource_type: u8,
        rate: u64,
        output: u128,
        timestamp: u64,
        game_context: crate::commands::ResourceContext,
    );
    fn stop_production(
        ref self: T,
        key: ResourceKey,
        resource_type: u8,
        rate: u64,
        timestamp: u64,
        game_context: crate::commands::ResourceContext,
    );
    fn change_structure_capacity(ref self: T, key: ResourceKey, amount: u128, adding: bool);
    fn spend_food(
        ref self: T,
        key: ResourceKey,
        wheat: u128,
        fish: u128,
        timestamp: u64,
        game_context: crate::commands::ResourceContext,
    );
    fn spend_spire_fee(ref self: T, key: ResourceKey, timestamp: u64, game_context: crate::commands::ResourceContext);
}
