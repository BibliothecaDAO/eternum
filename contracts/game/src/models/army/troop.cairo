use cubit::f128::types::fixed::{Fixed, FixedTrait};
use s1_eternum::alias::ID;
use starknet::ContractAddress;


#[derive(Copy, Drop, Serde, Default)]
enum TroopType {
    Knight,
    Paladin,
    Crossbowman,
}

#[derive(Copy, Drop, Serde, Default)]
enum TroopTier {
    T1,
    T2,
    T3,
}


#[derive(Copy, Drop, Serde, Introspect, Debug, PartialEq, Default)]
struct Troops {
    category: TroopType,
    tier: TroopTier,
    health: u64,
    stamina: Stamina,
    weight: Weeeight
}


#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct GuardTroops {
    #[key]
    structure_id: ID,
    slot_1: Troops,
    slot_2: Troops,
    slot_3: Troops,
    slot_4: Troops,
    defeated_at: u128,
    defeated_slot: u8,
}


#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct ExplorerTroops {
    #[key]
    explorer_id: ID,
    owner: EntityOwner,
    troops: Troops,
    coord: Coord,
    travel: Travel
}


#[derive(Copy, Drop, Serde, IntrospectPacked, Debug, PartialEq, Default)]
struct CombatConfig {
    //
    knight_base_damage: u16,
    crossbowman_base_damage: u16,
    paladin_base_damage: u16,
    //
    knight_base_stamina: u16,
    paladin_base_stamina: u16,
    crossbowman_base_stamina: u16,
    //
    damage_bonus_num: u16,
    stamina_bonus_value: u16,
    //
    stamina_maximum: u16,

}

#[generate_trait]
impl CombatConfigImpl of CombatConfigTrait {





 
    

    fn stamina(ref self: CombatConfig, troop: Troops, biome: Biome) -> u16 {
        let base_stamina = self._base_stamina(troop.category);

        let stamina = match troop.tier {
            TroopTier::T1 => base_stamina,
            TroopTier::T2 => base_stamina * 2_500,
            TroopTier::T3 => base_stamina * 2_800,
        };

        stamina * troop.count
    }
}d


#[generate_trait]
impl TroopsImpl of TroopsTrait {

    fn _base_damage(config: CombatConfig, category: TroopType) -> u128 {
        match category {
            TroopType::Knight => config.knight_base_damage,
            TroopType::Paladin => config.paladin_base_damage,
            TroopType::Crossbowman => config.crossbowman_base_damage,
        }
    }


    fn _base_stamina(config: CombatConfig, category: TroopType) -> u16 {
        match category {
            TroopType::Knight => config.knight_base_stamina,
            TroopType::Paladin => config.paladin_base_stamina,
            TroopType::Crossbowman => config.crossbowman_base_stamina,
        }
    }

    fn _damage_inflicted_by(ref self: Troops, biome: Biome, config: CombatConfig) -> u128 {
        let base_damage = config._base_damage(self.category);

        let damage = match self.tier {
            TroopTier::T1 => base_damage,
            TroopTier::T2 => base_damage * 2_500 / 1_000,
            TroopTier::T3 => base_damage * 2_800 / 1_000,
        };

        let mut damage = damage * self.count;
        let (damage_bonus_sign, damage_bonus_num) = self._damage_bonus(biome, config);
        if damage_bonus_num.is_non_zero() {
            let damage_bonus = PercentageImpl::get(damage, damage_bonus_num.into());
            if damage_bonus_sign {
                damage = damage + damage_bonus;
            } else {
                damage = damage - damage_bonus;
            }
        }

        damage
    }

