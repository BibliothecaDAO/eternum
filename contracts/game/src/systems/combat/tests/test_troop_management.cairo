#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait, WorldStorage};
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use dojo_cairo_test::{
        NamespaceDef, TestResource, ContractDefTrait, ContractDef,
        WorldStorageTestTrait,
    };
    use s1_eternum::systems::combat::contracts::troop_management::{
        troop_management_systems, 
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait
    };
    use s1_eternum::alias::ID;
    use s1_eternum::models::resource::resource::{
        SingleResource, SingleResourceImpl, SingleResourceStoreImpl,
        WeightStoreImpl,
    };
    use s1_eternum::models::weight::{Weight};
    use s1_eternum::models::position::{Direction, CoordTrait, Coord, Occupier};
    use s1_eternum::models::config::{WorldConfigUtilImpl};
    use s1_eternum::models::troop::{ExplorerTroops, TroopTier, TroopType};
    use s1_eternum::models::structure::{Structure, StructureImpl};
    use s1_eternum::constants::{DEFAULT_NS, DEFAULT_NS_STR, ResourceTypes, RESOURCE_PRECISION};
        use s1_eternum::models::{
        position:: {m_Occupier},
        map::{m_Tile,},
        realm::{m_Realm},
        config::{m_WorldConfig,  m_ProductionConfig, m_WeightConfig},
        troop::{ m_ExplorerTroops, },
        structure::{m_Structure},
        resource::resource::{m_Resource},
        resource::production::building::{m_Building, m_StructureBuildings},
    };
    use s1_eternum::utils::testing::helpers::{
        tspawn_world,
        tspawn_simple_realm,
        tstore_capacity_config,
        tstore_tick_config,
        tstore_troop_limit_config,
        tstore_troop_stamina_config,
        tstore_troop_damage_config,
        tstore_weight_config,
        tstore_production_config,
        tgrant_resources,
        MOCK_CAPACITY_CONFIG, MOCK_TICK_CONFIG, MOCK_TROOP_LIMIT_CONFIG, MOCK_TROOP_STAMINA_CONFIG, MOCK_TROOP_DAMAGE_CONFIG,
        MOCK_WEIGHT_CONFIG,
    };


    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
                TestResource::Model(m_ExplorerTroops::TEST_CLASS_HASH),
                TestResource::Model(m_Structure::TEST_CLASS_HASH),
                TestResource::Model(m_Resource::TEST_CLASS_HASH),
                TestResource::Model(m_Building::TEST_CLASS_HASH),
                TestResource::Model(m_Realm::TEST_CLASS_HASH),
                TestResource::Model(m_Tile::TEST_CLASS_HASH),
                TestResource::Model(m_Occupier::TEST_CLASS_HASH),
                TestResource::Model(m_ProductionConfig::TEST_CLASS_HASH),
                TestResource::Model(m_StructureBuildings::TEST_CLASS_HASH),
                TestResource::Model(m_WeightConfig::TEST_CLASS_HASH),
                TestResource::Contract(troop_management_systems::TEST_CLASS_HASH),
            ]
            .span(),
        };

        ndef
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
              .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span())
        ]
            .span()
    }



    #[test]
    fn test_explorer_create_essentials() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_weight_config(ref world, array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)
        ].span());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

        let owner = starknet::contract_address_const::<'structure_owner'>();
        let realm_coord = Coord { x: 1, y: 1 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_max_troop_count.into() * RESOURCE_PRECISION;

        // grant troop resources to the structure to be able to create troops
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

        // set caller address before calling the contract
        starknet::testing::set_contract_address(owner);
        starknet::testing::set_block_timestamp(1);
        let troop_spawn_direction = Direction::NorthWest;
        let troop_entity_id 
            = ITroopManagementSystemsDispatcher{contract_address: troop_management_system_addr}
                .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

        
        // ensure explorer was added to the structure
        let structure: Structure = world.read_model(realm_entity_id);
        assert_eq!(structure.explorers.len(), 1);
        assert_eq!(structure.explorers.at(0), @troop_entity_id);

        // ensure troop resource was deducted from the structure
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
        let mut t1_knight_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::KNIGHT_T1, ref structure_weight, 100, true,
        );
        assert_eq!(t1_knight_resource.balance, 0);

        // ensure troop stamina was set
        let explorer: ExplorerTroops = world.read_model(troop_entity_id);
        assert_eq!(explorer.troops.stamina.amount, MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into());
        assert_eq!(explorer.troops.stamina.updated_tick, 1);

        // ensure troop coord is a neighbor of the structure
        assert_eq!(explorer.coord, realm_coord.neighbor(troop_spawn_direction));

        // ensure explorer is owned by the structure
        assert_eq!(explorer.owner, realm_entity_id);

        // ensure troop is set correctly
        assert_eq!(explorer.troops.category, TroopType::Knight);
        assert_eq!(explorer.troops.tier, TroopTier::T1);
        assert_eq!(explorer.troops.count, troop_amount);
    }

    #[test]
    #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
    fn test_explorer_create__fails_not_owner() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_weight_config(ref world, array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)
        ].span());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

        let owner = starknet::contract_address_const::<'structure_owner'>();
        let realm_coord = Coord { x: 1, y: 1 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_max_troop_count.into() * RESOURCE_PRECISION;

        // grant troop resources to the structure to be able to create troops
        tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

        starknet::testing::set_block_timestamp(1);
        let troop_spawn_direction = Direction::NorthWest;
        
        ITroopManagementSystemsDispatcher{contract_address: troop_management_system_addr}
            .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);
    }


    #[test]
    #[should_panic(expected: ("Insufficient Balance: T1 KNIGHT (id: 1, balance: 0) < 500000000000000", 'ENTRYPOINT_FAILED'))]
    fn test_explorer_create__fails_insufficient_balance() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_weight_config(ref world, array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1)
        ].span());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

        let owner = starknet::contract_address_const::<'structure_owner'>();
        let realm_coord = Coord { x: 1, y: 1 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_max_troop_count.into() * RESOURCE_PRECISION;

        // grant no troop resources
        tgrant_resources(ref world, realm_entity_id, array![].span());

        // set caller address before calling the contract
        starknet::testing::set_contract_address(owner);
        starknet::testing::set_block_timestamp(1);
        let troop_spawn_direction = Direction::NorthWest;
        
        ITroopManagementSystemsDispatcher{contract_address: troop_management_system_addr}
            .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);
    }


    #[test]
    fn test_explorer_create_knight_tiers() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set weight config
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_weight_config(ref world, array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T2),
            MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T3),
        ].span());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

        let owner = starknet::contract_address_const::<'structure_owner'>();
        let realm_coord = Coord { x: 1, y: 1 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        
        let knight_t1_amount: u128 = 200_000 * RESOURCE_PRECISION;
        let knight_t2_amount: u128 = 200_000 * RESOURCE_PRECISION;
        let knight_t3_amount: u128 = 200_000 * RESOURCE_PRECISION;

        // grant troop resources to the structure to be able to create troops
        tgrant_resources(ref world, realm_entity_id, array![
            (ResourceTypes::KNIGHT_T1, knight_t1_amount),
            (ResourceTypes::KNIGHT_T2, knight_t2_amount),
            (ResourceTypes::KNIGHT_T3, knight_t3_amount),
        ].span());

        // set caller address before calling the contract
        starknet::testing::set_contract_address(owner);
        starknet::testing::set_block_timestamp(1);

        // allow structure have up to 3 explorers
        let mut structure: Structure = world.read_model(realm_entity_id);
        structure.limits.max_explorer_count = 3;
        world.write_model_test(@structure);

        // create T1 Knights
        let troop_systems = ITroopManagementSystemsDispatcher{contract_address: troop_management_system_addr};
        let t1_knight_entity_id 
            = troop_systems.explorer_create(
                realm_entity_id, TroopType::Knight, TroopTier::T1, 
                knight_t1_amount, Direction::NorthWest
            );

        // create T2 Knights
        let t2_knight_entity_id 
            = troop_systems.explorer_create(
                realm_entity_id, TroopType::Knight, TroopTier::T2, 
                knight_t2_amount, Direction::NorthEast
            );

        // create T3 Knights
        let t3_knight_entity_id 
            = troop_systems.explorer_create(
                realm_entity_id, TroopType::Knight, TroopTier::T3, 
                knight_t3_amount - (1 * RESOURCE_PRECISION), Direction::SouthWest
            );
            
        // ensure explorer was added to the structure
        let structure: Structure = world.read_model(realm_entity_id);
        assert_eq!(structure.explorers.len(), 3);
        assert_eq!(structure.explorers.at(0), @t1_knight_entity_id);
        assert_eq!(structure.explorers.at(1), @t2_knight_entity_id);
        assert_eq!(structure.explorers.at(2), @t3_knight_entity_id);

        // ensure troop resource was deducted from the structure
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
        let mut t1_knight_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::KNIGHT_T1, ref structure_weight, 100, true,
        );
        let mut t2_knight_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::KNIGHT_T2, ref structure_weight, 100, true,
        );
        let mut t3_knight_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::KNIGHT_T3, ref structure_weight, 100, true,
        );
        assert_eq!(t1_knight_resource.balance, 0);
        assert_eq!(t2_knight_resource.balance, 0);
        assert_eq!(t3_knight_resource.balance, 1 * RESOURCE_PRECISION);


        // ensure troop is set correctly
        let t1_knight: ExplorerTroops = world.read_model(t1_knight_entity_id);
        assert_eq!(t1_knight.troops.category, TroopType::Knight);
        assert_eq!(t1_knight.troops.tier, TroopTier::T1);
        assert_eq!(t1_knight.troops.count, knight_t1_amount);

        let t2_knight: ExplorerTroops = world.read_model(t2_knight_entity_id);
        assert_eq!(t2_knight.troops.category, TroopType::Knight);
        assert_eq!(t2_knight.troops.tier, TroopTier::T2);
        assert_eq!(t2_knight.troops.count, knight_t2_amount);

        let t3_knight: ExplorerTroops = world.read_model(t3_knight_entity_id);
        assert_eq!(t3_knight.troops.category, TroopType::Knight);
        assert_eq!(t3_knight.troops.tier, TroopTier::T3);
        assert_eq!(t3_knight.troops.count, knight_t3_amount - (1 * RESOURCE_PRECISION));        
    }


    #[test]
    fn test_explorer_create_crossbowman_tiers() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set configs
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_weight_config(ref world, array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T1),
            MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T2),
            MOCK_WEIGHT_CONFIG(ResourceTypes::CROSSBOWMAN_T3),
        ].span());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

        let owner = starknet::contract_address_const::<'structure_owner'>();
        let realm_coord = Coord { x: 1, y: 1 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        
        let crossbowman_t1_amount: u128 = 200_000 * RESOURCE_PRECISION;
        let crossbowman_t2_amount: u128 = 200_000 * RESOURCE_PRECISION;
        let crossbowman_t3_amount: u128 = 200_000 * RESOURCE_PRECISION;

        // grant troop resources
        tgrant_resources(ref world, realm_entity_id, array![
            (ResourceTypes::CROSSBOWMAN_T1, crossbowman_t1_amount),
            (ResourceTypes::CROSSBOWMAN_T2, crossbowman_t2_amount),
            (ResourceTypes::CROSSBOWMAN_T3, crossbowman_t3_amount),
        ].span());

        starknet::testing::set_contract_address(owner);
        starknet::testing::set_block_timestamp(1);

        // allow structure have up to 3 explorers
        let mut structure: Structure = world.read_model(realm_entity_id);
        structure.limits.max_explorer_count = 3;
        world.write_model_test(@structure);

        let troop_systems = ITroopManagementSystemsDispatcher{contract_address: troop_management_system_addr};
        
        // create troops of each tier
        let t1_entity_id = troop_systems.explorer_create(
            realm_entity_id, TroopType::Crossbowman, TroopTier::T1, 
            crossbowman_t1_amount, Direction::NorthWest
        );
        let t2_entity_id = troop_systems.explorer_create(
            realm_entity_id, TroopType::Crossbowman, TroopTier::T2, 
            crossbowman_t2_amount, Direction::NorthEast
        );
        let t3_entity_id = troop_systems.explorer_create(
            realm_entity_id, TroopType::Crossbowman, TroopTier::T3, 
            crossbowman_t3_amount - (1 * RESOURCE_PRECISION), Direction::SouthWest
        );
            
        // verify explorers
        let structure: Structure = world.read_model(realm_entity_id);
        assert_eq!(structure.explorers.len(), 3);
        assert_eq!(structure.explorers.at(0), @t1_entity_id);
        assert_eq!(structure.explorers.at(1), @t2_entity_id);
        assert_eq!(structure.explorers.at(2), @t3_entity_id);

        // verify resources were spent
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
        let mut t1_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::CROSSBOWMAN_T1, ref structure_weight, 100, true,
        );
        let mut t2_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::CROSSBOWMAN_T2, ref structure_weight, 100, true,
        );
        let mut t3_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::CROSSBOWMAN_T3, ref structure_weight, 100, true,
        );
        assert_eq!(t1_resource.balance, 0);
        assert_eq!(t2_resource.balance, 0);
        assert_eq!(t3_resource.balance, 1 * RESOURCE_PRECISION);


        // ensure troop is set correctly
        let t1_crossbowman: ExplorerTroops = world.read_model(t1_entity_id);
        assert_eq!(t1_crossbowman.troops.category, TroopType::Crossbowman);
        assert_eq!(t1_crossbowman.troops.tier, TroopTier::T1);
        assert_eq!(t1_crossbowman.troops.count, crossbowman_t1_amount);

        let t2_crossbowman: ExplorerTroops = world.read_model(t2_entity_id);
        assert_eq!(t2_crossbowman.troops.category, TroopType::Crossbowman);
        assert_eq!(t2_crossbowman.troops.tier, TroopTier::T2);
        assert_eq!(t2_crossbowman.troops.count, crossbowman_t2_amount);

        let t3_crossbowman: ExplorerTroops = world.read_model(t3_entity_id);
        assert_eq!(t3_crossbowman.troops.category, TroopType::Crossbowman);
        assert_eq!(t3_crossbowman.troops.tier, TroopTier::T3);
        assert_eq!(t3_crossbowman.troops.count, crossbowman_t3_amount - (1 * RESOURCE_PRECISION));
        
    }

    #[test]
    fn test_explorer_create_paladin_tiers() {
        // spawn world
        let mut world = tspawn_world(namespace_def(), contract_defs());

        // set configs
        tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
        tstore_weight_config(ref world, array![
            MOCK_WEIGHT_CONFIG(ResourceTypes::PALADIN_T1),
            MOCK_WEIGHT_CONFIG(ResourceTypes::PALADIN_T2),
            MOCK_WEIGHT_CONFIG(ResourceTypes::PALADIN_T3),
        ].span());
        tstore_tick_config(ref world, MOCK_TICK_CONFIG());
        tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
        tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
        tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());

        let owner = starknet::contract_address_const::<'structure_owner'>();
        let realm_coord = Coord { x: 1, y: 1 };
        let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        
        let paladin_t1_amount: u128 = 200_000 * RESOURCE_PRECISION;
        let paladin_t2_amount: u128 = 200_000 * RESOURCE_PRECISION;
        let paladin_t3_amount: u128 = 200_000 * RESOURCE_PRECISION;

        // grant troop resources
        tgrant_resources(ref world, realm_entity_id, array![
            (ResourceTypes::PALADIN_T1, paladin_t1_amount),
            (ResourceTypes::PALADIN_T2, paladin_t2_amount),
            (ResourceTypes::PALADIN_T3, paladin_t3_amount),
        ].span());

        starknet::testing::set_contract_address(owner);
        starknet::testing::set_block_timestamp(1);

        // allow structure have up to 3 explorers
        let mut structure: Structure = world.read_model(realm_entity_id);
        structure.limits.max_explorer_count = 3;
        world.write_model_test(@structure);

        let troop_systems = ITroopManagementSystemsDispatcher{contract_address: troop_management_system_addr};
        
        // create troops of each tier
        let t1_entity_id = troop_systems.explorer_create(
            realm_entity_id, TroopType::Paladin, TroopTier::T1, 
            paladin_t1_amount, Direction::NorthWest
        );
        let t2_entity_id = troop_systems.explorer_create(
            realm_entity_id, TroopType::Paladin, TroopTier::T2, 
            paladin_t2_amount, Direction::NorthEast
        );
        let t3_entity_id = troop_systems.explorer_create(
            realm_entity_id, TroopType::Paladin, TroopTier::T3, 
            paladin_t3_amount - (1 * RESOURCE_PRECISION), Direction::SouthWest
        );
            
        // verify explorers
        let structure: Structure = world.read_model(realm_entity_id);
        assert_eq!(structure.explorers.len(), 3);
        assert_eq!(structure.explorers.at(0), @t1_entity_id);
        assert_eq!(structure.explorers.at(1), @t2_entity_id);
        assert_eq!(structure.explorers.at(2), @t3_entity_id);

        // verify resources were spent
        let mut structure_weight: Weight = WeightStoreImpl::retrieve(ref world, realm_entity_id);
        let mut t1_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::PALADIN_T1, ref structure_weight, 100, true,
        );
        let mut t2_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::PALADIN_T2, ref structure_weight, 100, true,
        );
        let mut t3_resource = SingleResourceStoreImpl::retrieve(
            ref world, realm_entity_id, ResourceTypes::PALADIN_T3, ref structure_weight, 100, true,
        );
        assert_eq!(t1_resource.balance, 0);
        assert_eq!(t2_resource.balance, 0);
        assert_eq!(t3_resource.balance, 1 * RESOURCE_PRECISION);

        // ensure troop is set correctly
        let t1_paladin: ExplorerTroops = world.read_model(t1_entity_id);
        assert_eq!(t1_paladin.troops.category, TroopType::Paladin);
        assert_eq!(t1_paladin.troops.tier, TroopTier::T1);
        assert_eq!(t1_paladin.troops.count, paladin_t1_amount);

        let t2_paladin: ExplorerTroops = world.read_model(t2_entity_id);
        assert_eq!(t2_paladin.troops.category, TroopType::Paladin);
        assert_eq!(t2_paladin.troops.tier, TroopTier::T2);
        assert_eq!(t2_paladin.troops.count, paladin_t2_amount);

        let t3_paladin: ExplorerTroops = world.read_model(t3_entity_id);
        assert_eq!(t3_paladin.troops.category, TroopType::Paladin);
        assert_eq!(t3_paladin.troops.tier, TroopTier::T3);
        assert_eq!(t3_paladin.troops.count, paladin_t3_amount - (1 * RESOURCE_PRECISION));
       
    }
}