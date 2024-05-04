use core::option::OptionTrait;
use core::traits::Into;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::config::{BattleConfig, BattleConfigImpl, BattleConfigTrait};
use eternum::models::config::{TickConfig, TickImpl, TickTrait};
use eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};
use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
use eternum::utils::math::{PercentageImpl, PercentageValueImpl};


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

    fn steps_to_finish(self: @Health, deduction: u128) -> u128 {
        let mut num_steps = *self.current / deduction;
        if (num_steps % deduction) > 0 {
            num_steps += 1;
        }
        num_steps
    }

    fn percentage_left(self: Health) -> u128 {
        self.current * PercentageValueImpl::_100().into() / self.lifetime + 1
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

    fn deduct_percentage(ref self: Troops, num: u128, denom: u128) {
        self.knight_count -= ((self.knight_count.into() * num) / denom).try_into().unwrap();
        self.paladin_count -= ((self.paladin_count.into() * num) / denom).try_into().unwrap();
        self
            .crossbowman_count -= ((self.crossbowman_count.into() * num) / denom)
            .try_into()
            .unwrap();
    }


    fn full_health(self: Troops, troop_config: TroopConfig) -> u128 {
        let total_knight_health = troop_config.knight_health * self.knight_count;
        let total_paladin_health = troop_config.paladin_health * self.paladin_count;
        let total_crossbowman_health = troop_config.crossbowman_health * self.crossbowman_count;

        total_knight_health.into() + total_paladin_health.into() + total_crossbowman_health.into()
    }


    fn full_strength(self: Troops, troop_config: TroopConfig) -> u128 {
        let total_knight_strength = troop_config.knight_strength * self.knight_count;
        let total_paladin_strength = troop_config.paladin_strength * self.paladin_count;
        let total_crossbowman_strength = troop_config.crossbowman_strength * self.crossbowman_count;

        total_knight_strength.into()
            + total_paladin_strength.into()
            + total_crossbowman_strength.into()
    }


    fn purchase(
        self: Troops, purchaser_id: u128, troops_resources: (Resource, Resource, Resource),
    ) -> (Resource, Resource, Resource) {
        let (mut knight_resource, mut paladin_resoure, mut crossbowman_resoure) = troops_resources;

        // pay for knights using KNIGHT resource
        knight_resource.burn(self.knight_count.into());
        paladin_resoure.burn(self.paladin_count.into());
        crossbowman_resoure.burn(self.crossbowman_count.into());

        return (knight_resource, paladin_resoure, crossbowman_resoure);
    }

    fn delta(self: @Troops, enemy_troops: @Troops, troop_config: TroopConfig) -> (u32, u32) {
        let self_strength: i64 = self.strength_against(enemy_troops, troop_config);
        let enemy_strength: i64 = enemy_troops.strength_against(self, troop_config);
        let mut strength_difference: i64 = self_strength - enemy_strength;
        if strength_difference < 0 {
            strength_difference *= -1;
        }
        let strength_difference: u32 = Into::<i64, felt252>::into(strength_difference)
            .try_into()
            .unwrap();
        (strength_difference, strength_difference)
    }

    /// @dev Calculates the net combat strength of one troop against another, factoring in troop-specific strengths and advantages/disadvantages.
    /// @param self Reference to the instance of the Troops struct representing the attacking troops.
    /// @param enemy_troops Reference to the instance of the Troops struct representing the defending troops.
    /// @param troop_config Configuration object containing strength and advantage/disadvantage percentages for each troop type.
    /// @return The net combat strength as an integer, where a positive number indicates a strength advantage for the attacking troops.
    fn strength_against(self: @Troops, enemy_troops: @Troops, troop_config: TroopConfig) -> i64 {
        let self = *self;
        let enemy_troops = *enemy_troops;

        //////////////////////////////////////////////////////////////////////////////////////////

        let mut self_knight_strength: u32 = troop_config.knight_strength * self.knight_count;
        self_knight_strength =
            PercentageImpl::get(self_knight_strength.into(), troop_config.advantage_percent.into());

        let mut self_paladin_strength: u32 = troop_config.paladin_strength * self.paladin_count;
        self_paladin_strength =
            PercentageImpl::get(
                self_paladin_strength.into(), troop_config.advantage_percent.into()
            );

        let mut self_crossbowman_strength: u32 = troop_config.crossbowman_strength
            * self.crossbowman_count;
        self_crossbowman_strength =
            PercentageImpl::get(
                self_crossbowman_strength.into(), troop_config.advantage_percent.into()
            );

        //////////////////////////////////////////////////////////////////////////////////////////

        let mut enemy_knight_strength: u32 = troop_config.knight_strength
            * enemy_troops.knight_count;
        enemy_knight_strength =
            PercentageImpl::get(enemy_knight_strength, troop_config.disadvantage_percent.into());

        let mut enemy_paladin_strength: u32 = troop_config.paladin_strength
            * enemy_troops.paladin_count;
        enemy_paladin_strength =
            PercentageImpl::get(enemy_paladin_strength, troop_config.disadvantage_percent.into());

        let mut enemy_crossbowman_strength: u32 = troop_config.crossbowman_strength
            * enemy_troops.crossbowman_count;
        enemy_crossbowman_strength =
            PercentageImpl::get(
                enemy_crossbowman_strength, troop_config.disadvantage_percent.into()
            );

        //////////////////////////////////////////////////////////////////////////////////////////

        let self_knight_strength: i64 = self_knight_strength.into() - enemy_paladin_strength.into();
        let self_paladin_strength: i64 = self_paladin_strength.into()
            - enemy_crossbowman_strength.into();
        let self_crossbowman_strength: i64 = self_crossbowman_strength.into()
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
    attack_delta: u32,
    defence_delta: u32,
    tick_last_updated: u64,
    tick_duration_left: u64
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
    fn update_state(ref self: Battle, tick: TickConfig) {
        let battle_duration_passed = self.duration_passed(tick);
        self
            .attack_army_health
            .decrease_by((self.attack_delta.into() * battle_duration_passed.into()));
        self
            .defence_army_health
            .decrease_by((self.attack_delta.into() * battle_duration_passed.into()));
    }

    fn restart(ref self: Battle, tick: TickConfig, troop_config: TroopConfig) {
        // ensure state has been updated 
        assert!(self.tick_last_updated == tick.current(), "state not updated");

        // reset attack and defence delta 
        let (attack_delta, defence_delta) = self
            .attack_army
            .troops
            .delta(@self.defence_army.troops, troop_config);
        self.attack_delta = attack_delta;
        self.defence_delta = defence_delta;

        // get duration with latest delta
        self.tick_duration_left = self.duration();
    }


    fn duration(self: Battle) -> u64 {
        let mut attack_num_ticks_to_death = self
            .attack_army_health
            .steps_to_finish(self.defence_delta.into());

        let mut defence_num_ticks_to_death = self
            .defence_army_health
            .steps_to_finish(self.attack_delta.into());

        if defence_num_ticks_to_death < attack_num_ticks_to_death {
            defence_num_ticks_to_death.try_into().unwrap()
        } else {
            attack_num_ticks_to_death.try_into().unwrap()
        }
    }


    fn duration_passed(ref self: Battle, tick: TickConfig) -> u64 {
        let current_tick = tick.current();
        let duration_since_last_update = current_tick - self.tick_last_updated;
        if self.tick_duration_left >= duration_since_last_update {
            self.tick_duration_left -= duration_since_last_update;
            self.tick_last_updated = current_tick;

            duration_since_last_update
        } else {
            let duration = self.tick_duration_left;
            self.tick_duration_left = 0;
            self.tick_last_updated = current_tick;
            duration
        }
    }

    fn has_ended(self: Battle) -> bool {
        self.tick_duration_left == 0
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
