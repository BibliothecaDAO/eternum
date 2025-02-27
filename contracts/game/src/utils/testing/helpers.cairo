use cubit::f128::types::fixed::{FixedTrait};
use dojo::model::{ModelStorageTest};
use dojo::world::{IWorldDispatcherTrait};
use dojo::world::{WorldStorage};
use dojo_cairo_test::{ContractDef, NamespaceDef, WorldStorageTestTrait, spawn_test_world};

use s1_eternum::alias::ID;
use s1_eternum::constants::{ResourceTypes};
use s1_eternum::models::config::{
    CapacityConfig, LaborBurnPrStrategy, MapConfig, MultipleResourceBurnPrStrategy, ProductionConfig, TickConfig,
    TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig, WeightConfig, WorldConfigUtilImpl,
};
use s1_eternum::models::position::{Coord};
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, StructureSingleResourceFoodImpl, WeightStoreImpl,
};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::realm::contracts::realm_systems::{InternalRealmLogicImpl};

pub fn MOCK_MAP_CONFIG() -> MapConfig {
    MapConfig {
        reward_resource_amount: 750,
        shards_mines_fail_probability: 5000,
        mine_wheat_grant_amount: 0,
        mine_fish_grant_amount: 1,
    }
}

pub fn MOCK_TROOP_DAMAGE_CONFIG() -> TroopDamageConfig {
    TroopDamageConfig {
        t1_damage_value: 1844674407370955161600, // 100
        t2_damage_multiplier: 46116860184273879040, // 2.5
        t3_damage_multiplier: 129127208515966861312, // 7
        damage_biome_bonus_num: 3_000, // 30% // percentage bonus for biome damage
        damage_scaling_factor: 64563604257983430656, // 3.5
        damage_beta_small: 4611686018427387904, // 0.25
        damage_beta_large: 2213609288845146193, // 0.12
        damage_c0: 100_000 * FixedTrait::ONE().mag,
        damage_delta: 50_000 * FixedTrait::ONE().mag,
    }
}

pub fn MOCK_TROOP_STAMINA_CONFIG() -> TroopStaminaConfig {
    TroopStaminaConfig {
        stamina_gain_per_tick: 20,
        stamina_initial: 20,
        stamina_bonus_value: 20, // stamina biome bonus (defaults to stamina per tick)
        stamina_knight_max: 120,
        stamina_paladin_max: 120,
        stamina_crossbowman_max: 140,
        stamina_attack_req: 30,
        stamina_attack_max: 60,
        stamina_explore_wheat_cost: 2,
        stamina_explore_fish_cost: 1,
        stamina_explore_stamina_cost: 30, // 30 stamina per hex
        stamina_travel_wheat_cost: 2,
        stamina_travel_fish_cost: 1,
        stamina_travel_stamina_cost: 20 // 20 stamina per hex 
    }
}

pub fn MOCK_TROOP_LIMIT_CONFIG() -> TroopLimitConfig {
    TroopLimitConfig {
        explorer_max_party_count: 20, // hard max of explorers per structure
        explorer_guard_max_troop_count: 500_000, // hard max of troops per party
        guard_resurrection_delay: 24 * 60 * 60, // delay in seconds before a guard can be resurrected
        mercenaries_troop_lower_bound: 100_000, // min of troops per mercenary
        mercenaries_troop_upper_bound: 500_000 // max of troops per mercenary
    }
}

pub fn MOCK_CAPACITY_CONFIG() -> CapacityConfig {
    CapacityConfig {
        structure_capacity: 1000000000000000, // grams
        troop_capacity: 100000000, // grams
        donkey_capacity: 10000000, // grams
        storehouse_boost_capacity: 10000,
    }
}

pub fn MOCK_WEIGHT_CONFIG(resource_type: u8) -> WeightConfig {
    WeightConfig { resource_type, weight_gram: 100 }
}

pub fn MOCK_TICK_CONFIG() -> TickConfig {
    TickConfig { armies_tick_in_seconds: 1 }
}

pub fn MOCK_LABOR_BURN_STRATEGY() -> LaborBurnPrStrategy {
    LaborBurnPrStrategy {
        resource_rarity: 0,
        wheat_burn_per_labor: 0,
        fish_burn_per_labor: 0,
        depreciation_percent_num: 0,
        depreciation_percent_denom: 0,
    }
}


pub fn MOCK_MULTIPLE_RESOURCE_BURN_STRATEGY() -> MultipleResourceBurnPrStrategy {
    MultipleResourceBurnPrStrategy { required_resources_id: 0, required_resources_count: 0 }
}

