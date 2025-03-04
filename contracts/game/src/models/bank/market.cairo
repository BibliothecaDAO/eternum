#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Market {
    #[key]
    pub resource_type: u8,
    pub lords_amount: u128,
    pub resource_amount: u128,
    pub total_shares: u128,
}

#[generate_trait]
pub impl MarketImpl of MarketTrait {
    fn get_input_price(
        fee_rate_num: u128, fee_rate_denom: u128, input_amount: u128, input_reserve: u128, output_reserve: u128,
    ) -> u128 {
        // Ensure reserves are not zero
        assert(input_reserve > 0 && output_reserve > 0, 'Reserves must be > zero');

        // Apply the fee to the input amount
        let input_amount_after_fee = (input_amount * (fee_rate_denom - fee_rate_num)) / fee_rate_denom;

        // Calculate the output amount based on the constant product formula
        // (x + Δx) * (y - Δy) = k, where k = x * y
        // Solving for Δy:
        // Δy = (y * Δx) / (x + Δx)
        let numerator = input_amount_after_fee * output_reserve;
        let denominator = input_reserve + input_amount_after_fee;

        // Calculate and return the output amount
        numerator / denominator
    }

    // Here the user gets the requested output but pays more in price to
    // account for lp fees. i.e fees are paid in input token
    fn get_output_price(
        fee_rate_num: u128, fee_rate_denom: u128, output_amount: u128, input_reserve: u128, output_reserve: u128,
    ) -> u128 {
        // Ensure reserves are not zero and output amount is valid
        assert(input_reserve > 0 && output_reserve > 0, 'Reserves must be > zero');
        assert!(
            output_amount < output_reserve,
            "Output amount exceeds reserve, amount: {}, reserve: {}",
            output_amount,
            output_reserve,
        );

        // Calculate input amount based on the constant product formula with fee
        // (x + Δx) * (y - Δy) = k, where k = x * y
        // Solving for Δx and including the fee:
        // Δx = (x * Δy) / ((y - Δy) * (1 - fee))
        let numerator = input_reserve * output_amount * fee_rate_denom;
        let denominator = (output_reserve - output_amount) * (fee_rate_denom - fee_rate_num);

        // Add 1 to round up the result, ensuring sufficient input is provided
        (numerator / denominator) + 1
    }


    fn buy(self: @Market, lp_fee_num: u128, lp_fee_denom: u128, desired_resource_amount: u128) -> u128 {
        let lords_cost = Self::get_output_price(
            lp_fee_num, lp_fee_denom, desired_resource_amount, *self.lords_amount, *self.resource_amount,
        );
        lords_cost
    }

    fn sell(self: @Market, lp_fee_num: u128, lp_fee_denom: u128, sell_resource_amount: u128) -> u128 {
        let lords_received = Self::get_input_price(
            lp_fee_num, lp_fee_denom, sell_resource_amount, *self.resource_amount, *self.lords_amount,
        );
        lords_received
    }

    // Get normalized reserve cash amount and item quantity
    fn get_reserves(self: @Market) -> (u128, u128) {
        let reserve_quantity: u128 = (*self.resource_amount).into();
        (*self.lords_amount, reserve_quantity)
    }


    // Check if the market has liquidity
    fn has_liquidity(self: @Market) -> bool {
        *self.total_shares > 0
    }

    // Given some amount of cash, return the equivalent/optimal quantity of items
    // based on the reserves in the market
    fn quote_quantity(self: @Market, amount: u128) -> u128 {
        assert(amount > 0, 'insufficient amount');
        assert(self.has_liquidity(), 'insufficient liquidity 1');

        // Get normalized reserve cash amount and item quantity
        let (reserve_amount, reserve_quantity) = self.get_reserves();

        // dy = Y * dx / X
        (reserve_quantity * amount) / reserve_amount
    }

    // Given some quantity of items, return the equivalent/optimal amount of cash
    // based on the reserves in the market
    fn quote_amount(self: @Market, quantity: u128) -> u128 {
        assert(quantity > 0, 'insufficient quantity');
        assert(self.has_liquidity(), 'insufficient liquidity 2');

        // Get normalized reserve cash amount and item quantity
        let (reserve_amount, reserve_quantity) = self.get_reserves();

        // dx = X * dy / Y
        (reserve_amount * quantity) / reserve_quantity
    }

