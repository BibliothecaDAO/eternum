//! Snforge Test Helpers for dojo_snf_test based tests
//!
//! This module provides reusable test utilities for snforge tests that use dojo_snf_test.
//! It complements the existing helpers.cairo which is designed for dojo_cairo_test (sozo test).
//!
//! Key differences from helpers.cairo:
//! - Uses snforge cheatcodes (start_cheat_caller_address, etc.) instead of starknet::testing
//! - Uses dojo_snf_test::spawn_test_world instead of dojo_cairo_test
//! - Provides higher-level test fixtures for common battle test scenarios
//!
//! Note: TrophyProgression events are now supported - the event is declared via build-external-contracts.

use cubit::f128::types::fixed::FixedTrait;
use dojo::model::{ModelStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
use dojo_snf_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait, spawn_test_world};
use snforge_std::{
    start_cheat_block_timestamp_global, start_cheat_caller_address, start_cheat_chain_id_global,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use starknet::syscalls::deploy_syscall;
use crate::alias::ID;
use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
use crate::models::config::{
    CapacityConfig, CombatConfigImpl, MapConfig, QuestConfig, ResourceFactoryConfig, StructureCapacityConfig,
    TickConfig, TickImpl, TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig, VillageTokenConfig, WeightConfig,
    WorldConfigUtilImpl,
};
use crate::models::map::{Tile, TileImpl, TileOccupier};
use crate::models::map2::TileOpt;
use crate::models::position::{Coord, CoordTrait, Direction};
use crate::models::quest::QuestTile;
use crate::models::resource::resource::{
    ResourceImpl, ResourceList, ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
};
use crate::models::stamina::{Stamina, StaminaImpl, StaminaTrait};
use crate::models::structure::{Structure, StructureBase, StructureCategory, StructureMetadata, StructureVillageSlots};
use crate::models::troop::{
    ExplorerTroops, GuardSlot, GuardTroops, TroopBoosts, TroopLimitTrait, TroopTier, TroopType, Troops,
};
use crate::models::weight::Weight;
use crate::systems::combat::contracts::troop_battle::{
    ITroopBattleSystemsDispatcher, ITroopBattleSystemsDispatcherTrait,
};
use crate::systems::combat::contracts::troop_management::{
    ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait,
};
use crate::systems::combat::contracts::troop_movement::{
    ITroopMovementSystemsDispatcher, ITroopMovementSystemsDispatcherTrait,
};
// use crate::systems::quest::constants::QUEST_REWARD_BASE_MULTIPLIER;
use crate::systems::utils::realm::iRealmImpl;
use crate::utils::testing::contracts::villagepassmock::EternumVillagePassMock;


// ============================================================================
// Mock Village Pass Deployment
// ============================================================================

fn deploy_mock_village_pass(ref world: WorldStorage, admin: starknet::ContractAddress) -> ContractAddress {
    let mock_calldata: Array<felt252> = array![
        admin.into(), admin.into(), starknet::get_contract_address().into(), 2, starknet::get_contract_address().into(),
        admin.into(),
    ];
    let salt = core::testing::get_available_gas();
    let (mock_village_pass_address, _) = deploy_syscall(
        EternumVillagePassMock::TEST_CLASS_HASH, salt.into(), mock_calldata.span(), false,
    )
        .unwrap();
    mock_village_pass_address
}


// ============================================================================
// Mock Config Functions
// ============================================================================

pub fn MOCK_VILLAGE_TOKEN_CONFIG(ref world: WorldStorage, admin: starknet::ContractAddress) -> VillageTokenConfig {
    VillageTokenConfig { mint_recipient_address: admin, token_address: deploy_mock_village_pass(ref world, admin) }
}

pub fn MOCK_MAP_CONFIG() -> MapConfig {
    MapConfig {
        reward_resource_amount: 750,
        shards_mines_win_probability: 5000,
        shards_mines_fail_probability: 5000,
        hyps_win_prob: 5000,
        hyps_fail_prob: 5000,
        hyps_fail_prob_increase_p_hex: 5000,
        hyps_fail_prob_increase_p_fnd: 5000,
        agent_discovery_prob: 5000,
        agent_discovery_fail_prob: 5000,
        relic_chest_relics_per_chest: 3,
        relic_hex_dist_from_center: 10,
        relic_discovery_interval_sec: 60,
        village_fail_probability: 1,
        village_win_probability: 0,
    }
}

pub fn MOCK_TROOP_DAMAGE_CONFIG() -> TroopDamageConfig {
    TroopDamageConfig {
        t1_damage_value: 1844674407370955161600, // 100
        t2_damage_multiplier: 46116860184273879040, // 2.5
        t3_damage_multiplier: 129127208515966861312, // 7
        damage_biome_bonus_num: 3_000, // 30% // percentage bonus for biome damage
        damage_scaling_factor: 55340232221128654848, // 3
        damage_beta_small: 4611686018427387904, // 0.25
        damage_beta_large: 2213609288845146193, // 0.12
        damage_c0: 100_000 * FixedTrait::ONE().mag,
        damage_delta: 50_000 * FixedTrait::ONE().mag,
        damage_raid_percent_num: 5 // Added default value
    }
}

pub fn MOCK_TROOP_STAMINA_CONFIG() -> TroopStaminaConfig {
    TroopStaminaConfig {
        stamina_gain_per_tick: 20,
        stamina_initial: 100,
        stamina_bonus_value: 20, // stamina biome bonus (defaults to stamina per tick)
        stamina_knight_max: 120,
        stamina_paladin_max: 120,
        stamina_crossbowman_max: 140,
        stamina_attack_req: 50,
        stamina_defense_req: 60,
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
        guard_resurrection_delay: 24, // delay in ticks before a guard can be resurrected
        mercenaries_troop_lower_bound: 800, // min of troops per mercenary
        mercenaries_troop_upper_bound: 1_600, // max of troops per mercenary
        agents_troop_lower_bound: 500, // min of troops per agent
        agents_troop_upper_bound: 15_000, // max of troops per agent
        settlement_deployment_cap: 6_000,
        city_deployment_cap: 30_000,
        kingdom_deployment_cap: 90_000,
        empire_deployment_cap: 180_000,
        t1_tier_strength: 1,
        t2_tier_strength: 3,
        t3_tier_strength: 9,
        t1_tier_modifier: 50,
        t2_tier_modifier: 100,
        t3_tier_modifier: 150,
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

pub fn MOCK_STRUCTURE_CAPACITY_CONFIG() -> StructureCapacityConfig {
    StructureCapacityConfig {
        realm_capacity: 1000000000000000, // grams
        village_capacity: 1000000000000000, // grams
        hyperstructure_capacity: 1000000000000000, // grams
        fragment_mine_capacity: 1000000000000000, // grams
        bank_structure_capacity: 1000000000000000 // grams
    }
}

pub fn MOCK_WEIGHT_CONFIG(resource_type: u8) -> WeightConfig {
    WeightConfig { resource_type, weight_gram: 100 }
}

pub fn MOCK_TICK_CONFIG() -> TickConfig {
    TickConfig { armies_tick_in_seconds: 1, delivery_tick_in_seconds: 1 }
}

pub fn MOCK_QUEST_CONFIG() -> QuestConfig {
    QuestConfig { quest_discovery_prob: 5000, quest_discovery_fail_prob: 5000 }
}


// ============================================================================
// Config Store Functions (tstore_*)
// ============================================================================

pub fn tstore_village_token_config(ref world: WorldStorage, config: VillageTokenConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("village_pass_config"), config);
}

pub fn tstore_map_config(ref world: WorldStorage, config: MapConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("map_config"), config);
}

pub fn tstore_capacity_config(ref world: WorldStorage, capacity_config: CapacityConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("capacity_config"), capacity_config);
}

