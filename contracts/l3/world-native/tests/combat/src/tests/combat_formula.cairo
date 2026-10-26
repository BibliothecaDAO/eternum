pub use world_test_support::tests::combat_formula::*;


#[test]
fn ethereal_d20_adds_each_sides_roll_as_a_positive_damage_percentage() {
    let (base_outgoing, base_incoming) = dice_damage(0, 0);
    for roll in 1_u8..21 {
        let (outgoing, incoming) = dice_damage(roll, 0);
        let expected = base_outgoing * (100 + roll.into()) / 100;
        assert!(
            outgoing <= expected + RESOURCE_PRECISION && expected <= outgoing + RESOURCE_PRECISION,
            "attacker die percentage wrong",
        );
        assert_eq!(incoming, base_incoming);
        let (outgoing, incoming) = dice_damage(0, roll);
        let expected = base_incoming * (100 + roll.into()) / 100;
        assert!(
            incoming <= expected + RESOURCE_PRECISION && expected <= incoming + RESOURCE_PRECISION,
            "defender die percentage wrong",
        );
        assert_eq!(outgoing, base_outgoing);
    }
    let (outgoing, incoming) = dice_damage(1, 20);
    assert!(incoming > outgoing, "independent dice were not applied");
}

#[test]
fn the_rolls_decide_which_of_two_even_armies_deals_more_damage() {
    let (outgoing, incoming) = dice_damage(20, 1);
    assert!(outgoing > incoming, "the attacker's best roll should win the exchange");
    let (outgoing, incoming) = dice_damage(1, 20);
    assert!(outgoing < incoming, "the defender's best roll should win the exchange");
}

#[test]
#[should_panic(expected: "invalid combat die")]
fn combat_rejects_a_die_above_twenty() {
    dice_damage(21, 1);
}

#[test]
fn tests_troop_attack_simple_1() {
    let mut alpha = Troops {
        category: TroopType::Knight,
        tier: TroopTier::T1,
        count: 1 * RESOURCE_PRECISION,
        stamina: Stamina { amount: 100, settled_at: 1, remainder: 0 }.into(),
        boosts: troop_boosts(),
        battle_cooldown_end: 0,
    };
    let mut bravo = Troops {
        category: TroopType::Paladin,
        tier: TroopTier::T1,
        count: 95_000 * RESOURCE_PRECISION,
        stamina: Stamina { amount: 100, settled_at: 1, remainder: 0 }.into(),
        boosts: troop_boosts(),
        battle_cooldown_end: 0,
    };

    alpha.attack_with_context(ref bravo, context(Biome::DeepOcean), stamina_config(), damage_config(), 1, 1);

    assert_eq!(alpha.count, 0);
    assert_eq!(bravo.count, 95_000 * RESOURCE_PRECISION);
}

#[test]
fn tests_troop_attack_simple_2() {
    let mut alpha = Troops {
        category: TroopType::Knight,
        tier: TroopTier::T2, // Tier 2
        count: 61_293 * RESOURCE_PRECISION,
        stamina: Stamina { amount: 100, settled_at: 1, remainder: 0 }.into(),
        boosts: troop_boosts(),
        battle_cooldown_end: 0,
    };
    let mut bravo = Troops {
        category: TroopType::Crossbowman,
        tier: TroopTier::T1, // Tier 1
        count: 159_303 * RESOURCE_PRECISION,
        stamina: Stamina { amount: 100, settled_at: 1, remainder: 0 }.into(),
        boosts: troop_boosts(),
        battle_cooldown_end: 0,
    };

    alpha.attack_with_context(ref bravo, context(Biome::DeepOcean), stamina_config(), damage_config(), 1, 1);

    assert_eq!(alpha.count, 40_079 * RESOURCE_PRECISION);
    assert_eq!(bravo.count, 120_061 * RESOURCE_PRECISION);
}

