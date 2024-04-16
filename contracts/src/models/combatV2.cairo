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


#[derive(Copy, Drop, Serde, Introspect)]
struct TroopDetail {
    knight_count: u32,
    paladin_count: u32,
    crossbowman_count: u32,
}

#[generate_trait]
impl TroopDetailImpl of TroopDetailTrait {
    fn add(ref self: TroopDetail, other: TroopDetail, world: IWorldDispatcher) {
        self.knight_count+= other.knight_count;
        self.paladin_count+= other.paladin_count;
        self.crossbowman_count += other.crossbowman_count;
    }

    fn purchase(ref self: TroopDetail, payer_entity_id: u128, world: IWorldDispatcher) {
                
        // pay for knights using KNIGHT resource

        if self.knight_count > 0 {
            let mut knight_resoure 
                = ResourceImpl::get(world, (payer_entity_id, ResourceTypes::KNIGHT));
            assert!(
                knight_resoure.balance >= self.knight_count.into(), 
                    "insufficient resources to purchase knights"
            );
            knight_resoure.balance -= self.knight_count.into();
            knight_resoure.save(world);
        }
        

        // pay for paladin using PALADIN resource


        if self.paladin_count > 0 {
            let mut paladin_resoure 
                = ResourceImpl::get(world, (payer_entity_id, ResourceTypes::PALADIN));
            assert!(
                paladin_resoure.balance >= self.paladin_count.into(), 
                    "insufficient resources to purchase paladins"
            );
            paladin_resoure.balance -= self.paladin_count.into();
            paladin_resoure.save(world);
        }



        // pay for crossbowman using CROSSBOWMAN resource


        if self.crossbowman_count > 0 {
            let mut crossbowman_resoure 
                = ResourceImpl::get(world, (payer_entity_id, ResourceTypes::CROSSBOWMAN));
            assert!(
                crossbowman_resoure.balance >= self.crossbowman_count.into(), 
                    "insufficient resources to purchase crossbowmen"
            );
            crossbowman_resoure.balance -= self.crossbowman_count.into();
            crossbowman_resoure.save(world);
        }

    }


    fn health(self: @TroopDetail, world: IWorldDispatcher) -> u128 {
        let self = *self;

        let troop_config = TroopConfigImpl::get(world);
        let total_knight_health = troop_config.knight_health * self.knight_count;
        let total_paladin_health = troop_config.paladin_health * self.paladin_count;
        let total_crossbowman_health = troop_config.crossbowman_health * self.crossbowman_count;

        return total_knight_health.into() 
                + total_paladin_health.into() 
                    + total_crossbowman_health.into();
    }

    fn delta(self: @TroopDetail, enemy_troop_detail: @TroopDetail, world: IWorldDispatcher) -> (u32, u32) {

        let self_strength = self.strength_against(enemy_troop_detail, world);
        let enemy_strength = enemy_troop_detail.strength_against(self, world);
        let strength_difference = self_strength - enemy_strength;

        return (0, 0);
    }

    fn strength_against(self: @TroopDetail, enemy_troop_detail: @TroopDetail, world: IWorldDispatcher) -> i64 {
        let self = *self;
        let enemy_troop_detail = *enemy_troop_detail;
        let troop_config = TroopConfigImpl::get(world);

        //////////////////////////////////////////////////////////////////////////////////////////
        
        let mut self_knight_strength: u32 =
             troop_config.knight_strength * self.knight_count;
        self_knight_strength
            = PercentageImpl::get(self_knight_strength.into(), troop_config.advantage_percent.into());
        
        let mut self_paladin_strength: u32 =
             troop_config.paladin_strength * self.paladin_count;
        self_paladin_strength
            = PercentageImpl::get(self_paladin_strength.into(), troop_config.advantage_percent.into());
        
                
        let mut self_crossbowman_strength: u32 =
             troop_config.crossbowman_strength * self.crossbowman_count;
        self_crossbowman_strength
            = PercentageImpl::get(self_crossbowman_strength.into(), troop_config.advantage_percent.into());
        
        //////////////////////////////////////////////////////////////////////////////////////////

        let mut enemy_knight_strength: u32 =
             troop_config.knight_strength * enemy_troop_detail.knight_count;
        enemy_knight_strength
            = PercentageImpl::get(enemy_knight_strength, troop_config.disadvantage_percent.into());


        let mut enemy_paladin_strength: u32 =
             troop_config.paladin_strength * enemy_troop_detail.paladin_count;
        enemy_paladin_strength
            = PercentageImpl::get(enemy_paladin_strength, troop_config.disadvantage_percent.into());

        let mut enemy_crossbowman_strength: u32 =
             troop_config.crossbowman_strength * enemy_troop_detail.crossbowman_count;
        enemy_crossbowman_strength
            = PercentageImpl::get(enemy_crossbowman_strength, troop_config.disadvantage_percent.into());

        //////////////////////////////////////////////////////////////////////////////////////////


        let self_knight_strength: i64 
            = self_knight_strength.into() - enemy_paladin_strength.into();
        let self_paladin_strength: i64 
            = self_paladin_strength.into() - enemy_crossbowman_strength.into();
        let self_crossbowman_strength: i64 
            = self_crossbowman_strength.into() - enemy_knight_strength.into();

        return self_knight_strength + self_paladin_strength + self_crossbowman_strength;
    }
}