    // Inner function to add liquidity to the market, computes the optimal amount and quantity
    //
    // Arguments:
    //
    // amount: The amount of cash to add to the market
    // quantity: The quantity of items to add to the market
    //
    // Returns:
    //
    // (amount, quantity): The amount of cash and quantity of items added to the market
    fn add_liquidity_inner(self: @Market, amount: u128, quantity: u128) -> (u128, u128) {
        // If there is no liquidity, then the amount and quantity are the optimal
        if !self.has_liquidity() {
            // Ensure that the amount and quantity are greater than zero
            assert(amount > 0, 'insufficient amount');
            assert(quantity > 0, 'insufficient quantity');
            (amount, quantity)
        } else {
            // Given the amount, get optimal quantity to add to the market
            let quantity_optimal = self.quote_quantity(amount);
            if quantity_optimal <= quantity {
                // Add the given amount and optimal quantity to the market
                (amount, quantity_optimal)
            } else {
                let amount_optimal = self.quote_amount(quantity);
                // Ensure that the optimal amount is less than or equal to the given amount
                assert(amount_optimal <= amount, 'insufficient amount');
                (amount_optimal, quantity)
            }
        }
    }

    // Add liquidity to the market, mints shares for the given amount of liquidity provided
    //
    // Arguments:
    //
    // amount: The amount of cash to add to the market
    // quantity: The quantity of items to add to the market
    //
    // Returns:
    //
    // (amount, quantity, shares): The amount of cash and quantity of items added to the market and the shares minted
    fn add_liquidity(self: @Market, amount: u128, quantity: u128) -> (u128, u128, u128, u128) {
        // Compute the amount and quantity to add to the market
        let (amount, quantity) = self.add_liquidity_inner(amount, quantity);
        // Mint shares for the given amount of liquidity provided
        let shares = self.mint_shares(amount, quantity);
        let total_shares = *self.total_shares + shares;
        (amount, quantity, shares, total_shares)
    }

    // Mint shares for the given amount of liquidity provided
    fn mint_shares(self: @Market, amount: u128, quantity: u128) -> u128 {
        // If there is no liquidity, then mint total shares
        if !self.has_liquidity() {
            amount
        } else {
            // Get normalized reserve cash amount and item quantity
            let (reserve_amount, _) = self.get_reserves();

            // Compute the amount of shares to mint
            // S = dx * L/X = dy * L/Y
            (amount * *self.total_shares) / reserve_amount
        }
    }

    // Remove liquidity from the market, return the corresponding amount and quantity payout
    //
    // Arguments:
    //
    // shares: The amount of liquidity shares to remove from the market
    //
    // Returns:
    //
    // (amount, quantity): The amount of cash and quantity of items removed from the market
    fn remove_liquidity(self: @Market, shares: u128) -> (u128, u128, u128) {
        // Ensure that the market has liquidity
        let total_shares = *self.total_shares;
        assert(shares <= total_shares, 'insufficient liquidity');

        // Get normalized reserve cash amount and item quantity
        let (reserve_amount, reserve_quantity) = self.get_reserves();

        // Compute the amount and quantity to remove from the market
        // dx = S * X / L
        let amount = (shares * reserve_amount) / total_shares;
        // dy = S * Y / L
        let quantity = (shares * reserve_quantity) / total_shares;
        let total_shares = *self.total_shares - shares;

        (amount, quantity, total_shares)
    }
}

fn normalize(quantity: u128, market: @Market) -> (u128, u128, u128) {
    let quantity: u128 = quantity.into();
    let available: u128 = (*market.resource_amount).into();
    (quantity, available, *market.lords_amount)
}
// #[cfg(test)]
// mod tests {
//     use debug::PrintTrait;
//     use s1_eternum::alias::ID;
//     use super::{Fixed, FixedTrait};
//     // Local imports

//     use super::{Market, MarketTrait};

//     // Constants

//     const TOLERANCE: u128 = 18446744073709550; // 0.001

//     const LP_FEE_NUM: u128 = 3;
//     const LP_FEE_DENOM: u128 = 1000; // 3/1000  = 0.3% lp fee

//     fn assert_constant_product_check(
//         initial_reserve_x: u128,
//         initial_reserve_y: u128,
//         final_reserve_x: u128,
//         final_reserve_y: u128,
//         fee_rate_num: u128,
//         fee_rate_denom: u128,
//     ) {
//         let initial_product = initial_reserve_x * initial_reserve_y;
//         let final_product = final_reserve_x * final_reserve_y;

//         // The final product should be greater than or equal to the initial product
//         if final_product < initial_product {
//             panic!("failed constant product {} {}", final_product, initial_product);
//         }

//         // Calculate the maximum allowed increase due to fees
//         let max_input = if final_reserve_x > initial_reserve_x {
//             final_reserve_x - initial_reserve_x
//         } else {
//             final_reserve_y - initial_reserve_y
//         };

