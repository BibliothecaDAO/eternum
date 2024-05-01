// External imports
use cubit::f128::types::fixed::{Fixed, FixedTrait};

// Dojo imports
use dojo::database::introspect::{Struct, Ty, Introspect, Member, serialize_member};

// Starknet imports
use starknet::ContractAddress;

impl IntrospectFixed of Introspect<Fixed> {
    #[inline(always)]
    fn size() -> usize {
        2
    }

    #[inline(always)]
    fn layout(ref layout: Array<u8>) {
        layout.append(128);
        layout.append(1);
    }

    #[inline(always)]
    fn ty() -> Ty {
        Ty::Struct(
            Struct {
                name: 'Fixed',
                attrs: array![].span(),
                children: array![
                    serialize_member(
                        @Member { name: 'mag', ty: Ty::Primitive('u128'), attrs: array![].span() }
                    ),
                    serialize_member(
                        @Member { name: 'sign', ty: Ty::Primitive('bool'), attrs: array![].span() }
                    )
                ]
                    .span()
            }
        )
    }
}

#[derive(Model, Copy, Drop, Serde)]
struct Market {
    #[key]
    bank_entity_id: u128,
    #[key]
    resource_type: u8,
    lords_amount: u128,
    resource_amount: u128,
    total_shares: Fixed,
}

#[generate_trait]
impl MarketImpl of MarketTrait {
    fn buy(self: @Market, quantity: u128) -> u128 {
        assert(quantity < *self.resource_amount, 'not enough liquidity');
        let (quantity, available, cash) = normalize(quantity, self);
        let k = cash * available;
        let cost = (k / (available - quantity)) - cash;
        cost
    }

    fn sell(self: @Market, quantity: u128) -> u128 {
        let (quantity, available, cash) = normalize(quantity, self);
        let k = cash * available;
        let payout = cash - (k / (available + quantity));
        payout
    }

    // Get normalized reserve cash amount and item quantity
    fn get_reserves(self: @Market) -> (u128, u128) {
        let reserve_quantity: u128 = (*self.resource_amount).into();
        (*self.lords_amount, reserve_quantity)
    }

    // Get the liquidity of the market
    // Use cubit fixed point math library to compute the square root of the product of the reserves
    fn liquidity(self: @Market) -> Fixed {
        // Get normalized reserve cash amount and item quantity
        let (reserve_amount, reserve_quantity) = self.get_reserves();

        // Convert reserve amount to fixed point
        let reserve_amount = FixedTrait::new_unscaled(reserve_amount, false);
        let reserve_quantity = FixedTrait::new_unscaled(reserve_quantity, false);

        // L = sqrt(X * Y)
        (reserve_amount * reserve_quantity).sqrt()
    }

    // Check if the market has liquidity
    fn has_liquidity(self: @Market) -> bool {
        *self.lords_amount > 0 || *self.resource_amount > 0
    }

    // Given some amount of cash, return the equivalent/optimal quantity of items
    // based on the reserves in the market
    fn quote_quantity(self: @Market, amount: u128) -> u128 {
        assert(amount > 0, 'insufficient amount');
        assert(self.has_liquidity(), 'insufficient liquidity');

        // Get normalized reserve cash amount and item quantity
        let (reserve_amount, reserve_quantity) = self.get_reserves();

        // Convert amount to fixed point
        let amount = FixedTrait::new_unscaled(amount, false);

        // Convert reserve amount and quantity to fixed point
        let reserve_amount = FixedTrait::new_unscaled(reserve_amount, false);
        let reserve_quantity = FixedTrait::new_unscaled(reserve_quantity, false);

        // dy = Y * dx / X
        let quantity_optimal = (reserve_quantity * amount) / reserve_amount;

        // Convert from fixed point to u128
        let res: u128 = quantity_optimal.try_into().unwrap();
        res
    }

