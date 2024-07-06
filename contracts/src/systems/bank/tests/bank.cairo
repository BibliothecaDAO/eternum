use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::models::position::{Coord};

use eternum::systems::bank::contracts::bank::bank_systems;
use eternum::systems::bank::contracts::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait,};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::contracts::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
use eternum::utils::testing::{spawn_eternum, deploy_system};

use starknet::contract_address_const;

use traits::Into;


fn setup() -> (IWorldDispatcher, IBankConfigDispatcher, IBankSystemsDispatcher, u128) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

    let owner_fee_num: u128 = 1;
    let owner_fee_denom: u128 = 10; //10% 

    let bank_systems_address = deploy_system(world, bank_systems::TEST_CLASS_HASH);
    let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };

    let bank_entity_id = bank_systems_dispatcher
        .create_bank(1, Coord { x: 30, y: 800 }, owner_fee_num, owner_fee_denom);
    // add some resources in the bank account
    (world, bank_config_dispatcher, bank_systems_dispatcher, bank_entity_id)
}

