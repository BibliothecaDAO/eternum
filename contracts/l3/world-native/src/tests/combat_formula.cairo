use eternum_cubit::f128::types::fixed::FixedTrait;
use crate::biome::Biome;
use crate::combat::{CombatContext, TroopsTrait};
use crate::rules::{RESOURCE_PRECISION, TroopDamageConfig, TroopStaminaConfig};
use crate::stamina::StaminaSourceTrait;
use crate::troops::{Stamina, TroopBoosts, TroopTier, TroopType, Troops};

fn context(biome: Biome) -> CombatContext {
    CombatContext {
        timestamp: 1,
        attacker_roll: 0,
        defender_roll: 0,
        attacker_biome: biome,
        defender_biome: biome,
        attack_distance: 1,
        attacker_is_structure_guard: false,
        defender_is_structure_guard: false,
    }
}

const KNIGHT_MAX_STAMINA: u16 = 120;
const CROSSBOWMAN_MAX_STAMINA: u16 = 120;
const PALADIN_MAX_STAMINA: u16 = 140;

fn damage_config() -> TroopDamageConfig {
    TroopDamageConfig {
        t1_damage_value: 1844674407370955161600, // 100
        t2_damage_multiplier: 46116860184273879040, // 2.5
        t3_damage_multiplier: 129127208515966861312, // 7
        damage_biome_bonus_num: 3_000, // 30%
        damage_scaling_factor: 55340232221128654848, // 3
        damage_raid_percent_num: 5,
    }
}

fn stamina_config() -> TroopStaminaConfig {
    TroopStaminaConfig {
        stamina_gain_per_tick: 30,
        stamina_initial: 20,
        stamina_bonus_value: 10, // flat bonus stamina from biome advantage
        stamina_knight_max: KNIGHT_MAX_STAMINA,
        stamina_paladin_max: PALADIN_MAX_STAMINA,
        stamina_crossbowman_max: CROSSBOWMAN_MAX_STAMINA,
        stamina_attack_req: 50,
        stamina_defense_req: 40,
        stamina_explore_wheat_cost: 780,
        stamina_explore_fish_cost: 440,
        stamina_explore_stamina_cost: 30, // 30 stamina per hex
        stamina_travel_wheat_cost: 234,
        stamina_travel_fish_cost: 885,
        stamina_travel_stamina_cost: 20, // 20 stamina per hex
        damage_stamina_refund: true,
        capture_stamina_refund: 0,
    }
}

fn troop_boosts() -> TroopBoosts {
    TroopBoosts {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_tick_count: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
    }
}

fn dice_damage(attacker_roll: u8, defender_roll: u8) -> (u128, u128) {
    let mut attacker = test_troops(TroopType::Knight, TroopTier::T2, 10000, 100);
    let mut defender = test_troops(TroopType::Knight, TroopTier::T2, 10000, 100);
    let (outgoing, incoming, _, _) = attacker
        .damage_with_context(
            ref defender,
            CombatContext {
                timestamp: 1,
                attacker_roll,
                defender_roll,
                attacker_biome: Biome::Underground,
                defender_biome: Biome::Underground,
                attack_distance: 1,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: false,
            },
            stamina_config(),
            damage_config(),
            1,
            1,
        );
    (outgoing, incoming)
}

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
        stamina: Stamina { amount: 100, updated_tick: 1 }.into(),
        boosts: troop_boosts(),
        battle_cooldown_end: 0,
    };
    let mut bravo = Troops {
        category: TroopType::Paladin,
        tier: TroopTier::T1,
        count: 95_000 * RESOURCE_PRECISION,
        stamina: Stamina { amount: 100, updated_tick: 1 }.into(),
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
        stamina: Stamina { amount: 100, updated_tick: 1 }.into(),
        boosts: troop_boosts(),
        battle_cooldown_end: 0,
    };
    let mut bravo = Troops {
        category: TroopType::Crossbowman,
        tier: TroopTier::T1, // Tier 1
        count: 159_303 * RESOURCE_PRECISION,
        stamina: Stamina { amount: 100, updated_tick: 1 }.into(),
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

fn test_troops(category: TroopType, tier: TroopTier, troop_count: u128, stamina: u64) -> Troops {
    Troops {
        category,
        tier,
        count: troop_count * RESOURCE_PRECISION,
        stamina: Stamina { amount: stamina, updated_tick: 1 }.into(),
        boosts: troop_boosts(),
        battle_cooldown_end: 0,
    }
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
