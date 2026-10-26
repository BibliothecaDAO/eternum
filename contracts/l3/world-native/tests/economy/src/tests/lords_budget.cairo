pub use world_test_support::tests::lords_budget::*;


#[test]
fn current_seeded_day_is_unlocked_in_full_and_season_end_is_exact() {
    let clock = clock();
    let first = crate::days::day_of(clock.game, DAY_UNIT, 0);
    assert_eq!(unlocked(TEST_POOL, clock, 0), TEST_POOL * first.end.into() / clock.game.end_at.into());
    assert!(unlocked(TEST_POOL, clock, 0) > 0);
    assert_eq!(unlocked(TEST_POOL, clock, SEASON_DAYS - 1), TEST_POOL);
    let partial = SeasonClock { game: crate::game::GameRegistry { end_at: first.end - 1, ..clock.game }, ..clock };
    assert_eq!(unlocked(TEST_POOL, partial, 0), TEST_POOL);
}

#[test]
fn quiet_days_roll_their_unspent_unlock_into_the_next_days_budget() {
    let first = empty_day(TEST_POOL, 0);
    let later = roll(rules(), first, clock(), 4);
    assert_eq!(available(first, clock()), unlocked(TEST_POOL, clock(), 0));
    assert_eq!(available(later, clock()), unlocked(TEST_POOL, clock(), 4));
    assert!(available(later, clock()) > available(first, clock()));
}

#[test]
fn paid_and_open_chests_share_one_unlock_and_refills_restore_only_issued_value() {
    let mut today = empty_day(TEST_POOL, 0);
    let unlock = unlocked(TEST_POOL, clock(), 0);
    today.pool_left -= unlock - 1200;
    today.open = 300;
    assert_eq!(available(today, clock()), 900);
    assert!(fits(today, clock(), 900));
    assert!(!fits(today, clock(), 901));
    // Clearing a reservation moves open to paid, leaving the available amount unchanged.
    today.pool_left -= 300;
    today.open -= 300;
    assert_eq!(available(today, clock()), 900);
    today.pool_left += 110;
    assert_eq!(available(today, clock()), 1010);
    assert!(!fits(today, clock(), 0));
}

#[test]
fn expired_open_chests_release_their_budget_without_spending_the_pool() {
    let previous = LordsBudget { open: 500, ..empty_day(TEST_POOL, 0) };
    let next = roll(rules(), previous, clock(), 1);
    assert_eq!((next.pool_left, next.open), (TEST_POOL, 0));
    assert_eq!(available(next, clock()), unlocked(TEST_POOL, clock(), 1));
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
fn candidates_keep_the_daily_price_across_spending_and_reset_after_untouched_days() {
    let (d, game_id, _) = super::registrar::setup_frontier_chests();
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp: 360, ..super::context(d.games, game_id) };
            let rules = crate::logic::lords_budget::chest_rules(game_id);
            let odds = crate::relics::ChestTiers { common: 0, uncommon: 0, rare: 0, epic: 10000, legendary: 0 };
            let first = crate::logic::lords_budget::candidate(game_id, odds, 123, context);
            assert_eq!(first.amount, Into::<u16, u128>::into(rules.shares.epic) * rules.price_ceiling);
            assert!(crate::logic::lords_budget::try_reserve(game_id, first, context));
            let site = crate::resources::ResourceKey { game_id, entity_id: 999 };
            crate::logic::lords_budget::store_site_chest(site, first);
            crate::logic::lords_budget::pay(site, context);
            let same_day = crate::logic::lords_budget::candidate(game_id, odds, 123, context);
            assert_eq!(same_day.amount, first.amount);
            let game = context.game.unbox();
            let day_unit = context.rules.unbox().day_unit_seconds;
            let next_day = crate::days::day_of(game, day_unit, context.timestamp).end;
            let after_quiet_day = crate::days::day_of(game, day_unit, next_day).end;
            let later = crate::logic::lords_budget::candidate(
                game_id, odds, 123, crate::commands::ExecutionContext { timestamp: after_quiet_day, ..context },
            );
            assert_eq!(later.amount, first.amount);
            assert!(later.reservation_day > first.reservation_day + 1);
        },
    );
}

