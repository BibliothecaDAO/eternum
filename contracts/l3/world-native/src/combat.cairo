use core::num::traits::Zero;
use eternum_cubit::f128::types::fixed::{Fixed, FixedTrait};
use crate::biome::Biome;
use crate::math::PercentageValueImpl;
use crate::rules::{RESOURCE_PRECISION, TroopDamageConfig, TroopStaminaConfig};
use crate::stamina::StaminaSourceTrait;
use crate::troops::{TroopTier, TroopType, Troops};
/// The last entity this army attacked. Entity zero means no attack yet.
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct ArmyCombat {
    pub last_target: u64,
}

#[cfg(feature: "blitz")]
#[derive(Copy, Drop, Serde, Default)]
pub struct CombatContext {
    pub timestamp: u64,
    pub attacker_biome: Biome,
    pub defender_biome: Biome,
    pub attack_distance: u32,
    pub attacker_is_structure_guard: bool,
    pub defender_is_structure_guard: bool,
    pub attacker_oaths: u16,
    pub defender_oaths: u16,
    pub attacker_twin_damage: u128,
}

#[cfg(not(feature: "blitz"))]
#[derive(Copy, Drop, Serde, Default)]
pub struct CombatContext {
    pub timestamp: u64,
    pub attacker_biome: Biome,
    pub defender_biome: Biome,
    // Frontier counts player-held slots; unowned beasts receive no Knight protection.
    pub attacker_is_structure_guard: bool,
    pub defender_is_structure_guard: bool,
    pub attacker_oaths: u16,
    pub defender_oaths: u16,
    pub attacker_twin_damage: u128,
}


#[generate_trait]
pub impl TroopsImpl of TroopsTrait {
    fn _tier_bonus(ref self: Troops, troop_damage_config: TroopDamageConfig) -> Fixed {
        let T1_DAMAGE_VALUE: Fixed = FixedTrait::new(troop_damage_config.t1_damage_value.into(), false);
        match self.tier {
            TroopTier::T1 => T1_DAMAGE_VALUE,
            TroopTier::T2 => T1_DAMAGE_VALUE * FixedTrait::new(troop_damage_config.t2_damage_multiplier.into(), false),
            TroopTier::T3 => T1_DAMAGE_VALUE * FixedTrait::new(troop_damage_config.t3_damage_multiplier.into(), false),
        }
    }


    fn _biome_damage_bonus(ref self: Troops, biome: Biome, troop_damage_config: TroopDamageConfig) -> Fixed {
        let value = troop_damage_config.damage_biome_bonus_num;
        let (sign, numerator) = match biome {
            Biome::None | Biome::Underground => (false, 0),
            Biome::DeepOcean | Biome::Ocean |
            Biome::Scorched => match self.category {
                TroopType::Knight => (false, 0),
                TroopType::Crossbowman => (true, value),
                TroopType::Paladin => (false, value),
            },
            Biome::Beach |
            Biome::Snow => match self.category {
                TroopType::Knight => (false, value),
                TroopType::Crossbowman => (true, value),
                TroopType::Paladin => (false, 0),
            },
            Biome::Bare | Biome::Shrubland |
            Biome::Grassland => match self.category {
                TroopType::Knight => (false, 0),
                TroopType::Crossbowman => (false, value),
                TroopType::Paladin => (true, value),
            },
            Biome::Tundra | Biome::TemperateDesert |
            Biome::SubtropicalDesert => match self.category {
                TroopType::Knight => (false, value),
                TroopType::Crossbowman => (false, 0),
                TroopType::Paladin => (true, value),
            },
            Biome::Taiga | Biome::TemperateDeciduousForest | Biome::TemperateRainForest |
            Biome::TropicalSeasonalForest |
            Biome::TropicalRainForest => match self.category {
                TroopType::Knight => (true, value),
                TroopType::Crossbowman => (false, 0),
                TroopType::Paladin => (false, value),
            },
        };

        if numerator.is_zero() {
            return 1_u8.into();
        }
        let base: Fixed = PercentageValueImpl::_100().into();
        let bonus: Fixed = numerator.into();
        if sign {
            return (base + bonus) / base;
        } else {
            return (base - bonus) / base;
        }
    }

