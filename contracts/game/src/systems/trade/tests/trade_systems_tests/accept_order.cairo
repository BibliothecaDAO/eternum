// use core::array::{ArrayTrait, SpanTrait};
// use core::traits::Into;
// use dojo::model::{ModelStorage, ModelStorageTest, ModelValueStorage};
// use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
// use dojo::world::{WorldStorage, WorldStorageTrait};
// use dojo_cairo_test::{ContractDefTrait, NamespaceDef, TestResource};
// use crate::alias::ID;
// use crate::constants::DONKEY_ENTITY_TYPE;

// use crate::constants::ResourceTypes;
// use crate::models::config::{CapacityCategory, CapacityConfig};
// use crate::models::movable::Movable;
// use crate::models::owner::Owner;
// use crate::models::position::{Coord, Position};
// use crate::models::realm::Realm;
// use crate::models::resource::resource::Resource;

// use crate::models::trade::{Trade, TradeStatus};
// use crate::models::weight::Weight;

// use crate::systems::config::contracts::config_systems;
// use crate::systems::config::contracts::{
//     ICapacityConfigDispatcher, ICapacityConfigDispatcherTrait, ITransportConfigDispatcher,
//     ITransportConfigDispatcherTrait, IWeightConfigDispatcher, IWeightConfigDispatcherTrait,
// };

// use crate::systems::dev::contracts::resource::IResourceSystemsDispatcherTrait;

// use crate::systems::trade::contracts::trade_systems::{
//     ITradeSystemsDispatcher, ITradeSystemsDispatcherTrait, trade_systems,
// };
// use crate::utils::testing::{
//     config::{set_capacity_config, set_settlement_config}, general::{spawn_realm},
//     systems::{deploy_dev_resource_systems, deploy_realm_systems, deploy_system}, world::spawn_eternum,
// };

// use starknet::contract_address_const;

// fn setup(direct_trade: bool) -> (WorldStorage, ID, ID, ID, ITradeSystemsDispatcher) {
//     let mut world = spawn_eternum();

//     let config_systems_address = deploy_system(ref world, "config_systems");
//     let dev_resource_systems = deploy_dev_resource_systems(ref world);

//     set_settlement_config(config_systems_address);
//     set_capacity_config(config_systems_address);

//     // set speed configuration
//     ITransportConfigDispatcher { contract_address: config_systems_address }
//         .set_donkey_speed_config(DONKEY_ENTITY_TYPE, 10); // 10km per sec

//     // set donkey capacity weight_gram
//     ICapacityConfigDispatcher { contract_address: config_systems_address }
//         .set_capacity_config(CapacityConfig { category: CapacityCategory::Donkey, weight_gram: 1_000_000 });

//     // set weight configuration for stone
//     IWeightConfigDispatcher { contract_address: config_systems_address }
//         .set_resource_weight_config(ResourceTypes::STONE.into(), 200);

//     // set weight configuration for gold
//     IWeightConfigDispatcher { contract_address: config_systems_address }
//         .set_resource_weight_config(ResourceTypes::GOLD.into(), 200);

//     // set weight configuration for wood
//     IWeightConfigDispatcher { contract_address: config_systems_address }
//         .set_resource_weight_config(ResourceTypes::WOOD.into(), 200);

//     // set weight configuration for silver
//     IWeightConfigDispatcher { contract_address: config_systems_address }
//         .set_resource_weight_config(ResourceTypes::SILVER.into(), 200);

//     let maker_position = Position { x: 100000, y: 200000, entity_id: 1 };
//     let taker_position = Position { x: 200000, y: 1000000, entity_id: 1 };

//     let maker_realm_entity_id = spawn_realm(ref world, 1, maker_position.into());
//     let taker_realm_entity_id = spawn_realm(ref world, 2, taker_position.into());

//     let maker_id = maker_realm_entity_id;
//     let taker_id = taker_realm_entity_id;

//     world.write_model_test(@Owner { entity_id: maker_id, address: contract_address_const::<'maker'>() });
//     world.write_model_test(@Owner { entity_id: taker_id, address: contract_address_const::<'taker'>() });

//     dev_resource_systems
//         .mint(
//             maker_id,
//             array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100), (ResourceTypes::DONKEY, 20_000)].span(),
//         );
//     dev_resource_systems
//         .mint(
//             taker_id,
//             array![(ResourceTypes::WOOD, 500), (ResourceTypes::SILVER, 500), (ResourceTypes::DONKEY, 20_000)].span(),
//         );

//     starknet::testing::set_contract_address(contract_address_const::<'maker'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());

//     let trade_systems_address = deploy_system(ref world, "trade_systems");
//     let trade_systems_dispatcher = ITradeSystemsDispatcher { contract_address: trade_systems_address };

//     // create order
//     starknet::testing::set_contract_address(contract_address_const::<'maker'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'maker'>());

