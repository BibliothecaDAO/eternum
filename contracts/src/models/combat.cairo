use core::array::ArrayTrait;
use core::num::traits::Bounded;
use core::option::OptionTrait;
use core::poseidon::poseidon_hash_span;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use s0_eternum::alias::ID;
use s0_eternum::constants::{all_resource_ids, RESOURCE_PRECISION};
use s0_eternum::models::config::{
    BattleConfig, BattleConfigImpl, BattleConfigTrait, CapacityConfig, CapacityConfigCategory, CapacityConfigImpl,
    CapacityConfigTrait
};
use s0_eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};
use s0_eternum::models::config::{WeightConfig, WeightConfigImpl};
use s0_eternum::models::quantity::{Quantity, QuantityTracker, QuantityTrackerType};
use s0_eternum::models::resources::OwnedResourcesTrackerTrait;
use s0_eternum::models::resources::ResourceTrait;
use s0_eternum::models::resources::ResourceTransferLockTrait;
use s0_eternum::models::resources::{
    Resource, ResourceImpl, ResourceCost, ResourceTransferLock, OwnedResourcesTracker, OwnedResourcesTrackerImpl
};
use s0_eternum::models::structure::{Structure, StructureImpl, StructureCategory};
use s0_eternum::models::weight::Weight;
use s0_eternum::models::weight::WeightTrait;
use s0_eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};
use s0_eternum::utils::math::{PercentageImpl, PercentageValueImpl, min, max, cap_minus};
use s0_eternum::utils::number::NumberTrait;


const STRENGTH_PRECISION: u256 = 10_000;


#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct Health {
    #[key]
    entity_id: ID,
    current: u128,
    lifetime: u128
}

#[generate_trait]
impl HealthImpl of HealthTrait {
    fn increase_by(ref self: Health, value: u128) {
        self.current += value;
        self.lifetime += value;
    }

    fn clear(ref self: Health) {
        self.current = 0;
        self.lifetime = 0;
    }

