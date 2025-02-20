#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
    use dojo::world::{WorldStorageTrait, WorldStorage};
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    use dojo_cairo_test::{
        spawn_test_world, NamespaceDef, TestResource, ContractDefTrait, ContractDef,
        WorldStorageTestTrait,
    };

    use s1_eternum::systems::combat::contracts::troop_management::{
        troop_management_systems, 
        ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait
    };
    use s1_eternum::systems::realm::contracts::realm_systems::{
        InternalRealmLogicImpl,
    };
    use s1_eternum::alias::ID;
    use s1_eternum::constants::{DEFAULT_NS, DEFAULT_NS_STR, ResourceTypes, RESOURCE_PRECISION};
        use s1_eternum::models::{
        position:: {
            Coord, Occupier, m_Occupier
        },
        map::{
            Tile, m_Tile, 
        },
        realm::{
            Realm, m_Realm
        },
        config::{
            WorldConfig, m_WorldConfig, ProductionConfig, m_ProductionConfig, LaborBurnPrStrategy, MultipleResourceBurnPrStrategy,
            CapacityConfig, WeightConfig, m_WeightConfig, WorldConfigUtilImpl
        },
        troop::{
            ExplorerTroops, m_ExplorerTroops, 
            TroopTier, TroopType
        },
        structure::{
            Structure, StructureImpl,
            m_Structure
        },
        resource::resource::{
            Resource, m_Resource,
        },
        resource::production::building::{
            Building, m_Building, StructureBuildings, m_StructureBuildings
        },
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

    fn spawn_world() -> WorldStorage {
        let ndef = namespace_def();
        let mut world = spawn_test_world([ndef].span());

        world.sync_perms_and_inits(contract_defs());
        world.dispatcher.uuid();
        world
    }


    fn spawn_realm(ref world: WorldStorage, owner: starknet::ContractAddress, realm_id: ID, order: u8, coord: Coord) -> ID {

        // set labor production config
        let labor_production_config = ProductionConfig {
            resource_type: ResourceTypes::LABOR,
            amount_per_building_per_tick: 100,
            labor_burn_strategy: LaborBurnPrStrategy {
                resource_rarity: 0,
                wheat_burn_per_labor: 0,
                fish_burn_per_labor: 0,
                depreciation_percent_num: 0,
                depreciation_percent_denom: 0,
            },
            multiple_resource_burn_strategy: MultipleResourceBurnPrStrategy {
                required_resources_id: 0,
                required_resources_count: 0,
            },
        };
        world.write_model_test(@labor_production_config);

        // create realm
        let (realm_entity_id, _) = InternalRealmLogicImpl::create_realm(
            ref world, owner, realm_id, array![], order, 0, 1, coord.into(),
        );
    
        realm_entity_id
    }


    fn set_weight_config(ref world: WorldStorage) {
        let capacity_config = CapacityConfig {
            structure_capacity: 10000000, // grams
            troop_capacity: 100000000, // grams
            donkey_capacity: 10000000, // grams
            storehouse_boost_capacity: 10000,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("capacity_config"), capacity_config);

        let weight_config = WeightConfig {
            resource_type: ResourceTypes::KNIGHT_T1,
            weight_gram: 100,
        };
        world.write_model_test(@weight_config);
    }


    #[test]
    fn test_explorer_create_basic() {
        let caller = starknet::contract_address_const::<'realm_owner'>();
        // spawn world
        let mut world = spawn_world();

        // set weight config
        set_weight_config(ref world);

        let realm_entity_id = spawn_realm(ref world, caller, 1, 1, Coord { x: 1, y: 1 });
        let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
        let troop_amount: u128 = 100 * RESOURCE_PRECISION;

        // set caller address before calling the contract
        starknet::testing::set_contract_address(caller);
        let troop_entity_id 
            = ITroopManagementSystemsDispatcher{contract_address: troop_management_system_addr}
                .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount);
        // let structure = Structure {
        //     entity_id: 1,
        //     coord: Coord { x: 1, y: 1 },
        //     category: StructureCategory::Explorer,
        //     explorers: [],
        // };
        // world.write_model(@structure);
    }
}