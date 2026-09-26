use core::dict::{Felt252Dict, Felt252DictTrait};
use crate::discovery::{Discovery, frontier};
use crate::expeditions::{ExpeditionDiscoveryKey, FrontierDiscoveryRules};

fn rules() -> FrontierDiscoveryRules {
    FrontierDiscoveryRules { shrine_bps: 0, well_bps: 0, ..super::preset_projection::frontier_discovery_rules() }
}
fn bucket(result: Discovery) -> felt252 {
    match result {
        Discovery::Camp => 0,
        Discovery::Mine => 1,
        Discovery::FallenRealm => 2,
        Discovery::Chest => 3,
        _ => 4,
    }
}

#[test]
fn frontier_categorical_odds_and_scouting_keep_loose_chests_fixed_over_100k_reveals() {
    let rules = rules();
    let mut ordinary: Felt252Dict<u32> = Default::default();
    let mut scouting: Felt252Dict<u32> = Default::default();
    let mut floored: Felt252Dict<u32> = Default::default();
    let mut empty = 0_u8;
    for timestamp in 0_u64..100000 {
        let base = frontier(rules, 1, 0, 0x46524f4e54494552, timestamp);
        let boosted = frontier(rules, 5, 0, 0x46524f4e54494552, timestamp);
        let session = frontier(rules, 1, empty, 0x46524f4e54494552, timestamp);
        let key = bucket(base);
        let count = ordinary.get(key);
        ordinary.insert(key, count + 1);
        let key = bucket(boosted);
        let count = scouting.get(key);
        scouting.insert(key, count + 1);
        let key = bucket(session);
        let count = floored.get(key);
        floored.insert(key, count + 1);
        assert_eq!(base == Discovery::Chest, boosted == Discovery::Chest);
        if empty == 7 {
            assert!(session == Discovery::Camp || session == Discovery::Mine || session == Discovery::FallenRealm);
        }
        empty = if session == Discovery::None {
            empty + 1
        } else {
            0
        };
    }
    for (index, expected) in array![(0_u8, 4000_u32), (1, 4000), (2, 2000), (3, 2000)] {
        let value = ordinary.get((index).into());
        assert!(value + 200 >= expected && value <= expected + 200, "ordinary odds drift");
        let target = if index < 2 {
            10000
        } else {
            expected
        };
        let value = scouting.get((index).into());
        assert!(value + 200 >= target && value <= target + 200, "Scouting odds drift");
    }
    for index in 0_u8..5 {
        println!(
            "bucket {} ordinary {} Scouting5 {} floor-modified {}",
            index,
            ordinary.get(index.into()),
            scouting.get(index.into()),
            floored.get(index.into()),
        );
    }
    assert!(
        floored.get((0).into())
            + floored.get((1).into())
            + floored.get((2).into()) > ordinary.get((0).into())
            + ordinary.get((1).into())
            + ordinary.get((2).into()),
    );
}

#[test]
fn frontier_floor_is_home_day_scoped_and_only_player_discoveries_change_it() {
    let key = ExpeditionDiscoveryKey { game_id: 1, structure_id: 17, epoch: 300 };
    assert!(crate::logic::expeditions::discovery(key).is_none());
    // Armies and depth are deliberately not keys: the same home/day owns the seven empties.
    for _ in 0_u8..7 {
        crate::logic::expeditions::record_discovery(key, Discovery::None);
    }
    assert_eq!(crate::logic::expeditions::discovery(key).unwrap().empty_reveals, 7);
    let next = frontier(rules(), 1, 7, 0, 0);
    assert!(next == Discovery::Camp || next == Discovery::Mine || next == Discovery::FallenRealm);
    crate::logic::expeditions::record_discovery(key, next);
    assert_eq!(crate::logic::expeditions::discovery(key).unwrap().empty_reveals, 0);
    crate::logic::expeditions::record_discovery(key, Discovery::None);
    crate::logic::expeditions::record_discovery(key, Discovery::Chest);
    assert_eq!(crate::logic::expeditions::discovery(key).unwrap().empty_reveals, 0);
    assert!(crate::logic::expeditions::discovery(ExpeditionDiscoveryKey { epoch: 301, ..key }).is_none());
    assert!(crate::logic::expeditions::discovery(ExpeditionDiscoveryKey { structure_id: 18, ..key }).is_none());
}

#[test]
fn fallen_and_loose_chests_use_the_same_depth_quality_table_over_10k_opens() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let rules = preset.economy.chests.unwrap();
    for depth in preset.settlement.depths {
        let ground = *depth.chest;
        let mut counts: Felt252Dict<u32> = Default::default();
        for timestamp in 0_u64..10000 {
            let roll = crate::relics::roll_chest(rules, ground, 0, 0, 0x4348455354, timestamp);
            let key = roll.quality.into();
            let count = counts.get(key);
            counts.insert(key, count + 1);
        }
        let expected = array![
            Into::<u16, u32>::into(ground.common), ground.uncommon.into(), ground.rare.into(),
            10000
                - Into::<u16, u32>::into(ground.common)
                - Into::<u16, u32>::into(ground.uncommon)
                - Into::<u16, u32>::into(ground.rare),
        ];
        println!("depth quality {} / {} / {} / {}", counts.get(0), counts.get(1), counts.get(2), counts.get(3));
        for index in 0_usize..4 {
            let actual = counts.get(index.into());
            let target = *expected.at(index);
            let difference = core::cmp::max(actual, target) - core::cmp::min(actual, target);
            let variance = target * (10000 - target) / 10000;
            assert!(difference * difference <= 16 * variance + 1, "depth quality outside four sigma");
        }
    }
}

#[test]
fn shrine_well_odds_are_three_percent_without_moving_the_chest_interval() {
    let unlocked = super::preset_projection::frontier_discovery_rules();
    let locked = rules();
    let mut shrines = 0_u32;
    let mut wells = 0_u32;
    let mut floor_shrines = 0_u32;
    let mut floor_wells = 0_u32;
    for timestamp in 0_u64..100000 {
        let draw = frontier(unlocked, 1, 0, 0x5349544553, timestamp);
        let without = frontier(locked, 1, 0, 0x5349544553, timestamp);
        assert!(without != Discovery::Shrine && without != Discovery::Well);
        assert_eq!(draw == Discovery::Chest, without == Discovery::Chest);
        if draw == Discovery::Shrine {
            shrines += 1;
        }
        if draw == Discovery::Well {
            wells += 1;
        }
        let floored = frontier(unlocked, 1, 7, 0x5349544553, timestamp);
        assert!(floored != Discovery::None && floored != Discovery::Chest);
        if floored == Discovery::Shrine {
            floor_shrines += 1;
        }
        if floored == Discovery::Well {
            floor_wells += 1;
        }
    }
    assert!(shrines >= 2800 && shrines <= 3200);
    assert!(wells >= 2800 && wells <= 3200);
    assert!(floor_shrines != 0 && floor_wells != 0);
    println!("Shrine {} Well {} floor Shrine {} Well {}", shrines, wells, floor_shrines, floor_wells);
}
