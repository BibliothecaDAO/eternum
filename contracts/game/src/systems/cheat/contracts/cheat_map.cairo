use s1_eternum::alias::ID;
use s1_eternum::models::position::Direction;

#[starknet::interface]
pub trait ICheatMapSystems<T> {
    fn explore_line(ref self: T, from_structure_id: ID, direction: Direction, after: u8, count: u8);
    fn explore_circles(ref self: T, from_structure_id: ID, distance: u8);
    fn explore_troops(ref self: T, from_structure_id: ID);
    fn explore_buildings(ref self: T, from_structure_id: ID, for_village: bool, for_village_direction: Direction);
    fn explore_village_resource_arrivals(ref self: T, structure_id: ID, direction: Direction);

}

#[dojo::contract]
pub mod cheat_map_systems {
    use super::super::super::super::super::models::map::TileTrait;
    use dojo::world::WorldStorage;
    use dojo::model::ModelStorage;
    use dojo::world::IWorldDispatcherTrait;
    use s1_eternum::alias::ID;
    use s1_eternum::constants::DEFAULT_NS;
    use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
    use s1_eternum::models::troop::{TroopType, TroopTier};
    use s1_eternum::models::resource::production::building::{BuildingCategory, BuildingImpl};
    use s1_eternum::models::resource::production::production::ProductionStrategyImpl;
    use s1_eternum::models::resource::resource::{
        ResourceWeightImpl, SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl,
    };
    use s1_eternum::models::structure::{StructureBase, StructureCategory, StructureBaseImpl, StructureBaseStoreImpl, StructureOwnerStoreImpl, StructureTroopExplorerStoreImpl};
    use s1_eternum::models::weight::{WeightImpl, Weight};
    use s1_eternum::models::position::{Direction, Coord, CoordImpl};
    use s1_eternum::models::map::Tile;
    use s1_eternum::models::config::{
        CombatConfigImpl, MapConfig, TroopLimitConfig, TroopStaminaConfig, WorldConfigUtilImpl,
    };
    use s1_eternum::models::config::TickImpl;
    use s1_eternum::systems::config::contracts::config_systems::{assert_caller_is_admin};
    use s1_eternum::systems::utils::map::IMapImpl;
    use s1_eternum::utils::map::{biomes::{Biome, get_biome}};
    use s1_eternum::systems::utils::{mine::iMineDiscoveryImpl, troop::{iExplorerImpl, iGuardImpl, iTroopImpl}};
    use s1_eternum::models::resource::arrivals::{ResourceArrivalImpl};


    #[abi(embed_v0)]
    impl CheatMapSystemsImpl of super::ICheatMapSystems<ContractState> {
        fn explore_line(ref self: ContractState, from_structure_id: ID, direction: Direction, after: u8, count: u8){
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            structure.assert_exists();
            let structure_coord: Coord = Coord {x: structure.coord_x, y: structure.coord_y};
            for i in 0..count {
                let coord = structure_coord.neighbor_after_distance(direction, after.into()+i.into());
                let mut tile: Tile = world.read_model((coord.x, coord.y));
                if tile.biome == Biome::None.into() {
                    // add biome to biomes
                    let biome = get_biome(tile.col.into(), tile.row.into());
                    IMapImpl::explore(ref world, ref tile, biome);
                }
            };
        }

