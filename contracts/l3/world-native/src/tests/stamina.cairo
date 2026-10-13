use crate::stamina::{SettledStamina, StaminaClock, StaminaTrait};
use crate::troops::{Stamina, TroopBoosts};
use crate::rules::TroopStaminaConfig;

fn rules(gain: u16) -> TroopStaminaConfig {
    TroopStaminaConfig { stamina_gain_per_tick: gain, stamina_initial: 35, ..super::play_fixture::rules().troop_stamina_config }
}
fn bar(amount: u64) -> Stamina {
    StaminaClock::pack(SettledStamina { amount, settled_at: 101, remainder: 0 })
}

#[test]
fn stamina_rates_are_one_per_two_three_or_120_seconds_and_boosted_blitz_is_three_per_four() {
    for (gain, period, seconds, percent, expected) in array![
        (30_u16, 60_u64, 2_u64, 0_u16, 1_u64), (20, 60, 3, 0, 1),
        (1, 120, 120, 0, 1), (30, 60, 4, 5000, 3),
    ] {
        let mut stamina = bar(0);
        let mut boosts = TroopBoosts {
            incr_stamina_regen_percent_num: percent, incr_stamina_regen_tick_count: 180, ..Default::default()
        };
        stamina.refill_to_max(ref boosts, 120, rules(gain), period, 102);
        assert_eq!(stamina.amount, 0);
        stamina.refill_to_max(ref boosts, 120, rules(gain), period, 101 + seconds);
        assert_eq!(stamina.amount, expected);
    }
}

#[test]
fn settling_once_or_in_any_partition_preserves_the_same_stamina_and_remainder() {
    for percent in array![0_u16, 3333, 5000, 10000] {
        for elapsed in 1_u64..138 {
            let mut once = bar(0);
            let mut repeated = once;
            let mut irregular = once;
            let mut once_boost = TroopBoosts {
                incr_stamina_regen_percent_num: percent, incr_stamina_regen_tick_count: 17, ..Default::default()
            };
            let mut repeated_boost = once_boost;
            let mut irregular_boost = once_boost;
            once.refill_to_max(ref once_boost, 120, rules(7), 60, 101 + elapsed);
            for now in 102..(102 + elapsed) {
                repeated.refill_to_max(ref repeated_boost, 120, rules(7), 60, now);
                if now % 7 == 0 {
                    irregular.refill_to_max(ref irregular_boost, 120, rules(7), 60, now);
                }
            }
            irregular.refill_to_max(ref irregular_boost, 120, rules(7), 60, 101 + elapsed);
            assert_eq!(once, repeated);
            assert_eq!(once, irregular);
            assert_eq!(once_boost, repeated_boost);
            assert_eq!(once_boost, irregular_boost);
        }
    }
}

#[test]
fn a_boost_starting_and_ending_inside_the_span_preserves_the_single_remainder() {
    let mut once = bar(0);
    let mut repeated = once;
    let mut once_boost: TroopBoosts = Default::default();
    let mut repeated_boost = once_boost;
    once.refill_to_max(ref once_boost, 120, rules(7), 60, 106);
    let rule = crate::relics::RelicRule { rate_bps: 3333, uses: 1, duration: 0, essence_cost: 0, draw_weight: 0 };
    crate::relics::boost_explorer(ref once_boost, 39, rule, 1, 60);
    once.refill_to_max(ref once_boost, 120, rules(7), 60, 180);
    for now in 102..181 {
        repeated.refill_to_max(ref repeated_boost, 120, rules(7), 60, now);
        if now == 106 {
            crate::relics::boost_explorer(ref repeated_boost, 39, rule, 1, 60);
        }
    }
    assert_eq!(once, repeated);
    assert_eq!(once_boost, repeated_boost);
    assert_eq!(once_boost.incr_stamina_regen_tick_count, 0);
    assert_eq!(once.amount, 11);
}

#[test]
fn a_full_bar_drops_its_remainder_and_an_unused_boost_expires() {
    let mut stamina = bar(119);
    let mut boosts = TroopBoosts {
        incr_stamina_regen_percent_num: 5000, incr_stamina_regen_tick_count: 3, ..Default::default()
    };
    stamina.refill_to_max(ref boosts, 120, rules(30), 60, 104);
    assert_eq!(StaminaClock::unpack(stamina), SettledStamina { amount: 120, settled_at: 104, remainder: 0 });
    stamina.refill_to_max(ref boosts, 120, rules(30), 60, 110);
    assert_eq!(boosts.incr_stamina_regen_tick_count, 0);
    stamina.amount = 0;
    stamina.refill_to_max(ref boosts, 120, rules(30), 60, 111);
    assert_eq!(stamina.amount, 0);
}

#[test]
fn adding_to_the_cap_drops_credit_and_a_never_initialized_bar_gets_its_initial_amount() {
    let mut stamina: Stamina = Default::default();
    let mut boosts: TroopBoosts = Default::default();
    stamina.refill_to_max(ref boosts, 120, rules(30), 60, 101);
    assert_eq!(stamina.amount, 35);
    stamina.add(ref boosts, 120, rules(30), 85, 60, 102);
    assert_eq!(StaminaClock::unpack(stamina), SettledStamina { amount: 120, settled_at: 102, remainder: 0 });
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