pub fn tstore_structure_capacity_config(ref world: WorldStorage, structure_capacity_config: StructureCapacityConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("structure_capacity_config"), structure_capacity_config);
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

pub fn tstore_quest_config(ref world: WorldStorage, config: QuestConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("quest_config"), config);
}

pub fn tstore_production_config(ref world: WorldStorage, resource_type: u8) {
    let simple_input_list: Array<(u8, u128)> = array![(ResourceTypes::LABOR, 1)];
    let simple_input_list_id = world.dispatcher.uuid();
    for i in 0..simple_input_list.len() {
        let (resource_type, resource_amount) = *simple_input_list.at(i);
        world
            .write_model_test(
                @ResourceList { entity_id: simple_input_list_id, index: i, resource_type, amount: resource_amount },
            );
    }

    let complex_input_list: Array<(u8, u128)> = array![(ResourceTypes::WOOD, 1)];
    let complex_input_list_id = world.dispatcher.uuid();
    for i in 0..complex_input_list.len() {
        let (resource_type, resource_amount) = *complex_input_list.at(i);
        world
            .write_model_test(
                @ResourceList { entity_id: complex_input_list_id, index: i, resource_type, amount: resource_amount },
            );
    }
    // save production config
    let mut resource_factory_config: ResourceFactoryConfig = Default::default();
    resource_factory_config.resource_type = resource_type;
    resource_factory_config.realm_output_per_second = 2;
    resource_factory_config.village_output_per_second = 1;

    resource_factory_config.labor_output_per_resource = 1;

    resource_factory_config.output_per_simple_input = 1;
    resource_factory_config.simple_input_list_id = simple_input_list_id;
    resource_factory_config.simple_input_list_count = simple_input_list.len().try_into().unwrap();
    resource_factory_config.output_per_complex_input = 1;
    resource_factory_config.complex_input_list_id = complex_input_list_id;
    resource_factory_config.complex_input_list_count = complex_input_list.len().try_into().unwrap();
    world.write_model_test(@resource_factory_config);
}


// ============================================================================
// Resource Grant Helper
// ============================================================================

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
    }

    to_weight.store(ref world, to);
}


// ============================================================================
// Init Config Helpers
// ============================================================================

pub fn init_config(ref world: WorldStorage) {
    tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
    tstore_structure_capacity_config(ref world, MOCK_STRUCTURE_CAPACITY_CONFIG());
    tstore_tick_config(ref world, MOCK_TICK_CONFIG());
    tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
    tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
    tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
    tstore_weight_config(
        ref world,
        array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1), MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T2),
            MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT), MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
        ]
            .span(),
    );
    tstore_map_config(ref world, MOCK_MAP_CONFIG());
    tstore_quest_config(ref world, MOCK_QUEST_CONFIG());
    tstore_village_token_config(
        ref world, MOCK_VILLAGE_TOKEN_CONFIG(ref world, starknet::contract_address_const::<'realm_owner'>()),
    );
}

