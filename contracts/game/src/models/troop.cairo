use cubit::f128::types::fixed::{Fixed, FixedTrait, HALF_u128, ONE_u128};
use s1_eternum::alias::ID;
use s1_eternum::constants::RESOURCE_PRECISION;
use s1_eternum::models::config::{TroopDamageConfig, TroopStaminaConfig};
use s1_eternum::models::owner::EntityOwner;
use s1_eternum::models::position::Coord;
use s1_eternum::models::stamina::{Stamina, StaminaImpl, StaminaTrait};
use s1_eternum::utils::map::biomes::Biome;
use s1_eternum::utils::math::{PercentageImpl, PercentageValueImpl};

use starknet::ContractAddress;


#[derive(Copy, Drop, Serde, IntrospectPacked)]
enum TroopType {
    Knight,
    Paladin,
    Crossbowman,
}

impl TroopTypeIntoFelt252 of Into<TroopType, felt252> {
    fn into(self: TroopType) -> felt252 {
        match self {
            TroopType::Knight => 0,
            TroopType::Paladin => 1,
            TroopType::Crossbowman => 2,
        }
    }
}

#[derive(Copy, Drop, Serde, IntrospectPacked)]
enum TroopTier {
    T1,
    T2,
    T3,
}

impl TroopTierIntoFelt252 of Into<TroopTier, felt252> {
    fn into(self: TroopTier) -> felt252 {
        match self {
            TroopTier::T1 => 0,
            TroopTier::T2 => 1,
            TroopTier::T3 => 2,
        }
    }
}


#[derive(Copy, Drop, Serde, IntrospectPacked)]
struct Troops {
    category: TroopType,
    tier: TroopTier,
    count: u128,
    stamina: Stamina,
}


#[derive(Introspect, Copy, Drop, Serde)]
pub struct GuardTroops {
    // slot 4
    delta: Troops,
    // slot 3
    charlie: Troops,
    // slot 2
    bravo: Troops,
    // slot 1
    alpha: Troops,
    delta_destroyed_tick: u32,
    charlie_destroyed_tick: u32,
    bravo_destroyed_tick: u32,
    alpha_destroyed_tick: u32,
}


#[derive(Copy, Drop, Serde, Introspect, PartialEq)]
enum GuardSlot {
    Delta,
    Charlie,
    Bravo,
    Alpha,
}

#[generate_trait]
pub impl GuardImpl of GuardTrait {
    fn next_attack_slot(ref self: GuardTroops) -> Option<GuardSlot> {
        if self.delta.count.is_non_zero() {
            return Option::Some(GuardSlot::Delta);
        }

        if self.charlie.count.is_non_zero() {
            return Option::Some(GuardSlot::Charlie);
        }

        if self.bravo.count.is_non_zero() {
            return Option::Some(GuardSlot::Bravo);
        }

        if self.alpha.count.is_non_zero() {
            return Option::Some(GuardSlot::Alpha);
        }
        return Option::None;
    }

    fn from_slot(self: GuardTroops, slot: GuardSlot) -> (Troops, u32) {
        match slot {
            GuardSlot::Delta => (self.delta, self.delta_destroyed_tick),
            GuardSlot::Charlie => (self.charlie, self.charlie_destroyed_tick),
            GuardSlot::Bravo => (self.bravo, self.bravo_destroyed_tick),
            GuardSlot::Alpha => (self.alpha, self.alpha_destroyed_tick),
        }
    }

