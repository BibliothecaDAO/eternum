// #[cfg(test)]
// mod tests {
//     use core::num::traits::zero::Zero;
//     use dojo::model::{ModelStorage, ModelStorageTest};
//     use dojo::world::IWorldDispatcherTrait;
//     use dojo::world::{WorldStorageTrait};
//     use dojo_cairo_test::{ContractDef, ContractDefTrait, NamespaceDef, TestResource};
//     use crate::constants::{DEFAULT_NS, DEFAULT_NS_STR, RESOURCE_PRECISION, ResourceTypes};
//     use crate::models::config::{MapConfig, WorldConfigUtilImpl};
//     use crate::models::map::{Tile, TileImpl};
//     use crate::models::position::{Coord, CoordTrait, Direction, OccupiedBy, Occupier};
//     use crate::models::resource::resource::{SingleResourceImpl, SingleResourceStoreImpl, WeightStoreImpl};
//     use crate::models::structure::{Structure, StructureBaseImpl, StructureCategory, StructureImpl};
//     use crate::models::troop::{ExplorerTroops, GuardImpl, TroopTier, TroopType};
//     use crate::models::weight::{Weight};
//     use crate::models::{
//         config::{m_ProductionConfig, m_WeightConfig, m_WorldConfig}, map::{m_Tile}, position::{m_Occupier},
//         realm::{m_Realm}, resource::production::building::{m_Building, m_StructureBuildings},
//         resource::resource::{m_Resource}, structure::{m_Structure}, troop::{m_ExplorerTroops},
//     };
//     use crate::systems::combat::contracts::troop_management::{
//         ITroopManagementSystemsDispatcher, ITroopManagementSystemsDispatcherTrait, troop_management_systems,
//     };
//     use crate::systems::combat::contracts::troop_movement::{
//         ITroopMovementSystemsDispatcher, ITroopMovementSystemsDispatcherTrait, troop_movement_systems,
//     };
//     use crate::utils::map::biomes::Biome;
//     use crate::utils::testing::helpers::{
//         MOCK_CAPACITY_CONFIG, MOCK_MAP_CONFIG, MOCK_TICK_CONFIG, MOCK_TROOP_DAMAGE_CONFIG, MOCK_TROOP_LIMIT_CONFIG,
//         MOCK_TROOP_STAMINA_CONFIG, MOCK_WEIGHT_CONFIG, tgrant_resources, tspawn_simple_realm, tspawn_world,
//         tstore_capacity_config, tstore_map_config, tstore_tick_config, tstore_troop_damage_config,
//         tstore_troop_limit_config, tstore_troop_stamina_config, tstore_weight_config,
//     };

//     fn namespace_def() -> NamespaceDef {
//         let ndef = NamespaceDef {
//             namespace: DEFAULT_NS_STR(),
//             resources: [
//                 // world config
//                 TestResource::Model(m_WorldConfig::TEST_CLASS_HASH),
//                 TestResource::Model(m_WeightConfig::TEST_CLASS_HASH),
//                 TestResource::Model(m_ProductionConfig::TEST_CLASS_HASH),
//                 // structure, realm and buildings
//                 TestResource::Model(m_Structure::TEST_CLASS_HASH),
//                 TestResource::Model(m_StructureBuildings::TEST_CLASS_HASH),
//                 TestResource::Model(m_Realm::TEST_CLASS_HASH), TestResource::Model(m_Occupier::TEST_CLASS_HASH),
//                 TestResource::Model(m_Building::TEST_CLASS_HASH), TestResource::Model(m_Tile::TEST_CLASS_HASH),
//                 TestResource::Model(m_Resource::TEST_CLASS_HASH),
//                 // other models
//                 TestResource::Model(m_ExplorerTroops::TEST_CLASS_HASH),
//                 // contracts
//                 TestResource::Contract(troop_management_systems::TEST_CLASS_HASH),
//                 TestResource::Contract(troop_movement_systems::TEST_CLASS_HASH),
//             ]
//                 .span(),
//         };

//         ndef
//     }

//     fn contract_defs() -> Span<ContractDef> {
//         [
//             ContractDefTrait::new(DEFAULT_NS(), @"troop_management_systems")
//                 .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
//             ContractDefTrait::new(DEFAULT_NS(), @"troop_movement_systems")
//                 .with_writer_of([dojo::utils::bytearray_hash(DEFAULT_NS())].span()),
//         ]
//             .span()
//     }

