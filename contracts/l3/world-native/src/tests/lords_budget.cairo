use core::dict::{Felt252Dict, Felt252DictTrait};
use snforge_std::fs::{FileTrait, read_txt};
use starknet::storage::{StorageMapWriteAccess, StoragePointerReadAccess};
use crate::logic::lords_budget::{SeasonClock, available, fits, open_day, roll, unlocked};
use crate::relics::{ChestRules, LordsBudget, roll_tier, tier_value};

const DAY_UNIT: u32 = 14400;
const SEASON_DAYS: u64 = 105;

fn rules() -> ChestRules {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    preset.economy.chests.unwrap()
}

fn clock() -> SeasonClock {
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
        tick: 120,
    }
}

fn empty_day(rules: ChestRules, day: u64) -> LordsBudget {
    LordsBudget { pool_left: rules.pool, open: 0, day, price: 0, estimate: 0, rolled_shares: 0 }
}

#[test]
fn current_seeded_day_is_unlocked_in_full_and_season_end_is_exact() {
    let rules = rules();
    let clock = clock();
    let first = crate::days::day_of(clock.game, DAY_UNIT, 0);
    assert_eq!(unlocked(rules, clock, 0), rules.pool * first.end.into() / clock.game.end_at.into());
    assert!(unlocked(rules, clock, 0) > 0);
    assert_eq!(unlocked(rules, clock, SEASON_DAYS - 1), rules.pool);
    let partial = SeasonClock { game: crate::game::GameRegistry { end_at: first.end - 1, ..clock.game }, ..clock };
    assert_eq!(unlocked(rules, partial, 0), rules.pool);
}

#[test]
fn quiet_days_roll_their_unspent_unlock_into_the_next_days_budget() {
    let rules = rules();
    let first = open_day(rules, empty_day(rules, 0), clock());
    let later = roll(rules, first, clock(), 4);
    assert_eq!(available(rules, first, clock()), unlocked(rules, clock(), 0));
    assert_eq!(available(rules, later, clock()), unlocked(rules, clock(), 4));
    assert!(available(rules, later, clock()) > available(rules, first, clock()));
    assert_eq!(later.price, rules.price_ceiling);
}

#[test]
fn paid_and_open_chests_share_one_unlock_and_refills_restore_only_issued_value() {
    let rules = rules();
    let mut today = open_day(rules, empty_day(rules, 0), clock());
    let unlock = unlocked(rules, clock(), 0);
    today.pool_left -= unlock - 1200;
    today.open = 300;
    assert_eq!(available(rules, today, clock()), 900);
    assert!(fits(rules, today, clock(), 900));
    assert!(!fits(rules, today, clock(), 901));
    // Clearing a reservation moves open to paid, leaving the available amount unchanged.
    today.pool_left -= 300;
    today.open -= 300;
    assert_eq!(available(rules, today, clock()), 900);
    today.pool_left += 110;
    assert_eq!(available(rules, today, clock()), 1010);
    assert!(!fits(rules, today, clock(), 0));
}

#[test]
fn expired_open_chests_release_their_budget_without_spending_the_pool() {
    let rules = rules();
    let previous = LordsBudget { open: 500, rolled_shares: 10, ..empty_day(rules, 0) };
    let next = roll(rules, previous, clock(), 1);
    assert_eq!((next.pool_left, next.open), (rules.pool, 0));
    assert_eq!(available(rules, next, clock()), unlocked(rules, clock(), 1));
    assert!(next.estimate > 0);
}

#[test]
#[should_panic(expected: ("refill exceeds issued LORDS",))]
fn a_refill_cannot_add_lords_that_the_pool_never_issued() {
    let (d, game_id, _) = super::registrar::setup_frontier_chests();
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp: 360, ..super::context(d.games, game_id) };
            crate::logic::lords_budget::return_to_pool(game_id, 1, context);
        },
    );
}

