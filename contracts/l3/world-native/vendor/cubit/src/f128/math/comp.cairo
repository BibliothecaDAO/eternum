use eternum_cubit::f128::types::fixed::{Fixed, FixedPartialOrd, FixedTrait};

fn max(a: Fixed, b: Fixed) -> Fixed {
    if (a >= b) {
        return a;
    } else {
        return b;
    }
}

fn min(a: Fixed, b: Fixed) -> Fixed {
    if (a <= b) {
        return a;
    } else {
        return b;
    }
}
// Tests
// --------------------------------------------------------------------------------------------------------------


