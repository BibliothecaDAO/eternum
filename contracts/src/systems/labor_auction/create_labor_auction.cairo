#[system]
mod CreateLaborAuction {
    use eternum::models::labor_auction::{LaborAuction, LaborAuctionTrait};

    use dojo::world::Context;

    fn execute(ctx: Context, decay_constant: u128, per_time_unit: u128, price_update_interval: u128) {
        let start_time = starknet::get_block_timestamp();

        let mut zone: u8 = 1;

        loop {
            if zone > 10 {
                break;
            }

            let auction = LaborAuction {
                zone,
                decay_constant_mag: decay_constant,
                decay_constant_sign: false,
                per_time_unit,
                start_time,
                sold: 0,
                price_update_interval,
            };

            set!(ctx.world, (auction));

            zone += 1;
        };
    }
}


#[cfg(test)]
mod tests {
    use eternum::models::labor_auction::{LaborAuction, LaborAuctionTrait};

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
        let decay_constant: u128 = _0_1;
        let per_time_unit: u128 = 50;
        let price_update_interval: u128 = 10;

        let mut calldata = array![];
        Serde::serialize(@decay_constant, ref calldata);
        Serde::serialize(@per_time_unit, ref calldata);
        Serde::serialize(@price_update_interval, ref calldata);
        world.execute('CreateLaborAuction', calldata);

        let labor_auction = get!(world, (zone), LaborAuction);

        assert(labor_auction.zone == zone, 'zone');
        assert(labor_auction.decay_constant_mag == decay_constant, 'decay_constant_mag');
        assert(labor_auction.per_time_unit == per_time_unit, 'per_time_unit');
        assert(labor_auction.sold == 0, 'sold');
        assert(labor_auction.decay_constant_sign == false, 'decay_constant_sign');
        assert(labor_auction.price_update_interval == 10, 'price_update_interval');
    }
}