//     #[test]
//     fn test_explorer_travel_n() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         let troop_movement_directions = array![
//             Direction::East, Direction::NorthEast, Direction::NorthEast, Direction::NorthEast,
//         ]
//             .span();

//         // explore all tiles in path
//         let mut i = 0;
//         let mut destination_coord: Coord = realm_coord.neighbor(troop_spawn_direction);
//         loop {
//             if i == troop_movement_directions.len() {
//                 break;
//             }

//             destination_coord = destination_coord.neighbor(*troop_movement_directions.at(i));

//             let mut tile: Tile = world.read_model(destination_coord);
//             tile.biome = Biome::Ocean;
//             world.write_model_test(@tile);
//             i += 1;
//         };

//         // set caller address to owner
//         starknet::testing::set_contract_address(owner);

//         // note: no need for below because all directions are Ocean
//         //      and moving on ocean is free (using stamina bonus)
//         //      at the time of writing this test
//         // // move forward 5 ticks to allow explorer enough stamina
//         // starknet::testing::set_block_timestamp(current_tick * 5);

//         // travel to target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, false);

//         // ensure start tile has been unoccupied
//         let start_tile: Coord = realm_coord.neighbor(troop_spawn_direction);
//         let start_tile_occupier: Occupier = world.read_model(start_tile);
//         assert_eq!(start_tile_occupier.occupier, OccupiedBy::None);

//         // ensure intermediate tiles are not occupied
//         let mut i = 0;
//         let mut destination_coord: Coord = start_tile;
//         loop {
//             destination_coord = destination_coord.neighbor(*troop_movement_directions.at(i));
//             // stop before the last tile
//             if i == troop_movement_directions.len() - 1 {
//                 break;
//             }

//             let intermediate_tile_occupier: Occupier = world.read_model(destination_coord);
//             assert_eq!(intermediate_tile_occupier.occupier, OccupiedBy::None);
//             i += 1;
//         };

//         // ensure last tile is occupied by explorer
//         let last_tile_coord: Coord = destination_coord;
//         let last_tile_coord_occupier: Occupier = world.read_model(last_tile_coord);
//         assert_eq!(last_tile_coord_occupier.occupier, OccupiedBy::Explorer(explorer_id));
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.coord, last_tile_coord);

//         // ensure tile has been explored
//         let tile: Tile = world.read_model(explorer.coord);
//         assert_eq!(tile.discovered(), true);
//         assert_eq!(tile.biome, Biome::Ocean);

//         // ensure occupier is explorer
//         let occupier: Occupier = world.read_model(explorer.coord);
//         assert_eq!(occupier.occupier, OccupiedBy::Explorer(explorer_id));

//         // ensure stamina has been spent
//         // moving to Ocean tile subtracts `bonus_value` from `travel_stamina_cost`
//         let stamina_cost: u64 = MOCK_TROOP_STAMINA_CONFIG().stamina_travel_stamina_cost.into()
//             - MOCK_TROOP_STAMINA_CONFIG().stamina_bonus_value.into();
//         let stamina_initial: u64 = MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into();
//         assert_eq!(explorer.troops.stamina.amount, stamina_initial - stamina_cost);

//         // ensure explorer wheat and fish resources have been spent
//         let explorer_wheat_balance_after_explore: u128 = explorer_wheat_amount
//             - (MOCK_TROOP_STAMINA_CONFIG().stamina_travel_wheat_cost.into() * troop_amount);
//         let explorer_fish_balance_after_explore: u128 = explorer_fish_amount
//             - (MOCK_TROOP_STAMINA_CONFIG().stamina_travel_fish_cost.into() * troop_amount);
//         let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         let mut wheat_resource = SingleResourceStoreImpl::retrieve(
//             ref world, explorer_id, ResourceTypes::WHEAT, ref explorer_weight, 100, true,
//         );
//         assert_eq!(wheat_resource.balance, explorer_wheat_balance_after_explore);

