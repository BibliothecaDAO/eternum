use debug::PrintTrait;
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
use eternum::systems::bank::contracts::bank_systems::{
    IBankSystemsDispatcher, IBankSystemsDispatcherTrait
};
use eternum::systems::bank::contracts::liquidity_systems::{
    ILiquiditySystemsDispatcher, ILiquiditySystemsDispatcherTrait,
};
use eternum::systems::bank::contracts::swap_systems::{
    ISwapSystemsDispatcher, ISwapSystemsDispatcherTrait
};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::contracts::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
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

    let owner_fee_scaled: u128 = _0_1;
    let lp_fee_scaled: u128 = _0_1;

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };
    bank_config_dispatcher.set_bank_config(0, lp_fee_scaled);

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

    let player_2_bank_account_entity_id = 420.try_into().unwrap();

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

    // create bank account for second player
    set!(
        world,
        BankAccounts {
            bank_entity_id,
            owner: contract_address_const::<'player2'>(),
            entity_id: player_2_bank_account_entity_id,
        }
    );

    // add some resources inside second player bank account
    // wood
    set!(
        world,
        Resource {
            entity_id: player_2_bank_account_entity_id,
            resource_type: ResourceTypes::WOOD,
            balance: 10000
        }
    );
    // lords
    set!(
        world,
        Resource {
            entity_id: player_2_bank_account_entity_id,
            resource_type: ResourceTypes::LORDS,
            balance: 10000
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
    assert(market.total_shares.mag == 18446744073709551616000, 'market.total_shares');

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

    // state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    // player resources
    let bank_account = get!(world, (bank_entity_id, player), BankAccounts);
    let wood = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::LORDS));

    assert(market.lords_amount == 0, 'market.lords_amount');
    assert(market.resource_amount == 0, 'market.resource_amount');
    assert(market.total_shares.mag == 0, 'market.total_shares');
    assert(liquidity.shares.mag == 0, 'liquidity.shares');
    assert(wood.balance == 10000, 'wood.balance');
    assert(lords.balance == 10000, 'lords.balance');
}

#[test]
fn test_liquidity_buy() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup();

    // bank owner
    let player = starknet::get_caller_address();

    starknet::testing::set_contract_address(contract_address_const::<'player2'>());
    let player2 = starknet::get_contract_address();

    liquidity_systems_dispatcher.add(bank_entity_id, ResourceTypes::WOOD, 1000, 1000);

    // check state
    let liquidity = get!(world, (bank_entity_id, player2, ResourceTypes::WOOD), Liquidity);
    'liquidity.shares'.print();
    liquidity.shares.mag.print();
    assert(liquidity.shares.mag == 18446744073709551616000, 'liquidity.shares');

    // swap
    swap_systems_dispatcher.buy(bank_entity_id, ResourceTypes::WOOD, 500);

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    'market.lords_amount'.print();
    market.lords_amount.print();
    // initial reserves + 1000 (cost) + 100 (fee)
    assert(market.lords_amount == 2099, 'market.lords_amount');
    assert(market.resource_amount == 500, 'market.resource_amount');
    // total shares
    'market.total_shares'.print();
    market.total_shares.mag.print();

    // remove all liquidity
    liquidity_systems_dispatcher.remove(bank_entity_id, ResourceTypes::WOOD, liquidity.shares);

    // check state
    let liquidity = get!(world, (bank_entity_id, player2, ResourceTypes::WOOD), Liquidity);
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);

    // player resources
    let bank_account = get!(world, (bank_entity_id, player2), BankAccounts);
    let wood = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::LORDS));

    assert(market.lords_amount == 0, 'market.lords_amount');
    'market.lords_amount'.print();
    market.lords_amount.print();
    assert(market.resource_amount == 0, 'market.resource_amount');
    'market.resource_amount'.print();
    market.resource_amount.print();
    assert(liquidity.shares.mag == 0, 'liquidity.shares');
    assert(wood.balance == 10000, 'wood.balance');
    'lords.balance'.print();
    lords.balance.print();
    // 10000 lords - 100 lords fee
    assert(lords.balance == 9900, 'lords.balance');

    // bank owner balance
    let owner_bank_account = get!(world, (bank_entity_id, player), BankAccounts);

    let owner_bank_account_lords = ResourceImpl::get(
        world, (owner_bank_account.entity_id, ResourceTypes::LORDS)
    );
    let owner_bank_account_wood = ResourceImpl::get(
        world, (owner_bank_account.entity_id, ResourceTypes::WOOD)
    );
    'owner_bank_account'.print();
    owner_bank_account_lords.balance.print();
    // owner bank account has 10000 lords + 99 lords fees from the swap
    assert(owner_bank_account_lords.balance == 10099, 'owner_lords_balance');
    assert(owner_bank_account_wood.balance == 10000, 'owner_wood_balance');
}


