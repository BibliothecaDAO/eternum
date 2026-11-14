pub use crate::day_schedule::{
    DAYS_PER_BAG, Day, FRONTIER_REPORT_GRACE_SECONDS, UNITS_PER_BAG, bag_lengths, order_lengths,
};
use crate::game::GameRegistry;

/// The day `timestamp` falls in, using only the game's calendar fields.
#[inline(always)]
pub fn day_of(game: GameRegistry, unit_seconds: u32, timestamp: u64) -> Day {
    clipped_day(game.seed, game.start_main_at, game.end_at, game.scheduled_end_at, unit_seconds, timestamp)
}

/// Resolve a stored allocation day through the same calendar, including the clipped final day.
pub fn day_at_index(game: GameRegistry, unit_seconds: u32, index: u64) -> Day {
    let bag = index / DAYS_PER_BAG;
    let mut lengths = bag_lengths(game.seed, bag);
    let mut units = bag * UNITS_PER_BAG;
    for _ in 0..index % DAYS_PER_BAG {
        units += lengths % DIGIT;
        lengths /= DIGIT;
    }
    let day = day_of(game, unit_seconds, game.start_main_at + units * Into::<u32, u64>::into(unit_seconds));
    assert!(day.index == index, "day index outside season");
    day
}

#[inline(never)]
fn clipped_day(seed: felt252, start: u64, end: u64, scheduled_end: u64, unit: u32, timestamp: u64) -> Day {
    assert!(end <= scheduled_end, "season end exceeds its calendar");
    assert!(timestamp < end, "timestamp outside season");
    let day = crate::day_schedule::scheduled_day(seed, start, scheduled_end, unit, timestamp);
    Day { end: core::cmp::min(day.end, end), ..day }
}