//         let mut fish_resource = SingleResourceStoreImpl::retrieve(
//             ref world, explorer_id, ResourceTypes::FISH, ref explorer_weight, 100, true,
//         );
//         assert_eq!(fish_resource.balance, explorer_fish_balance_after_explore);

//         // ensure explorer weight is correct
//         let explorer_wheat_weight = MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT).weight_gram
//             * explorer_wheat_balance_after_explore;
//         let explorer_fish_weight = MOCK_WEIGHT_CONFIG(ResourceTypes::FISH).weight_gram
//             * explorer_fish_balance_after_explore;
//         assert_eq!(explorer_weight.weight, explorer_wheat_weight + explorer_fish_weight);
//     }

//     #[test]
//     #[should_panic(expected: ("one of the tiles in path is not explored", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_travel__fails_tile_not_explored() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // explore all tiles in path except the 3rd tile
//         let troop_movement_directions = array![
//             Direction::East, Direction::NorthEast, Direction::NorthEast, Direction::NorthEast,
//         ]
//             .span();
//         let mut i = 0;
//         let exempt_index = 2; // 3rd tile in path
//         let mut destination_coord: Coord = realm_coord.neighbor(troop_spawn_direction);
//         loop {
//             if i == troop_movement_directions.len() {
//                 break;
//             }

//             destination_coord = destination_coord.neighbor(*troop_movement_directions.at(i));

//             if i == exempt_index {
//                 i += 1;
//                 continue;
//             } else {
//                 let mut tile: Tile = world.read_model(destination_coord);
//                 tile.biome = Biome::Ocean;
//                 world.write_model_test(@tile);
//                 i += 1;
//             }
//         };

//         // set caller address to owner
//         starknet::testing::set_contract_address(owner);

//         // travel to target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, false);
//     }

//     #[test]
//     #[should_panic(expected: ("one of the tiles in path is occupied", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_travel__fails_tile_occupied() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         let troop_movement_directions = array![
//             Direction::East, Direction::NorthEast, Direction::NorthEast, Direction::NorthEast,
//         ]
//             .span();

//         // explore all tiles in path
//         let mut i = 0;
//         let mut destination_coord: Coord = realm_coord.neighbor(troop_spawn_direction);
//         loop {
//             if i == troop_movement_directions.len() {
//                 break;
//             }

//             destination_coord = destination_coord.neighbor(*troop_movement_directions.at(i));

//             let mut tile: Tile = world.read_model(destination_coord);
//             tile.biome = Biome::Ocean;
//             world.write_model_test(@tile);
//             i += 1;
//         };

//         // make third tile occupied by some other entity
//         let mut third_tile_coord: Coord = realm_coord
//             .neighbor(troop_spawn_direction)
//             .neighbor(*troop_movement_directions.at(0))
//             .neighbor(*troop_movement_directions.at(1))
//             .neighbor(*troop_movement_directions.at(2));
//         let mut occupier: Occupier = world.read_model(third_tile_coord);
//         occupier.occupier = OccupiedBy::Structure(1);
//         world.write_model_test(@occupier);

//         // set caller address to owner
//         starknet::testing::set_contract_address(owner);

//         // travel to target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, false);
//     }

//     #[test]
//     fn test_explorer_explore_no_mine() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // set caller address back to owner
//         starknet::testing::set_contract_address(owner);

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::NorthWest].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);

