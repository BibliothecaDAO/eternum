use cubit::f128::types::fixed::{Fixed, FixedTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE};
use eternum::models::bank::liquidity::{Liquidity};
use eternum::models::bank::market::{Market, MarketImpl};

use eternum::models::config::{CapacityConfig};


use eternum::models::owner::{Owner};
use eternum::models::position::{Coord};
use eternum::models::resources::{ResourceImpl, Resource};
use eternum::systems::bank::contracts::bank::bank_systems;
use eternum::systems::bank::contracts::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait};

use eternum::systems::bank::contracts::liquidity::liquidity_systems;
use eternum::systems::bank::contracts::liquidity::{
    ILiquiditySystemsDispatcher, ILiquiditySystemsDispatcherTrait,
};
use eternum::systems::bank::contracts::swap::swap_systems;
use eternum::systems::bank::contracts::swap::{ISwapSystemsDispatcher, ISwapSystemsDispatcherTrait};
use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::contracts::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
use eternum::utils::testing::{spawn_eternum, deploy_system};

use starknet::contract_address_const;

use traits::Into;

const FEE_SCALE: u128 = 1844674407370955161; // 0.1
const ONE: u128 = 18446744073709551616; // 1
const INITIAL_RESOURCE_BALANCE: u128 = 10000;
const LIQUIDITY_AMOUNT: u128 = 1000;
const SWAP_AMOUNT: u128 = 500;
const MARKET_TOTAL_SHARES: u128 = 18446744073709551616000;
const PLAYER_2_ID: u128 = 420;
const BANK_COORD_X: u128 = 30;
const BANK_COORD_Y: u128 = 800;
const BANK_ID: u128 = 1;
const DONKEY_CAPACITY: u128 = 1000;

