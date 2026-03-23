/// AMM math module — constant product (x * y = k) formulas.
/// Ported from contracts/game/src/models/bank/market.cairo with u128 -> u256.

use core::integer::u512_safe_div_rem_by_u256;
use core::num::traits::WideMul;
use core::traits::TryInto;

pub const MINIMUM_LIQUIDITY: u256 = 1000;

fn divide_wide_product(lhs: u256, rhs: u256, divisor: u256) -> u256 {
    let (quotient, _) = u512_safe_div_rem_by_u256(lhs.wide_mul(rhs), divisor.try_into().unwrap());
    quotient.try_into().unwrap()
}

/// Given an input amount of one token, compute how much of the other token you receive.
/// Fee is deducted from input before calculation.
///
/// Formula: output = (input_after_fee * output_reserve) / (input_reserve + input_after_fee)
pub fn get_input_price(
    fee_num: u256, fee_denom: u256, input_amount: u256, input_reserve: u256, output_reserve: u256,
) -> u256 {
    assert!(input_reserve > 0 && output_reserve > 0, "reserves must be > zero");
    assert!(input_amount > 0, "input amount must be > zero");

    let input_amount_after_fee = divide_wide_product(input_amount, fee_denom - fee_num, fee_denom);
    let denominator = input_reserve + input_amount_after_fee;

    divide_wide_product(input_amount_after_fee, output_reserve, denominator)
}

/// Given a desired output amount, compute how much input is required.
/// Rounds up (+1) to ensure the pool is never shortchanged.
///
/// Formula: input = (input_reserve * output * fee_denom) / ((output_reserve - output) * (fee_denom
/// - fee_num)) + 1
pub fn get_output_price(
    fee_num: u256, fee_denom: u256, output_amount: u256, input_reserve: u256, output_reserve: u256,
) -> u256 {
    assert!(input_reserve > 0 && output_reserve > 0, "reserves must be > zero");
    assert!(output_amount < output_reserve, "output exceeds reserve");
    assert!(output_amount > 0, "output amount must be > zero");

    let denominator = output_reserve - output_amount;
    if fee_num == 0 {
        return divide_wide_product(input_reserve, output_amount, denominator) + 1;
    }

    let numerator = input_reserve * output_amount * fee_denom;
    let denominator = denominator * (fee_denom - fee_num);

    (numerator / denominator) + 1
}

/// Proportional quote: given amount_a of token A, how much of token B maintains the ratio?
/// Used for computing optimal LP deposit amounts.
pub fn quote(amount_a: u256, reserve_a: u256, reserve_b: u256) -> u256 {
    assert!(amount_a > 0, "insufficient amount");
    assert!(reserve_a > 0 && reserve_b > 0, "insufficient liquidity");

    divide_wide_product(amount_a, reserve_b, reserve_a)
}

/// Compute optimal amounts for adding liquidity, maintaining pool ratio.
/// Returns (lords_used, token_used).
pub fn compute_add_liquidity(
    lords_desired: u256, token_desired: u256, lords_reserve: u256, token_reserve: u256,
) -> (u256, u256) {
    if lords_reserve == 0 && token_reserve == 0 {
        assert!(lords_desired > 0, "insufficient lords amount");
        assert!(token_desired > 0, "insufficient token amount");
        (lords_desired, token_desired)
    } else {
        let token_optimal = quote(lords_desired, lords_reserve, token_reserve);
        if token_optimal <= token_desired {
            (lords_desired, token_optimal)
        } else {
            let lords_optimal = quote(token_desired, token_reserve, lords_reserve);
            assert!(lords_optimal <= lords_desired, "insufficient lords amount");
            (lords_optimal, token_desired)
        }
    }
}

/// Compute LP tokens to mint for a given lords deposit.
/// First depositor: lp = lords_amount - minimum liquidity lock.
/// Subsequent: lp = (lords_added * total_supply) / lords_reserve.
pub fn compute_lp_mint(lords_added: u256, lords_reserve: u256, total_lp_supply: u256) -> u256 {
    if total_lp_supply == 0 {
        assert!(lords_added > MINIMUM_LIQUIDITY, "insufficient initial liquidity");
        lords_added - MINIMUM_LIQUIDITY
    } else {
        divide_wide_product(lords_added, total_lp_supply, lords_reserve)
    }
}

