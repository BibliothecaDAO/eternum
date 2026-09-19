use snforge_std::fs::{FileTrait, read_txt};
use crate::random::range;

#[test]
fn recorded_roots_preserve_current_game_derivation() {
    let input = read_txt(@FileTrait::new("../randomness-protocol/tests/fixtures/v3.txt"));
    let mut fields = input.span();
    let count: u32 = Serde::deserialize(ref fields).unwrap();
    for _ in 0..count {
        let _intent: Array<felt252> = Serde::deserialize(ref fields).unwrap();
        let _action: felt252 = Serde::deserialize(ref fields).unwrap();
        let envelope: Array<felt252> = Serde::deserialize(ref fields).unwrap();
        let _binding: felt252 = Serde::deserialize(ref fields).unwrap();
        let _root_bytes: Array<u8> = Serde::deserialize(ref fields).unwrap();
        let _canonical_bytes: Array<u8> = Serde::deserialize(ref fields).unwrap();
        let draws: Array<(u128, u128, u128)> = Serde::deserialize(ref fields).unwrap();
        let root = u256 { low: (*envelope.at(6)).try_into().unwrap(), high: (*envelope.at(7)).try_into().unwrap() };
        for (salt, bound, expected) in draws {
            assert!(range(root, salt, bound) == expected, "game derivation differs");
        }
    }
    assert!(fields.is_empty(), "trailing vector data");
}