#[test]
fn price_uses_rollover_over_expected_rolled_shares_with_a_floor_of_one() {
    let rules = rules();
    let mut previous = empty_day(rules, 0);
    previous.rolled_shares = 1800;
    previous.pool_left -= 500;
    let today = roll(rules, previous, clock(), 1);
    let clock = clock();
    let first = crate::days::day_of(clock.game, DAY_UNIT, 0);
    let current = crate::days::day_of(clock.game, DAY_UNIT, first.end);
    let yesterday_ticks: u128 = (first.end / clock.tick).into();
    let current_ticks: u128 = ((current.end - current.start) / clock.tick).into();
    assert_eq!(
        today.estimate, 1800 * crate::relics::LORDS_ESTIMATE_SCALE / yesterday_ticks / rules.estimate_days.into(),
    );
    let expected = today.estimate * current_ticks;
    let price = core::cmp::max(
        1,
        core::cmp::min(
            rules.price_ceiling, available(rules, today, clock) * crate::relics::LORDS_ESTIMATE_SCALE / expected,
        ),
    );
    assert_eq!(today.price, price);
    assert_eq!((today.open, today.rolled_shares, today.day), (0, 0, 1));
    let exhausted = LordsBudget { pool_left: 0, estimate: 1_000_000_000_000, ..empty_day(rules, 0) };
    assert_eq!(open_day(rules, exhausted, clock).price, 1);
    assert!(!fits(rules, exhausted, clock, 1));
    let zero_expected = LordsBudget { estimate: 0, ..exhausted };
    assert_eq!(open_day(rules, zero_expected, clock).price, rules.price_ceiling);
    assert!(!fits(rules, zero_expected, clock, rules.price_ceiling));
    let busy = open_day(rules, LordsBudget { estimate: 1_000_000_000_000, ..empty_day(rules, 0) }, clock);
    assert!(available(rules, busy, clock) > 0);
    assert_eq!(busy.price, 1);
}

#[test]
fn refused_rolls_feed_the_estimate_and_clear_does_not_count_them_again() {
    let (d, game_id, _) = super::registrar::setup_frontier_chests();
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp: 360, ..super::context(d.games, game_id) };
            let rules = crate::logic::preset_record::for_game(game_id).rollover_chest_rules.read().unwrap();
            let day = crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, 360).index;
            let chest = crate::relics::SiteChest { tier: 3, amount: 500, reservation_day: 0 };
            crate::state::write()
                .relics
                .rollover_budget
                .write(game_id, Some(LordsBudget { pool_left: 0, ..empty_day(rules, day) }));
            assert!(!crate::logic::lords_budget::try_reserve(game_id, chest, context));
            let refused = crate::logic::lords_budget::budget(game_id).unwrap();
            assert_eq!((refused.rolled_shares, refused.open), (10, 0));
            crate::state::write()
                .relics
                .rollover_budget
                .write(game_id, Some(LordsBudget { pool_left: rules.pool, price: rules.price_ceiling, ..refused }));
            assert!(crate::logic::lords_budget::try_reserve(game_id, chest, context));
            let site = crate::resources::ResourceKey { game_id, entity_id: 999 };
            crate::logic::lords_budget::store_site_chest(site, chest);
            let payout = crate::logic::lords_budget::pay(site, context);
            assert_eq!(payout.amount, 500 * crate::rules::RESOURCE_PRECISION);
            assert_eq!(crate::logic::lords_budget::budget(game_id).unwrap().rolled_shares, 20);
        },
    );
}

#[test]
fn chest_tiers_follow_each_depths_odds_over_10k_rolls() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    for depth in preset.settlement.depths {
        let odds = *depth.chest;
        let mut counts: Felt252Dict<u32> = Default::default();
        for sample in 0_u64..10000 {
            let tier = roll_tier(odds, 0x4348455354 + Into::<u64, u256>::into(sample));
            counts.insert(tier.into(), counts.get(tier.into()) + 1);
        }
        for tier in 0_u8..5 {
            let expected: u32 = tier_value(odds, tier).into();
            let actual = counts.get(tier.into());
            let difference = core::cmp::max(actual, expected) - core::cmp::min(actual, expected);
            let variance = expected * (10000 - expected) / 10000;
            assert!(difference * difference <= 16 * variance + 1, "chest tier outside four sigma");
        }
    }
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
struct SeasonState {
    budget: LordsBudget,
    paid: u128,
    refused: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
struct SeasonChunk {
    ruins_per_day: u32,
    quiet_days: u64,
    clear: bool,
    first_day: u64,
    past_day: u64,
    before: SeasonState,
    after: SeasonState,
}

#[derive(Copy, Drop, Serde)]
struct ChunkInput {
    ruins_per_day: u32,
    quiet_days: u64,
    clear: bool,
    first_day: u64,
    past_day: u64,
    before: Option<SeasonState>,
}

const CHUNK_DAYS: u64 = 7;
const CHUNKS: u32 = 15;

fn initial_season() -> SeasonState {
    let rules = rules();
    SeasonState { budget: open_day(rules, empty_day(rules, 0), clock()), paid: 0, refused: 0 }
}

fn assert_conservation(state: SeasonState, rules: ChestRules, clock: SeasonClock, day: u64) {
    assert_eq!(state.paid + state.budget.pool_left, rules.pool);
    assert!(rules.pool - state.budget.pool_left + state.budget.open <= unlocked(rules, clock, day), "unlock overshot");
}

// Seven-day test VMs replace one season's retained traces; state and running totals cross every boundary.
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
                if !fits(rules, state.budget, clock, amount) {
                    state.refused += 1;
                    continue;
                }
                if input.clear {
                    state.budget.pool_left -= amount;
                    state.paid += amount;
                } else {
                    state.budget.open += amount;
                }
                assert_conservation(state, rules, clock, day);
            }
        }
        assert_conservation(state, rules, clock, day);
    }
    state
}

