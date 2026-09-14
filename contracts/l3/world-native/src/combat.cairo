use core::num::traits::Zero;
use eternum_cubit::f128::types::fixed::{Fixed, FixedTrait};
use crate::biome::Biome;
use crate::math::PercentageValueImpl;
use crate::rules::{RESOURCE_PRECISION, TroopDamageConfig, TroopStaminaConfig};
use crate::stamina::StaminaTrait;
use crate::troops::{TroopTier, TroopType, Troops};
#[derive(Copy, Drop, Serde)]
pub struct CombatContext {
    pub timestamp: u64,
    pub attacker_roll: u8,
    pub defender_roll: u8,
    pub attacker_biome: Biome,
    pub defender_biome: Biome,
    pub attack_distance: u32,
    pub attacker_is_structure_guard: bool,
    pub defender_is_structure_guard: bool,
}


#[generate_trait]
pub impl TroopsImpl of TroopsTrait {
    fn standard_combat_context(biome: Biome) -> CombatContext {
        CombatContext {
            timestamp: starknet::get_block_timestamp(),
            attacker_roll: 0,
            defender_roll: 0,
            attacker_biome: biome,
            defender_biome: biome,
            attack_distance: 1,
            attacker_is_structure_guard: false,
            defender_is_structure_guard: false,
        }
    }

    fn attack_range(ref self: Troops) -> u32 {
        match self.category {
            TroopType::Crossbowman => 2,
            TroopType::Knight => 1,
            TroopType::Paladin => 1,
        }
    }

    fn _tier_bonus(ref self: Troops, troop_damage_config: TroopDamageConfig) -> Fixed {
        let T1_DAMAGE_VALUE: Fixed = FixedTrait::new(troop_damage_config.t1_damage_value.into(), false);
        match self.tier {
            TroopTier::T1 => T1_DAMAGE_VALUE,
            TroopTier::T2 => T1_DAMAGE_VALUE * FixedTrait::new(troop_damage_config.t2_damage_multiplier.into(), false),
            TroopTier::T3 => T1_DAMAGE_VALUE * FixedTrait::new(troop_damage_config.t3_damage_multiplier.into(), false),
        }
    }


