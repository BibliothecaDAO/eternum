// use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
// use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
// use dojo::world::{WorldStorage, WorldStorageTrait};
// use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
// use crate::alias::ID;
// use crate::constants::{ResourceTypes, WORLD_CONFIG_ID, get_hyperstructure_construction_resources};
// use crate::models::hyperstructure::{Contribution, Hyperstructure, Progress};
// use crate::models::owner::Owner;
// use crate::models::position::{Coord, Position};
// use crate::models::resource::resource::Resource;
// use crate::models::season::{Leaderboard, LeaderboardEntry, LeaderboardEntryImpl};
// use crate::models::structure::{Structure, StructureCategory};
// use crate::systems::config::contracts::{
//     IHyperstructureConfig, IHyperstructureConfigDispatcher, IHyperstructureConfigDispatcherTrait, config_systems,
//     config_systems::HyperstructureConfigImpl,
// };

// use crate::systems::hyperstructure::contracts::{
//     IHyperstructureSystems, IHyperstructureSystemsDispatcher, IHyperstructureSystemsDispatcherTrait,
//     hyperstructure_systems,
// };
// use crate::systems::resources::contracts::resource_bridge_systems::{
//     ERC20ABIDispatcher, ERC20ABIDispatcherTrait, IResourceBridgeSystemsDispatcherTrait,
// };

// use crate::systems::resources::tests::resource_bridge_system_tests::resource_bridge_system_tests::{
//     REALM_OWNER_ADDRESS, SEASON_POOL_ADDRESS, SetupImpl,
// };

// use crate::systems::season::contracts::{
//     ISeasonSystemsDispatcher, ISeasonSystemsDispatcherTrait, season_systems, season_systems::SCALING_FACTOR,
// };

// use crate::utils::testing::{
//     config::{set_capacity_config, set_settlement_config},
//     general::{get_default_hyperstructure_coord, get_default_realm_pos, spawn_hyperstructure, spawn_realm},
//     systems::{deploy_hyperstructure_systems, deploy_realm_systems, deploy_season_systems, deploy_system},
//     world::spawn_eternum,
// };

// use starknet::contract_address_const;

// const TEST_AMOUNT: u128 = 1_000_000;
// const TIME_BETWEEN_SHARES_CHANGE: u64 = 1_000;
// const POINTS_PER_CYCLE: u128 = 1_000;
// const POINTS_FOR_WIN: u128 = 3_000_000;
// const POINTS_ON_COMPLETION: u128 = 2_000_000;

// fn setup() -> (
//     WorldStorage, ID, IHyperstructureSystemsDispatcher, ISeasonSystemsDispatcher, starknet::ContractAddress,
// ) {
//     let mut world = spawn_eternum();
//     let config_systems_address = deploy_system(ref world, "config_systems");
//     set_capacity_config(config_systems_address);
//     set_settlement_config(config_systems_address);

//     let hyperstructure_systems_dispatcher = deploy_hyperstructure_systems(ref world);
//     let (season_systems_dispatcher, season_systems_address) = deploy_season_systems(ref world);

//     let mock_erc20_address = SetupImpl::deploy_mock_erc20(ref world);
//     SetupImpl::setup_bridge_config(ref world, mock_erc20_address);

//     let erc20_dispatcher: ERC20ABIDispatcher = ERC20ABIDispatcher { contract_address: mock_erc20_address };
//     starknet::testing::set_contract_address(REALM_OWNER_ADDRESS());

//     erc20_dispatcher.transfer(SEASON_POOL_ADDRESS(), TEST_AMOUNT.into());
//     starknet::testing::set_contract_address(SEASON_POOL_ADDRESS());
//     erc20_dispatcher.approve(season_systems_address, TEST_AMOUNT.into());

//     let balance: u256 = erc20_dispatcher.balance_of(SEASON_POOL_ADDRESS());
//     assert!(balance > 0, "Season pool balance should be greater than 0");

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

//     (world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher, mock_erc20_address)
// }

// #[test]
// #[available_gas(3000000000000)]
// fn season_test_register_to_leaderboard_success() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher, _) = setup();

//     let (hyperstructures_contributed_to, hyperstructure_shareholder_epochs) = finish_season(
//         ref world, realm_entity_id, hyperstructure_systems_dispatcher,
//     );

//     season_systems_dispatcher
//         .register_to_leaderboard(hyperstructures_contributed_to, hyperstructure_shareholder_epochs);

//     let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
//     assert!(leaderboard.total_points > 0, "Leaderboard total points should be greater than 0");

//     let leaderboard_entry: LeaderboardEntry = LeaderboardEntryImpl::get(
//         ref world, contract_address_const::<'player1'>(),
//     );
//     assert!(leaderboard_entry.points > 0, "Leaderboard entry points should be greater than 0");

