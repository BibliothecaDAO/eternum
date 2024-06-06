use core::option::OptionTrait;
use core::traits::Into;
use core::traits::TryInto;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::config::{BattleConfig, BattleConfigImpl, BattleConfigTrait};
use eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};
use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
use eternum::utils::math::{PercentageImpl, PercentageValueImpl};
use eternum::utils::number::NumberTrait;

const STRENGTH_PRECISION: u256 = 10_000;

#[derive(Model, Copy, Drop, Serde, Default)]
struct Health {
    #[key]
    entity_id: u128,
    current: u128,
    lifetime: u128
}

#[generate_trait]
impl HealthImpl of HealthTrait {
    fn increase_by(ref self: Health, value: u128) {
        self.current += value;
        self.lifetime += value;
    }

    fn decrease_by(ref self: Health, value: u128) {
        if self.current > value {
            self.current -= value;
        } else {
            self.current = 0;
        }
    }
    fn is_alive(self: Health) -> bool {
        self.current > 0
    }

    fn assert_alive(self: Health) {
        assert(self.is_alive(), 'Entity is dead');
    }

    fn steps_to_finish(self: @Health, mut deduction: u128) -> u128 {
        assert!(deduction != 0, "deduction value is 0");

        let hour_to_seconds = 60 * 60;
        let mut num_steps = *self.current * hour_to_seconds / deduction;
        if (num_steps % deduction) > 0 {
            num_steps += 1;
        }

        if num_steps == 0 {
            num_steps += 1;
        }
        num_steps
    }

    fn percentage_left(self: Health) -> u128 {
        self.current * PercentageValueImpl::_100().into() / (self.lifetime + 1)
    }
}


#[derive(Copy, Drop, Serde, Introspect, Default)]
struct Troops {
    knight_count: u32,
    paladin_count: u32,
    crossbowman_count: u32,
}


#[generate_trait]
impl TroopsImpl of TroopsTrait {
    fn add(ref self: Troops, other: Troops) {
        self.knight_count += other.knight_count;
        self.paladin_count += other.paladin_count;
        self.crossbowman_count += other.crossbowman_count;
    }

    fn deduct(ref self: Troops, other: Troops) {
        self.knight_count -= other.knight_count;
        self.paladin_count -= other.paladin_count;
        self.crossbowman_count -= other.crossbowman_count;
    }

    fn full_health(self: Troops, troop_config: TroopConfig) -> u128 {
        let knight_count: u128 = self.knight_count.into();
        let paladin_count: u128 = self.paladin_count.into();
        let crossbowman_count: u128 = self.crossbowman_count.into();
        let total_knight_health: u128 = troop_config.knight_health.into() * knight_count;
        let total_paladin_health: u128 = troop_config.paladin_health.into() * paladin_count;
        let total_crossbowman_health: u128 = troop_config.crossbowman_health.into()
            * crossbowman_count;

        total_knight_health + total_paladin_health + total_crossbowman_health
    }


    fn full_strength(self: Troops, troop_config: TroopConfig) -> u128 {
        let knight_count: u128 = self.knight_count.into();
        let paladin_count: u128 = self.paladin_count.into();
        let crossbowman_count: u128 = self.crossbowman_count.into();
        let total_knight_strength: u128 = troop_config.knight_strength.into() * knight_count;
        let total_paladin_strength: u128 = troop_config.paladin_strength.into() * paladin_count;
        let total_crossbowman_strength: u128 = troop_config.crossbowman_strength.into()
            * crossbowman_count;

        total_knight_strength + total_paladin_strength + total_crossbowman_strength
    }


    fn purchase(
        self: Troops, purchaser_id: u128, troops_resources: (Resource, Resource, Resource),
    ) -> (Resource, Resource, Resource) {
        let (mut knight_resource, mut paladin_resoure, mut crossbowman_resoure) = troops_resources;

        knight_resource.burn(self.knight_count.into());
        paladin_resoure.burn(self.paladin_count.into());
        crossbowman_resoure.burn(self.crossbowman_count.into());

        return (knight_resource, paladin_resoure, crossbowman_resoure);
    }


