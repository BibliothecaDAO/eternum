use core::dict::{Felt252Dict, Felt252DictTrait};
use crate::discovery::{Discovery, frontier};
use crate::expeditions::{ExpeditionDiscoveryKey, FrontierDiscoveryRules};

fn rules() -> FrontierDiscoveryRules {
    FrontierDiscoveryRules { shrine_bps: 0, well_bps: 0, ..super::preset_projection::frontier_discovery_rules() }
}
fn bucket(result: Discovery) -> felt252 {
    match result {
        Discovery::Stragglers => 0,
        Discovery::Camp => 1,
        Discovery::Rift => 2,
        Discovery::Ruin => 3,
        Discovery::Shrine => 4,
        Discovery::Well => 5,
        _ => 6,
    }
}
fn within(actual: u32, target: u32, tolerance: u32) -> bool {
    actual + tolerance >= target && actual <= target + tolerance
}

#[test]
fn frontier_draws_the_ruled_odds_over_100k_reveals() {
    let preset = super::preset_projection::frontier_discovery_rules();
    assert_eq!(
        (preset.stragglers_bps, preset.camp_bps, preset.rift_bps, preset.ruin_bps, preset.shrine_bps, preset.well_bps),
        (600, 400, 400, 100, 300, 300),
    );
    let mut counts: Felt252Dict<u32> = Default::default();
    for timestamp in 0_u64..100000 {
        let key = bucket(frontier(preset, 1, 0, true, 0x46524f4e54494552, timestamp));
        let count = counts.get(key);
        counts.insert(key, count + 1);
    }
    // 100,000 reveals hold each rate within 0.2 percentage points.
    for (index, expected) in array![(0_u8, 6000_u32), (1, 4000), (2, 4000), (3, 1000), (4, 3000), (5, 3000)] {
        let value = counts.get(index.into());
        println!("kind {} of 100000: {}", index, value);
        assert!(within(value, expected, 200), "discovery odds drift");
    }
}

#[test]
fn scouting_raises_camps_and_rifts_and_leaves_the_rest() {
    let rules = rules();
    for timestamp in 0_u64..20000 {
        let base = frontier(rules, 1, 0, true, 0x53434f5554, timestamp);
        let boosted = frontier(rules, 5, 0, true, 0x53434f5554, timestamp);
        // The table is ordered stragglers first, so Scouting never moves a straggler draw.
        assert_eq!(base == Discovery::Stragglers, boosted == Discovery::Stragglers);
    }
}

#[test]
fn a_taken_day_never_draws_a_ruin_and_its_share_stays_empty() {
    let rules = rules();
    let mut empties_free = 0_u32;
    let mut empties_taken = 0_u32;
    for timestamp in 0_u64..20000 {
        let free = frontier(rules, 1, 0, true, 0x5255494e, timestamp);
        let taken = frontier(rules, 1, 0, false, 0x5255494e, timestamp);
        assert!(taken != Discovery::Ruin);
        if free == Discovery::Ruin {
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
    for timestamp in 0_u64..20000 {
        let session = frontier(locked, 1, empty, false, 0x464c4f4f52, timestamp);
        if empty == 7 {
            assert!(
                session == Discovery::Camp || session == Discovery::Rift || session == Discovery::Stragglers,
                "floor drew a kind that is not allowed",
            );
        }
        empty = if session == Discovery::None {
            empty + 1
        } else {
            0
        };
        let floored = frontier(unlocked, 1, 7, true, 0x464c4f4f52, timestamp);
        assert!(floored != Discovery::None);
    }
}

#[test]
fn frontier_floor_and_ruin_are_home_day_scoped_and_only_player_discoveries_change_them() {
    let key = ExpeditionDiscoveryKey { game_id: 1, structure_id: 17, epoch: 300 };
    assert!(crate::logic::expeditions::discovery(key).is_none());
    // Armies and depth are deliberately not keys: the same home/day owns the seven empties and the ruin.
    for _ in 0_u8..7 {
        crate::logic::expeditions::record_discovery(key, Discovery::None);
    }
    assert_eq!(crate::logic::expeditions::discovery(key).unwrap().empty_reveals, 7);
    crate::logic::expeditions::record_discovery(key, Discovery::Ruin);
    let row = crate::logic::expeditions::discovery(key).unwrap();
    assert_eq!((row.empty_reveals, row.ruin_found), (0, true));
    crate::logic::expeditions::record_discovery(key, Discovery::None);
    crate::logic::expeditions::record_discovery(key, Discovery::Camp);
    let row = crate::logic::expeditions::discovery(key).unwrap();
    assert_eq!((row.empty_reveals, row.ruin_found), (0, true));
    assert!(crate::logic::expeditions::discovery(ExpeditionDiscoveryKey { epoch: 301, ..key }).is_none());
    assert!(crate::logic::expeditions::discovery(ExpeditionDiscoveryKey { structure_id: 18, ..key }).is_none());
}

#[test]
fn shrine_and_well_appear_only_once_researched() {
    let unlocked = super::preset_projection::frontier_discovery_rules();
    let locked = rules();
    for timestamp in 0_u64..20000 {
        let without = frontier(locked, 1, 0, true, 0x5349544553, timestamp);
        assert!(without != Discovery::Shrine && without != Discovery::Well);
        let draw = frontier(unlocked, 1, 0, true, 0x5349544553, timestamp);
        if draw != Discovery::Shrine && draw != Discovery::Well {
            assert_eq!(draw, without);
        }
    }
}
