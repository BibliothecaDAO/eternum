use cubit::f128::math::core::{ln, abs, exp, pow};
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use starknet::{ContractAddress, get_block_timestamp};
use dojo_defi::dutch_auction::vrgda::{LinearVRGDA, LinearVRGDATrait};

use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

// /// A Linear Variable Rate Gradual Dutch Auction (VRGDA) struct.
// /// Represents an auction where the price decays linearly based on the target price,
// /// decay constant, and per-time-unit rate.
// #[derive(Copy, Drop, Serde, starknet::Storage)]
// struct LinearVRGDA {
//     target_price: Fixed,
//     decay_constant: Fixed,
//     // depends on number of realms settled per region
//     per_time_unit: Fixed,
// }

// #[generate_trait]
// impl LinearVRGDAImpl of LinearVRGDATrait {
//     /// Calculates the target sale time based on the quantity bought.
//     ///
//     /// # Arguments
//     ///
//     /// * `bought`: Quantity bought.
//     ///
//     /// # Returns
//     ///
//     /// * A `Fixed` representing the target buy time.
//     fn get_target_buy_time(self: @LinearVRGDA, bought: Fixed) -> Fixed {
//         bought / (*self.per_time_unit)
//     }

//     /// Calculates the VRGDA price at a specific time since the auction started.
//     ///
//     /// # Arguments
//     ///
//     /// * `time_since_start`: Time since the auction started.
//     /// * `bought`: Quantity bought.
//     ///
//     /// # Returns
//     ///
//     /// * A `Fixed` representing the price.
//     fn get_vrgda_price(
//         self: @LinearVRGDA, time_since_start: Fixed, bought: Fixed
//     ) -> Fixed {
//         // time_since_start = nb of periods since start
//         *self.target_price * pow(FixedTrait::new_unscaled(1, false) - *self.decay_constant, time_since_start - self.get_target_buy_time(bought))
//     }
// }

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
            per_time_unit: FixedTrait::new_unscaled(self.per_time_unit * self.realms_count, false)
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
                FixedTrait::new_unscaled(self.bought, false), // amount bought
            )
    }

    fn buy(ref self: LaborAuction, amount: u128, world: IWorldDispatcher) {
        self.bought += amount;
        set!(world, (self));
    }

    fn add_realm(ref self: LaborAuction, world: IWorldDispatcher) {
        self.realms_count += 1;
        set!(world, (self));
    }
}


#[cfg(test)]
mod tests {
    use eternum::components::labor_auction::{LaborAuction, LaborAuctionTrait, LinearVRGDATrait, LinearVRGDA};

    // testing
    use eternum::utils::testing::spawn_eternum;
    use debug::PrintTrait;

    use dojo::world::{IWorldDispatcher,IWorldDispatcherTrait};

    // constants
    const _0_1: u128 = 1844674407370955161; // 0.1
    const _69_42: u128 = 1280572973596917000000;
    const _0_31: u128 = 5718490662849961000;
    const DELTA_0_0005: u128 = 9223372036854776;
    const DELTA_0_02: u128 = 368934881474191000;
    const DELTA: u128 = 184467440737095;

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
            per_time_unit: 5,
            realms_count: 10,
            start_time: 0,
            bought: 10,
        };

        starknet::testing::set_block_timestamp(90000);

        let price = auction.get_price();
        assert(price.mag == 169556217585565105770, 'price is wrong');
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
            per_time_unit: 5,
            realms_count: 10,
            start_time: 0,
            bought: 0,
        };

        set!(world, (auction));

        // advance time to 1 day
        starknet::testing::set_block_timestamp(86400);

        // buy all remaining labor
        auction.buy(50, world);

        let auction = get!(world, (1, 1), LaborAuction);
        assert(auction.bought == 50, 'bought is wrong');

        let price = auction.get_price();
        assert(price.mag == 184467440737095516160, 'price is wrong');
    }


    #[test]
    #[available_gas(30000000)]
    fn test_auction_add_realm() {
        let world = spawn_eternum();
        starknet::testing::set_contract_address(world.executor());

        let mut auction = LaborAuction {
            resource_type: 1,
            zone: 1,
            target_price: 10,
            decay_constant_mag: _0_1,
            decay_constant_sign: false,
            per_time_unit: 5,
            realms_count: 10,
            start_time: 0,
            bought: 50,
        };

        set!(world, (auction));

        // advance time to 1 day
        starknet::testing::set_block_timestamp(86400);

        auction.add_realm(world);

        let auction = get!(world, (1, 1), LaborAuction);
        assert(auction.realms_count == 11, 'realms_count is wrong');

        let price = auction.get_price();
        assert(price.mag == 182709003719136910070, 'price is wrong');
    }


    #[test]
    #[available_gas(20000000)]
    fn test_pricing_basic() {
        let auction = LinearVRGDA {
            target_price: FixedTrait::new(_69_42, false),
            decay_constant: FixedTrait::new(_0_31, false),
            per_time_unit: FixedTrait::new_unscaled(2, false),
        };
        let time_delta = FixedTrait::new(10368001, false); // 120 days
        let num_mint = FixedTrait::new(0, true);
        let cost = auction.get_vrgda_price(time_delta, num_mint);
    }

}

