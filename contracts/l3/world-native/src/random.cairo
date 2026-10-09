use core::poseidon::poseidon_hash_span;

// Action lotteries use fixed, distinct domains; the gameplay clock is not an entropy input.
pub const DISCOVERY_SALT: u64 = 0x444953434f564552;
pub const SITE_SALT: u64 = 0x5349544554595045;
pub const CHEST_TIER_SALT: u64 = 0x4348455354544945;
pub const REWARD_SALT: u64 = 0x4558504c4f524552;
pub const REVEAL_REWARD_SALT: u64 = 0x52455645414c5257;
pub const RELIC_POSITION_SALT: u64 = 0x52454c4943504f53;

pub fn game_root(ref raw_root: u256, game_id: u32, game_seed: felt252) -> u256 {
    raw_root += 1432;
    poseidon_hash_span(array![raw_root.low.into(), raw_root.high.into(), game_id.into(), game_seed].span()).into()
}

pub fn range(seed: u256, salt: u128, upper_bound: u128) -> u128 {
    let value: u256 = poseidon_hash_span(array![seed.low.into(), seed.high.into(), salt.into()].span()).into();
    (value % upper_bound.into()).try_into().unwrap()
}

pub fn lottery(seed: u256, offset: u256, success: u128, failure: u128, timestamp: u64) -> bool {
    let seed = if seed > offset {
        seed - offset
    } else {
        seed + offset
    };
    range(seed, timestamp.into() + 18, success + failure) < success
}