//     // trade 100 stone and 100 gold for 200 wood and 200 silver
//     // let trade_id = 0;
//     let trade_id = trade_systems_dispatcher
//         .create_order(
//             maker_id,
//             array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100)].span(),
//             taker_id,
//             array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200)].span(),
//             100,
//         );

//     starknet::testing::set_contract_address(contract_address_const::<'taker'>());

//     (world, trade_id, maker_id, taker_id, trade_systems_dispatcher)
// }

// #[test]
// #[available_gas(3000000000000)]
// fn trade_test_accept_order_free_trade() {
//     let (mut world, trade_id, _, taker_id, trade_systems_dispatcher) = setup(false);

//     // accept order
//     trade_systems_dispatcher
//         .accept_order(
//             taker_id,
//             trade_id,
//             array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100)].span(),
//             array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200)].span(),
//         );

//     // check that taker balance is correct
//     let taker_wood_resource: Resource = world.read_model((taker_id, ResourceTypes::WOOD));
//     assert(taker_wood_resource.balance == 300, 'wrong taker balance');

//     let taker_silver_resource: Resource = world.read_model((taker_id, ResourceTypes::SILVER));
//     assert(taker_silver_resource.balance == 300, 'wrong taker balance');

//     let trade: Trade = world.read_model(trade_id);
//     assert(trade.taker_id == taker_id, 'wrong taker id');
//     assert(trade.status == TradeStatus::ACCEPTED, 'wrong trade status');
// }

// #[test]
// #[available_gas(3000000000000)]
// fn trade_test_accept_order_direct_trade() {
//     let (mut world, trade_id, _, taker_id, trade_systems_dispatcher) = setup(true);

//     // accept order
//     trade_systems_dispatcher
//         .accept_order(
//             taker_id,
//             trade_id,
//             array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100)].span(),
//             array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200)].span(),
//         );

//     // check that taker balance is correct
//     let taker_wood_resource: Resource = world.read_model((taker_id, ResourceTypes::WOOD));
//     assert(taker_wood_resource.balance == 300, 'wrong taker balance');

//     let taker_silver_resource: Resource = world.read_model((taker_id, ResourceTypes::SILVER));
//     assert(taker_silver_resource.balance == 300, 'wrong taker balance');

//     let trade: Trade = world.read_model(trade_id);
//     assert(trade.taker_id == taker_id, 'wrong taker id');
//     assert(trade.status == TradeStatus::ACCEPTED, 'wrong trade status');
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('not the taker', 'ENTRYPOINT_FAILED'))]
// fn trade_test_not_trade_taker_id() {
//     let (mut world, trade_id, _, _, trade_systems_dispatcher) = setup(true);

//     // the setup states the trade is a direct offer
//     // so here we are checking to see that the person
//     // who wants to accept is the intended recepient

//     let taker_id = 9999; // set arbitrarily
//     world.write_model_test(@Owner { entity_id: taker_id, address: contract_address_const::<'takers_other_realm'>()
//     });

//     // create order with a caller that isnt the owner of maker_id
//     starknet::testing::set_contract_address(contract_address_const::<'takers_other_realm'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'takers_other_realm'>());

//     // accept order
//     trade_systems_dispatcher
//         .accept_order(
//             taker_id,
//             trade_id,
//             array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100)].span(),
//             array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200)].span(),
//         );
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(expected: ('not owned by caller', 'ENTRYPOINT_FAILED'))]
// fn trade_test_caller_not_taker() {
//     let (_, trade_id, _, taker_id, trade_systems_dispatcher) = setup(true);

//     // create order with a caller that isnt the owner of taker_id
//     starknet::testing::set_contract_address(contract_address_const::<'some_unknown'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'some_unknown'>());

//     // accept order
//     trade_systems_dispatcher
//         .accept_order(
//             taker_id,
//             trade_id,
//             array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100)].span(),
//             array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200)].span(),
//         );
// }

// #[test]
// #[available_gas(3000000000000)]
// #[should_panic(
//     expected: (
//         "not enough resources, Resource (entity id: 3, resource type: DONKEY, balance: 0). deduction: 1000",
//         'ENTRYPOINT_FAILED',
//     ),
// )]
// fn trade_test_transport_not_enough_donkey_capacity() {
//     let (mut world, trade_id, _, taker_id, trade_systems_dispatcher) = setup(true);

//     world.write_model_test(@Resource { entity_id: taker_id, resource_type: ResourceTypes::DONKEY, balance: 0 });

//     starknet::testing::set_contract_address(contract_address_const::<'taker'>());
//     starknet::testing::set_account_contract_address(contract_address_const::<'taker'>());

//     // accept order
//     trade_systems_dispatcher
//         .accept_order(
//             taker_id,
//             trade_id,
//             array![(ResourceTypes::STONE, 100), (ResourceTypes::GOLD, 100)].span(),
//             array![(ResourceTypes::WOOD, 200), (ResourceTypes::SILVER, 200)].span(),
//         );
// }