#[test]
fn refused_chests_reserve_nothing_and_clearing_spends_only_the_hold() {
    let (d, game_id, _) = super::registrar::setup_frontier_chests();
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp: 360, ..super::context(d.games, game_id) };
            let day = crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, 360).index;
            let chest = crate::relics::SiteChest { tier: 3, amount: 500, reservation_day: 0 };
            crate::state::write()
                .relics
                .rollover_budget
                .write(game_id, Some(LordsBudget { pool_left: 0, ..empty_day(TEST_POOL, day) }));
            assert!(!crate::logic::lords_budget::try_reserve(game_id, chest, context));
            let refused = crate::logic::lords_budget::budget(game_id).unwrap();
            assert_eq!((refused.pool_left, refused.open), (0, 0));
            crate::state::write()
                .relics
                .rollover_budget
                .write(game_id, Some(LordsBudget { pool_left: TEST_POOL, ..refused }));
            assert!(crate::logic::lords_budget::try_reserve(game_id, chest, context));
            let site = crate::resources::ResourceKey { game_id, entity_id: 999 };
            crate::logic::lords_budget::store_site_chest(site, chest);
            let payout = crate::logic::lords_budget::pay(site, context);
            assert_eq!(payout.amount, 500 * crate::rules::RESOURCE_PRECISION);
            assert_eq!(crate::logic::lords_budget::budget(game_id).unwrap().open, 0);
            assert_eq!(crate::logic::lords_budget::budget(game_id).unwrap().pool_left, TEST_POOL - 500);
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

// This producer uses the same real draw/gate loop; generation releases each chunk's VM before starting the next.
#[test]
#[ignore]
fn record_budget_checkpoint() {
    let data = read_txt(@FileTrait::new("../../target/budget-checkpoint-input.txt"));
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

// All rates, days, roots and production gates stay; dense scenarios use chained five-day VMs.
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

#[test_case(name: "days_000_004", 0)]
#[test_case(name: "days_005_009", 1)]
#[test_case(name: "days_010_014", 2)]
#[test_case(name: "days_015_019", 3)]
#[test_case(name: "days_020_024", 4)]
#[test_case(name: "days_025_029", 5)]
#[test_case(name: "days_030_034", 6)]
#[test_case(name: "days_035_039", 7)]
#[test_case(name: "days_040_044", 8)]
#[test_case(name: "days_045_049", 9)]
#[test_case(name: "days_050_054", 10)]
#[test_case(name: "days_055_059", 11)]
#[test_case(name: "days_060_064", 12)]
#[test_case(name: "days_065_069", 13)]
#[test_case(name: "days_070_074", 14)]
#[test_case(name: "days_075_079", 15)]
#[test_case(name: "days_080_084", 16)]
#[test_case(name: "days_085_089", 17)]
#[test_case(name: "days_090_094", 18)]
#[test_case(name: "days_095_099", 19)]
#[test_case(name: "days_100_104", 20)]
fn busy_300_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(3, chunk);
}

#[test_case(name: "days_000_004", 0)]
#[test_case(name: "days_005_009", 1)]
#[test_case(name: "days_010_014", 2)]
#[test_case(name: "days_015_019", 3)]
#[test_case(name: "days_020_024", 4)]
#[test_case(name: "days_025_029", 5)]
#[test_case(name: "days_030_034", 6)]
#[test_case(name: "days_035_039", 7)]
#[test_case(name: "days_040_044", 8)]
#[test_case(name: "days_045_049", 9)]
#[test_case(name: "days_050_054", 10)]
#[test_case(name: "days_055_059", 11)]
#[test_case(name: "days_060_064", 12)]
#[test_case(name: "days_065_069", 13)]
#[test_case(name: "days_070_074", 14)]
#[test_case(name: "days_075_079", 15)]
#[test_case(name: "days_080_084", 16)]
#[test_case(name: "days_085_089", 17)]
#[test_case(name: "days_090_094", 18)]
#[test_case(name: "days_095_099", 19)]
#[test_case(name: "days_100_104", 20)]
fn quiet_then_busy_300_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(4, chunk);
}

