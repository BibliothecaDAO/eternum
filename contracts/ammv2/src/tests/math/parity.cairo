use ammv2::packages::core::utils::math::{
    DEFAULT_fee_amount, THOUSAND, assert_valid_fee_amount, fee_units, get_amount_in, get_amount_out, quote, sort_tokens,
};
use core::traits::TryInto;
use starknet::ContractAddress;
use super::super::helpers::addresses::{TOKEN_A, TOKEN_B};

fn ZERO_ADDRESS() -> ContractAddress {
    0.try_into().unwrap()
}

#[test]
fn test_sort_tokens_orders_addresses() {
    let (token0, token1) = sort_tokens(TOKEN_A(), TOKEN_B());
    assert!(token0 == TOKEN_A(), "token0 should be the lower address");
    assert!(token1 == TOKEN_B(), "token1 should be the higher address");
}

#[test]
fn test_sort_tokens_sorts_reverse_input() {
    let (token0, token1) = sort_tokens(TOKEN_B(), TOKEN_A());
    assert!(token0 == TOKEN_A(), "token0 should be stable under reversed input");
    assert!(token1 == TOKEN_B(), "token1 should be stable under reversed input");
}

#[test]
#[should_panic(expected: "RealmsSwap::Math::identical addresses")]
fn test_sort_tokens_rejects_identical_addresses() {
    let _ = sort_tokens(TOKEN_A(), TOKEN_A());
}

#[test]
#[should_panic(expected: "RealmsSwap::Math::zero token")]
fn test_sort_tokens_rejects_zero_token() {
    let _ = sort_tokens(TOKEN_A(), ZERO_ADDRESS());
}

#[test]
fn test_quote_matches_reference_ratio() {
    let result = quote(2, 1, 10);
    assert!(result == 20, "quote should preserve the pool ratio");
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_quote::insufficient amount")]
fn test_quote_rejects_zero_amount() {
    let _ = quote(0, 1, 10);
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_quote::insufficient liquidity")]
fn test_quote_rejects_zero_liquidity() {
    let _ = quote(2, 0, 10);
}

#[test]
fn test_assert_valid_fee_amount_accepts_default_fee() {
    assert_valid_fee_amount(DEFAULT_fee_amount);
}

#[test]
#[should_panic(expected: "RealmsSwap::Math::fee amount over 1000 must be positive")]
fn test_assert_valid_fee_amount_rejects_zero_fee() {
    assert_valid_fee_amount(0);
}

#[test]
#[should_panic(expected: "RealmsSwap::Math::fee amount over 1000 must be <= 1000")]
fn test_assert_valid_fee_amount_rejects_fee_above_thousand() {
    assert_valid_fee_amount(THOUSAND + 1);
}

#[test]
fn test_fee_units_matches_reference_difference() {
    let result = fee_units(DEFAULT_fee_amount);
    assert!(result == 3, "fee units should be the complement over 1000");
}

#[test]
fn test_get_amount_out_matches_reference_case() {
    let result = get_amount_out(17_500, 150_000, 170_000, DEFAULT_fee_amount);
    assert!(result == 17_713, "get_amount_out should match the reference swap quote");
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_get_amount_out::insufficient input amount")]
fn test_get_amount_out_rejects_zero_input() {
    let _ = get_amount_out(0, 150_000, 170_000, DEFAULT_fee_amount);
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_get_amount_out::insufficient liquidity")]
fn test_get_amount_out_rejects_zero_liquidity() {
    let _ = get_amount_out(17_500, 0, 170_000, DEFAULT_fee_amount);
}

#[test]
fn test_get_amount_in_matches_reference_case() {
    let result = get_amount_in(14_890, 170_000, 150_000, DEFAULT_fee_amount);
    assert!(result == 18_792, "get_amount_in should match the reference buy quote");
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_get_amount_in::insufficient output amount")]
fn test_get_amount_in_rejects_zero_output() {
    let _ = get_amount_in(0, 170_000, 150_000, DEFAULT_fee_amount);
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_get_amount_in::insufficient liquidity")]
fn test_get_amount_in_rejects_zero_liquidity() {
    let _ = get_amount_in(1, 0, 150_000, DEFAULT_fee_amount);
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_get_amount_in::insufficient liquidity")]
fn test_get_amount_in_rejects_output_at_or_above_reserve() {
    let _ = get_amount_in(150_000, 170_000, 150_000, DEFAULT_fee_amount);
}
