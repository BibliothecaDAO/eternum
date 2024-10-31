use cubit::f128::types::fixed::{Fixed, FixedTrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::{ResourceTypes, WORLD_CONFIG_ID, DONKEY_ENTITY_TYPE};
use eternum::models::bank::liquidity::{Liquidity};
use eternum::models::bank::market::{Market, MarketCustomImpl};

use eternum::models::config::{CapacityConfig, CapacityConfigCategory};


use eternum::models::owner::{Owner};
use eternum::models::position::{Coord};
use eternum::models::resources::{ResourceCustomImpl, Resource};
use eternum::systems::bank::contracts::bank::bank_systems;
use eternum::systems::bank::contracts::bank::{IBankSystemsDispatcher, IBankSystemsDispatcherTrait};

use eternum::systems::bank::contracts::liquidity::liquidity_systems;
use eternum::systems::bank::contracts::liquidity::{ILiquiditySystemsDispatcher, ILiquiditySystemsDispatcherTrait,};
use eternum::systems::bank::contracts::swap::swap_systems;
use eternum::systems::bank::contracts::swap::{ISwapSystemsDispatcher, ISwapSystemsDispatcherTrait};
use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::contracts::{IBankConfigDispatcher, IBankConfigDispatcherTrait,};
use eternum::utils::testing::{world::spawn_eternum, systems::deploy_system, config::set_capacity_config};

use starknet::contract_address_const;

use traits::Into;

const FEE_NUM: u128 = 1;
const FEE_DENOM: u128 = 10; // 1/ 10 == 10%
const ONE: u128 = 18446744073709551616; // 1
const INITIAL_RESOURCE_BALANCE: u128 = 10_000;
const LIQUIDITY_AMOUNT: u128 = 1000;
const SWAP_AMOUNT: u128 = 500;
const MARKET_TOTAL_SHARES: u128 = 18446744073709551616000;
const PLAYER_2_ID: ID = 420;
const PLAYER_3_ID: ID = 69;
const BANK_COORD_X: u32 = 30;
const BANK_COORD_Y: u32 = 800;
const BANK_ID: ID = 1;
const DONKEY_CAPACITY: u128 = 1000;

fn setup() -> (
    IWorldDispatcher,
    ID,
    ILiquiditySystemsDispatcher,
    ISwapSystemsDispatcher,
    IBankSystemsDispatcher,
    IBankConfigDispatcher
) {
    let world = spawn_eternum();
    // allows to start from entity_id 1
    let _ = world.dispatcher.uuid();

    let owner_fee_num: u128 = FEE_NUM;
    let owner_fee_denom: u128 = FEE_DENOM;

    let lp_fee_num: u128 = FEE_NUM;
    let lp_fee_denom: u128 = FEE_DENOM;

    let config_systems_address = deploy_system(world, config_systems::TEST_CLASS_HASH);
    set_capacity_config(config_systems_address);

    let bank_config_dispatcher = IBankConfigDispatcher { contract_address: config_systems_address };
    bank_config_dispatcher.set_bank_config(0, lp_fee_num, lp_fee_denom);

    let bank_systems_address = deploy_system(world, bank_systems::TEST_CLASS_HASH);
    let bank_systems_dispatcher = IBankSystemsDispatcher { contract_address: bank_systems_address };
    let bank_entity_id = bank_systems_dispatcher
        .create_bank(BANK_ID, Coord { x: BANK_COORD_X, y: BANK_COORD_Y }, owner_fee_num, owner_fee_denom, 0, 0);

    let liquidity_systems_address = deploy_system(world, liquidity_systems::TEST_CLASS_HASH);
    let liquidity_systems_dispatcher = ILiquiditySystemsDispatcher { contract_address: liquidity_systems_address };

    let swap_systems_address = deploy_system(world, swap_systems::TEST_CLASS_HASH);
    let swap_systems_dispatcher = ISwapSystemsDispatcher { contract_address: swap_systems_address };

    let player = starknet::get_contract_address();
    // set owner to player
    set!(world, Owner { entity_id: PLAYER_2_ID, address: player });

    // donkeys capcaity
    set!(world, (CapacityConfig { category: CapacityConfigCategory::Donkey, weight_gram: DONKEY_CAPACITY, }));

    // add some resources inside second player bank account
    // wood
    // lords
    // donkeys
    set!(
        world,
        (
            Resource { entity_id: PLAYER_2_ID, resource_type: ResourceTypes::WOOD, balance: INITIAL_RESOURCE_BALANCE },
            Resource { entity_id: PLAYER_2_ID, resource_type: ResourceTypes::LORDS, balance: INITIAL_RESOURCE_BALANCE },
            Resource {
                entity_id: PLAYER_2_ID, resource_type: ResourceTypes::DONKEY, balance: INITIAL_RESOURCE_BALANCE
            },
        )
    );

    // set owner to player
    set!(world, Owner { entity_id: PLAYER_3_ID, address: contract_address_const::<'player3'>() });

    // player 3
    // add some resources inside third player bank account
    // wood
    // lords
    // donkeys
    set!(
        world,
        (
            Resource { entity_id: PLAYER_3_ID, resource_type: ResourceTypes::WOOD, balance: INITIAL_RESOURCE_BALANCE },
            Resource { entity_id: PLAYER_3_ID, resource_type: ResourceTypes::LORDS, balance: INITIAL_RESOURCE_BALANCE },
            Resource {
                entity_id: PLAYER_3_ID, resource_type: ResourceTypes::DONKEY, balance: INITIAL_RESOURCE_BALANCE
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
fn bank_test_liquidity_add() {
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
    let wood = ResourceCustomImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let lords = ResourceCustomImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);

    assert(market.lords_amount == LIQUIDITY_AMOUNT, 'market.lords_amount');
    assert(market.resource_amount == LIQUIDITY_AMOUNT, 'market.resource_amount');
    assert(market.total_shares.mag == MARKET_TOTAL_SHARES, 'market.total_shares');

    assert(liquidity.shares == FixedTrait::new_unscaled(LIQUIDITY_AMOUNT, false), 'liquidity.shares');

    assert(wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'wood.balance');
    assert(lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'lords.balance');
}

#[test]
fn bank_test_liquidity_remove() {
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
    let donkey_wood = ResourceCustomImpl::get(world, (donkey_id, ResourceTypes::WOOD));
    let donkey_lords = ResourceCustomImpl::get(world, (donkey_id, ResourceTypes::LORDS));
    let player_wood = ResourceCustomImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let player_lords = ResourceCustomImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));

    // should have a donkey with resources coming your way
    assert(donkey_wood.balance == LIQUIDITY_AMOUNT, 'donkey wood.balance');
    assert(donkey_lords.balance == LIQUIDITY_AMOUNT, 'donkey lords.balance');
    assert(player_wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'player wood.balance');
    assert(player_lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'player lords.balance');

    assert(market.lords_amount == 0, 'market.lords_amount');
    assert(market.resource_amount == 0, 'market.resource_amount');
    assert(market.total_shares.mag == 0, 'market.total_shares');
    assert(liquidity.shares.mag == 0, 'liquidity.shares');
}

#[test]
fn bank_test_liquidity_buy() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup();

    // scale by 10 to avoid liquidity issues
    let LIQUIDITY_AMOUNT = LIQUIDITY_AMOUNT * 10;
    let SWAP_AMOUNT = SWAP_AMOUNT * 10;
    let MARKET_TOTAL_SHARES = MARKET_TOTAL_SHARES * 10;
    let INITIAL_RESOURCE_BALANCE = INITIAL_RESOURCE_BALANCE * 10;
    set!(
        world,
        (
            Resource { entity_id: PLAYER_2_ID, resource_type: ResourceTypes::WOOD, balance: INITIAL_RESOURCE_BALANCE },
            Resource { entity_id: PLAYER_2_ID, resource_type: ResourceTypes::LORDS, balance: INITIAL_RESOURCE_BALANCE },
            Resource {
                entity_id: PLAYER_2_ID, resource_type: ResourceTypes::DONKEY, balance: INITIAL_RESOURCE_BALANCE
            },
        )
    );

    // bank owner
    let player = starknet::get_caller_address();

    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

    // check state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    assert(liquidity.shares.mag == MARKET_TOTAL_SHARES, 'liquidity.shares');
    // swap
    let donkey_1_id = swap_systems_dispatcher.buy(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    // initial reserves + 11_112 lords (swap cost (including lp fee))
    assert_eq!(market.lords_amount, 21_112);
    assert(market.resource_amount == SWAP_AMOUNT, 'market.resource_amount');

    // remove all liquidity
    let donkey_2_id = liquidity_systems_dispatcher
        .remove(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, liquidity.shares);

    // check state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);

    // // player resources
    // are on donkey
    let donkey_1_wood = ResourceCustomImpl::get(world, (donkey_1_id, ResourceTypes::WOOD));
    let donkey_1_lords = ResourceCustomImpl::get(world, (donkey_1_id, ResourceTypes::LORDS));
    assert(donkey_1_wood.balance == SWAP_AMOUNT, 'wood donkey 1');
    assert(donkey_1_lords.balance == 0, 'lords donkey 1');

    let donkey_2_wood = ResourceCustomImpl::get(world, (donkey_2_id, ResourceTypes::WOOD));
    let donkey_2_lords = ResourceCustomImpl::get(world, (donkey_2_id, ResourceTypes::LORDS));
    assert(donkey_2_wood.balance == LIQUIDITY_AMOUNT - SWAP_AMOUNT, 'wood donkey 2');
    assert(donkey_2_lords.balance == 21_112, 'lords donkey 2');

    let player_wood = ResourceCustomImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let player_lords = ResourceCustomImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));
    assert(player_wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'player wood');
    // initial 100_000 - 10_000 (liquidity) - 11_112 (payment for swap) - 1_111 (bank fee)
    assert_eq!(player_lords.balance, 77777);

    assert(market.lords_amount == 0, 'market.lords_amount');
    assert(market.resource_amount == 0, 'market.resource_amount');
    assert(liquidity.shares.mag == 0, 'liquidity.shares');

    // owner bank account
    let bank_lords = ResourceCustomImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
    let bank_wood = ResourceCustomImpl::get(world, (bank_entity_id, ResourceTypes::WOOD));
    // bank has 10% of 11_112 = 1111;
    assert_eq!(bank_lords.balance, 1111);
    assert(bank_wood.balance == 0, 'bank wood');
}