    fn decrease_current_by(ref self: Health, value: u128) {
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

    fn steps_to_die(self: @Health, mut deduction: u128, troop_config: TroopConfig) -> u128 {
        if *self.current == 0 || deduction == 0 {
            return 0;
        };

        // 0 < self.current <= deduction
        if *self.current <= deduction {
            return 1;
        }

        // check health is a multiple of normalization factor
        let single_troop_health = troop_config.health.into() * TroopsImpl::normalization_factor().into();
        assert!(single_troop_health > 0, "single_troop_health is 0");
        assert!(
            *self.current % single_troop_health == 0,
            "health of entity {} is not a multiple of normalization factor",
            self.entity_id
        );

        /// Ensure that if the deduction makes the health less than one troop,
        /// the troop dies immediately
        /// e.g if single troop health = 7 * 1000(normalization), then a troop with 3 soldiers will have
        /// health a total health of 7_000 * 3 =  21_000.
        /// if deduction is 80 per second, we want it such that deduction happens
        /// at the rate of 80 per second till it takes 7_000 * (3 -1) =14_000 health,
        /// then after that, the next step depletes the health completely. i.e to 0

        // note: at this point, we know that
        // self.current > 0 and self.current > deduction
        // also self.current
        let mut num_steps = 0;
        if deduction >= single_troop_health {
            num_steps = *self.current / deduction;
            if (*self.current % deduction) > 0 {
                num_steps += 1;
            }
        } else {
            // note: we know self.current is at least == single troop health
            let current_less_one_troop = *self.current - single_troop_health;
            num_steps = current_less_one_troop / deduction;
            // add one step to account for the troop deducted
            // or if current_less_one_troop % deduction == 0
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


#[derive(Copy, Drop, Serde, Introspect, Debug, PartialEq, Default)]
struct Troops {
    knight_count: u64,
    paladin_count: u64,
    crossbowman_count: u64,
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

    // normalize troop counts to nearest mutiple of RESOURCE_PRECISION
    // so that troop units only exists as whole and not decimals
    fn normalize_counts(ref self: Troops) {
        self.knight_count -= self.knight_count % Self::normalization_factor();
        self.paladin_count -= self.paladin_count % Self::normalization_factor();
        self.crossbowman_count -= self.crossbowman_count % Self::normalization_factor();
    }

    fn normalization_factor() -> u64 {
        let resource_precision_u64: u64 = RESOURCE_PRECISION.try_into().unwrap();
        return resource_precision_u64;
    }

    fn assert_minimum_for_battle(self: Troops) {
        let total = self.knight_count + self.paladin_count + self.crossbowman_count;
        assert!(
            total >= (100 * RESOURCE_PRECISION).try_into().unwrap(),
            "you need to have at least have 100 troops for battle"
        );
    }

    fn assert_normalized(self: Troops) {
        assert!(
            self.knight_count % Self::normalization_factor() == 0,
            "Knight count is not a multiple of {}",
            Self::normalization_factor()
        );
        assert!(
            self.paladin_count % Self::normalization_factor() == 0,
            "Paladin count is not a multiple of {}",
            Self::normalization_factor()
        );
        assert!(
            self.crossbowman_count % Self::normalization_factor() == 0,
            "Crossbowman count is not a multiple of {}",
            Self::normalization_factor()
        );
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
        let total_crossbowman_strength: u128 = troop_config.crossbowman_strength.into() * crossbowman_count;

        total_knight_strength + total_paladin_strength + total_crossbowman_strength
    }


    fn purchase(
        self: Troops, purchaser_id: ID, troops_resources: (Resource, Resource, Resource),
    ) -> (Resource, Resource, Resource) {
        let (mut knight_resource, mut paladin_resoure, mut crossbowman_resoure) = troops_resources;

        knight_resource.burn(self.knight_count.into());
        paladin_resoure.burn(self.paladin_count.into());
        crossbowman_resoure.burn(self.crossbowman_count.into());

        return (knight_resource, paladin_resoure, crossbowman_resoure);
    }


    fn delta(
        self: @Troops, self_health: @Health, enemy_troops: @Troops, enemy_health: @Health, troop_config: TroopConfig
    ) -> (u64, u64) {
        let self = *self;
        let self_health = *self_health;
        let enemy_troops = *enemy_troops;
        let enemy_health = *enemy_health;

        let self_total_strength: u64 = self.strength_against(@self_health, @enemy_troops, @enemy_health, troop_config);
        let enemy_total_strength: u64 = enemy_troops.strength_against(@enemy_health, @self, @self_health, troop_config);
        if self_total_strength.is_zero() || enemy_total_strength.is_zero() {
            return (1, 1);
        }

        let (bigger_strength, smaller_strength) = if self_total_strength >= enemy_total_strength {
            (self_total_strength, enemy_total_strength)
        } else {
            (enemy_total_strength, self_total_strength)
        };

        /// the damage received is calculated as the number of self troops divided
        /// by a percentage of the enemy's strength
        /// i.e `self_count / (x / 100 * the enemy's strength)`
        /// we add 1 to prevent division by 0 errors
        let self_seconds_till_death: u64 = 1 + ((100 * self.count()) / 10 / enemy_total_strength);
        /// scale seconds_till_death by a percentage (e.g 1/1000) of `self_count`
        /// we add 1 to prevent division by 0 errors
        let self_seconds_till_death_scaled: u64 = 1
            + ((self.count() * self_seconds_till_death) / troop_config.battle_time_scale.into());

        /// limit time till death using the formula
        /// (x * n)/(n + 100_000) * smaller_strength / bigger_strength
        /// where x is the max time, n is the scaled time till death
        let self_seconds_till_death_limited: u256 = 1
            + ((troop_config.battle_max_time_seconds.into()
                * self_seconds_till_death_scaled.into()
                * smaller_strength.into())
                / (self_seconds_till_death_scaled.into() + 100_000)
                / bigger_strength.into());
        let self_seconds_till_death_limited: u64 = self_seconds_till_death_limited.try_into().unwrap();

        /// calculate damage received based on seconds till death
        /// we add 1 to prevent division by 0 errors
        let self_damage_received: u64 = 1
            + (self_health.current / self_seconds_till_death_limited.into()).try_into().unwrap();

        /// the damage received is calculated as the number of enemy troops divided
        /// by a percentage of self's strength
        /// i.e `enemy_count / (x / 100 * self's strength)`
        /// we add 1 to prevent division by 0 errors
        let enemy_seconds_till_death: u64 = 1 + ((100 * enemy_troops.count()) / 10 / self_total_strength);
        /// scale seconds_till_death by a percentage (1/1000) of `enemy_count`
        /// we add 1 to prevent division by 0 errors
        let enemy_seconds_till_death_scaled: u64 = 1
            + ((enemy_troops.count() * enemy_seconds_till_death) / troop_config.battle_time_scale.into());

        /// limit time till death using the formula
        /// (x * n)/(n + 100_000) * smaller_strength / bigger_strength
        /// where x is the max time, n is the scaled time till death
        let enemy_seconds_till_death_limited: u256 = 1
            + ((troop_config.battle_max_time_seconds.into()
                * enemy_seconds_till_death_scaled.into()
                * smaller_strength.into())
                / (enemy_seconds_till_death_scaled.into() + 100_000)
                / bigger_strength.into());
        let enemy_seconds_till_death_limited: u64 = enemy_seconds_till_death_limited.try_into().unwrap();
        /// calculate damage received based on seconds till death
        /// we add 1 to prevent division by 0 errors
        let enemy_damage_received: u64 = 1
            + (enemy_health.current / enemy_seconds_till_death_limited.into()).try_into().unwrap();

        return (enemy_damage_received, self_damage_received);
    }

    /// Calculate the combat strength of one troop against the other
    fn strength_against(
        self: @Troops, self_health: @Health, enemy_troops: @Troops, enemy_health: @Health, troop_config: TroopConfig
    ) -> u64 {
        let (self, enemy_troops) = (*self, *enemy_troops);

        let mut self_knight_strength: u64 = self.actual_type_count(TroopType::Knight, self_health).into()
            * troop_config.knight_strength.into();
        let mut self_paladin_strength: u64 = self.actual_type_count(TroopType::Paladin, self_health).into()
            * troop_config.paladin_strength.into();
        let mut self_crossbowman_strength: u64 = self.actual_type_count(TroopType::Crossbowman, self_health).into()
            * troop_config.crossbowman_strength.into();

        let mut enemy_knight_strength: u64 = enemy_troops.actual_type_count(TroopType::Knight, enemy_health).into()
            * troop_config.knight_strength.into();
        let mut enemy_paladin_strength: u64 = enemy_troops.actual_type_count(TroopType::Paladin, enemy_health).into()
            * troop_config.paladin_strength.into();
        let mut enemy_crossbowman_strength: u64 = enemy_troops
            .actual_type_count(TroopType::Crossbowman, enemy_health)
            .into()
            * troop_config.crossbowman_strength.into();

        // Prevent division by 0 errors
        self_knight_strength += 1;
        self_crossbowman_strength += 1;
        self_paladin_strength += 1;

        enemy_knight_strength += 1;
        enemy_crossbowman_strength += 1;
        enemy_paladin_strength += 1;

        ///////////////////////////////////////////////////////////////////////////////
        ///
        /// assuming troop percent is 10/100 = 0.1
        /// The advantage formula is self + min(0.1 * self, 0.1 * enemy /self)
        /// The disadvantage formula is self - max(0.1 * self, 0.1 * enemy /self)
        ///
        ///////////////////////////////////////////////////////////////////////////////

        ///////////////////////////////////////////////////////////////////////////////
        ///
        /// KNIGHT ADVANTAGE CALCULATION AGAINST ENEMY'S PALADIN
        ///
        ///
        let self_knight_strength_with_advantage = self_knight_strength
            + (self_knight_strength
                * enemy_paladin_strength
                * troop_config.advantage_percent.into()
                / self_knight_strength
                / PercentageValueImpl::_100());
        let self_knight_strength_with_advantage_max = self_knight_strength
            + PercentageImpl::get(self_knight_strength.into(), troop_config.advantage_percent.into());
        let self_knight_strength_with_advantage = min(
            self_knight_strength_with_advantage, self_knight_strength_with_advantage_max
        );

        ///
        /// KNIGHT DISADVANTAGE CALCULATION AGAINST ENEMY'S CROSSBOWMAN
        ///
        let self_knight_strength_with_disadvantage = cap_minus(
            self_knight_strength,
            (self_knight_strength
                * enemy_crossbowman_strength
                * troop_config.disadvantage_percent.into()
                / self_knight_strength
                / PercentageValueImpl::_100())
        );
        let self_knight_strength_with_disadvantage_max = self_knight_strength
            - PercentageImpl::get(self_knight_strength.into(), troop_config.disadvantage_percent.into());
        let self_knight_strength_with_disadvantage = max(
            self_knight_strength_with_disadvantage, self_knight_strength_with_disadvantage_max
        );

        ///////////////////////////////////////////////////////////////////////////////

        ///
        /// CROSSBOWMAN ADVANTAGE CALCULATION AGAINST ENEMY'S KNIGHT
        ///
        let self_crossbowman_strength_with_advantage = self_crossbowman_strength
            + (self_crossbowman_strength
                * enemy_knight_strength
                * troop_config.advantage_percent.into()
                / self_crossbowman_strength
                / PercentageValueImpl::_100());
        let self_crossbowman_strength_with_advantage_max = self_crossbowman_strength
            + PercentageImpl::get(self_crossbowman_strength.into(), troop_config.advantage_percent.into());
        let self_crossbowman_strength_with_advantage = min(
            self_crossbowman_strength_with_advantage, self_crossbowman_strength_with_advantage_max
        );

        ///
        /// CROSSBOWMAN DISADVANTAGE CALCULATION AGAINST ENEMY'S PALADIN
        ///
        let self_crossbowman_strength_with_disadvantage = cap_minus(
            self_crossbowman_strength,
            (self_crossbowman_strength
                * enemy_paladin_strength
                * troop_config.disadvantage_percent.into()
                / self_crossbowman_strength
                / PercentageValueImpl::_100())
        );
        let self_crossbowman_strength_with_disadvantage_max = self_crossbowman_strength
            - PercentageImpl::get(self_crossbowman_strength.into(), troop_config.disadvantage_percent.into());
        let self_crossbowman_strength_with_disadvantage = max(
            self_crossbowman_strength_with_disadvantage, self_crossbowman_strength_with_disadvantage_max
        );

        ///////////////////////////////////////////////////////////////////////////////

        ///
        /// PALADIN ADVANTAGE CALCULATION AGAINST ENEMY'S CROSSBOWMAN
        ///
        let self_paladin_strength_with_advantage = self_paladin_strength
            + (self_paladin_strength
                * enemy_crossbowman_strength
                * troop_config.advantage_percent.into()
                / self_paladin_strength
                / PercentageValueImpl::_100());
        let self_paladin_strength_with_advantage_max = self_paladin_strength
            + PercentageImpl::get(self_paladin_strength.into(), troop_config.advantage_percent.into());
        let self_paladin_strength_with_advantage = min(
            self_paladin_strength_with_advantage, self_paladin_strength_with_advantage_max
        );

        ///
        /// PALADIN DISADVANTAGE CALCULATION AGAINST ENEMY'S KNIGHT
        ///
        let self_paladin_strength_with_disadvantage = cap_minus(
            self_paladin_strength,
            (self_paladin_strength
                * enemy_knight_strength
                * troop_config.disadvantage_percent.into()
                / self_paladin_strength
                / PercentageValueImpl::_100())
        );
        let self_paladin_strength_with_disadvantage_max = self_paladin_strength
            - PercentageImpl::get(self_paladin_strength.into(), troop_config.disadvantage_percent.into());
        let self_paladin_strength_with_disadvantage = max(
            self_paladin_strength_with_disadvantage, self_paladin_strength_with_disadvantage_max
        );

        ///////////////////////////////////////////////////////////////////////////////

        let self_total_knight_strength = self_knight_strength
            + (self_knight_strength_with_advantage - self_knight_strength)
            - (self_knight_strength - self_knight_strength_with_disadvantage);
        let self_total_crossbowman_strength = self_crossbowman_strength
            + (self_crossbowman_strength_with_advantage - self_crossbowman_strength)
            - (self_crossbowman_strength - self_crossbowman_strength_with_disadvantage);
        let self_total_paladin_strength = self_paladin_strength
            + (self_paladin_strength_with_advantage - self_paladin_strength)
            - (self_paladin_strength - self_paladin_strength_with_disadvantage);

        let self_total_strength = self_total_knight_strength
            + self_total_paladin_strength
            + self_total_crossbowman_strength;

        return self_total_strength;
    }

    fn count(self: Troops) -> u64 {
        self.knight_count + self.paladin_count + self.crossbowman_count
    }

    fn reset_count_and_health(ref self: Troops, ref health: Health, troop_config: TroopConfig) {
        // make the troop count a percentage of the old health
        self.knight_count = self.actual_type_count(TroopType::Knight, @health);
        self.paladin_count = self.actual_type_count(TroopType::Paladin, @health);
        self.crossbowman_count = self.actual_type_count(TroopType::Crossbowman, @health);
        self.normalize_counts();

        // make the new health be the full health of updated troops
        health.clear();
        health.increase_by(self.full_health(troop_config));
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

        if *health.current == 0 {
            return 0;
        };

        ((count.into() * *health.current) / (*health).lifetime).try_into().unwrap()
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
        (self.actual_type_count(TroopType::Knight, health)
            + self.actual_type_count(TroopType::Paladin, health)
            + self.actual_type_count(TroopType::Crossbowman, health))
            .try_into()
            .unwrap()
    }
}

#[generate_trait]
impl AttackingArmyQuantityTrackerImpl of AttackingArmyQuantityTrackerTrait {
    fn key(entity_id: ID) -> felt252 {
        poseidon_hash_span(array![entity_id.into(), QuantityTrackerType::ARMY_COUNT.into()].span())
    }
}

#[derive(Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct Army {
    #[key]
    entity_id: ID,
    troops: Troops,
    battle_id: ID,
    battle_side: BattleSide
}

#[derive(Copy, Drop, Serde, Introspect, Default)]
struct BattleArmy {
    troops: Troops,
    battle_id: ID,
    battle_side: BattleSide
}

impl ArmyIntoBattlrArmyImpl of Into<Army, BattleArmy> {
    fn into(self: Army) -> BattleArmy {
        return BattleArmy { troops: self.troops, battle_id: self.battle_id, battle_side: self.battle_side };
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
         current: self.current, lifetime: self.lifetime };
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

    fn decrease_current_by(ref self: BattleHealth, value: u128) {
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

    fn steps_to_die(self: @BattleHealth, deduction: u128, troop_config: TroopConfig) -> u128 {
        Into::<BattleHealth, Health>::into(*self).steps_to_die(deduction, troop_config)
    }

    fn percentage_left(self: BattleHealth) -> u128 {
        Into::<BattleHealth, Health>::into(self).percentage_left()
    }
}


#[generate_trait]
impl ArmyImpl of ArmyTrait {
    fn won_battle(self: Army, battle: Battle) -> bool {
        self.battle_side == battle.winner()
    }

    fn is_in_battle(self: Army) -> bool {
        self.battle_id.is_non_zero()
    }

    fn assert_in_battle(self: Army) {
        assert!(self.battle_id.is_non_zero(), "army not in battle")
    }

    fn assert_within_limit(self: Army, troop_config: TroopConfig) {
        assert!(self.troops.count() <= troop_config.max_troop_count, "army count exceeds limit");
    }

    fn assert_not_in_battle(self: Army) {
        assert!(self.battle_id.is_zero(), "army {} in battle", self.entity_id);
    }
}


#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct Protector {
    #[key]
    entity_id: ID,
    army_id: ID,
}

#[generate_trait]
impl ProtectorImpl of ProtectorTrait {
    fn assert_has_no_defensive_army(self: Protector) {
        assert!(self.army_id.is_zero(), "Structure {} already has a defensive army", self.entity_id);
    }
}

#[derive(IntrospectPacked, Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct Protectee {
    #[key]
    army_id: ID,
    protectee_id: ID
}

#[generate_trait]
impl ProtecteeImpl of ProtecteeTrait {
    fn is_none(self: Protectee) -> bool {
        self.protectee_id == 0
    }

    fn is_other(self: Protectee) -> bool {
        self.protectee_id != 0
    }

    fn protected_entity(self: Protectee) -> ID {
        if self.is_other() {
            self.protectee_id
        } else {
            self.army_id
        }
    }
}


#[derive(Copy, Drop, Serde, Default)]
#[dojo::model]
pub struct Battle {
    #[key]
    entity_id: ID,
    attack_army: BattleArmy,
    attack_army_lifetime: BattleArmy,
    defence_army: BattleArmy,
    defence_army_lifetime: BattleArmy,
    attackers_resources_escrow_id: ID,
    defenders_resources_escrow_id: ID,
    attack_army_health: BattleHealth,
    defence_army_health: BattleHealth,
    attack_delta: u64,
    defence_delta: u64,
    last_updated: u64,
    duration_left: u64,
    start_at: u64,
}


#[derive(Copy, Drop, Serde, PartialEq, Debug, Introspect)]
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
impl BattleEscrowImpl of BattleEscrowTrait {
    fn deposit_lock_immediately(ref self: Battle, ref world: WorldStorage, army_protectee: Protectee) {
        let army_protectee_id = army_protectee.protected_entity();
        let mut army_resource_lock: ResourceTransferLock = world.read_model(army_protectee_id);
        army_resource_lock.assert_not_locked();

        let now = starknet::get_block_timestamp();
        assert!(army_resource_lock.start_at > now, "wrong lock invariant (1)");
        assert!(army_resource_lock.release_at > now, "wrong lock invariant (2)");

        army_resource_lock.start_at = now;
        world.write_model(@army_resource_lock);
    }


    fn deposit_balance(ref self: Battle, ref world: WorldStorage, from_army: Army, from_army_protectee: Protectee) {
        let from_army_protectee_id = from_army_protectee.protected_entity();
        let from_army_protectee_structure: Structure = world.read_model(from_army_protectee_id);
        let from_army_protectee_is_self: bool = !from_army_protectee_structure.is_structure();

        // ensure resources were not previously locked
        let mut from_army_resource_lock: ResourceTransferLock = world.read_model(from_army_protectee_id);
        from_army_resource_lock.assert_not_locked();

        if from_army_protectee_is_self {
            // detail items locked in box
            let escrow_id = match from_army.battle_side {
                BattleSide::None => { panic!("wrong battle side") },
                BattleSide::Attack => { self.attackers_resources_escrow_id },
                BattleSide::Defence => { self.defenders_resources_escrow_id }
            };
            let from_army_owned_resources: OwnedResourcesTracker = world.read_model(from_army_protectee_id);

            let mut all_resources = all_resource_ids();
            loop {
                match all_resources.pop_front() {
                    Option::Some(resource_type) => {
                        if from_army_owned_resources.owns_resource_type(resource_type) {
                            let from_army_resource = ResourceImpl::get(
                                ref world, (from_army_protectee_id, resource_type)
                            );
                            let mut escrow_resource = ResourceImpl::get(ref world, (escrow_id, resource_type));
                            escrow_resource.add(from_army_resource.balance);
                            escrow_resource.save(ref world);
                        }
                    },
                    Option::None => { break; }
                }
            };

            // lock the resources protected by the army immediately
            from_army_resource_lock.start_at = starknet::get_block_timestamp();
            from_army_resource_lock.release_at = Bounded::MAX;
            world.write_model(@from_army_resource_lock);
        } else {
            // lock resources of the entity being protected starting from
            // when the  battle starts to account for battle.start_at delay
            from_army_resource_lock.start_at = self.start_at;
            from_army_resource_lock.release_at = Bounded::MAX;
            world.write_model(@from_army_resource_lock);
        }
    }

    fn withdraw_balance_and_reward(
        ref self: Battle, ref world: WorldStorage, to_army: Army, to_army_protectee: Protectee
    ) {
        let (escrow_id, other_side_escrow_id) = match to_army.battle_side {
            BattleSide::None => { panic!("wrong battle side") },
            BattleSide::Attack => { (self.attackers_resources_escrow_id, self.defenders_resources_escrow_id) },
            BattleSide::Defence => { (self.defenders_resources_escrow_id, self.attackers_resources_escrow_id) }
        };

        let to_army_protectee_id = to_army_protectee.protected_entity();
        let to_army_protectee_structure: Structure = world.read_model(to_army_protectee_id);
        let to_army_protectee_is_self: bool = !to_army_protectee_structure.is_structure();

        let winner_side: BattleSide = self.winner();
        let to_army_dead = to_army.troops.count().is_zero();

        // the reason for checking if `to_army_dead` is `true` is that
        // it's possible for the battle be a draw and both sides die in the process.
        // if this edge case occurs, we assume they both lost for the purpose of this
        // function. They both forfeit their balances.
        let to_army_lost = to_army_dead || (winner_side != to_army.battle_side && winner_side != BattleSide::None);
        let to_army_won = (winner_side == to_army.battle_side && winner_side != BattleSide::None);
        let to_army_lost_or_battle_not_ended = (self.has_started() && !self.has_ended())
            || (self.has_ended() && to_army_lost);
        let to_army_owned_resources: OwnedResourcesTracker = world.read_model(to_army_protectee_id);
        let mut all_resources = all_resource_ids();
        let mut subtracted_resources_weight = 0;

        loop {
            match all_resources.pop_front() {
                Option::Some(resource_type) => {
                    if to_army_protectee_is_self && to_army_owned_resources.owns_resource_type(resource_type) {
                        let mut to_army_resource = ResourceImpl::get(ref world, (to_army_protectee_id, resource_type));
                        if to_army_lost_or_battle_not_ended {
                            // update army's subtracted weight
                            subtracted_resources_weight +=
                                WeightConfigImpl::get_weight_grams(ref world, resource_type, to_army_resource.balance);

                            // army forfeits resources
                            to_army_resource.burn((to_army_resource.balance));
                            to_army_resource.save(ref world);
                        } else {
                            // army won or drew so it can leave with its resources
                            //
                            // remove items from from battle escrow
                            let mut escrow_resource = ResourceImpl::get(ref world, (escrow_id, resource_type));
                            escrow_resource.burn(to_army_resource.balance);
                            escrow_resource.save(ref world);
                        }
                    }

                    if to_army_won {
                        // give winner loot share
                        let other_side_escrow_owned_resources: OwnedResourcesTracker = world
                            .read_model(other_side_escrow_id);
                        if other_side_escrow_owned_resources.owns_resource_type(resource_type) {
                            let to_army_side = if to_army.battle_side == BattleSide::Attack {
                                self.attack_army
                            } else {
                                self.defence_army
                            };

                            let mut other_side_escrow_resource = ResourceImpl::get(
                                ref world, (other_side_escrow_id, resource_type)
                            );

                            let share_amount = (other_side_escrow_resource.balance * to_army.troops.count().into())
                                / to_army_side.troops.count().into();

                            // burn share from escrow balance
                            other_side_escrow_resource.burn(share_amount);
                            other_side_escrow_resource.save(ref world);

                            // send loot to winner
                            InternalResourceSystemsImpl::mint_if_adequate_capacity(
                                ref world, to_army_protectee_id, (resource_type, share_amount), false
                            );
                        }
                    }
                },
                Option::None => { break; }
            }
        };

        // update weight after balance update
        let mut to_army_protectee_weight: Weight = world.read_model(to_army_protectee_id);
        let to_army_protectee_capacity: CapacityConfig = world.read_model(CapacityConfigCategory::Army);
        // decrease protectee weight if necessary
        if subtracted_resources_weight.is_non_zero() {
            to_army_protectee_weight.deduct(to_army_protectee_capacity, subtracted_resources_weight);
        }

        // release lock on resource
        let mut to_army_resource_lock: ResourceTransferLock = world.read_model(to_army_protectee_id);
        to_army_resource_lock.start_at = starknet::get_block_timestamp();
        to_army_resource_lock.release_at = starknet::get_block_timestamp();
        world.write_model(@to_army_resource_lock);
    }
}

#[generate_trait]
impl BattleStructureImpl of BattleStructureTrait {
    fn should_seige(structure_category: StructureCategory) -> bool {
        !(structure_category == StructureCategory::Hyperstructure
            || structure_category == StructureCategory::FragmentMine)
    }
}


#[generate_trait]
impl BattleImpl of BattleTrait {
    fn get(world: WorldStorage, battle_id: ID) -> Battle {
        let mut battle: Battle = world.read_model(battle_id);
        let troop_config: TroopConfig = TroopConfigImpl::get(world);
        battle.update_state(troop_config);
        return battle;
    }

    /// This function updated the armies health and duration
    /// of battle according to the set delta and battle duration
    ///
    /// Update state should be called before reading
    /// battle model values so that the correct values
    /// are gotten
    fn update_state(ref self: Battle, troop_config: TroopConfig) {
        let battle_duration_passed = self.duration_passed();
        self.attack_army_health.decrease_current_by((self.defence_delta.into() * battle_duration_passed.into()));
        self.defence_army_health.decrease_current_by((self.attack_delta.into() * battle_duration_passed.into()));
        self.update_troops_and_health(BattleSide::Attack, troop_config);
        self.update_troops_and_health(BattleSide::Defence, troop_config);
    }
    /// This function calculates the delta (rate at which health goes down per second)
    /// and therefore, the duration of tha battle.
    ///
    /// Reset delta should be called ONLY when the armies in the
    /// battle have changed. e.g when a new army is added to defence
    /// or attack.
    fn reset_delta(ref self: Battle, troop_config: TroopConfig) {
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
        self.duration_left = self.duration(troop_config);
    }


    fn duration(self: Battle, troop_config: TroopConfig) -> u64 {
        let mut attack_num_seconds_to_death = self
            .attack_army_health
            .steps_to_die(self.defence_delta.into(), troop_config);

        let mut defence_num_seconds_to_death = self
            .defence_army_health
            .steps_to_die(self.attack_delta.into(), troop_config);

        min(defence_num_seconds_to_death, attack_num_seconds_to_death).try_into().unwrap()
    }


    fn duration_passed(ref self: Battle) -> u64 {
        let now = starknet::get_block_timestamp();
        if now <= self.start_at {
            self.last_updated = now;
            return 0;
        }

        if self.last_updated < self.start_at {
            self.last_updated = self.start_at;
        }

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
    fn has_started(self: Battle) -> bool {
        let now = starknet::get_block_timestamp();
        let start_at = self.start_at;
        return now > start_at;
    }

    fn has_ended(self: Battle) -> bool {
        self.duration_left == 0
    }

    fn has_winner(self: Battle) -> bool {
        self.winner() != BattleSide::None
    }

    fn winner(self: Battle) -> BattleSide {
        if self.has_ended() {
            assert!(
                self.attack_army_health.current == 0 || self.defence_army_health.current == 0,
                "inaccurate winner invariant"
            );
            if self.attack_army_health.current > 0 {
                return BattleSide::Attack;
            }
            if self.defence_army_health.current > 0 {
                return BattleSide::Defence;
            }
        }
        // it's possible that both killed each other or battle has not ended
        return BattleSide::None;
    }

    fn join(ref self: Battle, side: BattleSide, troops: Troops, health: u128) {
        if side == BattleSide::Defence {
            self.defence_army.troops.add(troops);
            self.defence_army_lifetime.troops.add(troops);
            self.defence_army_health.increase_by(health);
        } else {
            self.attack_army.troops.add(troops);
            self.attack_army_lifetime.troops.add(troops);
            self.attack_army_health.increase_by(health);
        }
    }

    // update battle troops and their health to actual values after battle
    fn update_troops_and_health(ref self: Battle, side: BattleSide, troop_config: TroopConfig) {
        let (mut battle_army, mut battle_army_health) = if side == BattleSide::Defence {
            (self.defence_army, self.defence_army_health)
        } else {
            (self.attack_army, self.attack_army_health)
        };

        if battle_army_health.lifetime.is_non_zero() {
            battle_army
                .troops
                .knight_count =
                    ((battle_army_health.current * battle_army.troops.knight_count.into())
                        / battle_army_health.lifetime)
                .try_into()
                .unwrap();
            battle_army
                .troops
                .paladin_count =
                    ((battle_army_health.current * battle_army.troops.paladin_count.into())
                        / battle_army_health.lifetime)
                .try_into()
                .unwrap();
            battle_army
                .troops
                .crossbowman_count =
                    ((battle_army_health.current * battle_army.troops.crossbowman_count.into())
                        / battle_army_health.lifetime)
                .try_into()
                .unwrap();
            battle_army.troops.normalize_counts();
            battle_army_health.current = battle_army.troops.full_health(troop_config);
            battle_army_health.lifetime = battle_army.troops.full_health(troop_config);
            if side == BattleSide::Defence {
                self.defence_army = battle_army;
                self.defence_army_health = battle_army_health;
            } else {
                self.attack_army = battle_army;
                self.attack_army_health = battle_army_health;
            }
        }
    }

    fn get_troops_share_left(ref self: Battle, mut army: Army) -> Army {
        let (battle_army, battle_army_lifetime) = if army.battle_side == BattleSide::Defence {
            (self.defence_army, self.defence_army_lifetime)
        } else {
            (self.attack_army, self.attack_army_lifetime)
        };
        army
            .troops
            .knight_count =
                if army.troops.knight_count == 0 {
                    0
                } else {
                    army.troops.knight_count
                        * battle_army.troops.knight_count
                        / battle_army_lifetime.troops.knight_count
                };

        army
            .troops
            .paladin_count =
                if army.troops.paladin_count == 0 {
                    0
                } else {
                    army.troops.paladin_count
                        * battle_army.troops.paladin_count
                        / battle_army_lifetime.troops.paladin_count
                };

        army
            .troops
            .crossbowman_count =
                if army.troops.crossbowman_count == 0 {
                    0
                } else {
                    army.troops.crossbowman_count
                        * battle_army.troops.crossbowman_count
                        / battle_army_lifetime.troops.crossbowman_count
                };

        // normalize troop count
        army.troops.normalize_counts();

        return army;
    }

    fn reduce_battle_army_troops_and_health_by(
        ref self: Battle, army_before_normalization: Army, troop_config: TroopConfig
    ) {
        // update battle army count and health
        if army_before_normalization.battle_side == BattleSide::Defence {
            self.defence_army.troops.deduct(army_before_normalization.troops);
            self.defence_army_health.current = self.defence_army.troops.full_health(troop_config);
            self.defence_army_health.lifetime = self.defence_army.troops.full_health(troop_config);
        } else {
            self.attack_army.troops.deduct(army_before_normalization.troops);
            self.attack_army_health.current = self.attack_army.troops.full_health(troop_config);
            self.attack_army_health.lifetime = self.attack_army.troops.full_health(troop_config);
        }
    }

    // reduce battle army lifetime count by the original army count
    fn reduce_battle_army_lifetime_by(ref self: Battle, army_before_any_modification: Army) {
        if army_before_any_modification.battle_side == BattleSide::Defence {
            self.defence_army_lifetime.troops.deduct(army_before_any_modification.troops);
        } else {
            self.attack_army_lifetime.troops.deduct(army_before_any_modification.troops);
        }
    }

    fn is_empty(self: Battle) -> bool {
        self.attack_army_lifetime.troops.count().is_zero() && self.defence_army_lifetime.troops.count().is_zero()
    }
}

#[cfg(test)]
mod health_model_tests {
    use s0_eternum::models::combat::{Health, HealthTrait, TroopsImpl};
    use s0_eternum::models::config::{TroopConfig};

    fn mock_troop_config() -> TroopConfig {
        TroopConfig {
            config_id: 0,
            health: 7,
            knight_strength: 0,
            paladin_strength: 0,
            crossbowman_strength: 0,
            advantage_percent: 0,
            disadvantage_percent: 0,
            max_troop_count: 0,
            pillage_health_divisor: 0,
            army_free_per_structure: 0,
            army_extra_per_building: 0,
            army_max_per_structure: 0,
            battle_leave_slash_num: 0,
            battle_leave_slash_denom: 0,
            battle_time_scale: 0,
            battle_max_time_seconds: 0
        }
    }

    fn ONE_TROOP_HEALTH() -> u128 {
        return mock_troop_config().health.into() * TroopsImpl::normalization_factor().try_into().unwrap();
    }

    #[test]
    fn combat_test_health_steps_to_die__deduction_equal_single_troop() {
        let troop_config = mock_troop_config();
        let troop_count = 4;
        let current = ONE_TROOP_HEALTH() * troop_count;
        let deduction = ONE_TROOP_HEALTH();
        let health = Health { entity_id: 8, current, lifetime: current };
        let steps_to_die = health.steps_to_die(deduction, troop_config);
        assert_eq!(steps_to_die, troop_count);
    }

    #[test]
    fn combat_test_health_steps_to_die__deduction_greater_than_single_troop__with_deduction_has_remainder() {
        let troop_config = mock_troop_config();
        let current = ONE_TROOP_HEALTH() * 3;
        let deduction = ONE_TROOP_HEALTH() * 2; // 21_000 / 14_000 = 1.xx i.e has no remainder
        let health = Health { entity_id: 8, current, lifetime: current };
        let steps_to_die = health.steps_to_die(deduction, troop_config);
        assert_eq!(steps_to_die, 2);
    }

    #[test]
    fn combat_test_health_steps_to_die__deduction_greater_than_single_troop__with_deduction_no_remainder() {
        let troop_config = mock_troop_config();
        let current = ONE_TROOP_HEALTH() * 4;
        let deduction = ONE_TROOP_HEALTH() * 2; // 28_000 / 14_000 = 2 i.e has no remainder
        let health = Health { entity_id: 8, current, lifetime: current };
        let steps_to_die = health.steps_to_die(deduction, troop_config);
        assert_eq!(steps_to_die, 2);
    }

    #[test]
    fn combat_test_health_steps_to_die__deduction_less_than_single_troop__with_deduction_has_remainder() {
        let troop_config = mock_troop_config();
        let current = ONE_TROOP_HEALTH() * 3;
        let deduction = 81; // 14_000 / 81 = 172.xx i.e has remainder
        let health = Health { entity_id: 8, current, lifetime: current };
        let steps_to_die = health.steps_to_die(deduction, troop_config);
        assert_eq!(steps_to_die, ((current - ONE_TROOP_HEALTH()) / deduction) + 1);
    }
    #[test]
    fn combat_test_health_steps_to_die__deduction_less_than_single_troop__with_deduction_no_remainder() {
        let troop_config = mock_troop_config();
        let current = ONE_TROOP_HEALTH() * 3;
        let deduction = 80; // 14_000 / 80 = 175 i.e has no remainder
        let health = Health { entity_id: 8, current, lifetime: current };
        let steps_to_die = health.steps_to_die(deduction, troop_config);
        assert_eq!(steps_to_die, ((current - ONE_TROOP_HEALTH()) / deduction) + 1);
    }
}


#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelValueStorage, ModelStorageTest};
    use dojo::world::IWorldDispatcherTrait;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use dojo_cairo_test::{NamespaceDef, TestResource, ContractDefTrait};
    use s0_eternum::constants::ID;
    use s0_eternum::constants::ResourceTypes;
    use s0_eternum::models::capacity::{CapacityCategory};
    use s0_eternum::models::combat::BattleEscrowTrait;
    use s0_eternum::models::combat::BattleHealthTrait;
    use s0_eternum::models::combat::BattleTrait;
    use s0_eternum::models::combat::TroopsTrait;
    use s0_eternum::models::config::BattleConfig;
    use s0_eternum::models::config::BattleConfigTrait;
    use s0_eternum::models::config::CapacityConfigCategory;
    use s0_eternum::models::quantity::{Quantity};
    use s0_eternum::models::resources::ResourceTrait;
    use s0_eternum::models::resources::ResourceTransferLockTrait;
    use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceTransferLock};
    use s0_eternum::utils::testing::world::spawn_eternum;
    use super::{Battle, BattleHealth, BattleArmy, BattleSide, Troops, TroopConfig, Army, ArmyImpl, Protectee};

    fn mock_troop_config() -> TroopConfig {
        TroopConfig {
            config_id: 0,
            health: 1,
            knight_strength: 1,
            paladin_strength: 1,
            crossbowman_strength: 1,
            advantage_percent: 1000,
            disadvantage_percent: 1000,
            max_troop_count: 10_000_000_000_000 * 1000,
            pillage_health_divisor: 8,
            army_free_per_structure: 100,
            army_extra_per_building: 100,
            army_max_per_structure: 200,
            battle_leave_slash_num: 25,
            battle_leave_slash_denom: 100,
            battle_time_scale: 1000,
            battle_max_time_seconds: 2 * 86400
        }
    }

    fn mock_battle_config() -> BattleConfig {
        BattleConfig {
            config_id: 0, regular_immunity_ticks: 0, hyperstructure_immunity_ticks: 0, battle_delay_seconds: 0,
        }
    }

    fn mock_troops(a: u64, b: u64, c: u64) -> Troops {
        Troops { knight_count: a, paladin_count: b, crossbowman_count: c, }
    }


    fn mock_battle(attack_troops_each: u64, defence_troops_each: u64) -> Battle {
        let troop_config = mock_troop_config();
        let attack_troops = mock_troops(attack_troops_each, attack_troops_each, attack_troops_each);
        let defence_troops = mock_troops(defence_troops_each, defence_troops_each, defence_troops_each);

        let mut battle: Battle = Battle {
            entity_id: 45,
            attack_army: BattleArmy { troops: attack_troops, battle_id: 0, battle_side: BattleSide::Attack },
            defence_army: BattleArmy { troops: defence_troops, battle_id: 0, battle_side: BattleSide::Defence },
            attackers_resources_escrow_id: 998,
            defenders_resources_escrow_id: 999,
            attack_army_health: BattleHealth {
                current: attack_troops.full_health(troop_config), lifetime: attack_troops.full_health(troop_config)
            },
            defence_army_health: BattleHealth {
                current: defence_troops.full_health(troop_config), lifetime: defence_troops.full_health(troop_config)
            },
            attack_delta: 0,
            defence_delta: 0,
            last_updated: starknet::get_block_timestamp(),
            start_at: starknet::get_block_timestamp(),
            duration_left: 0,
            defence_army_lifetime: BattleArmy {
                troops: defence_troops, battle_id: 0, battle_side: BattleSide::Defence
            },
            attack_army_lifetime: BattleArmy { troops: attack_troops, battle_id: 0, battle_side: BattleSide::Attack },
        };

        battle.reset_delta(mock_troop_config());

        battle
    }

    #[test]
    fn combat_test_battle_reset_delta() {
        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let first_duration = battle.duration_left;
        let troop_config = mock_troop_config();

        // give defence more strength and health
        battle.defence_army.troops.paladin_count += defence_troop_each;
        battle.defence_army_health.increase_by(troop_config.health.into() * defence_troop_each.into());
        battle.reset_delta(troop_config);

        // ensure the defence is now stronger and battle time is shorter
        assert!(battle.duration_left < first_duration, "battle should be shorter");

        let second_duration = battle.duration_left;

        // take strength and health from defence
        battle.defence_army.troops.paladin_count -= defence_troop_each;
        battle.defence_army_health.decrease_current_by(troop_config.health.into() * defence_troop_each.into());
        battle.defence_army_health.lifetime -= troop_config.health.into() * defence_troop_each.into();
        battle.reset_delta(troop_config);

        // ensure the defence is now stronger and battle time is longer
        assert!(battle.duration_left > second_duration, "battle should be longer");
    }


    #[test]
    fn combat_test_battle_update_state_before_battle_end() {
        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        // move time up but before battle ends
        starknet::testing::set_block_timestamp(battle.duration_left - 1);
        let troop_config = mock_troop_config();
        battle.update_state(troop_config);
        assert!(battle.has_ended() == false, "battle should not have ended");
    }


    #[test]
    fn combat_test_battle_update_state_after_battle_end() {
        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        // move time up to battle duration
        starknet::testing::set_block_timestamp(battle.duration_left);
        let troop_config = mock_troop_config();
        battle.update_state(troop_config);
        assert!(battle.has_ended() == true, "battle should have ended");
    }


    #[test]
    fn combat_test_battle_deposit_balance() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let mut world = spawn_eternum();
        world.dispatcher.uuid(); // use id 0;

        // recreate army for testing
        let attack_army = Army {
            entity_id: world.dispatcher.uuid(),
            troops: mock_troops(attack_troop_each, attack_troop_each, attack_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Attack
        };

        // give the army wheat and coal
        let mut attack_army_wheat_resource: Resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::WHEAT, balance: 699
        };
        let mut attack_army_coal_resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::COAL, balance: 844
        };
        attack_army_wheat_resource.save(ref world);
        attack_army_coal_resource.save(ref world);

