pub use core::dict::{Felt252Dict, Felt252DictTrait};
pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{EventSpyTrait, EventsFilterTrait};
pub use starknet::storage::StorageMapWriteAccess;
pub use crate::entry::{ILedgerOperatorSafeDispatcher, ILedgerOperatorSafeDispatcherTrait};
pub use crate::logic::lords_budget::{SeasonClock, available, first_day, fits, roll, unlocked};
pub use crate::relics::{ChestRules, IRelicsDispatcher, IRelicsDispatcherTrait, LordsBudget, roll_tier, tier_value};
pub const TEST_POOL: u128 = 1000000;
pub const DAY_UNIT: u32 = 14400;
pub const SEASON_DAYS: u64 = 105;
pub fn rules() -> ChestRules {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    preset.economy.chests.unwrap()
}
pub fn clock() -> SeasonClock {
    SeasonClock {
        game: crate::game::GameRegistry {
            name: 'frontier',
            preset_id: 5,
            settled: false,
            ready: true,
            dev_mode_on: false,
            start_settling_at: 0,
            start_main_at: 0,
            end_at: 21 * 20 * DAY_UNIT.into(),
            end_grace_seconds: 0,
            seed: 1,
        },
        day_unit_seconds: DAY_UNIT,
        tick: 60,
    }
}
pub fn empty_day(pool: u128, day: u64) -> LordsBudget {
    first_day(rules(), pool, day)
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SeasonState {
    pub budget: LordsBudget,
    pub paid: u128,
    pub refused: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SeasonChunk {
    pub ruins_per_day: u32,
    pub quiet_days: u64,
    pub clear: bool,
    pub first_day: u64,
    pub past_day: u64,
    pub before: SeasonState,
    pub after: SeasonState,
}

#[derive(Copy, Drop, Serde)]
pub struct ChunkInput {
    pub ruins_per_day: u32,
    pub quiet_days: u64,
    pub clear: bool,
    pub first_day: u64,
    pub past_day: u64,
    pub before: Option<SeasonState>,
}
pub const CHUNK_DAYS: u64 = 5;
pub const CHUNKS: u32 = 21;
pub fn initial_season() -> SeasonState {
    SeasonState { budget: empty_day(TEST_POOL, 0), paid: 0, refused: 0 }
}
pub fn assert_conservation(state: SeasonState, clock: SeasonClock, day: u64) {
    assert_eq!(state.paid + state.budget.pool_left, TEST_POOL);
    assert!(
        TEST_POOL - state.budget.pool_left + state.budget.open <= unlocked(TEST_POOL, clock, day), "unlock overshot",
    );
}
pub // Five-day test VMs replace one season's retained traces; state and running totals cross every boundary.
 fn simulate_range(input: ChunkInput, mut state: SeasonState) -> SeasonState {
    assert!(input.first_day < input.past_day && input.past_day <= SEASON_DAYS);
    let rules = rules();
    let clock = clock();
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let odds = *preset.settlement.depths.at(0).chest;
    for day in input.first_day..input.past_day {
        if day != state.budget.day {
            state.budget = roll(rules, state.budget, clock, day);
        }
        if day >= input.quiet_days {
            for ruin in 0_u32..input.ruins_per_day {
                let sample: u64 = day * input.ruins_per_day.into() + ruin.into();
                let tier = roll_tier(odds, 0x524f4c4c + Into::<u64, u256>::into(sample));
                let shares: u128 = tier_value(rules.shares, tier).into();
                let amount = shares * state.budget.price;
                state.budget.rolled_shares += shares;
                if !fits(state.budget, clock, amount) {
                    state.refused += 1;
                    continue;
                }
                if input.clear {
                    state.budget.pool_left -= amount;
                    state.paid += amount;
                } else {
                    state.budget.open += amount;
                }
                assert_conservation(state, clock, day);
            }
        }
        assert_conservation(state, clock, day);
    }
    state
}
pub fn simulate(ruins_per_day: u32, quiet_days: u64, clear: bool) -> (u128, u128) {
    let state = simulate_range(
        ChunkInput { ruins_per_day, quiet_days, clear, first_day: 0, past_day: SEASON_DAYS, before: None },
        initial_season(),
    );
    (state.paid, state.refused)
}
pub fn assert_dense_chunk(scenario: u32, chunk: u32) {
    assert!(scenario < 6 && chunk < CHUNKS);
    assert_eq!(Into::<u32, u64>::into(CHUNKS) * CHUNK_DAYS, SEASON_DAYS);
    let data = read_txt(@FileTrait::new("../../src/tests/fixtures/lords-budget/seasons.txt"));
    let mut data = data.span();
    let records: Array<SeasonChunk> = Serde::deserialize(ref data).unwrap();
    assert!(data.is_empty());
    assert_eq!(records.len(), 6 * CHUNKS);
    let index = scenario * CHUNKS + chunk;
    let record = *records.at(index);
    let ruins_per_day = if scenario < 3 {
        2000
    } else {
        300
    };
    let (quiet_days, clear) = match scenario % 3 {
        0 => (0, true),
        1 => (30, true),
        _ => (0, false),
    };
    assert_eq!((record.ruins_per_day, record.quiet_days, record.clear), (ruins_per_day, quiet_days, clear));
    assert_eq!(record.first_day, Into::<u32, u64>::into(chunk) * CHUNK_DAYS);
    assert_eq!(record.past_day, record.first_day + CHUNK_DAYS);
    if chunk == 0 {
        assert_eq!(record.before, initial_season());
    } else {
        let previous = *records.at(index - 1);
        assert_eq!(record.first_day, previous.past_day);
        assert_eq!(record.before, previous.after);
    }
    let actual = simulate_range(
        ChunkInput {
            ruins_per_day: record.ruins_per_day,
            quiet_days: record.quiet_days,
            clear: record.clear,
            first_day: record.first_day,
            past_day: record.past_day,
            before: Some(record.before),
        },
        record.before,
    );
    assert_eq!(actual, record.after);
    assert_eq!(actual.budget.day, record.past_day - 1);
}