    fn stamina_travel_bonus(ref self: Troops, biome: Biome, troop_stamina_config: TroopStaminaConfig) -> (bool, u16) {
        let value = troop_stamina_config.stamina_bonus_value;
        match biome {
            Biome::None | Biome::Beach | Biome::Snow | Biome::Underground => (false, 0),
            Biome::DeepOcean | Biome::Ocean => (false, value),
            Biome::Scorched => (true, value),
            Biome::Bare | Biome::Tundra | Biome::TemperateDesert | Biome::Shrubland | Biome::Grassland |
            Biome::SubtropicalDesert => { (false, if self.category == TroopType::Paladin {
                value
            } else {
                0
            }) },
            Biome::Taiga | Biome::TemperateDeciduousForest | Biome::TemperateRainForest |
            Biome::TropicalSeasonalForest |
            Biome::TropicalRainForest => {
                (self.category == TroopType::Paladin, if self.category == TroopType::Paladin {
                    value
                } else {
                    0
                })
            },
        }
    }

    fn _refund_multiplier(a_damage: Fixed, b_damage: Fixed) -> Fixed {
        if a_damage == FixedTrait::ZERO() {
            return FixedTrait::ZERO();
        }
        if b_damage == FixedTrait::ZERO() {
            return FixedTrait::ONE();
        }
        let _2_POINT_5: Fixed = FixedTrait::new(46116860184273879040, false);
        let _10_POINT_0: Fixed = FixedTrait::new(184467440737095516160, false);

        let ratio = a_damage / b_damage;
        if ratio >= _10_POINT_0 {
            return FixedTrait::ONE();
        }
        if ratio <= _2_POINT_5 {
            return FixedTrait::ZERO();
        }

        return (ratio - _2_POINT_5) / (_10_POINT_0 - _2_POINT_5);
    }

    fn _surviving_fraction(troops: Fixed, damage: Fixed) -> Fixed {
        if damage >= troops {
            FixedTrait::ZERO()
        } else {
            (troops - damage) / troops
        }
    }

    fn _effective_beta() -> Fixed {
        // effective beta is 0.2
        return FixedTrait::new_unscaled(2, false) / FixedTrait::new_unscaled(10, false);
    }

    fn update_timer(ref self: Troops, now: u32) {
        if self.battle_cooldown_end < now {
            self.battle_cooldown_end = now;
        }
    }

    fn _combat_percent_multiplier(numerator: u16) -> Fixed {
        return FixedTrait::new(numerator.into(), false) / FixedTrait::new(100, false);
    }

    fn _incoming_damage_multiplier(ref self: Troops, is_structure_guard: bool) -> Fixed {
        if is_structure_guard && self.category == TroopType::Knight {
            return Self::_combat_percent_multiplier(crate::rules::FRONTIER_KNIGHT_GUARD_DAMAGE_PERCENT.into());
        }

        1_u8.into()
    }