        fn explore_village_resource_arrivals(ref self: ContractState, structure_id: ID, direction: Direction){
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            structure.assert_exists();

            let village = structure.coord().neighbor_after_distance(direction, 2);
            let mut tile : Tile = world.read_model((village.x, village.y));
            let village_structure_id = tile.occupier_id;
            
            let resource_amount: u128 = 100_000 * RESOURCE_PRECISION;
            let resources = array![
                (1, resource_amount),
                (2, resource_amount),
                (3, resource_amount),
                (4, resource_amount),
                (5, resource_amount),
                (6, resource_amount),
                (7, resource_amount),
                (8, resource_amount),
                (9, resource_amount),
                (10, resource_amount),
                (11, resource_amount),
                (12, resource_amount),
                (13, resource_amount),
                (14, resource_amount),
                (15, resource_amount),
                (16, resource_amount),
                (17, resource_amount),
                (18, resource_amount),
                (19, resource_amount),
                (20, resource_amount),
                (21, resource_amount),
                (22, resource_amount),
                (23, resource_amount),
                (24, resource_amount),
                (25, resource_amount),
                (26, resource_amount),
                (27, resource_amount),
                (28, resource_amount),
                (29, resource_amount),
                (30, resource_amount),
                (31, resource_amount),
                (32, resource_amount),
                (33, resource_amount),
                (34, resource_amount),
                (35, resource_amount),
                (36, resource_amount),
                (37, resource_amount), 
            ];
            let one_hour_in_seconds = 60 * 60;
            let one_day_in_seconds = 60 * 60 * 24;
            let travel_times = array![

                (one_day_in_seconds*4) + (one_hour_in_seconds*1),
                (one_day_in_seconds*4) + (one_hour_in_seconds*2),
                (one_day_in_seconds*4) + (one_hour_in_seconds*3),

                (one_day_in_seconds*5) + (one_hour_in_seconds*1),
                (one_day_in_seconds*5) + (one_hour_in_seconds*2),
                (one_day_in_seconds*5) + (one_hour_in_seconds*3),
            ];

            
            // add resources to the main entity's arrival time
            for travel_time in travel_times {
                // for village
                let (arrival_day, arrival_slot) = ResourceArrivalImpl::arrival_slot(ref world, travel_time);
                let mut arrival_resources_array = ResourceArrivalImpl::read_slot(
                    ref world, village_structure_id, arrival_day, arrival_slot,
                );
                let mut resource_arrival_total_amount = ResourceArrivalImpl::read_day_total(
                    ref world, village_structure_id, arrival_day,
                );
                ResourceArrivalImpl::slot_increase_balances(
                    ref arrival_resources_array,
                    resources.span(),
                    ref resource_arrival_total_amount,
                );
    
                ResourceArrivalImpl::write_slot(
                    ref world, village_structure_id, arrival_day, arrival_slot, arrival_resources_array,
                );
                ResourceArrivalImpl::write_day_total(
                    ref world, village_structure_id, arrival_day, resource_arrival_total_amount,
                );

                // for structure
                let mut arrival_resources_array = ResourceArrivalImpl::read_slot(
                    ref world, structure_id, arrival_day, arrival_slot,
                );
                let mut resource_arrival_total_amount = ResourceArrivalImpl::read_day_total(
                    ref world, structure_id, arrival_day,
                );
                ResourceArrivalImpl::slot_increase_balances(
                    ref arrival_resources_array,
                    resources.span(),
                    ref resource_arrival_total_amount,
                );
    
                ResourceArrivalImpl::write_slot(
                    ref world, structure_id, arrival_day, arrival_slot, arrival_resources_array,
                );
                ResourceArrivalImpl::write_day_total(
                    ref world, structure_id, arrival_day, resource_arrival_total_amount,
                );
            };
        }