/// Compute token payouts when burning LP tokens.
/// Returns (lords_out, token_out).
pub fn compute_lp_burn(
    lp_amount: u256, lords_reserve: u256, token_reserve: u256, total_lp_supply: u256,
) -> (u256, u256) {
    assert!(lp_amount > 0, "insufficient lp amount");
    assert!(lp_amount <= total_lp_supply, "lp amount exceeds supply");

    let lords_out = divide_wide_product(lp_amount, lords_reserve, total_lp_supply);
    let token_out = divide_wide_product(lp_amount, token_reserve, total_lp_supply);

    (lords_out, token_out)
}

#[cfg(test)]
mod tests {
    use super::{
        MINIMUM_LIQUIDITY, compute_add_liquidity, compute_lp_burn, compute_lp_mint, get_input_price, get_output_price,
        quote,
    };

    const FEE_NUM: u256 = 3;
    const FEE_DENOM: u256 = 1000; // 0.3% fee
    const HUGE: u256 = 0x100000000000000000000000000000000;
    const DOUBLE_HUGE: u256 = 0x200000000000000000000000000000000;

    #[test]
    fn test_get_input_price_no_fee() {
        // Pool: 170,000 LORDS / 150,000 tokens
        // Sell 17,500 tokens -> expect ~17,761 LORDS (from existing tests)
        let output = get_input_price(0, 1, 17_500, 150_000, 170_000);
        assert!(output == 17_761, "wrong output for no-fee sell");
    }

    #[test]
    fn test_get_input_price_with_fee() {
        // Pool: 170,000 LORDS / 150,000 tokens, 0.3% fee
        // Sell 17,500 tokens -> expect ~17,713 LORDS (from existing tests)
        let output = get_input_price(FEE_NUM, FEE_DENOM, 17_500, 150_000, 170_000);
        assert!(output == 17_713, "wrong output for fee sell");
    }

    #[test]
    fn test_get_input_price_large_values_without_intermediate_overflow() {
        let output = get_input_price(0, 1, HUGE, HUGE, DOUBLE_HUGE);
        assert!(output == HUGE, "wrong output for large no-fee sell");
    }

    #[test]
    fn test_get_output_price_no_fee() {
        // Pool: 170,000 LORDS / 150,000 tokens
        // Buy 14,890 tokens -> expect 18,736 LORDS cost (from existing tests)
        let cost = get_output_price(0, 1, 14_890, 170_000, 150_000);
        assert!(cost == 18_736, "wrong cost for no-fee buy");
    }

    #[test]
    fn test_get_output_price_with_fee() {
        // Pool: 170,000 LORDS / 150,000 tokens, 0.3% fee
        // Buy 14,890 tokens -> expect 18,792 LORDS cost (from existing tests)
        let cost = get_output_price(FEE_NUM, FEE_DENOM, 14_890, 170_000, 150_000);
        assert!(cost == 18_792, "wrong cost for fee buy");
    }

    #[test]
    fn test_get_output_price_large_values_without_intermediate_overflow() {
        let cost = get_output_price(0, 1, HUGE, DOUBLE_HUGE, DOUBLE_HUGE);
        assert!(cost == DOUBLE_HUGE + 1, "wrong cost for large no-fee buy");
    }

    #[test]
    fn test_constant_product_invariant_after_sell() {
        let lords_reserve: u256 = 170_000;
        let token_reserve: u256 = 150_000;
        let sell_amount: u256 = 17_500;

        let lords_out = get_input_price(FEE_NUM, FEE_DENOM, sell_amount, token_reserve, lords_reserve);

        let new_lords = lords_reserve - lords_out;
        let new_tokens = token_reserve + sell_amount;
        let initial_k = lords_reserve * token_reserve;
        let final_k = new_lords * new_tokens;

        // k should only increase (fees stay in pool)
        assert!(final_k >= initial_k, "constant product violated");
    }

    #[test]
    fn test_constant_product_invariant_after_buy() {
        let lords_reserve: u256 = 170_000;
        let token_reserve: u256 = 150_000;
        let buy_amount: u256 = 14_890;

        let lords_cost = get_output_price(FEE_NUM, FEE_DENOM, buy_amount, lords_reserve, token_reserve);

        let new_lords = lords_reserve + lords_cost;
        let new_tokens = token_reserve - buy_amount;
        let initial_k = lords_reserve * token_reserve;
        let final_k = new_lords * new_tokens;

        assert!(final_k >= initial_k, "constant product violated");
    }