    #[cfg(feature: "blitz")]
    #[inline(never)]
    fn damage_with_context(
        ref self: Troops,
        ref bravo: Troops,
        context: CombatContext,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        tick_seconds: u64,
        cooldown_seconds: u32,
    ) -> (u128, u128, u64, u64) {
        assert!(self.count.is_non_zero(), "you have no troops");
        assert!(bravo.count.is_non_zero(), "the defender has no troops");
        assert!(context.defender_biome != Biome::None, "biome is not set");
        let mut alpha = self;
        let now: u32 = context.timestamp.try_into().unwrap();
        alpha.update_timer(now);
        bravo.update_timer(now);
        assert!(
            alpha.battle_cooldown_end <= now,
            "you need to wait {} seconds before you can attack",
            alpha.battle_cooldown_end - now,
        );
        alpha
            .stamina
            .refill(
                ref alpha.boosts, alpha.category, alpha.tier, troop_stamina_config, tick_seconds, context.timestamp,
            );
        bravo
            .stamina
            .refill(
                ref bravo.boosts, bravo.category, bravo.tier, troop_stamina_config, tick_seconds, context.timestamp,
            );
        let attack_stamina = troop_stamina_config.stamina_attack_req;
        assert!(
            alpha.stamina.inline().amount >= attack_stamina.into(),
            "you have {} stamina, but need {} to launch attack",
            alpha.stamina.inline().amount,
            attack_stamina,
        );
        let mut ALPHA_STAMINA_LOSS: u16 = attack_stamina;
        let ranged = context.attack_distance > 1;
        let defender_stamina_req = if ranged {
            troop_stamina_config.stamina_defense_req / 2
        } else {
            troop_stamina_config.stamina_defense_req
        };
        let mut BRAVO_STAMINA_LOSS: u128 = core::cmp::min(
            bravo.stamina.inline().amount.into(), defender_stamina_req.into(),
        );
        let mut BRAVO_STAMINA_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();
        if !ranged && BRAVO_STAMINA_LOSS < defender_stamina_req.into() {
            BRAVO_STAMINA_DAMAGE_MULTIPLIER = Self::_combat_percent_multiplier(70);
        }
        let mut BRAVO_BATTLE_TIMER_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();
        if bravo.battle_cooldown_end > now {
            BRAVO_BATTLE_TIMER_DAMAGE_MULTIPLIER = Self::_combat_percent_multiplier(85);
        }
        let BASE_DAMAGE_FACTOR: Fixed = FixedTrait::new(troop_damage_config.damage_scaling_factor, false);
        let ALPHA_NUM_TROOPS: Fixed = (self.count / RESOURCE_PRECISION).into();
        let ALPHA_TIER_BONUS: Fixed = self._tier_bonus(troop_damage_config).into();
        let ALPHA_BIOME_BONUS_DAMAGE_MULTIPLIER: Fixed = if ranged {
            1_u8.into()
        } else {
            alpha._biome_damage_bonus(context.attacker_biome, troop_damage_config)
        };
        let BRAVO_NUM_TROOPS: Fixed = (bravo.count / RESOURCE_PRECISION).into();
        let BRAVO_TIER_BONUS: Fixed = bravo._tier_bonus(troop_damage_config).into();
        let BRAVO_BIOME_BONUS_DAMAGE_MULTIPLIER: Fixed = bravo
            ._biome_damage_bonus(context.defender_biome, troop_damage_config);
        let TOTAL_NUM_TROOPS: Fixed = ALPHA_NUM_TROOPS + BRAVO_NUM_TROOPS;
        let EFFECTIVE_BETA: Fixed = Self::_effective_beta();
        let mut BRAVO_DAMAGE_DEALT: Fixed = (BASE_DAMAGE_FACTOR
            * BRAVO_NUM_TROOPS
            * BRAVO_TIER_BONUS
            * BRAVO_BIOME_BONUS_DAMAGE_MULTIPLIER
            * BRAVO_STAMINA_DAMAGE_MULTIPLIER
            * BRAVO_BATTLE_TIMER_DAMAGE_MULTIPLIER
            / ALPHA_TIER_BONUS
            / TOTAL_NUM_TROOPS.pow(EFFECTIVE_BETA));
        let mut ALPHA_DAMAGE_DEALT: Fixed = (BASE_DAMAGE_FACTOR
            * ALPHA_NUM_TROOPS
            * ALPHA_TIER_BONUS
            * ALPHA_BIOME_BONUS_DAMAGE_MULTIPLIER
            / BRAVO_TIER_BONUS
            / TOTAL_NUM_TROOPS.pow(EFFECTIVE_BETA));
        if ranged && alpha.category == TroopType::Crossbowman {
            ALPHA_DAMAGE_DEALT *=
                Self::_combat_percent_multiplier(if context.defender_is_structure_guard {
                    30
                } else {
                    70
                });
        }
        if context.attack_distance == 1
            && alpha.category == TroopType::Knight
            && !context.attacker_is_structure_guard
            && context.defender_is_structure_guard {
            ALPHA_DAMAGE_DEALT *= Self::_combat_percent_multiplier(115);
        }
        if context.defender_is_structure_guard && bravo.category == TroopType::Knight {
            ALPHA_DAMAGE_DEALT *= Self::_combat_percent_multiplier(85);
        }
        if context.attacker_is_structure_guard && alpha.category == TroopType::Knight {
            BRAVO_DAMAGE_DEALT *= Self::_combat_percent_multiplier(85);
        }
        if ranged {
            BRAVO_DAMAGE_DEALT = FixedTrait::ZERO();
        }
        if alpha.boosts.incr_damage_dealt_end_at != 0
            && !crate::relics::bonus_active(alpha.boosts.incr_damage_dealt_end_at, context.timestamp) {
            alpha.boosts.incr_damage_dealt_percent_num = 0;
        }
        if alpha.boosts.decr_damage_gotten_end_at != 0
            && !crate::relics::bonus_active(alpha.boosts.decr_damage_gotten_end_at, context.timestamp) {
            alpha.boosts.decr_damage_gotten_percent_num = 0;
        }
        if bravo.boosts.incr_damage_dealt_end_at != 0
            && !crate::relics::bonus_active(bravo.boosts.incr_damage_dealt_end_at, context.timestamp) {
            bravo.boosts.incr_damage_dealt_percent_num = 0;
        }
        if bravo.boosts.decr_damage_gotten_end_at != 0
            && !crate::relics::bonus_active(bravo.boosts.decr_damage_gotten_end_at, context.timestamp) {
            bravo.boosts.decr_damage_gotten_percent_num = 0;
        }
        ALPHA_DAMAGE_DEALT += ALPHA_DAMAGE_DEALT
            * alpha.boosts.incr_damage_dealt_percent_num.into()
            / PercentageValueImpl::_100().into();
        BRAVO_DAMAGE_DEALT += BRAVO_DAMAGE_DEALT
            * bravo.boosts.incr_damage_dealt_percent_num.into()
            / PercentageValueImpl::_100().into();
        BRAVO_DAMAGE_DEALT -= BRAVO_DAMAGE_DEALT
            * alpha.boosts.decr_damage_gotten_percent_num.into()
            / PercentageValueImpl::_100().into();
        ALPHA_DAMAGE_DEALT -= ALPHA_DAMAGE_DEALT
            * bravo.boosts.decr_damage_gotten_percent_num.into()
            / PercentageValueImpl::_100().into();
        if ranged {
            let half_cooldown = cooldown_seconds / 2;
            alpha.battle_cooldown_end += half_cooldown;
            bravo.battle_cooldown_end += half_cooldown;
            self = alpha;
            return (
                ALPHA_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
                0,
                ALPHA_STAMINA_LOSS.into(),
                BRAVO_STAMINA_LOSS.try_into().unwrap(),
            );
        }
        let alpha_refund_ratio = Self::_refund_multiplier(ALPHA_DAMAGE_DEALT, BRAVO_DAMAGE_DEALT);
        let alpha_stamina_loss_fixed: Fixed = ALPHA_STAMINA_LOSS.into();
        let alpha_refunded_stamina: Fixed = (alpha_stamina_loss_fixed * alpha_refund_ratio).ceil();
        if troop_stamina_config.damage_stamina_refund {
            ALPHA_STAMINA_LOSS -= alpha_refunded_stamina.try_into().unwrap();
        }
        let bravo_refund_ratio = Self::_refund_multiplier(BRAVO_DAMAGE_DEALT, ALPHA_DAMAGE_DEALT);
        let bravo_stamina_loss_fixed: Fixed = BRAVO_STAMINA_LOSS.into();
        let bravo_refunded_stamina: Fixed = (bravo_stamina_loss_fixed * bravo_refund_ratio).ceil();
        if troop_stamina_config.damage_stamina_refund {
            BRAVO_STAMINA_LOSS -= bravo_refunded_stamina.try_into().unwrap();
        }
        let cooldown_seconds_fixed: Fixed = cooldown_seconds.into();
        let alpha_additional_timer_length: Fixed = cooldown_seconds_fixed * (FixedTrait::ONE() - alpha_refund_ratio);
        alpha.battle_cooldown_end += alpha_additional_timer_length.try_into().unwrap();
        let bravo_additional_timer_length: Fixed = cooldown_seconds_fixed * (FixedTrait::ONE() - bravo_refund_ratio);
        bravo.battle_cooldown_end += bravo_additional_timer_length.try_into().unwrap();
        self = alpha;
        (
            ALPHA_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
            BRAVO_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
            ALPHA_STAMINA_LOSS.into(),
            BRAVO_STAMINA_LOSS.try_into().unwrap(),
        )
    }

