#[system]
mod CreateLaborAuction {

    use eternum::components::labor_auction::{LaborAuction, LaborAuctionTrait};

    use dojo::world::Context;

    fn execute(ctx: Context, resource_type: u8, zone: u8, target_price: u128, decay_constant: u128, per_time_unit: u128, realms_count: u128) {
        let start_time = starknet::get_block_timestamp();

        let auction = LaborAuction {
            resource_type,
            zone,
            target_price,
            decay_constant_mag: decay_constant,
            decay_constant_sign: false,
            per_time_unit,
            realms_count,
            start_time,
            bought: 0,
        };

        set!(ctx.world, (auction))
    }
}


#[cfg(test)]
mod tests {
    use eternum::components::labor_auction::{LaborAuction, LaborAuctionTrait};

    use eternum::constants::ResourceTypes;

    // testing
    use eternum::utils::testing::spawn_eternum;
    use debug::PrintTrait;
    
    use dojo::world::Context;
    use dojo::world::{IWorldDispatcher,IWorldDispatcherTrait};

    const _0_1: u128 = 1844674407370955161; // 0.1

    #[test]
    #[available_gas(3000000000000)]  
    fn test_create_labor_auction() {
        let world = spawn_eternum();

        starknet::testing::set_contract_address(world.executor());

        let resource_type: u8 = ResourceTypes::GOLD;
        let zone: u8 = 1;
        let target_price: u128 = 100;
        let decay_constant: u128 = _0_1;
        let per_time_unit: u128 = 50;
        let realms_count: u128 = 0;

        let mut calldata = array![];
        Serde::serialize(@resource_type, ref calldata);
        Serde::serialize(@zone, ref calldata); // end first because order should not matter
        Serde::serialize(@target_price, ref calldata);
        Serde::serialize(@decay_constant, ref calldata);
        Serde::serialize(@per_time_unit, ref calldata);
        Serde::serialize(@realms_count, ref calldata);
        world.execute('CreateLaborAuction', calldata);

        let labor_auction = get!(world, (resource_type, zone), LaborAuction);

        assert(labor_auction.zone == zone, 'zone');
        assert(labor_auction.target_price == target_price, 'target_price');
        assert(labor_auction.decay_constant_mag == decay_constant, 'decay_constant_mag');
        assert(labor_auction.per_time_unit == per_time_unit, 'per_time_unit');
        assert(labor_auction.realms_count == realms_count, 'realms_count');
        assert(labor_auction.bought == 0, 'bought');
        assert(labor_auction.decay_constant_sign == false, 'decay_constant_sign');
        assert(labor_auction.resource_type == resource_type, 'resource_type');
    }

}