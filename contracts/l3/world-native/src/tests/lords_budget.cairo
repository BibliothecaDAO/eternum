use core::dict::{Felt252Dict, Felt252DictTrait};
use crate::logic::lords_budget::{SeasonClock, fits, open_day, roll};
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

// A budget as it stood at the end of `day`, before anything was found that day.
fn closed_day(rules: ChestRules, day: u64) -> LordsBudget {
    LordsBudget { pool_left: rules.pool, open: 0, spent: 0, day, price: 0, ceiling: 0, estimate: 0, paid_shares: 0 }
}

#[test]
fn the_preset_holds_the_ruled_shares_ceiling_and_pool() {
    let rules = rules();
    let shares = rules.shares;
    assert_eq!((shares.common, shares.uncommon, shares.rare, shares.epic, shares.legendary), (1, 2, 4, 10, 20));
    assert_eq!((rules.pool, rules.price_ceiling), (1000000, 50));
    assert_eq!((rules.surge_factor, rules.surge_minimum_shares), (3, 60));
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let mut odds = array![];
    for depth in preset.settlement.depths {
        let chest = *depth.chest;
        odds.append((chest.common, chest.uncommon, chest.rare, chest.epic, chest.legendary));
    }
    assert_eq!(
        odds,
        array![
            (5000, 2700, 1400, 600, 300), (4000, 3000, 1700, 900, 400), (3000, 3000, 2200, 1200, 600),
            (2000, 3000, 2500, 1600, 900),
        ],
    );
}

#[test]
fn a_small_season_pays_the_ceiling_by_tier() {
    let rules = rules();
    assert_eq!(open_day(rules, closed_day(rules, 0), clock()).price, 50);
    let today = roll(rules, closed_day(rules, 0), clock(), 1);
    assert_eq!(today.price, 50);
    let mut amounts = array![];
    for tier in 0_u8..5 {
        amounts.append(Into::<u16, u128>::into(tier_value(rules.shares, tier)) * today.price);
    }
    assert_eq!(amounts, array![50, 100, 200, 500, 1000]);
}

#[test]
fn the_surge_ceiling_holds_three_legendaries_on_a_quiet_day() {
    let rules = rules();
    let mut today = roll(rules, closed_day(rules, 0), clock(), 1);
    assert_eq!(today.ceiling, 3000);
    for _ in 0_u8..3 {
        assert!(fits(today, 1000));
        today.open += 1000;
        today.spent += 1000;
    }
    assert!(!fits(today, 50));
}

#[test]
fn a_chest_never_takes_the_pool_held_by_open_chests() {
    let rules = rules();
    let mut today = roll(rules, closed_day(rules, 0), clock(), 1);
    today.pool_left = 1200;
    today.open = 300;
    assert!(fits(today, 500));
    assert!(!fits(today, 1000));
}

#[test]
fn a_busy_day_prices_its_allowance_over_the_expected_shares() {
    let rules = rules();
    let mut previous = closed_day(rules, 0);
    // 1,800 shares paid on the day before, with no history before it.
    previous.paid_shares = 1800;
    let today = roll(rules, previous, clock(), 1);
    let clock = clock();
    let yesterday = crate::days::day_of(clock.game, DAY_UNIT, 0);
    let current = crate::days::day_of(clock.game, DAY_UNIT, yesterday.end);
    assert!(current.end - current.start != yesterday.end - yesterday.start);
    let yesterday_ticks: u128 = ((yesterday.end - yesterday.start) / clock.tick).into();
    let current_ticks: u128 = ((current.end - current.start) / clock.tick).into();
    let ticks_left: u128 = ((clock.game.end_at - current.start) / clock.tick).into();
    assert_eq!(today.estimate, 1800 * crate::relics::LORDS_ESTIMATE_SCALE / yesterday_ticks / 5);
    let allowance = rules.pool * current_ticks / ticks_left;
    let expected = today.estimate * current_ticks;
    let price = core::cmp::min(rules.price_ceiling, allowance * crate::relics::LORDS_ESTIMATE_SCALE / expected);
    assert_eq!(today.price, core::cmp::max(price, 1));
    assert_eq!(today.ceiling, today.price * core::cmp::max(3 * expected / crate::relics::LORDS_ESTIMATE_SCALE, 60));
    assert_eq!((today.open, today.spent, today.paid_shares, today.day), (0, 0, 0, 1));
}

