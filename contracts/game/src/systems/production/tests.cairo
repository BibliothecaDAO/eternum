#[cfg(test)]
mod tests {
    use dojo::model::ModelStorageTest;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use dojo_snf_test::{
        spawn_test_world, ContractDef, ContractDefTrait, NamespaceDef, TestResource, WorldStorageTestTrait,
    };
    use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
    use starknet::ContractAddress;
    use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
    use crate::models::config::{
        BuildingConfig, CapacityConfig, SeasonConfig, StructureMaxLevelConfig, WeightConfig, WorldConfigUtilImpl,
    };
    use crate::models::position::{Coord, Direction};
    use crate::models::resource::production::building::{
        BuildingCategory, BuildingCategoryConfig, StructureBuildings,
    };
    use crate::models::resource::resource::{ResourceImpl, ResourceList, Weight};
    use crate::models::stamina::Stamina;
    use crate::models::structure::{Structure, StructureBase, StructureCategory, StructureMetadata};
    use crate::models::troop::{GuardTroops, TroopBoosts, TroopTier, TroopType, Troops};
    use crate::systems::production::contracts::IProductionContractDispatcher;
    use crate::systems::production::contracts::IProductionContractDispatcherTrait;
    use crate::utils::testing::snf_helpers::{snf_spawn_test_realm, tgrant_resources};

    fn snf_namespace_def_production() -> NamespaceDef {
        NamespaceDef {
            namespace: DEFAULT_NS_STR(),
            resources: [
                TestResource::Model("WorldConfig"),
                TestResource::Model("WeightConfig"),
                TestResource::Model("Structure"),
                TestResource::Model("StructureBuildings"),
                TestResource::Model("Building"),
                TestResource::Model("Resource"),
                TestResource::Model("ResourceList"),
                TestResource::Model("ResourceFactoryConfig"),
                TestResource::Event("StoryEvent"),
                TestResource::Event("TrophyProgression"),
                TestResource::Contract("production_systems"),
            ]
                .span(),
        }
    }

    fn snf_contract_defs_production() -> Span<ContractDef> {
        [
            ContractDefTrait::new(DEFAULT_NS(), @"production_systems")
                .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
        ]
            .span()
    }

    fn snf_setup_production_world() -> WorldStorage {
        let mut world = spawn_test_world([snf_namespace_def_production()].span());
        world.sync_perms_and_inits(snf_contract_defs_production());
        world.dispatcher.uuid();

        let season_config = SeasonConfig {
            dev_mode_on: true,
            start_settling_at: 0,
            start_main_at: 0,
            end_at: 0,
            end_grace_seconds: 0,
            registration_grace_seconds: 0,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("season_config"), season_config);

        let max_level_config = StructureMaxLevelConfig { realm_max: 1, village_max: 1 };
        WorldConfigUtilImpl::set_member(ref world, selector!("structure_max_level_config"), max_level_config);

        let building_config = BuildingConfig { base_population: 100, base_cost_percent_increase: 0 };
        WorldConfigUtilImpl::set_member(ref world, selector!("building_config"), building_config);

        let capacity_config = CapacityConfig {
            structure_capacity: 1_000_000,
            troop_capacity: 1_000_000,
            donkey_capacity: 1_000_000,
            storehouse_boost_capacity: 0,
        };
        WorldConfigUtilImpl::set_member(ref world, selector!("capacity_config"), capacity_config);

        world.write_model_test(@WeightConfig { resource_type: ResourceTypes::WOOD, weight_gram: 1 });

        // Artificer build cost: 1 WOOD
        let cost_list_id = world.dispatcher.uuid();
        world.write_model_test(
            @ResourceList {
                entity_id: cost_list_id,
                index: 0,
                resource_type: ResourceTypes::WOOD,
                amount: 1 * RESOURCE_PRECISION,
            },
        );
        let building_category_config = BuildingCategoryConfig {
            category: BuildingCategory::Artificer.into(),
            complex_erection_cost_id: cost_list_id,
            complex_erection_cost_count: 1,
            simple_erection_cost_id: cost_list_id,
            simple_erection_cost_count: 1,
            population_cost: 0,
            capacity_grant: 0,
        };
        world.write_model_test(@building_category_config);

        world
    }