    #[test]
    #[should_panic(expected: "output exceeds reserve")]
    fn test_buy_exceeds_reserve() {
        get_output_price(FEE_NUM, FEE_DENOM, 150_001, 170_000, 150_000);
    }

    #[test]
    #[should_panic(expected: "reserves must be > zero")]
    fn test_zero_reserves() {
        get_input_price(FEE_NUM, FEE_DENOM, 100, 0, 100);
    }

    #[test]
    fn test_quote() {
        // Pool 1:10 ratio. Given 2 of token A, should need 20 of token B.
        let result = quote(2, 1, 10);
        assert!(result == 20, "wrong quote");
    }

    #[test]
    fn test_quote_large_values_without_intermediate_overflow() {
        let result = quote(HUGE, DOUBLE_HUGE, DOUBLE_HUGE);
        assert!(result == HUGE, "wrong quote for large values");
    }

    #[test]
    fn test_compute_add_liquidity_first_provider() {
        let (lords, tokens) = compute_add_liquidity(1000, 5000, 0, 0);
        assert!(lords == 1000, "wrong lords");
        assert!(tokens == 5000, "wrong tokens");
    }

    #[test]
    fn test_compute_add_liquidity_proportional() {
        // Pool: 100 LORDS / 500 tokens (1:5 ratio)
        // Adding 50 LORDS -> need 250 tokens
        let (lords, tokens) = compute_add_liquidity(50, 300, 100, 500);
        assert!(lords == 50, "wrong lords");
        assert!(tokens == 250, "wrong tokens");
    }

    #[test]
    fn test_compute_add_liquidity_excess_lords() {
        // Pool: 100 LORDS / 500 tokens (1:5 ratio)
        // Adding 200 tokens -> only need 40 LORDS
        let (lords, tokens) = compute_add_liquidity(50, 200, 100, 500);
        assert!(lords == 40, "wrong lords");
        assert!(tokens == 200, "wrong tokens");
    }

    #[test]
    fn test_compute_lp_mint_first() {
        let lp = compute_lp_mint(5000, 0, 0);
        assert!(lp == 4000, "first mint should lock minimum liquidity");
    }

    #[test]
    #[should_panic(expected: "insufficient initial liquidity")]
    fn test_compute_lp_mint_first_requires_more_than_minimum_liquidity() {
        compute_lp_mint(MINIMUM_LIQUIDITY, 0, 0);
    }

    #[test]
    fn test_compute_lp_mint_subsequent() {
        // Pool: 100 LORDS, 50 LP outstanding. Adding 50 LORDS -> 25 LP.
        let lp = compute_lp_mint(50, 100, 50);
        assert!(lp == 25, "wrong lp mint");
    }

    #[test]
    fn test_compute_lp_mint_large_values_without_intermediate_overflow() {
        let lp = compute_lp_mint(HUGE, DOUBLE_HUGE, DOUBLE_HUGE);
        assert!(lp == HUGE, "wrong large-value lp mint");
    }

    #[test]
    fn test_compute_lp_burn() {
        // Pool: 200 LORDS / 1000 tokens, 100 LP total. Burn 25 LP -> 50 LORDS + 250 tokens.
        let (lords, tokens) = compute_lp_burn(25, 200, 1000, 100);
        assert!(lords == 50, "wrong lords out");
        assert!(tokens == 250, "wrong tokens out");
    }

    #[test]
    fn test_compute_lp_burn_large_values_without_intermediate_overflow() {
        let (lords, tokens) = compute_lp_burn(HUGE, DOUBLE_HUGE, DOUBLE_HUGE, HUGE);
        assert!(lords == DOUBLE_HUGE, "wrong large-value lords out");
        assert!(tokens == DOUBLE_HUGE, "wrong large-value token out");
    }

    #[test]
    #[should_panic(expected: "lp amount exceeds supply")]
    fn test_compute_lp_burn_exceeds_supply() {
        compute_lp_burn(101, 200, 1000, 100);
    }

    #[test]
    fn test_rounding_favors_pool() {
        // get_output_price rounds UP (+1), so the user always pays at least enough
        let cost = get_output_price(0, 1, 1, 100, 100);
        // Exact: 100 * 1 / (100 - 1) = 1.0101... -> rounds to 2
        assert!(cost == 2, "should round up");
    }
}
