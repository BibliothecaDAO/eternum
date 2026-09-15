use crate::parity_types::{
    Biome, CombatContext, Stamina, TroopBoosts, TroopDamageConfig, TroopStaminaConfig, TroopTier, TroopType, Troops,
    TroopsTrait,
};

fn damage_config() -> TroopDamageConfig {
    TroopDamageConfig {
        damage_raid_percent_num: 1000,
        damage_biome_bonus_num: 3000,
        damage_beta_small: 4611686018427387904,
        damage_beta_large: 2213609288845146193,
        damage_scaling_factor: 36893488147419103232,
        damage_c0: 100000 * 18446744073709551616,
        damage_delta: 50000 * 18446744073709551616,
        t1_damage_value: 1844674407370955161600,
        t2_damage_multiplier: 55340232221128654848,
        t3_damage_multiplier: 166020696663385964544,
    }
}
fn stamina_config() -> TroopStaminaConfig {
    TroopStaminaConfig {
        stamina_gain_per_tick: 20,
        stamina_initial: 20,
        stamina_bonus_value: 10,
        stamina_knight_max: 120,
        stamina_paladin_max: 120,
        stamina_crossbowman_max: 120,
        stamina_attack_req: 50,
        stamina_defense_req: 40,
        stamina_explore_stamina_cost: 30,
        stamina_travel_stamina_cost: 20,
        stamina_explore_wheat_cost: 30000000,
        stamina_explore_fish_cost: 30000000,
        stamina_travel_wheat_cost: 30000000,
        stamina_travel_fish_cost: 30000000,
    }
}
fn troops(category: TroopType, tier: TroopTier, count: u128) -> Troops {
    Troops {
        category,
        tier,
        count: count * 1000000000,
        stamina: Stamina { amount: 120, updated_tick: 20 },
        boosts: TroopBoosts {
            incr_damage_dealt_percent_num: 0,
            incr_damage_dealt_end_tick: 0,
            decr_damage_gotten_percent_num: 0,
            decr_damage_gotten_end_tick: 0,
            incr_stamina_regen_percent_num: 0,
            incr_stamina_regen_tick_count: 0,
            incr_explore_reward_percent_num: 0,
            incr_explore_reward_end_tick: 0,
        },
        battle_cooldown_end: 0,
    }
}

#[test]
fn combat_parity_vectors() {
    snforge_std::start_cheat_block_timestamp_global(1200);
    for case in 0..4_u32 {
        let (mut attacker, mut defender, context) = if case == 0 {
            (
                troops(TroopType::Knight, TroopTier::T1, 1000),
                troops(TroopType::Crossbowman, TroopTier::T1, 800),
                CombatContext {
                    timestamp: 1200,
                    attacker_roll: 0,
                    defender_roll: 0,
                    attacker_biome: Biome::Grassland,
                    defender_biome: Biome::Grassland,
                    attack_distance: 1,
                    attacker_is_structure_guard: false,
                    defender_is_structure_guard: false,
                },
            )
        } else if case == 1 {
            (
                troops(TroopType::Crossbowman, TroopTier::T2, 3000),
                troops(TroopType::Paladin, TroopTier::T2, 2000),
                CombatContext {
                    timestamp: 1200,
                    attacker_roll: 13,
                    defender_roll: 4,
                    attacker_biome: Biome::Underground,
                    defender_biome: Biome::Underground,
                    attack_distance: 1,
                    attacker_is_structure_guard: false,
                    defender_is_structure_guard: false,
                },
            )
        } else if case == 2 {
            (
                troops(TroopType::Crossbowman, TroopTier::T1, 1000),
                troops(TroopType::Knight, TroopTier::T1, 800),
                CombatContext {
                    timestamp: 1200,
                    attacker_roll: 20,
                    defender_roll: 1,
                    attacker_biome: Biome::Underground,
                    defender_biome: Biome::Underground,
                    attack_distance: 2,
                    attacker_is_structure_guard: false,
                    defender_is_structure_guard: false,
                },
            )
        } else {
            (
                troops(TroopType::Knight, TroopTier::T3, 2000),
                troops(TroopType::Knight, TroopTier::T1, 1),
                CombatContext {
                    timestamp: 1200,
                    attacker_roll: 0,
                    defender_roll: 0,
                    attacker_biome: Biome::Taiga,
                    defender_biome: Biome::Taiga,
                    attack_distance: 1,
                    attacker_is_structure_guard: false,
                    defender_is_structure_guard: true,
                },
            )
        };
        attacker.attack_with_context(ref defender, context, stamina_config(), damage_config(), 20, 60);
        let mut row = array![];
        attacker.serialize(ref row);
        defender.serialize(ref row);
        for index in 0..row.len() {
            println!("PARITY_COMBAT {} {} {}", case, index, *row.at(index));
        }
    }
}