//         let max_fee = (max_input * fee_rate_num) / fee_rate_denom;
//         let max_product_increase = initial_product + (max_fee * initial_product / initial_reserve_x);

//         // acceptable error margin (0.01% of the initial product)
//         let error_margin = initial_product / 10_000;

//         // Check if the final product is within the allowed range
//         assert_le!(final_product, max_product_increase + error_margin);
//     }

//     fn assert_approx_equal(expected: Fixed, actual: Fixed, tolerance: u128) {
//         let left_bound = expected - FixedTrait::new(tolerance, false);
//         let right_bound = expected + FixedTrait::new(tolerance, false);
//         assert(left_bound <= actual && actual <= right_bound, 'Not approx eq');
//     }

//     #[test]
//     #[should_panic(expected: ("Output amount exceeds reserve, amount: 10, reserve: 1",))]
//     fn bank_test_market_not_enough_quantity() {
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 1,
//             resource_amount: 1,
//             total_shares: FixedTrait::new(1, false),
//         }; // pool 1:1
//         let _cost = market.buy(LP_FEE_NUM, LP_FEE_DENOM, 10);
//     }

//     #[test]
//     fn bank_test_market_buy_no_fee() {
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 170_000,
//             resource_amount: 150_000,
//             total_shares: FixedTrait::new(1, false),
//         }; // pool 17: 15

//         let desired_resource_amount = 14_890;
//         let lords_cost = market.buy(0, 1, desired_resource_amount);
//         assert_eq!(lords_cost, 18_736);

//         assert_constant_product_check(
//             market.lords_amount,
//             market.resource_amount,
//             market.lords_amount + lords_cost,
//             market.resource_amount - desired_resource_amount,
//             0,
//             1,
//         )
//     }

//     #[test]
//     fn bank_test_market_buy_with_lp_fee() {
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 170_000,
//             resource_amount: 150_000,
//             total_shares: FixedTrait::new(1, false),
//         }; // pool 17: 15

//         // 10% lp fee
//         let desired_resource_amount = 14_890;
//         let lords_cost = market.buy(LP_FEE_NUM, LP_FEE_DENOM, desired_resource_amount);
//         assert_eq!(lords_cost, 18_792);

//         assert_constant_product_check(
//             market.lords_amount,
//             market.resource_amount,
//             market.lords_amount + lords_cost,
//             market.resource_amount - desired_resource_amount,
//             LP_FEE_NUM,
//             LP_FEE_DENOM,
//         )
//     }

//     #[test]
//     fn bank_test_market_sell_no_fee() {
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 170_000,
//             resource_amount: 150_000,
//             total_shares: FixedTrait::new(1, false),
//         }; // pool 17: 15

//         let sell_resource_amount = 17_500;
//         let lords_payout = market.sell(0, 1, sell_resource_amount);
//         assert_eq!(lords_payout, 17_761);

//         assert_constant_product_check(
//             market.lords_amount,
//             market.resource_amount,
//             market.lords_amount - lords_payout,
//             market.resource_amount + sell_resource_amount,
//             0,
//             1,
//         )
//     }

//     #[test]
//     fn bank_test_market_sell_with_fee() {
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 170_000,
//             resource_amount: 150_000,
//             total_shares: FixedTrait::new(1, false),
//         }; // pool 17: 15

//         let sell_resource_amount = 17_500;
//         let lords_payout = market.sell(LP_FEE_NUM, LP_FEE_DENOM, sell_resource_amount);
//         assert_eq!(lords_payout, 17_713);

//         assert_constant_product_check(
//             market.lords_amount,
//             market.resource_amount,
//             market.lords_amount - lords_payout,
//             market.resource_amount + sell_resource_amount,
//             LP_FEE_NUM,
//             LP_FEE_DENOM,
//         )
//     }

//     #[test]
//     fn bank_test_market_add_liquidity_no_initial() {
//         // Without initial liquidity
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 0,
//             resource_amount: 0,
//             total_shares: FixedTrait::new(0, false),
//         };

//         // Add liquidity
//         let (amount, quantity) = (5, 5); // pool 1:1
//         let (amount_add, quantity_add, liquidity_add, _) = market.add_liquidity(amount, quantity);

//         // Assert that the amount and quantity added are the same as the given amount and quantity
//         // and that the liquidity shares minted are the same as the entire liquidity
//         assert(amount_add == amount, 'wrong cash amount');
//         assert(quantity_add == quantity, 'wrong item quantity');