        // deposit everything the army owns
        let attack_army_protectee: Protectee = world.read_model(attack_army.entity_id);
        battle.deposit_balance(ref world, attack_army, attack_army_protectee);

        // ensure the deposit was sent to the right escrow
        let escrow_id = battle.attackers_resources_escrow_id;
        let escrow_wheat: Resource = world.read_model((escrow_id, ResourceTypes::WHEAT));
        let escrow_coal: Resource = world.read_model((escrow_id, ResourceTypes::COAL));
        assert_eq!(escrow_wheat.balance, attack_army_wheat_resource.balance);
        assert_eq!(escrow_coal.balance, attack_army_coal_resource.balance);

        // ensure transfer lock was enabled
        let army_transfer_lock: ResourceTransferLock = world.read_model(attack_army.entity_id);
        army_transfer_lock.assert_locked();
    }


    #[test]
    fn combat_test_battle_deposit_balance_for_structure_army() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let mut world = spawn_eternum();
        world.dispatcher.uuid(); // use id 0;

        // recreate army for testing
        let attack_army = Army {
            entity_id: world.dispatcher.uuid(),
            troops: mock_troops(attack_troop_each, attack_troop_each, attack_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Attack
        };

        // give the army wheat and coal
        let mut attack_army_wheat_resource: Resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::WHEAT, balance: 699
        };
        let mut attack_army_coal_resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::COAL, balance: 844
        };
        attack_army_wheat_resource.save(ref world);
        attack_army_coal_resource.save(ref world);

        // deposit everything the army owns
        let attack_army_protectee = Protectee { army_id: attack_army.entity_id, protectee_id: 67890989 // non zero
         };
        battle.deposit_balance(ref world, attack_army, attack_army_protectee);

        // ensure escrow does not receive the resources because
        // it will cost too much gas
        let escrow_id = battle.attackers_resources_escrow_id;
        let escrow_wheat: Resource = world.read_model((escrow_id, ResourceTypes::WHEAT));
        let escrow_coal: Resource = world.read_model((escrow_id, ResourceTypes::COAL));
        assert_eq!(escrow_wheat.balance, 0);
        assert_eq!(escrow_coal.balance, 0);

        // ensure transfer lock was enabled
        let army_transfer_lock: ResourceTransferLock = world.read_model(attack_army_protectee.protectee_id);
        army_transfer_lock.assert_locked();
    }


    #[test]
    fn combat_test_battle_withdraw_balance_and_reward__when_you_lose() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        // use small army
        let attack_troop_each = 1_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let mut world = spawn_eternum();
        world.dispatcher.uuid(); // use id 0;

        //////////////////////    Defence Army    /////////////////////////
        ///
        // recreate defense army for testing
        let defence_army = Army {
            entity_id: world.dispatcher.uuid(),
            troops: mock_troops(defence_troop_each, defence_troop_each, defence_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Defence
        };

        // give defence army stone
        let mut defence_army_stone_resource: Resource = Resource {
            entity_id: defence_army.entity_id, resource_type: ResourceTypes::STONE, balance: 344
        };
        defence_army_stone_resource.save(ref world);

        // deposit everything the defence army owns
        let defence_army_protectee: Protectee = world.read_model(defence_army.entity_id);
        battle.deposit_balance(ref world, defence_army, defence_army_protectee);

        //////////////////////    Attack Army    /////////////////////////
        ///
        // recreate army for testing
        let attack_army = Army {
            entity_id: world.dispatcher.uuid(),
            troops: mock_troops(attack_troop_each, attack_troop_each, attack_troop_each), // has no effect on outcome
            battle_id: battle.entity_id,
            battle_side: BattleSide::Attack
        };

        // give the army wheat and coal
        let mut attack_army_wheat_resource: Resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::WHEAT, balance: 699
        };
        let mut attack_army_coal_resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::COAL, balance: 844
        };
        attack_army_wheat_resource.save(ref world);
        attack_army_coal_resource.save(ref world);

        // deposit everything the army owns
        let attack_army_protectee = world.read_model(attack_army.entity_id);
        battle.deposit_balance(ref world, attack_army, attack_army_protectee);

        // lose battle
        starknet::testing::set_block_timestamp(battle.duration_left + 1); // original ts was 1
        let troop_config = mock_troop_config();
        battle.update_state(troop_config);
        assert!(battle.has_ended(), "Battle should have ended");
        assert!(battle.winner() == BattleSide::Defence, "unexpected side won");

        // withdraw back from escrow
        let attack_army_left = battle.get_troops_share_left(attack_army);
        let attack_army_left_quantity = Quantity {
            entity_id: attack_army.entity_id, value: attack_army_left.troops.count().into()
        };
        world.write_model_test(@attack_army_left_quantity);
        battle.withdraw_balance_and_reward(ref world, attack_army, attack_army_protectee);

        // ensure transfer lock was reenabled
        let army_transfer_lock: ResourceTransferLock = world.read_model(attack_army.entity_id);
        army_transfer_lock.assert_not_locked();

        // ensure the army didn't get balance back
        let attack_army_wheat: Resource = world.read_model((attack_army.entity_id, ResourceTypes::WHEAT));
        let attack_army_coal: Resource = world.read_model((attack_army.entity_id, ResourceTypes::COAL));
        assert!(attack_army_wheat.balance == 0, "attacking army wheat balance should be 0");
        assert!(attack_army_coal.balance == 0, "attacking army coal balance should be 0");

        // ensure attacker got no reward
        let attack_army_stone: Resource = world.read_model((attack_army.entity_id, ResourceTypes::STONE));
        assert_eq!(attack_army_stone.balance, 0);
    }


    #[test]
    fn combat_test_battle_withdraw_balance_and_reward__when_you_draw() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        // use small army
        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let mut world = spawn_eternum();
        world.dispatcher.uuid(); // use id 0;
        //////////////////////    Defence Army    /////////////////////////
        ///
        // recreate defense army for testing
        let defence_army = Army {
            entity_id: world.dispatcher.uuid(),
            troops: mock_troops(defence_troop_each, defence_troop_each, defence_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Defence
        };

        // give defence army stone
        let mut defence_army_stone_resource: Resource = Resource {
            entity_id: defence_army.entity_id, resource_type: ResourceTypes::STONE, balance: 344
        };
        defence_army_stone_resource.save(ref world);

        // deposit everything the defence army owns
        let defence_army_protectee: Protectee = world.read_model(defence_army.entity_id);
        battle.deposit_balance(ref world, defence_army, defence_army_protectee);

        //////////////////////    Attack Army    /////////////////////////
        ///
        // recreate army for testing
        let attack_army = Army {
            entity_id: world.dispatcher.uuid(),
            troops: mock_troops(attack_troop_each, attack_troop_each, attack_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Attack
        };

        // give the army wheat and coal
        let mut attack_army_wheat_resource: Resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::WHEAT, balance: 699
        };
        let mut attack_army_coal_resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::COAL, balance: 844
        };
        attack_army_wheat_resource.save(ref world);
        attack_army_coal_resource.save(ref world);

        // deposit everything the army owns
        let attack_army_protectee: Protectee = world.read_model(attack_army.entity_id);
        battle.deposit_balance(ref world, attack_army, attack_army_protectee);

        // lose battle
        starknet::testing::set_block_timestamp(battle.duration_left + 1); // original ts was 1
        let troop_config = mock_troop_config();
        battle.update_state(troop_config);
        assert!(battle.has_ended(), "Battle should have ended");
        assert!(battle.winner() == BattleSide::None, "unexpected side won");

        // withdraw back from escrow
        let attack_army_left = battle.get_troops_share_left(attack_army);
        let attack_army_left_quantity = Quantity {
            entity_id: attack_army.entity_id, value: attack_army_left.troops.count().into()
        };
        world.write_model_test(@attack_army_left_quantity);
        battle.withdraw_balance_and_reward(ref world, attack_army_left, attack_army_protectee);

        // ensure transfer lock was reenabled
        let army_transfer_lock: ResourceTransferLock = world.read_model(attack_army.entity_id);
        army_transfer_lock.assert_not_locked();

        // ensure the army gets balance back
        let attack_army_wheat: Resource = world.read_model((attack_army.entity_id, ResourceTypes::WHEAT));
        let attack_army_coal: Resource = world.read_model((attack_army.entity_id, ResourceTypes::COAL));

        assert_eq!(attack_army_wheat.balance, 0);
        assert_eq!(attack_army_coal.balance, 0);

        // ensure attacker got no reward
        let attack_army_stone: Resource = world.read_model((attack_army.entity_id, ResourceTypes::STONE));
        assert_eq!(attack_army_stone.balance, 0);
    }


    #[test]
    fn combat_test_battle_withdraw_balance_and_reward__when_you_win() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        // use small army
        let attack_troop_each = 40_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let mut world = spawn_eternum();
        world.dispatcher.uuid(); // use id 0;

        //////////////////////    Defence Army    /////////////////////////
        ///
        // recreate defense army for testing
        let defence_army = Army {
            entity_id: world.dispatcher.uuid(),
            troops: mock_troops(defence_troop_each, defence_troop_each, defence_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Defence
        };
        // set defence army capacity category
        world
            .write_model_test(
                @CapacityCategory { entity_id: defence_army.entity_id, category: CapacityConfigCategory::Army }
            );

        // give defence army stone
        let mut defence_army_stone_resource: Resource = Resource {
            entity_id: defence_army.entity_id, resource_type: ResourceTypes::STONE, balance: 344
        };
        defence_army_stone_resource.save(ref world);

        // deposit everything the defence army owns
        let defence_army_protectee: Protectee = world.read_model(defence_army.entity_id);
        battle.deposit_balance(ref world, defence_army, defence_army_protectee);

        //////////////////////    Attack Army    /////////////////////////
        ///
        // recreate attack army for testing
        let attack_army = Army {
            entity_id: world.dispatcher.uuid(),
            troops: mock_troops(attack_troop_each, attack_troop_each, attack_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Attack
        };

        // set attack army capacity category

        world
            .write_model_test(
                @CapacityCategory { entity_id: attack_army.entity_id, category: CapacityConfigCategory::Army }
            );

        // give the army wheat and coal
        let mut attack_army_wheat_resource: Resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::WHEAT, balance: 699
        };
        let mut attack_army_coal_resource = Resource {
            entity_id: attack_army.entity_id, resource_type: ResourceTypes::COAL, balance: 844
        };
        attack_army_wheat_resource.save(ref world);
        attack_army_coal_resource.save(ref world);

        // deposit everything the army owns
        let attack_army_protectee: Protectee = world.read_model(attack_army.entity_id);
        battle.deposit_balance(ref world, attack_army, attack_army_protectee);

        //////////////////////    Battle    /////////////////////////

        // attacker wins battle
        starknet::testing::set_block_timestamp(battle.duration_left + 1); // original ts was 1
        let troop_config = mock_troop_config();
        battle.update_state(troop_config);
        assert!(battle.has_ended(), "Battle should have ended");
        assert!(battle.winner() == BattleSide::Attack, "unexpected side won");

        // attacker withdraw back from escrow
        let attack_army_left = battle.get_troops_share_left(attack_army);
        let attack_army_left_quantity = Quantity {
            entity_id: attack_army.entity_id, value: attack_army_left.troops.count().into()
        };
        world.write_model_test(@attack_army_left_quantity);
        battle.withdraw_balance_and_reward(ref world, attack_army_left, attack_army_protectee);

        // ensure transfer lock was reenabled
        let army_transfer_lock: ResourceTransferLock = world.read_model(attack_army.entity_id);
        army_transfer_lock.assert_not_locked();

        // ensure the army gets balance back
        let attack_army_wheat: Resource = world.read_model((attack_army.entity_id, ResourceTypes::WHEAT));
        let attack_army_coal: Resource = world.read_model((attack_army.entity_id, ResourceTypes::COAL));
        assert!(
            attack_army_wheat.balance == attack_army_wheat_resource.balance,
            "attacking army wheat balance should be > 0"
        );
        assert!(
            attack_army_coal.balance == attack_army_coal_resource.balance, "attacking army coal balance should be > 0"
        );

        // ensure the attack army gets reward
        let attack_army_stone: Resource = world.read_model((attack_army.entity_id, ResourceTypes::STONE));
        assert_eq!(attack_army_stone.balance, defence_army_stone_resource.balance);
    }
    // #[test]
