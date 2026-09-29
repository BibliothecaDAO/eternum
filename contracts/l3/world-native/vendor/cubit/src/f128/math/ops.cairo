use core::debug::PrintTrait;
use core::integer;
use core::integer::{u256_as_non_zero, u256_safe_div_rem, upcast};
use core::num::traits::{Sqrt, WideMul};
use core::option::OptionTrait;
use core::result::{ResultTrait, ResultTraitImpl};
use core::traits::{Into, TryInto};
use eternum_cubit::f128::math::lut;
use eternum_cubit::f128::types::fixed::{
    Fixed, FixedAdd, FixedDiv, FixedInto, FixedMul, FixedNeg, FixedTrait, HALF_u128, MAX_u128, ONE_u128,
};

// PUBLIC

fn abs(a: Fixed) -> Fixed {
    return FixedTrait::new(a.mag, false);
}

fn add(a: Fixed, b: Fixed) -> Fixed {
    if a.sign == b.sign {
        return FixedTrait::new(a.mag + b.mag, a.sign);
    }

    if a.mag == b.mag {
        return FixedTrait::ZERO();
    }

    if (a.mag > b.mag) {
        return FixedTrait::new(a.mag - b.mag, a.sign);
    } else {
        return FixedTrait::new(b.mag - a.mag, b.sign);
    }
}

fn ceil(a: Fixed) -> Fixed {
    let (div_u128, rem_u128) = _split_unsigned(a);

    if rem_u128 == 0 {
        return a;
    } else if !a.sign {
        return FixedTrait::new_unscaled(div_u128 + 1, false);
    } else if div_u128 == 0 {
        return FixedTrait::new_unscaled(0, false);
    } else {
        return FixedTrait::new_unscaled(div_u128, true);
    }
}

fn div(a: Fixed, b: Fixed) -> Fixed {
    let a_u256 = WideMul::<u128, u128>::wide_mul(a.mag, ONE_u128);
    let b_u256 = u256 { low: b.mag, high: 0 };
    let res_u256 = a_u256 / b_u256;

    assert(res_u256.high == 0, 'result overflow');

    // Re-apply sign
    return FixedTrait::new(res_u256.low, a.sign ^ b.sign);
}

fn eq(a: @Fixed, b: @Fixed) -> bool {
    return (*a.mag == *b.mag) && (*a.sign == *b.sign);
}

// Calculates the natural exponent of x: e^x
fn exp(a: Fixed) -> Fixed {
    return exp2(FixedTrait::new(26613026195688644984, false) * a);
}

// Calculates the binary exponent of x: 2^x
fn exp2(a: Fixed) -> Fixed {
    if (a.mag == 0) {
        return FixedTrait::ONE();
    }

    let (int_part, frac_part) = _split_unsigned(a);
    let int_res = FixedTrait::new_unscaled(lut::exp2(int_part), false);
    let mut res_u = int_res;

    if frac_part != 0 {
        let frac_fixed = FixedTrait::new(frac_part, false);
        let r8 = FixedTrait::new(41691949755436, false) * frac_fixed;
        let r7 = (r8 + FixedTrait::new(231817862090993, false)) * frac_fixed;
        let r6 = (r7 + FixedTrait::new(2911875592466782, false)) * frac_fixed;
        let r5 = (r6 + FixedTrait::new(24539637786416367, false)) * frac_fixed;
        let r4 = (r5 + FixedTrait::new(177449490038807528, false)) * frac_fixed;
        let r3 = (r4 + FixedTrait::new(1023863119786103800, false)) * frac_fixed;
        let r2 = (r3 + FixedTrait::new(4431397849999009866, false)) * frac_fixed;
        let r1 = (r2 + FixedTrait::new(12786308590235521577, false)) * frac_fixed;
        res_u = res_u * (r1 + FixedTrait::ONE());
    }

    if (a.sign == true) {
        return FixedTrait::ONE() / res_u;
    } else {
        return res_u;
    }
}

fn exp2_int(exp: u128) -> Fixed {
    return FixedTrait::new_unscaled(lut::exp2(exp), false);
}

fn floor(a: Fixed) -> Fixed {
    let (div_u128, rem_u128) = _split_unsigned(a);

    if rem_u128 == 0 {
        return a;
    } else if !a.sign {
        return FixedTrait::new_unscaled(div_u128, false);
    } else {
        return FixedTrait::new_unscaled(div_u128 + 1, true);
    }
}

fn ge(a: Fixed, b: Fixed) -> bool {
    if a.sign != b.sign {
        return !a.sign;
    } else {
        return (a.mag == b.mag) || ((a.mag > b.mag) ^ a.sign);
    }
}

fn gt(a: Fixed, b: Fixed) -> bool {
    if a.sign != b.sign {
        return !a.sign;
    } else {
        return (a.mag != b.mag) && ((a.mag > b.mag) ^ a.sign);
    }
}

fn le(a: Fixed, b: Fixed) -> bool {
    if a.sign != b.sign {
        return a.sign;
    } else {
        return (a.mag == b.mag) || ((a.mag < b.mag) ^ a.sign);
    }
}

// Calculates the natural logarithm of x: ln(x)
// self must be greater than zero
fn ln(a: Fixed) -> Fixed {
    return FixedTrait::new(12786308645202655660, false) * log2(a); // ln(2) = 0.693...
}