//     assert!(
//         leaderboard_entry.points == leaderboard.total_points,
//         "Leaderboard entry points should be equal to leaderboard total points",
//     );
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ("Address already registered points", 'ENTRYPOINT_FAILED'))]
// fn season_test_register_to_leaderboard_multiple_times() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher, _) = setup();

//     let (hyperstructures_contributed_to, hyperstructure_shareholder_epochs) = finish_season(
//         ref world, realm_entity_id, hyperstructure_systems_dispatcher,
//     );

//     season_systems_dispatcher
//         .register_to_leaderboard(hyperstructures_contributed_to, hyperstructure_shareholder_epochs);
//     season_systems_dispatcher
//         .register_to_leaderboard(hyperstructures_contributed_to, hyperstructure_shareholder_epochs);
// }

// #[test]
// #[should_panic(expected: ("Claiming period hasn't started yet", 'ENTRYPOINT_FAILED'))]
// fn season_test_claim_too_early() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher,
//     mock_erc20_address) =
//         setup();

//     let (hyperstructures_contributed_to, hyperstructure_shareholder_epochs) = finish_season(
//         ref world, realm_entity_id, hyperstructure_systems_dispatcher,
//     );

//     season_systems_dispatcher
//         .register_to_leaderboard(hyperstructures_contributed_to, hyperstructure_shareholder_epochs);

//     let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
//     assert!(leaderboard.total_points > 0, "Leaderboard total points should be greater than 0");

//     let leaderboard_entry: LeaderboardEntry = LeaderboardEntryImpl::get(
//         ref world, contract_address_const::<'player1'>(),
//     );
//     assert!(leaderboard_entry.points > 0, "Leaderboard entry points should be greater than 0");

//     assert!(
//         leaderboard_entry.points == leaderboard.total_points,
//         "Leaderboard entry points should be equal to leaderboard total points",
//     );

//     season_systems_dispatcher.claim_leaderboard_rewards(mock_erc20_address);
// }

// #[test]
// fn season_test_claim_success() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher,
//     mock_erc20_address) =
//         setup();

//     let (hyperstructures_contributed_to, hyperstructure_shareholder_epochs) = finish_season(
//         ref world, realm_entity_id, hyperstructure_systems_dispatcher,
//     );

//     season_systems_dispatcher
//         .register_to_leaderboard(hyperstructures_contributed_to, hyperstructure_shareholder_epochs);

//     let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
//     assert!(leaderboard.total_points > 0, "Leaderboard total points should be greater than 0");

//     let leaderboard_entry: LeaderboardEntry = LeaderboardEntryImpl::get(
//         ref world, contract_address_const::<'player1'>(),
//     );
//     assert!(leaderboard_entry.points > 0, "Leaderboard entry points should be greater than 0");

//     assert!(
//         leaderboard_entry.points == leaderboard.total_points,
//         "Leaderboard entry points should be equal to leaderboard total points",
//     );

//     starknet::testing::set_block_timestamp((1001 + SCALING_FACTOR + 1).try_into().unwrap());

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());

//     season_systems_dispatcher.claim_leaderboard_rewards(mock_erc20_address);

//     let balance: u256 = ERC20ABIDispatcher { contract_address: mock_erc20_address }
//         .balance_of(contract_address_const::<'player1'>());
//     assert!(balance > 0, "Player balance should be greater than 0");
// }

// #[test]
// #[should_panic(expected: ("Reward already claimed by caller", 'ENTRYPOINT_FAILED'))]
// fn season_test_claim_twice() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher,
//     mock_erc20_address) =
//         setup();

//     let (hyperstructures_contributed_to, hyperstructure_shareholder_epochs) = finish_season(
//         ref world, realm_entity_id, hyperstructure_systems_dispatcher,
//     );

//     season_systems_dispatcher
//         .register_to_leaderboard(hyperstructures_contributed_to, hyperstructure_shareholder_epochs);

//     let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
//     assert!(leaderboard.total_points > 0, "Leaderboard total points should be greater than 0");

//     let leaderboard_entry: LeaderboardEntry = LeaderboardEntryImpl::get(
//         ref world, contract_address_const::<'player1'>(),
//     );
//     assert!(leaderboard_entry.points > 0, "Leaderboard entry points should be greater than 0");

//     assert!(
//         leaderboard_entry.points == leaderboard.total_points,
//         "Leaderboard entry points should be equal to leaderboard total points",
//     );

//     starknet::testing::set_block_timestamp((1001 + SCALING_FACTOR + 1).try_into().unwrap());

//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());