#[derive(Copy, Drop, Serde, Model)]
struct Troop {
    #[key]
    entity_id: u128,
    knight_count: u32,
    paladin_count: u32,
    crossbowman_count: u32,
    health: u128,
    battle_id: u128,
    battle_side: BattleSide
}

impl TroopIntoTroopDetail of Into<Troop, TroopDetail> {
    fn into(self: Troop) -> TroopDetail {
        return TroopDetail {
            knight_count: self.knight_count,
            paladin_count: self.paladin_count,
            crossbowman_count: self.crossbowman_count,
        };
    }
}




#[generate_trait]
impl TroopImpl of TroopTrait {

    fn add(ref self: Troop, troop_detail: TroopDetail, world: IWorldDispatcher) {
        self.knight_count+= troop_detail.knight_count;
        self.paladin_count+= troop_detail.paladin_count;
        self.crossbowman_count +=troop_detail.crossbowman_count;
        self.health += troop_detail.health(world);
    }

    fn create(owner_entity_id: u128, mut troop_detail: TroopDetail, world: IWorldDispatcher) -> Troop {
        
        // ensure caller is entity owner 

        let owner_entity_address = get!(world, owner_entity_id, Owner).address;
        let caller = starknet::get_caller_address();
        assert!(caller == owner_entity_address, "caller not entity owner");

        // purchase troops 
        troop_detail.purchase(owner_entity_id, world);
    
        // set troop and troop entity owner
        let troop_entity_id: u128 = world.uuid().into();
        let mut troop: Troop = get!(world, troop_entity_id, Troop);
        troop.add(troop_detail, world);
        set!(world, (troop));

        let troop_entity_owner 
            = EntityOwner{entity_id: troop.entity_id, entity_owner_id: owner_entity_id};
        set!(world, (troop_entity_owner));

        return troop;
    }

}


#[derive(Copy, Drop, Serde, Introspect)]
struct Army {
    troop_detail: TroopDetail,
    health_sum: u128,
    health_deduct: u128
}

#[generate_trait]
impl ArmyImpl of ArmyTrait {
    fn is_alive(self :@Army) -> bool {
        *self.health_sum > *self.health_deduct
    }
    fn add(ref self: Army, troop_detail: TroopDetail, world: IWorldDispatcher) {
        self.troop_detail.knight_count+= troop_detail.knight_count;
        self.troop_detail.paladin_count+= troop_detail.paladin_count;
        self.troop_detail.crossbowman_count += troop_detail.crossbowman_count;
        self.health_sum += troop_detail.health(world);
    }
}


#[derive(Model, Copy, Drop, Serde)]
struct Battle {
    #[key]
    entity_id: u128,
    last_updated_tick: u64,
    attacking_army: Army,
    defending_army: Army,
    attacking_army_delta: u32,
    defending_army_delta: u32,
    duration_left: u64
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

    fn winner(ref self: Battle, world: IWorldDispatcher) -> BattleSide {
        self.update_state(world);
        if self.duration_left > 0 {
            return BattleSide::None;
        }

        if self.attacking_army.is_alive() {
            return BattleSide::Attack;
        }
         
        if self.defending_army.is_alive() {
            return BattleSide::Defence;
        }
        
        return BattleSide::None;
    }