#[test_case(name: "days_000_004", 0)]
#[test_case(name: "days_005_009", 1)]
#[test_case(name: "days_010_014", 2)]
#[test_case(name: "days_015_019", 3)]
#[test_case(name: "days_020_024", 4)]
#[test_case(name: "days_025_029", 5)]
#[test_case(name: "days_030_034", 6)]
#[test_case(name: "days_035_039", 7)]
#[test_case(name: "days_040_044", 8)]
#[test_case(name: "days_045_049", 9)]
#[test_case(name: "days_050_054", 10)]
#[test_case(name: "days_055_059", 11)]
#[test_case(name: "days_060_064", 12)]
#[test_case(name: "days_065_069", 13)]
#[test_case(name: "days_070_074", 14)]
#[test_case(name: "days_075_079", 15)]
#[test_case(name: "days_080_084", 16)]
#[test_case(name: "days_085_089", 17)]
#[test_case(name: "days_090_094", 18)]
#[test_case(name: "days_095_099", 19)]
#[test_case(name: "days_100_104", 20)]
fn unopened_300_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(5, chunk);
}

#[test_case(name: "days_000_004", 0)]
#[test_case(name: "days_005_009", 1)]
#[test_case(name: "days_010_014", 2)]
#[test_case(name: "days_015_019", 3)]
#[test_case(name: "days_020_024", 4)]
#[test_case(name: "days_025_029", 5)]
#[test_case(name: "days_030_034", 6)]
#[test_case(name: "days_035_039", 7)]
#[test_case(name: "days_040_044", 8)]
#[test_case(name: "days_045_049", 9)]
#[test_case(name: "days_050_054", 10)]
#[test_case(name: "days_055_059", 11)]
#[test_case(name: "days_060_064", 12)]
#[test_case(name: "days_065_069", 13)]
#[test_case(name: "days_070_074", 14)]
#[test_case(name: "days_075_079", 15)]
#[test_case(name: "days_080_084", 16)]
#[test_case(name: "days_085_089", 17)]
#[test_case(name: "days_090_094", 18)]
#[test_case(name: "days_095_099", 19)]
#[test_case(name: "days_100_104", 20)]
fn busy_2000_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(0, chunk);
}

#[test_case(name: "days_000_004", 0)]
#[test_case(name: "days_005_009", 1)]
#[test_case(name: "days_010_014", 2)]
#[test_case(name: "days_015_019", 3)]
#[test_case(name: "days_020_024", 4)]
#[test_case(name: "days_025_029", 5)]
#[test_case(name: "days_030_034", 6)]
#[test_case(name: "days_035_039", 7)]
#[test_case(name: "days_040_044", 8)]
#[test_case(name: "days_045_049", 9)]
#[test_case(name: "days_050_054", 10)]
#[test_case(name: "days_055_059", 11)]
#[test_case(name: "days_060_064", 12)]
#[test_case(name: "days_065_069", 13)]
#[test_case(name: "days_070_074", 14)]
#[test_case(name: "days_075_079", 15)]
#[test_case(name: "days_080_084", 16)]
#[test_case(name: "days_085_089", 17)]
#[test_case(name: "days_090_094", 18)]
#[test_case(name: "days_095_099", 19)]
#[test_case(name: "days_100_104", 20)]
fn quiet_then_busy_2000_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(1, chunk);
}

#[test_case(name: "days_000_004", 0)]
#[test_case(name: "days_005_009", 1)]
#[test_case(name: "days_010_014", 2)]
#[test_case(name: "days_015_019", 3)]
#[test_case(name: "days_020_024", 4)]
#[test_case(name: "days_025_029", 5)]
#[test_case(name: "days_030_034", 6)]
#[test_case(name: "days_035_039", 7)]
#[test_case(name: "days_040_044", 8)]
#[test_case(name: "days_045_049", 9)]
#[test_case(name: "days_050_054", 10)]
#[test_case(name: "days_055_059", 11)]
#[test_case(name: "days_060_064", 12)]
#[test_case(name: "days_065_069", 13)]
#[test_case(name: "days_070_074", 14)]
#[test_case(name: "days_075_079", 15)]
#[test_case(name: "days_080_084", 16)]
#[test_case(name: "days_085_089", 17)]
#[test_case(name: "days_090_094", 18)]
#[test_case(name: "days_095_099", 19)]
#[test_case(name: "days_100_104", 20)]
fn unopened_2000_ruins_per_day_never_borrow_future_unlocks(chunk: u32) {
    assert_dense_chunk(2, chunk);
}

