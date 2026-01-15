// use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
// use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
// use dojo::world::{WorldStorage, WorldStorageTrait};
// use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
// use crate::alias::ID;
// use crate::constants::{ResourceTypes, get_hyperstructure_construction_resources};
// use crate::models::hyperstructure::{Contribution, Hyperstructure, Progress};
// use crate::models::owner::Owner;
// use crate::models::position::{Coord, Position};
// use crate::models::resource::resource::Resource;
// use crate::models::structure::{Structure, StructureCategory, StructureCount, StructureCountTrait};

// use crate::systems::config::contracts::{
//     IHyperstructureConfig, IHyperstructureConfigDispatcher, IHyperstructureConfigDispatcherTrait, config_systems,
//     config_systems::HyperstructureConfigImpl,
// };

// use crate::systems::hyperstructure::contracts::{
//     IHyperstructureSystems, IHyperstructureSystemsDispatcher, IHyperstructureSystemsDispatcherTrait,
//     hyperstructure_systems,
// };

// use crate::utils::testing::{
//     config::{set_capacity_config, set_settlement_config},
//     general::{get_default_hyperstructure_coord, get_default_realm_pos, spawn_hyperstructure, spawn_realm},
//     systems::{deploy_hyperstructure_systems, deploy_realm_systems, deploy_system}, world::spawn_eternum,
// };

// use starknet::contract_address_const;

// const TEST_AMOUNT: u128 = 1_000_000;
// const TIME_BETWEEN_SHARES_CHANGE: u64 = 1_000;
// const POINTS_PER_CYCLE: u128 = 1_000;
// const POINTS_FOR_WIN: u128 = 3_000_000;
// const POINTS_ON_COMPLETION: u128 = 2_000_000;

// fn setup() -> (WorldStorage, ID, IHyperstructureSystemsDispatcher) {
//     let mut world = spawn_eternum();
//     let config_systems_address = deploy_system(ref world, "config_systems");
//     set_capacity_config(config_systems_address);
//     set_settlement_config(config_systems_address);

//     let hyperstructure_systems_dispatcher = deploy_hyperstructure_systems(ref world);

//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let realm_entity_id = spawn_realm(ref world, 1, get_default_realm_pos().into());

//     let hyperstructure_config_dispatcher = IHyperstructureConfigDispatcher { contract_address: config_systems_address
//     };

//     world
//         .write_model_test(
//             @Resource {
//                 entity_id: realm_entity_id, resource_type: ResourceTypes::EARTHEN_SHARD, balance: TEST_AMOUNT * 10,
//             },
//         );

//     let hyperstructure_construction_resources = get_hyperstructure_construction_resources();
//     let mut i = 0;
//     let mut resources_for_completion = array![(ResourceTypes::EARTHEN_SHARD, TEST_AMOUNT, TEST_AMOUNT)];
//     while (i < hyperstructure_construction_resources.len()) {
//         let resource_type = *hyperstructure_construction_resources.at(i);

//         resources_for_completion.append((resource_type, TEST_AMOUNT, TEST_AMOUNT));

//         world.write_model_test(@Resource { entity_id: realm_entity_id, resource_type, balance: TEST_AMOUNT * 10 });

//         i += 1;
//     };

//     hyperstructure_config_dispatcher
//         .set_hyperstructure_config(
//             resources_for_completion.span(),
//             TIME_BETWEEN_SHARES_CHANGE,
//             POINTS_PER_CYCLE,
//             POINTS_FOR_WIN,
//             POINTS_ON_COMPLETION,
//         );

//     (world, realm_entity_id, hyperstructure_systems_dispatcher)
// }

// #[test]
// #[available_gas(3000000000000)]
// fn hyperstructure_test_create_hyperstructure() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id = spawn_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord(),
//     );

//     let structure: Structure = world.read_model(hyperstructure_entity_id);
//     assert(structure.category == StructureCategory::Hyperstructure, 'invalid category for structure');

//     let structure_count: StructureCount = world.read_model(get_default_hyperstructure_coord());
//     assert(structure_count.count == 1, 'invalid structure count');

//     let hyperstructure_position: Position = world.read_model(hyperstructure_entity_id);
//     assert(hyperstructure_position.x == 0 && hyperstructure_position.y == 0, 'invalid position for hs');

//     let hyperstructure_owner: Owner = world.read_model(hyperstructure_entity_id);
//     assert(hyperstructure_owner.address.try_into().unwrap() == 'player1', 'Not correct owner of hs');

