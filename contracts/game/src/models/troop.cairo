use core::num::traits::zero::Zero;
use cubit::f128::types::fixed::{Fixed, FixedTrait};
use s1_eternum::alias::ID;
use s1_eternum::constants::{RESOURCE_PRECISION, ResourceTypes};
use s1_eternum::models::config::{TroopDamageConfig, TroopStaminaConfig};
use s1_eternum::models::position::Coord;
use s1_eternum::models::stamina::{Stamina, StaminaImpl, StaminaTrait};
use s1_eternum::utils::map::biomes::Biome;
use s1_eternum::utils::math::{PercentageImpl, PercentageValueImpl};


#[derive(PartialEq, Debug, Copy, Drop, Serde, Introspect)]
pub enum TroopType {
    Knight,
    Paladin,
    Crossbowman,
}

pub impl TroopTypeIntoFelt252 of Into<TroopType, felt252> {
    fn into(self: TroopType) -> felt252 {
        match self {
            TroopType::Knight => 0,
            TroopType::Paladin => 1,
            TroopType::Crossbowman => 2,
        }
    }
}

#[derive(PartialEq, Debug, Copy, Drop, Serde, Introspect)]
pub enum TroopTier {
    T1,
    T2,
    T3,
}

pub impl TroopTierIntoFelt252 of Into<TroopTier, felt252> {
    fn into(self: TroopTier) -> felt252 {
        match self {
            TroopTier::T1 => 0,
            TroopTier::T2 => 1,
            TroopTier::T3 => 2,
        }
    }
}


#[derive(Copy, Drop, Serde, Introspect)]
pub struct Troops {
    pub category: TroopType,
    pub tier: TroopTier,
    pub count: u128,
    pub stamina: Stamina,
}


#[derive(Introspect, Copy, Drop, Serde)]
pub struct GuardTroops {
    // slot 4
    pub delta: Troops,
    // slot 3
    pub charlie: Troops,
    // slot 2
    pub bravo: Troops,
    // slot 1
    pub alpha: Troops,
    pub delta_destroyed_tick: u32,
    pub charlie_destroyed_tick: u32,
    pub bravo_destroyed_tick: u32,
    pub alpha_destroyed_tick: u32,
}


#[derive(Copy, Drop, Serde, Introspect, PartialEq)]
pub enum GuardSlot {
    Delta,
    Charlie,
    Bravo,
    Alpha,
}

#[generate_trait]
pub impl GuardImpl of GuardTrait {
    // todo: test
    fn assert_functional_slot(ref self: GuardTroops, slot: GuardSlot, max_guards: felt252) {
        let functional_slots = self.functional_slots(max_guards);
        let mut is_functional_slot: bool = false;
        for functional_slot in functional_slots {
            if functional_slot == slot {
                is_functional_slot = true;
                break;
            }
        };
        assert!(is_functional_slot, "slot can't be selected");
    }

    // todo: test
    fn functional_slots(ref self: GuardTroops, max_guards: felt252) -> Array<GuardSlot> {
        match max_guards {
            0 => panic!("max guards is 0"),
            1 => { array![GuardSlot::Delta] },
            2 => { array![GuardSlot::Delta, GuardSlot::Charlie] },
            3 => { array![GuardSlot::Delta, GuardSlot::Charlie, GuardSlot::Bravo] },
            4 => { array![GuardSlot::Delta, GuardSlot::Charlie, GuardSlot::Bravo, GuardSlot::Alpha] },
            _ => {
                panic!("max guards is greater than 4");
                array![]
            },
        }
    }

    // todo: test: critical
    fn next_attack_slot(ref self: GuardTroops, max_guards: felt252) -> Option<GuardSlot> {
        let functional_slots = self.functional_slots(max_guards);

        // Iterate through relevant slots only
        let mut i: usize = 0;
        loop {
            if i == functional_slots.len() {
                break Option::None;
            }

            let slot = *functional_slots.at(i);
            let has_troops = match slot {
                GuardSlot::Delta => self.delta.count.is_non_zero(),
                GuardSlot::Charlie => self.charlie.count.is_non_zero(),
                GuardSlot::Bravo => self.bravo.count.is_non_zero(),
                GuardSlot::Alpha => self.alpha.count.is_non_zero(),
            };

            if has_troops {
                break Option::Some(slot);
            }

            i += 1;
        }
    }