#[test]
fn tests_crossbowman_ranged_field_attack_uses_reduced_damage() {
    let mut adjacent_alpha = test_troops(TroopType::Crossbowman, TroopTier::T2, 1_000, 100);
    let mut adjacent_bravo = test_troops(TroopType::Knight, TroopTier::T2, 1_000, 100);
    let mut ranged_alpha = test_troops(TroopType::Crossbowman, TroopTier::T2, 1_000, 100);
    let mut ranged_bravo = test_troops(TroopType::Knight, TroopTier::T2, 1_000, 100);

    adjacent_alpha
        .attack_with_context(
            ref adjacent_bravo,
            CombatContext {
                timestamp: 1,
                attacker_roll: 0,
                defender_roll: 0,
                attacker_biome: Biome::Taiga,
                defender_biome: Biome::Taiga,
                attack_distance: 1,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: false,
            },
            stamina_config(),
            damage_config(),
            1,
            1,
        );
    ranged_alpha
        .attack_with_context(
            ref ranged_bravo,
            CombatContext {
                timestamp: 1,
                attacker_roll: 0,
                defender_roll: 0,
                attacker_biome: Biome::Taiga,
                defender_biome: Biome::Taiga,
                attack_distance: 2,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: false,
            },
            stamina_config(),
            damage_config(),
            1,
            1,
        );

    assert!(
        ranged_alpha
            ._ranged_crossbow_damage_multiplier(
                CombatContext { attack_distance: 2, ..context(Biome::Taiga) },
            ) == FixedTrait::new(70, false)
            / FixedTrait::new(100, false),
    );
    assert!(ranged_bravo.count > adjacent_bravo.count, "Ranged field attack should deal reduced damage");
    assert!(ranged_alpha.count == 1_000 * RESOURCE_PRECISION, "Ranged defender should not counter-damage attacker");
    assert!(ranged_bravo.stamina.inline().amount == 80, "Ranged defender should spend reduced defensive stamina");
}

#[test]
fn tests_crossbowman_ranged_structure_attack_uses_heavy_reduction() {
    let mut field_alpha = test_troops(TroopType::Crossbowman, TroopTier::T2, 1_000, 100);
    let mut field_bravo = test_troops(TroopType::Paladin, TroopTier::T2, 1_000, 100);
    let mut structure_alpha = test_troops(TroopType::Crossbowman, TroopTier::T2, 1_000, 100);
    let mut structure_bravo = test_troops(TroopType::Paladin, TroopTier::T2, 1_000, 100);

    field_alpha
        .attack_with_context(
            ref field_bravo,
            CombatContext {
                timestamp: 1,
                attacker_roll: 0,
                defender_roll: 0,
                attacker_biome: Biome::Taiga,
                defender_biome: Biome::Taiga,
                attack_distance: 2,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: false,
            },
            stamina_config(),
            damage_config(),
            1,
            1,
        );
    structure_alpha
        .attack_with_context(
            ref structure_bravo,
            CombatContext {
                timestamp: 1,
                attacker_roll: 0,
                defender_roll: 0,
                attacker_biome: Biome::Taiga,
                defender_biome: Biome::Taiga,
                attack_distance: 2,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: true,
            },
            stamina_config(),
            damage_config(),
            1,
            1,
        );

    assert!(
        structure_alpha
            ._ranged_crossbow_damage_multiplier(
                CombatContext { attack_distance: 2, defender_is_structure_guard: true, ..context(Biome::Taiga) },
            ) == FixedTrait::new(30, false)
            / FixedTrait::new(100, false),
    );
    assert!(structure_bravo.count > field_bravo.count, "Ranged structure attack should deal less damage");
}

#[test]
fn tests_knight_assault_increases_adjacent_structure_guard_damage() {
    let mut field_alpha = test_troops(TroopType::Knight, TroopTier::T2, 1_000, 100);
    let mut field_bravo = test_troops(TroopType::Crossbowman, TroopTier::T2, 1_000, 100);
    let mut guard_alpha = test_troops(TroopType::Knight, TroopTier::T2, 1_000, 100);
    let mut guard_bravo = test_troops(TroopType::Crossbowman, TroopTier::T2, 1_000, 100);

    field_alpha.attack_with_context(ref field_bravo, context(Biome::Taiga), stamina_config(), damage_config(), 1, 1);
    guard_alpha
        .attack_with_context(
            ref guard_bravo,
            CombatContext {
                timestamp: 1,
                attacker_roll: 0,
                defender_roll: 0,
                attacker_biome: Biome::Taiga,
                defender_biome: Biome::Taiga,
                attack_distance: 1,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: true,
            },
            stamina_config(),
            damage_config(),
            1,
            1,
        );

    assert!(
        guard_alpha
            ._knight_structure_assault_multiplier(
                CombatContext { defender_is_structure_guard: true, ..context(Biome::Taiga) },
            ) == FixedTrait::new(115, false)
            / FixedTrait::new(100, false),
    );
    assert!(guard_bravo.count < field_bravo.count, "Knight assault should increase guard damage");
}

