use cubit::f128::types::fixed::{FixedTrait};
use dojo::model::{ModelStorage, ModelStorageTest};
use dojo::world::{IWorldDispatcherTrait};
use dojo::world::{WorldStorage, WorldStorageTrait};
use dojo_cairo_test::deploy_contract;
use dojo_cairo_test::{ContractDef, NamespaceDef, WorldStorageTestTrait, spawn_test_world};
use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{
    CapacityConfig, MapConfig, QuestConfig, TickConfig, TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig,
    VillageTokenConfig, WeightConfig, WorldConfigUtilImpl,
};
use s1_eternum::models::config::{CombatConfigImpl, TickImpl};
use s1_eternum::models::config::{ResourceFactoryConfig};
use s1_eternum::models::map::{Tile, TileOccupier};
use s1_eternum::models::position::{Coord};
use s1_eternum::models::quest::{Level, QuestTile};
use s1_eternum::models::resource::resource::{ResourceList};
use s1_eternum::models::resource::resource::{
    ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, StructureSingleResourceFoodImpl, WeightStoreImpl,
};
use s1_eternum::models::stamina::{StaminaImpl, StaminaTrait};
use s1_eternum::models::structure::{
    Structure, StructureBase, StructureCategory, StructureMetadata, StructureVillageSlots,
};
use s1_eternum::models::troop::{ExplorerTroops, GuardTroops, TroopTier, TroopType, Troops};
use s1_eternum::models::weight::{Weight};
use s1_eternum::systems::quest::constants::{QUEST_REWARD_BASE_MULTIPLIER};
use s1_eternum::systems::quest::contracts::{IQuestSystemsDispatcher, IQuestSystemsDispatcherTrait};
use s1_eternum::systems::utils::realm::iRealmImpl;
use s1_eternum::utils::testing::contracts::villagepassmock::EternumVillagePassMock;
use starknet::ContractAddress;


fn deploy_mock_village_pass(ref world: WorldStorage, admin: starknet::ContractAddress) -> ContractAddress {
    let mock_calldata: Array<felt252> = array![
        admin.into(),
        admin.into(),
        starknet::get_contract_address().into(),
        2,
        starknet::get_contract_address().into(),
        admin.into(),
    ];
    let mock_village_pass_address = deploy_contract(EternumVillagePassMock::TEST_CLASS_HASH, mock_calldata.span());
    mock_village_pass_address
}


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
        mine_wheat_grant_amount: 0,
        mine_fish_grant_amount: 1,
        agent_discovery_prob: 5000,
        agent_discovery_fail_prob: 5000,
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
        mercenaries_troop_upper_bound: 500_000, // max of troops per mercenary
        agents_troop_lower_bound: 5_000, // min of troops per agent
        agents_troop_upper_bound: 50_000 // max of troops per agent
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

pub fn tstore_village_token_config(ref world: WorldStorage, config: VillageTokenConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("village_pass_config"), config);
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
    add_test_quest_game(ref world);
    world
}

fn add_test_quest_game(ref world: WorldStorage) {
    let level1 = Level { target_score: 100, settings_id: 0, time_limit: 600 };
    let level2 = Level { target_score: 200, settings_id: 0, time_limit: 1200 };
    let level3 = Level { target_score: 300, settings_id: 0, time_limit: 1500 };
    let levels = array![level1, level2, level3].span();

    let (quest_system_addr, _) = world.dns(@"quest_systems").unwrap();
    let quest_systems = IQuestSystemsDispatcher { contract_address: quest_system_addr };

    let (game_mock_addr, _) = world.dns(@"game_mock").unwrap();

    quest_systems.add_game(game_mock_addr, levels, false);
}

pub fn tspawn_simple_realm(
    ref world: WorldStorage, realm_id: ID, owner: starknet::ContractAddress, coord: Coord,
) -> ID {
    tstore_production_config(ref world, ResourceTypes::LABOR);
    tstore_production_config(ref world, ResourceTypes::EARTHEN_SHARD);

    // create realm
    let realm_entity_id = iRealmImpl::create_realm(ref world, owner, realm_id, array![], 1, 0, 1, coord.into());

    realm_entity_id
}

pub fn tspawn_realm_with_resources(
    ref world: WorldStorage, realm_id: ID, owner: starknet::ContractAddress, coord: Coord,
) -> ID {
    let realm_entity_id = tspawn_simple_realm(ref world, realm_id, owner, coord);

    let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
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
        ref world, owner, realm_id, produced_resources, order, level, wonder, coord.into(),
    );

    realm_entity_id
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
    };

    let complex_input_list: Array<(u8, u128)> = array![(ResourceTypes::WOOD, 1)];
    let complex_input_list_id = world.dispatcher.uuid();
    for i in 0..complex_input_list.len() {
        let (resource_type, resource_amount) = *complex_input_list.at(i);
        world
            .write_model_test(
                @ResourceList { entity_id: complex_input_list_id, index: i, resource_type, amount: resource_amount },
            );
    };
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