//         // Convert amount and quantity to fixed point
//         let amount = FixedTrait::new(amount, false);
//         let quantity: u128 = quantity.into();
//         let quantity = FixedTrait::new(quantity, false);
//         assert(liquidity_add == (amount * quantity).sqrt(), 'wrong liquidity');
//     }

//     #[test]
//     fn bank_test_market_add_liquidity_optimal() {
//         // With initial liquidity
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 1,
//             resource_amount: 10,
//             total_shares: FixedTrait::new(1, false),
//         }; // pool 1:10
//         let initial_liquidity = market.total_shares;

//         // Add liquidity with the same ratio
//         let (amount, quantity) = (2, 20); // pool 1:10
//         let (amount_add, quantity_add, liquidity_add, _) = market.add_liquidity(amount, quantity);

//         // Assert
//         assert(amount_add == amount, 'wrong cash amount');
//         assert(quantity_add == quantity, 'wrong item quantity');

//         // Get expected amount and convert to fixed point
//         let expected_liquidity = FixedTrait::new(1 + amount, false);
//         let final_liquidity = initial_liquidity + liquidity_add;
//         assert_approx_equal(expected_liquidity, final_liquidity, TOLERANCE);
//     }

//     #[test]
//     fn bank_test_market_add_liquidity_not_optimal() {
//         // With initial liquidity
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 1,
//             resource_amount: 10,
//             total_shares: FixedTrait::new(58333726685869899776, false),
//         }; // pool 1:10
//         let initial_liquidity = market.total_shares;

//         // Add liquidity without the same ratio
//         let (amount, quantity) = (2, 10); // pool 1:5

//         let (amount_add, quantity_add, liquidity_add, total_shares) = market.add_liquidity(amount, quantity);

//         // Assert that the amount added is optimal even though the
//         // amount originally requested was not
//         let amount_optimal = 1;
//         assert(amount_add == amount_optimal, 'wrong cash amount');
//         assert(quantity_add == quantity, 'wrong item quantity');
//         assert(total_shares.mag == 116667453371739799552, 'wrong total shares');
//         assert(liquidity_add.mag == 58333726685869899776, 'wrong liquidity');
//         assert(initial_liquidity.mag == 58333726685869899776, 'wrong initial liquidity');
//     }

//     #[test]
//     fn bank_test_market_remove_liquidity() {
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 2,
//             resource_amount: 20,
//             total_shares: FixedTrait::new(116667453371739799552, false),
//         }; // pool 1:10
//         let initial_liquidity = market.total_shares;

//         // Remove half of the liquidity
//         let two = FixedTrait::new(2, false);
//         let liquidity_remove = initial_liquidity / two;

//         let (amount_remove, quantity_remove, total_shares) = market.remove_liquidity(liquidity_remove);

//         // Assert that the amount and quantity removed are half of the initial amount and quantity
//         assert(amount_remove == 1, 'wrong cash amount');
//         assert(quantity_remove == 10, 'wrong item quantity');
//         assert(total_shares.mag == 58333726685869899776, 'wrong total shares');

//         // Get expected amount and convert to fixed point
//         let expected_amount = FixedTrait::new(2 - amount_remove, false);
//         let expected_quantity: u128 = (20 - quantity_remove).into();
//         let expected_quantity = FixedTrait::new(expected_quantity, false);

//         // Get expecteed liquidity
//         let _expected_liquidity = FixedTrait::sqrt(expected_amount * expected_quantity);

//         let _final_liquidity = initial_liquidity - liquidity_remove;
//     }

//     #[test]
//     #[should_panic(expected: ('insufficient liquidity',))]
//     fn bank_test_market_remove_liquidity_no_initial() {
//         // Without initial liquidity
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 0,
//             resource_amount: 0,
//             total_shares: FixedTrait::new(0, false),
//         }; // pool 1:10

//         // Remove liquidity
//         let one = FixedTrait::new(1, false);

//         let (_amount_remove, _quantity_remove, _) = market.remove_liquidity(one);
//     }

//     #[test]
//     #[should_panic(expected: ('insufficient liquidity',))]
//     fn bank_test_market_remove_liquidity_more_than_available() {
//         // With initial liquidity
//         let market: Market = Market {
//             bank_entity_id: 1,
//             resource_type: 1,
//             lords_amount: 2,
//             resource_amount: 20,
//             total_shares: FixedTrait::new(2, false),
//         }; // pool 1:10
//         let initial_liquidity = market.total_shares;

//         // Remove twice of the liquidity
//         let two = FixedTrait::new(2, false);
//         let liquidity_remove = initial_liquidity * two;

//         let (_amount_remove, _quantity_remove, _) = market.remove_liquidity(liquidity_remove);
//     }
// }


