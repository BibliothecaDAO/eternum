use core::option::OptionTrait;
use core::traits::TryInto;
use core::traits::Into;
use starknet::get_block_timestamp;
use eternum::constants::ResourceTypes;
use eternum::constants::WORLD_CONFIG_ID;
use eternum::models::position::{Position, Coord};
use eternum::models::movable::Movable;
use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
use eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner};
use eternum::models::config::{TickConfig, TickImpl, TickTrait};
use eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};
use eternum::models::config::{BattleConfig, BattleConfigImpl, BattleConfigTrait};
use eternum::utils::math::PercentageImpl;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

// Gameplay

// Generate Troop like Resources (see resource)
// fn create_army() this will convert Troop into an Army and burn the resources.
// Now an Army exists at a location and it can travel
// Army can initiate a combat with another Army or a Entity that has a combat trait

// initiating combat
// players select another Army, which must be at the same location, then start a Battle.
// The Battle calculates the strength of each side and deducts health from each side per tick
// If reinforcements arrive the Battle updates to the new strength and outcome is updated.

#[derive(Model, Copy, Drop, Serde)]
struct Healthv2 {
    #[key]
    entity_id: u128,
    current: u128,
    lifetime: u128
}

#[generate_trait]
impl Healthv2Impl of Healthv2Trait {
    fn is_alive(ref self: Healthv2) -> bool {
        return self.current > 0;
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
        return num_steps;
    }
}


#[derive(Copy, Drop, Serde)]
struct Fighters {
    knight_count: u32,
    paladin_count: u32,
    crossbowman_count: u32,
}


#[generate_trait]
impl FightersImpl of FightersTrait {
    fn health(self: @Fighters, world: IWorldDispatcher) -> u128 {
        let self = *self;

        let troop_config = TroopConfigImpl::get(world);
        let total_knight_health = troop_config.knight_health * self.knight_count;
        let total_paladin_health = troop_config.paladin_health * self.paladin_count;
        let total_crossbowman_health = troop_config.crossbowman_health * self.crossbowman_count;

        return total_knight_health.into()
            + total_paladin_health.into()
            + total_crossbowman_health.into();
    }

    fn purchase(ref self: Fighters, purchaser_id: u128, world: IWorldDispatcher) {
        // pay for knights using KNIGHT resource

        if self.knight_count > 0 {
            let mut knight_resoure = ResourceImpl::get(
                world, (purchaser_id, ResourceTypes::KNIGHT)
            );
            assert!(
                knight_resoure.balance >= self.knight_count.into(),
                "insufficient resources to purchase knights"
            );
            knight_resoure.balance -= self.knight_count.into();
            knight_resoure.save(world);
        }

        // pay for paladin using PALADIN resource

        if self.paladin_count > 0 {
            let mut paladin_resoure = ResourceImpl::get(
                world, (purchaser_id, ResourceTypes::PALADIN)
            );
            assert!(
                paladin_resoure.balance >= self.paladin_count.into(),
                "insufficient resources to purchase paladins"
            );
            paladin_resoure.balance -= self.paladin_count.into();
            paladin_resoure.save(world);
        }

        // pay for crossbowman using CROSSBOWMAN resource

        if self.crossbowman_count > 0 {
            let mut crossbowman_resoure = ResourceImpl::get(
                world, (purchaser_id, ResourceTypes::CROSSBOWMAN)
            );
            assert!(
                crossbowman_resoure.balance >= self.crossbowman_count.into(),
                "insufficient resources to purchase crossbowmen"
            );
            crossbowman_resoure.balance -= self.crossbowman_count.into();
            crossbowman_resoure.save(world);
        }
    }
}


#[derive(Copy, Drop, Serde, Model)]
struct Troop {
    #[key]
    entity_id: u128,
    knight_count: u32,
    paladin_count: u32,
    crossbowman_count: u32,
    battle_id: u128,
    battle_side: BattleSide
}

