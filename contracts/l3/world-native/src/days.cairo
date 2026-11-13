//! The season's days (Frontier rules §9). A normal day lasts 2 to 6 units of the preset's day unit. Days come in bags
//! of five holding each length once, so every bag lasts 20 units, and bags follow one another from the season's start.
//! Bag b's order is drawn from the game's seed, so every player shares one schedule, and any timestamp finds its day
//! again with no storage. The final day stops at season end; a tail under two units joins the preceding day.
use core::num::traits::Pow;
use core::poseidon::poseidon_hash_span;
use crate::game::GameRegistry;

// Leave time for confirmed withdrawals to reach the ledger before reports close.
pub const FRONTIER_REPORT_GRACE_SECONDS: u32 = 3600;

pub const DAYS_PER_BAG: u64 = 5;
pub const UNITS_PER_BAG: u64 = 20;
// Two orders for where 4 goes beside 3, three for 5, four for 6, then four places for the short day.
const BAG_ORDERS: u256 = 96;
// A bag packs its five lengths in base 8, the first day in the lowest digit.
const DIGIT: u64 = 8;

/// One day of the season: its index from the season's start, and its bounds, end excluded.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Day {
    pub index: u64,
    pub start: u64,
    pub end: u64,
}

/// The day `timestamp` falls in, using only the game's calendar fields.
#[inline(always)]
pub fn day_of(game: GameRegistry, unit_seconds: u32, timestamp: u64) -> Day {
    calendar_day(game.seed, game.start_main_at, game.end_at, unit_seconds, timestamp)
}

// Keep one calendar calculation per class without passing the game's unrelated launch fields to every call.
#[inline(never)]
pub fn calendar_day(seed: felt252, season_start: u64, season_end: u64, unit_seconds: u32, timestamp: u64) -> Day {
    assert!(timestamp >= season_start && timestamp < season_end, "timestamp outside season");
    let unit: u64 = unit_seconds.into();
    let season_units = (season_end - season_start) / unit;
    // The last two units belong to the day already running at their start, absorbing a shorter final stub.
    let final_day_probe = season_units - core::cmp::min(season_units, 2);
    let at = core::cmp::min((timestamp - season_start) / unit, final_day_probe);
    let bag = at / UNITS_PER_BAG;
    let mut lengths = bag_lengths(seed, bag);
    let mut index = bag * DAYS_PER_BAG;
    let mut start = bag * UNITS_PER_BAG;
    let mut end = start + lengths % DIGIT;
    while at >= end {
        lengths /= DIGIT;
        index += 1;
        start = end;
        end = start + lengths % DIGIT;
    }
    Day {
        index,
        start: season_start + start * unit,
        end: if end > final_day_probe {
            season_end
        } else {
            season_start + end * unit
        },
    }
}


/// A bag's five day lengths, in units, packed in base 8 from its first day: one of the 96 bag orders, drawn from the
/// game's seed.
pub fn bag_lengths(seed: felt252, bag: u64) -> u64 {
    let draw: u256 = poseidon_hash_span(array![seed, 'day bag', bag.into()].span()).into();
    order_lengths((draw % BAG_ORDERS).try_into().unwrap())
}

/// A bag order in [0, 96) builds the bag by inserting the lengths one at a time: 4 beside 3, then 5, then 6 anywhere,
/// which gives each of the 24 orders of the long days once, and last the 2-unit day after one of the long days. So no
/// bag opens with the short day, and two short days never touch, across bags included.
pub fn order_lengths(order: u64) -> u64 {
    let mut bag = 3;
    bag = insert(bag, 4, order % 2);
    bag = insert(bag, 5, order / 2 % 3);
    bag = insert(bag, 6, order / 6 % 4);
    insert(bag, 2, 1 + order / 24)
}

fn insert(lengths: u64, length: u64, position: u64) -> u64 {
    let place = DIGIT.pow(position.try_into().unwrap());
    lengths % place + length * place + lengths / place * place * DIGIT
}