/// Initialize only troop-related configs (for guard/explorer tests)
pub fn init_troop_config(ref world: WorldStorage) {
    tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
    tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
    tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
}

/// Initialize resource/capacity configs
pub fn init_resource_config(ref world: WorldStorage) {
    tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
    tstore_structure_capacity_config(ref world, MOCK_STRUCTURE_CAPACITY_CONFIG());
    tstore_weight_config(
        ref world,
        array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1), MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T2),
            MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT), MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
        ]
            .span(),
    );
}

/// Initialize minimal config for guard tests (most common test type)
/// Skips: map_config, quest_config, village_token_config
pub fn init_guard_test_config(ref world: WorldStorage) {
    init_troop_config(ref world);
    init_resource_config(ref world);
    tstore_tick_config(ref world, MOCK_TICK_CONFIG());
}

/// Initialize config for explorer tests (slightly more than guard tests)
pub fn init_explorer_test_config(ref world: WorldStorage) {
    init_guard_test_config(ref world);
    tstore_map_config(ref world, MOCK_MAP_CONFIG());
}


// ============================================================================
// Entity Spawn Helpers
// ============================================================================

pub fn tspawn_simple_realm(
    ref world: WorldStorage, realm_id: ID, owner: starknet::ContractAddress, coord: Coord,
) -> ID {
    tstore_production_config(ref world, ResourceTypes::LABOR);
    tstore_production_config(ref world, ResourceTypes::EARTHEN_SHARD);

    // create realm
    let realm_entity_id = iRealmImpl::create_realm(ref world, owner, realm_id, array![], 1, 0, 1, coord.into(), true);

    realm_entity_id
}

pub fn tspawn_realm_with_resources(
    ref world: WorldStorage, realm_id: ID, owner: starknet::ContractAddress, coord: Coord,
) -> ID {
    let realm_entity_id = tspawn_simple_realm(ref world, realm_id, owner, coord);

    let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;
    let wheat_amount: u128 = 10000000000000000;
    let fish_amount: u128 = 5000000000000000;
    tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::CROSSBOWMAN_T2, troop_amount)].span());
    tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::WHEAT, wheat_amount)].span());
    tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::FISH, fish_amount)].span());

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
    let realm_entity_id = iRealmImpl::create_realm(
        ref world, owner, realm_id, produced_resources, order, level, wonder, coord.into(), true,
    );

    realm_entity_id
}

pub fn tspawn_explorer(ref world: WorldStorage, owner: ID, coord: Coord) -> ID {
    let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
    let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;
    let troop_boosts = TroopBoosts {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_tick_count: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
    };
    let mut troops = Troops {
        category: TroopType::Crossbowman,
        tier: TroopTier::T2,
        count: troop_amount,
        stamina: Default::default(),
        boosts: troop_boosts,
        battle_cooldown_end: 0,
    };
    let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
    troops.stamina.refill(ref troops.boosts, troops.category, troops.tier, troop_stamina_config, current_tick);
    let explorer_id = world.dispatcher.uuid();
    let explorer: ExplorerTroops = ExplorerTroops { explorer_id, coord, troops, owner };
    world.write_model_test(@explorer);
    explorer_id
}

// pub fn tspawn_quest_tile(
//     ref world: WorldStorage, game_address: ContractAddress, level: u8, capacity: u16, coord: Coord,
// ) -> @QuestTile {
//     let id = world.dispatcher.uuid();
//     let resource_type = ResourceTypes::WHEAT;
//     let amount = MOCK_MAP_CONFIG().reward_resource_amount.into()
//         * QUEST_REWARD_BASE_MULTIPLIER.into()
//         * RESOURCE_PRECISION
//         * (level + 1).into();
//     let quest_details = @QuestTile {
//         id, coord, game_address, level, resource_type, amount, capacity, participant_count: 0,
//     };
//     world.write_model_test(quest_details);
//     quest_details
// }

pub fn tspawn_village_explorer(ref world: WorldStorage, village_id: ID, coord: Coord) -> ID {
    let mut uuid = world.dispatcher.uuid();
    let explorer_id = uuid;

    let troop_amount = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;
    let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
    let current_tick = starknet::get_block_timestamp();

    let troop_boosts = TroopBoosts {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_tick_count: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
    };
    let mut initial_troops = Troops {
        category: TroopType::Crossbowman,
        tier: TroopTier::T2,
        count: troop_amount,
        stamina: Default::default(),
        boosts: troop_boosts,
        battle_cooldown_end: 0,
    };
    initial_troops
        .stamina
        .refill(
            ref initial_troops.boosts, initial_troops.category, initial_troops.tier, troop_stamina_config, current_tick,
        );

    // Spawn explorer troops model
    let explorer = ExplorerTroops {
        explorer_id: explorer_id,
        owner: village_id, // Explorer owned by the village
        troops: initial_troops,
        coord: coord,
    };
    world.write_model_test(@explorer);

    explorer_id
}