    fn to_slot(ref self: GuardTroops, slot: GuardSlot, troops: Troops, destroyed_tick: u64) {
        match slot {
            GuardSlot::Delta => {
                self.delta = troops;
                self.delta_destroyed_tick = destroyed_tick.try_into().unwrap();
            },
            GuardSlot::Charlie => {
                self.charlie = troops;
                self.charlie_destroyed_tick = destroyed_tick.try_into().unwrap();
            },
            GuardSlot::Bravo => {
                self.bravo = troops;
                self.bravo_destroyed_tick = destroyed_tick.try_into().unwrap();
            },
            GuardSlot::Alpha => {
                self.alpha = troops;
                self.alpha_destroyed_tick = destroyed_tick.try_into().unwrap();
            },
        }
    }
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct ExplorerTroops {
    #[key]
    explorer_id: ID,
    owner: EntityOwner,
    troops: Troops,
    coord: Coord,
}


#[generate_trait]
impl TroopsImpl of TroopsTrait {
    fn _base_damage(ref self: Troops, troop_damage_config: TroopDamageConfig) -> u16 {
        match self.category {
            TroopType::Knight => troop_damage_config.knight_base_damage,
            TroopType::Paladin => troop_damage_config.paladin_base_damage,
            TroopType::Crossbowman => troop_damage_config.crossbowman_base_damage,
        }
    }