//     let progress: Progress = world.read_model((hyperstructure_entity_id, ResourceTypes::EARTHEN_SHARD));
//     assert(progress.amount == TEST_AMOUNT, 'Invalid progress');

//     let contribution: Contribution = world
//         .read_model((hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::EARTHEN_SHARD));
//     assert(contribution.amount == TEST_AMOUNT, 'Invalid contribution amount');
//     assert(contribution.player_address == contract_address_const::<'player1'>(), 'invalid contribution address');
//     assert(contribution.resource_type == ResourceTypes::EARTHEN_SHARD, 'invalid contribution resource');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(
//     expected: (
//         "not enough resources, Resource (entity id: 1, resource type: EARTHEN SHARD, balance: 0). deduction:
//         1000000", 'ENTRYPOINT_FAILED',
//     ),
// )]
// fn hyperstructure_test_create_hyperstructure_not_enough_eartenshards() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     world
//         .write_model_test(
//             @Resource { entity_id: realm_entity_id, resource_type: ResourceTypes::EARTHEN_SHARD, balance: 0 },
//         );

//     spawn_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord(),
//     );
// }

// #[test]
// #[available_gas(3000000000000)]
// fn hyperstructure_test_contribute_one_resource() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();
//     let contribution_amount = 100_000;

//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id = spawn_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord(),
//     );

//     let contributions = array![(ResourceTypes::WOOD, contribution_amount)].span();
//     hyperstructure_systems_dispatcher
//         .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

//     let wood_contribution: Contribution = world
//         .read_model((hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD));
//     assert(wood_contribution.amount == contribution_amount, 'invalid contribution amount');

//     let wood_progress: Progress = world.read_model((hyperstructure_entity_id, ResourceTypes::WOOD));
//     assert(wood_progress.amount == contribution_amount, 'invalid wood progress');

//     hyperstructure_systems_dispatcher
//         .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);
//     let wood_contribution: Contribution = world
//         .read_model((hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD));
//     assert(wood_contribution.amount == contribution_amount * 2, 'invalid contribution amount');

//     let wood_progress: Progress = world.read_model((hyperstructure_entity_id, ResourceTypes::WOOD));
//     assert(wood_progress.amount == contribution_amount * 2, 'invalid wood progress');
// }

// #[test]
// #[available_gas(3000000000000)]
// fn hyperstructure_test_contribute_two_resources() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();
//     let wood_contribution_amount = 100_000;
//     let stone_contribution_amount = 200_000;

//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id = spawn_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord(),
//     );

//     let contributions = array![
//         (ResourceTypes::WOOD, wood_contribution_amount), (ResourceTypes::STONE, stone_contribution_amount),
//     ]
//         .span();

//     hyperstructure_systems_dispatcher
//         .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

//     let wood_contribution: Contribution = world
//         .read_model((hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD));
//     assert(wood_contribution.amount == wood_contribution_amount, 'invalid contribution amount');

//     let wood_progress: Progress = world.read_model((hyperstructure_entity_id, ResourceTypes::WOOD));
//     assert(wood_progress.amount == wood_contribution_amount, 'invalid wood progress');

//     let stone_contribution: Contribution = world
//         .read_model((hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::STONE));
//     assert(stone_contribution.amount == stone_contribution_amount, 'invalid contribution amount');

//     let stone_progress: Progress = world.read_model((hyperstructure_entity_id, ResourceTypes::STONE));
//     assert(stone_progress.amount == stone_contribution_amount, 'invalid wood progress');

//     // contribute a second time
//     hyperstructure_systems_dispatcher
//         .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions);

//     let wood_contribution: Contribution = world
//         .read_model((hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::WOOD));
//     assert(wood_contribution.amount == wood_contribution_amount * 2, 'invalid contribution amount');

//     let wood_progress: Progress = world.read_model((hyperstructure_entity_id, ResourceTypes::WOOD));
//     assert(wood_progress.amount == wood_contribution_amount * 2, 'invalid wood progress');

//     let stone_contribution: Contribution = world
//         .read_model((hyperstructure_entity_id, contract_address_const::<'player1'>(), ResourceTypes::STONE));
//     assert(stone_contribution.amount == stone_contribution_amount * 2, 'invalid contribution amount');

//     let stone_progress: Progress = world.read_model((hyperstructure_entity_id, ResourceTypes::STONE));
//     assert(stone_progress.amount == stone_contribution_amount * 2, 'invalid wood progress');
// }

// #[test]
// #[available_gas(3000000000000)]
// fn hyperstructure_test_finish_hyperstructure() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id = spawn_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord(),
//     );