        fn explore_circles(ref self: ContractState, from_structure_id: ID, distance: u8){
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            structure.assert_exists();
            let structure_coord: Coord = Coord {x: structure.coord_x, y: structure.coord_y};
            let map_config: MapConfig = WorldConfigUtilImpl::get_member(world, selector!("map_config"));
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let resource_amount: u128 = 100_000 * RESOURCE_PRECISION;
            let resources = array![
                (1, resource_amount),
                (2, resource_amount),
                (3, resource_amount),
                (4, resource_amount),
                (5, resource_amount),
                (6, resource_amount),
                (7, resource_amount),
                (8, resource_amount),
                (9, resource_amount),
                (10, resource_amount),
                (11, resource_amount),
                (12, resource_amount),
                (13, resource_amount),
                (14, resource_amount),
                (15, resource_amount),
                (16, resource_amount),
                (17, resource_amount),
                (18, resource_amount),
                (19, resource_amount),
                (20, resource_amount),
                (21, resource_amount),
                (22, resource_amount),
                (23, resource_amount),
                (24, resource_amount),
                (25, resource_amount),
                (26, resource_amount),
                (27, resource_amount),
                (28, resource_amount),
                (29, resource_amount),
                (30, resource_amount),
                (31, resource_amount),
                (32, resource_amount),
                (33, resource_amount),
                (34, resource_amount),
                (35, resource_amount),
                (36, resource_amount),
                (37, resource_amount), 
            ];
            let one_hour_in_seconds = 60 * 60;
            let one_day_in_seconds = 60 * 60 * 24;
            let travel_times = array![
                (one_day_in_seconds*4) + (one_hour_in_seconds*1),
                (one_day_in_seconds*4) + (one_hour_in_seconds*2),
                (one_day_in_seconds*4) + (one_hour_in_seconds*3),

                (one_day_in_seconds*5) + (one_hour_in_seconds*1),
                (one_day_in_seconds*5) + (one_hour_in_seconds*2),
                (one_day_in_seconds*5) + (one_hour_in_seconds*3),
            ];

            for direction in array![Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest, Direction::SouthEast] {
                let start_coord = structure_coord.neighbor_after_distance(direction, distance.into());
                let tile : Tile = world.read_model((start_coord.x, start_coord.y));
                if !tile.occupied() {
                    // add mine at the end of the line
                    let vrf_seed = 81278937298732864263278427786236761612789192890327984262684137;
                    let mine_structure_id = iMineDiscoveryImpl::create(
                        ref world, tile.into(), map_config, troop_limit_config, troop_stamina_config, vrf_seed,
                    );
                    StructureOwnerStoreImpl::store(starknet::get_caller_address(), ref world, mine_structure_id);
                    let travel_times_copy = travel_times.clone();
                    for travel_time in travel_times_copy {
                        let (arrival_day, arrival_slot) = ResourceArrivalImpl::arrival_slot(ref world, travel_time);
                        let mut arrival_resources_array = ResourceArrivalImpl::read_slot(
                            ref world, mine_structure_id, arrival_day, arrival_slot,
                        );
                        let mut resource_arrival_total_amount = ResourceArrivalImpl::read_day_total(
                            ref world, mine_structure_id, arrival_day,
                        );
                        ResourceArrivalImpl::slot_increase_balances(
                            ref arrival_resources_array,
                            resources.span(),
                            ref resource_arrival_total_amount,
                        );
            
                        ResourceArrivalImpl::write_slot(
                            ref world, mine_structure_id, arrival_day, arrival_slot, arrival_resources_array,
                        );
                        ResourceArrivalImpl::write_day_total(
                            ref world, mine_structure_id, arrival_day, resource_arrival_total_amount,
                        );
                    }
                }
            };
        }
        fn explore_troops(ref self: ContractState, from_structure_id: ID){
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            structure.assert_exists();
            let structure_coord: Coord = Coord {x: structure.coord_x, y: structure.coord_y};
            let troop_limit_config: TroopLimitConfig = CombatConfigImpl::troop_limit_config(ref world);
            let troop_stamina_config: TroopStaminaConfig = CombatConfigImpl::troop_stamina_config(ref world);
            let tick = TickImpl::get_tick_config(ref world);
            let current_tick: u64 = tick.current().try_into().unwrap();
            let mut all_structure_ids: Array<ID> = array![from_structure_id];

            for direction in array![Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest, Direction::SouthEast] {
                let village = structure_coord.neighbor_after_distance(direction, 2);
                let mut tile : Tile = world.read_model((village.x, village.y));
                all_structure_ids.append(tile.occupier_id);
            };

            for structure_id in all_structure_ids {
                for direction in array![Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest, Direction::SouthEast] {
                    let mut structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
                    let structure_coord: Coord = Coord {x: structure.coord_x, y: structure.coord_y};
                    let start_coord = structure_coord.neighbor(direction);
                    let mut tile : Tile = world.read_model((start_coord.x, start_coord.y));
                    if !tile.occupied() {
                        let explorer_id = world.dispatcher.uuid();

                        // add explorer count to structure
                        let mut explorers: Array<ID> = StructureTroopExplorerStoreImpl::retrieve(ref world, structure_id)
                            .into();
                        explorers.append(explorer_id);
                        StructureTroopExplorerStoreImpl::store(explorers.span(), ref world, structure_id);

                        structure.troop_explorer_count += 1;
                        StructureBaseStoreImpl::store(ref structure, ref world, structure_id);

                        if structure_id == from_structure_id {
                            iExplorerImpl::create(
                                ref world,
                                ref tile,
                                explorer_id,
                                structure_id,
                                TroopType::Paladin,
                                TroopTier::T2,
                                100_000 * RESOURCE_PRECISION,
                                troop_stamina_config,
                                troop_limit_config,
                                current_tick,
                            );
                        } else {
                            iExplorerImpl::create(
                                ref world,
                                ref tile,
                                explorer_id,
                                structure_id,
                                TroopType::Crossbowman,
                                TroopTier::T3,
                                100_000 * RESOURCE_PRECISION,
                                troop_stamina_config,
                                troop_limit_config,
                                current_tick,
                            );
                        }

                        // add lords to explorer balance
                        let mut troops_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
                        let lords_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::LORDS);
                        let mut troop_lords_resource = SingleResourceStoreImpl::retrieve(
                            ref world, explorer_id, ResourceTypes::LORDS, ref troops_weight, lords_weight_grams, false,
                        );
                        troop_lords_resource.add(100_000 * RESOURCE_PRECISION, ref troops_weight, lords_weight_grams);
                        troop_lords_resource.store(ref world);

                        // add gold to explorer balance
                        let mut troops_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
                        let gold_weight_grams: u128 = ResourceWeightImpl::grams(ref world, ResourceTypes::GOLD);
                        let mut troop_gold_resource = SingleResourceStoreImpl::retrieve(
                            ref world, explorer_id, ResourceTypes::GOLD, ref troops_weight, gold_weight_grams, false,
                        );
                        troop_gold_resource.add(800 * RESOURCE_PRECISION, ref troops_weight, gold_weight_grams);
                        troop_gold_resource.store(ref world);

                        troops_weight.store(ref world, explorer_id);
                    }
                };
            };
        }
        fn explore_buildings(ref self: ContractState, mut from_structure_id: ID, for_village: bool, for_village_direction: Direction){
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            assert_caller_is_admin(world);

            let structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, from_structure_id);
            structure.assert_exists();

