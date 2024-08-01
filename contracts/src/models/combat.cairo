use core::array::ArrayTrait;
use core::integer::BoundedInt;
use core::option::OptionTrait;
use core::poseidon::poseidon_hash_span;
use core::traits::Into;
use core::traits::TryInto;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use eternum::alias::ID;
use eternum::constants::all_resource_ids;
use eternum::models::capacity::{Capacity, CapacityCustomTrait};
use eternum::models::config::{BattleConfig, BattleConfigCustomImpl, BattleConfigCustomTrait};
use eternum::models::config::{TroopConfig, TroopConfigCustomImpl, TroopConfigCustomTrait};
use eternum::models::config::{WeightConfig, WeightConfigCustomImpl};
use eternum::models::quantity::{Quantity, QuantityTracker, QuantityTrackerType, QuantityCustomTrait};
use eternum::models::resources::OwnedResourcesTrackerCustomTrait;
use eternum::models::resources::ResourceCustomTrait;
use eternum::models::resources::ResourceTransferLockCustomTrait;
use eternum::models::resources::{
    Resource, ResourceCustomImpl, ResourceCost, ResourceTransferLock, OwnedResourcesTracker,
    OwnedResourcesTrackerCustomImpl
};
use eternum::models::structure::{Structure, StructureCustomImpl};
use eternum::models::weight::Weight;
use eternum::models::weight::WeightCustomTrait;
use eternum::utils::math::{PercentageImpl, PercentageValueImpl, min, max};
use eternum::utils::number::NumberTrait;

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
impl HealthCustomImpl of HealthCustomTrait {
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

    fn steps_to_die(self: @Health, mut deduction: u128) -> u128 {
        if deduction == 0 {
            return 0;
        };

        let mut num_steps = *self.current / deduction;
        if (num_steps % deduction) > 0 {
            num_steps += 1;
        }

        // this condition is here in case
        // self.current < deduction which would make
        // num_steps = 0 but that would cause the
        // "inaccurate winner invariant" error so we make it
        // at least 1.
        max(num_steps, 1)
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
        let self_delta: i128 = self.strength_against(self_health, enemy_troops, enemy_health, troop_config);
        let self_delta_abs: u64 = Into::<i128, felt252>::into(self_delta.abs()).try_into().unwrap();

        let enemy_delta: i128 = enemy_troops.strength_against(enemy_health, self, self_health, troop_config);
        let enemy_delta_abs: u64 = Into::<i128, felt252>::into(enemy_delta.abs()).try_into().unwrap();

        return (enemy_delta_abs, self_delta_abs);
    }

