use eternum::models::{combatV2::{Troops, Battle, BattleSide}};

#[dojo::interface]
trait ICombatv2Contract<TContractState> {
    fn create_army(owner_id: u128, troops: Troops);
    fn start_battle(attacking_army_id: u128, defending_army_id: u128);
    fn join_battle(battle_id: u128, battle_side: BattleSide, army_id: u128);
    fn leave_battle(battle_id: u128, army_id: u128);
// fn end_battle(battle_entity_id: u128, army_entity_id: u128 );
}


#[dojo::contract]
mod combat_v2_systems {
    use core::option::OptionTrait;
    use eternum::alias::ID;
    use eternum::constants::{ResourceTypes, ErrorMessages};
    use eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE};
    use eternum::models::capacity::Capacity;
    use eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigImpl,
        TroopConfigTrait, BattleConfig, BattleConfigImpl, BattleConfigTrait, CapacityConfig
    };

    use eternum::models::movable::Movable;
    use eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner, OwnerTrait};
    use eternum::models::position::{Position, Coord};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use eternum::models::{
        combatV2::{
            Army, Troops, TroopsImpl, TroopsTrait, Healthv2, Healthv2Impl, Healthv2Trait, Battle,
            BattleImpl, BattleTrait, BattleSide
        },
    };

    use eternum::utils::math::PercentageImpl;
    use super::ICombatv2Contract;

    #[abi(embed_v0)]
    impl Combatv2ContractImpl of ICombatv2Contract<ContractState> {
        fn create_army(world: IWorldDispatcher, owner_id: u128, troops: Troops) {
            // ensure caller is entity owner 
            get!(world, owner_id, Owner).assert_caller_owner();

            // ensure owner entity is a realm
            let realm: Realm = get!(world, owner_id, Realm);
            assert!(realm.realm_id != 0, "owner is not a realm");

            // make payment for troops
            let knight_resource = ResourceImpl::get(world, (owner_id, ResourceTypes::KNIGHT));
            let paladin_resource = ResourceImpl::get(world, (owner_id, ResourceTypes::PALADIN));
            let crossbowman_resource = ResourceImpl::get(
                world, (owner_id, ResourceTypes::CROSSBOWMAN)
            );
            let (knight_resource, paladin_resource, crossbowman_resource) = troops
                .purchase(owner_id, (knight_resource, paladin_resource, crossbowman_resource));
            set!(world, (knight_resource, paladin_resource, crossbowman_resource));

            // make troops 
            let mut army: Army = Default::default();
            army.entity_id = world.uuid().into();
            army.troops.add(troops);
            set!(world, (army));

            // set army health
            let mut army_health: Healthv2 = Default::default();
            army_health.entity_id = army.entity_id;
            army_health.increase_by(army.troops.full_health(TroopConfigImpl::get(world)));
            set!(world, (army_health));

            // set army owner entity
            let mut army_owned_by: EntityOwner = Default::default();
            army_owned_by.entity_id = army.entity_id;
            army_owned_by.entity_owner_id = owner_id;

            set!(
                world,
                (
                    army_owned_by,
                    Owner { entity_id: army.entity_id, address: starknet::get_caller_address() }
                )
            );

            // set army position
            let owner_position: Position = get!(world, owner_id, Position);
            set!(
                world,
                (Position { entity_id: army.entity_id, x: owner_position.x, y: owner_position.y })
            );

            // Make Moveable
            // @DEV TODO: This should be moved to a pure function rather than storing in the state. If we do it like this, then we will be storing the same data in the state multiple times.
            let individual_speed = get!(world, (WORLD_CONFIG_ID, ARMY_ENTITY_TYPE), SpeedConfig)
                .sec_per_km;

            set!(
                world,
                Movable {
                    entity_id: army.entity_id,
                    sec_per_km: individual_speed,
                    blocked: false,
                    round_trip: false,
                    start_coord_x: owner_position.x,
                    start_coord_y: owner_position.y,
                    intermediate_coord_x: 0,
                    intermediate_coord_y: 0,
                }
            );

            // set troop capacity and quantity

            let troop_capacity: CapacityConfig = get!(
                world, (WORLD_CONFIG_ID, ARMY_ENTITY_TYPE), CapacityConfig
            );
            set!(
                world,
                (
                    Capacity { entity_id: army.entity_id, weight_gram: troop_capacity.weight_gram },
                    Quantity { entity_id: army.entity_id, value: army.troops.count().into() },
                )
            );
        }


        fn start_battle(world: IWorldDispatcher, attacking_army_id: u128, defending_army_id: u128) {
            let mut attacking_army: Army = get!(world, attacking_army_id, Army);
            assert!(attacking_army.battle_id == 0, "attacking army is in a battle");

            let mut attacking_army_owned_by: EntityOwner = get!(
                world, attacking_army_id, EntityOwner
            );
            assert!(
                attacking_army_owned_by.owner_address(world) == starknet::get_caller_address(),
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
            let attacking_army_health: Healthv2 = get!(world, attacking_army_id, Healthv2);
            let defending_army_health: Healthv2 = get!(world, defending_army_id, Healthv2);

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


        fn join_battle(
            world: IWorldDispatcher, battle_id: u128, battle_side: BattleSide, army_id: u128
        ) {
            assert!(battle_side != BattleSide::None, "choose correct battle side");

            let mut army_owned_by: EntityOwner = get!(world, army_id, EntityOwner);
            assert!(
                army_owned_by.owner_address(world) == starknet::get_caller_address(),
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
            let mut caller_army_health: Healthv2 = get!(world, army_id, Healthv2);
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


        fn leave_battle(world: IWorldDispatcher, battle_id: u128, army_id: u128) {
            let mut army_owned_by: EntityOwner = get!(world, army_id, EntityOwner);
            assert!(
                army_owned_by.owner_address(world) == starknet::get_caller_address(),
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

            let mut caller_army_health: Healthv2 = get!(world, army_id, Healthv2);
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
