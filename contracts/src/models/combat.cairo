use core::array::ArrayTrait;
use core::integer::BoundedInt;
use core::option::OptionTrait;
use core::traits::Into;
use core::traits::TryInto;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::constants::all_resource_ids;
use eternum::models::config::{BattleConfig, BattleConfigImpl, BattleConfigTrait};
use eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};
use eternum::models::resources::OwnedResourcesTrackerTrait;
use eternum::models::resources::ResourceTrait;
use eternum::models::resources::ResourceTransferLockTrait;
use eternum::models::resources::{
    Resource, ResourceImpl, ResourceCost, ResourceTransferLock, OwnedResourcesTracker,
    OwnedResourcesTrackerImpl
};
use eternum::models::structure::{Structure, StructureImpl};
use eternum::utils::math::{PercentageImpl, PercentageValueImpl};
use eternum::utils::number::NumberTrait;


const STRENGTH_PRECISION: u256 = 10_000;


#[derive(Copy, Drop, Serde, Default)]
#[dojo::model]
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

    fn assert_alive(self: Health, entity_name: ByteArray) {
        assert!(self.is_alive(), "{} is dead", entity_name);
    }

    fn steps_to_finish(self: @Health, mut deduction: u128) -> u128 {
        assert!(deduction != 0, "deduction value is 0");

        let mut num_steps = *self.current / deduction;
        if (num_steps % deduction) > 0 {
            num_steps += 1;
        }

        if num_steps == 0 {
            num_steps += 1;
        }
        num_steps
    }

    fn percentage_left(self: Health) -> u128 {
        if self.lifetime == 0 {
            return 0;
        }
        self.current * PercentageValueImpl::_100().into() / self.lifetime
    }
}


#[derive(Copy, Drop, Serde, Introspect, Default)]
struct Troops {
    knight_count: u32,
    paladin_count: u32,
    crossbowman_count: u32,
}


#[derive(Copy, Drop, Serde)]
enum TroopType {
    Knight,
    Paladin,
    Crossbowman,
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
        let h: u128 = troop_config.health.into();
        let total_knight_health: u128 = h * self.knight_count.into();
        let total_paladin_health: u128 = h * self.paladin_count.into();
        let total_crossbowman_health: u128 = h * self.crossbowman_count.into();
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


    fn delta(
        self: @Troops,
        self_health: @Health,
        enemy_troops: @Troops,
        enemy_health: @Health,
        troop_config: TroopConfig
    ) -> (u64, u64) {
        let self_delta: i128 = self
            .strength_against(self_health, enemy_troops, enemy_health, troop_config);
        let self_delta_abs: u64 = Into::<i128, felt252>::into(self_delta.abs()).try_into().unwrap();

        let enemy_delta: i128 = enemy_troops
            .strength_against(enemy_health, self, self_health, troop_config);
        let enemy_delta_abs: u64 = Into::<i128, felt252>::into(enemy_delta.abs())
            .try_into()
            .unwrap();

        return (enemy_delta_abs + 1, self_delta_abs + 1);
    }