impl TroopIntoFightersImpl of Into<Troop, Fighters> {
    fn into(self: Troop) -> Fighters {
        return Fighters {
            knight_count: self.knight_count,
            paladin_count: self.paladin_count,
            crossbowman_count: self.crossbowman_count,
        };
    }
}

#[generate_trait]
impl TroopImpl of TroopTrait {
    fn create(owner_id: u128, mut fighters: Fighters, world: IWorldDispatcher) -> Troop {
        // make payment for troops 
        fighters.purchase(owner_id, world);

        // set troop 

        let troop_id: u128 = world.uuid().into();
        let mut troop: Troop = get!(world, troop_id, Troop);

        troop.add_fighters(fighters, world);
        set!(world, (troop));

        // set troop owner entity

        let troop_owned_by = EntityOwner { entity_id: troop.entity_id, entity_owner_id: owner_id };
        set!(world, (troop_owned_by));

        // set troop position

        let owner_position = get!(world, owner_id, Position);
        let mut troop_position: Position = get!(world, troop_id, Position);
        troop_position.x = owner_position.x;
        troop_position.y = owner_position.y;
        set!(world, (troop_position));

        return troop;
    }


    fn add_fighters(ref self: Troop, fighters: Fighters, world: IWorldDispatcher) {
        self.knight_count += fighters.knight_count;
        self.paladin_count += fighters.paladin_count;
        self.crossbowman_count += fighters.crossbowman_count;

        let mut troop_health: Healthv2 = get!(world, self.entity_id, Healthv2);
        // todo check
        troop_health.increase_by(fighters.health(world));

        set!(world, (troop_health));
    }

    fn remove_fighters(ref self: Troop, fighters: Fighters, world: IWorldDispatcher) {
        self.knight_count -= fighters.knight_count;
        self.paladin_count -= fighters.paladin_count;
        self.crossbowman_count -= fighters.crossbowman_count;

        let mut troop_health: Healthv2 = get!(world, self.entity_id, Healthv2);
        // todo check
        troop_health.decrease_by(fighters.health(world));

        set!(world, (troop_health));
    }


    fn delta(self: @Troop, enemy_troop: @Troop, world: IWorldDispatcher) -> (u32, u32) {
        let self_strength = self.strength_against(enemy_troop, world);
        let enemy_strength = enemy_troop.strength_against(self, world);
        let strength_difference = self_strength - enemy_strength;

        // should be at least one to prevent division errrors
        return (1, 1);
    }

    fn strength_against(self: @Troop, enemy_troop: @Troop, world: IWorldDispatcher) -> i64 {
        let self = *self;
        let enemy_troop = *enemy_troop;
        let troop_config = TroopConfigImpl::get(world);

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
            * enemy_troop.knight_count;
        enemy_knight_strength =
            PercentageImpl::get(enemy_knight_strength, troop_config.disadvantage_percent.into());

        let mut enemy_paladin_strength: u32 = troop_config.paladin_strength
            * enemy_troop.paladin_count;
        enemy_paladin_strength =
            PercentageImpl::get(enemy_paladin_strength, troop_config.disadvantage_percent.into());

        let mut enemy_crossbowman_strength: u32 = troop_config.crossbowman_strength
            * enemy_troop.crossbowman_count;
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

        return self_knight_strength + self_paladin_strength + self_crossbowman_strength;
    }
}


#[derive(Copy, Drop, Serde, Model)]
struct Army {
    #[key]
    battle_id: u128,
    #[key]
    battle_side: BattleSide,
    troop_id: u128
}

