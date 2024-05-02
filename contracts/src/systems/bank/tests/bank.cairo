use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::bank::bank::BankAccounts;

use eternum::models::position::{Coord};

use eternum::systems::bank::contracts::bank_systems::bank_systems;
use eternum::systems::bank::contracts::bank_systems::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait,};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::contracts::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
use eternum::utils::testing::{spawn_eternum, deploy_system};

use starknet::contract_address_const;

use traits::Into;

const _0_1: u128 = 1844674407370955161; // 0.1

fn setup() -> (IWorldDispatcher, IBankConfigDispatcher, IBankSystemsDispatcher, u128) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

    let owner_fee_scaled: u128 = _0_1;

    let bank_systems_address = deploy_system(world, bank_systems::TEST_CLASS_HASH);
    let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };

    let (bank_entity_id, _) = bank_systems_dispatcher
        .create_bank(1, Coord { x: 30, y: 800 }, owner_fee_scaled);
    // add some resources in the bank account
    (world, bank_config_dispatcher, bank_systems_dispatcher, bank_entity_id)
}


#[test]
fn test_bank_create_account() {
    let (world, _bank_config_dispatcher, bank_systems_dispatcher, bank_entity_id) = setup();

    starknet::testing::set_contract_address(contract_address_const::<'client'>());
    let client = starknet::get_caller_address();
    let ream_entity_id = 1_u128;

    bank_systems_dispatcher.open_account(ream_entity_id, bank_entity_id);

    let account = get!(world, (bank_entity_id, client), BankAccounts);

    assert(account.entity_id == 1, 'account entity id should be 1');
}
