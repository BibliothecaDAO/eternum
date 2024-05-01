use eternum::models::{combat::{Troops, Battle, BattleSide}};

#[dojo::interface]
trait ICombatContract<TContractState> {
    fn army_create(army_owner_id: u128, guard: bool);
    fn army_buy_troops(army_id: u128, payer_id: u128, troops: Troops);
    fn army_merge_troops(from_army_id: u128, to_army_id: u128, troops: Troops);

    fn battle_start(attacking_army_id: u128, defending_army_id: u128);
    fn battle_join(battle_id: u128, battle_side: BattleSide, army_id: u128);
    fn battle_leave(battle_id: u128, army_id: u128);
// fn end_battle(battle_entity_id: u128, army_entity_id: u128 );
}


#[dojo::contract]
mod combat_systems {
    use core::traits::Into;
use core::option::OptionTrait;
    use eternum::alias::ID;
    use eternum::constants::{ResourceTypes, ErrorMessages};
    use eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE};
    use eternum::models::capacity::Capacity;
    use eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigImpl,
        TroopConfigTrait, BattleConfig, BattleConfigImpl, BattleConfigTrait, CapacityConfig,
        CapacityConfigImpl
    };

    use eternum::models::movable::Movable;
    use eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner, OwnerTrait};
    use eternum::models::position::{Position, Coord, PositionTrait};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::realm::Realm;
    use eternum::models::structure::{Structure, StructureTrait};
    use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use eternum::models::{
        combat::{
            Army, Troops, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait, Battle,
            BattleImpl, BattleTrait, BattleSide, Guard
        },
    };

    use eternum::utils::math::PercentageImpl;
    use super::ICombatContract;

    #[abi(embed_v0)]
    impl CombatContractImpl of ICombatContract<ContractState> {
        

        fn army_create(world: IWorldDispatcher, army_owner_id: u128, guard: bool) {
            
            // ensure caller owns entity that will own army
            get!(world, army_owner_id, EntityOwner).assert_caller_owner(world);


            // make army 
            let mut army_id: u128 = world.uuid().into();
            set!(world, (Army {
                    entity_id: army_id,
                    troops: Default::default(),
                    battle_id: 0,
                    battle_side: Default::default()
                }));

            // set army owner entity
            set!(world,(EntityOwner {entity_id: army_id, entity_owner_id: army_owner_id}));

            // set army position to be owner position
            let owner_position: Position = get!(world, army_owner_id, Position);
            set!(
                world,
                (Position { entity_id: army_id, x: owner_position.x, y: owner_position.y })
            );

 
            if guard {

                ////// it's a structure guard //////////////
 
                // ensure entity is a structure
                get!(world, army_owner_id, Structure).assert_is_structure();

                // ensure entity does not already have a guard
                let mut guard: Guard = get!(world, army_owner_id, Guard);
                assert!(guard.army_id.is_zero(), "entity {} already has an army guard", army_owner_id);

                // set structure guard
                guard.army_id = army_id;
                set!(world, (guard));
  
            } else {

                ////// it's a moving army (raider) //////////////

                // set movable model
                let army_sec_per_km = get!(world, (WORLD_CONFIG_ID, ARMY_ENTITY_TYPE), SpeedConfig)
                .sec_per_km;
                set!(
                    world,
                    Movable {
                        entity_id: army_id,
                        sec_per_km: army_sec_per_km,
                        blocked: false,
                        round_trip: false,
                        start_coord_x: owner_position.x,
                        start_coord_y: owner_position.y,
                        intermediate_coord_x: 0,
                        intermediate_coord_y: 0,
                    }
                );

                // set army carry capacity
                let army_carry_capacity : CapacityConfig = CapacityConfigImpl::get(world, ARMY_ENTITY_TYPE);
                set!(world, (
                        Capacity { entity_id: army_id, weight_gram: army_carry_capacity.weight_gram },
                    )
                );
            }
        }



        fn army_buy_troops(world: IWorldDispatcher, army_id: u128, payer_id: u128, troops: Troops) {

            // ensure caller owns the entity paying
            get!(world, payer_id, EntityOwner).assert_caller_owner(world);

            // ensure payer and army are at the same position
            let payer_position: Position = get!(world, payer_id, Position);
            let army_position: Position = get!(world, army_id, Position);
            payer_position.assert_same_location(army_position.into());
            
            // make payment for troops
            let knight_resource = ResourceImpl::get(world, (payer_id, ResourceTypes::KNIGHT));
            let paladin_resource = ResourceImpl::get(world, (payer_id, ResourceTypes::PALADIN));
            let crossbowman_resource = ResourceImpl::get(
                world, (payer_id, ResourceTypes::CROSSBOWMAN)
            );
            let (mut knight_resource, mut paladin_resource, mut crossbowman_resource) = troops
                .purchase(payer_id, (knight_resource, paladin_resource, crossbowman_resource));
            knight_resource.save(world);
            paladin_resource.save(world);
            crossbowman_resource.save(world);

            // increase troops number
            let mut army: Army = get!(world, army_id, Army);
            army.troops.add(troops);
            set!(world, (army));

            // increase army health
            let mut army_health: Health = get!(world, army_id, Health);
            army_health.increase_by(troops.full_health(TroopConfigImpl::get(world)));
            set!(world, (army_health));

            // set troop quantity
            let mut army_quantity: Quantity = get!(world, army_id, Quantity);
            army_quantity.value += troops.count().into();
            set!(world, (army_quantity));

        }

        fn army_merge_troops(world: IWorldDispatcher, from_army_id: u128, to_army_id: u128, troops: Troops,) {

            // ensure caller owns from and to armies
            get!(world, from_army_id, EntityOwner).assert_caller_owner(world);
            get!(world, to_army_id, EntityOwner).assert_caller_owner(world);

            // ensure from and to armies are at the same position
            let from_army_position: Position = get!(world, from_army_id, Position);
            let to_army_position: Position = get!(world, to_army_id, Position);
            from_army_position.assert_same_location(to_army_position.into());

            let troop_config = TroopConfigImpl::get(world);
            
            // decrease from army troops
            let mut from_army: Army = get!(world, from_army_id, Army);
            from_army.troops.deduct(troops);
            set!(world, (from_army));

            // decrease from army health
            let mut from_army_health: Health = get!(world, from_army_id, Health);
            from_army_health.decrease_by(troops.full_health(troop_config));
            set!(world, (from_army_health));

            // decrease from army  quantity
            let mut from_army_quantity: Quantity = get!(world, from_army_id, Quantity);
            from_army_quantity.value -= troops.count().into();
            set!(world, (from_army_quantity));


            // increase to army troops
            let mut to_army: Army = get!(world, to_army_id, Army);
            to_army.troops.add(troops);
            set!(world, (to_army));

            // increase to army health
            let mut to_army_health: Health = get!(world, to_army_id, Health);
            to_army_health.increase_by(troops.full_health(troop_config));
            set!(world, (to_army_health));

            // increase to army quantity
            let mut to_army_quantity: Quantity = get!(world, to_army_id, Quantity);
            to_army_quantity.value += troops.count().into();
            set!(world, (to_army_quantity));

        }




        fn battle_start(world: IWorldDispatcher, attacking_army_id: u128, defending_army_id: u128) {
            let mut attacking_army: Army = get!(world, attacking_army_id, Army);
            assert!(attacking_army.battle_id == 0, "attacking army is in a battle");

            let mut attacking_army_owner_entity: EntityOwner = get!(
                world, attacking_army_id, EntityOwner
            );
            assert!(
                attacking_army_owner_entity.owner_address(world) == starknet::get_caller_address(),
                "caller is not attacker"
            );

            let mut defending_army: Army = get!(world, defending_army_id, Army);
            assert!(defending_army.battle_id == 0, "defending army is in a battle");

            let attacking_army_position: Position = get!(world, attacking_army_id, Position);
            let defending_army_position: Position = get!(world, defending_army_id, Position);
            assert!(
                Into::<
                    Position, Coord
                    >::into(attacking_army_position) == Into::<
                    Position, Coord
                >::into(defending_army_position),
                "both troops not on same position"
            );

            // make battle 
            let attacking_army_health: Health = get!(world, attacking_army_id, Health);
            let defending_army_health: Health = get!(world, defending_army_id, Health);

            let tick = TickImpl::get(world);
            let mut battle: Battle = Default::default();
            battle.entity_id = world.uuid().into();
            battle.attack_army = attacking_army;
            battle.defence_army = attacking_army;
            battle.attack_army_health = attacking_army_health;
            battle.defence_army_health = defending_army_health;
            battle.tick_last_updated = tick.current();
            let troop_config = TroopConfigImpl::get(world);
            battle.restart(tick, troop_config);

            set!(world, (battle));

            // set battle position 
            let mut battle_position: Position = Default::default();
            battle_position.y = attacking_army_position.x;
            battle_position.y = attacking_army_position.y;
            set!(world, (battle_position));
        }


        fn battle_join(
            world: IWorldDispatcher, battle_id: u128, battle_side: BattleSide, army_id: u128
        ) {
            assert!(battle_side != BattleSide::None, "choose correct battle side");

            let mut army_owner_entity: EntityOwner = get!(world, army_id, EntityOwner);
            assert!(
                army_owner_entity.owner_address(world) == starknet::get_caller_address(),
                "caller is not army owner"
            );

            // update battle state before any other actions
            let mut battle: Battle = get!(world, battle_id, Battle);
            let tick = TickImpl::get(world);
            battle.update_state(tick);

            assert!(battle.tick_duration_left > 0, "Battle has ended");

            let mut caller_army: Army = get!(world, army_id, Army);
            assert!(caller_army.battle_id == 0, "army is in a battle");

            let caller_army_position = get!(world, caller_army.entity_id, Position);
            let battle_position = get!(world, battle.entity_id, Position);
            assert!(
                Into::<
                    Position, Coord
                    >::into(caller_army_position) == Into::<
                    Position, Coord
                >::into(battle_position),
                "caller army not in same position as army"
            );

            caller_army.battle_id = battle_id;
            caller_army.battle_side = battle_side;

            let mut caller_army_movable: Movable = get!(world, caller_army.entity_id, Movable);
            assert!(!caller_army_movable.blocked, "caller army already blocked by another system");

            caller_army_movable.blocked = true;
            set!(world, (caller_army_movable));

            // merge caller army with army troops 
            let mut battle_army = battle.attack_army;
            let mut battle_army_health = battle.attack_army_health;
            if battle_side == BattleSide::Defence {
                battle_army = battle.defence_army;
                battle_army_health = battle.defence_army_health;
            }

            battle_army.troops.add(caller_army.troops);
            let mut caller_army_health: Health = get!(world, army_id, Health);
            battle_army_health.increase_by(caller_army_health.current);

            if battle_side == BattleSide::Defence {
                battle.defence_army = battle_army;
                battle.defence_army_health = battle_army_health;
            } else {
                battle.attack_army = battle_army;
                battle.attack_army_health = battle_army_health;
            }

            let troop_config = TroopConfigImpl::get(world);
            battle.restart(tick, troop_config);
            set!(world, (battle));
        }


        fn battle_leave(world: IWorldDispatcher, battle_id: u128, army_id: u128) {
            let mut army_owner_entity: EntityOwner = get!(world, army_id, EntityOwner);
            assert!(
                army_owner_entity.owner_address(world) == starknet::get_caller_address(),
                "caller is not army owner"
            );

            // update battle state before any other actions
            let mut battle: Battle = get!(world, battle_id, Battle);
            let tick = TickImpl::get(world);
            battle.update_state(tick);

            let mut caller_army: Army = get!(world, army_id, Army);
            assert!(caller_army.battle_id == battle_id, "wrong battle id");
            assert!(caller_army.battle_side != BattleSide::None, "choose correct battle side");

            let mut caller_army_movable: Movable = get!(world, caller_army.entity_id, Movable);
            assert!(caller_army_movable.blocked, "caller army should be blocked");

            caller_army_movable.blocked = false;
            set!(world, (caller_army_movable));

            if battle.has_ended() {
                if battle.winner() != caller_army.battle_side {
                    panic!("Battle has ended and your team lost");
                }
            }

            // merge caller army with army troops 
            let mut battle_army = battle.attack_army;
            let mut battle_army_health = battle.attack_army_health;
            if caller_army.battle_side == BattleSide::Defence {
                battle_army = battle.defence_army;
                battle_army_health = battle.defence_army_health;
            }

            let mut caller_army_health: Health = get!(world, army_id, Health);
            let caller_army_original_health: u128 = caller_army_health.current;
            let caller_army_original_troops: Troops = caller_army.troops;

            let caller_army_health_left: u128 = (caller_army_health.current
                * battle_army_health.current)
                / battle_army_health.lifetime;

            caller_army_health.decrease_by(caller_army_health.current - caller_army_health_left);

            caller_army
                .troops
                .deduct_percentage(battle_army_health.current, battle_army_health.lifetime);

            set!(world, (caller_army, caller_army_health));

            battle_army.troops.deduct(caller_army_original_troops);
            battle_army_health.decrease_by(caller_army_original_health);

            if caller_army.battle_side == BattleSide::Defence {
                battle.defence_army = battle_army;
                battle.defence_army_health = battle_army_health;
            } else {
                battle.attack_army = battle_army;
                battle.attack_army_health = battle_army_health;
            }

            let troop_config = TroopConfigImpl::get(world);
            battle.restart(tick, troop_config);
            set!(world, (battle));
        }
    }
}
