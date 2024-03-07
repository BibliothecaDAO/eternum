
// copy pasta from https://github.com/gizatechxyz/orion/tree/main/src/operators

trait NumberTrait<T, MAG> {
    fn abs(self: T) -> T;    
}


impl i128Number of NumberTrait<i128, i128> {
    fn abs(self: i128) -> i128 {
        if self >= 0 {
            return self;
        } else {
            self * -1_i128
        }
    }
}

impl i128Div of Div<i128> {
    fn div(lhs: i128, rhs: i128) -> i128 {
        assert(rhs != 0, 'divisor cannot be 0');
        let mut lhs_positive = lhs;
        let mut rhs_positive = rhs;
        // making sure everything is positive
        if lhs < 0 {
            lhs_positive = lhs * -1;
        }
        if rhs < 0 {
            rhs_positive = rhs * -1;
        }
        //felt252 plays role of a bridge for type casting
        let lhs_felt: felt252 = lhs_positive.into();
        let rhs_felt: felt252 = rhs_positive.into();
        let lhs_u128: u128 = lhs_felt.try_into().unwrap();
        let rhs_u128: u128 = rhs_felt.try_into().unwrap();
        let mut result = lhs_u128 / rhs_u128; 
        let felt_result: felt252 = result.into();
        let signed_int_result: i128 = felt_result.try_into().unwrap();
        if lhs * rhs < 0 {
            signed_int_result * -1
        } else {
            signed_int_result
        }
    }
}

impl i128DivEq of DivEq<i128> {
    #[inline(always)]
    fn div_eq(ref self: i128, other: i128) {
        self = Div::div(self, other);
    }
}
