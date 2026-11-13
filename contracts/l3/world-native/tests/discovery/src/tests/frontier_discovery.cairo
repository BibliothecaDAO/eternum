use starknet::storage::StorageMapReadAccess;
pub use world_test_support::tests::frontier_discovery::*;


#[test]
fn frontier_draws_the_ruled_odds_over_100k_reveals() {
    let preset = super::preset_projection::frontier_discovery_rules();
    assert_eq!(
        (preset.beasts_bps, preset.camp_bps, preset.rift_bps, preset.ruin_bps, preset.shrine_bps, preset.well_bps),
        (600, 400, 400, 300, 300, 300),
    );
    let mut counts: Felt252Dict<u32> = Default::default();
    for sample in 0_u64..100000 {
        let seed = 0x46524f4e54494552 + Into::<u64, u256>::into(sample);
        let key = bucket(frontier(preset, 0, 0, 0, 100, 0, Some(RELIC), seed));
        let count = counts.get(key);
        counts.insert(key, count + 1);
    }
    // 100,000 reveals hold each rate within 0.2 percentage points.
    for (index, expected) in array![(0_u8, 6000_u32), (1, 4000), (2, 4000), (3, 3000), (4, 3000), (5, 3000)] {
        let value = counts.get(index.into());
        println!("kind {} of 100000: {}", index, value);
        assert!(within(value, expected, 200), "discovery odds drift");
    }
}

#[test]
fn scouting_raises_its_chosen_kind_without_changing_beasts() {
    let rules = rules();
    for sample in 0_u64..20000 {
        let base = frontier(rules, 0, 0, 0, 100, 0, Some(RELIC), 0x53434f5554 + Into::<u64, u256>::into(sample));
        let boosted = frontier(rules, 0, 10000, 0, 100, 0, Some(RELIC), 0x53434f5554 + Into::<u64, u256>::into(sample));
        // The table is ordered beasts first, so Scouting never moves a beast draw.
        assert_eq!(base == Discovery::Beasts, boosted == Discovery::Beasts);
    }
}