#[test]
fn bank_test_liquidity_sell() {
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
    let donkey_1_id = swap_systems_dispatcher.sell(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    assert_eq!(market.lords_amount, 690);
    // initial reserves + sold resouce amount
    assert_eq!(market.resource_amount, 1500);

    // remove all liquidity
    let donkey_2_id = liquidity_systems_dispatcher
        .remove(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, liquidity.shares);

    // check state
    let liquidity = get!(world, (bank_entity_id, player, ResourceTypes::WOOD), Liquidity);
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);

    // player resources
    // are on donkey
    let donkey_1_wood = ResourceCustomImpl::get(world, (donkey_1_id, ResourceTypes::WOOD));
    let donkey_1_lords = ResourceCustomImpl::get(world, (donkey_1_id, ResourceTypes::LORDS));
    assert(donkey_1_wood.balance == 0, 'wood donkey 1');
    assert_eq!(donkey_1_lords.balance, 279);

    let donkey_2_wood = ResourceCustomImpl::get(world, (donkey_2_id, ResourceTypes::WOOD));
    let donkey_2_lords = ResourceCustomImpl::get(world, (donkey_2_id, ResourceTypes::LORDS));
    assert(donkey_2_wood.balance == LIQUIDITY_AMOUNT + SWAP_AMOUNT, 'wood donkey 2');

    // the initial total belonging to player was 310
    // player paid 10% to bank = 31
    // player is left with 310 -31 = 279
    assert(donkey_2_lords.balance == LIQUIDITY_AMOUNT - (279 + 31), 'lords donkey 2');

    let player_wood = ResourceCustomImpl::get(world, (PLAYER_2_ID, ResourceTypes::WOOD));
    let player_lords = ResourceCustomImpl::get(world, (PLAYER_2_ID, ResourceTypes::LORDS));
    assert(player_wood.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT - SWAP_AMOUNT, 'player wood');
    // 10000 - 1000 (liquidity)
    assert(player_lords.balance == INITIAL_RESOURCE_BALANCE - LIQUIDITY_AMOUNT, 'player lords');

    assert(market.lords_amount == 0, 'market.lords_amount');
    assert(market.resource_amount == 0, 'market.resource_amount');
    assert(liquidity.shares.mag == 0, 'liquidity.shares');

    // owner bank account
    let bank_lords = ResourceCustomImpl::get(world, (bank_entity_id, ResourceTypes::LORDS));
    let bank_wood = ResourceCustomImpl::get(world, (bank_entity_id, ResourceTypes::WOOD));
    // bank has 31 lords fee from the swap
    assert(bank_lords.balance == 31, 'bank lords');
    assert(bank_wood.balance == 0, 'bank wood');
}