    fn leave(troop_id: u128, world: IWorldDispatcher) {

        let mut troop_owned_by: EntityOwner = get!(world, troop_id, EntityOwner);
        assert!(troop_owned_by.owner_address(world) == starknet::get_caller_address(), 
            "caller is not troop owner"
        );

        let mut troop: Troop = get!(world, troop_id, Troop);
        assert!(troop.battle_id != 0, "troop is not a battle");

        let battle_id = troop.battle_id;

        let mut battle: Battle = get!(world, battle_id, Battle);
        battle.update_state(world);

        if (battle.duration_left == 0) {
            // battle has ended 
            assert!(
                troop.battle_side == battle.winner(world), 
                    "your side lost and health is drained"
            );
        }; 


        let battle_army: Army = match troop.battle_side {
            BattleSide::None => {
                panic!("unexpected battle side");
                battle.attacking_army
            },
            BattleSide::Attack => {
                battle.attacking_army
            },
            BattleSide::Defence => {
                battle.defending_army
            }
        };

        let mut battle_army_health_remain = 0;
        if battle_army.health_deduct < battle_army.health_sum {
            battle_army_health_remain 
                = battle_army.health_sum - battle_army.health_deduct;
        }
        let new_troop_health 
            = ( troop.health * battle_army_health_remain) / battle_army.health_sum;

        troop.battle_id = 0;
        troop.battle_side = BattleSide::None;
        troop.health = new_troop_health;
        set!(world, (troop));

        //todo: do stuff


        let mut troop_movable: Movable = get!(world, troop_id, Movable);
        troop_movable.blocked = false;
        set!(world, (troop_movable));

    }
     
    fn join(battle_id: u128, troop_id: u128, battle_side: BattleSide, world: IWorldDispatcher) {
        assert!(battle_side != BattleSide::None, "choose correct battle side");

        let mut battle: Battle = get!(world, battle_id, Battle);
        battle.update_state(world);

        assert!(battle.duration_left > 0,"Battle has ended");

        let battle_position = get!(world, battle_id, Position);
        let troop_position = get!(world, troop_id, Position);
        assert!(
            Into::<Position, Coord>::into(battle_position) == Into::<Position, Coord>::into(troop_position),
            "troop not in battle position"
        );

        let mut troop: Troop = get!(world, troop_id, Troop);
        assert!(troop.battle_id == 0, "troop is in a battle");
        
        let mut troop_owned_by: EntityOwner = get!(world, troop_id, EntityOwner);
        assert!(troop_owned_by.owner_address(world) == starknet::get_caller_address(), 
            "caller is not troop owner"
        );


        match battle_side {
            BattleSide::None => {panic!("no battle side")},
            BattleSide::Attack => {
                let mut army = battle.attacking_army;
                army.add(troop.into(), world);

                battle.attacking_army = army;

                let tick= TickImpl::get(world);
                battle.update_duration(world, tick);

            },
            BattleSide::Defence => {
                let mut army = battle.defending_army;
                army.add(troop.into(), world);

                battle.defending_army = army;

                let tick= TickImpl::get(world);
                battle.update_duration(world, tick);
            }
        };
        set!(world, (battle));

        troop.battle_id = battle_id;
        troop.battle_side = battle_side;
        set!(world, (troop));


        let mut troop_movable: Movable = get!(world, troop_id, Movable);
        troop_movable.blocked = true;
        set!(world, (troop_movable));

    }
     

