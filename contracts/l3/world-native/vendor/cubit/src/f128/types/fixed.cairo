use core::debug::PrintTrait;
use core::integer::{U256DivRem, u256_as_non_zero, u256_from_felt252, u256_safe_divmod};
use core::ops::{AddAssign, DivAssign, MulAssign, SubAssign};
use core::option::OptionTrait;
use core::result::{ResultTrait, ResultTraitImpl};
use core::traits::{Into, TryInto};
use eternum_cubit::f128::math::ops;
use eternum_cubit::utils;
use starknet::storage_access::StorePacking;

// CONSTANTS

const PRIME: felt252 = 3618502788666131213697322783095070105623107215331596699973092056135872020480;
const ONE: felt252 = 18446744073709551616; // 2 ** 64
const ONE_u128: u128 = 18446744073709551616_u128; // 2 ** 64
const HALF: felt252 = 9223372036854775808; // 2 ** 63
const HALF_u128: u128 = 9223372036854775808_u128; // 2 ** 63
const MAX_u128: u128 = 340282366920938463463374607431768211455_u128; // 2 ** 128 - 1

// STRUCTS

#[derive(Copy, Drop, Serde)]
struct Fixed {
    mag: u128,
    sign: bool,
}

// TRAITS

trait FixedTrait {
    fn ZERO() -> Fixed;
    fn ONE() -> Fixed;

    // Constructors
    fn new(mag: u128, sign: bool) -> Fixed;
    fn new_unscaled(mag: u128, sign: bool) -> Fixed;
    fn from_felt(val: felt252) -> Fixed;
    fn from_unscaled_felt(val: felt252) -> Fixed;

    // Math
    fn abs(self: Fixed) -> Fixed;
    fn ceil(self: Fixed) -> Fixed;
    fn exp(self: Fixed) -> Fixed;
    fn exp2(self: Fixed) -> Fixed;
    fn floor(self: Fixed) -> Fixed;
    fn ln(self: Fixed) -> Fixed;
    fn log2(self: Fixed) -> Fixed;
    fn log10(self: Fixed) -> Fixed;
    fn pow(self: Fixed, b: Fixed) -> Fixed;
    fn round(self: Fixed) -> Fixed;
    fn sqrt(self: Fixed) -> Fixed;
    // Trigonometry

    // Hyperbolic
}

// IMPLS

impl FixedImpl of FixedTrait {
    fn ZERO() -> Fixed {
        return core::num::traits::Zero::zero();
    }

    fn ONE() -> Fixed {
        return core::num::traits::One::one();
    }

    fn new(mag: u128, sign: bool) -> Fixed {
        return Fixed { mag: mag, sign: sign };
    }

    fn new_unscaled(mag: u128, sign: bool) -> Fixed {
        return Self::new(mag * ONE_u128, sign);
    }

    fn from_felt(val: felt252) -> Fixed {
        let mag = core::integer::u128_try_from_felt252(utils::felt_abs(val)).unwrap();
        return Self::new(mag, utils::felt_sign(val));
    }

    fn from_unscaled_felt(val: felt252) -> Fixed {
        return Self::from_felt(val * ONE);
    }

    fn abs(self: Fixed) -> Fixed {
        return ops::abs(self);
    }


    fn ceil(self: Fixed) -> Fixed {
        return ops::ceil(self);
    }


    fn floor(self: Fixed) -> Fixed {
        return ops::floor(self);
    }

    // Calculates the natural exponent of x: e^x
    fn exp(self: Fixed) -> Fixed {
        return ops::exp(self);
    }

    // Calculates the binary exponent of x: 2^x
    fn exp2(self: Fixed) -> Fixed {
        return ops::exp2(self);
    }

    // Calculates the natural logarithm of x: ln(x)
    // self must be greater than zero
    fn ln(self: Fixed) -> Fixed {
        return ops::ln(self);
    }

    // Calculates the binary logarithm of x: log2(x)
    // self must be greather than zero
    fn log2(self: Fixed) -> Fixed {
        return ops::log2(self);
    }

    // Calculates the base 10 log of x: log10(x)
    // self must be greater than zero
    fn log10(self: Fixed) -> Fixed {
        return ops::log10(self);
    }

    // Calclates the value of x^y and checks for overflow before returning
    // self is a fixed point value
    // b is a fixed point value
    fn pow(self: Fixed, b: Fixed) -> Fixed {
        return ops::pow(self, b);
    }

    fn round(self: Fixed) -> Fixed {
        return ops::round(self);
    }


    // Calculates the square root of a fixed point value
    // x must be positive
    fn sqrt(self: Fixed) -> Fixed {
        return ops::sqrt(self);
    }
}