pub fn tspawn_village(ref world: WorldStorage, realm_id: ID, owner: ContractAddress, coord: Coord) -> ID {
    let tile_opt: TileOpt = world.read_model((coord.alt, coord.x, coord.y));
    let tile: Tile = tile_opt.into();
    assert!(tile.occupier_id == 0, "Can't spawn village on occupied tile");

    let mut uuid = world.dispatcher.uuid();
    let village_id = uuid;

    let troop_boosts = TroopBoosts {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_tick_count: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
    };
    let basic_troops = Troops {
        category: TroopType::Crossbowman,
        tier: TroopTier::T2,
        count: 100 * RESOURCE_PRECISION,
        stamina: Default::default(),
        boosts: troop_boosts,
        battle_cooldown_end: 0,
    };

    // Spawn the village structure
    let mut structure = Structure {
        entity_id: village_id,
        owner: owner,
        base: StructureBase {
            troop_guard_count: 0,
            troop_explorer_count: 0,
            troop_max_guard_count: 4, // Default max guards
            troop_max_explorer_count: 20,
            created_at: starknet::get_block_timestamp().try_into().unwrap(),
            category: StructureCategory::Village.into(),
            coord_x: coord.x,
            coord_y: coord.y,
            level: 1,
        },
        troop_guards: GuardTroops { // Initialize empty guards
            delta: basic_troops,
            charlie: basic_troops,
            bravo: basic_troops,
            alpha: basic_troops,
            delta_destroyed_tick: 0,
            charlie_destroyed_tick: 0,
            bravo_destroyed_tick: 0,
            alpha_destroyed_tick: 0,
        },
        troop_explorers: array![].span(), // Start with no explorers
        resources_packed: 0, // Start with no resources packed
        metadata: StructureMetadata {
            realm_id: 0, // Village doesn't have its own realm_id here
            order: 0, // Not applicable to village
            has_wonder: false,
            villages_count: 0, // Not applicable to village itself
            village_realm: realm_id // Link to the parent realm
        },
        category: StructureCategory::Village.into(),
    };
    world.write_model_test(@structure);

    let realm_coord = Coord { alt: false, x: 0, y: 0 };

    let structure_village_slots = StructureVillageSlots {
        connected_realm_entity_id: realm_id,
        connected_realm_id: 0, // Assuming realm_id can be converted or fetched
        connected_realm_coord: realm_coord, // Need actual realm coord
        directions_left: array![].span(),
    };
    world.write_model_test(@structure_village_slots);

    // Ensure the tile is marked as occupied by the village
    let tile_opt: TileOpt = world.read_model((coord.alt, coord.x, coord.y));
    let mut tile: Tile = tile_opt.into();
    tile.occupier_type = TileOccupier::Village.into();
    tile.occupier_id = village_id;
    tile.occupier_is_structure = true;
    let updated_tile_opt: TileOpt = tile.into();
    world.write_model_test(@updated_tile_opt);

    village_id
}


// ============================================================================
// Namespace and Contract Definitions
// ============================================================================

/// Minimal namespace for basic model tests (no contracts)
pub fn namespace_def_minimal() -> NamespaceDef {
    NamespaceDef {
        namespace: DEFAULT_NS_STR(),
        resources: [
            TestResource::Model("WorldConfig"), TestResource::Model("Structure"), TestResource::Model("ExplorerTroops"),
        ]
            .span(),
    }
}

/// Full namespace with all models and contracts needed for combat tests
pub fn namespace_def_combat() -> NamespaceDef {
    NamespaceDef {
        namespace: DEFAULT_NS_STR(),
        resources: [
            // Core config models
            TestResource::Model("WorldConfig"), TestResource::Model("WeightConfig"), // Structure models
            TestResource::Model("Structure"), TestResource::Model("StructureOwnerStats"),
            TestResource::Model("StructureVillageSlots"), TestResource::Model("StructureBuildings"),
            TestResource::Model("Building"), // Troop models
            TestResource::Model("ExplorerTroops"), // Map models
            TestResource::Model("TileOpt"), TestResource::Model("BiomeDiscovered"),
            TestResource::Model("Wonder"), // Resource models
            TestResource::Model("Resource"),
            TestResource::Model("ResourceList"), TestResource::Model("ResourceFactoryConfig"),
            // Contracts
            TestResource::Contract("troop_management_systems"), TestResource::Contract("troop_movement_systems"),
            TestResource::Contract("troop_battle_systems"), TestResource::Contract("village_systems"),
            TestResource::Contract("realm_internal_systems"), TestResource::Contract("resource_systems"),
            // Libraries
            TestResource::Library(("structure_creation_library", "0_1_11")),
            TestResource::Library(("biome_library", "0_1_11")), TestResource::Library(("rng_library", "0_1_11")),
            TestResource::Library(
                ("combat_library", "0_1_11"),
            ), // Events - TrophyProgression is from achievement crate, declared via build-external-contracts
            TestResource::Event("StoryEvent"), TestResource::Event("ExplorerMoveEvent"),
            TestResource::Event("BattleEvent"), TestResource::Event("TrophyProgression"),
        ]
            .span(),
    }
}

/// Contract definitions with namespace write permissions
pub fn contract_defs_combat() -> Span<ContractDef> {
    [
        ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"troop_battle_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"village_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"realm_internal_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"resource_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
    ]
        .span()
}


