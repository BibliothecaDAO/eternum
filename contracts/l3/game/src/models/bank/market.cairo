#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Market {
    #[key]
    pub game_id: u32,
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
