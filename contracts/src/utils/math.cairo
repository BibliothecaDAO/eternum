use alexandria_math::U256BitShift;
use alexandria_math::U32BitShift;

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


///////// U32 Bit Manipulation /////////

/// Check whether a bit is set in a u32 number
pub fn is_u32_bit_set(number: u32, position: u8) -> bool {
    assert!(position <= 31, "position must be within the values of 0 and 31 (inclusive)");

    if (number & U32BitShift::shl(1, position.into())) > 0 {
        return true;
    }
    return false;
}

/// Set a bit to a value in a u32 number
pub fn set_u32_bit(number: u32, position: u8, value: bool) -> u32 {
    assert!(position <= 31, "position must be within the values of 0 and 31 (inclusive)");

    let value = if (value == true) {
        1
    } else {
        0
    };
    let mask = U32BitShift::shl(1, position.into());
    return (number & ~mask) | ((U32BitShift::shl(value, position.into())) & mask);
}


///////// U256 Bit Manipulation /////////

/// Check whether a bit is set in a u256 number
pub fn is_u256_bit_set(number: u256, position: u8) -> bool {
    if (number & U256BitShift::shl(1, position.into())) > 0 {
        return true;
    }
    return false;
}

/// Set a bit to a value in a u256 number
pub fn set_u256_bit(number: u256, position: u8, value: bool) -> u256 {
    let value = if (value == true) {
        1
    } else {
        0
    };
    let mask = U256BitShift::shl(1, position.into());
    return (number & ~mask) | ((U256BitShift::shl(value, position.into())) & mask);
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

    fn _10() -> u64 {
        1_000
    }

    fn _50() -> u64 {
        5_000
    }

    fn _100() -> u64 {
        10_000
    }
}
