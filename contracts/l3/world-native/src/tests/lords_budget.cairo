use core::dict::{Felt252Dict, Felt252DictTrait};
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
fn price_uses_rollover_over_expected_rolled_shares_without_a_floor() {
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
    let price = core::cmp::min(
        rules.price_ceiling, available(rules, today, clock) * crate::relics::LORDS_ESTIMATE_SCALE / expected,
    );
    assert_eq!(today.price, price);
    assert_eq!((today.open, today.rolled_shares, today.day), (0, 0, 1));
    let exhausted = LordsBudget { pool_left: 0, ..empty_day(rules, 0) };
    assert_eq!(open_day(rules, exhausted, clock).price, 0);
    assert!(!fits(rules, exhausted, clock, 1));
    let busy = open_day(rules, LordsBudget { estimate: 1_000_000_000_000, ..empty_day(rules, 0) }, clock);
    assert!(available(rules, busy, clock) > 0);
    assert_eq!(busy.price, 0);
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

fn simulate(ruins_per_day: u32, quiet_days: u64, clear: bool) -> (u128, u128) {
    let rules = rules();
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let odds = *preset.settlement.depths.at(0).chest;
    let mut budget = open_day(rules, empty_day(rules, 0), clock());
    let mut paid = 0;
    let mut refused = 0;
    for day in 0_u64..SEASON_DAYS {
        if day != budget.day {
            budget = roll(rules, budget, clock(), day);
        }
        if day < quiet_days {
            continue;
        }
        for ruin in 0_u32..ruins_per_day {
            let sample: u64 = day * ruins_per_day.into() + ruin.into();
            let tier = roll_tier(odds, 0x524f4c4c + Into::<u64, u256>::into(sample));
            let shares: u128 = tier_value(rules.shares, tier).into();
            let amount = shares * budget.price;
            budget.rolled_shares += shares;
            if !fits(rules, budget, clock(), amount) {
                refused += 1;
                continue;
            }
            if clear {
                budget.pool_left -= amount;
                paid += amount;
            } else {
                budget.open += amount;
            }
            assert!(rules.pool - budget.pool_left + budget.open <= unlocked(rules, clock(), day), "unlock overshot");
        }
    }
    assert_eq!(paid + budget.pool_left, rules.pool);
    (paid, refused)
}

#[test]
fn busy_and_quiet_stretches_never_borrow_the_next_days_unlock() {
    for ruins in array![2_u32, 20, 300, 2000] {
        simulate(ruins, 0, true);
        simulate(ruins, 30, true);
        simulate(ruins, 0, false);
    }
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
fn withdrawals_remain_open_through_the_last_second_of_the_preset_claim_window() {
    let game = clock().game;
    let rules = rules();
    crate::relics::assert_claim_window(game, rules, game.end_at);
    crate::relics::assert_claim_window(
        game, rules, game.end_at + Into::<u32, u64>::into(rules.claim_window_seconds) - 1,
    );
}

#[test]
#[should_panic(expected: "LORDS claim window closed")]
fn no_receipt_can_start_at_the_ledgers_close_deadline() {
    let game = clock().game;
    let rules = rules();
    crate::relics::assert_claim_window(game, rules, game.end_at + Into::<u32, u64>::into(rules.claim_window_seconds));
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