#[generate_trait]
impl ArmyImpl of ArmyTrait {
    fn join(ref self: Army, ref joiner_troop: Troop, world: IWorldDispatcher) {
        assert!(joiner_troop.battle_id == 0, "joiner troop is in a battle");

        let joiner_troop_position = get!(world, joiner_troop.entity_id, Position);
        let army_troop_position = get!(world, self.troop_id, Position);
        assert!(
            Into::<
                Position, Coord
                >::into(joiner_troop_position) == Into::<
                Position, Coord
            >::into(army_troop_position),
            "joiner troop not in same position as army"
        );

        joiner_troop.battle_id = self.battle_id;
        joiner_troop.battle_side = self.battle_side;

        let mut joiner_troop_movable: Movable = get!(world, joiner_troop.entity_id, Movable);
        assert!(!joiner_troop_movable.blocked, "joiner troop already blocked by another system");

        joiner_troop_movable.blocked = true;
        set!(world, (joiner_troop_movable));

        // merge joiner troop with army troop 

        let mut army_troop: Troop = get!(world, self.troop_id, Troop);
        army_troop.add_fighters(joiner_troop.into(), world);
    }


    fn leave(ref self: Army, ref joiner_troop: Troop, world: IWorldDispatcher) {
        assert!(joiner_troop.battle_id == self.battle_id, "troop not in this battle");

        // remove troop from army troop 

        let mut army_troop: Troop = get!(world, self.troop_id, Troop);
        army_troop.remove_fighters(joiner_troop.into(), world);

        joiner_troop.battle_id = 0;
        joiner_troop.battle_side = BattleSide::None;

        let mut joiner_troop_movable: Movable = get!(world, joiner_troop.entity_id, Movable);
        joiner_troop_movable.blocked = false;
        set!(world, (joiner_troop_movable));
    }
}


#[derive(Model, Copy, Drop, Serde)]
struct Battle {
    #[key]
    entity_id: u128,
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
    fn create_army(self: Battle, battle_side: BattleSide, world: IWorldDispatcher) {
        let mut army: Army = get!(world, (self.entity_id, battle_side), Army);
        assert!(army.troop_id == 0, "army already exists");

        army.troop_id = world.uuid().into();
        set!(world, (army));
    }

    fn join(ref self: Battle, battle_side: BattleSide, ref troop: Troop, world: IWorldDispatcher) {
        assert!(battle_side != BattleSide::None, "choose correct battle side");

        // update battle state before any other actions
        self.update_state(world);

        assert!(self.tick_duration_left > 0, "Battle has ended");

        let battle_position = get!(world, self.entity_id, Position);
        let troop_position = get!(world, troop.entity_id, Position);
        assert!(
            Into::<
                Position, Coord
                >::into(battle_position) == Into::<
                Position, Coord
            >::into(troop_position),
            "troop not in battle position"
        );

        // let mut troop_owned_by: EntityOwner = get!(world, troop_id, EntityOwner);
        // assert!(troop_owned_by.owner_address(world) == starknet::get_caller_address(), 
        //     "caller is not troop owner"
        // );

        let mut army = self.army(battle_side, world);
        army.join(ref troop, world);
        set!(world, (army));

        self.restart(world);
    }

    fn army(self: Battle, battle_side: BattleSide, world: IWorldDispatcher) -> Army {
        let army: Army = get!(world, (self.entity_id, battle_side), Army);
        return army;
    }

    fn troop(self: Battle, battle_side: BattleSide, world: IWorldDispatcher) -> Troop {
        let army = self.army(battle_side, world);
        return get!(world, army.troop_id, Troop);
    }