#[test]
fn quiet_days_decay_the_estimate_and_the_price_never_falls_below_one() {
    let rules = rules();
    let mut previous = closed_day(rules, 0);
    previous.estimate = 1000000000;
    let next = roll(rules, previous, clock(), 1);
    let skipped = roll(rules, previous, clock(), 4);
    assert!(skipped.estimate < next.estimate);
    assert!(next.price >= 1);
    previous.pool_left = 1;
    assert_eq!(roll(rules, previous, clock(), 1).price, 1);
}

#[test]
fn chest_tiers_follow_each_depths_odds_over_10k_rolls() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    for depth in preset.settlement.depths {
        let odds = *depth.chest;
        let mut counts: Felt252Dict<u32> = Default::default();
        for timestamp in 0_u64..10000 {
            let tier = roll_tier(odds, 0x4348455354, timestamp);
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

// Seasons of 105 seeded days with a fixed number of ruins a day, each chest found and cleared while it fits. The pool
// never pays past its size, a small season pays the ceiling throughout, and a full one spends most of its pool.
fn simulate(ruins_per_day: u32, seed: u256) -> (u128, u128, bool) {
    let rules = rules();
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let odds = *preset.settlement.depths.at(0).chest;
    let mut budget = open_day(rules, closed_day(rules, 0), clock());
    let mut paid: u128 = 0;
    let mut at_ceiling = true;
    for day in 0_u64..SEASON_DAYS {
        if day != budget.day {
            budget = roll(rules, budget, clock(), day);
        }
        at_ceiling = at_ceiling && budget.price == rules.price_ceiling;
        for ruin in 0_u32..ruins_per_day {
            let tier = roll_tier(odds, seed, day * 1000 + ruin.into());
            let shares: u128 = tier_value(rules.shares, tier).into();
            let amount = shares * budget.price;
            if !fits(budget, amount) {
                continue;
            }
            budget.spent += amount;
            budget.pool_left -= amount;
            budget.paid_shares += shares;
            paid += amount;
        }
    }
    assert!(paid <= rules.pool, "the pool overshot");
    assert_eq!(paid + budget.pool_left, rules.pool);
    (paid, budget.pool_left, at_ceiling)
}

#[test]
fn the_pool_never_overshoots_across_season_sizes() {
    let (_, _, small_at_ceiling) = simulate(2, 0x534d414c4c);
    assert!(small_at_ceiling, "a small season pays below the ceiling");
    for (ruins, seed) in array![(20_u32, 1_u256), (80, 2), (300, 3)] {
        let (paid, left, _) = simulate(ruins, seed);
        println!("{} ruins a day: paid {}, left {}", ruins, paid, left);
    }
    let (paid, _, _) = simulate(300, 4);
    assert!(paid * 4 >= rules().pool * 3, "a full season leaves most of its pool");
}

#[test]
fn skipped_day_decay_is_exact_beyond_sixty_four_days() {
    let rules = ChestRules { estimate_days: 100, ..rules() };
    let previous = LordsBudget { estimate: 1_000_000_000, ..closed_day(rules, 0) };
    let mut expected = previous.estimate;
    for _ in 0_u64..100 {
        expected = expected * 99 / 100;
    }
    assert!(expected != 0);
    assert_eq!(roll(rules, previous, clock(), 100).estimate, expected);
    let small = LordsBudget { estimate: 1, ..previous };
    assert_eq!(roll(rules, small, clock(), 100).estimate, 0);
}