impl FixedPrint of PrintTrait<Fixed> {
    fn print(self: Fixed) {
        self.sign.print();
        self.mag.print();
    }
}

// Into a raw felt without unscaling
impl FixedInto of Into<Fixed, felt252> {
    fn into(self: Fixed) -> felt252 {
        let mag_felt = self.mag.into();

        if self.sign {
            return mag_felt * -1;
        } else {
            return mag_felt * 1;
        }
    }
}

impl FixedTryIntoU128 of TryInto<Fixed, u128> {
    fn try_into(self: Fixed) -> Option<u128> {
        if self.sign {
            return Option::None(());
        } else {
            // Unscale the magnitude and round down
            return Option::Some(self.mag / ONE_u128);
        }
    }
}

impl FixedTryIntoU64 of TryInto<Fixed, u64> {
    fn try_into(self: Fixed) -> Option<u64> {
        if self.sign {
            return Option::None(());
        } else {
            // Unscale the magnitude and round down
            return Into::<u128, felt252>::into(self.mag / ONE_u128).try_into();
        }
    }
}

impl FixedTryIntoU32 of TryInto<Fixed, u32> {
    fn try_into(self: Fixed) -> Option<u32> {
        if self.sign {
            Option::None(())
        } else {
            // Unscale the magnitude and round down
            return Into::<u128, felt252>::into(self.mag / ONE_u128).try_into();
        }
    }
}

impl FixedTryIntoU16 of TryInto<Fixed, u16> {
    fn try_into(self: Fixed) -> Option<u16> {
        if self.sign {
            Option::None(())
        } else {
            // Unscale the magnitude and round down
            return Into::<u128, felt252>::into(self.mag / ONE_u128).try_into();
        }
    }
}

impl FixedTryIntoU8 of TryInto<Fixed, u8> {
    fn try_into(self: Fixed) -> Option<u8> {
        if self.sign {
            Option::None(())
        } else {
            // Unscale the magnitude and round down
            return Into::<u128, felt252>::into(self.mag / ONE_u128).try_into();
        }
    }
}

impl U8IntoFixed of Into<u8, Fixed> {
    fn into(self: u8) -> Fixed {
        FixedTrait::new_unscaled(self.into(), false)
    }
}

impl U16IntoFixed of Into<u16, Fixed> {
    fn into(self: u16) -> Fixed {
        FixedTrait::new_unscaled(self.into(), false)
    }
}

impl U32IntoFixed of Into<u32, Fixed> {
    fn into(self: u32) -> Fixed {
        FixedTrait::new_unscaled(self.into(), false)
    }
}

impl U64IntoFixed of Into<u64, Fixed> {
    fn into(self: u64) -> Fixed {
        FixedTrait::new_unscaled(self.into(), false)
    }
}

impl U128IntoFixed of Into<u128, Fixed> {
    fn into(self: u128) -> Fixed {
        FixedTrait::new_unscaled(self.into(), false)
    }
}

impl U256TryIntoFixed of TryInto<u256, Fixed> {
    fn try_into(self: u256) -> Option<Fixed> {
        if self.high > 0 {
            return Option::None(());
        } else {
            return Option::Some(FixedTrait::new_unscaled(self.try_into().unwrap(), false));
        }
    }
}

impl I8IntoFixed of Into<i8, Fixed> {
    fn into(self: i8) -> Fixed {
        if 0 <= self {
            return FixedTrait::new_unscaled(self.try_into().unwrap(), false);
        } else {
            return FixedTrait::new_unscaled((-self).try_into().unwrap(), true);
        }
    }
}

impl I16IntoFixed of Into<i16, Fixed> {
    fn into(self: i16) -> Fixed {
        if 0 <= self {
            return FixedTrait::new_unscaled(self.try_into().unwrap(), false);
        } else {
            return FixedTrait::new_unscaled((-self).try_into().unwrap(), true);
        }
    }
}

impl I32IntoFixed of Into<i32, Fixed> {
    fn into(self: i32) -> Fixed {
        if 0 <= self {
            return FixedTrait::new_unscaled(self.try_into().unwrap(), false);
        } else {
            return FixedTrait::new_unscaled((-self).try_into().unwrap(), true);
        }
    }
}

impl I64IntoFixed of Into<i64, Fixed> {
    fn into(self: i64) -> Fixed {
        if 0 <= self {
            return FixedTrait::new_unscaled(self.try_into().unwrap(), false);
        } else {
            return FixedTrait::new_unscaled((-self).try_into().unwrap(), true);
        }
    }
}

impl I128IntoFixed of Into<i128, Fixed> {
    fn into(self: i128) -> Fixed {
        if 0 <= self {
            return FixedTrait::new_unscaled(self.try_into().unwrap(), false);
        } else {
            return FixedTrait::new_unscaled((-self).try_into().unwrap(), true);
        }
    }
}