// ============================================================================
// Test Context Structs
// ============================================================================

/// Holds addresses for combat system dispatchers
#[derive(Copy, Drop)]
pub struct CombatSystemAddresses {
    pub troop_management: ContractAddress,
    pub troop_movement: ContractAddress,
    pub troop_battle: ContractAddress,
}

/// Context for a single realm in tests
#[derive(Copy, Drop)]
pub struct RealmTestContext {
    pub entity_id: ID,
    pub owner: ContractAddress,
    pub coord: Coord,
}

/// Context for an explorer in tests
#[derive(Copy, Drop)]
pub struct ExplorerTestContext {
    pub explorer_id: ID,
    pub owner: ContractAddress,
    pub realm_id: ID,
}

/// Full battle test context with two realms ready for combat
#[derive(Drop)]
pub struct BattleTestContext {
    pub world: WorldStorage,
    pub systems: CombatSystemAddresses,
    pub first_realm: RealmTestContext,
    pub second_realm: RealmTestContext,
    pub current_tick: u64,
}


// ============================================================================
// World Setup Functions
// ============================================================================

/// Spawns a minimal world for basic model tests
pub fn spawn_world_minimal() -> WorldStorage {
    spawn_test_world([namespace_def_minimal()].span())
}

/// Spawns a full combat world with all systems and configs
pub fn spawn_combat_world() -> WorldStorage {
    let mut world = spawn_test_world([namespace_def_combat()].span());
    world.sync_perms_and_inits(contract_defs_combat());
    world.dispatcher.uuid();
    world
}

/// Sets up all combat-related configs with 0 food costs for travel
/// This is a workaround for cross-boundary state issues in snforge tests
pub fn setup_combat_configs(ref world: WorldStorage) {
    tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
    tstore_tick_config(ref world, MOCK_TICK_CONFIG());
    tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());

    // Use custom stamina config with 0 food costs for travel
    let mut troop_stamina_config = MOCK_TROOP_STAMINA_CONFIG();
    troop_stamina_config.stamina_travel_wheat_cost = 0;
    troop_stamina_config.stamina_travel_fish_cost = 0;
    tstore_troop_stamina_config(ref world, troop_stamina_config);

    tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
    tstore_weight_config(
        ref world,
        array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1), MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T2),
            MOCK_WEIGHT_CONFIG(ResourceTypes::PALADIN_T3), MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
            MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
        ]
            .span(),
    );
    tstore_map_config(ref world, MOCK_MAP_CONFIG());
}

/// Gets combat system addresses from world
pub fn get_combat_systems(ref world: WorldStorage) -> CombatSystemAddresses {
    let (troop_management, _) = world.dns(@"troop_management_systems").unwrap();
    let (troop_movement, _) = world.dns(@"troop_movement_systems").unwrap();
    let (troop_battle, _) = world.dns(@"troop_battle_systems").unwrap();

    CombatSystemAddresses { troop_management, troop_movement, troop_battle }
}

/// Full setup: spawns world, sets up configs, gets system addresses, sets chain_id
pub fn setup_battle_world() -> (WorldStorage, CombatSystemAddresses) {
    // Set chain_id for VRF bypass in tests
    start_cheat_chain_id_global('SN_TEST');

    let mut world = spawn_combat_world();
    setup_combat_configs(ref world);
    let systems = get_combat_systems(ref world);

    (world, systems)
}


// ============================================================================
// Realm and Structure Helpers
// ============================================================================

/// Creates a test realm with proper resource capacity initialized
/// This is a simplified version that bypasses village NFT minting
pub fn spawn_test_realm(ref world: WorldStorage, realm_id: u32, owner: ContractAddress, coord: Coord) -> u32 {
    let structure_id = world.dispatcher.uuid();

    let default_troops = Troops {
        category: TroopType::Knight,
        tier: TroopTier::T1,
        count: 0,
        stamina: Stamina { amount: 0, updated_tick: 0 },
        battle_cooldown_end: 0,
        boosts: Default::default(),
    };

    let structure = Structure {
        entity_id: structure_id,
        owner: owner,
        base: StructureBase {
            troop_guard_count: 0,
            troop_explorer_count: 0,
            troop_max_guard_count: 1,
            troop_max_explorer_count: 1,
            created_at: starknet::get_block_timestamp().try_into().unwrap(),
            category: StructureCategory::Realm.into(),
            coord_x: coord.x,
            coord_y: coord.y,
            level: 1,
        },
        troop_guards: GuardTroops {
            delta: default_troops,
            charlie: default_troops,
            bravo: default_troops,
            alpha: default_troops,
            delta_destroyed_tick: 0,
            charlie_destroyed_tick: 0,
            bravo_destroyed_tick: 0,
            alpha_destroyed_tick: 0,
        },
        troop_explorers: array![].span(),
        resources_packed: 0,
        metadata: StructureMetadata {
            realm_id: realm_id.try_into().unwrap(), order: 1, has_wonder: false, villages_count: 0, village_realm: 0,
        },
        category: StructureCategory::Realm.into(),
    };
    world.write_model_test(@structure);

    // Initialize resource capacity
    ResourceImpl::initialize(ref world, structure_id);
    let structure_capacity: u128 = 1000000000000000 * RESOURCE_PRECISION;
    let structure_weight: Weight = Weight { capacity: structure_capacity, weight: 0 };
    ResourceImpl::write_weight(ref world, structure_id, structure_weight);

    structure_id
}