// Calculates the binary logarithm of x: log2(x)
// self must be greather than zero
fn log2(a: Fixed) -> Fixed {
    assert(a.sign == false, 'must be positive');

    if (a.mag == ONE_u128) {
        return FixedTrait::ZERO();
    } else if (a.mag < ONE_u128) {
        // Compute true inverse binary log if 0 < x < 1
        let div = FixedTrait::ONE() / a;
        return -log2(div);
    }

    let (msb, div) = lut::msb(a.mag / ONE_u128);
    let norm = a / FixedTrait::new_unscaled(div, false);

    let r8 = FixedTrait::new(167660832607149504, true) * norm;
    let r7 = (r8 + FixedTrait::new(2284550827067371376, false)) * norm;
    let r6 = (r7 + FixedTrait::new(13804762162529339368, true)) * norm;
    let r5 = (r6 + FixedTrait::new(48676798788932142400, false)) * norm;
    let r4 = (r5 + FixedTrait::new(110928274989790216568, true)) * norm;
    let r3 = (r4 + FixedTrait::new(171296190111888966192, false)) * norm;
    let r2 = (r3 + FixedTrait::new(184599081115266689944, true)) * norm;
    let r1 = (r2 + FixedTrait::new(150429590981271126408, false)) * norm;
    return r1 + FixedTrait::new(63187350828072553424, true) + FixedTrait::new_unscaled(msb, false);
}

// Calculates the base 10 log of x: log10(x)
// self must be greater than zero
fn log10(a: Fixed) -> Fixed {
    return FixedTrait::new(5553023288523357132, false) * log2(a); // log10(2) = 0.301...
}

fn lt(a: Fixed, b: Fixed) -> bool {
    if a.sign != b.sign {
        return a.sign;
    } else {
        return (a.mag != b.mag) && ((a.mag < b.mag) ^ a.sign);
    }
}

fn mul(a: Fixed, b: Fixed) -> Fixed {
    let res_u256 = WideMul::<u128, u128>::wide_mul(a.mag, b.mag);
    let ONE_u256 = u256 { low: ONE_u128, high: 0 };
    let (scaled_u256, _) = u256_safe_div_rem(res_u256, u256_as_non_zero(ONE_u256));

    assert(scaled_u256.high == 0, 'result overflow');

    // Re-apply sign
    return FixedTrait::new(scaled_u256.low, a.sign ^ b.sign);
}

#[derive(Copy, Drop, Serde)]
struct f64 {
    mag: u64,
    sign: bool,
}

fn mul_64(a: f64, b: f64) -> f64 {
    let prod_u128 = WideMul::<u64, u64>::wide_mul(a.mag, b.mag);
    return f64 { mag: (prod_u128 / 4294967296).try_into().unwrap(), sign: a.sign ^ b.sign };
}

fn ne(a: @Fixed, b: @Fixed) -> bool {
    return (*a.mag != *b.mag) || (*a.sign != *b.sign);
}

fn neg(a: Fixed) -> Fixed {
    if a.mag == 0 {
        return a;
    } else if !a.sign {
        return FixedTrait::new(a.mag, !a.sign);
    } else {
        return FixedTrait::new(a.mag, false);
    }
}

// Calclates the value of x^y and checks for overflow before returning
// self is a fixed point value
// b is a fixed point value
fn pow(a: Fixed, b: Fixed) -> Fixed {
    let (_div_u128, rem_u128) = _split_unsigned(b);

    // use the more performant integer pow when y is an int
    if (rem_u128 == 0) {
        return pow_int(a, b.mag / ONE_u128, b.sign);
    }

    // x^y = exp(y*ln(x)) for x > 0 will error for x < 0
    return exp(b * ln(a));
}

// Calclates the value of a^b and checks for overflow before returning
fn pow_int(a: Fixed, b: u128, sign: bool) -> Fixed {
    let mut x = a;
    let mut n = b;

    if sign == true {
        x = FixedTrait::ONE() / x;
    }

    if n == 0 {
        return FixedTrait::ONE();
    }

    let mut y = FixedTrait::ONE();
    let two = integer::u128_as_non_zero(2);

    loop {
        if n <= 1 {
            break;
        }

        let (div, rem) = integer::u128_safe_divmod(n, two);

        if rem == 1 {
            y = x * y;
        }

        x = x * x;
        n = div;
    }

    return x * y;
}

fn rem(a: Fixed, b: Fixed) -> Fixed {
    return a - floor(a / b) * b;
}

fn round(a: Fixed) -> Fixed {
    let (div_u128, rem_u128) = _split_unsigned(a);

    if (HALF_u128 <= rem_u128) {
        return FixedTrait::new(ONE_u128 * (div_u128 + 1), a.sign);
    } else {
        return FixedTrait::new(ONE_u128 * div_u128, a.sign);
    }
}

// Calculates the square root of a fixed point value
// x must be positive
fn sqrt(a: Fixed) -> Fixed {
    assert(a.sign == false, 'must be positive');
    let root = Sqrt::<u128>::sqrt(a.mag);
    let scale_root = Sqrt::<u128>::sqrt(ONE_u128);
    let res_u128 = upcast(root) * ONE_u128 / upcast(scale_root);
    return FixedTrait::new(res_u128, false);
}

fn sub(a: Fixed, b: Fixed) -> Fixed {
    return add(a, -b);
}

// Ignores sign and always returns false
fn _split_unsigned(a: Fixed) -> (u128, u128) {
    return integer::u128_safe_divmod(a.mag, integer::u128_as_non_zero(ONE_u128));
}
// Tests
// --------------------------------------------------------------------------------------------------------------


