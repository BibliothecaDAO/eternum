use crate::random::range;

#[test]
fn supplied_roots_preserve_game_derivation_vectors() {
    let vectors: Array<(u256, u128, u128, u128)> = array![
        (u256 { low: 0x0, high: 0x0 }, 0, 1, 0), (u256 { low: 0x0, high: 0x0 }, 1036, 10000, 2514),
        (
            u256 { low: 0x0, high: 0x0 },
            340282366920938463463374607431768211455,
            340282366920938463463374607431768211455,
            291967551474612294675256102760105434222,
        ),
        (u256 { low: 0xffffffffffffffffffffffffffffffff, high: 0xffffffffffffffffffffffffffffffff }, 0, 1, 0),
        (u256 { low: 0xffffffffffffffffffffffffffffffff, high: 0xffffffffffffffffffffffffffffffff }, 1036, 10000, 2278),
        (
            u256 { low: 0xffffffffffffffffffffffffffffffff, high: 0xffffffffffffffffffffffffffffffff },
            340282366920938463463374607431768211455,
            340282366920938463463374607431768211455,
            292419244273840365847320577690941995319,
        ),
        (u256 { low: 0x101112131415161718191a1b1c1d1e1f, high: 0x102030405060708090a0b0c0d0e0f }, 0, 1, 0),
        (u256 { low: 0x101112131415161718191a1b1c1d1e1f, high: 0x102030405060708090a0b0c0d0e0f }, 1036, 10000, 9040),
        (
            u256 { low: 0x101112131415161718191a1b1c1d1e1f, high: 0x102030405060708090a0b0c0d0e0f },
            340282366920938463463374607431768211455,
            340282366920938463463374607431768211455,
            148030404599288157170063665361919755644,
        ),
        (u256 { low: 0x0, high: 0x80000000000000000000000000000000 }, 0, 1, 0),
        (u256 { low: 0x0, high: 0x80000000000000000000000000000000 }, 1036, 10000, 5055),
        (
            u256 { low: 0x0, high: 0x80000000000000000000000000000000 },
            340282366920938463463374607431768211455,
            340282366920938463463374607431768211455,
            250401486661282588312826606593352042354,
        ),
        (u256 { low: 0x1, high: 0x0 }, 0, 1, 0), (u256 { low: 0x1, high: 0x0 }, 1036, 10000, 7003),
        (
            u256 { low: 0x1, high: 0x0 },
            340282366920938463463374607431768211455,
            340282366920938463463374607431768211455,
            180410813853039529435465800705960235860,
        ),
    ];
    for (root, salt, bound, expected) in vectors {
        assert_eq!(range(root, salt, bound), expected);
    }
}