/// Creates a test realm for guard tests with proper guard limits
/// Unlike spawn_test_realm, this has troop_max_guard_count: 4 to allow guard testing
pub fn spawn_guard_test_realm(ref world: WorldStorage, realm_id: u32, owner: ContractAddress, coord: Coord) -> u32 {
    let structure_id = world.dispatcher.uuid();

    let default_troops = Troops {
        category: TroopType::Knight,
        tier: TroopTier::T1,
        count: 0,
        stamina: Stamina { amount: 0, updated_tick: 0 },
        battle_cooldown_end: 0,
        boosts: Default::default(),
    };

    let structure = Structure {
        entity_id: structure_id,
        owner: owner,
        base: StructureBase {
            troop_guard_count: 0,
            troop_explorer_count: 0,
            troop_max_guard_count: 4, // Higher limit for guard tests
            troop_max_explorer_count: 20,
            created_at: starknet::get_block_timestamp().try_into().unwrap(),
            category: StructureCategory::Realm.into(),
            coord_x: coord.x,
            coord_y: coord.y,
            level: 1,
        },
        troop_guards: GuardTroops {
            delta: default_troops,
            charlie: default_troops,
            bravo: default_troops,
            alpha: default_troops,
            delta_destroyed_tick: 0,
            charlie_destroyed_tick: 0,
            bravo_destroyed_tick: 0,
            alpha_destroyed_tick: 0,
        },
        troop_explorers: array![].span(),
        resources_packed: 0,
        metadata: StructureMetadata {
            realm_id: realm_id.try_into().unwrap(), order: 1, has_wonder: false, villages_count: 0, village_realm: 0,
        },
        category: StructureCategory::Realm.into(),
    };
    world.write_model_test(@structure);

    // Initialize resource capacity
    ResourceImpl::initialize(ref world, structure_id);
    let structure_capacity: u128 = 1000000000000000 * RESOURCE_PRECISION;
    let structure_weight: Weight = Weight { capacity: structure_capacity, weight: 0 };
    ResourceImpl::write_weight(ref world, structure_id, structure_weight);

    structure_id
}

/// Creates two standard test realms at positions (80,80) and (84,80)
pub fn create_two_realms(ref world: WorldStorage) -> (RealmTestContext, RealmTestContext) {
    let first_owner = starknet::contract_address_const::<'first_realm_owner'>();
    let first_coord = Coord { alt: false, x: 80, y: 80 };
    let first_id = spawn_test_realm(ref world, 1, first_owner, first_coord);

    let second_owner = starknet::contract_address_const::<'second_realm_owner'>();
    let second_coord = Coord { alt: false, x: 84, y: 80 };
    let second_id = spawn_test_realm(ref world, 2, second_owner, second_coord);

    let first_realm = RealmTestContext { entity_id: first_id, owner: first_owner, coord: first_coord };
    let second_realm = RealmTestContext { entity_id: second_id, owner: second_owner, coord: second_coord };

    (first_realm, second_realm)
}


// ============================================================================
// Tile Helpers
// ============================================================================

/// Pre-explores a tile (marks as discovered with a biome)
/// Required when using explore=false for movement
pub fn pre_explore_tile(ref world: WorldStorage, coord: Coord) {
    let tile = Tile {
        alt: coord.alt,
        col: coord.x,
        row: coord.y,
        biome: 1, // Any non-zero biome means tile is discovered
        occupier_id: 0,
        occupier_type: 0,
        occupier_is_structure: false,
        reward_extracted: false,
    };
    let tile_opt: TileOpt = tile.into();
    world.write_model_test(@tile_opt);
}

/// Pre-explores multiple tiles along a path
pub fn pre_explore_path(ref world: WorldStorage, start: Coord, directions: Span<Direction>) {
    let mut current = start;
    for direction in directions {
        current = current.neighbor(*direction);
        pre_explore_tile(ref world, current);
    }
}


// ============================================================================
// Explorer Helpers
// ============================================================================

/// Creates an explorer for a realm with proper caller mocking
pub fn create_explorer(
    ref world: WorldStorage,
    systems: CombatSystemAddresses,
    realm: RealmTestContext,
    troop_type: TroopType,
    troop_tier: TroopTier,
    troop_amount: u128,
    spawn_direction: Direction,
) -> ExplorerTestContext {
    let dispatcher = ITroopManagementSystemsDispatcher { contract_address: systems.troop_management };

    start_cheat_caller_address(systems.troop_management, realm.owner);
    let explorer_id = dispatcher
        .explorer_create(realm.entity_id, troop_type, troop_tier, troop_amount, spawn_direction);
    stop_cheat_caller_address(systems.troop_management);

    ExplorerTestContext { explorer_id, owner: realm.owner, realm_id: realm.entity_id }
}