    fn delta(self: @Troops, enemy_troops: @Troops, troop_config: TroopConfig) -> (u64, u64) {
        let self_delta: i128 = self.strength_against(enemy_troops, troop_config);
        let self_delta_positive: u64 = Into::<i128, felt252>::into(self_delta.abs())
            .try_into()
            .unwrap();

        let enemy_delta: i128 = enemy_troops.strength_against(self, troop_config);
        let enemy_delta_positive: u64 = Into::<i128, felt252>::into(enemy_delta.abs())
            .try_into()
            .unwrap();

        // the multiplication by 4 limits the duration to about 
        // 10 hours 42 mintes and 51 seconds (38571 seconds)max.
        // without it, battles will have a maximum of about 42 hours so we reduced it by 4.
        // this can be derived by setting both armies to have the same exact num of troops e.g 1:1
        return ((enemy_delta_positive * 4) + 1, (self_delta_positive * 4) + 1);
    }

    /// @dev Calculates the net combat strength of one troop against another, factoring in troop-specific strengths and advantages/disadvantages.
    /// @param self Reference to the instance of the Troops struct representing the attacking troops.
    /// @param enemy_troops Reference to the instance of the Troops struct representing the defending troops.
    /// @param troop_config Configuration object containing strength and advantage/disadvantage percentages for each troop type.
    /// @return The net combat strength as an integer, where a positive number indicates a strength advantage for the attacking troops.
    fn strength_against(self: @Troops, enemy_troops: @Troops, troop_config: TroopConfig) -> i128 {
        let self = *self;
        let enemy_troops = *enemy_troops;

        //////////////////////////////////////////////////////////////////////////////////////////

        let mut self_knight_strength: u64 = troop_config.knight_strength.into();
        self_knight_strength *= self.knight_count.into();
        self_knight_strength =
            PercentageImpl::get(self_knight_strength.into(), troop_config.advantage_percent.into());

        let mut self_paladin_strength: u64 = troop_config.paladin_strength.into();
        self_paladin_strength *= self.paladin_count.into();
        self_paladin_strength =
            PercentageImpl::get(
                self_paladin_strength.into(), troop_config.advantage_percent.into()
            );

        let mut self_crossbowman_strength: u64 = troop_config.crossbowman_strength.into();
        self_crossbowman_strength *= self.crossbowman_count.into();
        self_crossbowman_strength =
            PercentageImpl::get(
                self_crossbowman_strength.into(), troop_config.advantage_percent.into()
            );

        //////////////////////////////////////////////////////////////////////////////////////////

        let mut enemy_knight_strength: u64 = troop_config.knight_strength.into();
        enemy_knight_strength *= enemy_troops.knight_count.into();
        enemy_knight_strength =
            PercentageImpl::get(enemy_knight_strength, troop_config.disadvantage_percent.into());

        let mut enemy_paladin_strength: u64 = troop_config.paladin_strength.into();
        enemy_paladin_strength *= enemy_troops.paladin_count.into();
        enemy_paladin_strength =
            PercentageImpl::get(enemy_paladin_strength, troop_config.disadvantage_percent.into());

        let mut enemy_crossbowman_strength: u64 = troop_config.crossbowman_strength.into();
        enemy_crossbowman_strength *= enemy_troops.crossbowman_count.into();
        enemy_crossbowman_strength =
            PercentageImpl::get(
                enemy_crossbowman_strength, troop_config.disadvantage_percent.into()
            );

        //////////////////////////////////////////////////////////////////////////////////////////

        let self_knight_strength: i128 = self_knight_strength.into()
            - enemy_paladin_strength.into();
        let self_knight_strength: i128 = self_knight_strength.into()
            - enemy_paladin_strength.into();
        let self_paladin_strength: i128 = self_paladin_strength.into()
            - enemy_crossbowman_strength.into();
        let self_crossbowman_strength: i128 = self_crossbowman_strength.into()
            - enemy_knight_strength.into();

        self_knight_strength + self_paladin_strength + self_crossbowman_strength
    }

    fn count(self: Troops) -> u32 {
        self.knight_count + self.paladin_count + self.crossbowman_count
    }
}


#[derive(Copy, Drop, Serde, Model, Default)]
struct Army {
    #[key]
    entity_id: u128,
    troops: Troops,
    battle_id: u128,
    battle_side: BattleSide
}

#[derive(Copy, Drop, Serde, Introspect, Default)]
struct BattleArmy {
    troops: Troops,
    battle_id: u128,
    battle_side: BattleSide
}

impl ArmyIntoBattlrArmyImpl of Into<Army, BattleArmy> {
    fn into(self: Army) -> BattleArmy {
        return BattleArmy {
            troops: self.troops, battle_id: self.battle_id, battle_side: self.battle_side
        };
    }
}


#[derive(Introspect, Copy, Drop, Serde, Default)]
struct BattleHealth {
    current: u128,
    lifetime: u128
}

