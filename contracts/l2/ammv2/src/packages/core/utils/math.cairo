use core::num::traits::{Sqrt, Zero};
use core::pedersen::pedersen;
use core::traits::TryInto;
use starknet::ContractAddress;

pub const MINIMUM_LIQUIDITY: u256 = 1000;
pub const DEFAULT_fee_amount: u256 = 997;
pub const TWO: u256 = 2;
pub const FIVE: u256 = 5;
pub const THOUSAND: u256 = 1000;
pub const MILLION: u256 = 1_000_000;

pub fn burn_address() -> ContractAddress {
    1.try_into().unwrap()
}

pub fn is_non_zero_amount(value: u256) -> bool {
    value != 0
}

pub fn min(lhs: u256, rhs: u256) -> u256 {
    if lhs < rhs {
        lhs
    } else {
        rhs
    }
}

pub fn sqrt(value: u256) -> u256 {
    value.sqrt().into()
}

pub fn sort_tokens(token_a: ContractAddress, token_b: ContractAddress) -> (ContractAddress, ContractAddress) {
    assert!(token_a != token_b, "RealmsSwap::Math::identical addresses");
    let (token0, token1) = if token_a < token_b {
        (token_a, token_b)
    } else {
        (token_b, token_a)
    };
    assert!(!token0.is_zero(), "RealmsSwap::Math::zero token");
    (token0, token1)
}

pub fn pair_salt(token0: ContractAddress, token1: ContractAddress) -> felt252 {
    pedersen(token0.into(), token1.into())
}

pub fn quote(amount_a: u256, reserve_a: u256, reserve_b: u256) -> u256 {
    assert!(amount_a > 0, "RealmsSwap::Router::_quote::insufficient amount");
    assert!(reserve_a > 0 && reserve_b > 0, "RealmsSwap::Router::_quote::insufficient liquidity");
    (amount_a * reserve_b) / reserve_a
}

pub fn assert_valid_fee_amount(fee_amount: u256) {
    assert!(fee_amount > 0, "RealmsSwap::Math::fee amount over 1000 must be positive");
    assert!(fee_amount <= THOUSAND, "RealmsSwap::Math::fee amount over 1000 must be <= 1000");
}

pub fn fee_units(fee_amount: u256) -> u256 {
    assert_valid_fee_amount(fee_amount);
    THOUSAND - fee_amount
}

pub fn get_amount_out(amount_in: u256, reserve_in: u256, reserve_out: u256, fee_amount: u256) -> u256 {
    assert!(amount_in > 0, "RealmsSwap::Router::_get_amount_out::insufficient input amount");
    assert!(reserve_in > 0 && reserve_out > 0, "RealmsSwap::Router::_get_amount_out::insufficient liquidity");
    assert_valid_fee_amount(fee_amount);

    let amount_in_with_fee = amount_in * fee_amount;
    let numerator = amount_in_with_fee * reserve_out;
    let denominator = reserve_in * THOUSAND + amount_in_with_fee;
    numerator / denominator
}

pub fn get_amount_in(amount_out: u256, reserve_in: u256, reserve_out: u256, fee_amount: u256) -> u256 {
    assert!(amount_out > 0, "RealmsSwap::Router::_get_amount_in::insufficient output amount");
    assert!(reserve_in > 0 && reserve_out > 0, "RealmsSwap::Router::_get_amount_in::insufficient liquidity");
    assert!(amount_out < reserve_out, "RealmsSwap::Router::_get_amount_in::insufficient liquidity");
    assert_valid_fee_amount(fee_amount);

    let numerator = reserve_in * amount_out * THOUSAND;
    let denominator = (reserve_out - amount_out) * fee_amount;
    (numerator / denominator) + 1
}

pub fn product(lhs: u256, rhs: u256) -> u256 {
    lhs * rhs
}

pub fn zero_amount() -> u256 {
    Zero::zero()
}