#[test]
fn withdrawals_stop_one_hour_before_the_report_deadline() {
    let game = clock().game;
    let rules = rules();
    crate::relics::assert_claim_window(game, rules, game.end_at);
    crate::relics::assert_claim_window(
        game,
        rules,
        game.end_at
            + Into::<u32, u64>::into(rules.claim_window_seconds - crate::days::FRONTIER_REPORT_GRACE_SECONDS)
            - 1,
    );
}

#[test]
#[should_panic(expected: "LORDS claim window closed")]
fn no_receipt_can_start_in_the_reporting_grace_hour() {
    let game = clock().game;
    let rules = rules();
    crate::relics::assert_claim_window(
        game,
        rules,
        game.end_at + Into::<u32, u64>::into(rules.claim_window_seconds - crate::days::FRONTIER_REPORT_GRACE_SECONDS),
    );
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
    preset
        .economy
        .chests =
            Option::Some(ChestRules { claim_window_seconds: crate::days::FRONTIER_REPORT_GRACE_SECONDS, ..chests });
    crate::presets::validate(preset);
}

#[test]
#[feature("safe_dispatcher")]
fn publishing_a_pool_requires_the_current_operator_and_a_frontier_game() {
    let (d, game_id, _) = super::registrar::setup_unfunded_frontier_chests();
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    assert!(operator.publish_frontier_pool(game_id, 700000).is_err());
    super::entry::set_operator(d, super::authority());
    snforge_std::start_cheat_caller_address(d.games, d.actor);
    assert!(operator.publish_frontier_pool(game_id, 700000).is_err());
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    assert!(operator.publish_frontier_pool(game_id, 0).is_err());
    assert!(operator.publish_frontier_pool(9999, 700000).is_err());
    let other = super::registrar::setup();
    super::entry::set_operator(other, super::authority());
    snforge_std::start_cheat_caller_address(other.games, super::authority());
    assert!(ILedgerOperatorSafeDispatcher { contract_address: other.games }.publish_frontier_pool(1, 700000).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn the_published_deposit_is_per_game_immutable_and_emits_the_budget_fact() {
    let (d, game_id, _) = super::registrar::setup_unfunded_frontier_chests();
    let relics = IRelicsDispatcher { contract_address: d.games };
    assert_eq!(relics.lords_budget(game_id), None);
    let mut spy = snforge_std::spy_events();
    super::registrar::publish_test_pool(d, game_id, 700000, 0);
    let budget = relics.lords_budget(game_id).unwrap();
    assert_eq!((budget.pool, budget.pool_left, budget.open, budget.day), (700000, 700000, 0, 0));
    let events = spy.get_events().emitted_by(d.games);
    assert_eq!(events.events.len(), 1);
    for (_, event) in events.events.span() {
        assert_eq!(event.keys.span(), array![selector!("MapEvent"), selector!("RowSet"), 1, 'LordsBudget'].span());
        assert_eq!(
            event.data.span(),
            array![1, game_id.into(), 8, 700000, 700000, 0, 0, rules().price_ceiling.into(), 0, 0, 0].span(),
        );
    }
    assert_eq!(relics.lords_budget(game_id + 1), None);
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    let operator = ILedgerOperatorSafeDispatcher { contract_address: d.games };
    assert!(operator.publish_frontier_pool(game_id, 700000).is_err());
    assert!(operator.publish_frontier_pool(game_id, 900000).is_err());
    // Exhaustion cannot reopen publication.
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::state::write().relics.rollover_budget.write(game_id, Some(LordsBudget { pool_left: 0, ..budget }));
        },
    );
    assert!(operator.publish_frontier_pool(game_id, 700000).is_err());
    let (second, second_id, _) = super::registrar::setup_unfunded_frontier_chests();
    super::registrar::publish_test_pool(second, second_id, 230000, 0);
    assert_eq!(IRelicsDispatcher { contract_address: second.games }.lords_budget(second_id).unwrap().pool, 230000);
}