impl HealthIntoBattleHealthImpl of Into<Health, BattleHealth> {
    fn into(self: Health) -> BattleHealth {
        return BattleHealth { // entity_id: self.entity_id,
            current: self.current, lifetime: self.lifetime
        };
    }
}

impl BattleHealthIntoHealthImpl of Into<BattleHealth, Health> {
    fn into(self: BattleHealth) -> Health {
        return Health { entity_id: 0, current: self.current, lifetime: self.lifetime };
    }
}

#[generate_trait]
impl BattleHealthImpl of BattleHealthTrait {
    fn increase_by(ref self: BattleHealth, value: u128) {
        self.current += value;
        self.lifetime += value;
    }

    fn decrease_by(ref self: BattleHealth, value: u128) {
        if self.current > value {
            self.current -= value;
        } else {
            self.current = 0;
        }
    }
    fn is_alive(self: BattleHealth) -> bool {
        Into::<BattleHealth, Health>::into(self).is_alive()
    }

    fn assert_alive(self: BattleHealth) {
        Into::<BattleHealth, Health>::into(self).assert_alive()
    }

    fn steps_to_finish(self: @BattleHealth, deduction: u128) -> u128 {
        Into::<BattleHealth, Health>::into(*self).steps_to_finish(deduction)
    }

    fn percentage_left(self: BattleHealth) -> u128 {
        Into::<BattleHealth, Health>::into(self).percentage_left()
    }
}


#[generate_trait]
impl ArmyImpl of ArmyTrait {
    fn assert_in_battle(self: Army) {
        assert!(self.battle_id.is_non_zero(), "army not in battle")
    }

    fn assert_not_in_battle(self: Army) {
        assert!(self.battle_id.is_zero(), "army in battle")
    }
}

#[derive(Model, Copy, Drop, Serde, Default)]
struct Protector {
    #[key]
    entity_id: u128,
    army_id: u128,
}

#[derive(Model, Copy, Drop, Serde, Default)]
struct Protectee {
    #[key]
    army_id: u128,
    protectee_id: u128
}

#[generate_trait]
impl ProtecteeImpl of ProtecteeTrait {
    fn is_none(self: Protectee) -> bool {
        self.protectee_id == 0
    }

    fn is_other(self: Protectee) -> bool {
        self.protectee_id != 0
    }

    fn protected_resources_owner(self: Protectee) -> u128 {
        if self.is_other() {
            self.protectee_id
        } else {
            self.army_id
        }
    }
}


#[derive(Model, Copy, Drop, Serde, Default)]
struct Battle {
    #[key]
    entity_id: u128,
    attack_army: BattleArmy,
    defence_army: BattleArmy,
    attack_army_health: BattleHealth,
    defence_army_health: BattleHealth,
    attack_delta: u64,
    defence_delta: u64,
    last_updated: u64,
    duration_left: u64
}

#[derive(Copy, Drop, Serde, PartialEq, Introspect)]
enum BattleSide {
    None,
    Attack,
    Defence
}

impl BattleSideDefault of Default<BattleSide> {
    fn default() -> BattleSide {
        BattleSide::None
    }
}

impl BattleSideIntoFelt252 of Into<BattleSide, felt252> {
    fn into(self: BattleSide) -> felt252 {
        match self {
            BattleSide::None => 0,
            BattleSide::Attack => 1,
            BattleSide::Defence => 2,
        }
    }
}


#[generate_trait]
impl BattleImpl of BattleTrait {
    fn update_state(ref self: Battle) {
        let battle_duration_passed = self.duration_passed();
        self
            .attack_army_health
            .decrease_by((self.defence_delta.into() * battle_duration_passed.into()));
        self
            .defence_army_health
            .decrease_by((self.attack_delta.into() * battle_duration_passed.into()));
    }

    fn restart(ref self: Battle, troop_config: TroopConfig) {
        // ensure state has been updated 
        assert!(self.last_updated == starknet::get_block_timestamp(), "state not updated");

        // reset attack and defence delta 
        let (attack_delta, defence_delta) = self
            .attack_army
            .troops
            .delta(@self.defence_army.troops, troop_config);
        self.attack_delta = attack_delta;
        self.defence_delta = defence_delta;

        // get duration with latest delta
        self.duration_left = self.duration();
    }


