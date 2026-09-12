/// Performs division with rounding to the nearest integer.
///
/// Uses the "add half and divide" technique: adding half the divisor before
/// dividing causes proper rounding instead of truncation. This prevents
/// systematic bias towards lower values in repeated calculations.
///
/// # Arguments
/// * `n` - The numerator (dividend)
/// * `d` - The denominator (divisor)
///
/// # Returns
/// * `u128` - The result of n/d rounded to the nearest integer.
///           Returns 0 if divisor is 0 (division-by-zero safe).
///
/// # Examples
/// * `div_round(10, 3)` returns `3` (10/3 = 3.33... → 3)
/// * `div_round(11, 3)` returns `4` (11/3 = 3.67... → 4)
/// * `div_round(5, 2)` returns `3` (5/2 = 2.5 → 3, rounds up at .5)
/// * `div_round(9, 5)` returns `2` (9/5 = 1.8 → 2)
/// * `div_round(10, 0)` returns `0` (safe guard)
pub fn div_round(n: u128, d: u128) -> u128 {
    if d == 0_u128 {
        return 0_u128;
    }
    let half = d / 2_u128;
    (n + half) / d
}


// Raise a number to a power.
/// * `base` - The number to raise.
/// * `exp` - The exponent.
/// # Returns
/// * `felt252` - The result of base raised to the power of exp.
pub fn pow(base: felt252, exp: felt252) -> felt252 {
    match exp {
        0 => 1,
        _ => base * pow(base, exp - 1),
    }
}


pub fn min<T, impl TPartialOrd: PartialOrd<T>, impl TCopy: Copy<T>, impl TDrop: Drop<T>>(a: T, b: T) -> T {
    return if (a < b) {
        return a;
    } else {
        return b;
    };
}

pub fn max<T, impl TPartialOrd: PartialOrd<T>, impl TCopy: Copy<T>, impl TDrop: Drop<T>>(a: T, b: T) -> T {
    return if (a > b) {
        return a;
    } else {
        return b;
    };
}


pub trait PercentageTrait<T> {
    fn get(value: T, numerator: u64) -> T;
}

pub impl PercentageImpl<T, +Mul<T>, +Div<T>, +Into<u64, T>, +Copy<T>, +Drop<T>> of PercentageTrait<T> {
    fn get(value: T, numerator: u64) -> T {
        return (value * numerator.into()) / PercentageValueImpl::_100().into();
    }
}

#[generate_trait]
pub impl PercentageValueImpl of PercentageValueTrait {
    fn _1() -> u64 {
        100
    }

    fn _100() -> u64 {
        10_000
    }
}