    /// @dev Calculates the net combat strength of one troop against another, factoring in troop-specific strengths and advantages/disadvantages.
    /// @param self Reference to the instance of the Troops struct representing the attacking troops.
    /// @param enemy_troops Reference to the instance of the Troops struct representing the defending troops.
    /// @param troop_config Configuration object containing strength and advantage/disadvantage percentages for each troop type.
    /// @return The net combat strength as an integer, where a positive number indicates a strength advantage for the attacking troops.
    fn strength_against(
        self: @Troops,
        self_health: @Health,
        enemy_troops: @Troops,
        enemy_health: @Health,
        troop_config: TroopConfig
    ) -> i128 {
        let self = *self;
        let enemy_troops = *enemy_troops;

        ///////////////         Calculate the strength of the Attacker      //////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////

        let mut self_knight_strength: u64 = self.actual_type_count(TroopType::Knight, self_health)
            * troop_config.knight_strength.into();
        self_knight_strength +=
            PercentageImpl::get(self_knight_strength.into(), troop_config.advantage_percent.into());

        let mut self_paladin_strength: u64 = self.actual_type_count(TroopType::Paladin, self_health)
            * troop_config.paladin_strength.into();
        self_paladin_strength +=
            PercentageImpl::get(
                self_paladin_strength.into(), troop_config.advantage_percent.into()
            );

        let mut self_crossbowman_strength: u64 = self
            .actual_type_count(TroopType::Crossbowman, self_health)
            * troop_config.crossbowman_strength.into();
        self_crossbowman_strength +=
            PercentageImpl::get(
                self_crossbowman_strength.into(), troop_config.advantage_percent.into()
            );

        ///////////////         Calculate the strength of the Defender      //////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////

        let mut enemy_knight_strength: u64 = enemy_troops
            .actual_type_count(TroopType::Knight, enemy_health)
            * troop_config.knight_strength.into();
        enemy_knight_strength -=
            PercentageImpl::get(enemy_knight_strength, troop_config.disadvantage_percent.into());

        let mut enemy_paladin_strength: u64 = enemy_troops
            .actual_type_count(TroopType::Paladin, enemy_health)
            * troop_config.paladin_strength.into();
        enemy_paladin_strength -=
            PercentageImpl::get(enemy_paladin_strength, troop_config.disadvantage_percent.into());

        let mut enemy_crossbowman_strength: u64 = enemy_troops
            .actual_type_count(TroopType::Crossbowman, enemy_health)
            * troop_config.crossbowman_strength.into();
        enemy_crossbowman_strength -=
            PercentageImpl::get(
                enemy_crossbowman_strength, troop_config.disadvantage_percent.into()
            );

        ///////////////          Calculate the strength difference          //////////////////////
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

    /// Get the actual count of a troop type using 
    ///  the percentage of health remaining 
    /// 
    /// e.g if there were originally 50 paladins with 10/100 health left, 
    /// the actual remaining paladin count is 50 * 10 /100 = 5;

    fn actual_type_count(self: Troops, _type: TroopType, health: @Health) -> u64 {
        let count = match _type {
            TroopType::Knight => { self.knight_count },
            TroopType::Paladin => { self.paladin_count },
            TroopType::Crossbowman => { self.crossbowman_count }
        };

        (count.into() * (*health).current.try_into().unwrap())
            / (*health).lifetime.try_into().unwrap()
    }

    /// Get the actual count of a all troops using 
    /// the percentage of health remaining 
    /// 
    /// e.g if there were originally 50 paladins, 60 knights and 70 crossbowmen
    /// and with 10/100 health left, the actual remaining 
    /// paladin count is 50 * 10 /100 = 5;
    /// knight count is 60 * 10 /100 = 6;
    /// crossbowman count is 70 * 10 /100 = 7;
    /// 
    /// so total is 5 + 6 + 7 = 18 
    /// 
    fn actual_total_count(self: Troops, health: @Health) -> u64 {
        self.actual_type_count(TroopType::Knight, health)
            + self.actual_type_count(TroopType::Paladin, health)
            + self.actual_type_count(TroopType::Crossbowman, health)
    }
}


#[derive(Copy, Drop, Serde, Default)]
#[dojo::model]
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
        Into::<BattleHealth, Health>::into(self).assert_alive("Army")
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


#[derive(Copy, Drop, Serde, Default)]
#[dojo::model]
struct Protector {
    #[key]
    entity_id: u128,
    army_id: u128,
}

#[derive(Copy, Drop, Serde, Default)]
#[dojo::model]
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


#[derive(Copy, Drop, Serde, Default)]
#[dojo::model]
struct Battle {
    #[key]
    entity_id: u128,
    attack_army: BattleArmy,
    defence_army: BattleArmy,
    attack_box_id: u128,
    defence_box_id: u128,
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
impl BattleBoxImpl of BattleBoxTrait {
    fn balance_deposit(
        ref self: Battle, world: IWorldDispatcher, from_army: Army, from_army_protectee: Protectee
    ) {
        let from_army_protectee_id = from_army_protectee.protected_resources_owner();
        let from_army_protectee_is_self: bool = !get!(world, from_army_protectee_id, Structure)
            .is_structure();
        if from_army_protectee_is_self {
            // detail items locked in box
            let box_id = match from_army.battle_side {
                BattleSide::None => { panic!("wrong battle side") },
                BattleSide::Attack => { self.attack_box_id },
                BattleSide::Defence => { self.defence_box_id }
            };
            let from_army_owned_resources: OwnedResourcesTracker = get!(
                world, from_army_protectee_id, OwnedResourcesTracker
            );

            let mut all_resources = all_resource_ids();
            loop {
                match all_resources.pop_front() {
                    Option::Some(resource_id) => {
                        if from_army_owned_resources.owns_resource_type(resource_id) {
                            let from_army_resource = ResourceImpl::get(
                                world, (from_army_protectee_id, resource_id)
                            );
                            let mut box_resource = ResourceImpl::get(world, (box_id, resource_id));
                            box_resource.add(from_army_resource.balance);
                            box_resource.save(world);
                        }
                    },
                    Option::None => { break; }
                }
            };
        }

        // lock the resources protected by the army
        let mut from_army_resource_lock: ResourceTransferLock = get!(
            world, from_army_protectee_id, ResourceTransferLock
        );
        from_army_resource_lock.assert_not_locked();
        from_army_resource_lock.release_at = BoundedInt::max();
        set!(world, (from_army_resource_lock));
    }