    fn duration(self: Battle) -> u64 {
        let mut attack_num_seconds_to_death = self
            .attack_army_health
            .steps_to_finish(self.defence_delta.into());

        let mut defence_num_seconds_to_death = self
            .defence_army_health
            .steps_to_finish(self.attack_delta.into());

        if defence_num_seconds_to_death < attack_num_seconds_to_death {
            defence_num_seconds_to_death.try_into().unwrap()
        } else {
            attack_num_seconds_to_death.try_into().unwrap()
        }
    }


    fn duration_passed(ref self: Battle) -> u64 {
        let now = starknet::get_block_timestamp();
        let duration_since_last_update = now - self.last_updated;
        if self.duration_left >= duration_since_last_update {
            self.duration_left -= duration_since_last_update;
            self.last_updated = now;

            duration_since_last_update
        } else {
            let duration = self.duration_left;
            self.duration_left = 0;
            self.last_updated = now;

            duration
        }
    }

    fn has_ended(self: Battle) -> bool {
        self.duration_left == 0
    }

    fn winner(self: Battle) -> BattleSide {
        assert!(self.has_ended(), "Battle has not ended");
        if self.attack_army_health.current > 0 {
            return BattleSide::Attack;
        }
        if self.defence_army_health.current > 0 {
            return BattleSide::Defence;
        }

        // it's possible that both killed each other soo
        return BattleSide::None;
    }
}
// #[cfg(test)]
// mod battle_tests {
//     use eternum::models::combat::BattleTrait;
//     use eternum::models::combat::TroopsTrait;
//     use super::{Battle, BattleHealth, BattleArmy, BattleSide, Troops, TroopConfig};

//     #[test]
//     fn test_battle_helper() {
//         let troop_config = TroopConfig {
//             config_id: 0,
//             knight_health: 10,
//             paladin_health: 10,
//             crossbowman_health: 10,
//             knight_strength: 7,
//             paladin_strength: 7,
//             crossbowman_strength: 7,
//             advantage_percent: 1000,
//             disadvantage_percent: 1000,
//         };

//         let attack_troop_each = 1781;
//         let defence_troop_each = 2671;

//         let attack_troops = Troops {
//             knight_count: attack_troop_each,
//             paladin_count: attack_troop_each,
//             crossbowman_count: attack_troop_each,
//         };
//         let defence_troops = Troops {
//             knight_count: defence_troop_each,
//             paladin_count: defence_troop_each,
//             crossbowman_count: defence_troop_each,
//         };

//         let mut battle: Battle = Battle {
//             entity_id: 45,
//             attack_army: BattleArmy {
//                 troops: attack_troops, battle_id: 0, battle_side: BattleSide::Attack
//             },
//             defence_army: BattleArmy {
//                 troops: defence_troops, battle_id: 0, battle_side: BattleSide::Defence
//             },
//             attack_army_health: BattleHealth {
//                 current: attack_troops.full_health(troop_config),
//                 lifetime: attack_troops.full_health(troop_config)
//             },
//             defence_army_health: BattleHealth {
//                 current: defence_troops.full_health(troop_config),
//                 lifetime: defence_troops.full_health(troop_config)
//             },
//             attack_delta: 0,
//             defence_delta: 0,
//             last_updated: 0,
//             duration_left: 0
//         };

//         // reset attack and defence delta 
//         let (attack_delta, defence_delta) = battle
//             .attack_army
//             .troops
//             .delta(@battle.defence_army.troops, troop_config);
//         battle.attack_delta = attack_delta;
//         battle.defence_delta = defence_delta;

//         // get duration with latest delta
//         battle.duration_left = battle.duration();

//         print!("\n\n Attack Troops each: {} \n\n", attack_troop_each);
//         print!("\n\n Defence Troops each: {} \n\n", defence_troop_each);
//         print!("\n\n Attack delta: {} \n\n", attack_delta);
//         print!("\n\n Defence delta: {} \n\n", defence_delta);
//         print!("\n\n Attack Army health: {} \n\n", battle.attack_army_health.current);
//         print!("\n\n Defence Army health: {} \n\n", battle.defence_army_health.current);
//         print!("\n\n Scale A: {} \n\n", attack_troops.count() / defence_troops.count());
//         print!("\n\n Scale B: {} \n\n", defence_troops.count() / attack_troops.count());
//         print!("\n\n Duration in Seconds: {} \n\n", battle.duration_left);
//         print!("\n\n Duration in Minutes: {} \n\n", battle.duration_left / 60 );
//         print!("\n\n Duration in Hours: {} \n\n", battle.duration_left / (60 * 60));
//     }
// }