#[test]
fn bank_test_liquidity_no_drain() {
    let (
        world,
        bank_entity_id,
        liquidity_systems_dispatcher,
        swap_systems_dispatcher,
        _bank_systems_dispatcher,
        _bank_config_dispatcher
    ) =
        setup();

    // original player adds liquidity
    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

    // swap
    swap_systems_dispatcher.sell(bank_entity_id, PLAYER_2_ID, ResourceTypes::WOOD, SWAP_AMOUNT);

    // another player adds liquidity
    starknet::testing::set_contract_address(contract_address_const::<'player3'>());
    starknet::testing::set_account_contract_address(contract_address_const::<'player3'>());
    let player3 = starknet::get_contract_address();

    // get current reserves
    // check state
    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);
    let lords_amount = market.lords_amount;
    let resource_amount = market.resource_amount;

    // new player adds liquidity
    liquidity_systems_dispatcher
        .add(bank_entity_id, PLAYER_3_ID, ResourceTypes::WOOD, LIQUIDITY_AMOUNT, LIQUIDITY_AMOUNT);

    // check state
    let liquidity = get!(world, (bank_entity_id, player3, ResourceTypes::WOOD), Liquidity);
    assert_eq!(liquidity.shares.mag, 12297829382473034410666);
    // new player removes liquidity
    liquidity_systems_dispatcher.remove(bank_entity_id, PLAYER_3_ID, ResourceTypes::WOOD, liquidity.shares);

    let market = get!(world, (bank_entity_id, ResourceTypes::WOOD), Market);

    // check that market amounts hasn't changed
    assert(market.lords_amount == lords_amount + 1, 'market.lords_amount');
    assert(market.resource_amount == resource_amount + 1, 'market.resource_amount');
}