    fn _tier_bonus(ref self: Troops, troop_damage_config: TroopDamageConfig) -> Fixed {
        match self.tier {
            TroopTier::T1 => 1_u8.into(),
            TroopTier::T2 => 1_u8.into() * troop_damage_config.t2_damage_bonus.into(),
            TroopTier::T3 => 1_u8.into() * troop_damage_config.t3_damage_bonus.into(),
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
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::Scorched => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::Bare => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::Tundra => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::Snow => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (NEUTRAL, ZERO) // 0
                }
            },
            Biome::TemperateDesert => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::Shrubland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::Taiga => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::Grassland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::TemperateDeciduousForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::TemperateRainForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::SubtropicalDesert => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE) // +x
                }
            },
            Biome::TropicalSeasonalForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
                }
            },
            Biome::TropicalRainForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE) // -x
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

    fn stamina_movement_bonus(ref self: Troops, biome: Biome, troop_stamina_config: TroopStaminaConfig) -> (bool, u16) {
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
                    TroopType::Knight => (ADD, VALUE), // +1
                    TroopType::Crossbowman => (ADD, VALUE), // +1
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
        }
    }

    fn attack(
        ref self: Troops,
        ref bravo: Troops,
        biome: Biome,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
    ) {
        let mut alpha = self;

        // update alpha and bravo's staminas
        alpha.stamina.refill(alpha.category, troop_stamina_config, current_tick);
        bravo.stamina.refill(bravo.category, troop_stamina_config, current_tick);

        // ensure alpha has enough stamina to launch attack
        assert!(
            alpha.stamina.amount >= troop_stamina_config.stamina_attack_req.into(),
            "stamina is not enough to attack (1)",
        );

        // calculate alpha's stamina based damage boost
        let max_additional_stamina = troop_stamina_config.stamina_attack_max.into()
            - troop_stamina_config.stamina_attack_req.into();
        let alpha_additional_stamina_for_damage = core::cmp::min(
            alpha.stamina.amount - troop_stamina_config.stamina_attack_req.into(), max_additional_stamina,
        );
        let ALPHA_STAMINA_BONUS_DAMAGE_MULTIPLIER: Fixed = 1_u8.into()
            + (alpha_additional_stamina_for_damage.into() / 100_u8.into());

        // calculate bravo's stamina based damage penalty
        let mut BRAVO_STAMINA_BONUS_DAMAGE_MULTIPLIER: Fixed = 1_u8.into();
        let bravo_stamina_for_damage: u128 = core::cmp::min(
            bravo.stamina.amount.into(), troop_stamina_config.stamina_attack_req.into(),
        );
        if bravo_stamina_for_damage < troop_stamina_config.stamina_attack_req.into() {
            BRAVO_STAMINA_BONUS_DAMAGE_MULTIPLIER = HALF_u128.into()
                + (HALF_u128.into() * bravo.stamina.amount.into() / troop_stamina_config.stamina_attack_req.into());
        }

        // calculate damage dealt from alpha to bravo and vice versa
        let ALPHA_BASE_DAMAGE: Fixed = self._base_damage(troop_damage_config).into();
        let ALPHA_NUM_TROOPS: Fixed = self.count.into();
        let ALPHA_TIER_BONUS: Fixed = self._tier_bonus(troop_damage_config).into();
        let ALPHA_BIOME_BONUS_DAMAGE_MULTIPLIER: Fixed = alpha._biome_damage_bonus(biome, troop_damage_config);

        let BRAVO_BASE_DAMAGE: Fixed = bravo._base_damage(troop_damage_config).into();
        let BRAVO_NUM_TROOPS: Fixed = bravo.count.into();
        let BRAVO_TIER_BONUS: Fixed = bravo._tier_bonus(troop_damage_config).into();
        let BRAVO_BIOME_BONUS_DAMAGE_MULTIPLIER: Fixed = bravo._biome_damage_bonus(biome, troop_damage_config);

        let TOTAL_NUM_TROOPS: Fixed = ALPHA_NUM_TROOPS + BRAVO_NUM_TROOPS;
        let damage_scaling_factor: Fixed = FixedTrait::new_unscaled(
            troop_damage_config.damage_scaling_factor.into(), false,
        );

        let BRAVO_DAMAGE_DEALT: Fixed = (BRAVO_STAMINA_BONUS_DAMAGE_MULTIPLIER
            * BRAVO_BIOME_BONUS_DAMAGE_MULTIPLIER
            * BRAVO_BASE_DAMAGE
            * BRAVO_NUM_TROOPS
            * BRAVO_TIER_BONUS
            / ALPHA_TIER_BONUS
            / TOTAL_NUM_TROOPS.pow(damage_scaling_factor));

        let ALPHA_DAMAGE_DEALT: Fixed = (ALPHA_STAMINA_BONUS_DAMAGE_MULTIPLIER
            * ALPHA_BIOME_BONUS_DAMAGE_MULTIPLIER
            * ALPHA_BASE_DAMAGE
            * ALPHA_NUM_TROOPS
            * ALPHA_TIER_BONUS
            / BRAVO_TIER_BONUS
            / TOTAL_NUM_TROOPS.pow(damage_scaling_factor));

        // deduct dead troops from each side
        alpha.count -= core::cmp::min(alpha.count, BRAVO_DAMAGE_DEALT.try_into().unwrap());
        alpha.count -= alpha.count % RESOURCE_PRECISION; // round down to the nearest whole troop

        bravo.count -= core::cmp::min(bravo.count, ALPHA_DAMAGE_DEALT.try_into().unwrap());
        bravo.count -= bravo.count % RESOURCE_PRECISION; // round down to the nearest whole troop

        // deduct alpha's stamina spent
        let mut alpha_extra_stamina_spent: u64 = alpha_additional_stamina_for_damage;
        if (BRAVO_DAMAGE_DEALT / ALPHA_DAMAGE_DEALT) <= HALF_u128.into() {
            alpha_extra_stamina_spent =
                (BRAVO_DAMAGE_DEALT * 2_u8.into() * alpha_additional_stamina_for_damage.into() / ALPHA_DAMAGE_DEALT)
                .try_into()
                .unwrap();
        }
        alpha
            .stamina
            .spend(
                alpha.category,
                troop_stamina_config,
                troop_stamina_config.stamina_attack_req.into() + alpha_extra_stamina_spent,
                current_tick,
            );

        // deduct bravo's stamina spent
        let mut bravo_stamina_spent: u64 = troop_stamina_config.stamina_attack_req.into();
        if (ALPHA_DAMAGE_DEALT / BRAVO_DAMAGE_DEALT) <= HALF_u128.into() {
            bravo_stamina_spent =
                (ALPHA_DAMAGE_DEALT * troop_stamina_config.stamina_attack_max.into() / BRAVO_DAMAGE_DEALT)
                .try_into()
                .unwrap();
        }
        bravo.stamina.spend(bravo.category, troop_stamina_config, bravo_stamina_spent, current_tick);
    }
}