    fn reset_all_slots(ref self: GuardTroops) {
        let default_troops: Troops = Troops {
            category: TroopType::Knight, tier: TroopTier::T1, count: 0, stamina: Default::default(),
        };
        self.delta = default_troops;
        self.charlie = default_troops;
        self.bravo = default_troops;
        self.alpha = default_troops;
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


#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct ExplorerTroops {
    #[key]
    pub explorer_id: ID,
    pub owner: ID,
    pub troops: Troops,
    pub coord: Coord,
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
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (ADD, VALUE) // +x
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

    fn start_resource_amount() -> u128 {
        10 * RESOURCE_PRECISION
    }

    fn start_troop_type(biome: Biome) -> (u8, (TroopType, TroopTier)) {
        match biome {
            Biome::None => panic!("biome is not set"),
            Biome::DeepOcean => (ResourceTypes::KNIGHT_T1, (TroopType::Knight, TroopTier::T1)),
            Biome::Ocean => (ResourceTypes::KNIGHT_T1, (TroopType::Knight, TroopTier::T1)),
            Biome::Beach => (ResourceTypes::KNIGHT_T1, (TroopType::Knight, TroopTier::T1)),
            Biome::Scorched => (ResourceTypes::KNIGHT_T1, (TroopType::Knight, TroopTier::T1)),
            Biome::Bare => (ResourceTypes::PALADIN_T1, (TroopType::Paladin, TroopTier::T1)),
            Biome::Tundra => (ResourceTypes::PALADIN_T1, (TroopType::Paladin, TroopTier::T1)),
            Biome::Snow => (ResourceTypes::PALADIN_T1, (TroopType::Paladin, TroopTier::T1)),
            Biome::TemperateDesert => (ResourceTypes::PALADIN_T1, (TroopType::Paladin, TroopTier::T1)),
            Biome::Shrubland => (ResourceTypes::PALADIN_T1, (TroopType::Paladin, TroopTier::T1)),
            Biome::Taiga => (ResourceTypes::CROSSBOWMAN_T1, (TroopType::Crossbowman, TroopTier::T1)),
            Biome::Grassland => (ResourceTypes::PALADIN_T1, (TroopType::Paladin, TroopTier::T1)),
            Biome::TemperateDeciduousForest => (ResourceTypes::CROSSBOWMAN_T1, (TroopType::Crossbowman, TroopTier::T1)),
            Biome::TemperateRainForest => (ResourceTypes::CROSSBOWMAN_T1, (TroopType::Crossbowman, TroopTier::T1)),
            Biome::SubtropicalDesert => (ResourceTypes::PALADIN_T1, (TroopType::Paladin, TroopTier::T1)),
            Biome::TropicalSeasonalForest => (ResourceTypes::CROSSBOWMAN_T1, (TroopType::Crossbowman, TroopTier::T1)),
            Biome::TropicalRainForest => (ResourceTypes::CROSSBOWMAN_T1, (TroopType::Crossbowman, TroopTier::T1)),
        }
    }

    fn _effective_beta(total_troop_count: Fixed, damage_config: TroopDamageConfig) -> Fixed {
        let BETA_SMALL: Fixed = FixedTrait::new(damage_config.damage_beta_small.into(), false);
        let BETA_LARGE: Fixed = FixedTrait::new(damage_config.damage_beta_large.into(), false);
        let C0: Fixed = FixedTrait::new(damage_config.damage_c0.into(), false);
        let DELTA: Fixed = FixedTrait::new(damage_config.damage_delta.into(), false);
        let ONE: Fixed = FixedTrait::ONE();
        let TWO: Fixed = ONE + ONE;
        let TANH: Fixed = FixedTrait::tanh((total_troop_count - C0) / DELTA) + ONE;
        let TANH_DIV_TWO: Fixed = TANH / TWO;
        let BETA_DIFF: Fixed = BETA_SMALL - BETA_LARGE;
        let BETA_MULT: Fixed = BETA_DIFF * TANH_DIV_TWO;
        let BETA_EFF: Fixed = BETA_SMALL - BETA_MULT;
        return BETA_EFF;
    }

    fn damage(
        ref self: Troops,
        ref bravo: Troops,
        biome: Biome,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
    ) -> (u128, u128) {
        assert!(self.count.is_non_zero(), "you have no troops");
        assert!(bravo.count.is_non_zero(), "the defender has no troops");
        assert!(biome != Biome::None, "biome is not set");

        let mut alpha = self;

        // update alpha and bravo's staminas
        alpha.stamina.refill(alpha.category, troop_stamina_config, current_tick);
        bravo.stamina.refill(bravo.category, troop_stamina_config, current_tick);

        // ensure alpha has enough stamina to launch attack
        assert!(
            alpha.stamina.amount >= troop_stamina_config.stamina_attack_req.into(),
            "you have {} stamina, but need {} to launch attack",
            alpha.stamina.amount,
            troop_stamina_config.stamina_attack_req,
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
            let _0_POINT_7: Fixed = FixedTrait::new(12912720851596686131, false);
            let _0_POINT_3: Fixed = FixedTrait::new(5534023222112865485, false); // they sum up to 1
            BRAVO_STAMINA_BONUS_DAMAGE_MULTIPLIER = _0_POINT_7
                + (_0_POINT_3 * bravo.stamina.amount.into() / troop_stamina_config.stamina_attack_req.into());
        }

        // calculate damage dealt from alpha to bravo and vice versa
        let BASE_DAMAGE_FACTOR: Fixed = FixedTrait::new(troop_damage_config.damage_scaling_factor, false);
        let ALPHA_NUM_TROOPS: Fixed = (self.count / RESOURCE_PRECISION).into();
        let ALPHA_TIER_BONUS: Fixed = self._tier_bonus(troop_damage_config).into();
        let ALPHA_BIOME_BONUS_DAMAGE_MULTIPLIER: Fixed = alpha._biome_damage_bonus(biome, troop_damage_config);
        let BRAVO_NUM_TROOPS: Fixed = (bravo.count / RESOURCE_PRECISION).into();
        let BRAVO_TIER_BONUS: Fixed = bravo._tier_bonus(troop_damage_config).into();
        let BRAVO_BIOME_BONUS_DAMAGE_MULTIPLIER: Fixed = bravo._biome_damage_bonus(biome, troop_damage_config);
        let TOTAL_NUM_TROOPS: Fixed = ALPHA_NUM_TROOPS + BRAVO_NUM_TROOPS;
        let EFFECTIVE_BETA: Fixed = Self::_effective_beta(TOTAL_NUM_TROOPS, troop_damage_config);
        let BRAVO_DAMAGE_DEALT: Fixed = (BASE_DAMAGE_FACTOR
            * BRAVO_NUM_TROOPS
            * BRAVO_TIER_BONUS
            * BRAVO_BIOME_BONUS_DAMAGE_MULTIPLIER
            * BRAVO_STAMINA_BONUS_DAMAGE_MULTIPLIER
            / ALPHA_TIER_BONUS
            / TOTAL_NUM_TROOPS.pow(EFFECTIVE_BETA));

        let ALPHA_DAMAGE_DEALT: Fixed = (BASE_DAMAGE_FACTOR
            * ALPHA_NUM_TROOPS
            * ALPHA_TIER_BONUS
            * ALPHA_STAMINA_BONUS_DAMAGE_MULTIPLIER
            * ALPHA_BIOME_BONUS_DAMAGE_MULTIPLIER
            / BRAVO_TIER_BONUS
            / TOTAL_NUM_TROOPS.pow(EFFECTIVE_BETA));

        self = alpha;

        (
            ALPHA_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
            BRAVO_DAMAGE_DEALT.round().try_into().unwrap() * RESOURCE_PRECISION,
        )
    }


    fn attack(
        ref self: Troops,
        ref bravo: Troops,
        biome: Biome,
        troop_stamina_config: TroopStaminaConfig,
        troop_damage_config: TroopDamageConfig,
        current_tick: u64,
    ) {
        let (alpha_damage_dealt, bravo_damage_dealt) = self
            .damage(ref bravo, biome, troop_stamina_config, troop_damage_config, current_tick);

        let mut alpha = self;

        // deduct dead troops from each side
        alpha.count -= core::cmp::min(alpha.count, bravo_damage_dealt);
        bravo.count -= core::cmp::min(bravo.count, alpha_damage_dealt);

        // deduct stamina spent
        alpha
            .stamina
            .spend(
                alpha.category,
                troop_stamina_config,
                troop_stamina_config.stamina_attack_req.into(),
                current_tick,
                true,
            );
        bravo
            .stamina
            .spend(
                bravo.category,
                troop_stamina_config,
                troop_stamina_config.stamina_attack_req.into(),
                current_tick,
                false,
            );

        // grant stamina to victor
        if alpha.count.is_zero() || bravo.count.is_zero() {
            if alpha.count.is_non_zero() {
                alpha
                    .stamina
                    .add(
                        alpha.category,
                        troop_stamina_config,
                        troop_stamina_config.stamina_attack_req.into(),
                        current_tick,
                    );
            }
            if bravo.count.is_non_zero() {
                // todo: do we grant stamina here when they originally had none
                bravo
                    .stamina
                    .add(
                        bravo.category,
                        troop_stamina_config,
                        troop_stamina_config.stamina_attack_req.into(),
                        current_tick,
                    );
            }
        }

        self = alpha;
    }
}

#[cfg(test)]
mod tests {
    use cubit::f128::types::fixed::{FixedTrait};
    use s1_eternum::constants::{RESOURCE_PRECISION};
    use s1_eternum::models::config::{TroopDamageConfig, TroopLimitConfig, TroopStaminaConfig};
    use s1_eternum::models::stamina::{Stamina, StaminaImpl};
    use s1_eternum::models::troop::{TroopTier, TroopType, Troops, TroopsTrait};
    use s1_eternum::utils::map::biomes::{Biome};