#[test]
fn tests_knight_bulwark_reduces_guard_incoming_damage() {
    let mut field_alpha = test_troops(TroopType::Paladin, TroopTier::T2, 1_000, 100);
    let mut field_bravo = test_troops(TroopType::Knight, TroopTier::T2, 1_000, 100);
    let mut guard_alpha = test_troops(TroopType::Paladin, TroopTier::T2, 1_000, 100);
    let mut guard_bravo = test_troops(TroopType::Knight, TroopTier::T2, 1_000, 100);

    field_alpha.attack_with_context(ref field_bravo, context(Biome::Taiga), stamina_config(), damage_config(), 1, 1);
    guard_alpha
        .attack_with_context(
            ref guard_bravo,
            CombatContext {
                timestamp: 1,
                attacker_roll: 0,
                defender_roll: 0,
                attacker_biome: Biome::Taiga,
                defender_biome: Biome::Taiga,
                attack_distance: 1,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: true,
            },
            stamina_config(),
            damage_config(),
            1,
            1,
        );

    assert!(guard_bravo._incoming_damage_multiplier(true) == FixedTrait::new(85, false) / FixedTrait::new(100, false));
    assert!(guard_bravo.count > field_bravo.count, "Knight guard should receive reduced incoming damage");
}

#[test]
fn an_exchange_without_a_capture_spends_the_full_attack_stamina() {
    for count in array![1_u128, 10000] {
        let mut attacker = test_troops(TroopType::Knight, TroopTier::T1, count, 120);
        let mut defender = test_troops(TroopType::Knight, TroopTier::T1, 10000, 120);
        let config = TroopStaminaConfig {
            damage_stamina_refund: false, capture_stamina_refund: 25, ..stamina_config(),
        };
        attacker.attack_with_context(ref defender, context(Biome::Underground), config, damage_config(), 1, 1);
        assert!(defender.count != 0);
        assert_eq!(attacker.stamina.inline().amount, 70);
    }
}

#[test]
fn combat_relics_change_casualties_for_their_full_window_and_replace_on_reapplication() {
    for id in array![41_u8, 43] {
        for replace in array![false, true] {
            let mut boosted = test_troops(TroopType::Knight, TroopTier::T2, 10000, 120);
            let rule = crate::relics::RelicRule {
                duration: 3, rate_bps: 5000, uses: 0, essence_cost: 0, draw_weight: 0,
            };
            crate::relics::boost_explorer(ref boosted.boosts, id, rule, 47, 10);
            let end = if replace {
                crate::relics::boost_explorer(
                    ref boosted.boosts, id, crate::relics::RelicRule { duration: 1, ..rule }, 52, 10,
                );
                62_u64
            } else {
                77
            };
            for now in array![end - 1, end] {
                let plain = test_troops(TroopType::Knight, TroopTier::T2, 10000, 120);
                let mut attacker = if id == 41 {
                    boosted
                } else {
                    plain
                };
                let mut defender = if id == 43 {
                    boosted
                } else {
                    plain
                };
                let mut plain_attacker = plain;
                let mut plain_defender = plain;
                let battle = CombatContext { timestamp: now, ..context(Biome::Underground) };
                attacker.attack_with_context(ref defender, battle, stamina_config(), damage_config(), 60, 60);
                plain_attacker
                    .attack_with_context(ref plain_defender, battle, stamina_config(), damage_config(), 60, 60);
                if now == end {
                    assert_eq!(defender.count, plain_defender.count);
                    assert_eq!(attacker.count, plain_attacker.count);
                } else if id == 41 {
                    assert!(defender.count < plain_defender.count, "active damage relic must increase casualties");
                } else {
                    assert!(defender.count > plain_defender.count, "active defence relic must reduce casualties");
                }
            }
        }
    }
}
