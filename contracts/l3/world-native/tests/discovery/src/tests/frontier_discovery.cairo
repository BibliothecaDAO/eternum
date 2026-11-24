pub use world_test_support::tests::frontier_discovery::*;


#[test]
fn frontier_draws_the_ruled_odds_over_100k_reveals() {
    let preset = crate::balance::expeditions::FRONTIER_DISCOVERY;
    let mut counts: Felt252Dict<u32> = Default::default();
    for sample in 0_u64..100000 {
        let seed = 0x46524f4e54494552 + Into::<u64, u256>::into(sample);
        let key = bucket(frontier(preset, 100, 0, Some(RELIC), seed));
        let count = counts.get(key);
        counts.insert(key, count + 1);
    }
    // 100,000 reveals hold each rate within 0.2 percentage points.
    for (index, bps) in array![
        (0_u8, preset.beasts_bps), (1, preset.camp_bps), (2, preset.rift_bps), (3, preset.ruin_bps),
        (4, preset.shrine_bps), (5, preset.well_bps),
    ] {
        let expected: u32 = Into::<u16, u32>::into(bps) * 10;
        let value = counts.get(index.into());
        println!("kind {} of 100000: {}", index, value);
        assert!(within(value, expected, 200), "discovery odds drift");
    }
}


#[test]
fn a_day_without_a_chest_never_draws_a_ruin_and_its_share_stays_empty() {
    let rules = rules();
    let mut empties_free = 0_u32;
    let mut empties_taken = 0_u32;
    for sample in 0_u64..20000 {
        let free = frontier(rules, 100, 0, Some(RELIC), 0x5255494e + Into::<u64, u256>::into(sample));
        let taken = frontier(rules, 100, 0, None, 0x5255494e + Into::<u64, u256>::into(sample));
        assert!(bucket(taken) != 3);
        if free == Discovery::Ruin(RELIC) {
            assert_eq!(taken, Discovery::None);
        } else {
            assert_eq!(taken, free);
        }
        if free == Discovery::None {
            empties_free += 1;
        }
        if taken == Discovery::None {
            empties_taken += 1;
        }
    }
    assert!(empties_taken > empties_free);
}

#[test]
fn the_floor_draws_only_kinds_still_allowed() {
    let unlocked = crate::balance::expeditions::FRONTIER_DISCOVERY;
    let locked = rules();
    let mut empty = 0_u8;
    for sample in 0_u64..20000 {
        let session = frontier(locked, 100, empty, None, 0x464c4f4f52 + Into::<u64, u256>::into(sample));
        if empty == 7 {
            assert!(
                session == Discovery::Camp || session == Discovery::Rift || session == Discovery::Beasts,
                "floor drew a kind that is not allowed",
            );
        }
        empty = if session == Discovery::None {
            empty + 1
        } else {
            0
        };
        let floored = frontier(unlocked, 100, 7, Some(RELIC), 0x464c4f4f52 + Into::<u64, u256>::into(sample));
        assert!(floored != Discovery::None);
    }
}

#[test]
fn frontier_floor_is_home_day_scoped_and_relic_finds_reset_it() {
    let key = ExpeditionDiscoveryKey { game_id: 1, structure_id: 17, epoch: 300 };
    assert!(crate::logic::expeditions::discovery(key).is_none());
    // The empty-reveal floor is shared across armies and depths.
    for _ in 0_u8..7 {
        crate::logic::expeditions::record_discovery(key, Discovery::None);
    }
    assert_eq!(crate::logic::expeditions::discovery(key).unwrap().empty_reveals, 7);
    crate::logic::expeditions::record_discovery(key, Discovery::Ruin(RELIC));
    let row = crate::logic::expeditions::discovery(key).unwrap();
    assert_eq!((row.empty_reveals, row.ruin_cleared), (0, false));
    crate::logic::expeditions::record_discovery(key, Discovery::None);
    crate::logic::expeditions::record_discovery(key, Discovery::Camp);
    let row = crate::logic::expeditions::discovery(key).unwrap();
    assert_eq!((row.empty_reveals, row.ruin_cleared), (0, false));
    assert!(crate::logic::expeditions::discovery(ExpeditionDiscoveryKey { epoch: 301, ..key }).is_none());
    assert!(crate::logic::expeditions::discovery(ExpeditionDiscoveryKey { structure_id: 18, ..key }).is_none());
}

#[test]
fn shrine_and_well_appear_only_once_researched() {
    let unlocked = crate::balance::expeditions::FRONTIER_DISCOVERY;
    let locked = rules();
    for sample in 0_u64..20000 {
        let without = frontier(locked, 100, 0, Some(RELIC), 0x5349544553 + Into::<u64, u256>::into(sample));
        assert!(without != Discovery::Shrine && without != Discovery::Well);
        let draw = frontier(unlocked, 100, 0, Some(RELIC), 0x5349544553 + Into::<u64, u256>::into(sample));
        if draw != Discovery::Shrine && draw != Discovery::Well {
            assert_eq!(draw, without);
        }
    }
}


#[test]
fn locked_discoveries_stay_unavailable_even_at_the_floor() {
    let preset = crate::balance::expeditions::FRONTIER_DISCOVERY;
    for sample in 0_u64..1000 {
        let seed = sample.into();
        for empty in array![0_u8, 7] {
            let shrine_only = FrontierDiscoveryRules { well_bps: 0, ..preset };
            let well_only = FrontierDiscoveryRules { shrine_bps: 0, ..preset };
            assert!(frontier(shrine_only, 100, empty, None, seed) != Discovery::Well);
            assert!(frontier(well_only, 100, empty, None, seed) != Discovery::Shrine);
            let draw = frontier(rules(), 100, empty, None, seed);
            assert!(draw != Discovery::Shrine && draw != Discovery::Well);
        }
    }
}

#[test]
fn clear_mist_doubles_every_find_weight_and_preserves_the_empty_floor() {
    let rules = FrontierDiscoveryRules {
        beasts_bps: 1000,
        camp_bps: 1000,
        rift_bps: 1000,
        ruin_bps: 1000,
        shrine_bps: 500,
        well_bps: 500,
        empty_reveal_limit: 7,
    };
    let outcomes = array![
        Discovery::Beasts, Discovery::Camp, Discovery::Rift, Discovery::Ruin(RELIC), Discovery::Shrine, Discovery::Well,
    ];
    // Cover the boundaries of every interval in the categorical draw.
    for target in array![0_u128, 999, 1000, 1999, 2000, 3999, 4000, 5999, 6000, 7999, 8000, 8999, 9000, 9999] {
        let mut sample = 0_u64;
        loop {
            assert!(sample < 200000, "missing draw boundary");
            let seed = sample.into();
            if crate::random::range(seed, 29, 10000) == target {
                let boosted = frontier(rules, 200, 0, Some(RELIC), seed);
                let index = if target < 8000 {
                    target / 2000
                } else {
                    4 + (target - 8000) / 1000
                };
                assert_eq!(boosted, *outcomes.at(index.try_into().unwrap()));
                assert!(frontier(rules, 200, 7, None, seed) != Discovery::None);
                if target >= 5000 {
                    assert_eq!(frontier(rules, 100, 0, Some(RELIC), seed), Discovery::None);
                }
                break;
            }
            sample += 1;
        }
    }
}
