use eternum::models::bank::bank::{Bank};
use eternum::models::config::{BankConfig};
use eternum::models::position::{Coord, Position};
use eternum::models::resources::{ResourceCost, Resource};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{IBankConfigDispatcher, IBankConfigDispatcherTrait};
use eternum::utils::testing::{spawn_eternum, deploy_system};
use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};


const _0_1: u128 = 1844674407370955161; // 0.1

#[test]
fn test_create_bank() {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);

    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

    let owner_fee_scaled: u128 = _0_1;

    let bank_entity_id = bank_config_dispatcher
        .create_bank(Coord { x: 30, y: 800 }, owner_fee_scaled);

    let bank_position = get!(world, bank_entity_id, Position);
    assert(bank_position.x == 30, 'wrong x position');
    assert(bank_position.y == 800, 'wrong y position');

    let bank = get!(world, bank_entity_id, Bank);
    assert(bank.owner_fee_scaled == owner_fee_scaled, 'wrong owner_fee_scaled');
}

#[test]
fn test_set_bank_config() {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);

    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

    let lords_cost: u128 = 1000;
    let lp_fee_scaled: u128 = _0_1;

    bank_config_dispatcher.set_bank_config(lords_cost, lp_fee_scaled);

    let bank_config = get!(world, (WORLD_CONFIG_ID), BankConfig);
    assert(bank_config.lords_cost == lords_cost, 'lords_cost');
    assert(bank_config.lp_fee_scaled == lp_fee_scaled, 'lp_fee_scaled');
}