fn setup() -> (
    IWorldDispatcher,
    u128,
    ILiquiditySystemsDispatcher,
    ISwapSystemsDispatcher,
    IBankSystemsDispatcher,
    IBankConfigDispatcher
) {
    let world = spawn_eternum();
    // allows to start from entity_id 1
    let _ = world.uuid();

    let owner_fee_scaled: u128 = FEE_SCALE;
    let lp_fee_scaled: u128 = FEE_SCALE;

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };
    bank_config_dispatcher.set_bank_config(0, lp_fee_scaled);

    let bank_systems_address = deploy_system(world, bank_systems::TEST_CLASS_HASH);
    let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };
    let bank_entity_id = bank_systems_dispatcher
        .create_bank(BANK_ID, Coord { x: BANK_COORD_X, y: BANK_COORD_Y }, owner_fee_scaled);

    let liquidity_systems_address = deploy_system(world, liquidity_systems::TEST_CLASS_HASH);
    let liquidity_systems_dispatcher = ILiquiditySystemsDispatcher {
        contract_address: liquidity_systems_address
    };

    let swap_systems_address = deploy_system(world, swap_systems::TEST_CLASS_HASH);
    let swap_systems_dispatcher = ISwapSystemsDispatcher { contract_address: swap_systems_address };

    let player = starknet::get_contract_address();
    // set owner to player
    set!(world, Owner { entity_id: PLAYER_2_ID, address: player });

    // donkeys capcaity
    set!(
        world,
        (CapacityConfig {
            config_id: WORLD_CONFIG_ID,
            carry_capacity_config_id: DONKEY_ENTITY_TYPE,
            entity_type: DONKEY_ENTITY_TYPE,
            weight_gram: DONKEY_CAPACITY,
        })
    );

    // add some resources inside second player bank account
    // wood
    // lords
    // donkeys
    set!(
        world,
        (
            Resource {
                entity_id: PLAYER_2_ID,
                resource_type: ResourceTypes::WOOD,
                balance: INITIAL_RESOURCE_BALANCE
            },
            Resource {
                entity_id: PLAYER_2_ID,
                resource_type: ResourceTypes::LORDS,
                balance: INITIAL_RESOURCE_BALANCE
            },
            Resource {
                entity_id: PLAYER_2_ID,
                resource_type: ResourceTypes::DONKEY,
                balance: INITIAL_RESOURCE_BALANCE
            },
        )
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

    let player = starknet::get_contract_address();

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
    // player resources
    let wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);

    assert(market.lords_amount == LIQUIDITY_AMOUNT, 'market.lords_amount');
    assert(market.resource_amount == LIQUIDITY_AMOUNT, 'market.resource_amount');
    assert(market.total_shares.mag == MARKET_TOTAL_SHARES, 'market.total_shares');

    assert(
        liquidity.shares == FixedTrait::new_unscaled(LIQUIDITY_AMOUNT, false), 'liquidity.shares'
    );

    assert(wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'wood.balance');
    assert(lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'lords.balance');
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

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    let donkey_id = liquidity_systems_dispatcher
        .remove(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, liquidity.shares);

    // state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    // player resources
    let donkey_wood = ResourceImpl::get(world, (donkey_id, ResourceTypes::WOOD));
    let donkey_lords = ResourceImpl::get(world, (donkey_id, ResourceTypes::LORDS));
    let player_wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let player_lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));

    // should have a donkey with resources coming your way
    assert(donkey_wood.balance == LIQUIDITY_AMOUNT, 'donkey wood.balance');
    assert(donkey_lords.balance == LIQUIDITY_AMOUNT, 'donkey lords.balance');
    assert(
        player_wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'player wood.balance'
    );
    assert(
        player_lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'player lords.balance'
    );

    assert(market.lords_amount == 0, 'market.lords_amount');
    assert(market.resource_amount == 0, 'market.resource_amount');
    assert(market.total_shares.mag == 0, 'market.total_shares');
    assert(liquidity.shares.mag == 0, 'liquidity.shares');
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

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

    // check state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    assert(liquidity.shares.mag == MARKET_TOTAL_SHARES, 'liquidity.shares');
    // swap
    let donkey_1_id = swap_systems_dispatcher
        .buy(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    // initial reserves + 1000 (cost) + 99 (fee)
    assert(market.lords_amount == 2099, 'market.lords_amount');
    assert(market.resource_amount == SWAP_AMOUNT, 'market.resource_amount');

    // remove all liquidity
    let donkey_2_id = liquidity_systems_dispatcher
        .remove(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, liquidity.shares);

    // check state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);

    // player resources
    // are on donkey
    let donkey_1_wood = ResourceImpl::get(world, (donkey_1_id, ResourceTypes::WOOD));
    let donkey_1_lords = ResourceImpl::get(world, (donkey_1_id, ResourceTypes::LORDS));
    assert(donkey_1_wood.balance == SWAP_AMOUNT, 'wood donkey 1');
    assert(donkey_1_lords.balance == 0, 'lords donkey 1');

    let donkey_2_wood = ResourceImpl::get(world, (donkey_2_id, ResourceTypes::WOOD));
    let donkey_2_lords = ResourceImpl::get(world, (donkey_2_id, ResourceTypes::LORDS));
    assert(donkey_2_wood.balance == LIQUIDITY_AMOUNT - SWAP_AMOUNT, 'wood donkey 2');
    assert(donkey_2_lords.balance == 2099, 'lords donkey 2');

    let player_wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let player_lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));
    assert(player_wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'player wood');
    // 10000 - 1000 (liquidity) - 1000 (payout) - 199 (fees)
    assert(player_lords.balance == 7801, 'player lords');

    assert(market.lords_amount == 0, 'market.lords_amount');
    assert(market.resource_amount == 0, 'market.resource_amount');
    assert(liquidity.shares.mag == 0, 'liquidity.shares');

    // owner bank account
    let bank_lords = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
    let bank_wood = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::WOOD));
    // bank has 99 lords fees from the swap
    assert(bank_lords.balance == 99, 'bank lords');
    assert(bank_wood.balance == 0, 'bank wood');
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

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

    // check state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    assert(liquidity.shares.mag == MARKET_TOTAL_SHARES, 'liquidity.shares');

    // swap
    let donkey_1_id = swap_systems_dispatcher
        .sell(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    // remove 286 lords from the pool and give it to seller
    assert(market.lords_amount == 714, 'market.lords_amount');
    // initial reserves + 449 (input - owner fees)
    assert(market.resource_amount == 1449, 'market.resource_amount');

    // player resources
    let wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));

    // remove all liquidity
    let donkey_2_id = liquidity_systems_dispatcher
        .remove(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, liquidity.shares);

    // check state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);

    // player resources
    // are on donkey
    let donkey_1_wood = ResourceImpl::get(world, (donkey_1_id, ResourceTypes::WOOD));
    let donkey_1_lords = ResourceImpl::get(world, (donkey_1_id, ResourceTypes::LORDS));
    assert(donkey_1_wood.balance == 0, 'wood donkey 1');
    assert(donkey_1_lords.balance == 286, 'lords donkey 1');

    let donkey_2_wood = ResourceImpl::get(world, (donkey_2_id, ResourceTypes::WOOD));
    let donkey_2_lords = ResourceImpl::get(world, (donkey_2_id, ResourceTypes::LORDS));
    // 51 are the fees paid to the bank
    assert(donkey_2_wood.balance == LIQUIDITY_AMOUNT + SWAP_AMOUNT - 51, 'wood donkey 2');
    assert(donkey_2_lords.balance == LIQUIDITY_AMOUNT - 286, 'lords donkey 2');

    let player_wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let player_lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));
    assert(
        player_wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT - SWAP_AMOUNT,
        'player wood'
    );
    // 10000 - 1000 (liquidity)
    assert(player_lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'player lords');

    assert(market.lords_amount == 0, 'market.lords_amount');
    assert(market.resource_amount == 0, 'market.resource_amount');
    assert(liquidity.shares.mag == 0, 'liquidity.shares');

    // owner bank account
    let bank_lords = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
    let bank_wood = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::WOOD));
    // bank has 49 wood fees from the swap
    assert(bank_lords.balance == 0, 'bank lords');
    assert(bank_wood.balance == 49, 'bank wood');
}
