use snforge_std::fs::{FileTrait, read_txt};
pub use world_test_support::tests::combat_formula::*;

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
fn combat_boosts_change_casualties_until_their_end_time() {
    for damage in array![true, false] {
        let mut boosted = test_troops(TroopType::Knight, TroopTier::T2, 10000, 120);
        if damage {
            boosted.boosts.incr_damage_dealt_percent_num = 5000;
            boosted.boosts.incr_damage_dealt_end_at = 77;
        } else {
            boosted.boosts.decr_damage_gotten_percent_num = 5000;
            boosted.boosts.decr_damage_gotten_end_at = 77;
        }
        for now in array![76_u64, 77] {
            let plain = test_troops(TroopType::Knight, TroopTier::T2, 10000, 120);
            let mut attacker = if damage {
                boosted
            } else {
                plain
            };
            let mut defender = if damage {
                plain
            } else {
                boosted
            };
            let mut plain_attacker = plain;
            let mut plain_defender = plain;
            let battle = CombatContext { timestamp: now, ..context(Biome::Underground) };
            attacker.attack_with_context(ref defender, battle, stamina_config(), damage_config(), 60, 60);
            plain_attacker.attack_with_context(ref plain_defender, battle, stamina_config(), damage_config(), 60, 60);
            if now == 77 {
                assert_eq!(defender.count, plain_defender.count);
                assert_eq!(attacker.count, plain_attacker.count);
            } else if damage {
                assert!(defender.count < plain_defender.count, "an active damage boost must increase casualties");
            } else {
                assert!(defender.count > plain_defender.count, "an active defence boost must reduce casualties");
            }
        }
    }
}

#[test]
fn frontier_knights_take_less_damage_in_guard_slots_even_without_stamina() {
    let damage = TroopDamageConfig {
        damage_scaling_factor: 36893488147419103232, damage_biome_bonus_num: 0, ..damage_config(),
    };
    let stamina = TroopStaminaConfig { damage_stamina_refund: false, ..stamina_config() };
    for attacker_is_structure_guard in array![false, true] {
        for defender_is_structure_guard in array![false, true] {
            for defender_stamina in array![0_u64, 100] {
                let mut attacker = test_troops(TroopType::Knight, TroopTier::T1, 1500, 100);
                let mut defender = test_troops(TroopType::Knight, TroopTier::T1, 1000, defender_stamina);
                attacker
                    .attack_with_context(
                        ref defender,
                        CombatContext {
                            attacker_is_structure_guard, defender_is_structure_guard, ..context(Biome::Underground),
                        },
                        stamina,
                        damage,
                        120,
                        0,
                    );
                assert_eq!(
                    attacker.count, (1500 - if attacker_is_structure_guard {
                        314
                    } else {
                        418
                    }) * RESOURCE_PRECISION,
                );
                assert_eq!(
                    defender.count, (1000 - if defender_is_structure_guard {
                        471
                    } else {
                        627
                    }) * RESOURCE_PRECISION,
                );
                assert_eq!(attacker.stamina.inline().amount, 50);
                assert_eq!(defender.stamina.inline().amount, if defender_stamina == 0 {
                    0
                } else {
                    60
                });
            }
        }
    }
}

#[test]
fn scouts_deal_three_quarters_damage_on_either_side() {
    let damage = TroopDamageConfig {
        damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232, ..damage_config(),
    };
    for (attacker, outgoing) in array![(TroopType::Knight, 437_u128), (TroopType::Paladin, 328)] {
        for (defender, incoming) in array![(TroopType::Knight, 437_u128), (TroopType::Paladin, 328)] {
            let mut alpha = test_troops(attacker, TroopTier::T1, 1000, 100);
            let mut bravo = test_troops(defender, TroopTier::T1, 1000, 100);
            let (dealt, taken, _, _) = alpha
                .damage_with_context(ref bravo, context(Biome::Grassland), stamina_config(), damage, 1, 0);
            assert_eq!(dealt, outgoing * RESOURCE_PRECISION);
            assert_eq!(taken, incoming * RESOURCE_PRECISION);
        }
    }
}

#[test]
fn wipeout_and_zero_damage_have_defined_refunds_and_cooldowns() {
    let damage = TroopDamageConfig {
        damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232, ..damage_config(),
    };
    let stamina = TroopStaminaConfig {
        stamina_gain_per_tick: 0,
        stamina_attack_req: 10,
        stamina_defense_req: 20,
        damage_stamina_refund: true,
        ..stamina_config(),
    };
    let context = context(Biome::Grassland);
    for shielded in array![false, true] {
        let mut attacker = test_troops(TroopType::Knight, TroopTier::T1, 1000, 100);
        let mut defender = test_troops(TroopType::Knight, TroopTier::T1, 1, 100);
        if shielded {
            attacker.boosts.decr_damage_gotten_percent_num = 10000;
            defender.boosts.decr_damage_gotten_percent_num = 10000;
        }
        attacker.attack_with_context(ref defender, context, stamina, damage, 1, 100);
        assert_eq!(attacker.count, (if shielded {
            1000
        } else {
            999
        }) * RESOURCE_PRECISION);
        assert_eq!(defender.count, if shielded {
            RESOURCE_PRECISION
        } else {
            0
        });
        assert_eq!(attacker.stamina.inline().amount, if shielded {
            90
        } else {
            100
        });
        assert_eq!(defender.stamina.inline().amount, 80);
        let now: u32 = context.timestamp.try_into().unwrap();
        assert_eq!(attacker.battle_cooldown_end, now + if shielded {
            100
        } else {
            0
        });
        assert_eq!(defender.battle_cooldown_end, now + 100);
    }
}