//         // ensure explorer is at the target coordinate
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(
//             explorer.coord, realm_coord.neighbor(troop_spawn_direction).neighbor(*troop_movement_directions.at(0)),
//         );

//         // ensure tile has been explored
//         let tile: Tile = world.read_model(explorer.coord);
//         assert_eq!(tile.discovered(), true);
//         assert_eq!(tile.biome, Biome::Ocean);

//         // ensure previous tile has been unoccupied
//         let previous_occupier: Occupier = world.read_model(realm_coord.neighbor(troop_spawn_direction));
//         assert_eq!(previous_occupier.occupier, OccupiedBy::None);

//         // ensure occupier is explorer
//         let occupier: Occupier = world.read_model(explorer.coord);
//         assert_eq!(occupier.occupier, OccupiedBy::Explorer(explorer_id));

//         // ensure stamina has been spent
//         // moving to Ocean tile subtracts `bonus_value` from `explore_stamina_cost`
//         let stamina_cost: u64 = MOCK_TROOP_STAMINA_CONFIG().stamina_explore_stamina_cost.into()
//             - MOCK_TROOP_STAMINA_CONFIG().stamina_bonus_value.into();
//         let stamina_initial: u64 = MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into();
//         assert_eq!(explorer.troops.stamina.amount, stamina_initial - stamina_cost);

//         // ensure explorer wheat and fish resources have been spent
//         let explorer_wheat_balance_after_explore: u128 = explorer_wheat_amount
//             - (MOCK_TROOP_STAMINA_CONFIG().stamina_explore_wheat_cost.into() * troop_amount);
//         let explorer_fish_balance_after_explore: u128 = explorer_fish_amount
//             - (MOCK_TROOP_STAMINA_CONFIG().stamina_explore_fish_cost.into() * troop_amount);
//         let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         let mut wheat_resource = SingleResourceStoreImpl::retrieve(
//             ref world, explorer_id, ResourceTypes::WHEAT, ref explorer_weight, 100, true,
//         );
//         assert_eq!(wheat_resource.balance, explorer_wheat_balance_after_explore);

//         let mut fish_resource = SingleResourceStoreImpl::retrieve(
//             ref world, explorer_id, ResourceTypes::FISH, ref explorer_weight, 100, true,
//         );
//         assert_eq!(fish_resource.balance, explorer_fish_balance_after_explore);

//         // ensure explorer weight is correct
//         let explorer_wheat_weight = MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT).weight_gram
//             * explorer_wheat_balance_after_explore;
//         let explorer_fish_weight = MOCK_WEIGHT_CONFIG(ResourceTypes::FISH).weight_gram
//             * explorer_fish_balance_after_explore;
//         assert_eq!(explorer_weight.weight, explorer_wheat_weight + explorer_fish_weight);
//     }

//     #[test]
//     fn test_explorer_explore_mine_found() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::EARTHEN_SHARD),
//             ]
//                 .span(),
//         );

//         // ENSURE MINE IS FOUND
//         let mut map_config: MapConfig = MOCK_MAP_CONFIG();
//         map_config.shards_mines_fail_probability = 1;
//         tstore_map_config(ref world, map_config);

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // set caller address back to owner
//         starknet::testing::set_contract_address(owner);

//         // set transaction hash
//         starknet::testing::set_transaction_hash(0x68657920626162792c2074657874206d6521);

//         // explore target coordinate
//         let fragment_mine_id: u32 = world.dispatcher.uuid() + 1;
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::NorthWest].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);

//         // ensure explorer did not move
//         let explorer: ExplorerTroops = world.read_model(explorer_id);
//         assert_eq!(explorer.coord, realm_coord.neighbor(troop_spawn_direction));

//         let from_tile_occupier: Occupier = world.read_model(realm_coord.neighbor(troop_spawn_direction));
//         assert_eq!(from_tile_occupier.occupier, OccupiedBy::Explorer(explorer_id));

//         // ensure fragment mine tile has been explored
//         let tile: Tile = world.read_model(explorer.coord.neighbor(*troop_movement_directions.at(0)));
//         assert_eq!(tile.discovered(), true);
//         assert_eq!(tile.biome, Biome::Ocean);

//         // ensure fragment mine structure was created
//         let fragment_mine: Structure = world.read_model(fragment_mine_id);
//         assert_eq!(fragment_mine.base.category, StructureCategory::FragmentMine.into());

//         // ensure fragment mine tile occupier is occupied by fragment mine
//         assert_eq!(fragment_mine.base.coord(), explorer.coord.neighbor(*troop_movement_directions.at(0)));
//         let to_tile_occupier: Occupier = world.read_model(fragment_mine.base.coord());
//         assert_eq!(to_tile_occupier.occupier, OccupiedBy::Structure(fragment_mine_id));

//         // ensure fragment mine has guards and they are within mercenaries bounds
//         assert_ge!(
//             fragment_mine.troop_guards.delta.count,
//             MOCK_TROOP_LIMIT_CONFIG().mercenaries_troop_lower_bound.into() * RESOURCE_PRECISION,
//         );
//         assert_le!(
//             fragment_mine.troop_guards.delta.count,
//             MOCK_TROOP_LIMIT_CONFIG().mercenaries_troop_upper_bound.into() * RESOURCE_PRECISION,
//         );

