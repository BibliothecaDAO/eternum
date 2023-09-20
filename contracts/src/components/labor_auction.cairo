use cubit::f128::math::core::{ln, abs, exp, pow};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use starknet::{ContractAddress, get_block_timestamp};
use dojo_defi::dutch_auction::vrgda::{LinearVRGDA, LinearVRGDATrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};


#[derive(Component, Copy, Drop, Serde, SerdeLen)]
struct LaborAuction {
    #[key]
    resource_type: u8,
    #[key]
    zone: u8,
    target_price: u128,
    decay_constant_mag: u128,
    decay_constant_sign: bool,
    per_time_unit: u128,
    start_time: u64,
    sold: u128,
}

#[generate_trait]
impl LaborAuctionImpl of LaborAuctionTrait {
    fn to_LinearVRGDA(self: LaborAuction) -> LinearVRGDA {
        LinearVRGDA {
            target_price: FixedTrait::new_unscaled(self.target_price, false),
            decay_constant: ln(
                FixedTrait::ONE()
                    - FixedTrait::new(self.decay_constant_mag, self.decay_constant_sign)
            ),
            per_time_unit: FixedTrait::new_unscaled(self.per_time_unit, false)
        }
    }

    fn get_price(self: LaborAuction) -> Fixed {
        // time since auction start
        let time_since_start: u128 = get_block_timestamp().into() - self.start_time.into();
        // get current price
        self
            .to_LinearVRGDA()
            .get_vrgda_price(
                // 1 period = 1 day
                FixedTrait::new_unscaled(time_since_start / 86400, false), // time since start
                FixedTrait::new_unscaled(self.sold, false), // amount sold
            )
    }

    fn buy(ref self: LaborAuction, amount: u128, world: IWorldDispatcher) {
        self.sold += amount;
        set!(world, (self));
    }
}


#[cfg(test)]
mod tests {
    use eternum::components::labor_auction::{
        LaborAuction, LaborAuctionTrait, LinearVRGDATrait, LinearVRGDA
    };

    use cubit::f128::math::core::{ln, abs, exp, pow};

    // testing
    use eternum::utils::testing::spawn_eternum;
    use dojo_defi::tests::utils::{assert_rel_approx_eq};
    use debug::PrintTrait;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    // constants
    const _0_1: u128 = 1844674407370955161; // 0.1
    const _11_1111111111: u128 = 204963823041012276354;
    const DELTA_0_0005: u128 = 9223372036854776;

    use cubit::f128::types::fixed::{Fixed, FixedTrait};

    #[test]
    #[available_gas(30000000)]
    fn test_auction_get_price() {
        let auction = LaborAuction {
            resource_type: 0,
            zone: 0,
            target_price: 10,
            decay_constant_mag: _0_1,
            decay_constant_sign: false,
            per_time_unit: 50,
            start_time: 0,
            sold: 50,
        };

        // 2 days in the future
        starknet::testing::set_block_timestamp(172800);

        let price = auction.get_price();
        // assert(price.mag == 169556217585565105770, 'price is wrong');

        assert_rel_approx_eq(
            price, FixedTrait::new_unscaled(9, false), FixedTrait::new(DELTA_0_0005, false)
        )
    }

    #[test]
    #[available_gas(30000000)]
    fn test_auction_buy() {
        let world = spawn_eternum();
        starknet::testing::set_contract_address(world.executor());

        let mut auction = LaborAuction {
            resource_type: 1,
            zone: 1,
            target_price: 10,
            decay_constant_mag: _0_1,
            decay_constant_sign: false,
            per_time_unit: 50,
            start_time: 0,
            sold: 50,
        };

        set!(world, (auction));

        // advance time to 1 day
        starknet::testing::set_block_timestamp(86400);

        // buy all remaining labor
        auction.buy(50, world);

        let auction = get!(world, (1, 1), LaborAuction);
        assert(auction.sold == 100, 'sold is wrong');

        let price = auction.get_price();

        assert_rel_approx_eq(
            price, FixedTrait::new(_11_1111111111, false), FixedTrait::new(DELTA_0_0005, false)
        )
    }
}