    // Given some quantity of items, return the equivalent/optimal amount of cash
    // based on the reserves in the market
    fn quote_amount(self: @Market, quantity: u128) -> u128 {
        assert(quantity > 0, 'insufficient quantity');
        assert(self.has_liquidity(), 'insufficient liquidity');

        // Get normalized reserve cash amount and item quantity
        let (reserve_amount, reserve_quantity) = self.get_reserves();

        // Convert reserve amount and quantity to fixed point
        let reserve_amount = FixedTrait::new_unscaled(reserve_amount, false);
        let reserve_quantity = FixedTrait::new_unscaled(reserve_quantity, false);

        // Normalize quantity
        let quantity: u128 = quantity.into();

        // Convert quantity to fixed point
        let quantity = FixedTrait::new_unscaled(quantity, false);

        // dx = X * dy / Y
        let amount_optimal = (reserve_amount * quantity) / reserve_quantity;

        // Convert from fixed point to u128
        amount_optimal.try_into().unwrap()
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
    fn add_liquidity(self: @Market, amount: u128, quantity: u128) -> (u128, u128, Fixed, Fixed) {
        // Compute the amount and quantity to add to the market
        let (amount, quantity) = self.add_liquidity_inner(amount, quantity);
        // Mint shares for the given amount of liquidity provided
        let shares = self.mint_shares(amount, quantity);
        let total_shares = *self.total_shares + shares;
        (amount, quantity, shares, total_shares)
    }

    // Mint shares for the given amount of liquidity provided
    fn mint_shares(self: @Market, amount: u128, quantity: u128) -> Fixed {
        // If there is no liquidity, then mint total shares
        if !self.has_liquidity() {
            let quantity: u128 = quantity.into();
            (FixedTrait::new_unscaled(amount, false) * FixedTrait::new_unscaled(quantity, false))
                .sqrt()
        } else {
            // Convert amount to fixed point
            let amount = FixedTrait::new_unscaled(amount, false);

            // Get normalized reserve cash amount and item quantity
            let (reserve_amount, _) = self.get_reserves();

            // Convert reserve amount to fixed point
            let reserve_amount = FixedTrait::new_unscaled(reserve_amount, false);

            // Get total liquidity
            let liquidity = self.liquidity();

            // Compute the amount of shares to mint
            // S = dx * L/X = dy * L/Y
            (amount * liquidity) / reserve_amount
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
    fn remove_liquidity(self: @Market, shares: Fixed) -> (u128, u128, Fixed) {
        // Ensure that the market has liquidity
        let total_shares = *self.total_shares;
        assert(shares <= total_shares, 'insufficient liquidity');

        // Get normalized reserve cash amount and item quantity
        let (reserve_amount, reserve_quantity) = self.get_reserves();

        // Convert reserve amount and quantity to fixed point
        let reserve_amount = FixedTrait::new_unscaled(reserve_amount, false);
        let reserve_quantity = FixedTrait::new_unscaled(reserve_quantity, false);

        // Compute the amount and quantity to remove from the market
        // dx = S * X / L
        let amount = (shares * reserve_amount) / total_shares;
        // dy = S * Y / L
        let quantity = (shares * reserve_quantity) / total_shares;

        let total_shares = *self.total_shares - shares;

        // Convert amount and quantity both from fixed point to u128 and unscaled u128, respectively
        (amount.try_into().unwrap(), quantity.try_into().unwrap(), total_shares)
    }
}

fn normalize(quantity: u128, market: @Market) -> (u128, u128, u128) {
    let quantity: u128 = quantity.into();
    let available: u128 = (*market.resource_amount).into();
    (quantity, available, *market.lords_amount)
}

#[cfg(test)]
mod tests {
    use super::{Fixed, FixedTrait};
    // Local imports

    use super::{Market, MarketTrait};

    // Constants

    const TOLERANCE: u128 = 18446744073709550; // 0.001

    // Helpers

    fn assert_approx_equal(expected: Fixed, actual: Fixed, tolerance: u128) {
        let left_bound = expected - FixedTrait::new(tolerance, false);
        let right_bound = expected + FixedTrait::new(tolerance, false);
        assert(left_bound <= actual && actual <= right_bound, 'Not approx eq');
    }

    #[test]
    #[should_panic(expected: ('not enough liquidity',))]
    fn test_market_not_enough_quantity() {
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 1, resource_amount: 1,
        }; // pool 1:1
        let _cost = market.buy(10);
    }

    #[test]
    fn test_market_buy() {
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 1, resource_amount: 10,
        }; // pool 1:10
        let cost = market.buy(5);
        assert(cost == 1, 'wrong cost');
    }

    #[test]
    fn test_market_sell() {
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 10000, resource_amount: 1000,
        }; // pool 10:1
        let payout = market.sell(5);
        assert(payout == 50, 'wrong payout');
    }

    #[test]
    fn test_market_add_liquidity_no_initial() {
        // Without initial liquidity
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 0, resource_amount: 0,
        };

        // Add liquidity
        let (amount, quantity) = (5, 5); // pool 1:1
        let (amount_add, quantity_add, liquidity_add) = market.add_liquidity(amount, quantity);

        // Assert that the amount and quantity added are the same as the given amount and quantity
        // and that the liquidity shares minted are the same as the entire liquidity
        assert(amount_add == amount, 'wrong cash amount');
        assert(quantity_add == quantity, 'wrong item quantity');

