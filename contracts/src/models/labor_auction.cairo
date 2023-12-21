use cubit::f128::math::ops::ln;
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use starknet::get_block_timestamp;

use eternum::utils::vrgda::{LinearVRGDA, LinearVRGDATrait};

#[derive(Model, Copy, Drop, Serde)]
struct LaborAuction {
    #[key]
    zone: u8,
    decay_constant_mag: u128,
    decay_constant_sign: bool,
    per_time_unit: u128,
    start_time: u64,
    sold: u128,
    price_update_interval: u128,
}

#[generate_trait]
impl LaborAuctionImpl of LaborAuctionTrait {
    fn to_LinearVRGDA(self: LaborAuction) -> LinearVRGDA {
        LinearVRGDA {
            target_price: FixedTrait::new_unscaled(1, false),
            decay_constant: ln(
                FixedTrait::ONE()
                    - FixedTrait::new(self.decay_constant_mag, self.decay_constant_sign)
            ),
            per_time_unit: FixedTrait::new_unscaled(self.per_time_unit, false)
        }
    }

    fn get_time_since_start_fixed(self: LaborAuction) -> Fixed {
        // time that has passed since auction start
        // 1 period = 1 day
        let time_since_start: u128 = get_block_timestamp().into() - self.start_time.into();
        FixedTrait::new_unscaled(time_since_start / 86400, false)
    }

    fn get_price(self: LaborAuction) -> Fixed {
        // get current price
        self
            .to_LinearVRGDA()
            .get_vrgda_price(
                // 1 period = 1 day
                self.get_time_since_start_fixed(), // time since start
                FixedTrait::new_unscaled(self.sold, false), // amount sold
            )
    }
}


#[cfg(test)]
mod tests {
    use eternum::models::labor_auction::{LaborAuction, LaborAuctionTrait};
    use eternum::utils::vrgda::{LinearVRGDATrait, LinearVRGDA};

    use cubit::f128::math::ops::{ln, abs, exp, pow};

    // testing
    use eternum::utils::testing::spawn_eternum;

    // use dojo_defi when working with nightly
    // use dojo_defi::tests::utils::{assert_rel_approx_eq};

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

    // constants
    const _0_9: u128 = 16602069666338596454; // 0.9
    const _0_1: u128 = 1844674407370955161; // 0.1
    const _1_1111111111: u128 = 20496382303916760194; // 1.111...
    const DELTA_0_0005: u128 = 9223372036854776;

    use cubit::f128::types::fixed::{Fixed, FixedTrait};

    fn assert_rel_approx_eq(a: Fixed, b: Fixed, max_percent_delta: Fixed) {
        if b == FixedTrait::ZERO() {
            assert(a == b, 'a should eq ZERO');
        }
        let percent_delta = if a > b {
            (a - b) / b
        } else {
            (b - a) / b
        };

        assert(percent_delta < max_percent_delta, 'a ~= b not satisfied');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_auction_get_price() {
        let auction = LaborAuction {
            zone: 0,
            decay_constant_mag: _0_1,
            decay_constant_sign: false,
            per_time_unit: 50,
            start_time: 0,
            sold: 50,
            price_update_interval: 10,
        };

        // 2 days in the future
        starknet::testing::set_block_timestamp(172800);

        let price = auction.get_price();

        assert_rel_approx_eq(
            price, FixedTrait::new(_0_9, false), FixedTrait::new(DELTA_0_0005, false)
        )
    }
}
