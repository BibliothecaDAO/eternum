use core::traits::Into;
use starknet::get_block_timestamp;
use eternum::constants::ResourceTypes;
use eternum::constants::WORLD_CONFIG_ID;
use eternum::models::position::Position;
use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
use eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner};
use eternum::models::config::{TickConfig, TickImpl, TickTrait};
use eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};
use eternum::models::config::{BattleConfig, BattleConfigImpl, BattleConfigTrait};
use eternum::utils::math::PercentageImpl;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};

// Gameplay

// Generate Troops like Resources (see resource)
// fn create_army() this will convert Troops into an Army and burn the resources.
// Now an Army exists at a location and it can travel
// Army can initiate a combat with another Army or a Entity that has a combat trait

// initiating combat
// players select another Army, which must be at the same location, then start a Battle.
// The Battle calculates the strength of each side and deducts health from each side per tick
// If reinforcements arrive the Battle updates to the new strength and outcome is updated.


#[derive(Copy, Drop, Serde, Introspect)]
struct Troops {
    knight_count: u32,
    paladin_count: u32,
    crossbowman_count: u32,
    health: u128
}



#[generate_trait]
impl TroopsImpl of TroopsTrait {
    fn add(ref self: Troops, other: @Troops) {
        self.knight_count += *other.knight_count;
        self.paladin_count += *other.paladin_count;
        self.crossbowman_count += *other.crossbowman_count;
        self.health += *other.health;
    }

    fn delta(self: @Troops, enemy_troops: @Troops, world: IWorldDispatcher) -> (u32, u32) {

        let self_strength = self.strength_against(enemy_troops, world);
        let enemy_strength = enemy_troops.strength_against(self, world);
        let strength_difference = self_strength - enemy_strength;

        return (0, 0);
    }

    fn strength_against(self: @Troops, enemy_troops: @Troops, world: IWorldDispatcher) -> i64 {
        let self = *self;
        let enemy_troops = *enemy_troops;
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
             troop_config.knight_strength * enemy_troops.knight_count;
        enemy_knight_strength
            = PercentageImpl::get(enemy_knight_strength, troop_config.disadvantage_percent.into());


        let mut enemy_paladin_strength: u32 =
             troop_config.paladin_strength * enemy_troops.paladin_count;
        enemy_paladin_strength
            = PercentageImpl::get(enemy_paladin_strength, troop_config.disadvantage_percent.into());

        let mut enemy_crossbowman_strength: u32 =
             troop_config.crossbowman_strength * enemy_troops.crossbowman_count;
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


    fn default_health(self: @Troops, world: IWorldDispatcher) -> u128 {
        let self = *self;

        let troop_config = TroopConfigImpl::get(world);
        let total_knight_health = troop_config.knight_health * self.knight_count;
        let total_paladin_health = troop_config.paladin_health * self.paladin_count;
        let total_crossbowman_health = troop_config.crossbowman_health * self.crossbowman_count;

        return total_knight_health.into() 
                + total_paladin_health.into() 
                    + total_crossbowman_health.into();
    }


    fn purchase(ref self: Troops, payer_entity_id: u128, world: IWorldDispatcher) {
                
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

        // set troop health

        self.health = self.default_health(world);

    }

}


#[derive(Model, Copy, Drop, Serde)]
struct Army {
    #[key]
    entity_id: u128,
    troops: Troops,
}


#[generate_trait]
impl ArmyImpl of ArmyTrait {
    fn create(owner_entity_id: u128, mut troops: Troops, world: IWorldDispatcher) -> Army {
        
        // ensure caller is entity owner 

        let owner_entity_address = get!(world, owner_entity_id, Owner).address;
        let caller = starknet::get_caller_address();
        assert!(caller == owner_entity_address, "caller not entity owner");

        // purchase troops 

        troops.purchase(owner_entity_id, world);
    
        // set army and army entity owner
        let army 
            = Army {entity_id: world.uuid().into(),troops: troops};
        let army_entity_owner 
            = EntityOwner{entity_id: army.entity_id,entity_owner_id: owner_entity_id};
        set!(world, (army));
        set!(world, (army_entity_owner));

        return army;
    }


