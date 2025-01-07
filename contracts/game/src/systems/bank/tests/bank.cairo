// use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
// use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
// use dojo::world::{WorldStorage, WorldStorageTrait};
// use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};

// use s0_eternum::alias::ID;

// use s0_eternum::models::position::{Coord};

// use s0_eternum::systems::bank::contracts::bank::bank_systems;
// use s0_eternum::systems::bank::contracts::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait,};

// use s0_eternum::systems::config::contracts::config_systems;
// use s0_eternum::systems::config::contracts::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
// use s0_eternum::utils::testing::{world::spawn_eternum, systems::deploy_system};

// use starknet::contract_address_const;

// use traits::Into;

// fn setup() -> (WorldStorage, IBankConfigDispatcher, IBankSystemsDispatcher, ID) {
//     let mut world = spawn_eternum();

//     let config_systems_address = deploy_system(ref world, "config_systems");
//     let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

//     let owner_fee_num: u128 = 1;
//     let owner_fee_denom: u128 = 10; //10%
//     let owner_bridge_fee_dpt_percent: u16 = 100; // 100/10_000  = 1%
//     let owner_bridge_fee_wtdr_percent: u16 = 100; // 100/10_000  = 1%

//     let bank_systems_address = deploy_system(ref world, "bank_systems");
//     let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };

//     let bank_entity_id = bank_systems_dispatcher
//         .create_bank(
//             1,
//             Coord { x: 30, y: 800 },
//             owner_fee_num,
//             owner_fee_denom,
//             owner_bridge_fee_dpt_percent,
//             owner_bridge_fee_wtdr_percent
//         );
//     // add some resources in the bank account
//     (world, bank_config_dispatcher, bank_systems_dispatcher, bank_entity_id)
// }


