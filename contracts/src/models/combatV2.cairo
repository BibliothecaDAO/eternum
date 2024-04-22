use core::option::OptionTrait;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::models::config::{BattleConfig, BattleConfigImpl, BattleConfigTrait};
use eternum::models::config::{TickConfig, TickImpl, TickTrait};
use eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};
use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
use eternum::utils::math::PercentageImpl;

// Gameplay

// Generate Troops like Resources (see resource)
// fn create_army() this will convert Troops into an Army and burn the resources.
// Now an Army exists at a location and it can travel
// Army can initiate a combat with another Army or a Entity that has a combat trait

// initiating combat
// players select another Army, which must be at the same location, then start a Battle.
// The Battle calculates the strength of each side and deducts health from each side per tick
// If reinforcements arrive the Battle updates to the new strength and outcome is updated.

#[derive(Model, Copy, Drop, Serde, Default)]
struct Healthv2 {
    #[key]
    entity_id: u128,
    current: u128,
    lifetime: u128
}

#[generate_trait]
impl Healthv2Impl of Healthv2Trait {
    fn is_alive(ref self: Healthv2) -> bool {
        self.current > 0
    }

    fn increase_by(ref self: Healthv2, value: u128) {
        self.current += value;
        self.lifetime += value;
    }

    fn decrease_by(ref self: Healthv2, value: u128) {
        if self.current > value {
            self.current -= value;
        } else {
            self.current = 0;
        }
    }

    fn steps_to_finish(self: @Healthv2, deduction: u128) -> u128 {
        let mut num_steps = *self.current / deduction;
        if (num_steps % deduction) > 0 {
            num_steps += 1;
        }
        num_steps
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

    fn purchase(
        self: Troops, purchaser_id: u128, ref troops_resources: (Resource, Resource, Resource),
    ) {
        let (mut knight_resource, mut paladin_resoure, mut crossbowman_resoure) = troops_resources;

        // pay for knights using KNIGHT resource

        if self.knight_count > 0 {
            assert!(
                knight_resource.balance >= self.knight_count.into(),
                "insufficient resources to purchase knights"
            );

            knight_resource.balance -= self.knight_count.into();
        }

        // pay for paladin using PALADIN resource

        if self.paladin_count > 0 {
            assert!(
                paladin_resoure.balance >= self.paladin_count.into(),
                "insufficient resources to purchase paladins"
            );
            paladin_resoure.balance -= self.paladin_count.into();
        }

        // pay for crossbowman using CROSSBOWMAN resource

        if self.crossbowman_count > 0 {
            assert!(
                crossbowman_resoure.balance >= self.crossbowman_count.into(),
                "insufficient resources to purchase crossbowmen"
            );
            crossbowman_resoure.balance -= self.crossbowman_count.into();
        }
    }

    fn delta(self: @Troops, enemy_troops: @Troops, troop_config: TroopConfig) -> (u32, u32) {
        let self_strength = self.strength_against(enemy_troops, troop_config);
        let enemy_strength = enemy_troops.strength_against(self, troop_config);
        let strength_difference = self_strength - enemy_strength;

        // should be at least one to prevent division errrors
        (1, 1)
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
}


#[derive(Copy, Drop, Serde, Model, Default)]
struct Army {
    #[key]
    entity_id: u128,
    troops: Troops,
    battle_id: u128,
    battle_side: BattleSide
}

#[derive(Model, Copy, Drop, Serde, Default)]
struct Battle {
    #[key]
    entity_id: u128,
    attack_army: Army,
    defence_army: Army,
    attack_army_health: Healthv2,
    defence_army_health: Healthv2,
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