//     season_systems_dispatcher.claim_leaderboard_rewards(mock_erc20_address);
//     season_systems_dispatcher.claim_leaderboard_rewards(mock_erc20_address);
// }

// #[test]
// #[should_panic(expected: ("Registration period is over", 'ENTRYPOINT_FAILED'))]
// fn season_test_register_too_early() {
//     let (
//         mut _world,
//         _realm_entity_id,
//         _hyperstructure_systems_dispatcher,
//         season_systems_dispatcher,
//         _mock_erc20_address,
//     ) =
//         setup();

//     season_systems_dispatcher.register_to_leaderboard(array![].span(), array![].span());
// }

// #[test]
// #[should_panic(expected: ("Registration period is over", 'ENTRYPOINT_FAILED'))]
// fn season_test_register_too_late() {
//     let (
//         mut world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher,
//         _mock_erc20_address,
//     ) =
//         setup();

//     let (hyperstructures_contributed_to, hyperstructure_shareholder_epochs) = finish_season(
//         ref world, realm_entity_id, hyperstructure_systems_dispatcher,
//     );

//     starknet::testing::set_block_timestamp((1001 + SCALING_FACTOR + 1).try_into().unwrap());

//     season_systems_dispatcher
//         .register_to_leaderboard(hyperstructures_contributed_to, hyperstructure_shareholder_epochs);
// }

// #[test]
// fn season_test_register_with_no_points() {
//     let (
//         mut world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher,
//         _mock_erc20_address,
//     ) =
//         setup();

//     let (_, _) = finish_season(ref world, realm_entity_id, hyperstructure_systems_dispatcher);

//     season_systems_dispatcher.register_to_leaderboard(array![].span(), array![].span());

//     let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
//     assert!(leaderboard.total_points == 0, "Leaderboard total points should be 0");

//     let leaderboard_entry: LeaderboardEntry = LeaderboardEntryImpl::get(
//         ref world, contract_address_const::<'player1'>(),
//     );
//     assert!(leaderboard_entry.points == 0, "Leaderboard entry points should be 0");

//     assert!(
//         leaderboard_entry.points == leaderboard.total_points,
//         "Leaderboard entry points should be equal to leaderboard total points",
//     );
// }

// #[test]
// #[should_panic(expected: ("No points to claim", 'ENTRYPOINT_FAILED'))]
// fn season_test_claim_with_no_points() {
//     let (mut world, realm_entity_id, hyperstructure_systems_dispatcher, season_systems_dispatcher,
//     mock_erc20_address) =
//         setup();

//     let (_, _) = finish_season(ref world, realm_entity_id, hyperstructure_systems_dispatcher);

//     season_systems_dispatcher.register_to_leaderboard(array![].span(), array![].span());

//     let mut leaderboard: Leaderboard = world.read_model(WORLD_CONFIG_ID);
//     assert!(leaderboard.total_points == 0, "Leaderboard total points should be 0");

//     let leaderboard_entry: LeaderboardEntry = LeaderboardEntryImpl::get(
//         ref world, contract_address_const::<'player1'>(),
//     );
//     assert!(leaderboard_entry.points == 0, "Leaderboard entry points should be 0");

//     assert!(
//         leaderboard_entry.points == leaderboard.total_points,
//         "Leaderboard entry points should be equal to leaderboard total points",
//     );

//     starknet::testing::set_block_timestamp((1001 + SCALING_FACTOR + 1).try_into().unwrap());

//     season_systems_dispatcher.claim_leaderboard_rewards(mock_erc20_address);
// }

// fn finish_season(
//     ref world: WorldStorage, realm_entity_id: ID, hyperstructure_systems_dispatcher:
//     IHyperstructureSystemsDispatcher,
// ) -> (Span<ID>, Span<(ID, u16)>) {
//     starknet::testing::set_contract_address(contract_address_const::<'player1'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'player1'>());

//     let hyperstructure_entity_id_0 = spawn_and_finish_hyperstructure(
//         ref world, hyperstructure_systems_dispatcher, realm_entity_id, Coord { x: 0, y: 0 },
//     );

//     hyperstructure_systems_dispatcher
//         .set_co_owners(hyperstructure_entity_id_0, array![(contract_address_const::<'player1'>(), 10_000)].span());

//     starknet::testing::set_block_timestamp(1001);

//     let hyperstructures_contributed_to = array![hyperstructure_entity_id_0].span();
//     let hyperstructure_shareholder_epochs = array![(hyperstructure_entity_id_0, 0)].span();

//     hyperstructure_systems_dispatcher.end_game(hyperstructures_contributed_to, hyperstructure_shareholder_epochs);

//     (hyperstructures_contributed_to, hyperstructure_shareholder_epochs)
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
