
use eternum::models::labor_auction::{LaborAuction, LaborAuctionTrait};

use eternum::systems::config::contracts::config_systems;
use eternum::systems::config::interface::{
    ILaborConfigDispatcher, 
    ILaborConfigDispatcherTrait
};
use eternum::utils::testing::{spawn_eternum, deploy_system};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};


const _0_1: u128 = 1844674407370955161; // 0.1

#[test]
#[available_gas(3000000000000)]
fn test_set_labor_auction() {
    let world = spawn_eternum();

    let config_systems_address 
        = deploy_system(config_systems::TEST_CLASS_HASH);

    let labor_config_dispatcher = ILaborConfigDispatcher {
        contract_address: config_systems_address
    };

    starknet::testing::set_contract_address(world.executor());

    let zone: u8 = 5;
    let decay_constant: u128 = _0_1;
    let per_time_unit: u128 = 50;
    let price_update_interval: u128 = 10;

    labor_config_dispatcher.set_labor_auction(
        world,
        decay_constant,
        per_time_unit,
        price_update_interval
    );

    let labor_auction = get!(world, (zone), LaborAuction);

    assert(labor_auction.zone == zone, 'zone');
    assert(labor_auction.decay_constant_mag == decay_constant, 'decay_constant_mag');
    assert(labor_auction.per_time_unit == per_time_unit, 'per_time_unit');
    assert(labor_auction.sold == 0, 'sold');
    assert(labor_auction.decay_constant_sign == false, 'decay_constant_sign');
    assert(labor_auction.price_update_interval == 10, 'price_update_interval');
}
