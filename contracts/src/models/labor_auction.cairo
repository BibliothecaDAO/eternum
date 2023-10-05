use cubit::f128::math::core::{ln, abs, exp, pow};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use starknet::{ContractAddress, get_block_timestamp};
// TODO: use dojo_defi when works with nightly
// use dojo_defi::dutch_auction::vrgda::{LinearVRGDA, LinearVRGDATrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

/// A Linear Variable Rate Gradual Dutch Auction (VRGDA) struct.
/// Represents an auction where the price decays linearly based on the target price,
/// decay constant, and per-time-unit rate.
#[derive(Copy, Drop, Serde, starknet::Storage)]
struct LinearVRGDA {
    target_price: Fixed,
    decay_constant: Fixed,
    per_time_unit: Fixed,
}

#[generate_trait]
impl LinearVRGDAImpl of LinearVRGDATrait {
    /// Calculates the target sale time based on the quantity sold.
    ///
    /// # Arguments
    ///
    /// * `sold`: Quantity sold.
    ///
    /// # Returns
    ///
    /// * A `Fixed` representing the target sale time.
    fn get_target_sale_time(self: @LinearVRGDA, sold: Fixed) -> Fixed {
        sold / *self.per_time_unit
    }

    /// Calculates the VRGDA price at a specific time since the auction started.
    ///
    /// # Arguments
    ///
    /// * `time_since_start`: Time since the auction started.
    /// * `sold`: Quantity sold.
    ///
    /// # Returns
    ///
    /// * A `Fixed` representing the price.
    fn get_vrgda_price(self: @LinearVRGDA, time_since_start: Fixed, sold: Fixed) -> Fixed {
        *self.target_price
            * exp(
                *self.decay_constant
                    * (time_since_start
                        - self.get_target_sale_time(sold + FixedTrait::new(1, false)))
            )
    }
}


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

    fn sell(ref self: LaborAuction) {
        self.sold += 1;
    }
}


#[cfg(test)]
mod tests {
    use eternum::models::labor_auction::{
        LaborAuction, LaborAuctionTrait, LinearVRGDATrait, LinearVRGDA
    };

    use cubit::f128::math::core::{ln, abs, exp, pow};

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

    #[test]
    #[available_gas(3000000000)]
    fn test_auction_sell() {
        let world = spawn_eternum();
        starknet::testing::set_contract_address(world.executor());

        let mut auction = LaborAuction {
            zone: 1,
            decay_constant_mag: _0_1,
            decay_constant_sign: false,
            per_time_unit: 50,
            start_time: 0,
            sold: 50,
            price_update_interval: 10,
        };

        set!(world, (auction));

        // advance time to 1 day
        starknet::testing::set_block_timestamp(86400);

        // sell all remaining labor
        let mut i: u8 = 1;
        loop {
            if i > 50 {
                break;
            }
            auction.sell();
            i += 1;
        };

        assert(auction.sold == 100, 'sold is wrong');

        let price = auction.get_price();

        assert_rel_approx_eq(
            price, FixedTrait::new(_1_1111111111, false), FixedTrait::new(DELTA_0_0005, false)
        )
    }
}
