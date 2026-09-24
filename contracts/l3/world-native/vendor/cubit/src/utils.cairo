use core::integer;

const HALF_PRIME: felt252 = 1809251394333065606848661391547535052811553607665798349986546028067936010240;

// Returns the sign of a signed `felt252` as with signed magnitude representation
// true = negative
// false = positive
fn felt_sign(a: felt252) -> bool {
    return integer::u256_from_felt252(a) > integer::u256_from_felt252(HALF_PRIME);
}

// Returns the absolute value of a signed `felt252`
fn felt_abs(a: felt252) -> felt252 {
    let a_sign = felt_sign(a);

    if (a_sign == true) {
        return a * -1;
    } else {
        return a * 1;
    }
}