    // add troops at home
    fn add_troops(army_entity_id: u128, mut troops: Troops, world: IWorldDispatcher) -> Army {
        // todo update all existing battles that army is involved in

        // ensure caller owns army
        let army_owned_by: EntityOwner = get!(world, army_entity_id, EntityOwner);
        assert!(
            army_owned_by.owner_address(world) == starknet::get_caller_address(), 
                "caller is not army owner"
        );

        // ensure army is at home
        let army_position: Position = get!(world, army_entity_id, Position); 
        let army_owner_position: Position 
            = get!(world, army_owned_by.entity_owner_id, Position); 
        assert!(
            army_owner_position.x == army_position.x 
                && army_owner_position.y == army_position.y, 
                "army is not at home"
        );

        // purchase troops
        let army_owned_by_id = army_owned_by.entity_owner_id;
        troops.purchase(army_owned_by_id, world);


        // add troops to army
        let mut army: Army = get!(world, army_entity_id, Army);
        army.troops.add(@troops);

        set!(world, (army));

        return army;
    }

    // merge battle troops
    // fn merge_troops() -> Army ;
}

#[derive(Model, Copy, Drop, Serde)]
struct Battle {
    #[key]
    entity_id: u128,
    attacking_entity_id: u128,
    defending_entity_id: u128,
    last_updated_tick: u64,
    end_tick: u64
}

#[generate_trait]
impl BattleImpl of BattleTrait {
    // starts a battle
    fn start(attacking_army_id: u128, defending_army_id: u128, world: IWorldDispatcher) -> Battle {
        let tick_config = TickImpl::get(world);
        let now = starknet::get_block_timestamp();
        let mut battle = Battle {
                entity_id: world.uuid().into(),
                attacking_entity_id: attacking_army_id,
                defending_entity_id: defending_army_id,
                last_updated_tick : tick_config.at(now),
                end_tick: 0
            };
        battle.end_tick = battle.end_tick(world);
        set!(world, (battle));

        return battle;
    }

    fn end_tick(self: Battle, world: IWorldDispatcher) -> u64 {

        let attacking_army: Army = get!(world, self.attacking_entity_id, Army);
        let defending_army: Army = get!(world, self.defending_entity_id, Army);
        
        let (delta_attacking, delta_defending) 
            = attacking_army.troops.delta(@defending_army.troops, world);

        let attacking_ticks_to_zero = attacking_army.troops.health / delta_defending.into();
        let defending_ticks_to_zero = defending_army.troops.health / delta_attacking.into();

        let mut first_end_tick: u64 = attacking_ticks_to_zero.try_into().unwrap();
        if defending_ticks_to_zero < attacking_ticks_to_zero {
            first_end_tick = defending_ticks_to_zero.try_into().unwrap();
        }

        let battle_config = BattleConfigImpl::get(world);
        if first_end_tick > battle_config.max_tick_duration {
            return battle_config.max_tick_duration;
        } 

        return first_end_tick;
    }
    

    fn battle_ticks(self: Battle, world: IWorldDispatcher) -> u64 {
        let tick = TickImpl::get(world);
        if self.last_updated_tick >= self.end_tick {
            
            return 0;
        } else {
            if tick.current() <= self.end_tick {
                // battle has not ended 
                return tick.current() - self.last_updated_tick;
            } else {
                //battle has ended
                return self.end_tick - self.last_updated_tick;
            }
        }
        
    }


    fn battle_state(ref self: Battle, world: IWorldDispatcher) {

        //todo@credence logic is innacurate, you can be in more than one battle at once
        // so there should be an army.health_dimish_rate instead

        let mut attacking_army: Army = get!(world, self.attacking_entity_id, Army);
        let mut defending_army: Army = get!(world, self.defending_entity_id, Army);
        
        let (delta_attacking, delta_defending) 
            = attacking_army.troops.delta(@defending_army.troops, world);

        let battle_ticks = self.battle_ticks(world);
        attacking_army.troops.health -= (delta_defending.into() * battle_ticks.into());
        defending_army.troops.health -= (delta_attacking.into() * battle_ticks.into());
        set!(world, (attacking_army, defending_army));
        
        let tick = TickImpl::get(world);
        self.last_updated_tick = tick.current();
        set!(world, (self));
    }
}
