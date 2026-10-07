use core::num::traits::Pow;
use crate::days::{Day, bag_lengths, day_of, order_lengths, season_days};
use crate::game::GameRegistry;

const UNIT: u32 = 14400;
const START: u64 = 1_800_000_000;

fn season(seed: felt252) -> GameRegistry {
    GameRegistry {
        name: 'frontier',
        preset_id: 5,
        creator: 1.try_into().unwrap(),
        settled: false,
        ready: true,
        dev_mode_on: false,
        start_settling_at: START,
        start_main_at: START,
        end_at: START + 21 * 20 * UNIT.into(),
        end_grace_seconds: 0,
        seed,
    }
}

fn unpack(mut lengths: u64) -> Span<u64> {
    let mut days = array![];
    for _day in 0..5_u8 {
        days.append(lengths % 8);
        lengths /= 8;
    }
    assert_eq!(lengths, 0);
    days.span()
}

fn assert_whole_bag(days: Span<u64>) {
    let mut seen: u64 = 0;
    for length in days {
        assert!(*length >= 2 && *length <= 6, "day length outside the bag");
        seen = seen | 2_u64.pow((*length).try_into().unwrap());
    }
    // Each length once: the five bits 2..6 set, so the bag lasts 20 units.
    assert_eq!(seen, 0b1111100);
    assert!(*days[0] != 2, "a bag opens with the short day");
}

#[test]
fn every_bag_order_holds_each_length_once_and_never_opens_short() {
    let mut bags: Array<u64> = array![];
    for order in 0..96_u64 {
        let lengths = order_lengths(order);
        assert_whole_bag(unpack(lengths));
        for previous in bags.span() {
            assert!(*previous != lengths, "two bag orders name the same bag");
        }
        bags.append(lengths);
    }
}

#[test]
fn drawn_bags_hold_each_length_once_over_ten_thousand_seeds() {
    for seed in 1..10_001_u64 {
        assert_whole_bag(unpack(bag_lengths(seed.into() * 7919, seed % 21)));
    }
}

#[test]
fn the_short_day_never_touches_another_across_bags() {
    let mut previous_last = 0;
    for bag in 0..21_u64 {
        let days = unpack(bag_lengths('short days', bag));
        assert!(!(previous_last == 2 && *days[0] == 2), "two short days touch");
        previous_last = *days[4];
    }
}

#[test]
fn day_of_matches_a_reference_walk_of_the_season() {
    let game = season('reference walk');
    let unit: u64 = UNIT.into();
    let mut start = START;
    let mut index = 0;
    for bag in 0..21_u64 {
        for units in unpack(bag_lengths(game.seed, bag)) {
            let end = start + *units * unit;
            let day = Day { index, start, end };
            assert_eq!(day_of(game, UNIT, start), day);
            assert_eq!(day_of(game, UNIT, start + (end - start) / 2), day);
            assert_eq!(day_of(game, UNIT, end - 1), day);
            start = end;
            index += 1;
        }
    }
    assert_eq!(index, 105);
}

#[test]
fn twenty_one_bags_end_exactly_ten_weeks_after_the_start() {
    let game = season('ten weeks');
    let ten_weeks: u64 = 10 * 7 * 86400;
    assert_eq!(game.end_at - START, ten_weeks);
    assert_eq!(season_days(game.end_at - START, UNIT), 105);
    let last = day_of(game, UNIT, game.end_at - 1);
    assert_eq!(last.index, 104);
    assert_eq!(last.end, START + ten_weeks);
}

#[test]
#[should_panic(expected: "season is not whole day bags")]
fn a_season_of_partial_bags_is_refused() {
    season_days(21 * 20 * UNIT.into() + 120, UNIT);
}

#[test]
#[should_panic(expected: "season has not started")]
fn no_day_before_the_season() {
    day_of(season('early'), UNIT, START - 1);
}

// The client's dayOf draws the same bags from the same seed (packages/core/src/utils/days.test.ts).
#[test]
fn drawn_bags_match_the_client_vector() {
    let mut drawn = array![];
    for bag in 0..3_u64 {
        for length in unpack(bag_lengths(0x5eed, bag)) {
            drawn.append(*length);
        }
    }
    assert_eq!(drawn.span(), array![4_u64, 6, 3, 2, 5, 4, 3, 5, 2, 6, 3, 6, 4, 2, 5].span());
}