fn simulate(ruins_per_day: u32, quiet_days: u64, clear: bool) -> (u128, u128) {
    let state = simulate_range(
        ChunkInput { ruins_per_day, quiet_days, clear, first_day: 0, past_day: SEASON_DAYS, before: None },
        initial_season(),
    );
    (state.paid, state.refused)
}

fn assert_dense_chunk(scenario: u32, chunk: u32) {
    assert!(scenario < 3 && chunk < CHUNKS);
    assert_eq!(Into::<u32, u64>::into(CHUNKS) * CHUNK_DAYS, SEASON_DAYS);
    let data = read_txt(@FileTrait::new("src/tests/fixtures/lords-budget/seasons.txt"));
    let mut data = data.span();
    let records: Array<SeasonChunk> = Serde::deserialize(ref data).unwrap();
    assert!(data.is_empty());
    assert_eq!(records.len(), 3 * CHUNKS);
    let index = scenario * CHUNKS + chunk;
    let record = *records.at(index);
    let (quiet_days, clear) = match scenario {
        0 => (0, true),
        1 => (30, true),
        _ => (0, false),
    };
    assert_eq!((record.ruins_per_day, record.quiet_days, record.clear), (2000, quiet_days, clear));
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

// This producer uses the same real draw/gate loop; generation releases each chunk's VM before starting the next.
#[test]
#[ignore]
fn record_budget_checkpoint() {
    let data = read_txt(@FileTrait::new("target/budget-checkpoint-input.txt"));
    let mut data = data.span();
    let input: ChunkInput = Serde::deserialize(ref data).unwrap();
    assert!(data.is_empty());
    let before = match input.before {
        Some(state) => state,
        None => {
            assert_eq!(input.first_day, 0);
            initial_season()
        },
    };
    let record = SeasonChunk {
        ruins_per_day: input.ruins_per_day,
        quiet_days: input.quiet_days,
        clear: input.clear,
        first_day: input.first_day,
        past_day: input.past_day,
        before,
        after: simulate_range(input, before),
    };
    let mut values = array![];
    record.serialize(ref values);
    println!("BUDGET_CHECKPOINT {:?}", values.span());
}

// All rates, days, roots and production gates stay; dense scenarios use chained seven-day VMs.
#[test]
fn busy_2_ruins_per_day_never_borrow_future_unlocks() {
    simulate(2, 0, true);
}

#[test]
fn quiet_then_busy_2_ruins_per_day_never_borrow_future_unlocks() {
    simulate(2, 30, true);
}

#[test]
fn unopened_2_ruins_per_day_never_borrow_future_unlocks() {
    simulate(2, 0, false);
}

#[test]
fn busy_20_ruins_per_day_never_borrow_future_unlocks() {
    simulate(20, 0, true);
}

#[test]
fn quiet_then_busy_20_ruins_per_day_never_borrow_future_unlocks() {
    simulate(20, 30, true);
}

#[test]
fn unopened_20_ruins_per_day_never_borrow_future_unlocks() {
    simulate(20, 0, false);
}

#[test]
fn busy_300_ruins_per_day_never_borrow_future_unlocks() {
    simulate(300, 0, true);
}

#[test]
fn quiet_then_busy_300_ruins_per_day_never_borrow_future_unlocks() {
    simulate(300, 30, true);
}

#[test]
fn unopened_300_ruins_per_day_never_borrow_future_unlocks() {
    simulate(300, 0, false);
}

#[test_case(name: "days_000_006", 0)]
#[test_case(name: "days_007_013", 1)]
#[test_case(name: "days_014_020", 2)]
#[test_case(name: "days_021_027", 3)]
#[test_case(name: "days_028_034", 4)]
#[test_case(name: "days_035_041", 5)]
#[test_case(name: "days_042_048", 6)]
#[test_case(name: "days_049_055", 7)]
#[test_case(name: "days_056_062", 8)]
#[test_case(name: "days_063_069", 9)]
#[test_case(name: "days_070_076", 10)]
#[test_case(name: "days_077_083", 11)]
#[test_case(name: "days_084_090", 12)]
#[test_case(name: "days_091_097", 13)]
#[test_case(name: "days_098_104", 14)]
fn busy_2000_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(0, chunk);
}