            if for_village {
                let village = structure.coord().neighbor_after_distance(for_village_direction, 2);
                let mut tile : Tile = world.read_model((village.x, village.y));
                from_structure_id = tile.occupier_id;
            }

            let buildings = array![
                (BuildingCategory::ResourceKnightT1, ResourceTypes::KNIGHT_T1),
                (BuildingCategory::ResourceKnightT2, ResourceTypes::KNIGHT_T2),
                (BuildingCategory::ResourceKnightT3, ResourceTypes::KNIGHT_T3),
                (BuildingCategory::ResourceCrossbowmanT1, ResourceTypes::CROSSBOWMAN_T1),
                (BuildingCategory::ResourceCrossbowmanT2, ResourceTypes::CROSSBOWMAN_T2),
                (BuildingCategory::ResourceCrossbowmanT3, ResourceTypes::CROSSBOWMAN_T3),
                (BuildingCategory::ResourcePaladinT1, ResourceTypes::PALADIN_T1),
                (BuildingCategory::ResourcePaladinT2, ResourceTypes::PALADIN_T2),
                (BuildingCategory::ResourcePaladinT3, ResourceTypes::PALADIN_T3),
                (BuildingCategory::ResourceWheat, ResourceTypes::WHEAT),
                (BuildingCategory::ResourceFish, ResourceTypes::FISH),
            ];
            let buildings_center = BuildingImpl::center();
            let all_directions = array![
                Direction::East, 
                Direction::NorthEast,
                Direction::NorthWest, 
                Direction::West, 
                Direction::SouthWest,
                Direction::SouthEast
            ];
            let all_second_directions = array![
                Direction::NorthWest, 
                Direction::West, 
                Direction::SouthWest, 
                Direction::SouthEast, 
                Direction::East, 
                Direction::NorthEast
            ];
            let increase_direction_count_at = array![6, 12, 18];
            let structure_id = from_structure_id;
            let mut structure: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);
            structure.assert_exists();
            if structure.category == StructureCategory::Village.into() {
                structure.level = 1;
                StructureBaseStoreImpl::store(ref structure, ref world, structure_id);
            } else {
                structure.level = 3;
                StructureBaseStoreImpl::store(ref structure, ref world, structure_id);
            }

            for i in 0..18_u32 {
                if structure.category == StructureCategory::Village.into() {
                    if i == 12 {
                        break;
                    }
                }
                let (building_category, resource_type) = *buildings.at(i % buildings.len());
                let building_first_direction = *all_directions.at(i % all_directions.len());
                let building_second_direction = *all_second_directions.at(i % all_second_directions.len());
                let mut building_direction_count: u8 = 1;
                if i >= *increase_direction_count_at.at(0) {
                    building_direction_count = 2;
                }
                if i >= *increase_direction_count_at.at(1) {
                    building_direction_count = 3;
                }
                if i >= *increase_direction_count_at.at(2) {
                    building_direction_count = 4;
                }
                let mut building_coord = 
                    buildings_center.neighbor_after_distance(
                        building_first_direction, 
                        building_direction_count.into()
                    );
                BuildingImpl::create(
                        ref world,
                        structure_id,
                        structure.category,
                        structure.coord(),
                        building_category,
                        building_coord,
                    ); 
                ProductionStrategyImpl::burn_resource_for_resource_production(
                        ref world, structure_id, resource_type, 10,
                );
                while building_direction_count > 1 {
                    let next_coord = building_coord.neighbor_after_distance(
                        building_second_direction, 
                        building_direction_count.into() - 1
                    );
                    BuildingImpl::create(
                        ref world,
                        structure_id,
                        structure.category,
                        structure.coord(),
                        building_category,
                        next_coord,
                    ); 
                    if i < buildings.len() {
                        ProductionStrategyImpl::burn_resource_for_resource_production(
                                ref world, structure_id, resource_type, 1000,
                        );
                    }
                    building_direction_count -= 1;
                };
            };
        }
    }
}