    /// @dev Calculates the net combat strength of one troop against another, factoring in
    /// troop-specific strengths and advantages/disadvantages.
    /// @param self Reference to the instance of the Troops struct representing the attacking
    /// troops.
    /// @param enemy_troops Reference to the instance of the Troops struct representing the
    /// defending troops.
    /// @param troop_config Configuration object containing strength and advantage/disadvantage
    /// percentages for each troop type.
    /// @return The net combat strength as an integer, where a positive number indicates a strength
    /// advantage for the attacking troops.
    fn strength_against(
        self: @Troops, self_health: @Health, enemy_troops: @Troops, enemy_health: @Health, troop_config: TroopConfig
    ) -> i128 {
        let self = *self;
        let enemy_troops = *enemy_troops;

        ///////////////         Calculate the strength of the Attacker      //////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////

        let mut self_knight_strength: u64 = self.actual_type_count(TroopType::Knight, self_health).into()
            * troop_config.knight_strength.into();
        self_knight_strength += PercentageImpl::get(self_knight_strength.into(), troop_config.advantage_percent.into());

        let mut self_paladin_strength: u64 = self.actual_type_count(TroopType::Paladin, self_health).into()
            * troop_config.paladin_strength.into();
        self_paladin_strength +=
            PercentageImpl::get(self_paladin_strength.into(), troop_config.advantage_percent.into());

        let mut self_crossbowman_strength: u64 = self.actual_type_count(TroopType::Crossbowman, self_health).into()
            * troop_config.crossbowman_strength.into();
        self_crossbowman_strength +=
            PercentageImpl::get(self_crossbowman_strength.into(), troop_config.advantage_percent.into());

        ///////////////         Calculate the strength of the Defender      //////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////

        let mut enemy_knight_strength: u64 = enemy_troops.actual_type_count(TroopType::Knight, enemy_health).into()
            * troop_config.knight_strength.into();
        enemy_knight_strength -= PercentageImpl::get(enemy_knight_strength, troop_config.disadvantage_percent.into());

        let mut enemy_paladin_strength: u64 = enemy_troops.actual_type_count(TroopType::Paladin, enemy_health).into()
            * troop_config.paladin_strength.into();
        enemy_paladin_strength -= PercentageImpl::get(enemy_paladin_strength, troop_config.disadvantage_percent.into());

        let mut enemy_crossbowman_strength: u64 = enemy_troops
            .actual_type_count(TroopType::Crossbowman, enemy_health)
            .into()
            * troop_config.crossbowman_strength.into();
        enemy_crossbowman_strength -=
            PercentageImpl::get(enemy_crossbowman_strength, troop_config.disadvantage_percent.into());

        ///////////////          Calculate the strength difference          //////////////////////
        //////////////////////////////////////////////////////////////////////////////////////////

        let self_knight_strength: i128 = self_knight_strength.into() - enemy_paladin_strength.into();
        let self_paladin_strength: i128 = self_paladin_strength.into() - enemy_crossbowman_strength.into();
        let self_crossbowman_strength: i128 = self_crossbowman_strength.into() - enemy_knight_strength.into();

        self_knight_strength + self_paladin_strength + self_crossbowman_strength
    }

    fn count(self: Troops) -> u64 {
        self.knight_count + self.paladin_count + self.crossbowman_count
    }