#[test]
fn late_publication_replaces_a_zero_budget_and_releases_elapsed_days() {
    let (d, game_id, _) = super::registrar::setup_unfunded_frontier_chests();
    let initial = super::context(d.games, game_id);
    let clock = SeasonClock {
        game: initial.game.unbox(),
        day_unit_seconds: initial.rules.unbox().day_unit_seconds,
        tick: initial.rules.unbox().tick_config.armies_tick_in_seconds,
    };
    let first = crate::days::day_of(clock.game, clock.day_unit_seconds, clock.game.start_main_at);
    let second = crate::days::day_of(clock.game, clock.day_unit_seconds, first.end);
    let timestamp = second.end;
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp, ..initial };
            let candidate = crate::logic::lords_budget::candidate(game_id, rules().shares, 7, context);
            assert!(!crate::logic::lords_budget::try_reserve(game_id, candidate, context));
            let budget = crate::logic::lords_budget::budget(game_id).unwrap();
            assert_eq!((budget.pool, budget.pool_left, budget.open), (0, 0, 0));
        },
    );
    super::registrar::publish_test_pool(d, game_id, 700000, timestamp);
    let budget = IRelicsDispatcher { contract_address: d.games }.lords_budget(game_id).unwrap();
    let today = crate::days::day_of(clock.game, clock.day_unit_seconds, timestamp);
    assert_eq!(budget.day, today.index);
    assert_eq!(
        (budget.price, budget.rolled_shares, budget.yesterday_shares, budget.yesterday_ticks),
        (rules().price_ceiling, 0, 0, 0),
    );
    let elapsed: u128 = (today.end - clock.game.start_main_at).into();
    let duration: u128 = (clock.game.end_at - clock.game.start_main_at).into();
    assert_eq!(available(budget, clock), 700000 * elapsed / duration);
    assert!(available(budget, clock) > unlocked(700000, clock, 0));
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp, ..initial };
            let candidate = crate::logic::lords_budget::candidate(game_id, rules().shares, 7, context);
            assert!(crate::logic::lords_budget::try_reserve(game_id, candidate, context));
        },
    );
}

#[test]
#[feature("safe_dispatcher")]
fn publication_refuses_at_the_season_end() {
    let (d, game_id, _) = super::registrar::setup_unfunded_frontier_chests();
    let game = super::context(d.games, game_id).game.unbox();
    super::entry::set_operator(d, super::authority());
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    snforge_std::start_cheat_block_timestamp(d.games, game.end_at);
    assert!(
        ILedgerOperatorSafeDispatcher { contract_address: d.games }.publish_frontier_pool(game_id, 700000).is_err(),
    );
}

#[test]
fn a_busy_yesterday_prices_today_by_its_exact_per_tick_rate() {
    let clock = clock();
    let rules = rules();
    let first = crate::days::day_of(clock.game, DAY_UNIT, 0);
    let second = crate::days::day_of(clock.game, DAY_UNIT, first.end);
    let previous = LordsBudget { rolled_shares: 10000, open: 500, ..empty_day(TEST_POOL, 0) };
    let today = roll(rules, previous, clock, 1);
    let yesterday_ticks = (first.end - first.start) / clock.tick;
    let today_ticks = (second.end - second.start) / clock.tick;
    let expected = available(today, clock) * yesterday_ticks.into() / (10000 * Into::<u64, u128>::into(today_ticks));
    assert_eq!((today.yesterday_shares, today.yesterday_ticks), (10000, yesterday_ticks));
    assert_eq!((today.open, today.rolled_shares), (0, 0));
    assert_eq!(today.price, core::cmp::max(1, expected));
    assert!(today.price < rules.price_ceiling);
    // The new day uses only yesterday, regardless of the older stored rate or price.
    let changed_history = LordsBudget { price: 1, yesterday_shares: 999999, yesterday_ticks: 1, ..previous };
    assert_eq!(roll(rules, changed_history, clock, 1), today);
}