pub fn MOCK_PRODUCTION_CONFIG(
    resource_type: u8,
    produced_amount: u128,
    labor_burn_strategy: LaborBurnPrStrategy,
    multiple_resource_burn_strategy: MultipleResourceBurnPrStrategy,
) -> ProductionConfig {
    ProductionConfig {
        resource_type,
        amount_per_building_per_tick: produced_amount,
        labor_burn_strategy,
        multiple_resource_burn_strategy,
    }
}

pub fn MOCK_DEFAULT_PRODUCTION_CONFIG(resource_type: u8) -> ProductionConfig {
    ProductionConfig {
        resource_type,
        amount_per_building_per_tick: 100,
        labor_burn_strategy: LaborBurnPrStrategy {
            resource_rarity: 0,
            wheat_burn_per_labor: 0,
            fish_burn_per_labor: 0,
            depreciation_percent_num: 0,
            depreciation_percent_denom: 0,
        },
        multiple_resource_burn_strategy: MultipleResourceBurnPrStrategy {
            required_resources_id: 0, required_resources_count: 0,
        },
    }
}


pub fn tstore_map_config(ref world: WorldStorage, config: MapConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("map_config"), config);
}

pub fn tstore_capacity_config(ref world: WorldStorage, capacity_config: CapacityConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("capacity_config"), capacity_config);
}

pub fn tstore_weight_config(ref world: WorldStorage, weight_configs: Span<WeightConfig>) {
    for weight_config in weight_configs {
        world.write_model_test(weight_config);
    }
}


pub fn tstore_tick_config(ref world: WorldStorage, tick_config: TickConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("tick_config"), tick_config);
}

pub fn tstore_troop_limit_config(ref world: WorldStorage, troop_limit_config: TroopLimitConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("troop_limit_config"), troop_limit_config);
}

pub fn tstore_troop_stamina_config(ref world: WorldStorage, troop_stamina_config: TroopStaminaConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("troop_stamina_config"), troop_stamina_config);
}

pub fn tstore_troop_damage_config(ref world: WorldStorage, troop_damage_config: TroopDamageConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("troop_damage_config"), troop_damage_config);
}

pub fn tgrant_resources(ref world: WorldStorage, to: ID, resources: Span<(u8, u128)>) {
    let mut to_weight: Weight = WeightStoreImpl::retrieve(ref world, to);
    for (resource_type, amount) in resources {
        let (resource_type, amount) = (*resource_type, *amount);
        let resource_weight_grams: u128 = ResourceWeightImpl::grams(ref world, resource_type);
        let mut resource = SingleResourceStoreImpl::retrieve(
            ref world, to, resource_type, ref to_weight, resource_weight_grams, true,
        );
        resource.add(amount, ref to_weight, resource_weight_grams);
        resource.store(ref world);
    };

    to_weight.store(ref world, to);
}


pub fn tspawn_world(namespace_def: NamespaceDef, contract_defs: Span<ContractDef>) -> WorldStorage {
    let mut world = spawn_test_world([namespace_def].span());
    world.sync_perms_and_inits(contract_defs);
    world.dispatcher.uuid();
    world
}


pub fn tstore_production_config(ref world: WorldStorage, production_config: ProductionConfig) {
    world.write_model_test(@production_config);
}


pub fn tspawn_simple_realm(
    ref world: WorldStorage, realm_id: ID, owner: starknet::ContractAddress, coord: Coord,
) -> ID {
    // set labor production config
    tstore_production_config(ref world, MOCK_DEFAULT_PRODUCTION_CONFIG(ResourceTypes::LABOR));

    // set earthen shard production config
    tstore_production_config(ref world, MOCK_DEFAULT_PRODUCTION_CONFIG(ResourceTypes::EARTHEN_SHARD));

    // create realm
    let realm_entity_id = InternalRealmLogicImpl::create_realm(
        ref world, owner, realm_id, array![], 1, 0, 1, coord.into(),
    );

    realm_entity_id
}


pub fn tspawn_realm(
    ref world: WorldStorage,
    owner: starknet::ContractAddress,
    realm_id: ID,
    order: u8,
    produced_resources: Array<u8>,
    level: u8,
    wonder: u8,
    coord: Coord,
) -> ID {
    // create realm
    let realm_entity_id = InternalRealmLogicImpl::create_realm(
        ref world, owner, realm_id, produced_resources, order, level, wonder, coord.into(),
    );

    realm_entity_id
}