// fn combat_test_show_battle() {
//     let attack_troop_each = 240_000;
//     let defence_troop_each = 10_000;
//     let mut battle = mock_battle(attack_troop_each, defence_troop_each);
//         // starknet::testing::set_block_timestamp(battle.duration_left + 1); // original ts
//         was 1 // battle.update_state();
//     print!("\n\n Attack Troops each: {} \n\n", attack_troop_each);
//     print!("\n\n Defence Troops each: {} \n\n", defence_troop_each);
//     print!("\n\n Attack Army health: {} \n\n", battle.attack_army_health.current);
//     print!("\n\n Defence delta: {} \n\n", battle.defence_delta);

    //     print!("\n\n Defence Army health: {} \n\n", battle.defence_army_health.current);
//     print!("\n\n Attack delta: {} \n\n", battle.attack_delta);

    //     print!("\n\n Scale A: {} \n\n",battle.attack_army.troops.count() /
//     battle.defence_army.troops.count());
//     print!("\n\n Scale B: {} \n\n", battle.defence_army.troops.count()
//     /battle.attack_army.troops.count());
//     print!("\n\n Duration in Seconds: {} \n\n", battle.duration_left);
//     print!("\n\n Duration in Minutes: {} \n\n", battle.duration_left / 60);
//     print!("\n\n Duration in Hours: {} \n\n", battle.duration_left / (60 * 60));

    //     let divisior = 8;
//     let attacker_h_left = battle.attack_army_health.current - (battle.defence_delta.into() *
//     (battle.duration_left.into() / divisior ));
//     let attacker_ratio = (battle.attack_army_health.current - attacker_h_left) * 100 /
//     battle.attack_army_health.current;
//     let defence_h_left = battle.defence_army_health.current - (battle.attack_delta.into() *
//     (battle.duration_left.into() / divisior ));
//     let defence_ratio = (battle.defence_army_health.current - defence_h_left) * 100 /
//     battle.defence_army_health.current;

    //     print!("\n\n Pillage Attacker Loss: {}, Ratio is {}% \n\n", attacker_h_left,
//     attacker_ratio);
//     print!("\n\n Pillage Defender Loss: {}, Ratio is {}% \n\n", defence_h_left,
//     defence_ratio);

    // }
}