    fn start(attack_troop_id: u128, defence_troop_id: u128, world: IWorldDispatcher) -> Battle {
        let mut attack_troop: Troop = get!(world, attack_troop_id, Troop);
        assert!(attack_troop.battle_id == 0, "attack troop is in a battle");

        let mut attack_troop_owned_by: EntityOwner = get!(world, attack_troop_id, EntityOwner);
        assert!(
            attack_troop_owned_by.owner_address(world) == starknet::get_caller_address(),
            "attacker is not the caller"
        );

        let mut defence_troop: Troop = get!(world, defence_troop_id, Troop);
        assert!(defence_troop.battle_id == 0, "defence troop is in a battle");

        let attack_troop_position = get!(world, attack_troop_id, Position);
        let defence_troop_position = get!(world, defence_troop_id, Position);
        assert!(
            Into::<
                Position, Coord
                >::into(attack_troop_position) == Into::<
                Position, Coord
            >::into(defence_troop_position),
            "both troops not on same position"
        );

        let (attack_delta, defence_delta) = attack_troop.delta(@defence_troop, world);

        // store battle 
        let tick = TickImpl::get(world);
        let mut battle = Battle {
            entity_id: world.uuid().into(),
            attack_delta: attack_delta,
            defence_delta: defence_delta,
            tick_last_updated: tick.current(),
            tick_duration_left: 0
        };
        battle.restart(world);

        // set battle position 
        let battle_position = Position {
            entity_id: battle.entity_id, x: attack_troop_position.x, y: attack_troop_position.y,
        };
        set!(world, (battle_position));

        // create attack army and let attack troop join army

        battle.create_army(BattleSide::Attack, world);
        battle.join(BattleSide::Attack, ref attack_troop, world);

        // create defence army and let defence troop join army

        battle.create_army(BattleSide::Defence, world);
        battle.join(BattleSide::Defence, ref defence_troop, world);

        set!(world, (battle));
        set!(world, (attack_troop));
        set!(world, (defence_troop));

        return battle;
    }


    fn update_state(ref self: Battle, world: IWorldDispatcher) {
        let battle_duration_passed = self.duration_passed(world);
        let attack_troop: Troop = self.troop(BattleSide::Attack, world);
        let defence_troop: Troop = self.troop(BattleSide::Defence, world);
        let mut attack_troop_health: Healthv2 = get!(world, attack_troop.entity_id, Healthv2);
        attack_troop_health.decrease_by((self.attack_delta.into() * battle_duration_passed.into()));

        let mut defence_troop_health: Healthv2 = get!(world, attack_troop.entity_id, Healthv2);
        defence_troop_health
            .decrease_by((self.attack_delta.into() * battle_duration_passed.into()));

        set!(world, (self));
        set!(world, (attack_troop_health));
        set!(world, (defence_troop_health));
    }


    fn restart(ref self: Battle, world: IWorldDispatcher) {
        // ensure state has been updated 
        let tick = TickImpl::get(world);
        assert!(self.tick_last_updated == tick.current(), "state not updated");
        self.tick_duration_left = self.duration(world);
    }


    fn duration(self: Battle, world: IWorldDispatcher) -> u64 {
        let attack_troop: Troop = self.troop(BattleSide::Attack, world);
        let defence_troop: Troop = self.troop(BattleSide::Defence, world);
        let (attack_delta, defence_delta) = attack_troop.delta(@defence_troop, world);

        let attack_troop_health: Healthv2 = get!(world, attack_troop.entity_id, Healthv2);
        let defence_troop_health: Healthv2 = get!(world, attack_troop.entity_id, Healthv2);

        let mut attack_num_ticks_to_death = attack_troop_health
            .steps_to_finish(defence_delta.into());

        let mut defence_num_ticks_to_death = defence_troop_health
            .steps_to_finish(attack_delta.into());

        if defence_num_ticks_to_death < attack_num_ticks_to_death {
            return defence_num_ticks_to_death.try_into().unwrap();
        } else {
            return attack_num_ticks_to_death.try_into().unwrap();
        }
    }


    fn duration_passed(ref self: Battle, world: IWorldDispatcher) -> u64 {
        let tick = TickImpl::get(world);
        let current_tick = tick.current();
        let duration_since_last_update = current_tick - self.tick_last_updated;
        if self.tick_duration_left >= duration_since_last_update {
            self.tick_duration_left -= duration_since_last_update;
            self.tick_last_updated = current_tick;

            return duration_since_last_update;
        } else {
            let duration = self.tick_duration_left;
            self.tick_duration_left = 0;
            self.tick_last_updated = current_tick;
            return duration;
        }
    }
}