//         // ensure stamina has been spent
//         // discovering Ocean tile subtracts `bonus_value` from `explore_stamina_cost`
//         let stamina_cost: u64 = MOCK_TROOP_STAMINA_CONFIG().stamina_explore_stamina_cost.into()
//             - MOCK_TROOP_STAMINA_CONFIG().stamina_bonus_value.into();
//         let stamina_initial: u64 = MOCK_TROOP_STAMINA_CONFIG().stamina_initial.into();
//         assert_eq!(explorer.troops.stamina.amount, stamina_initial - stamina_cost);

//         // ensure explorer wheat and fish resources have been spent for exploration
//         let explorer_wheat_balance_after_explore: u128 = explorer_wheat_amount
//             - (MOCK_TROOP_STAMINA_CONFIG().stamina_explore_wheat_cost.into() * troop_amount);
//         let explorer_fish_balance_after_explore: u128 = explorer_fish_amount
//             - (MOCK_TROOP_STAMINA_CONFIG().stamina_explore_fish_cost.into() * troop_amount);
//         let mut explorer_weight: Weight = WeightStoreImpl::retrieve(ref world, explorer_id);
//         let mut wheat_resource = SingleResourceStoreImpl::retrieve(
//             ref world, explorer_id, ResourceTypes::WHEAT, ref explorer_weight, 100, true,
//         );
//         assert_eq!(wheat_resource.balance, explorer_wheat_balance_after_explore);

//         let mut fish_resource = SingleResourceStoreImpl::retrieve(
//             ref world, explorer_id, ResourceTypes::FISH, ref explorer_weight, 100, true,
//         );
//         assert_eq!(fish_resource.balance, explorer_fish_balance_after_explore);

//         // ensure explorer weight is correct
//         let explorer_wheat_weight = MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT).weight_gram
//             * explorer_wheat_balance_after_explore;
//         let explorer_fish_weight = MOCK_WEIGHT_CONFIG(ResourceTypes::FISH).weight_gram
//             * explorer_fish_balance_after_explore;
//         assert_eq!(explorer_weight.weight, explorer_wheat_weight + explorer_fish_weight);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer can only move one direction when exploring", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_explore__fails_more_than_one_direction() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // set caller address back to owner
//         starknet::testing::set_contract_address(owner);

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::NorthWest, Direction::East].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);
//     }

//     #[test]
//     #[should_panic(expected: ("tile is already explored", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_explore__fails_tile_already_explored() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // set tile as explored
//         let troop_movement_directions = array![Direction::East].span();
//         let mut tile: Tile = world
//             .read_model(realm_coord.neighbor(troop_spawn_direction).neighbor(*troop_movement_directions.at(0)));
//         tile.biome = Biome::Ocean;
//         world.write_model_test(@tile);

//         // set caller address back to owner
//         starknet::testing::set_contract_address(owner);

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);
//     }

//     #[test]
//     #[should_panic(expected: ('Not Owner', 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_move__fails_not_owner() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // set caller address to an unknown address
//         starknet::testing::set_contract_address(starknet::contract_address_const::<'unknown'>());

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::East].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);
//     }

//     #[test]
//     #[should_panic(expected: ("explorer is dead", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_move__fails_explorer_dead() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // set explorer as dead
//         let mut explorer: ExplorerTroops = world.read_model(explorer_id);
//         explorer.troops.count = 0;
//         world.write_model_test(@explorer);

//         // set caller address to owner
//         starknet::testing::set_contract_address(owner);

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::East].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);
//     }

//     #[test]
//     #[should_panic(expected: ("insufficient stamina, you need: 10, and have: 0", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_move__fails_insufficient_stamina() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // set explorer as dead
//         let mut explorer: ExplorerTroops = world.read_model(explorer_id);
//         explorer.troops.stamina.amount = 0;
//         world.write_model_test(@explorer);

//         // set caller address to owner
//         starknet::testing::set_contract_address(owner);

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::East].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);
//     }