    fn spawn_test_village(
        ref world: WorldStorage, village_id: u32, owner: ContractAddress, coord: Coord,
    ) -> u32 {
        let default_troops = Troops {
            category: TroopType::Knight,
            tier: TroopTier::T1,
            count: 0,
            stamina: Stamina { amount: 0, updated_tick: 0 },
            boosts: TroopBoosts::default(),
            battle_cooldown_end: 0,
        };
        let village = Structure {
            entity_id: village_id,
            owner: owner,
            base: StructureBase {
                troop_guard_count: 0,
                troop_explorer_count: 0,
                troop_max_guard_count: 1,
                troop_max_explorer_count: 1,
                created_at: 0,
                category: StructureCategory::Village.into(),
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
                realm_id: 0,
                order: 0,
                has_wonder: false,
                villages_count: 0,
                village_realm: 0,
            },
            category: StructureCategory::Village.into(),
        };
        world.write_model_test(@village);

        ResourceImpl::initialize(ref world, village_id);
        let structure_weight = Weight { capacity: 1_000_000 * RESOURCE_PRECISION, weight: 0 };
        ResourceImpl::write_weight(ref world, village_id, structure_weight);
        world.write_model_test(@StructureBuildings { entity_id: village_id, ..Default::default() });

        village_id
    }

    fn get_production_dispatcher(ref world: WorldStorage) -> (ContractAddress, IProductionContractDispatcher) {
        let (addr, _) = world.dns(@"production_systems").unwrap();
        (addr, IProductionContractDispatcher { contract_address: addr })
    }

    #[test]
    #[should_panic(expected: "building is realm-only")]
    fn test_artificer_cannot_be_built_on_village() {
        let mut world = snf_setup_production_world();
        let owner = starknet::contract_address_const::<'realm_owner'>();

        let realm_id = snf_spawn_test_realm(ref world, 1, owner, Coord { alt: false, x: 10, y: 10 });
        world.write_model_test(@StructureBuildings { entity_id: realm_id, ..Default::default() });

        let village_id = world.dispatcher.uuid();
        spawn_test_village(ref world, village_id, owner, Coord { alt: false, x: 12, y: 12 });

        tgrant_resources(
            ref world, village_id, array![(ResourceTypes::WOOD, 10 * RESOURCE_PRECISION)].span(),
        );

        let (system_addr, dispatcher) = get_production_dispatcher(ref world);
        start_cheat_caller_address(system_addr, owner);
        dispatcher.create_building(
            village_id,
            array![Direction::North].span(),
            BuildingCategory::Artificer,
            true,
        );
        stop_cheat_caller_address(system_addr);
    }

    #[test]
    fn test_artificer_can_be_built_on_realm() {
        let mut world = snf_setup_production_world();
        let owner = starknet::contract_address_const::<'realm_owner'>();

        let realm_id = snf_spawn_test_realm(ref world, 1, owner, Coord { alt: false, x: 10, y: 10 });
        world.write_model_test(@StructureBuildings { entity_id: realm_id, ..Default::default() });

        tgrant_resources(
            ref world, realm_id, array![(ResourceTypes::WOOD, 10 * RESOURCE_PRECISION)].span(),
        );

        let (system_addr, dispatcher) = get_production_dispatcher(ref world);
        start_cheat_caller_address(system_addr, owner);
        dispatcher.create_building(
            realm_id,
            array![Direction::North].span(),
            BuildingCategory::Artificer,
            true,
        );
        stop_cheat_caller_address(system_addr);
    }
}