    fn _damage_bonus(ref self: Troops, biome: Biome, config: CombatConfig) -> (bool, u16) {
        let ZERO: u16 = 0;
        let VALUE: u16 = config.damage_bonus_num;
        let ADD: bool = true;
        let SUBTRACT: bool = false;
        let NEUTRAL: bool = false;

        match biome {
            Biome::DeepOcean => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE), // -x
                },
            },
            
            Biome::Ocean => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE), // -x
                },
            },
            Biome::Beach => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (NEUTRAL, ZERO), // 0
                },
            },
            Biome::Scorched => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (NEUTRAL, ZERO), // 0
                },
            },
            Biome::Bare => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (NEUTRAL, ZERO), // 0
                },
            },
            Biome::Tundra => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (NEUTRAL, ZERO), // 0
                },
            },
            Biome::Snow => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +x
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -x
                    TroopType::Paladin => (NEUTRAL, ZERO), // 0
                },
            },
            Biome::TemperateDesert => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +x
                },
            },
            Biome::Shrubland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +x
                },
            },
            Biome::Taiga => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE), // -x
                },
            },
            Biome::Grassland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +x
                },
            },
            Biome::TemperateDeciduousForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE), // -x
                },
            },
            Biome::TemperateRainForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE), // -x
                },
            },
            Biome::SubtropicalDesert => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +x
                },
            },
            Biome::TropicalSeasonalForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE), // -x
                },
            },
            Biome::TropicalRainForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (ADD, VALUE), // +x
                    TroopType::Paladin => (SUBTRACT, VALUE), // -x
                },
            },
        }
    }

    fn _stamina_bonus(ref self: Troops, biome: Biome, config: CombatConfig) -> (bool, u16) {
        let ZERO: u16 = 0;
        let VALUE: u16 = config.stamina_bonus_value;
        let ADD: bool = true;
        let SUBTRACT: bool = false;
        let NEUTRAL: bool = false;

        match biome {
            Biome::DeepOcean => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // 0
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE), // 0
                },
            },
            
            Biome::Ocean => {
                match self.category {
                    TroopType::Knight => (SUBTRACT, VALUE), // -1
                    TroopType::Crossbowman => (SUBTRACT, VALUE), // -1
                    TroopType::Paladin => (SUBTRACT, VALUE), // -1
                },
            },
            Biome::Beach => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (NEUTRAL, ZERO), // 0
                },
            },
            Biome::Scorched => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +1
                    TroopType::Crossbowman => (ADD, VALUE), // +1
                    TroopType::Paladin => (ADD, VALUE), // +1
                },
            },
            Biome::Bare => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE), // -1
                },
            },
            Biome::Tundra => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE), // -1
                },
            },
            Biome::Snow => {
                match self.category {
                    TroopType::Knight => (ADD, VALUE), // +1
                    TroopType::Crossbowman => (ADD, VALUE), // +1
                    TroopType::Paladin => (NEUTRAL, ZERO), // 0
                },
            },
            Biome::TemperateDesert => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE), // -1
                },
            },
            Biome::Shrubland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE), // -1
                },
            },
            Biome::Taiga => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +1
                },
            },
            Biome::Grassland => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE), // -1
                },
            },
            Biome::TemperateDeciduousForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +1
                },
            },
            Biome::TemperateRainForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +1
                },
            },
            Biome::SubtropicalDesert => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (SUBTRACT, VALUE), // -1
                },
            },
            Biome::TropicalSeasonalForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +1
                },
            },
            Biome::TropicalRainForest => {
                match self.category {
                    TroopType::Knight => (NEUTRAL, ZERO), // 0
                    TroopType::Crossbowman => (NEUTRAL, ZERO), // 0
                    TroopType::Paladin => (ADD, VALUE), // +1
                },
            },
        }
    }

    fn attack(ref self: Troops, other: Troops, combat_config: CombatConfig) {

        // deduct damage received by attacking troop from defending troop
        let self_damage_received = combat_config.damage_inflicted_by(other);
        self.deduct_health(self_damage_received);

        // deduct damage received by defending troop from attacking troop
        let other_damage_received = combat_config.damage_inflicted_by(self);
        other.deduct_health(other_damage_received);

        // let self_stamina = combat_config.stamina(self);
        // let other_stamina = combat_config.stamina(other);

        // self.deduct_stamina(self_stamina);
        // other.deduct_stamina(other_stamina);
    }


    fn deduct_health(ref self: Troops, health: u128, damage: u128) {
        if damage > health {
            self.health = 0;
        } else {
            self.health = health - damage;
        }
    }

}
