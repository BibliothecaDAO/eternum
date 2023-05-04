use traits::Into;
use traits::TryInto;
use option::OptionTrait;

fn convert_u64_to_u128(integer: u64) -> u128 {
    // convert to felt
    let felt: felt252 = integer.into();
    // convert to u128
    return felt.try_into().unwrap();
}

fn convert_u8_to_u128(integer: u8) -> u128 {
    // convert to felt
    let felt: felt252 = integer.into();
    // convert to u128
    return felt.try_into().unwrap();
}