    const KNIGHT_MAX_STAMINA: u16 = 120;
    const CROSSBOWMAN_MAX_STAMINA: u16 = 120;
    const PALADIN_MAX_STAMINA: u16 = 140;

    fn TROOP_DAMAGE_CONFIG() -> TroopDamageConfig {
        TroopDamageConfig {
            t1_damage_value: 1844674407370955161600, // 100
            t2_damage_multiplier: 46116860184273879040, // 2.5
            t3_damage_multiplier: 129127208515966861312, // 7
            damage_biome_bonus_num: 3_000, // 30% // percentage bonus for biome damage
            damage_scaling_factor: 64563604257983430656, // 3.5
            damage_beta_small: 4611686018427387904, // 0.25
            damage_beta_large: 2213609288845146193, // 0.12
            damage_c0: 100_000 * FixedTrait::ONE().mag,
            damage_delta: 50_000 * FixedTrait::ONE().mag,
            damage_raid_percent_num: 5 // Added default value
        }
    }

    fn TROOP_STAMINA_CONFIG() -> TroopStaminaConfig {
        TroopStaminaConfig {
            stamina_gain_per_tick: 20,
            stamina_initial: 20,
            stamina_bonus_value: 20, // stamina biome bonus (defaults to stamina per tick)
            stamina_knight_max: KNIGHT_MAX_STAMINA,
            stamina_paladin_max: PALADIN_MAX_STAMINA,
            stamina_crossbowman_max: CROSSBOWMAN_MAX_STAMINA,
            stamina_attack_req: 30,
            stamina_attack_max: 60,
            stamina_explore_wheat_cost: 780,
            stamina_explore_fish_cost: 440,
            stamina_explore_stamina_cost: 30, // 30 stamina per hex
            stamina_travel_wheat_cost: 234,
            stamina_travel_fish_cost: 885,
            stamina_travel_stamina_cost: 20 // 20 stamina per hex 
        }
    }