impl FixedPartialEq of PartialEq<Fixed> {
    #[inline(always)]
    fn eq(lhs: @Fixed, rhs: @Fixed) -> bool {
        return ops::eq(lhs, rhs);
    }

    #[inline(always)]
    fn ne(lhs: @Fixed, rhs: @Fixed) -> bool {
        return ops::ne(lhs, rhs);
    }
}

impl FixedAdd of Add<Fixed> {
    fn add(lhs: Fixed, rhs: Fixed) -> Fixed {
        return ops::add(lhs, rhs);
    }
}

impl FixedAddAssign of AddAssign<Fixed, Fixed> {
    #[inline(always)]
    fn add_assign(ref self: Fixed, rhs: Fixed) {
        self = Add::add(self, rhs);
    }
}

impl FixedSub of Sub<Fixed> {
    fn sub(lhs: Fixed, rhs: Fixed) -> Fixed {
        return ops::sub(lhs, rhs);
    }
}

impl FixedSubAssign of SubAssign<Fixed, Fixed> {
    #[inline(always)]
    fn sub_assign(ref self: Fixed, rhs: Fixed) {
        self = Sub::sub(self, rhs);
    }
}

impl FixedMul of Mul<Fixed> {
    fn mul(lhs: Fixed, rhs: Fixed) -> Fixed {
        return ops::mul(lhs, rhs);
    }
}

impl FixedMulAssign of MulAssign<Fixed, Fixed> {
    #[inline(always)]
    fn mul_assign(ref self: Fixed, rhs: Fixed) {
        self = Mul::mul(self, rhs);
    }
}

impl FixedDiv of Div<Fixed> {
    fn div(lhs: Fixed, rhs: Fixed) -> Fixed {
        return ops::div(lhs, rhs);
    }
}

impl FixedDivAssign of DivAssign<Fixed, Fixed> {
    #[inline(always)]
    fn div_assign(ref self: Fixed, rhs: Fixed) {
        self = Div::div(self, rhs);
    }
}

impl FixedPartialOrd of PartialOrd<Fixed> {
    #[inline(always)]
    fn ge(lhs: Fixed, rhs: Fixed) -> bool {
        return ops::ge(lhs, rhs);
    }

    #[inline(always)]
    fn gt(lhs: Fixed, rhs: Fixed) -> bool {
        return ops::gt(lhs, rhs);
    }

    #[inline(always)]
    fn le(lhs: Fixed, rhs: Fixed) -> bool {
        return ops::le(lhs, rhs);
    }

    #[inline(always)]
    fn lt(lhs: Fixed, rhs: Fixed) -> bool {
        return ops::lt(lhs, rhs);
    }
}

impl FixedNeg of Neg<Fixed> {
    #[inline(always)]
    fn neg(a: Fixed) -> Fixed {
        return ops::neg(a);
    }
}

impl FixedRem of Rem<Fixed> {
    #[inline(always)]
    fn rem(lhs: Fixed, rhs: Fixed) -> Fixed {
        return ops::rem(lhs, rhs);
    }
}

impl PackFixed of StorePacking<Fixed, felt252> {
    fn pack(value: Fixed) -> felt252 {
        let MAX_MAG_PLUS_ONE = 0x100000000000000000000000000000000; // 2**128
        let packed_sign = MAX_MAG_PLUS_ONE * value.sign.into();
        value.mag.into() + packed_sign
    }

    fn unpack(value: felt252) -> Fixed {
        let (q, r) = U256DivRem::div_rem(value.into(), u256_as_non_zero(0x100000000000000000000000000000000));
        let mag: u128 = r.try_into().unwrap();
        let sign: bool = q.try_into().unwrap() == 1;
        Fixed { mag: mag, sign: sign }
    }
}


impl FixedZero of core::num::traits::Zero<Fixed> {
    fn zero() -> Fixed {
        Fixed { mag: 0, sign: false }
    }
    #[inline(always)]
    fn is_zero(self: @Fixed) -> bool {
        *self.mag == 0
    }
    #[inline(always)]
    fn is_non_zero(self: @Fixed) -> bool {
        !self.is_zero()
    }
}

// One trait implementations
impl FixedOne of core::num::traits::One<Fixed> {
    fn one() -> Fixed {
        Fixed { mag: ONE_u128, sign: false }
    }
    #[inline(always)]
    fn is_one(self: @Fixed) -> bool {
        *self == Self::one()
    }
    #[inline(always)]
    fn is_non_one(self: @Fixed) -> bool {
        !self.is_one()
    }
}
// Tests
// --------------------------------------------------------------------------------------------------------------