    #[cfg(not(feature: "blitz"))]
    #[inline(never)]
    fn damage_with_context(
        ref self: Troops,
        ref bravo: Troops,
        context: CombatContext,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        tick_seconds: u64,
        cooldown_seconds: u32,
    ) -> (u128, u128, u64, u64) {
        assert!(self.count.is_non_zero(), "you have no troops");
        assert!(bravo.count.is_non_zero(), "the defender has no troops");
        assert!(context.defender_biome != Biome::None, "biome is not set");

        let mut alpha = self;

        // update alpha and bravo's battle cooldown timers
        let now: u32 = context.timestamp.try_into().unwrap();
        alpha.update_timer(now);
        bravo.update_timer(now);

        // ensure alpha is ready to attack
        assert!(
            alpha.battle_cooldown_end <= now,
            "you need to wait {} seconds before you can attack",
            alpha.battle_cooldown_end - now,
        );

        // update alpha and bravo's staminas
        alpha
            .stamina
            .refill(
                ref alpha.boosts, alpha.category, alpha.tier, troop_stamina_config, tick_seconds, context.timestamp,
            );
        bravo
            .stamina
            .refill(
                ref bravo.boosts, bravo.category, bravo.tier, troop_stamina_config, tick_seconds, context.timestamp,
            );

        // ensure alpha has enough stamina to launch attack
        let attack_stamina = crate::oaths::attack_stamina(
            context.attacker_oaths, troop_stamina_config.stamina_attack_req,
        );
        assert!(
            alpha.stamina.inline().amount >= attack_stamina.into(),
            "you have {} stamina, but need {} to launch attack",
            alpha.stamina.inline().amount,
            attack_stamina,
        );

        // calculate alpha's stamina lost
        let mut ALPHA_STAMINA_LOSS = attack_stamina;
        let ALPHA_STAMINA_BONUS_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();
        let ALPHA_BATTLE_TIMER_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();

        let mut BRAVO_STAMINA_LOSS: u128 = core::cmp::min(
            bravo.stamina.inline().amount.into(), troop_stamina_config.stamina_defense_req.into(),
        );

        // calculate bravo's battle timer based damage penalty
        let mut BRAVO_BATTLE_TIMER_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();
        if bravo.battle_cooldown_end > now {
            // 15% loss so the multiplier is 0.85
            BRAVO_BATTLE_TIMER_DAMAGE_MULTIPLIER = FixedTrait::new(85, false) / FixedTrait::new(100, false); // 0.85
        }

        // calculate damage dealt from alpha to bravo and vice versa
        let BASE_DAMAGE_FACTOR: Fixed = FixedTrait::new(troop_damage_config.damage_scaling_factor, false);
        let ALPHA_NUM_TROOPS: Fixed = (self.count / RESOURCE_PRECISION).into();
        let ALPHA_TIER_BONUS: Fixed = self._tier_bonus(troop_damage_config).into();
        let ALPHA_BIOME_BONUS_DAMAGE_MULTIPLIER: Fixed = alpha
            ._biome_damage_bonus(context.attacker_biome, troop_damage_config);
        let BRAVO_NUM_TROOPS: Fixed = (bravo.count / RESOURCE_PRECISION).into();
        let BRAVO_TIER_BONUS: Fixed = bravo._tier_bonus(troop_damage_config).into();
        let BRAVO_BIOME_BONUS_DAMAGE_MULTIPLIER: Fixed = bravo
            ._biome_damage_bonus(context.defender_biome, troop_damage_config);
        let TOTAL_NUM_TROOPS: Fixed = ALPHA_NUM_TROOPS + BRAVO_NUM_TROOPS;
        let EFFECTIVE_BETA: Fixed = Self::_effective_beta();
        let mut BRAVO_DAMAGE_DEALT: Fixed = (BASE_DAMAGE_FACTOR
            * BRAVO_NUM_TROOPS
            * BRAVO_TIER_BONUS
            * BRAVO_BIOME_BONUS_DAMAGE_MULTIPLIER
            * BRAVO_BATTLE_TIMER_DAMAGE_MULTIPLIER
            / ALPHA_TIER_BONUS
            / TOTAL_NUM_TROOPS.pow(EFFECTIVE_BETA));

        let mut ALPHA_DAMAGE_DEALT: Fixed = (BASE_DAMAGE_FACTOR
            * ALPHA_NUM_TROOPS
            * ALPHA_TIER_BONUS
            * ALPHA_STAMINA_BONUS_DAMAGE_MULTIPLIER
            * ALPHA_BIOME_BONUS_DAMAGE_MULTIPLIER
            * ALPHA_BATTLE_TIMER_DAMAGE_MULTIPLIER
            / BRAVO_TIER_BONUS
            / TOTAL_NUM_TROOPS.pow(EFFECTIVE_BETA));

        ALPHA_DAMAGE_DEALT *= bravo._incoming_damage_multiplier(context.defender_is_structure_guard);
        BRAVO_DAMAGE_DEALT *= alpha._incoming_damage_multiplier(context.attacker_is_structure_guard);
        if alpha.category != TroopType::Knight {
            ALPHA_DAMAGE_DEALT *= Self::_combat_percent_multiplier(crate::rules::FRONTIER_LIGHT_DAMAGE_PERCENT.into());
        }
        if bravo.category != TroopType::Knight {
            BRAVO_DAMAGE_DEALT *= Self::_combat_percent_multiplier(crate::rules::FRONTIER_LIGHT_DAMAGE_PERCENT.into());
        }

        /////////////////////////////////////////////////
        /// APPLY BATTLE DAMAGE BOOST/REDUCTION EFFECTS
        //////////////////////////////////////////////////

        // A zero end second marks a derived attribute bonus with no expiry.
        if alpha.boosts.incr_damage_dealt_end_at != 0
            && !crate::relics::bonus_active(alpha.boosts.incr_damage_dealt_end_at, context.timestamp) {
            alpha.boosts.incr_damage_dealt_percent_num = 0;
        }
        if alpha.boosts.decr_damage_gotten_end_at != 0
            && !crate::relics::bonus_active(alpha.boosts.decr_damage_gotten_end_at, context.timestamp) {
            alpha.boosts.decr_damage_gotten_percent_num = 0;
        }

        if bravo.boosts.incr_damage_dealt_end_at != 0
            && !crate::relics::bonus_active(bravo.boosts.incr_damage_dealt_end_at, context.timestamp) {
            bravo.boosts.incr_damage_dealt_percent_num = 0;
        }
        if bravo.boosts.decr_damage_gotten_end_at != 0
            && !crate::relics::bonus_active(bravo.boosts.decr_damage_gotten_end_at, context.timestamp) {
            bravo.boosts.decr_damage_gotten_percent_num = 0;
        }

        ALPHA_DAMAGE_DEALT += ALPHA_DAMAGE_DEALT
            * alpha.boosts.incr_damage_dealt_percent_num.into()
            / PercentageValueImpl::_100().into();

        BRAVO_DAMAGE_DEALT += BRAVO_DAMAGE_DEALT
            * bravo.boosts.incr_damage_dealt_percent_num.into()
            / PercentageValueImpl::_100().into();

        BRAVO_DAMAGE_DEALT -= BRAVO_DAMAGE_DEALT
            * alpha.boosts.decr_damage_gotten_percent_num.into()
            / PercentageValueImpl::_100().into();

        ALPHA_DAMAGE_DEALT -= ALPHA_DAMAGE_DEALT
            * bravo.boosts.decr_damage_gotten_percent_num.into()
            / PercentageValueImpl::_100().into();

        ALPHA_DAMAGE_DEALT *=
            crate::oaths::damage_multiplier(
                context.attacker_oaths, context.defender_oaths, context.defender_is_structure_guard,
            );
        ALPHA_DAMAGE_DEALT *=
            crate::oaths::skill_multiplier(
                context.attacker_oaths, alpha.stamina.inline().amount - attack_stamina.into(),
            );
        BRAVO_DAMAGE_DEALT *=
            crate::oaths::damage_multiplier(
                context.defender_oaths, context.attacker_oaths, context.attacker_is_structure_guard,
            );
        let alpha_bow = alpha.category == TroopType::Crossbowman;
        let bravo_bow = bravo.category == TroopType::Crossbowman;
        if alpha_bow && !bravo_bow {
            BRAVO_DAMAGE_DEALT *= Self::_surviving_fraction(BRAVO_NUM_TROOPS, ALPHA_DAMAGE_DEALT);
        } else if bravo_bow && !alpha_bow {
            ALPHA_DAMAGE_DEALT *= Self::_surviving_fraction(ALPHA_NUM_TROOPS, BRAVO_DAMAGE_DEALT);
        }

        ////////////////////////////////////
        /// STAMINA REFUND
        ////////////////////////////////////

        let alpha_refund_ratio = Self::_refund_multiplier(ALPHA_DAMAGE_DEALT, BRAVO_DAMAGE_DEALT);
        let mut alpha_stamina_loss_fixed: Fixed = ALPHA_STAMINA_LOSS.into();
        let alpha_refunded_stamina: Fixed = (alpha_stamina_loss_fixed * alpha_refund_ratio).ceil();
        if troop_stamina_config.damage_stamina_refund {
            ALPHA_STAMINA_LOSS -= alpha_refunded_stamina.try_into().unwrap();
        }

        let bravo_refund_ratio = Self::_refund_multiplier(BRAVO_DAMAGE_DEALT, ALPHA_DAMAGE_DEALT);
        let mut bravo_stamina_loss_fixed: Fixed = BRAVO_STAMINA_LOSS.into();
        let bravo_refunded_stamina: Fixed = (bravo_stamina_loss_fixed * bravo_refund_ratio).ceil();
        if troop_stamina_config.damage_stamina_refund {
            BRAVO_STAMINA_LOSS -= bravo_refunded_stamina.try_into().unwrap();
        }

        ////////////////////////////////////
        /// BATTLE TIMER REFUND
        ////////////////////////////////////
        let cooldown_seconds_fixed: Fixed = cooldown_seconds.into();
        let alpha_additional_timer_length: Fixed = cooldown_seconds_fixed * (FixedTrait::ONE() - alpha_refund_ratio);
        alpha.battle_cooldown_end += alpha_additional_timer_length.try_into().unwrap();

        let bravo_additional_timer_length: Fixed = cooldown_seconds_fixed * (FixedTrait::ONE() - bravo_refund_ratio);
        bravo.battle_cooldown_end += bravo_additional_timer_length.try_into().unwrap();

        self = alpha;

        (
            ALPHA_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
            BRAVO_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
            ALPHA_STAMINA_LOSS.try_into().unwrap(),
            BRAVO_STAMINA_LOSS.try_into().unwrap(),
        )
    }


