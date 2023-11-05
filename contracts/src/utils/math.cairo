// Raise a number to a power.
/// * `base` - The number to raise.
/// * `exp` - The exponent.
/// # Returns
/// * `felt252` - The result of base raised to the power of exp.
fn pow(base: felt252, exp: felt252) -> felt252 {
    match exp {
        0 => 1,
        _ => base * pow(base, exp - 1),
    }
}


fn min<T, impl TPartialOrd: PartialOrd<T>, impl TCopy: Copy<T>, impl TDrop: Drop<T>>
        (a: T, b: T ) -> T {
    return if (a < b){return a;} else {return b;};
}

fn max<T, impl TPartialOrd: PartialOrd<T>,impl TCopy: Copy<T>, impl TDrop: Drop<T>>
        (a: T, b: T ) -> T {
    return if (a > b){return a;} else {return b;};
}
