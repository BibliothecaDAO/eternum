pub use world_test_support::tests::stamina::*;


#[test]
fn stamina_rates_are_one_per_two_three_or_120_seconds_and_boosted_blitz_is_three_per_four() {
    for (gain, period, seconds, percent, expected) in array![
        (30_u16, 60_u64, 2_u64, 0_u16, 1_u64), (20, 60, 3, 0, 1), (1, 120, 120, 0, 1), (30, 60, 4, 5000, 3),
    ] {
        let mut stamina = bar(0);
        let mut boosts = TroopBoosts {
            incr_stamina_regen_percent_num: percent, incr_stamina_regen_seconds_left: 180, ..Default::default(),
        };
        stamina.refill_to_max(ref boosts, 120, rules(gain), period, 102);
        assert_eq!(stamina.amount, 0);
        stamina.refill_to_max(ref boosts, 120, rules(gain), period, 101 + seconds);
        assert_eq!(stamina.amount, expected);
    }
}

#[test]
fn settling_once_or_in_any_partition_pays_the_same_stamina() {
    let config = rules(7);
    for percent in array![0_u16, 3333, 5000, 10000] {
        let initial = bar(0);
        let boost = TroopBoosts {
            incr_stamina_regen_percent_num: percent, incr_stamina_regen_seconds_left: 17, ..Default::default(),
        };
        let mut repeated = initial;
        let mut irregular = initial;
        let mut repeated_boost = boost;
        let mut irregular_boost = boost;
        for now in 102_u64..239 {
            let mut once = initial;
            let mut once_boost = boost;
            once.refill_to_max(ref once_boost, 120, config, 60, now);
            repeated.refill_to_max(ref repeated_boost, 120, config, 60, now);
            if now % 7 == 0 {
                irregular.refill_to_max(ref irregular_boost, 120, config, 60, now);
            }
            let mut observed = irregular;
            let mut observed_boost = irregular_boost;
            observed.refill_to_max(ref observed_boost, 120, config, 60, now);
            assert_eq!(once.amount, repeated.amount);
            assert_eq!(once.amount, observed.amount);
        }
    }
}

#[test]
fn a_boost_starting_and_ending_inside_the_span_pays_the_same_stamina() {
    let mut once = bar(0);
    let mut repeated = once;
    let mut once_boost: TroopBoosts = Default::default();
    let mut repeated_boost = once_boost;
    once.refill_to_max(ref once_boost, 120, rules(7), 60, 106);
    let rule = crate::relics::RelicRule { rate_bps: 3333, uses: 1, duration: 0, essence_cost: 0, draw_weight: 0 };
    crate::relics::boost_explorer(ref once_boost, 39, rule, 1, 60);
    once.refill_to_max(ref once_boost, 120, rules(7), 60, 180);
    for now in 102_u64..181 {
        repeated.refill_to_max(ref repeated_boost, 120, rules(7), 60, now);
        if now == 106 {
            crate::relics::boost_explorer(ref repeated_boost, 39, rule, 1, 60);
        }
    }
    assert_eq!(once.amount, repeated.amount);
    assert_eq!(once.amount, 11);
    let config = rules(7);
    for now in 181_u64..241 {
        once.refill_to_max(ref once_boost, 120, config, 60, now);
        repeated.refill_to_max(ref repeated_boost, 120, config, 60, now);
        assert_eq!(once.amount, repeated.amount);
    }
    assert_eq!(once.amount, 18);
}

#[test]
fn a_full_bar_never_banks_stamina_or_an_unused_boost() {
    let config = rules(30);
    let mut stamina = bar(119);
    let mut boosts = TroopBoosts {
        incr_stamina_regen_percent_num: 5000, incr_stamina_regen_seconds_left: 180, ..Default::default(),
    };
    stamina.refill_to_max(ref boosts, 120, config, 60, 106);
    assert_eq!(stamina.amount, 120);
    stamina
        .spend(ref boosts, crate::troops::TroopType::Knight, crate::troops::TroopTier::T1, config, 120, 60, 106, true);
    stamina.refill_to_max(ref boosts, 120, config, 60, 107);
    assert_eq!(stamina.amount, 0);
    stamina.refill_to_max(ref boosts, 120, config, 60, 108);
    assert_eq!(stamina.amount, 1);

    let mut unused = bar(120);
    let mut unused_boost = TroopBoosts {
        incr_stamina_regen_percent_num: 5000, incr_stamina_regen_seconds_left: 3, ..Default::default(),
    };
    unused.refill_to_max(ref unused_boost, 120, config, 60, 110);
    unused
        .spend(
            ref unused_boost,
            crate::troops::TroopType::Knight,
            crate::troops::TroopTier::T1,
            config,
            120,
            60,
            110,
            true,
        );
    for (now, amount) in array![(111_u64, 0_u64), (112, 1), (113, 1), (114, 2)] {
        unused.refill_to_max(ref unused_boost, 120, config, 60, now);
        assert_eq!(unused.amount, amount);
    }
}

#[test]
fn adding_to_the_cap_drops_credit_and_a_never_initialized_bar_gets_its_initial_amount() {
    let mut stamina: Stamina = Default::default();
    let mut boosts: TroopBoosts = Default::default();
    stamina.refill_to_max(ref boosts, 120, rules(30), 60, 101);
    assert_eq!(stamina.amount, 35);
    stamina.add(ref boosts, 120, rules(30), 85, 60, 102);
    assert_eq!(stamina.amount, 120);
    stamina
        .spend(
            ref boosts, crate::troops::TroopType::Knight, crate::troops::TroopTier::T1, rules(30), 120, 60, 102, true,
        );
    stamina.refill_to_max(ref boosts, 120, rules(30), 60, 103);
    assert_eq!(stamina.amount, 0);
    stamina.refill_to_max(ref boosts, 120, rules(30), 60, 104);
    assert_eq!(stamina.amount, 1);
}

#[test]
#[should_panic(expected: "stamina remainder overflow")]
fn a_preset_cannot_overflow_the_carried_remainder() {
    let (_, definition) = super::preset_projection::current_definition("blitz");
    let mut preset = definition;
    preset.rules.tick_config.armies_tick_in_seconds = 429497;
    crate::presets::validate(preset);
}

#[test]
#[should_panic(expected: "stamina boost duration overflow")]
fn a_preset_cannot_overflow_boosted_seconds() {
    let (_, definition) = super::preset_projection::current_definition("blitz");
    let mut preset = definition;
    preset.rules.tick_config.armies_tick_in_seconds = 30000;
    crate::presets::validate(preset);
}

#[test]
fn inline_army_actions_settle_the_bar_before_costs_and_refunds() {
    let mut source: crate::troops::StaminaSource = bar(10).into();
    let mut boosts: TroopBoosts = Default::default();
    source.refill(ref boosts, crate::troops::TroopType::Knight, crate::troops::TroopTier::T1, rules(30), 60, 103);
    assert_eq!(source.inline().amount, 11);
    source
        .spend(ref boosts, crate::troops::TroopType::Knight, crate::troops::TroopTier::T1, rules(30), 4, 60, 105, true);
    assert_eq!(source.inline().amount, 8);
    source.add(ref boosts, 120, rules(30), 2, 60, 107);
    assert_eq!(source.inline().amount, 11);
    source.reset();
    source.grant_initial_amount(rules(30), 109);
    assert_eq!(source.inline().amount, 35);
    source.set_amount(40);
    source.revert_initial_amount(rules(30), 110);
    assert_eq!(source.inline().amount, 35);
}