//     #[test]
//     #[should_panic(
//         expected: ("Insufficient Balance: WHEAT (id: 3, balance: 0) < 1000000000000000", 'ENTRYPOINT_FAILED'),
//     )]
//     fn test_explorer_move__fails_insufficient_wheat() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         // let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![ // (ResourceTypes::WHEAT, explorer_wheat_amount),
//             (ResourceTypes::FISH, explorer_fish_amount)]
//                 .span(),
//         );

//         // set caller address to owner
//         starknet::testing::set_contract_address(owner);

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::East].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);
//     }

//     #[test]
//     #[should_panic(expected: ("Insufficient Balance: FISH (id: 3, balance: 0) < 500000000000000",
//     'ENTRYPOINT_FAILED'))]
//     fn test_explorer_move__fails_insufficient_fish() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         // let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount) // (ResourceTypes::FISH, explorer_fish_amount)
//             ].span(),
//         );

//         // set caller address to owner
//         starknet::testing::set_contract_address(owner);

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![Direction::East].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);
//     }

//     #[test]
//     #[should_panic(expected: ("directions must be more than 0", 'ENTRYPOINT_FAILED'))]
//     fn test_explorer_move__fails_at_least_one_direction() {
//         // spawn world
//         let mut world = tspawn_world(namespace_def(), contract_defs());

//         // set weight config
//         tstore_capacity_config(ref world, MOCK_CAPACITY_CONFIG());
//         tstore_tick_config(ref world, MOCK_TICK_CONFIG());
//         tstore_troop_limit_config(ref world, MOCK_TROOP_LIMIT_CONFIG());
//         tstore_troop_stamina_config(ref world, MOCK_TROOP_STAMINA_CONFIG());
//         tstore_troop_damage_config(ref world, MOCK_TROOP_DAMAGE_CONFIG());
//         tstore_weight_config(
//             ref world,
//             array![
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::KNIGHT_T1),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::WHEAT),
//                 MOCK_WEIGHT_CONFIG(ResourceTypes::FISH),
//             ]
//                 .span(),
//         );
//         tstore_map_config(ref world, MOCK_MAP_CONFIG());

//         let owner = starknet::contract_address_const::<'structure_owner'>();
//         let realm_coord = Coord { x: 1, y: 1 };
//         let realm_entity_id = tspawn_simple_realm(ref world, 1, owner, realm_coord);
//         let (troop_management_system_addr, _) = world.dns(@"troop_management_systems").unwrap();
//         let (troop_movement_system_addr, _) = world.dns(@"troop_movement_systems").unwrap();
//         let troop_amount: u128 = MOCK_TROOP_LIMIT_CONFIG().explorer_guard_max_troop_count.into() *
//         RESOURCE_PRECISION;

//         // grant troop resources to the structure to be able to create troops
//         tgrant_resources(ref world, realm_entity_id, array![(ResourceTypes::KNIGHT_T1, troop_amount)].span());

//         // set current tick
//         let mut current_tick = MOCK_TICK_CONFIG().armies_tick_in_seconds;
//         starknet::testing::set_block_timestamp(current_tick);

//         // set caller address before calling the contract
//         starknet::testing::set_contract_address(owner);

//         // create explorer
//         let troop_management_systems = ITroopManagementSystemsDispatcher {
//             contract_address: troop_management_system_addr,
//         };
//         let troop_spawn_direction = Direction::NorthWest;
//         let explorer_id = troop_management_systems
//             .explorer_create(realm_entity_id, TroopType::Knight, TroopTier::T1, troop_amount, troop_spawn_direction);

//         // grant food resources to the explorer
//         starknet::testing::set_contract_address(Zero::zero());
//         let explorer_wheat_amount: u128 = troop_amount * 5;
//         let explorer_fish_amount: u128 = troop_amount * 5;
//         tgrant_resources(
//             ref world,
//             explorer_id,
//             array![(ResourceTypes::WHEAT, explorer_wheat_amount), (ResourceTypes::FISH,
//             explorer_fish_amount)].span(),
//         );

//         // set caller address to owner
//         starknet::testing::set_contract_address(owner);

//         // explore target coordinate
//         let troop_movement_systems = ITroopMovementSystemsDispatcher { contract_address: troop_movement_system_addr
//         };
//         let troop_movement_directions = array![].span();
//         troop_movement_systems.explorer_move(explorer_id, troop_movement_directions, true);
//     }
// }