#[test]
fn a_day_without_a_chest_never_draws_a_ruin_and_its_share_stays_empty() {
    let rules = rules();
    let mut empties_free = 0_u32;
    let mut empties_taken = 0_u32;
    for sample in 0_u64..20000 {
        let free = frontier(rules, 0, 0, 0, 100, 0, Some(RELIC), 0x5255494e + Into::<u64, u256>::into(sample));
        let taken = frontier(rules, 0, 0, 0, 100, 0, None, 0x5255494e + Into::<u64, u256>::into(sample));
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
    let unlocked = super::preset_projection::frontier_discovery_rules();
    let locked = rules();
    let mut empty = 0_u8;
    for sample in 0_u64..20000 {
        let session = frontier(locked, 0, 0, 0, 100, empty, None, 0x464c4f4f52 + Into::<u64, u256>::into(sample));
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
        let floored = frontier(unlocked, 0, 0, 0, 100, 7, Some(RELIC), 0x464c4f4f52 + Into::<u64, u256>::into(sample));
        assert!(floored != Discovery::None);
    }
}

#[test]
fn frontier_floor_is_home_day_scoped_and_relic_finds_reset_it() {
    let d = super::setup(true);
    snforge_std::interact_with_state(
        d.games,
        || {
            let key = ExpeditionDiscoveryKey { game_id, structure_id: 17, epoch: 300 };
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
            assert!(!crate::logic::expeditions::discovery(key).unwrap().ruin_cleared);
            assert!(crate::logic::expeditions::discovery(ExpeditionDiscoveryKey { epoch: 301, ..key }).is_none());
            assert!(crate::logic::expeditions::discovery(ExpeditionDiscoveryKey { structure_id: 18, ..key }).is_none());
        },
    );
}

#[test]
fn shrine_and_well_appear_only_once_researched() {
    let unlocked = super::preset_projection::frontier_discovery_rules();
    let locked = rules();
    for sample in 0_u64..20000 {
        let without = frontier(locked, 0, 0, 0, 100, 0, Some(RELIC), 0x5349544553 + Into::<u64, u256>::into(sample));
        assert!(without != Discovery::Shrine && without != Discovery::Well);
        let draw = frontier(unlocked, 0, 0, 0, 100, 0, Some(RELIC), 0x5349544553 + Into::<u64, u256>::into(sample));
        if draw != Discovery::Shrine && draw != Discovery::Well {
            assert_eq!(draw, without);
        }
    }
}

#[test]
fn sanctuaries_double_both_unlocked_sites_and_leave_beasts_unchanged() {
    let rules = super::preset_projection::frontier_discovery_rules();
    let mut shrines = 0_u32;
    let mut wells = 0_u32;
    for sample in 0_u64..100000 {
        let seed = 0x5354524147474c455253 + Into::<u64, u256>::into(sample);
        let base = frontier(rules, 0, 0, 0, 100, 0, Some(RELIC), seed);
        let boosted = frontier(rules, 0, 0, 10000, 100, 0, Some(RELIC), seed);
        assert_eq!(base == Discovery::Beasts, boosted == Discovery::Beasts);
        if boosted == Discovery::Shrine {
            shrines += 1;
        }
        if boosted == Discovery::Well {
            wells += 1;
        }
    }
    assert!(within(shrines, 6000, 200));
    assert!(within(wells, 6000, 200));
}

#[test]
fn sanctuaries_cannot_find_a_site_that_is_still_locked_even_at_the_floor() {
    let preset = super::preset_projection::frontier_discovery_rules();
    for sample in 0_u64..1000 {
        let seed = sample.into();
        for empty in array![0_u8, 7] {
            let shrine_only = FrontierDiscoveryRules { well_bps: 0, ..preset };
            let well_only = FrontierDiscoveryRules { shrine_bps: 0, ..preset };
            assert!(frontier(shrine_only, 0, 0, 10000, 100, empty, None, seed) != Discovery::Well);
            assert!(frontier(well_only, 0, 0, 10000, 100, empty, None, seed) != Discovery::Shrine);
            assert_eq!(
                frontier(rules(), 0, 0, 10000, 100, empty, None, seed),
                frontier(rules(), 0, 0, 0, 100, empty, None, seed),
            );
        }
    }
}

#[test]
#[should_panic(expected: "discovery odds exceed 100 percent")]
fn discovery_reserves_the_combined_sanctuary_increase() {
    crate::discovery::validate_frontier(
        FrontierDiscoveryRules {
            beasts_bps: 1000,
            camp_bps: 1000,
            rift_bps: 1000,
            shrine_bps: 2000,
            well_bps: 2000,
            ruin_bps: 0,
            empty_reveal_limit: 7,
        },
    );
}

#[test]
fn clear_mist_and_all_five_paths_steps_fit_exactly_7500_of_10000() {
    let rules = super::preset_projection::frontier_discovery_rules();
    assert_eq!(crate::discovery::maximum_race_chance(rules, 200), 7500);
    assert_eq!(crate::discovery::maximum_race_chance(rules, 100), 3750);
    for sample in 0_u64..1000 {
        let seed = 0x545249554d5048 + Into::<u64, u256>::into(sample);
        let draw = frontier(rules, 12500, 12500, 7500, 200, 0, Some(RELIC), seed);
        let rolled = crate::random::range(seed, 29, 10000);
        let expected = if rolled < 1200 {
            Discovery::Beasts
        } else if rolled < 3000 {
            Discovery::Camp
        } else if rolled < 4800 {
            Discovery::Rift
        } else if rolled < 5400 {
            Discovery::Ruin(RELIC)
        } else if rolled < 6450 {
            Discovery::Shrine
        } else if rolled < 7500 {
            Discovery::Well
        } else {
            Discovery::None
        };
        assert_eq!(draw, expected);
    }
}
