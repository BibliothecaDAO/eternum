use cubit::f128::types::fixed::{Fixed, FixedTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::{ResourceTypes};
use eternum::models::bank::bank::{BankAccounts};

use eternum::models::bank::liquidity::{Liquidity};
use eternum::models::bank::market::{Market, MarketImpl};
use eternum::models::position::{Coord};
use eternum::models::resources::{ResourceImpl, Resource};
use eternum::systems::bank::contracts::bank_systems::bank_systems;

use eternum::systems::bank::contracts::liquidity_systems::liquidity_systems;
use eternum::systems::bank::contracts::swap_systems::swap_systems;
use eternum::systems::bank::interface::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait};
use eternum::systems::bank::interface::liquidity::{
    ILiquiditySystemsDispatcher, ILiquiditySystemsDispatcherTrait,
};
use eternum::systems::bank::interface::swap::{ISwapSystemsDispatcher, ISwapSystemsDispatcherTrait};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
use eternum::utils::testing::{spawn_eternum, deploy_system};

use starknet::contract_address_const;

use traits::Into;

const _0_1: u128 = 1844674407370955161; // 0.1
const _1: u128 = 18446744073709551616; // 1

fn setup() -> (
    IWorldDispatcher,
    u128,
    ILiquiditySystemsDispatcher,
    ISwapSystemsDispatcher,
    IBankSystemsDispatcher,
    IBankConfigDispatcher
) {
    let world = spawn_eternum();

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };

    let owner_fee_scaled: u128 = _0_1;

    let bank_systems_address = deploy_system(world, bank_systems::TEST_CLASS_HASH);
    let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };

    let (bank_entity_id, bank_account_entity_id) = bank_systems_dispatcher
        .create_bank(1, Coord { x: 30, y: 800 }, owner_fee_scaled);

    let liquidity_systems_address = deploy_system(world, liquidity_systems::TEST_CLASS_HASH);
    let liquidity_systems_dispatcher = ILiquiditySystemsDispatcher {
        contract_address: liquidity_systems_address
    };

    let swap_systems_address = deploy_system(world, swap_systems::TEST_CLASS_HASH);
    let swap_systems_dispatcher = ISwapSystemsDispatcher { contract_address: swap_systems_address };

    // add some resources in the bank account
    // wood
    set!(
        world,
        Resource {
            entity_id: bank_account_entity_id, resource_type: ResourceTypes::WOOD, balance: 10000
        }
    );
    // lords
    set!(
        world,
        Resource {
            entity_id: bank_account_entity_id, resource_type: ResourceTypes::LORDS, balance: 10000
        }
    );

    (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
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
        _swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup();

    liquidity_systems_dispatcher.add(bank_entity_id, ResourceTypes::WOOD, 1000, 1000);

    let player = starknet::get_caller_address();

    // player resources
    let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
    let wood = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::LORDS));

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);

    assert(market.lords_amount == 1000, 'market.lords_amount');
    assert(market.resource_amount == 1000, 'market.resource_amount');
    assert(liquidity.shares == FixedTrait::new_unscaled(1000, false), 'liquidity.shares');
    assert(wood.balance == 9000, 'wood.balance');
    assert(lords.balance == 9000, 'lords.balance');
}

#[test]
fn test_liquidity_remove() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        _swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup();

    let player = starknet::get_caller_address();

    liquidity_systems_dispatcher.add(bank_entity_id, ResourceTypes::WOOD, 1000, 1000);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    liquidity_systems_dispatcher.remove(bank_entity_id, ResourceTypes::WOOD, liquidity.shares);

    // player resources
    let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
    let wood = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::LORDS));
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);

    assert(market.lords_amount == 0, 'market.lords_amount');
    assert(market.resource_amount == 0, 'market.resource_amount');
    assert(liquidity.shares == FixedTrait::new_unscaled(1000, false), 'liquidity.shares');
    assert(wood.balance == 10000, 'wood.balance');
    assert(lords.balance == 10000, 'lords.balance');
}