    fn attack_with_context(
        ref self: Troops,
        ref bravo: Troops,
        context: CombatContext,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        tick_seconds: u64,
        cooldown_seconds: u32,
    ) {
        let (alpha_damage_dealt, bravo_damage_dealt, mut alpha_stamina_loss, bravo_stamina_loss) = self
            .damage_with_context(
                ref bravo, context, troop_stamina_config, troop_damage_config, tick_seconds, cooldown_seconds,
            );

        let mut alpha = self;

        // deduct dead troops from each side
        alpha.count -= core::cmp::min(alpha.count, bravo_damage_dealt);
        bravo.count -= core::cmp::min(bravo.count, alpha_damage_dealt + context.attacker_twin_damage);
        if bravo.count == 0 && alpha.count != 0 {
            let cost = crate::oaths::attack_stamina(context.attacker_oaths, troop_stamina_config.stamina_attack_req);
            alpha_stamina_loss -=
                core::cmp::min(alpha_stamina_loss, crate::oaths::fury_refund(context.attacker_oaths, cost));
        }

        // deduct stamina spent
        alpha
            .stamina
            .spend(
                ref alpha.boosts,
                alpha.category,
                alpha.tier,
                troop_stamina_config,
                alpha_stamina_loss,
                tick_seconds,
                context.timestamp,
                true,
            );

        bravo
            .stamina
            .spend(
                ref bravo.boosts,
                bravo.category,
                bravo.tier,
                troop_stamina_config,
                bravo_stamina_loss,
                tick_seconds,
                context.timestamp,
                true,
            );
        self = alpha;
    }
}
