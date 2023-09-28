mod unpack;
mod math;
#[cfg(test)]
mod testing;

use core::poseidon::poseidon_hash_span;
use core::traits::{TryInto, Into};
use core::array::{ArrayTrait, SpanTrait};

/// Generate a random value within a specified upper_bound.
///
/// Args:
///     seed: u256
///         The seed to use for the random number generator.
///     upper_bound: u128
///         The upper_bound of possible values 
///         i.e output will be from 0 to upper_bound - 1.
///
/// Returns:
///     u128
///         A random value within the specified upper_bound.
///
fn random(seed: u256, upper_bound: u128) -> u128 {
    seed.low % upper_bound 
}



/// Simulate a coin toss with a certain probability of heads.
///
/// Args:
///     head_count_to_win: u8
///         The number of heads required to win.
///     total_flips: u8
///         The total number of coin flips.
///
/// Returns:
///     bool
///         True if the required number of heads occurred, false otherwise.
///
fn coin_toss(required_heads: u8, mut total_flip: u8) -> bool {
    assert(total_flip != 0, 'total flip is zero');
    assert(required_heads <= total_flip, 'invalid chance parameters');

    if (required_heads == 0 || required_heads == total_flip) {
        return true;
    }

    let mut head_count = 0;
    loop {
        if total_flip == 0 {
            break false;
        }

        let seed = make_seed_from_transaction_hash(total_flip.into());
        let zero_or_one = random(seed, 2);
        
        head_count += zero_or_one;
        if head_count == required_heads.into() {
            break true;
        }

        total_flip -= 1;
    }
    
}


fn make_seed_from_transaction_hash(salt: u128) -> u256 {
    return poseidon_hash_span(
        array![
            starknet::get_tx_info().unbox().transaction_hash.into(),
            salt.into() 
        ].span()
    ).into();
}
