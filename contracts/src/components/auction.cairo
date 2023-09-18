use cubit::f128::math::core::{ln, abs, exp, pow};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use starknet::{ContractAddress, get_block_timestamp};

/// A Linear Variable Rate Gradual Dutch Auction (VRGDA) struct.
/// Represents an auction where the price decays linearly based on the target price,
/// decay constant, and per-time-unit rate.
#[derive(Copy, Drop, Serde, starknet::Storage)]
struct LinearVRGDA {
    target_price: Fixed,
    decay_constant: Fixed,
    // depends on number of realms settled per region
    per_time_unit: Fixed,
}

#[generate_trait]
impl LinearVRGDAImpl of LinearVRGDATrait {
    /// Calculates the target sale time based on the quantity bought.
    ///
    /// # Arguments
    ///
    /// * `bought`: Quantity bought.
    ///
    /// # Returns
    ///
    /// * A `Fixed` representing the target buy time.
    fn get_target_buy_time(self: @LinearVRGDA, bought: Fixed, realms_count: Fixed) -> Fixed {
        bought / (*self.per_time_unit * realms_count)
    }

    /// Calculates the VRGDA price at a specific time since the auction started.
    ///
    /// # Arguments
    ///
    /// * `time_since_start`: Time since the auction started.
    /// * `bought`: Quantity bought.
    ///
    /// # Returns
    ///
    /// * A `Fixed` representing the price.
    fn get_vrgda_price(
        self: @LinearVRGDA, time_since_start: Fixed, bought: Fixed, realms_count: Fixed
    ) -> Fixed {
        // time_since_start = nb of periods since start
        *self.target_price * pow(FixedTrait::new_unscaled(1, false) - *self.decay_constant, time_since_start - self.get_target_buy_time(bought, realms_count))
    }
}

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
    realms_count: u128,
    start_time: u64,
    bought: u128,
}

#[generate_trait]
impl LaborAuctionImpl of LaborAuctionTrait {
    fn to_LinearVRGDA(self: LaborAuction) -> LinearVRGDA {
        LinearVRGDA {
            target_price: FixedTrait::new_unscaled(self.target_price, false),
            decay_constant: FixedTrait::new(self.decay_constant_mag, self.decay_constant_sign),
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
                // DISUCSS: should we floor ?
                FixedTrait::new_unscaled(time_since_start / 86400, false), // time since start
                FixedTrait::new_unscaled(self.bought, false), // amount bought
                FixedTrait::new_unscaled(self.realms_count, false) // number of realms in that zone
            )
    }
}


mod tests {
    use eternum::components::auction::{LaborAuction, LaborAuctionTrait, LinearVRGDATrait, LinearVRGDA};

    const _0_1: u128 = 1844674407370955161; // 0.1

    #[test]
    #[available_gas(30000000)]
    fn test_auction_get_price() {
        let auction = LaborAuction {
            resource_type: 0,
            zone: 0,
            target_price: 10,
            decay_constant_mag: _0_1,
            decay_constant_sign: false,
            per_time_unit: 5,
            realms_count: 10,
            start_time: 0,
            bought: 10,
        };

        starknet::testing::set_block_timestamp(90000);

        let price = auction.get_price();
        assert(price.mag == 169556217585565105770, 'price is wrong');
    }

}