#[test]
fn frontier_bows_hit_before_blades_on_every_attack_and_both_bows_fire_together() {
    let damage = TroopDamageConfig {
        damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232, ..damage_config(),
    };
    let stamina = TroopStaminaConfig { damage_stamina_refund: false, stamina_attack_req: 30, ..stamina_config() };
    for (a, b, dealt, taken) in array![
        (TroopType::Crossbowman, TroopType::Knight, 328_u128, 294_u128),
        (TroopType::Knight, TroopType::Crossbowman, 294, 328), (TroopType::Crossbowman, TroopType::Paladin, 328, 220),
        (TroopType::Paladin, TroopType::Crossbowman, 220, 328),
        (TroopType::Crossbowman, TroopType::Crossbowman, 328, 328),
    ] {
        let mut attacker = test_troops(a, TroopTier::T1, 1000, 100);
        let mut defender = test_troops(b, TroopTier::T1, 1000, 100);
        let battle = context(Biome::Underground);
        attacker.attack_with_context(ref defender, battle, stamina, damage, 120, 0);
        assert_eq!(attacker.count, (1000 - taken) * RESOURCE_PRECISION);
        assert_eq!(defender.count, (1000 - dealt) * RESOURCE_PRECISION);
        assert_eq!(attacker.stamina.inline().amount, 70);
        let before_a = attacker.count;
        let before_b = defender.count;
        attacker.attack_with_context(ref defender, battle, stamina, damage, 120, 0);
        assert!(attacker.count < before_a && defender.count < before_b);
        assert_eq!(attacker.stamina.inline().amount, 40);
    }
}

#[test]
fn a_blade_killed_by_the_first_shot_never_replies() {
    let damage = TroopDamageConfig {
        damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232, ..damage_config(),
    };
    for bow_attacks in array![false, true] {
        let mut bow = test_troops(TroopType::Crossbowman, TroopTier::T1, 1000, 100);
        let mut blade = test_troops(TroopType::Knight, TroopTier::T1, 1, 100);
        let battle = context(Biome::Underground);
        if bow_attacks {
            bow.attack_with_context(ref blade, battle, stamina_config(), damage, 120, 0);
        } else {
            blade.attack_with_context(ref bow, battle, stamina_config(), damage, 120, 0);
        }
        assert_eq!(bow.count, 1000 * RESOURCE_PRECISION);
        assert_eq!(blade.count, 0);
    }
}

#[test]
fn frontier_bow_exchanges_match_the_browser_receipts_against_a_beast_and_a_knight_slot() {
    let values = read_txt(@FileTrait::new("../fixtures/frontier-marks.txt"));
    let mut fields = values.span();
    let damage = TroopDamageConfig {
        damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232, ..damage_config(),
    };
    let stamina = TroopStaminaConfig {
        damage_stamina_refund: false,
        stamina_attack_req: 10,
        stamina_defense_req: 0,
        stamina_gain_per_tick: 0,
        ..stamina_config(),
    };
    for defender_is_structure_guard in array![false, true] {
        let mut attacker = test_troops(TroopType::Crossbowman, TroopTier::T1, 1000, 100);
        let mut defender = test_troops(TroopType::Knight, TroopTier::T1, 1000, 100);
        for attack_number in array![1_u64, 2] {
            let (before_a, before_b, after_a, after_b): (u128, u128, u128, u128) = Serde::deserialize(ref fields)
                .unwrap();
            assert_eq!(attacker.count, before_a * RESOURCE_PRECISION);
            assert_eq!(defender.count, before_b * RESOURCE_PRECISION);
            attacker
                .attack_with_context(
                    ref defender,
                    CombatContext { defender_is_structure_guard, ..context(Biome::Underground) },
                    stamina,
                    damage,
                    120,
                    0,
                );
            assert_eq!(attacker.count, after_a * RESOURCE_PRECISION);
            assert_eq!(defender.count, after_b * RESOURCE_PRECISION);
            assert_eq!(attacker.stamina.inline().amount, 100 - attack_number * 10);
        }
    }
    assert!(fields.is_empty());
}

