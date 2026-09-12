use cubit::f128::types::fixed::{Fixed, FixedTrait, HALF_u128};

#[inline(always)]
pub fn _0() -> Fixed {
    FixedTrait::ZERO()
}


#[inline(always)]
pub fn _0_083333() -> Fixed {
    FixedTrait::new(1537228672809129301, false)
}


#[inline(always)]
pub fn _0_1() -> Fixed {
    FixedTrait::new(1844674407370955161, false)
}


#[inline(always)]
pub fn _0_17() -> Fixed {
    FixedTrait::new(3135946492530623774, false)
}

#[inline(always)]
pub fn _0_2() -> Fixed {
    FixedTrait::new(3689348814741910323, false)
}

#[inline(always)]
pub fn _0_26() -> Fixed {
    FixedTrait::new(4796153459164483420, false)
}


#[inline(always)]
pub fn _0_3() -> Fixed {
    FixedTrait::new(5534023222112865484, false)
}


#[inline(always)]
pub fn _0_31() -> Fixed {
    FixedTrait::new(5718490662849961000, false)
}


#[inline(always)]
pub fn _0_35() -> Fixed {
    FixedTrait::new(6456360425798343065, false)
}


#[inline(always)]
pub fn _0_4() -> Fixed {
    FixedTrait::new(7378697629483820646, false)
}


#[inline(always)]
pub fn _0_42() -> Fixed {
    FixedTrait::new(7747632510958011678, false)
}


#[inline(always)]
pub fn _0_45() -> Fixed {
    FixedTrait::new(8301034833169298227, false)
}


#[inline(always)]
pub fn _0_5() -> Fixed {
    FixedTrait::new(HALF_u128, false)
}

#[inline(always)]
pub fn _0_56() -> Fixed {
    FixedTrait::new(10330176681277348904, false)
}

#[inline(always)]
pub fn _0_6() -> Fixed {
    FixedTrait::new(11068046444225730969, false)
}

#[inline(always)]
pub fn _0_62() -> Fixed {
    FixedTrait::new(11436981325699922001, false)
}

#[inline(always)]
pub fn _0_7() -> Fixed {
    FixedTrait::new(12912720851596686131, false)
}

#[inline(always)]
pub fn _0_8() -> Fixed {
    FixedTrait::new(14757395258967641292, false)
}

#[inline(always)]
pub fn _1() -> Fixed {
    FixedTrait::ONE()
}


#[inline(always)]
pub fn _2() -> Fixed {
    FixedTrait::new_unscaled(2, false)
}

#[inline(always)]
pub fn _100() -> Fixed {
    FixedTrait::new_unscaled(100, false)
}