#[test]
fn first_empty_untouched_and_unfunded_days_use_the_ceiling() {
    let rules = rules();
    let first = empty_day(TEST_POOL, 0);
    assert_eq!(first.price, rules.price_ceiling);
    let busy = LordsBudget { rolled_shares: 10000, ..first };
    let priced = roll(rules, busy, clock(), 1);
    assert!(priced.price < rules.price_ceiling);
    // A touched day with no ruin has no rate, even if the previous day was busy.
    let empty = roll(rules, priced, clock(), 2);
    assert_eq!((empty.price, empty.yesterday_shares, empty.yesterday_ticks), (rules.price_ceiling, 0, 0));
    for day in array![2, 100].span() {
        let skipped = roll(rules, busy, clock(), *day);
        assert_eq!((skipped.price, skipped.yesterday_shares, skipped.yesterday_ticks), (rules.price_ceiling, 0, 0));
    }
    let unfunded = LordsBudget { rolled_shares: 10000, ..empty_day(0, 0) };
    let later = roll(rules, unfunded, clock(), 1);
    assert_eq!((later.price, later.yesterday_shares, later.yesterday_ticks), (rules.price_ceiling, 0, 0));
    assert!(!fits(later, clock(), 1));
}

#[test]
fn sparse_rates_keep_fractional_shares_and_prices_stay_between_one_and_the_ceiling() {
    let rules = rules();
    let previous = LordsBudget { rolled_shares: 1, ..empty_day(TEST_POOL, 0) };
    let sparse = roll(rules, previous, clock(), 1);
    assert_eq!(sparse.yesterday_shares, 1);
    assert!(sparse.yesterday_ticks > 1);
    assert_eq!(sparse.price, rules.price_ceiling);
    let exhausted = LordsBudget { pool_left: 0, rolled_shares: 10000, ..previous };
    let minimum = roll(rules, exhausted, clock(), 1);
    assert_eq!(minimum.price, 1);
    assert!(!fits(minimum, clock(), minimum.price));
}

#[test]
fn partial_final_days_use_only_their_remaining_ticks() {
    let original = clock();
    let first = crate::days::day_of(original.game, DAY_UNIT, 0);
    let clock = SeasonClock {
        game: crate::game::GameRegistry { end_at: first.end + 2 * original.tick, ..original.game }, ..original,
    };
    let yesterday_ticks = (first.end - first.start) / clock.tick;
    let previous = LordsBudget { rolled_shares: 100000000, ..empty_day(TEST_POOL, 0) };
    let today = roll(rules(), previous, clock, 1);
    assert_eq!(today.price, TEST_POOL * yesterday_ticks.into() / (100000000 * 2));
}

#[test]
fn real_rolls_include_refusals_but_candidates_do_not_change_the_rate_or_price() {
    let (d, game_id, _) = super::registrar::setup_frontier_chests();
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp: 360, ..super::context(d.games, game_id) };
            let odds = crate::relics::ChestTiers { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 10000 };
            let before = crate::logic::lords_budget::budget(game_id).unwrap();
            let chest = crate::logic::lords_budget::candidate(game_id, odds, 5, context);
            assert_eq!(crate::logic::lords_budget::budget(game_id).unwrap(), before);
            assert!(crate::logic::lords_budget::try_reserve(game_id, chest, context));
            let reserved = crate::logic::lords_budget::budget(game_id).unwrap();
            let shares: u128 = rules().shares.legendary.into();
            assert_eq!(reserved.rolled_shares, shares);
            // Simulate an exhausted allowance; refusals must still inform tomorrow's demand.
            crate::state::write()
                .relics
                .rollover_budget
                .write(game_id, Some(LordsBudget { pool_left: 0, open: 0, ..reserved }));
            assert!(!crate::logic::lords_budget::try_reserve(game_id, chest, context));
            let refused = crate::logic::lords_budget::budget(game_id).unwrap();
            assert_eq!((refused.rolled_shares, refused.price), (2 * shares, before.price));
            crate::logic::lords_budget::return_to_pool(game_id, 100, context);
            assert_eq!(crate::logic::lords_budget::budget(game_id).unwrap().price, before.price);
        },
    );
}
