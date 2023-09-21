#[system]
mod CreateLaborAuction {
    use eternum::components::labor_auction::{LaborAuction, LaborAuctionTrait};

    use dojo::world::Context;

    fn execute(ctx: Context, decay_constant: u128, per_time_unit: u128) {
        let start_time = starknet::get_block_timestamp();

        let mut zone: u8 = 1;

        loop {
            if zone > 10 {
                break;
            }

            let auction = LaborAuction {
                zone,
                // target_price of 1 because we want to use it as a multiplier for labor costs
                // since there are multiple resources needed for one labor
                target_price: 1,
                decay_constant_mag: decay_constant,
                decay_constant_sign: false,
                per_time_unit,
                start_time,
                sold: 0,
            };

            set!(ctx.world, (auction));

            zone += 1;
        };
    }
}


#[cfg(test)]
mod tests {
    use eternum::components::labor_auction::{LaborAuction, LaborAuctionTrait};

    // testing
    use eternum::utils::testing::spawn_eternum;
    use debug::PrintTrait;

    use dojo::world::Context;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    const _0_1: u128 = 1844674407370955161; // 0.1

    #[test]
    #[available_gas(3000000000000)]
    fn test_create_labor_auction() {
        let world = spawn_eternum();

        starknet::testing::set_contract_address(world.executor());

        let zone: u8 = 5;
        let target_price: u128 = 1;
        let decay_constant: u128 = _0_1;
        let per_time_unit: u128 = 50;

        let mut calldata = array![];
        Serde::serialize(@decay_constant, ref calldata);
        Serde::serialize(@per_time_unit, ref calldata);
        world.execute('CreateLaborAuction', calldata);

        let labor_auction = get!(world, (zone), LaborAuction);

        assert(labor_auction.zone == zone, 'zone');
        assert(labor_auction.target_price == target_price, 'target_price');
        assert(labor_auction.decay_constant_mag == decay_constant, 'decay_constant_mag');
        assert(labor_auction.per_time_unit == per_time_unit, 'per_time_unit');
        assert(labor_auction.sold == 0, 'sold');
        assert(labor_auction.decay_constant_sign == false, 'decay_constant_sign');

        let labor_auction_food = get!(world, (zone), LaborAuction);
        assert(labor_auction_food.zone == zone, 'zone');
        assert(labor_auction_food.target_price == target_price, 'target_price');
        assert(labor_auction_food.decay_constant_mag == decay_constant, 'decay_constant_mag');
        assert(labor_auction_food.per_time_unit == per_time_unit, 'per_time_unit');
        assert(labor_auction_food.sold == 0, 'sold');
        assert(labor_auction_food.decay_constant_sign == false, 'decay_constant_sign');
    }
}
