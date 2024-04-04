use eternum::utils::testing::{spawn_eternum, deploy_system};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};

use eternum::systems::bank::contracts::bank_systems::bank_systems;
use eternum::systems::bank::interface::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait,};

use eternum::models::position::{Coord};
use eternum::models::bank::bank::BankAccounts;

use starknet::contract_address_const;

use traits::Into;

const _0_1: u128 = 1844674407370955161; // 0.1

fn setup() -> (IWorldDispatcher, IBankConfigDispatcher, IBankSystemsDispatcher, u128) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

    let owner_fee_scaled: u128 = _0_1;

    let bank_entity_id = bank_config_dispatcher
        .create_bank(world, Coord { x: 30, y: 800 }, owner_fee_scaled);

    let bank_systems_address = deploy_system(bank_systems::TEST_CLASS_HASH);
    let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };
    // add some resources in the bank account
    (world, bank_config_dispatcher, bank_systems_dispatcher, bank_entity_id)
}


#[test]
fn test_bank_create_account() {
    let (world, _bank_config_dispatcher, bank_systems_dispatcher, bank_entity_id) = setup();

    let player = starknet::get_caller_address();

    bank_systems_dispatcher.open_account(world, bank_entity_id);

    let account = get!(world, (bank_entity_id, player), BankAccounts);

    assert(account.entity_id == 1, 'account entity id should be 1');
}
