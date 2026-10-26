pub use eternum_cubit::f128::types::fixed::FixedTrait;
pub use crate::biome::Biome;
pub use crate::combat::{CombatContext, TroopsTrait};
pub use crate::rules::{RESOURCE_PRECISION, TroopDamageConfig, TroopStaminaConfig};
pub use crate::stamina::StaminaSourceTrait;
pub use crate::troops::{Stamina, TroopBoosts, TroopTier, TroopType, Troops};
pub fn context(biome: Biome) -> CombatContext {
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
pub const KNIGHT_MAX_STAMINA: u16 = 120;
pub const CROSSBOWMAN_MAX_STAMINA: u16 = 120;
pub const PALADIN_MAX_STAMINA: u16 = 140;
pub fn damage_config() -> TroopDamageConfig {
    TroopDamageConfig {
        t1_damage_value: 1844674407370955161600, // 100
        t2_damage_multiplier: 46116860184273879040, // 2.5
        t3_damage_multiplier: 129127208515966861312, // 7
        damage_biome_bonus_num: 3_000, // 30%
        damage_scaling_factor: 55340232221128654848, // 3
        damage_raid_percent_num: 5,
    }
}
pub fn stamina_config() -> TroopStaminaConfig {
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
pub fn troop_boosts() -> TroopBoosts {
    TroopBoosts {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_at: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_at: 0,
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_seconds_left: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_at: 0,
    }
}
pub fn dice_damage(attacker_roll: u8, defender_roll: u8) -> (u128, u128) {
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
pub fn test_troops(category: TroopType, tier: TroopTier, troop_count: u128, stamina: u64) -> Troops {
    Troops {
        category,
        tier,
        count: troop_count * RESOURCE_PRECISION,
        stamina: Stamina { amount: stamina, settled_at: 1, remainder: 0 }.into(),
        boosts: troop_boosts(),
        battle_cooldown_end: 0,
    }
}