        // Convert amount and quantity to fixed point
        let amount = FixedTrait::new_unscaled(amount, false);
        let quantity: u128 = quantity.into();
        let quantity = FixedTrait::new_unscaled(quantity, false);
        assert(liquidity_add == (amount * quantity).sqrt(), 'wrong liquidity');
    }

    #[test]
    fn test_market_add_liquidity_optimal() {
        // With initial liquidity
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 1, resource_amount: 10,
        }; // pool 1:10
        let initial_liquidity = market.liquidity();

        // Add liquidity with the same ratio
        let (amount, quantity) = (2, 20); // pool 1:10
        let (amount_add, quantity_add, liquidity_add) = market.add_liquidity(amount, quantity);

        // Assert 
        assert(amount_add == amount, 'wrong cash amount');
        assert(quantity_add == quantity, 'wrong item quantity');

        // Get expected amount and convert to fixed point
        let expected_amount = FixedTrait::new_unscaled(1 + amount, false);
        let expected_quantity: u128 = (10 + quantity).into();
        let expected_quantity = FixedTrait::new_unscaled(expected_quantity, false);

        // Compute the expected liquidity shares
        let expected_liquidity = FixedTrait::sqrt(expected_amount * expected_quantity);
        let final_liquidity = initial_liquidity + liquidity_add;
        assert_approx_equal(expected_liquidity, final_liquidity, TOLERANCE);
    }

    #[test]
    fn test_market_add_liquidity_not_optimal() {
        // With initial liquidity
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 1, resource_amount: 10,
        }; // pool 1:10
        let initial_liquidity = market.liquidity();

        // Add liquidity without the same ratio
        let (amount, quantity) = (2, 10); // pool 1:5

        let (amount_add, quantity_add, liquidity_add) = market.add_liquidity(amount, quantity);

        // Assert that the amount added is optimal even though the
        // amount originally requested was not
        let amount_optimal = 1;
        assert(amount_add == amount_optimal, 'wrong cash amount');
        assert(quantity_add == quantity, 'wrong item quantity');

        // Get expected amount and convert to fixed point
        let expected_amount = FixedTrait::new_unscaled(1 + amount_add, false);
        let expected_quantity: u128 = (10 + quantity).into();
        let expected_quantity = FixedTrait::new_unscaled(expected_quantity, false);

        // Get expecteed liquidity
        let _expected_liquidity = FixedTrait::sqrt(expected_amount * expected_quantity);

        let _final_liquidity = initial_liquidity + liquidity_add;
    // assert_precise(expected_liquidity, final_liquidity.into(), 'wrong liquidity', Option::None(()));
    }

    // cannot fail since optimal quantity/amount is calculated
    // #[test]
    // #[should_panic(expected: ('insufficient amount',))]
    // fn test_market_add_liquidity_insufficient_amount() {
    //     let market = Market {
    //         bank_entity_id: 1, resource_type: 1, lords_amount: 1, resource_amount: 10,
    //     }; // pool 1:10
    //     // Adding 20 items requires 2 cash amount to maintain the ratio
    //     // Therefore this should fail
    //     let (_amount_add, _quantity_add, _liquidity_add) = market.add_liquidity(1000000000, 20);
    // }

    #[test]
    fn test_market_remove_liquidity() {
        // With initial liquidity
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 2, resource_amount: 20,
        }; // pool 1:10
        let initial_liquidity = market.liquidity();

        // Remove half of the liquidity
        let two = FixedTrait::new_unscaled(2, false);
        let liquidity_remove = initial_liquidity / two;

        let (amount_remove, quantity_remove, total_shares) = market
            .remove_liquidity(liquidity_remove);

        // Assert that the amount and quantity removed are half of the initial amount and quantity
        assert(amount_remove == 1, 'wrong cash amount');
        assert(quantity_remove == 10, 'wrong item quantity');

        // Get expected amount and convert to fixed point
        let expected_amount = FixedTrait::new_unscaled(2 - amount_remove, false);
        let expected_quantity: u128 = (20 - quantity_remove).into();
        let expected_quantity = FixedTrait::new_unscaled(expected_quantity, false);

        // Get expecteed liquidity
        let _expected_liquidity = FixedTrait::sqrt(expected_amount * expected_quantity);

        let _final_liquidity = initial_liquidity - liquidity_remove;
    // assert_precise(expected_liquidity, final_liquidity.into(), 'wrong liquidity', Option::None(()));
    }

    #[test]
    #[should_panic(expected: ('insufficient liquidity',))]
    fn test_market_remove_liquidity_no_initial() {
        // Without initial liquidity
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 0, resource_amount: 0,
        }; // pool 1:10

        // Remove liquidity
        let one = FixedTrait::new_unscaled(1, false);

        let (_amount_remove, _quantity_remove, total_shares) = market.remove_liquidity(one);
    }

    #[test]
    #[should_panic(expected: ('insufficient liquidity',))]
    fn test_market_remove_liquidity_more_than_available() {
        // With initial liquidity
        let market = Market {
            bank_entity_id: 1, resource_type: 1, lords_amount: 2, resource_amount: 20,
        }; // pool 1:10
        let initial_liquidity = market.liquidity();

        // Remove twice of the liquidity
        let two = FixedTrait::new_unscaled(2, false);
        let liquidity_remove = initial_liquidity * two;

        let (_amount_remove, _quantity_remove, total_shares) = market
            .remove_liquidity(liquidity_remove);
    }
}
