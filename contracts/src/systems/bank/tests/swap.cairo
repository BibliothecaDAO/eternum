use cubit::f128::types::fixed::{Fixed, FixedTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE};

use eternum::models::bank::liquidity::{Liquidity};
use eternum::models::bank::market::{Market};

use eternum::models::config::{CapacityConfig};
use eternum::models::position::{Coord};
use eternum::models::resources::{Resource, ResourceImpl};
use eternum::systems::bank::contracts::bank::bank_systems;
use eternum::systems::bank::contracts::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait};

use eternum::systems::bank::contracts::liquidity::liquidity_systems;
use eternum::systems::bank::contracts::liquidity::{
    ILiquiditySystemsDispatcher, ILiquiditySystemsDispatcherTrait,
};
use eternum::systems::bank::contracts::swap::swap_systems;
use eternum::systems::bank::contracts::swap::{ISwapSystemsDispatcher, ISwapSystemsDispatcherTrait,};
use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::contracts::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
use eternum::utils::testing::{spawn_eternum, deploy_system};

use starknet::contract_address_const;

use traits::Into;

const _0_1: u128 = 1844674407370955162; // 0.1
const _1: u128 = 18446744073709551616; // 1
const INITIAL_RESOURCE_BALANCE: u128 = 10000;
const LIQUIDITY_AMOUNT: u128 = 1000;
const SWAP_AMOUNT: u128 = 100;
const PLAYER_2_ID: u128 = 420;
const BANK_COORD_X: u128 = 30;
const BANK_COORD_Y: u128 = 800;
const BANK_ID: u128 = 1;
const DONKEY_CAPACITY: u128 = 1000;

fn setup(
    owner_fee_scaled: u128, lp_fee_scaled: u128
) -> (
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

    // add some resources in the player balance
    // wood, lords, donkeys
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
fn test_swap_buy_without_fees() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup(
        0, 0
    );

    let player = starknet::get_caller_address();

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
    let donkey_id = swap_systems_dispatcher
        .buy(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    // donkey resources
    let donkey_wood = ResourceImpl::get(world, (donkey_id, ResourceTypes::WOOD));
    let donkey_lords = ResourceImpl::get(world, (donkey_id, ResourceTypes::LORDS));
    assert(donkey_wood.balance == SWAP_AMOUNT, 'donkey_wood.balance');
    assert(donkey_lords.balance == 0, 'donkey_lords.balance');

    // bank resources
    let bank_wood = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::WOOD));
    let bank_lords = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
    assert(bank_wood.balance == 0, 'bank_wood.balance');
    assert(bank_lords.balance == 0, 'bank_lords.balance');

    // player resources
    let wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));
    assert(wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'wood.balance');
    // 9000 - 111 (lords cost)
    assert(lords.balance == 8889, 'lords.balance');

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);

    assert(market.lords_amount == 1111, 'market.lords_amount');
    assert(market.resource_amount == 900, 'market.resource_amount');
    assert(liquidity.shares == FixedTrait::new_unscaled(1000, false), 'liquidity.shares');
}

#[test]
fn test_swap_buy_with_fees() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup(
        _0_1, _0_1
    );

    let player = starknet::get_caller_address();

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
    let donkey_id = swap_systems_dispatcher
        .buy(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    // donkey resources
    let donkey_wood = ResourceImpl::get(world, (donkey_id, ResourceTypes::WOOD));
    let donkey_lords = ResourceImpl::get(world, (donkey_id, ResourceTypes::LORDS));
    assert(donkey_wood.balance == SWAP_AMOUNT, 'donkey_wood.balance');
    assert(donkey_lords.balance == 0, 'donkey_lords.balance');

    // bank resources
    let bank_wood = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::WOOD));
    let bank_lords = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
    assert(bank_wood.balance == 0, 'bank_wood.balance');
    // 11 fees
    assert(bank_lords.balance == 11, 'bank_lords.balance');

    // player resources
    let wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));
    assert(wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'wood.balance');
    // 9000 - 111 (lords cost) - 11 (bank fees) - 11 (lp fees)
    assert(lords.balance == 8867, 'lords.balance');

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);

    // 1000 (reserve) + 111 (quote) + 11 (fees)
    assert(market.lords_amount == 1122, 'market.lords_amount');
    // 1000 (reserve) - 100 (result)
    assert(market.resource_amount == 900, 'market.resource_amount');
    assert(liquidity.shares == FixedTrait::new_unscaled(1000, false), 'liquidity.shares');
}

#[test]
fn test_swap_sell_without_fees() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup(
        0, 0
    );

    let player = starknet::get_caller_address();

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
    let donkey_id = swap_systems_dispatcher
        .sell(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    // donkey resources
    let donkey_wood = ResourceImpl::get(world, (donkey_id, ResourceTypes::WOOD));
    let donkey_lords = ResourceImpl::get(world, (donkey_id, ResourceTypes::LORDS));
    assert(donkey_wood.balance == 0, 'donkey_wood.balance');
    assert(donkey_lords.balance == 91, 'donkey_lords.balance');

    // bank resources
    let bank_wood = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::WOOD));
    let bank_lords = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
    assert(bank_wood.balance == 0, 'bank_wood.balance');
    assert(bank_lords.balance == 0, 'bank_lords.balance');

    // player resources
    let wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));
    assert(
        wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT - SWAP_AMOUNT, 'wood.balance'
    );
    assert(lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'lords.balance');

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);

    assert(market.lords_amount == 909, 'market.lords_amount');
    assert(market.resource_amount == 1100, 'market.resource_amount');

    assert(liquidity.shares == FixedTrait::new_unscaled(1000, false), 'liquidity.shares');
}

#[test]
fn test_swap_sell_with_fees() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup(
        _0_1, _0_1
    );

    let player = starknet::get_caller_address();

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);
    let donkey_id = swap_systems_dispatcher
        .sell(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    // donkey resources
    let donkey_wood = ResourceImpl::get(world, (donkey_id, ResourceTypes::WOOD));
    let donkey_lords = ResourceImpl::get(world, (donkey_id, ResourceTypes::LORDS));
    assert(donkey_wood.balance == 0, 'donkey_wood.balance');
    assert(donkey_lords.balance == 75, 'donkey_lords.balance');

    // bank resources
    let bank_wood = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::WOOD));
    let bank_lords = ResourceImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
    assert(bank_wood.balance == 10, 'bank_wood.balance');
    assert(bank_lords.balance == 0, 'bank_lords.balance');

    // player resources
    let wood = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let lords = ResourceImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));
    assert(
        wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT - SWAP_AMOUNT, 'wood.balance'
    );
    assert(lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'lords.balance');

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);

    // payout for 80 wood = 75 lords
    assert(market.lords_amount == 925, 'market.lords_amount');
    // reserve wood increase = 100 - 10 (fees)
    assert(market.resource_amount == 1090, 'market.resource_amount');
    assert(liquidity.shares == FixedTrait::new_unscaled(1000, false), 'liquidity.shares');
}