#[test]
fn oath_damage_matches_the_shared_vectors_for_both_sides_and_guard_roles() {
    let values = read_txt(@FileTrait::new("../fixtures/oath-damage.txt"));
    let mut fields = values.span();
    assert_eq!(fields.len(), 280);
    let damage = TroopDamageConfig {
        damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232, ..damage_config(),
    };
    let stamina = TroopStaminaConfig {
        damage_stamina_refund: false,
        stamina_attack_req: 10,
        stamina_defense_req: 0,
        stamina_gain_per_tick: 0,
        ..stamina_config(),
    };
    while !fields.is_empty() {
        let (
            a, b, attacker_oaths, defender_oaths, attacker_is_structure_guard, defender_is_structure_guard,
        ): (TroopType, TroopType, u16, u16, bool, bool) =
            Serde::deserialize(
            ref fields,
        )
            .unwrap();
        let (before_a, before_b, after_a, after_b): (u128, u128, u128, u128) = Serde::deserialize(ref fields).unwrap();
        let mut attacker = test_troops(a, TroopTier::T1, before_a, 100);
        let mut defender = test_troops(b, TroopTier::T1, before_b, 100);
        attacker
            .attack_with_context(
                ref defender,
                CombatContext {
                    attacker_oaths,
                    defender_oaths,
                    attacker_is_structure_guard,
                    defender_is_structure_guard,
                    ..context(Biome::Underground),
                },
                stamina,
                damage,
                120,
                0,
            );
        assert_eq!(attacker.count, after_a * RESOURCE_PRECISION);
        assert_eq!(defender.count, after_b * RESOURCE_PRECISION);
        assert_eq!(attacker.stamina.inline().amount, 90);
        assert_eq!(defender.stamina.inline().amount, 100);
    }
}

#[test]
fn the_twins_add_the_shared_vectors_share_of_the_companion_damage_in_whole_troops() {
    let values = read_txt(@FileTrait::new("../fixtures/oath-twins.txt"));
    let mut fields = values.span();
    assert_eq!(fields.len(), 54);
    let (stamina, damage) = oath_fight_configs();
    while !fields.is_empty() {
        let (attacker_oaths, a, b, c): (u16, TroopType, TroopType, TroopType) = Serde::deserialize(ref fields).unwrap();
        let (before_a, before_b, companion, after_a, after_b): (u128, u128, u128, u128, u128) = Serde::deserialize(
            ref fields,
        )
            .unwrap();
        let mut attacker = test_troops(a, TroopTier::T1, before_a, 100);
        let mut defender = test_troops(b, TroopTier::T1, before_b, 100);
        let combat = CombatContext { attacker_oaths, ..context(Biome::Underground) };
        let twin = crate::oaths::twin_damage(
            attacker_oaths, test_troops(c, TroopTier::T1, companion, 100), defender, combat, stamina, damage, 120, 0,
        );
        attacker
            .attack_with_context(
                ref defender, CombatContext { attacker_twin_damage: twin, ..combat }, stamina, damage, 120, 0,
            );
        assert_eq!(attacker.count, after_a * RESOURCE_PRECISION);
        assert_eq!(defender.count, after_b * RESOURCE_PRECISION);
    }
}

fn oath_fight_configs() -> (TroopStaminaConfig, TroopDamageConfig) {
    (
        TroopStaminaConfig {
            damage_stamina_refund: false,
            stamina_attack_req: 10,
            stamina_defense_req: 0,
            stamina_gain_per_tick: 0,
            ..stamina_config(),
        },
        TroopDamageConfig { damage_biome_bonus_num: 0, damage_scaling_factor: 36893488147419103232, ..damage_config() },
    )
}

fn oath_attack(attacker_oaths: u16, bar: u64, defenders: u128) -> (Troops, Troops) {
    let (stamina, damage) = oath_fight_configs();
    let mut attacker = test_troops(TroopType::Knight, TroopTier::T1, 1000, bar);
    let mut defender = test_troops(TroopType::Knight, TroopTier::T1, defenders, 100);
    attacker
        .attack_with_context(
            ref defender, CombatContext { attacker_oaths, ..context(Biome::Underground) }, stamina, damage, 120, 0,
        );
    (attacker, defender)
}

#[test]
fn skill_deals_more_only_on_the_attack_that_leaves_the_bar_under_ten() {
    let skill = crate::oaths::bit(crate::oaths::SKILL);
    let (_, plain) = oath_attack(0, 19, 1000);
    let (_, at_ten) = oath_attack(skill, 20, 1000);
    let (_, at_nine) = oath_attack(skill, 19, 1000);
    assert_eq!(at_ten.count, plain.count);
    assert!(at_nine.count < plain.count);
}

#[test]
fn fury_gives_back_half_the_cost_of_an_attack_that_beats_its_target() {
    let fury = crate::oaths::bit(crate::oaths::FURY);
    for (oaths, defenders, left) in array![(fury, 1_u128, 95_u64), (0, 1, 90), (fury, 1000, 90)] {
        let (attacker, _) = oath_attack(oaths, 100, defenders);
        assert_eq!(attacker.stamina.inline().amount, left);
    }
}
