use eternum::utils::testing::{spawn_eternum, deploy_system};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

use cubit::f128::types::fixed::{Fixed, FixedTrait};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
use eternum::systems::bank::contracts::bank_systems::bank_systems;
use eternum::systems::bank::interface::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait};

use eternum::systems::bank::contracts::liquidity_systems::liquidity_systems;
use eternum::systems::bank::interface::liquidity::{
    ILiquiditySystemsDispatcher, ILiquiditySystemsDispatcherTrait,
};

use eternum::models::position::{Coord};
use eternum::constants::{ResourceTypes};
use eternum::models::resources::Resource;

use starknet::contract_address_const;

const _0_1: u128 = 1844674407370955161; // 0.1
const _1: u128 = 18446744073709551616; // 1

use debug::PrintTrait;
use traits::Into;

fn setup() -> (
    IWorldDispatcher,
    u128,
    ILiquiditySystemsDispatcher,
    IBankSystemsDispatcher,
    IBankConfigDispatcher
) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(config_systems::TEST_CLASS_HASH);
    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

    let owner_fee_scaled: u128 = _0_1;

    let bank_entity_id = bank_config_dispatcher
        .create_bank(world, Coord { x: 30, y: 800 }, owner_fee_scaled);

    let bank_systems_address = deploy_system(bank_systems::TEST_CLASS_HASH);
    let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };

    let bank_account_entity_id = bank_systems_dispatcher.open_account(world, bank_entity_id);

    let liquidity_systems_address = deploy_system(liquidity_systems::TEST_CLASS_HASH);
    let liquidity_systems_dispatcher = ILiquiditySystemsDispatcher {
        contract_address: liquidity_systems_address
    };

    // add some resources in the bank account
    // wood
    set!(
        world,
        Resource {
            entity_id: bank_account_entity_id, resource_type: ResourceTypes::WOOD, balance: 1000
        }
    );
    // lords
    set!(
        world,
        Resource {
            entity_id: bank_account_entity_id, resource_type: ResourceTypes::LORDS, balance: 1000
        }
    );

    (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        bank_systems_dispatcher,
        bank_config_dispatcher
    )
}

#[test]
fn test_liquidity_add() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup();

    liquidity_systems_dispatcher.add(world, bank_entity_id, ResourceTypes::WOOD, 1000, 1000);
}

#[test]
fn test_liquidity_remove() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup();

    liquidity_systems_dispatcher.add(world, bank_entity_id, ResourceTypes::WOOD, 1000, 1000);
    let shares = FixedTrait::new(_1, false);
    liquidity_systems_dispatcher.remove(world, bank_entity_id, ResourceTypes::WOOD, shares);
}