    fn reset_count_and_health(ref self: Troops, ref health: Health, troop_config: TroopConfig) {
        // make the troop count a percentage of the old health
        self.knight_count = self.actual_type_count(TroopType::Knight, @health);
        self.paladin_count = self.actual_type_count(TroopType::Paladin, @health);
        self.crossbowman_count = self.actual_type_count(TroopType::Crossbowman, @health);

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
impl AttackingArmyQuantityTrackerCustomImpl of AttackingArmyQuantityTrackerCustomTrait {
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

impl ArmyIntoBattlrArmyCustomImpl of Into<Army, BattleArmy> {
    fn into(self: Army) -> BattleArmy {
        return BattleArmy { troops: self.troops, battle_id: self.battle_id, battle_side: self.battle_side };
    }
}


#[derive(Introspect, Copy, Drop, Serde, Default)]
struct BattleHealth {
    current: u128,
    lifetime: u128
}

impl HealthIntoBattleHealthCustomImpl of Into<Health, BattleHealth> {
    fn into(self: Health) -> BattleHealth {
        return BattleHealth { // entity_id: self.entity_id,
         current: self.current, lifetime: self.lifetime };
    }
}

impl BattleHealthIntoHealthCustomImpl of Into<BattleHealth, Health> {
    fn into(self: BattleHealth) -> Health {
        return Health { entity_id: 0, current: self.current, lifetime: self.lifetime };
    }
}

#[generate_trait]
impl BattleHealthCustomImpl of BattleHealthCustomTrait {
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

    fn steps_to_die(self: @BattleHealth, deduction: u128) -> u128 {
        Into::<BattleHealth, Health>::into(*self).steps_to_die(deduction)
    }

    fn percentage_left(self: BattleHealth) -> u128 {
        Into::<BattleHealth, Health>::into(self).percentage_left()
    }
}


#[generate_trait]
impl ArmyCustomImpl of ArmyCustomTrait {
    fn won_battle(self: Army, battle: Battle) -> bool {
        self.battle_side == battle.winner()
    }

    fn is_in_battle(self: Army) -> bool {
        self.battle_id.is_non_zero()
    }

    fn assert_in_battle(self: Army) {
        assert!(self.battle_id.is_non_zero(), "army not in battle")
    }

    fn assert_not_in_battle(self: Army) {
        assert!(self.battle_id.is_zero(), "army in battle")
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
impl ProtectorCustomImpl of ProtectorCustomTrait {
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
impl ProtecteeCustomImpl of ProtecteeCustomTrait {
    fn is_none(self: Protectee) -> bool {
        self.protectee_id == 0
    }

    fn is_other(self: Protectee) -> bool {
        self.protectee_id != 0
    }

    fn protected_resources_holder(self: Protectee) -> ID {
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
    duration_left: u64
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
    fn deposit_balance(ref self: Battle, world: IWorldDispatcher, from_army: Army, from_army_protectee: Protectee) {
        let from_army_protectee_id = from_army_protectee.protected_resources_holder();
        let from_army_protectee_is_self: bool = !get!(world, from_army_protectee_id, Structure).is_structure();
        if from_army_protectee_is_self {
            // detail items locked in box
            let escrow_id = match from_army.battle_side {
                BattleSide::None => { panic!("wrong battle side") },
                BattleSide::Attack => { self.attackers_resources_escrow_id },
                BattleSide::Defence => { self.defenders_resources_escrow_id }
            };
            let from_army_owned_resources: OwnedResourcesTracker = get!(
                world, from_army_protectee_id, OwnedResourcesTracker
            );

            let mut all_resources = all_resource_ids();
            loop {
                match all_resources.pop_front() {
                    Option::Some(resource_type) => {
                        if from_army_owned_resources.owns_resource_type(resource_type) {
                            let from_army_resource = ResourceCustomImpl::get(
                                world, (from_army_protectee_id, resource_type)
                            );
                            let mut escrow_resource = ResourceCustomImpl::get(world, (escrow_id, resource_type));
                            escrow_resource.add(from_army_resource.balance);
                            escrow_resource.save(world);
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

    fn withdraw_balance_and_reward(
        ref self: Battle, world: IWorldDispatcher, to_army: Army, to_army_protectee: Protectee
    ) {
        let (escrow_id, other_side_escrow_id) = match to_army.battle_side {
            BattleSide::None => { panic!("wrong battle side") },
            BattleSide::Attack => { (self.attackers_resources_escrow_id, self.defenders_resources_escrow_id) },
            BattleSide::Defence => { (self.defenders_resources_escrow_id, self.attackers_resources_escrow_id) }
        };

        let to_army_protectee_id = to_army_protectee.protected_resources_holder();
        let to_army_protectee_is_self: bool = !get!(world, to_army_protectee_id, Structure).is_structure();

        let winner_side: BattleSide = self.winner();
        let to_army_dead = to_army.troops.count().is_zero();

        // the reason for checking if `to_army_dead` is `true` is that
        // it's possible for the battle be a draw and both sides die in the process.
        // if this edge case occurs, we assume they both lost for the purpose of this
        // function. They both forfeit their balances.
        let to_army_lost = to_army_dead || (winner_side != to_army.battle_side && winner_side != BattleSide::None);
        let to_army_won = (winner_side == to_army.battle_side && winner_side != BattleSide::None);
        let to_army_lost_or_battle_not_ended = !self.has_ended() || (self.has_ended() && to_army_lost);
        let to_army_owned_resources: OwnedResourcesTracker = get!(world, to_army_protectee_id, OwnedResourcesTracker);
        let mut all_resources = all_resource_ids();
        let mut subtracted_resources_weight = 0;
        let mut added_resources_weight = 0;

        loop {
            match all_resources.pop_front() {
                Option::Some(resource_type) => {
                    if to_army_protectee_is_self && to_army_owned_resources.owns_resource_type(resource_type) {
                        let mut to_army_resource = ResourceCustomImpl::get(
                            world, (to_army_protectee_id, resource_type)
                        );
                        if to_army_lost_or_battle_not_ended {
                            // army forfeits resources
                            to_army_resource.burn((to_army_resource.balance));
                            to_army_resource.save(world);

                            // update army's subtracted weight
                            subtracted_resources_weight +=
                                WeightConfigCustomImpl::get_weight(world, resource_type, to_army_resource.balance);
                        } else {
                            // army won or drew so it can leave with its resources
                            //
                            // remove items from from battle escrow
                            let mut escrow_resource = ResourceCustomImpl::get(world, (escrow_id, resource_type));
                            escrow_resource.burn(to_army_resource.balance);
                            escrow_resource.save(world);
                        }
                    }

                    if to_army_won {
                        // give winner loot share
                        let other_side_escrow_owned_resources: OwnedResourcesTracker = get!(
                            world, other_side_escrow_id, OwnedResourcesTracker
                        );
                        if other_side_escrow_owned_resources.owns_resource_type(resource_type) {
                            let to_army_side = if to_army.battle_side == BattleSide::Attack {
                                self.attack_army
                            } else {
                                self.defence_army
                            };

                            let mut other_side_escrow_resource = ResourceCustomImpl::get(
                                world, (other_side_escrow_id, resource_type)
                            );

                            let share_amount = (other_side_escrow_resource.balance * to_army.troops.count().into())
                                / to_army_side.troops.count().into();

                            // burn share from escrow balance
                            other_side_escrow_resource.burn(share_amount);
                            other_side_escrow_resource.save(world);

                            // give loot share to winner
                            let mut to_army_resource = ResourceCustomImpl::get(
                                world, (to_army_protectee_id, resource_type)
                            );
                            to_army_resource.add(share_amount);
                            to_army_resource.save(world);

                            // update army's added weight
                            added_resources_weight +=
                                WeightConfigCustomImpl::get_weight(world, resource_type, share_amount);
                        }
                    }
                },
                Option::None => { break; }
            }
        };

        // update weight after balance update
        let mut to_army_protectee_weight: Weight = get!(world, to_army_protectee_id, Weight);
        let to_army_protectee_capacity: Capacity = get!(world, to_army_protectee_id, Capacity);
        let to_army_protectee_quantity: Quantity = get!(world, to_army_protectee_id, Quantity);
        // decrease protectee weight if necessary
        if subtracted_resources_weight.is_non_zero() {
            to_army_protectee_weight.deduct(to_army_protectee_capacity, subtracted_resources_weight);
        }
        // increase protectee weight if necessary
        if added_resources_weight.is_non_zero() {
            to_army_protectee_weight
                .add(to_army_protectee_capacity, to_army_protectee_quantity, added_resources_weight);
        }
        set!(world, (to_army_protectee_weight));

        // release lock on resource
        let mut to_army_resource_lock: ResourceTransferLock = get!(world, to_army_protectee_id, ResourceTransferLock);
        to_army_resource_lock.assert_locked();
        to_army_resource_lock.release_at = starknet::get_block_timestamp();
        set!(world, (to_army_resource_lock));
    }
}


#[generate_trait]
impl BattleCustomImpl of BattleCustomTrait {
    /// This function updated the armies health and duration
    /// of battle according to the set delta and battle duration
    ///
    /// Update state should be called before reading
    /// battle model values so that the correct values
    /// are gotten
    fn update_state(ref self: Battle) {
        let battle_duration_passed = self.duration_passed();
        self.attack_army_health.decrease_current_by((self.defence_delta.into() * battle_duration_passed.into()));
        self.defence_army_health.decrease_current_by((self.attack_delta.into() * battle_duration_passed.into()));
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
        self.duration_left = self.duration();
    }


    fn duration(self: Battle) -> u64 {
        let mut attack_num_seconds_to_death = self.attack_army_health.steps_to_die(self.defence_delta.into());

        let mut defence_num_seconds_to_death = self.defence_army_health.steps_to_die(self.attack_delta.into());

        min(defence_num_seconds_to_death, attack_num_seconds_to_death).try_into().unwrap()
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
}


#[cfg(test)]
mod tests {
    use dojo::world::IWorldDispatcherTrait;
    use eternum::constants::ID;
    use eternum::constants::ResourceTypes;
    use eternum::models::combat::BattleCustomTrait;
    use eternum::models::combat::BattleEscrowTrait;
    use eternum::models::combat::BattleHealthCustomTrait;
    use eternum::models::combat::TroopsTrait;
    use eternum::models::resources::ResourceCustomTrait;
    use eternum::models::resources::ResourceTransferLockCustomTrait;
    use eternum::models::resources::{Resource, ResourceCustomImpl, ResourceTransferLock};
    use eternum::utils::testing::world::spawn_eternum;
    use super::{Battle, BattleHealth, BattleArmy, BattleSide, Troops, TroopConfig, Army, ArmyCustomImpl, Protectee};

    fn mock_troop_config() -> TroopConfig {
        TroopConfig {
            config_id: 0,
            health: 7_200,
            knight_strength: 1,
            paladin_strength: 1,
            crossbowman_strength: 1,
            advantage_percent: 1000,
            disadvantage_percent: 1000,
            pillage_health_divisor: 8,
            army_free_per_structure: 100,
            army_extra_per_building: 100,
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
    fn test_battle_reset_delta() {
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
    fn test_battle_update_state_before_battle_end() {
        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        // move time up but before battle ends
        starknet::testing::set_block_timestamp(battle.duration_left - 1);
        battle.update_state();
        assert!(battle.has_ended() == false, "battle should not have ended");
    }


    #[test]
    fn test_battle_update_state_after_battle_end() {
        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        // move time up to battle duration
        starknet::testing::set_block_timestamp(battle.duration_left);
        battle.update_state();
        assert!(battle.has_ended() == true, "battle should have ended");
    }


    #[test]
    fn test_battle_deposit_balance() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let world = spawn_eternum();
        world.uuid(); // use id 0;

        // recreate army for testing
        let attack_army = Army {
            entity_id: world.uuid(),
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
        attack_army_wheat_resource.save(world);
        attack_army_coal_resource.save(world);

        // deposit everything the army owns
        let attack_army_protectee = get!(world, attack_army.entity_id, Protectee);
        battle.deposit_balance(world, attack_army, attack_army_protectee);

        // ensure the deposit was sent to the right escrow
        let escrow_id = battle.attackers_resources_escrow_id;
        let escrow_wheat: Resource = get!(world, (escrow_id, ResourceTypes::WHEAT), Resource);
        let escrow_coal: Resource = get!(world, (escrow_id, ResourceTypes::COAL), Resource);
        assert_eq!(escrow_wheat.balance, attack_army_wheat_resource.balance);
        assert_eq!(escrow_coal.balance, attack_army_coal_resource.balance);

        // ensure transfer lock was enabled
        let army_transfer_lock: ResourceTransferLock = get!(world, attack_army.entity_id, ResourceTransferLock);
        army_transfer_lock.assert_locked();
    }


    #[test]
    fn test_battle_deposit_balance_for_structure_army() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let world = spawn_eternum();
        world.uuid(); // use id 0;

        // recreate army for testing
        let attack_army = Army {
            entity_id: world.uuid(),
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
        attack_army_wheat_resource.save(world);
        attack_army_coal_resource.save(world);

        // deposit everything the army owns
        let attack_army_protectee = Protectee { army_id: attack_army.entity_id, protectee_id: 67890989 // non zero
         };
        battle.deposit_balance(world, attack_army, attack_army_protectee);

        // ensure escrow does not receive the resources because
        // it will cost too much gas
        let escrow_id = battle.attackers_resources_escrow_id;
        let escrow_wheat: Resource = get!(world, (escrow_id, ResourceTypes::WHEAT), Resource);
        let escrow_coal: Resource = get!(world, (escrow_id, ResourceTypes::COAL), Resource);
        assert_eq!(escrow_wheat.balance, 0);
        assert_eq!(escrow_coal.balance, 0);

        // ensure transfer lock was enabled
        let army_transfer_lock: ResourceTransferLock = get!(
            world, attack_army_protectee.protectee_id, ResourceTransferLock
        );
        army_transfer_lock.assert_locked();
    }


    #[test]
    fn test_battle_withdraw_balance_and_reward__when_you_lose() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        // use small army
        let attack_troop_each = 500;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let world = spawn_eternum();
        world.uuid(); // use id 0;

        //////////////////////    Defence Army    /////////////////////////
        ///
        // recreate defense army for testing
        let defence_army = Army {
            entity_id: world.uuid(),
            troops: mock_troops(defence_troop_each, defence_troop_each, defence_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Defence
        };

        // give defence army stone
        let mut defence_army_stone_resource: Resource = Resource {
            entity_id: defence_army.entity_id, resource_type: ResourceTypes::STONE, balance: 344
        };
        defence_army_stone_resource.save(world);

        // deposit everything the defence army owns
        let defence_army_protectee = get!(world, defence_army.entity_id, Protectee);
        battle.deposit_balance(world, defence_army, defence_army_protectee);

        //////////////////////    Attack Army    /////////////////////////
        ///
        // recreate army for testing
        let attack_army = Army {
            entity_id: world.uuid(),
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
        attack_army_wheat_resource.save(world);
        attack_army_coal_resource.save(world);

        // deposit everything the army owns
        let attack_army_protectee = get!(world, attack_army.entity_id, Protectee);
        battle.deposit_balance(world, attack_army, attack_army_protectee);

        // lose battle
        starknet::testing::set_block_timestamp(battle.duration_left + 1); // original ts was 1
        battle.update_state();
        assert!(battle.has_ended(), "Battle should have ended");
        assert!(battle.winner() == BattleSide::Defence, "unexpected side won");

        // withdraw back from escrow
        battle.withdraw_balance_and_reward(world, attack_army, attack_army_protectee);

        // ensure transfer lock was reenabled
        let army_transfer_lock: ResourceTransferLock = get!(world, attack_army.entity_id, ResourceTransferLock);
        army_transfer_lock.assert_not_locked();

        // ensure the army didn't get balance back
        let attack_army_wheat: Resource = get!(world, (attack_army.entity_id, ResourceTypes::WHEAT), Resource);
        let attack_army_coal: Resource = get!(world, (attack_army.entity_id, ResourceTypes::COAL), Resource);
        assert!(attack_army_wheat.balance == 0, "attacking army wheat balance should be 0");
        assert!(attack_army_coal.balance == 0, "attacking army coal balance should be 0");

        // ensure attacker got no reward
        let attack_army_stone: Resource = get!(world, (attack_army.entity_id, ResourceTypes::STONE), Resource);
        assert_eq!(attack_army_stone.balance, 0);
    }


    #[test]
    fn test_battle_withdraw_balance_and_reward__when_you_draw() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        // use small army
        let attack_troop_each = 10_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let world = spawn_eternum();
        world.uuid(); // use id 0;
        //////////////////////    Defence Army    /////////////////////////
        ///
        // recreate defense army for testing
        let defence_army = Army {
            entity_id: world.uuid(),
            troops: mock_troops(defence_troop_each, defence_troop_each, defence_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Defence
        };

        // give defence army stone
        let mut defence_army_stone_resource: Resource = Resource {
            entity_id: defence_army.entity_id, resource_type: ResourceTypes::STONE, balance: 344
        };
        defence_army_stone_resource.save(world);

        // deposit everything the defence army owns
        let defence_army_protectee = get!(world, defence_army.entity_id, Protectee);
        battle.deposit_balance(world, defence_army, defence_army_protectee);

        //////////////////////    Attack Army    /////////////////////////
        ///
        // recreate army for testing
        let attack_army = Army {
            entity_id: world.uuid(),
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
        attack_army_wheat_resource.save(world);
        attack_army_coal_resource.save(world);

        // deposit everything the army owns
        let attack_army_protectee = get!(world, attack_army.entity_id, Protectee);
        battle.deposit_balance(world, attack_army, attack_army_protectee);

        // lose battle
        starknet::testing::set_block_timestamp(battle.duration_left + 1); // original ts was 1
        battle.update_state();
        assert!(battle.has_ended(), "Battle should have ended");
        assert!(battle.winner() == BattleSide::None, "unexpected side won");

        // withdraw back from escrow
        battle.withdraw_balance_and_reward(world, attack_army, attack_army_protectee);

        // ensure transfer lock was reenabled
        let army_transfer_lock: ResourceTransferLock = get!(world, attack_army.entity_id, ResourceTransferLock);
        army_transfer_lock.assert_not_locked();

        // ensure the army gets balance back
        let attack_army_wheat: Resource = get!(world, (attack_army.entity_id, ResourceTypes::WHEAT), Resource);
        let attack_army_coal: Resource = get!(world, (attack_army.entity_id, ResourceTypes::COAL), Resource);

        assert!(
            attack_army_wheat.balance == attack_army_wheat_resource.balance,
            "attacking army wheat balance should be > 0"
        );
        assert!(
            attack_army_coal.balance == attack_army_coal_resource.balance, "attacking army coal balance should be > 0"
        );

        // ensure attacker got no reward
        let attack_army_stone: Resource = get!(world, (attack_army.entity_id, ResourceTypes::STONE), Resource);
        assert_eq!(attack_army_stone.balance, 0);
    }


    #[test]
    fn test_battle_withdraw_balance_and_reward__when_you_win() {
        // set block timestamp to 1
        starknet::testing::set_block_timestamp(1);

        // use small army
        let attack_troop_each = 40_000;
        let defence_troop_each = 10_000;
        let mut battle = mock_battle(attack_troop_each, defence_troop_each);
        assert!(battle.duration_left > 0, "duration should be more than 0 ");

        let world = spawn_eternum();
        world.uuid(); // use id 0;

        //////////////////////    Defence Army    /////////////////////////
        ///
        // recreate defense army for testing
        let defence_army = Army {
            entity_id: world.uuid(),
            troops: mock_troops(defence_troop_each, defence_troop_each, defence_troop_each),
            battle_id: battle.entity_id,
            battle_side: BattleSide::Defence
        };

        // give defence army stone
        let mut defence_army_stone_resource: Resource = Resource {
            entity_id: defence_army.entity_id, resource_type: ResourceTypes::STONE, balance: 344
        };
        defence_army_stone_resource.save(world);

        // deposit everything the defence army owns
        let defence_army_protectee = get!(world, defence_army.entity_id, Protectee);
        battle.deposit_balance(world, defence_army, defence_army_protectee);

        //////////////////////    Attack Army    /////////////////////////
        ///
        // recreate attack army for testing
        let attack_army = Army {
            entity_id: world.uuid(),
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
        attack_army_wheat_resource.save(world);
        attack_army_coal_resource.save(world);

        // deposit everything the army owns
        let attack_army_protectee = get!(world, attack_army.entity_id, Protectee);
        battle.deposit_balance(world, attack_army, attack_army_protectee);

        //////////////////////    Battle    /////////////////////////

        // attacker wins battle
        starknet::testing::set_block_timestamp(battle.duration_left + 1); // original ts was 1
        battle.update_state();
        assert!(battle.has_ended(), "Battle should have ended");
        assert!(battle.winner() == BattleSide::Attack, "unexpected side won");

        // attacker withdraw back from escrow
        battle.withdraw_balance_and_reward(world, attack_army, attack_army_protectee);

        // ensure transfer lock was reenabled
        let army_transfer_lock: ResourceTransferLock = get!(world, attack_army.entity_id, ResourceTransferLock);
        army_transfer_lock.assert_not_locked();

        // ensure the army gets balance back
        let attack_army_wheat: Resource = get!(world, (attack_army.entity_id, ResourceTypes::WHEAT), Resource);
        let attack_army_coal: Resource = get!(world, (attack_army.entity_id, ResourceTypes::COAL), Resource);
        assert!(
            attack_army_wheat.balance == attack_army_wheat_resource.balance,
            "attacking army wheat balance should be > 0"
        );
        assert!(
            attack_army_coal.balance == attack_army_coal_resource.balance, "attacking army coal balance should be > 0"
        );

        // ensure the attack army gets reward
        let attack_army_stone: Resource = get!(world, (attack_army.entity_id, ResourceTypes::STONE), Resource);
        assert_eq!(attack_army_stone.balance, defence_army_stone_resource.balance);
    }
    // #[test]
// fn test_show_battle() {
//     let attack_troop_each = 240_000;
//     let defence_troop_each = 10_000;
//     let mut battle = mock_battle(attack_troop_each, defence_troop_each);
//         // starknet::testing::set_block_timestamp(battle.duration_left + 1); // original ts was 1
//         // battle.update_state();
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

    //     print!("\n\n Pillage Attacker Loss: {}, Ratio is {}% \n\n", attacker_h_left, attacker_ratio);
//     print!("\n\n Pillage Defender Loss: {}, Ratio is {}% \n\n", defence_h_left, defence_ratio);

    // }
}