pub fn tspawn_explorer(ref world: WorldStorage, owner: ID, coord: Coord) -> ID {
    let current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
    let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
    let mut troops = Troops {
        category: TroopType::Crossbowman, tier: TroopTier::T2, count: troop_amount, stamina: Default::default(),
    };
    let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
    troops.stamina.refill(troops.category, troop_stamina_config, current_tick);
    let explorer_id = world.dispatcher.uuid();
    let explorer: ExplorerTroops = ExplorerTroops { explorer_id, coord, troops, owner };
    world.write_model_test(@explorer);
    explorer_id
}

pub fn init_config(ref world: WorldStorage) {
    tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
    tstore_tick_config(ref world, MOCK_TICK_CONFIG());
    tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
    tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
    tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
    tstore_weight_config(
        ref world,
        array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
            MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T2),
            MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
            MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
        ]
            .span(),
    );
    tstore_map_config(ref world, MOCK_MAP_CONFIG());
    tstore_quest_config(ref world, MOCK_QUEST_CONFIG());
    tstore_village_token_config(
        ref world, MOCK_VILLAGE_TOKEN_CONFIG(ref world, starknet::contract_address_const::<'realm_owner'>()),
    );
}

pub fn tspawn_quest_tile(
    ref world: WorldStorage, game_address: ContractAddress, level: u8, capacity: u16, coord: Coord,
) -> @QuestTile {
    let id = world.dispatcher.uuid();
    let resource_type = ResourceTypes::WHEAT;
    let amount = MOCK_MAP_CONFIG().reward_resource_amount.into()
        * QUEST_REWARD_BASE_MULTIPLIER.into()
        * RESOURCE_PRECISION
        * (level + 1).into();
    let quest_details = @QuestTile {
        id, coord, game_address, level, resource_type, amount, capacity, participant_count: 0,
    };
    world.write_model_test(quest_details);
    quest_details
}

pub fn MOCK_QUEST_CONFIG() -> QuestConfig {
    QuestConfig { quest_discovery_prob: 5000, quest_discovery_fail_prob: 5000 }
}

pub fn tstore_quest_config(ref world: WorldStorage, config: QuestConfig) {
    WorldConfigUtilImpl::set_member(ref world, selector!("quest_config"), config);
}

pub fn tspawn_village_explorer(ref world: WorldStorage, village_id: ID, coord: Coord) -> ID {
    let mut uuid = world.dispatcher.uuid();
    let explorer_id = uuid;

    let troop_amount = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() * RESOURCE_PRECISION;
    let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
    let current_tick = starknet::get_block_timestamp();

    let mut initial_troops = Troops {
        category: TroopType::Crossbowman, tier: TroopTier::T2, count: troop_amount, stamina: Default::default(),
    };
    initial_troops.stamina.refill(initial_troops.category, troop_stamina_config, current_tick);

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
    let tile: Tile = world.read_model((coord.x, coord.y));
    assert!(tile.occupier_id == 0, "Can't spawn village on occupied tile");

    let mut uuid = world.dispatcher.uuid();
    let village_id = uuid;

    let basic_troops = Troops {
        category: TroopType::Crossbowman,
        tier: TroopTier::T2,
        count: 100 * RESOURCE_PRECISION,
        stamina: Default::default(),
    };

    // Spawn the village structure
    let mut structure = Structure {
        entity_id: village_id,
        owner: owner,
        base: StructureBase {
            troop_guard_count: 0,
            troop_explorer_count: 0,
            troop_max_guard_count: 4, // Default max guards
            troop_max_explorer_count: MOCK_TROOP_LIMIT_CONFIG().explorer_max_party_count.into(),
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

    let realm_coord = Coord { x: 0, y: 0 };

    let structure_village_slots = StructureVillageSlots {
        connected_realm_entity_id: realm_id,
        connected_realm_id: 0, // Assuming realm_id can be converted or fetched
        connected_realm_coord: realm_coord, // Need actual realm coord
        directions_left: array![].span(),
    };
    world.write_model_test(@structure_village_slots);

    // Ensure the tile is marked as occupied by the village
    let mut tile: Tile = world.read_model((coord.x, coord.y));
    tile.occupier_type = TileOccupier::Village.into();
    tile.occupier_id = village_id;
    tile.occupier_is_structure = true;
    world.write_model_test(@tile);

    village_id
}