    fn _biome_damage_bonus(ref self: Troops, biome: Biome, troop_damage_config: TroopDamageConfig) -> Fixed {
        let ZERO: u16 = 0;
        let VALUE: u16 = troop_damage_config.damage_biome_bonus_num;
        let ADD: bool = true;
        let SUBTRACT: bool = false;
        let NEUTRAL: bool = false;

        let (sign, numerator): (bool, u16) = match biome {
            Biome::None => (NEUTRAL, ZERO),
            Biome::DeepOcean => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::Ocean => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::Beach => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // -x
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::Scorched => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::Bare => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::Tundra => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // -x
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::Snow => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // -x
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::TemperateDesert => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // -x
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::Shrubland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::Taiga => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::Grassland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::TemperateDeciduousForest => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::TemperateRainForest => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::SubtropicalDesert => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // -x
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::TropicalSeasonalForest => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::TropicalRainForest => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::Underground => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
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
        let ZERO: u16 = 0;
        let VALUE: u16 = troop_stamina_config.stamina_bonus_value;
        let ADD: bool = true;
        let SUBTRACT: bool = false;
        let NEUTRAL: bool = false;

        match biome {
            Biome::None => (NEUTRAL, ZERO),
            Biome::DeepOcean => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // -1
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -1
                    TroopType::Paladin => (SUBTRACT, VALUE) // -1
                }
            },
            Biome::Ocean => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // -1
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -1
                    TroopType::Paladin => (SUBTRACT, VALUE) // -1
                }
            },
            Biome::Beach => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::Scorched => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +1
                    TroopType::Crossbowman => (ADD, VALUE), // +1
                    TroopType::Paladin => (ADD, VALUE) // +1
                }
            },
            Biome::Bare => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -1
                }
            },
            Biome::Tundra => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -1
                }
            },
            Biome::Snow => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::TemperateDesert => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -1
                }
            },
            Biome::Shrubland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -1
                }
            },
            Biome::Taiga => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +1
                }
            },
            Biome::Grassland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -1
                }
            },
            Biome::TemperateDeciduousForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +1
                }
            },
            Biome::TemperateRainForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +1
                }
            },
            Biome::SubtropicalDesert => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE) // -1
                }
            },
            Biome::TropicalSeasonalForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +1
                }
            },
            Biome::TropicalRainForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +1
                }
            },
            Biome::Underground => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
        }
    }

    fn _refund_multiplier(a_damage: Fixed, b_damage: Fixed) -> Fixed {
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

    fn _is_ranged_attack_context(context: CombatContext) -> bool {
        context.attack_distance > 1
    }

    fn _is_ranged_crossbow_attack(ref self: Troops, context: CombatContext) -> bool {
        self.category == TroopType::Crossbowman && Self::_is_ranged_attack_context(context)
    }

    fn _attacker_biome_damage_bonus(
        ref self: Troops, context: CombatContext, troop_damage_config: TroopDamageConfig,
    ) -> Fixed {
        // Range-2 attacks ignore biome damage modifiers; only adjacent (range-1) combat applies them.
        if Self::_is_ranged_attack_context(context) {
            return 1_u8.into();
        }

        self._biome_damage_bonus(context.attacker_biome, troop_damage_config)
    }

    fn _ranged_crossbow_damage_multiplier(ref self: Troops, context: CombatContext) -> Fixed {
        if !self._is_ranged_crossbow_attack(context) {
            return 1_u8.into();
        }

        if context.defender_is_structure_guard {
            return Self::_combat_percent_multiplier(30);
        }

        Self::_combat_percent_multiplier(70)
    }

    fn _knight_structure_assault_multiplier(ref self: Troops, context: CombatContext) -> Fixed {
        if self.category == TroopType::Knight
            && !context.attacker_is_structure_guard
            && context.defender_is_structure_guard
            && context.attack_distance == 1 {
            return Self::_combat_percent_multiplier(115);
        }

        1_u8.into()
    }

    fn _outgoing_damage_multiplier(ref self: Troops, context: CombatContext) -> Fixed {
        self._ranged_crossbow_damage_multiplier(context) * self._knight_structure_assault_multiplier(context)
    }

    fn _incoming_damage_multiplier(ref self: Troops, is_structure_guard: bool) -> Fixed {
        if is_structure_guard && self.category == TroopType::Knight {
            return Self::_combat_percent_multiplier(85);
        }

        1_u8.into()
    }

    fn damage(
        ref self: Troops,
        ref bravo: Troops,
        biome: Biome,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
        current_tick_interval: u64,
    ) -> (u128, u128, u64, u64) {
        self
            .damage_with_context(
                ref bravo,
                Self::standard_combat_context(biome),
                troop_stamina_config,
                troop_damage_config,
                current_tick,
                current_tick_interval,
            )
    }

    fn damage_with_context(
        ref self: Troops,
        ref bravo: Troops,
        context: CombatContext,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
        current_tick_interval: u64,
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
        alpha.stamina.refill(ref alpha.boosts, alpha.category, alpha.tier, troop_stamina_config, current_tick);
        bravo.stamina.refill(ref bravo.boosts, bravo.category, bravo.tier, troop_stamina_config, current_tick);

        // ensure alpha has enough stamina to launch attack
        assert!(
            alpha.stamina.amount >= troop_stamina_config.stamina_attack_req.into(),
            "you have {} stamina, but need {} to launch attack",
            alpha.stamina.amount,
            troop_stamina_config.stamina_attack_req,
        );

        // calculate alpha's stamina lost
        let mut ALPHA_STAMINA_LOSS = troop_stamina_config.stamina_attack_req;
        let ALPHA_STAMINA_BONUS_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();
        let ALPHA_BATTLE_TIMER_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();

        let is_ranged_attack = Self::_is_ranged_attack_context(context);

        // calculate bravo's stamina based damage penalty
        let mut BRAVO_STAMINA_BONUS_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();
        let ranged_defense_stamina_req = troop_stamina_config.stamina_defense_req / 2;
        let defender_stamina_req = if is_ranged_attack {
            ranged_defense_stamina_req
        } else {
            troop_stamina_config.stamina_defense_req
        };
        let mut BRAVO_STAMINA_LOSS: u128 = core::cmp::min(bravo.stamina.amount.into(), defender_stamina_req.into());
        if !is_ranged_attack && BRAVO_STAMINA_LOSS < defender_stamina_req.into() {
            BRAVO_STAMINA_BONUS_DAMAGE_MULTIPLIER = FixedTrait::new(7, false) / FixedTrait::new(10, false); // 0.7
        }

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
            ._attacker_biome_damage_bonus(context, troop_damage_config);
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
            * BRAVO_STAMINA_BONUS_DAMAGE_MULTIPLIER
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

        assert!(context.attacker_roll <= 20 && context.defender_roll <= 20, "invalid combat die");
        ALPHA_DAMAGE_DEALT *= Self::_combat_percent_multiplier(100 + context.attacker_roll.into());
        BRAVO_DAMAGE_DEALT *= Self::_combat_percent_multiplier(100 + context.defender_roll.into());
        ALPHA_DAMAGE_DEALT *= alpha._outgoing_damage_multiplier(context);
        ALPHA_DAMAGE_DEALT *= bravo._incoming_damage_multiplier(context.defender_is_structure_guard);
        BRAVO_DAMAGE_DEALT *= alpha._incoming_damage_multiplier(context.attacker_is_structure_guard);
        if is_ranged_attack {
            BRAVO_DAMAGE_DEALT = FixedTrait::ZERO();
        }

        /////////////////////////////////////////////////
        /// APPLY BATTLE DAMAGE BOOST/REDUCTION EFFECTS
        //////////////////////////////////////////////////

        if alpha.boosts.incr_damage_dealt_end_tick.into() <= current_tick {
            alpha.boosts.incr_damage_dealt_percent_num = 0;
        }
        if alpha.boosts.decr_damage_gotten_end_tick.into() <= current_tick {
            alpha.boosts.decr_damage_gotten_percent_num = 0;
        }

        if bravo.boosts.incr_damage_dealt_end_tick.into() <= current_tick {
            bravo.boosts.incr_damage_dealt_percent_num = 0;
        }
        if bravo.boosts.decr_damage_gotten_end_tick.into() <= current_tick {
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

        if is_ranged_attack {
            let half_battle_timer_length: u32 = (current_tick_interval / 2).try_into().unwrap();
            alpha.battle_cooldown_end += half_battle_timer_length;
            bravo.battle_cooldown_end += half_battle_timer_length;
            self = alpha;

            return (
                ALPHA_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
                0,
                ALPHA_STAMINA_LOSS.try_into().unwrap(),
                BRAVO_STAMINA_LOSS.try_into().unwrap(),
            );
        }

        ////////////////////////////////////
        /// STAMINA REFUND
        ////////////////////////////////////

        let alpha_refund_ratio = Self::_refund_multiplier(ALPHA_DAMAGE_DEALT, BRAVO_DAMAGE_DEALT);
        let mut alpha_stamina_loss_fixed: Fixed = ALPHA_STAMINA_LOSS.into();
        let alpha_refunded_stamina: Fixed = (alpha_stamina_loss_fixed * alpha_refund_ratio).ceil();
        ALPHA_STAMINA_LOSS -= alpha_refunded_stamina.try_into().unwrap();

        let bravo_refund_ratio = Self::_refund_multiplier(BRAVO_DAMAGE_DEALT, ALPHA_DAMAGE_DEALT);
        let mut bravo_stamina_loss_fixed: Fixed = BRAVO_STAMINA_LOSS.into();
        let bravo_refunded_stamina: Fixed = (bravo_stamina_loss_fixed * bravo_refund_ratio).ceil();
        BRAVO_STAMINA_LOSS -= bravo_refunded_stamina.try_into().unwrap();

        ////////////////////////////////////
        /// BATTLE TIMER REFUND
        ////////////////////////////////////
        let current_tick_interval_fixed: Fixed = current_tick_interval.into();
        let alpha_additional_timer_length: Fixed = current_tick_interval_fixed
            * (FixedTrait::ONE() - alpha_refund_ratio);
        alpha.battle_cooldown_end += alpha_additional_timer_length.try_into().unwrap();

        let bravo_additional_timer_length: Fixed = current_tick_interval_fixed
            * (FixedTrait::ONE() - bravo_refund_ratio);
        bravo.battle_cooldown_end += bravo_additional_timer_length.try_into().unwrap();

        self = alpha;

        (
            ALPHA_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
            BRAVO_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
            ALPHA_STAMINA_LOSS.try_into().unwrap(),
            BRAVO_STAMINA_LOSS.try_into().unwrap(),
        )
    }


    fn attack(
        ref self: Troops,
        ref bravo: Troops,
        biome: Biome,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
        current_tick_interval: u64,
    ) {
        self
            .attack_with_context(
                ref bravo,
                Self::standard_combat_context(biome),
                troop_stamina_config,
                troop_damage_config,
                current_tick,
                current_tick_interval,
            );
    }

    fn attack_with_context(
        ref self: Troops,
        ref bravo: Troops,
        context: CombatContext,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
        current_tick_interval: u64,
    ) {
        let (alpha_damage_dealt, bravo_damage_dealt, alpha_stamina_loss, bravo_stamina_loss) = self
            .damage_with_context(
                ref bravo, context, troop_stamina_config, troop_damage_config, current_tick, current_tick_interval,
            );

        let mut alpha = self;

        // deduct dead troops from each side
        alpha.count -= core::cmp::min(alpha.count, bravo_damage_dealt);
        bravo.count -= core::cmp::min(bravo.count, alpha_damage_dealt);

        // deduct stamina spent
        alpha
            .stamina
            .spend(
                ref alpha.boosts,
                alpha.category,
                alpha.tier,
                troop_stamina_config,
                alpha_stamina_loss,
                current_tick,
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
                current_tick,
                true,
            );
        self = alpha;
    }
}