/// Moves an explorer with proper caller mocking
/// Note: Use explore=false to avoid TrophyProgression events
pub fn move_explorer(
    ref world: WorldStorage,
    systems: CombatSystemAddresses,
    explorer: ExplorerTestContext,
    directions: Span<Direction>,
    explore: bool,
) {
    let dispatcher = ITroopMovementSystemsDispatcher { contract_address: systems.troop_movement };

    start_cheat_caller_address(systems.troop_movement, explorer.owner);
    dispatcher.explorer_move(explorer.explorer_id, directions, explore);
    stop_cheat_caller_address(systems.troop_movement);
}

/// Attacks another explorer with proper caller mocking
pub fn attack_explorer_vs_explorer(
    ref world: WorldStorage,
    systems: CombatSystemAddresses,
    attacker: ExplorerTestContext,
    defender_id: ID,
    direction: Direction,
) {
    let dispatcher = ITroopBattleSystemsDispatcher { contract_address: systems.troop_battle };

    start_cheat_caller_address(systems.troop_battle, attacker.owner);
    dispatcher.attack_explorer_vs_explorer(attacker.explorer_id, defender_id, direction, array![].span());
    stop_cheat_caller_address(systems.troop_battle);
}


// ============================================================================
// High-Level Test Setup Functions
// ============================================================================

/// Sets up a complete battle scenario with two realms and explorers
/// Returns a BattleTestContext ready for combat testing
pub fn setup_explorer_battle(
    first_troop_type: TroopType,
    first_troop_tier: TroopTier,
    second_troop_type: TroopType,
    second_troop_tier: TroopTier,
) -> (WorldStorage, CombatSystemAddresses, ExplorerTestContext, ExplorerTestContext) {
    let (mut world, systems) = setup_battle_world();

    // Create realms
    let (first_realm, second_realm) = create_two_realms(ref world);

    // Grant resources based on troop types
    let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;

    let first_resource = match first_troop_tier {
        TroopTier::T1 => ResourceTypes::KNIGHT_T1,
        TroopTier::T2 => ResourceTypes::CROSSBOWMAN_T2,
        TroopTier::T3 => ResourceTypes::PALADIN_T3,
    };
    let second_resource = match second_troop_tier {
        TroopTier::T1 => ResourceTypes::KNIGHT_T1,
        TroopTier::T2 => ResourceTypes::CROSSBOWMAN_T2,
        TroopTier::T3 => ResourceTypes::PALADIN_T3,
    };

    tgrant_resources(ref world, first_realm.entity_id, array![(first_resource, troop_amount)].span());
    tgrant_resources(ref world, second_realm.entity_id, array![(second_resource, troop_amount)].span());

    // Set timestamp
    let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
    start_cheat_block_timestamp_global(current_tick);

    // Create explorers
    let first_explorer = create_explorer(
        ref world, systems, first_realm, first_troop_type, first_troop_tier, troop_amount, Direction::East,
    );
    let second_explorer = create_explorer(
        ref world, systems, second_realm, second_troop_type, second_troop_tier, troop_amount, Direction::West,
    );

    // Pre-explore tile for movement
    let target_coord = Coord { alt: false, x: 82, y: 80 };
    pre_explore_tile(ref world, target_coord);

    // Move second explorer towards first
    move_explorer(ref world, systems, second_explorer, array![Direction::West].span(), false);

    // Advance time for stamina
    let attack_tick = current_tick * 5;
    start_cheat_block_timestamp_global(attack_tick);

    (world, systems, first_explorer, second_explorer)
}


// ============================================================================
// Assertion Helpers
// ============================================================================

/// Reads explorer troops from world
pub fn get_explorer(ref world: WorldStorage, explorer_id: ID) -> ExplorerTroops {
    world.read_model(explorer_id)
}

/// Gets the tile at a coordinate
pub fn get_tile(ref world: WorldStorage, coord: Coord) -> Tile {
    let tile_opt: TileOpt = world.read_model((coord.x, coord.y));
    tile_opt.into()
}


// ============================================================================
// Guard Helpers
// ============================================================================

/// Adds troops to a guard slot
pub fn add_guard(
    ref world: WorldStorage,
    systems: CombatSystemAddresses,
    realm: RealmTestContext,
    slot: GuardSlot,
    troop_type: TroopType,
    troop_tier: TroopTier,
    troop_amount: u128,
) {
    let dispatcher = ITroopManagementSystemsDispatcher { contract_address: systems.troop_management };

    start_cheat_caller_address(systems.troop_management, realm.owner);
    dispatcher.guard_add(realm.entity_id, slot, troop_type, troop_tier, troop_amount);
    stop_cheat_caller_address(systems.troop_management);
}

/// Attacks a structure's guard with an explorer
pub fn attack_explorer_vs_guard(
    ref world: WorldStorage,
    systems: CombatSystemAddresses,
    explorer: ExplorerTestContext,
    structure_id: ID,
    direction: Direction,
) {
    let dispatcher = ITroopBattleSystemsDispatcher { contract_address: systems.troop_battle };

    start_cheat_caller_address(systems.troop_battle, explorer.owner);
    dispatcher.attack_explorer_vs_guard(explorer.explorer_id, structure_id, direction);
    stop_cheat_caller_address(systems.troop_battle);
}