    fn TROOP_LIMIT_CONFIG() -> TroopLimitConfig {
        TroopLimitConfig {
            explorer_max_party_count: 20, // hard max of explorers per structure
            explorer_guard_max_troop_count: 500_000, // hard max of troops per party
            guard_resurrection_delay: 24 * 60 * 60, // delay in seconds before a guard can be resurrected
            mercenaries_troop_lower_bound: 100_000, // min of troops per mercenary
            mercenaries_troop_upper_bound: 100_000, // max of troops per mercenary
            agents_troop_lower_bound: 0_u32, // Added default value
            agents_troop_upper_bound: 100_000 // Added default value
        }
    }


    #[test]
    fn tests_troop_attack_simple_1() {
        let mut alpha = Troops {
            category: TroopType::Crossbowman,
            tier: TroopTier::T1,
            count: 1 * RESOURCE_PRECISION,
            stamina: Stamina { amount: 100, updated_tick: 1 },
        };
        let mut bravo = Troops {
            category: TroopType::Paladin,
            tier: TroopTier::T1,
            count: 500_000 * RESOURCE_PRECISION,
            stamina: Stamina { amount: 100, updated_tick: 1 },
        };

        alpha.attack(ref bravo, Biome::DeepOcean, TROOP_STAMINA_CONFIG(), TROOP_DAMAGE_CONFIG(), 1);

        assert_eq!(alpha.count, 0);
        assert_eq!(bravo.count, 499_999 * RESOURCE_PRECISION);
        assert_eq!(bravo.stamina.amount, 100);
    }

    #[test]
    fn tests_troop_attack_simple_2() {
        let mut alpha = Troops {
            category: TroopType::Knight,
            tier: TroopTier::T2, // Tier 2
            count: 61_293 * RESOURCE_PRECISION,
            stamina: Stamina { amount: 100, updated_tick: 1 },
        };
        let mut bravo = Troops {
            category: TroopType::Crossbowman,
            tier: TroopTier::T1, // Tier 1
            count: 159_303 * RESOURCE_PRECISION,
            stamina: Stamina { amount: 100, updated_tick: 1 },
        };

        alpha.attack(ref bravo, Biome::DeepOcean, TROOP_STAMINA_CONFIG(), TROOP_DAMAGE_CONFIG(), 1);

        assert_eq!(alpha.count, 0);
        assert_eq!(bravo.count, 2_052 * RESOURCE_PRECISION);
        assert_eq!(bravo.stamina.amount, 100);
    }
}