#[test_case(name: "days_000_006", 0)]
#[test_case(name: "days_007_013", 1)]
#[test_case(name: "days_014_020", 2)]
#[test_case(name: "days_021_027", 3)]
#[test_case(name: "days_028_034", 4)]
#[test_case(name: "days_035_041", 5)]
#[test_case(name: "days_042_048", 6)]
#[test_case(name: "days_049_055", 7)]
#[test_case(name: "days_056_062", 8)]
#[test_case(name: "days_063_069", 9)]
#[test_case(name: "days_070_076", 10)]
#[test_case(name: "days_077_083", 11)]
#[test_case(name: "days_084_090", 12)]
#[test_case(name: "days_091_097", 13)]
#[test_case(name: "days_098_104", 14)]
fn quiet_then_busy_2000_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(1, chunk);
}

#[test_case(name: "days_000_006", 0)]
#[test_case(name: "days_007_013", 1)]
#[test_case(name: "days_014_020", 2)]
#[test_case(name: "days_021_027", 3)]
#[test_case(name: "days_028_034", 4)]
#[test_case(name: "days_035_041", 5)]
#[test_case(name: "days_042_048", 6)]
#[test_case(name: "days_049_055", 7)]
#[test_case(name: "days_056_062", 8)]
#[test_case(name: "days_063_069", 9)]
#[test_case(name: "days_070_076", 10)]
#[test_case(name: "days_077_083", 11)]
#[test_case(name: "days_084_090", 12)]
#[test_case(name: "days_091_097", 13)]
#[test_case(name: "days_098_104", 14)]
fn unopened_2000_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(2, chunk);
}

#[test]
fn skipped_day_decay_is_exact_beyond_sixty_four_days() {
    let rules = ChestRules { estimate_days: 100, ..rules() };
    let previous = LordsBudget { estimate: 1_000_000_000, ..empty_day(rules, 0) };
    let mut expected = previous.estimate;
    for _ in 0_u64..100 {
        expected = expected * 99 / 100;
    }
    assert!(expected != 0);
    assert_eq!(roll(rules, previous, clock(), 100).estimate, expected);
}

#[test]
fn withdrawals_stop_one_hour_before_the_report_deadline() {
    let game = clock().game;
    let rules = rules();
    crate::relics::assert_claim_window(game, rules, game.end_at);
    crate::relics::assert_claim_window(
        game, rules, game.end_at + Into::<u32, u64>::into(rules.claim_window_seconds - crate::days::FRONTIER_REPORT_GRACE_SECONDS) - 1,
    );
}

#[test]
#[should_panic(expected: "LORDS claim window closed")]
fn no_receipt_can_start_in_the_reporting_grace_hour() {
    let game = clock().game;
    let rules = rules();
    crate::relics::assert_claim_window(game, rules, game.end_at + Into::<u32, u64>::into(rules.claim_window_seconds - crate::days::FRONTIER_REPORT_GRACE_SECONDS));
}

#[test]
fn an_expired_chest_cannot_spend_another_players_reservation() {
    let (d, game_id, _) = super::registrar::setup_frontier_chests();
    snforge_std::interact_with_state(
        d.games,
        || {
            let first = crate::resources::ResourceKey { game_id, entity_id: 90001 };
            let second = crate::resources::ResourceKey { game_id, entity_id: 90002 };
            let context = crate::commands::ExecutionContext { timestamp: 360, ..super::context(d.games, game_id) };
            let chest = crate::relics::SiteChest { tier: 0, amount: 100, reservation_day: 0 };
            assert!(crate::logic::lords_budget::try_reserve(game_id, chest, context));
            crate::logic::lords_budget::store_site_chest(first, chest);
            let next = crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, 360).end;
            let context = crate::commands::ExecutionContext { timestamp: next, ..context };
            let chest = crate::relics::SiteChest { tier: 0, amount: 120, reservation_day: 1 };
            assert!(crate::logic::lords_budget::try_reserve(game_id, chest, context));
            crate::logic::lords_budget::store_site_chest(second, chest);
            let before = crate::logic::lords_budget::budget(game_id).unwrap();
            assert_eq!(crate::logic::lords_budget::pay(first, context).amount, 0);
            assert_eq!(crate::logic::lords_budget::budget(game_id).unwrap(), before);
            assert_eq!(crate::logic::lords_budget::pay(second, context).amount, 120 * crate::rules::RESOURCE_PRECISION);
            assert_eq!(crate::logic::lords_budget::budget(game_id).unwrap().open, 0);
        },
    );
}

#[test]
#[should_panic(expected: "LORDS claim window needs reporting grace")]
fn a_frontier_preset_requires_more_than_the_reporting_hour() {
    let (_, mut preset) = super::preset_projection::current_definition("frontier");
    let chests = preset.economy.chests.unwrap();
    preset.economy.chests = Option::Some(ChestRules {
        claim_window_seconds: crate::days::FRONTIER_REPORT_GRACE_SECONDS, ..chests
    });
    crate::presets::validate(preset);
}