#[test]
fn test_liquidity_sell() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup();

    // bank owner
    let player = starknet::get_caller_address();

    starknet::testing::set_contract_address(contract_address_const::<'player2'>());
    let player2 = starknet::get_contract_address();

    liquidity_systems_dispatcher.add(bank_entity_id, ResourceTypes::WOOD, 1000, 1000);

    // check state
    let liquidity = get!(world, (bank_entity_id, player2, ResourceTypes::WOOD), Liquidity);
    'liquidity.shares'.print();
    liquidity.shares.mag.print();
    assert(liquidity.shares.mag == 18446744073709551616000, 'liquidity.shares');

    // swap
    swap_systems_dispatcher.sell(bank_entity_id, ResourceTypes::WOOD, 500);

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    'market.lords_amount'.print();
    market.lords_amount.print();
    'market.resource_amount'.print();
    market.resource_amount.print();
    // remove 286 lords from the pool and give it to seller
    assert(market.lords_amount == 714, 'market.lords_amount');
    // initial reserves + 449 (input - owner fees)
    assert(market.resource_amount == 1449, 'market.resource_amount');
    // total shares
    'market.total_shares'.print();
    market.total_shares.mag.print();
    
    // player resources
    let bank_account = get!(world, (bank_entity_id, player2), BankAccounts);
    let wood = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::LORDS));
    'player2 account'.print();
    'lords.balance'.print();
    lords.balance.print();
    // 10000 (initial) - 1000 (liquidity) + 286 (payout)
    assert(lords.balance == 9286, 'lords.balance');
    'wood.balance'.print();
    wood.balance.print();
    // 10000 (initial) - 1000 (liquidity) - 500
    assert(wood.balance == 8500, 'wood.balance');

    // remove all liquidity
    liquidity_systems_dispatcher.remove(bank_entity_id, ResourceTypes::WOOD, liquidity.shares);

    // check state
    let liquidity = get!(world, (bank_entity_id, player2, ResourceTypes::WOOD), Liquidity);
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);

    // player resources
    let bank_account = get!(world, (bank_entity_id, player2), BankAccounts);
    let wood = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (bank_account.entity_id, ResourceTypes::LORDS));

    assert(market.lords_amount == 0, 'market.lords_amount');
    'market.lords_amount'.print();
    market.lords_amount.print();
    assert(market.resource_amount == 0, 'market.resource_amount');
    'market.resource_amount'.print();
    market.resource_amount.print();
    assert(liquidity.shares.mag == 0, 'liquidity.shares');
    'wood.balance'.print();
    wood.balance.print();
    // 8500 + 1450 || 10000 (initial) - 51 (fees)
    assert(wood.balance == 9949, 'wood.balance');
    'lords.balance'.print();
    lords.balance.print();
    // 10000 (initial) 
    assert(lords.balance == 10000, 'lords.balance');

    // bank owner balance
    let owner_bank_account = get!(world, (bank_entity_id, player), BankAccounts);

    let owner_bank_account_lords = ResourceImpl::get(
        world, (owner_bank_account.entity_id, ResourceTypes::LORDS)
    );
    let owner_bank_account_wood = ResourceImpl::get(
        world, (owner_bank_account.entity_id, ResourceTypes::WOOD)
    );
    'owner_bank_account'.print();
    owner_bank_account_lords.balance.print();
    owner_bank_account_wood.balance.print();
    assert(owner_bank_account_lords.balance == 10000, 'owner_lords_balance');
    // initial + 49 (fees)
    assert(owner_bank_account_wood.balance == 10049, 'owner_wood_balance');
}