//     let hyperstructure_construction_resources = get_hyperstructure_construction_resources();
//     let mut i = 0;
//     let mut contributions = array![];
//     while (i < hyperstructure_construction_resources.len()) {
//         let resource_type = *hyperstructure_construction_resources.at(i);
//         contributions.append((resource_type, TEST_AMOUNT));
//         i += 1;
//     };

//     hyperstructure_systems_dispatcher
//         .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions.span());

//     let hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
//     assert(hyperstructure.completed, 'hyperstructure not completed');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(
//     expected: ("Not enough points to end the game. You have 1999980 points, but need 3000000", 'ENTRYPOINT_FAILED'),
// )]
// fn hyperstructure_test_end_game_failure() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id = spawn_and_finish_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, get_default_hyperstructure_coord(),
//     );

//     hyperstructure_systems_dispatcher.end_game(array![hyperstructure_entity_id].span(), array![].span());
// }

// #[test]
// #[available_gas(3000000000000)]
// fn hyperstructure_test_end_game_success_completion_only() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id_0 = spawn_and_finish_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 0, y: 0 },
//     );

//     let hyperstructure_entity_id_1 = spawn_and_finish_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 1, y: 1 },
//     );

//     hyperstructure_systems_dispatcher
//         .end_game(array![hyperstructure_entity_id_0, hyperstructure_entity_id_1].span(), array![].span());
// }

// #[test]
// #[available_gas(3000000000000)]
// fn hyperstructure_test_end_game_success_completion_and_shares() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id_0 = spawn_and_finish_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 0, y: 0 },
//     );

//     hyperstructure_systems_dispatcher
//         .set_co_owners(hyperstructure_entity_id_0, array![(contract_address_const::<'player1'>(), 10_000)].span());

//     starknet::testing::set_block_timestamp(1001);

//     hyperstructure_systems_dispatcher
//         .end_game(array![hyperstructure_entity_id_0].span(), array![(hyperstructure_entity_id_0, 0)].span());
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(
//     expected: ("Not enough points to end the game. You have 2999980 points, but need 3000000", 'ENTRYPOINT_FAILED'),
// )]
// fn hyperstructure_test_end_game_failure_completion_and_shares() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id_0 = spawn_and_finish_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 0, y: 0 },
//     );

//     hyperstructure_systems_dispatcher
//         .set_co_owners(hyperstructure_entity_id_0, array![(contract_address_const::<'player1'>(), 10_000)].span());

//     starknet::testing::set_block_timestamp(1000);

//     hyperstructure_systems_dispatcher
//         .end_game(array![hyperstructure_entity_id_0].span(), array![(hyperstructure_entity_id_0, 0)].span());
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(
//     expected: ("Not enough points to end the game. You have 0 points, but need 3000000", 'ENTRYPOINT_FAILED'),
// )]
// fn hyperstructure_test_end_game_failure_other_account() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher) = setup();

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id_0 = spawn_and_finish_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 0, y: 0 },
//     );

//     hyperstructure_systems_dispatcher
//         .set_co_owners(hyperstructure_entity_id_0, array![(contract_address_const::<'player1'>(), 10_000)].span());

//     starknet::testing::set_block_timestamp(1001);

//     starknet::testing::set_contract_address(contract_address_const::<'player2'>());
//     hyperstructure_systems_dispatcher
//         .end_game(array![hyperstructure_entity_id_0].span(), array![(hyperstructure_entity_id_0, 0)].span());
// }

// fn spawn_and_finish_hyperstructure(
//     ref world: WorldStorage,
//     hyperstructure_systems_dispatcher: IHyperstructureSystemsDispatcher,
//     realm_entity_id: ID,
//     coord: Coord,
// ) -> ID {
//     let hyperstructure_entity_id = spawn_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, coord,
//     );

//     let hyperstructure_construction_resources = get_hyperstructure_construction_resources();
//     let mut i = 0;
//     let mut contributions = array![];
//     while (i < hyperstructure_construction_resources.len()) {
//         let resource_type = *hyperstructure_construction_resources.at(i);
//         contributions.append((resource_type, TEST_AMOUNT));
//         i += 1;
//     };

//     // + POINTS_ON_COMPLETION (2_000_000)
//     hyperstructure_systems_dispatcher
//         .contribute_to_construction(hyperstructure_entity_id, realm_entity_id, contributions.span());

//     let hyperstructure: Hyperstructure = world.read_model(hyperstructure_entity_id);
//     assert(hyperstructure.completed, 'hyperstructure not completed');

//     hyperstructure_entity_id
// }