    fn start(attacking_troop_id: u128, defending_troop_id: u128, world: IWorldDispatcher) -> Battle {
        let tick= TickImpl::get(world);

        let mut attacking_troop: Troop = get!(world, attacking_troop_id, Troop);
        assert!(attacking_troop.battle_id == 0, "attacking troop is in a battle");
        
        let mut attacking_troop_owned_by: EntityOwner = get!(world, attacking_troop_id, EntityOwner);
        assert!(attacking_troop_owned_by.owner_address(world) == starknet::get_caller_address(), 
                "attacker is not the caller"
        );

        let mut defending_troop: Troop = get!(world, defending_troop_id, Troop);
        assert!(defending_troop.battle_id == 0, "defending troop is in a battle");

        let attacking_troop_position = get!(world, attacking_troop_id, Position);
        let defending_troop_position = get!(world, defending_troop_id, Position);
        assert!(
            Into::<Position, Coord>::into(attacking_troop_position) 
                == Into::<Position, Coord>::into(defending_troop_position),
            "both troops not on same position"
        );

        let attacking_army
            = Army{
                troop_detail: Into::<Troop, TroopDetail>::into(attacking_troop),
                health_sum: attacking_troop.health,
                health_deduct: 0 
            }; 
    
        let defending_army
            = Army{
                troop_detail: Into::<Troop, TroopDetail>::into(defending_troop),
                health_sum: defending_troop.health,
                health_deduct: 0 
            }; 


        let (attacking_army_delta, defending_army_delta) 
            = attacking_army.troop_detail
                .delta(@defending_army.troop_detail, world);
        let battle_total_duration_left 
            = BattleImpl::duration_left(
                attacking_army, defending_army, 
                attacking_army_delta, defending_army_delta, world
            );

        assert!(battle_total_duration_left > 0, "battle ends immediately");

        // store battle 
        let mut battle = Battle {
            entity_id: world.uuid().into(),
            last_updated_tick : tick.current(),
            attacking_army: attacking_army,
            defending_army: defending_army,
            attacking_army_delta: attacking_army_delta,
            defending_army_delta: defending_army_delta,
            duration_left: battle_total_duration_left
        };

        set!(world, (battle));

        let battle_position = Position {
            entity_id: battle.entity_id, 
            x: attacking_troop_position.x,
            y: attacking_troop_position.y,
        };
        set!(world, (battle_position));
   

        // update troops
        attacking_troop.battle_id = battle.entity_id;
        attacking_troop.battle_side = BattleSide::Attack;

        defending_troop.battle_id = battle.entity_id;
        defending_troop.battle_side = BattleSide::Defence;

        set!(world, (attacking_troop, defending_troop));

        let mut attacking_troop_movable: Movable 
            = get!(world, attacking_troop_id, Movable);
        attacking_troop_movable.blocked = true;
        set!(world, (attacking_troop_movable));

        let mut defending_troop_movable: Movable 
            = get!(world, defending_troop_id, Movable);
        defending_troop_movable.blocked = true;
        set!(world, (defending_troop_movable));
        return battle;
    }


    fn update_state(ref self: Battle, world: IWorldDispatcher) {

        let battle_duration_passed = self.duration_passed(world);
        let attacking_troop_health_loss 
            = (self.attacking_army_delta.into() * battle_duration_passed.into());
        self.attacking_army.health_deduct += attacking_troop_health_loss;
        
        let defending_troop_health_loss 
            = (self.defending_army_delta.into() * battle_duration_passed.into());
        self.defending_army.health_deduct += defending_troop_health_loss;

        set!(world, (self));
    }


    fn update_duration(ref self: Battle, world: IWorldDispatcher, tick: TickConfig) {
        // ensure state has been updated 
        assert!(self.last_updated_tick == tick.current(), "state not updated");


        let (attacking_army_delta, defending_army_delta) 
            = self.attacking_army.troop_detail
                .delta(@self.defending_army.troop_detail, world);
        let total_duration_left 
            = BattleImpl::duration_left(
                self.attacking_army, self.defending_army, 
                attacking_army_delta, defending_army_delta, world
            );

        self.duration_left = total_duration_left;
    }
    

    fn duration_left(
        attacking_army: Army, 
        defending_army: Army, 
        attacking_army_delta: u32, 
        defending_army_delta: u32, 
        world: IWorldDispatcher
        ) -> u64 {
        if attacking_army.health_deduct >= attacking_army.health_sum {
            return 0;
        }

        if defending_army.health_deduct >= defending_army.health_sum {
            return 0;
        }

        let attacking_army_health = (attacking_army.health_sum - attacking_army.health_deduct);
        let mut attacking_ticks_to_zero 
            = attacking_army_health / defending_army_delta.into();
        if (attacking_army_health % defending_army_delta.into()) > 0 {
            attacking_ticks_to_zero += 1;
        }

        let defending_army_health = (defending_army.health_sum - defending_army.health_deduct);
        let mut defending_ticks_to_zero 
            = defending_army_health / attacking_army_delta.into();
        if (defending_army_health % attacking_army_delta.into()) > 0 {
            defending_ticks_to_zero += 1;
        }

        let mut first_to_zero: u64 = attacking_ticks_to_zero.try_into().unwrap();
        if defending_ticks_to_zero < attacking_ticks_to_zero {
            first_to_zero = defending_ticks_to_zero.try_into().unwrap();
        }

        return first_to_zero;
    }
    

    fn duration_passed(ref self: Battle, world: IWorldDispatcher) -> u64 {
        let tick = TickImpl::get(world);
        let current_tick = tick.current();
        let duration_since_last_update = current_tick - self.last_updated_tick;
        if self.duration_left >= duration_since_last_update {
            self.duration_left -= duration_since_last_update;
            self.last_updated_tick = current_tick;

            return duration_since_last_update;
        } else {
            let duration = self.duration_left;
            self.duration_left = 0;
            self.last_updated_tick = current_tick;
            return duration;
        }
    }


}
