
use eternum::models::bank::{Bank, BankAuction, BankAuctionTrait,BankSwapResourceCost};
use eternum::models::position::{Coord, Position};
use eternum::models::resources::{ResourceCost, Resource};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    IBankConfigDispatcher, 
    IBankConfigDispatcherTrait
};
use eternum::utils::testing::{spawn_eternum, deploy_system};
use eternum::constants::ResourceTypes;

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};


const _0_1: u128 = 1844674407370955161; // 0.1

#[test]
#[available_gas(3000000000000)]
fn test_create_bank() {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);

    let bank_config_dispatcher = IBankConfigDispatcher {
        contract_address: config_systems_address
    };


    let bank_id = bank_config_dispatcher.create_bank(
        world,
        Coord {x: 30, y :800},
        array![
            (
                // lords costs 500 wheat and 200 fish
                ResourceTypes::LORDS, 
                array![
                    (ResourceTypes::WHEAT, 500),
                    (ResourceTypes::FISH, 200)
                ].span()
            ),
            (
                // lords costs 700 DRAGONHIDE
                ResourceTypes::LORDS, 
                array![
                    (ResourceTypes::DRAGONHIDE, 700),
                ].span()
            ),
        ].span()
    );

    let bank_position = get!(world, bank_id, Position);
    assert(bank_position.x == 30, 'wrong x position');
    assert(bank_position.y == 800, 'wrong y position');

    // check that fish and wheat cost was added successfully 

    let bank_shekel_swap_cost_1 = get!(world, (ResourceTypes::LORDS, 0), BankSwapResourceCost);
    assert(
        bank_shekel_swap_cost_1.resource_cost_count == 2, 
            'wrong resource cost count'
    );

    let bank_shekel_wheat_cost = get!(world, (bank_shekel_swap_cost_1.resource_cost_id, 0), ResourceCost);
    assert(bank_shekel_wheat_cost.amount == 500, 'wrong wheat cost');

    let bank_shekel_fish_cost = get!(world, (bank_shekel_swap_cost_1.resource_cost_id, 1), ResourceCost);
    assert(bank_shekel_fish_cost.amount == 200, 'wrong fish cost');

    // check that dragonhide cost was added successfully 
    let bank_shekel_swap_cost_2 = get!(world, (ResourceTypes::LORDS, 1), BankSwapResourceCost);
    assert(
        bank_shekel_swap_cost_2.resource_cost_count == 1, 
            'wrong resource cost count'
    );

    let bank_shekel_dragonhide_cost = get!(world, (bank_shekel_swap_cost_2.resource_cost_id, 0), ResourceCost);
    assert(bank_shekel_dragonhide_cost.amount == 700, 'wrong dragonhide cost');
    
}

#[test]
#[available_gas(3000000000000)]
fn test_set_bank_auction() {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);

    let bank_config_dispatcher = IBankConfigDispatcher {
        contract_address: config_systems_address
    };

    let caller = starknet::get_caller_address();
    

    let bank_id: u128 = 1;
    set!(world, Bank {
        entity_id: bank_id,
        exists: true
    });

    starknet::testing::set_contract_address(caller);

    let decay_constant: u128 = _0_1;
    let per_time_unit: u128 = 50;
    let price_update_interval: u128 = 10;

    bank_config_dispatcher.set_bank_auction(
        world,
        bank_id,
        array![
            (ResourceTypes::LORDS, 0),
            (ResourceTypes::DRAGONHIDE, 0)
        ].span(),
        decay_constant,
        per_time_unit,
        price_update_interval
    );

    let bank_shekel_auction = get!(world, (bank_id, ResourceTypes::LORDS, 0), BankAuction);
    assert(bank_shekel_auction.decay_constant_mag == decay_constant, 'decay_constant_mag');
    assert(bank_shekel_auction.per_time_unit == per_time_unit, 'per_time_unit');
    assert(bank_shekel_auction.sold == 0, 'sold');
    assert(bank_shekel_auction.decay_constant_sign == false, 'decay_constant_sign');
    assert(bank_shekel_auction.price_update_interval == 10, 'price_update_interval');


    let bank_dragonhide_auction = get!(world, (bank_id, ResourceTypes::DRAGONHIDE, 0), BankAuction);
    assert(bank_dragonhide_auction.decay_constant_mag == decay_constant, 'decay_constant_mag');
    assert(bank_dragonhide_auction.per_time_unit == per_time_unit, 'per_time_unit');
    assert(bank_dragonhide_auction.sold == 0, 'sold');
    assert(bank_dragonhide_auction.decay_constant_sign == false, 'decay_constant_sign');
    assert(bank_dragonhide_auction.price_update_interval == 10, 'price_update_interval');

}
