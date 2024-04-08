mod fixed_constants {
    use cubit::f128::types::fixed::{FixedTrait, Fixed, ONE_u128, HALF_u128};

    #[inline(always)]
    fn _0() -> Fixed {
        FixedTrait::ZERO()
    }

    #[inline(always)]
    fn _0_1() -> Fixed {
        FixedTrait::new(1844674407370955161, false)
    }

    #[inline(always)]
    fn _0_16() -> Fixed {
        FixedTrait::new(2951479051793528258, false)
    }

    #[inline(always)]
    fn _0_2() -> Fixed {
        FixedTrait::new(3689348814741910323, false)
    }

    #[inline(always)]
    fn _0_25() -> Fixed {
        FixedTrait::new(4611686018427387904, false)
    }


    #[inline(always)]
    fn _0_3() -> Fixed {
        FixedTrait::new(5534023222112865484, false)
    }


    #[inline(always)]
    fn _0_33() -> Fixed {
        FixedTrait::new(6087425544324152033, false)
    }


    #[inline(always)]
    fn _0_4() -> Fixed {
        FixedTrait::new(7378697629483820646, false)
    }


    #[inline(always)]
    fn _0_5() -> Fixed {
        FixedTrait::new(HALF_u128, false)
    }

    #[inline(always)]
    fn _0_53() -> Fixed {
        FixedTrait::new(9776774359066062356, false)
    }

    #[inline(always)]
    fn _0_6() -> Fixed {
        FixedTrait::new(11068046444225730969, false)
    }

    #[inline(always)]
    fn _0_66() -> Fixed {
        FixedTrait::new(12174851088648304066, false)
    }

    #[inline(always)]
    fn _0_7() -> Fixed {
        FixedTrait::new(12912720851596686131, false)
    }

    #[inline(always)]
    fn _0_72() -> Fixed {
        FixedTrait::new(13281655733070877163, false)
    }


    #[inline(always)]
    fn _0_8() -> Fixed {
        FixedTrait::new(14757395258967641292, false)
    }

    #[inline(always)]
    fn _0_83() -> Fixed {
        FixedTrait::new(15310797581178927841, false)
    }


    #[inline(always)]
    fn _0_9() -> Fixed {
        FixedTrait::new(16602069666338596454, false)
    }


    #[inline(always)]
    fn _1() -> Fixed {
        FixedTrait::ONE()
    }

    #[inline(always)]
    fn _2() -> Fixed {
        FixedTrait::new_unscaled(2, false)
    }

    #[inline(always)]
    fn _100() -> Fixed {
        FixedTrait::new_unscaled(100, false)
    }
}