    fn withdraw_deposit(
        ref self: Battle, world: IWorldDispatcher, to_army: Army, to_army_protectee: Protectee
    ) {
        let box_id = match to_army.battle_side {
            BattleSide::None => { panic!("wrong battle side") },
            BattleSide::Attack => { self.attack_box_id },
            BattleSide::Defence => { self.defence_box_id }
        };

        // note: now everyone can leave the battle
        // also: you can no longer join battle after it has been won

        let to_army_protectee_id = to_army_protectee.protected_resources_owner();
        let to_army_protectee_is_self: bool = !get!(world, to_army_protectee_id, Structure)
            .is_structure();
        if to_army_protectee_is_self {
            let winner_side: BattleSide = self.winner();
            let to_army_lost = (winner_side != to_army.battle_side
                && winner_side != BattleSide::None);
            let to_army_forfeits_resources = !self.has_ended()
                || (self.has_ended() && to_army_lost);
            let to_army_owned_resources: OwnedResourcesTracker = get!(
                world, to_army_protectee_id, OwnedResourcesTracker
            );
            let mut all_resources = all_resource_ids();
            loop {
                match all_resources.pop_front() {
                    Option::Some(resource_id) => {
                        if to_army_owned_resources.owns_resource_type(resource_id) {
                            let mut to_army_resource = ResourceImpl::get(
                                world, (to_army_protectee_id, resource_id)
                            );
                            if to_army_forfeits_resources {
                                // army forfeits resources
                                to_army_resource.burn((to_army_resource.balance));
                                to_army_resource.save(world);
                            } else {
                                // army can leave with its resources so 
                                // we remove items from from battle box
                                let mut box_resource = ResourceImpl::get(
                                    world, (box_id, resource_id)
                                );
                                box_resource.burn(to_army_resource.balance);
                                box_resource.save(world);
                            }
                        }
                    // note: logic for splitting resource to be done later
                    },
                    Option::None => { break; }
                }
            };
        }

        // release lock on resource
        let mut to_army_resource_lock: ResourceTransferLock = get!(
            world, to_army_protectee_id, ResourceTransferLock
        );
        to_army_resource_lock.assert_locked();
        to_army_resource_lock.release_at = starknet::get_block_timestamp();
        set!(world, (to_army_resource_lock));
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
            .delta(
                @self.attack_army_health.into(),
                @self.defence_army.troops,
                @self.defence_army_health.into(),
                troop_config
            );
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
        if self.attack_army_health.current > 0 {
            return BattleSide::Attack;
        }
        if self.defence_army_health.current > 0 {
            return BattleSide::Defence;
        }

        // it's possible that both killed each other or it's a draw
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
//             health: 7_200,
//             knight_strength: 1,
//             paladin_strength: 1,
//             crossbowman_strength: 1,
//             advantage_percent: 1000,
//             disadvantage_percent: 1000,
//         };

//         let attack_troop_each = 3000;
//         let defence_troop_each = 2900;

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
//             .delta(
//                 @battle.attack_army_health.into(),
//                 @battle.defence_army.troops,
//                 @battle.defence_army_health.into(),
//                 troop_config
//             );
//         battle.attack_delta = attack_delta;
//         battle.defence_delta = defence_delta;

//         // get duration with latest delta
//         battle.duration_left = battle.duration();

//         print!("\n\n Attack Troops each: {} \n\n", attack_troop_each);
//         print!("\n\n Defence Troops each: {} \n\n", defence_troop_each);
//         print!("\n\n Attack Army health: {} \n\n", battle.attack_army_health.current);
//         print!("\n\n Defence delta: {} \n\n", defence_delta);

//         print!("\n\n Defence Army health: {} \n\n", battle.defence_army_health.current);
//         print!("\n\n Attack delta: {} \n\n", attack_delta);

//         print!("\n\n Scale A: {} \n\n", attack_troops.count() / defence_troops.count());
//         print!("\n\n Scale B: {} \n\n", defence_troops.count() / attack_troops.count());
//         print!("\n\n Duration in Seconds: {} \n\n", battle.duration_left);
//         print!("\n\n Duration in Minutes: {} \n\n", battle.duration_left / 60);
//         print!("\n\n Duration in Hours: {} \n\n", battle.duration_left / (60 * 60));

//         let divisior = 8;
//         let attacker_h_left = battle.attack_army_health.current - (battle.defence_delta.into() * (battle.duration_left.into() / divisior ));
//         let attacker_ratio = (battle.attack_army_health.current - attacker_h_left) * 100 /  battle.attack_army_health.current;
//         let defence_h_left = battle.defence_army_health.current - (battle.attack_delta.into() * (battle.duration_left.into() / divisior ));
//         let defence_ratio = (battle.defence_army_health.current - defence_h_left) * 100 / battle.defence_army_health.current;

//         print!("\n\n Pillage Attacker Loss: {}, Ratio is {}% \n\n", attacker_h_left, attacker_ratio);
//         print!("\n\n Pillage Defender Loss: {}, Ratio is {}% \n\n", defence_h_left, defence_ratio);
//     }
// }