/// Attacks an explorer with a structure's guard
pub fn attack_guard_vs_explorer(
    ref world: WorldStorage,
    systems: CombatSystemAddresses,
    realm: RealmTestContext,
    slot: GuardSlot,
    explorer_id: ID,
    direction: Direction,
) {
    let dispatcher = ITroopBattleSystemsDispatcher { contract_address: systems.troop_battle };

    start_cheat_caller_address(systems.troop_battle, realm.owner);
    dispatcher.attack_guard_vs_explorer(realm.entity_id, slot, explorer_id, direction);
    stop_cheat_caller_address(systems.troop_battle);
}

/// Sets up a guard battle scenario: a realm with guards and an adjacent explorer
pub fn setup_guard_battle(
    guard_troop_type: TroopType,
    guard_troop_tier: TroopTier,
    explorer_troop_type: TroopType,
    explorer_troop_tier: TroopTier,
) -> (WorldStorage, CombatSystemAddresses, RealmTestContext, ExplorerTestContext) {
    let (mut world, systems) = setup_battle_world();

    // Create two realms
    let (first_realm, second_realm) = create_two_realms(ref world);

    // Grant resources based on troop types
    let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().max_army_size(0, TroopTier::T2).into() * RESOURCE_PRECISION;

    let guard_resource = match guard_troop_tier {
        TroopTier::T1 => ResourceTypes::KNIGHT_T1,
        TroopTier::T2 => ResourceTypes::CROSSBOWMAN_T2,
        TroopTier::T3 => ResourceTypes::PALADIN_T3,
    };
    let explorer_resource = match explorer_troop_tier {
        TroopTier::T1 => ResourceTypes::KNIGHT_T1,
        TroopTier::T2 => ResourceTypes::CROSSBOWMAN_T2,
        TroopTier::T3 => ResourceTypes::PALADIN_T3,
    };

    tgrant_resources(ref world, first_realm.entity_id, array![(guard_resource, troop_amount)].span());
    tgrant_resources(ref world, second_realm.entity_id, array![(explorer_resource, troop_amount)].span());

    // Set timestamp
    let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
    start_cheat_block_timestamp_global(current_tick);

    // Add guard to first realm
    add_guard(ref world, systems, first_realm, GuardSlot::Delta, guard_troop_type, guard_troop_tier, troop_amount);

    // Create explorer from second realm
    let explorer = create_explorer(
        ref world, systems, second_realm, explorer_troop_type, explorer_troop_tier, troop_amount, Direction::West,
    );

    // Pre-explore tiles for movement path
    let tile1 = Coord { alt: false, x: 82, y: 80 };
    let tile2 = Coord { alt: false, x: 81, y: 80 };
    pre_explore_tile(ref world, tile1);
    pre_explore_tile(ref world, tile2);

    // Move explorer adjacent to first realm
    move_explorer(ref world, systems, explorer, array![Direction::West, Direction::West].span(), false);

    // Advance time for stamina
    let attack_tick = current_tick * 5;
    start_cheat_block_timestamp_global(attack_tick);

    (world, systems, first_realm, explorer)
}


// ============================================================================
// Troop Management Test Setup Helpers
// ============================================================================

/// Namespace for troop management tests (includes quest/production models)
pub fn namespace_def_troop_management() -> NamespaceDef {
    NamespaceDef {
        namespace: DEFAULT_NS_STR(),
        resources: [
            // Core config models
            TestResource::Model("WorldConfig"), TestResource::Model("WeightConfig"), // Structure models
            TestResource::Model("Structure"), TestResource::Model("StructureOwnerStats"),
            TestResource::Model("StructureVillageSlots"), TestResource::Model("StructureBuildings"),
            TestResource::Model("Building"), // Troop models
            TestResource::Model("ExplorerTroops"), // Map models
            TestResource::Model("TileOpt"), TestResource::Model("BiomeDiscovered"),
            TestResource::Model("Wonder"), // Resource models
            TestResource::Model("Resource"),
            TestResource::Model("ResourceList"), TestResource::Model("ResourceFactoryConfig"),
            // Events
            TestResource::Event("TrophyProgression"), TestResource::Event("StoryEvent"),
            TestResource::Event("ExplorerMoveEvent"), // Contracts
            TestResource::Contract("troop_management_systems"),
            TestResource::Contract("troop_movement_systems"), TestResource::Contract("village_systems"),
            TestResource::Contract("realm_internal_systems"), TestResource::Contract("resource_systems"),
            // Libraries
            TestResource::Library(("structure_creation_library", "0_1_11")),
            TestResource::Library(("biome_library", "0_1_11")), TestResource::Library(("rng_library", "0_1_11")),
            TestResource::Library(("combat_library", "0_1_11")),
        ]
            .span(),
    }
}

pub fn contract_defs_troop_management() -> Span<ContractDef> {
    [
        ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"village_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"realm_internal_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ContractDefTrait::new(DEFAULT_NS(), @"resource_systems")
            .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
    ]
        .span()
}

/// Full setup for troop management tests
pub fn setup_troop_management_world() -> WorldStorage {
    let mut world = spawn_test_world([namespace_def_troop_management()].span());
    world.sync_perms_and_inits(contract_defs_troop_management());
    // Initialize UUID counter (first uuid() call starts the counter at 1)
    world.dispatcher.uuid();
    // Use setup_combat_configs instead of init_config to avoid deploying village pass mock
    // which requires class declaration that doesn't work well with snforge tests
    setup_combat_configs(ref world);
    world
}
