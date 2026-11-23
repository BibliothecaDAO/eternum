use snforge_std::fs::{FileTrait, read_txt};
pub use world_test_support::tests::days::*;


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
            assert_eq!(crate::days::day_at_index(game, UNIT, index), day);
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
    let last = day_of(game, UNIT, game.end_at - 1);
    assert_eq!(last.index, 104);
    assert_eq!(last.end, START + ten_weeks);
}

#[test]
#[should_panic(expected: "timestamp outside season")]
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


#[test]
fn cut_and_merged_days_match_the_shared_client_vectors() {
    let values = read_txt(@FileTrait::new("../fixtures/season-tail-v1.txt"));
    let mut values = values.span();
    while !values.is_empty() {
        let duration: u64 = (*values.pop_front().unwrap()).try_into().unwrap();
        let timestamp: u64 = (*values.pop_front().unwrap()).try_into().unwrap();
        let index: u64 = (*values.pop_front().unwrap()).try_into().unwrap();
        let start: u64 = (*values.pop_front().unwrap()).try_into().unwrap();
        let end: u64 = (*values.pop_front().unwrap()).try_into().unwrap();
        let game = GameRegistry { end_at: START + duration, scheduled_end_at: START + duration, ..season(0x5eed) };
        assert_eq!(day_of(game, 7200, START + timestamp), Day { index, start: START + start, end: START + end });
        assert_eq!(crate::days::day_at_index(game, 7200, index), Day { index, start: START + start, end: START + end });
    }
}

#[test]
#[should_panic(expected: "timestamp outside season")]
fn no_day_after_the_season() {
    let game = season('ended');
    day_of(game, UNIT, game.end_at);
}

#[test]
fn an_early_finish_clips_the_day_without_changing_its_identity() {
    let planned = season(0x5eed);
    let second = crate::days::day_at_index(planned, UNIT, 1);
    let finish = second.start + 1;
    let ended = GameRegistry { end_at: finish, ..planned };
    assert_eq!(day_of(ended, UNIT, second.start), Day { index: 1, start: second.start, end: finish });
    assert_eq!(crate::days::day_at_index(ended, UNIT, 1), Day { index: 1, start: second.start, end: finish });
    assert_eq!(day_of(ended, UNIT, second.start - 1), day_of(planned, UNIT, second.start - 1));
}
