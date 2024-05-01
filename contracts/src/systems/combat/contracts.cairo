use eternum::models::{combat::{Troops, Battle, BattleSide}};

#[dojo::interface]
trait ICombatContract<TContractState> {
    fn army_create(army_owner_id: u128, protector: bool);
    fn army_buy_troops(army_id: u128, payer_id: u128, troops: Troops);
    fn army_merge_troops(from_army_id: u128, to_army_id: u128, troops: Troops);

    fn battle_start(attacking_army_id: u128, defending_army_id: u128);
    fn battle_join(battle_id: u128, battle_side: BattleSide, army_id: u128);
    fn battle_leave(battle_id: u128, army_id: u128);
    fn battle_pillage(army_id: u128, structure_id: u128);
// fn end_battle(battle_entity_id: u128, army_entity_id: u128 );
}


#[dojo::contract]
mod combat_systems {
    use core::integer::BoundedInt;
    use core::option::OptionTrait;
    use core::traits::Into;
    use eternum::alias::ID;
    use eternum::constants::{
        ResourceTypes, ErrorMessages, get_resources_for_pillage, get_resources_for_pillage_probs
    };
    use eternum::constants::{
        WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, LOYALTY_MAX_VALUE, MAX_PILLAGE_TRIAL_COUNT
    };
    use eternum::models::capacity::Capacity;
    use eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigImpl,
        TroopConfigTrait, BattleConfig, BattleConfigImpl, BattleConfigTrait, CapacityConfig,
        CapacityConfigImpl
    };
    use eternum::models::config::{WeightConfig, WeightConfigImpl};
    use eternum::models::loyalty::{Loyalty, LoyaltyTrait};

    use eternum::models::movable::{Movable, MovableTrait};
    use eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner, OwnerTrait};
    use eternum::models::position::{Position, Coord, PositionTrait};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use eternum::models::resources::{ResourceLock, ResourceLockTrait};
    use eternum::models::structure::{Structure, StructureTrait};
    use eternum::models::weight::Weight;
    use eternum::models::{
        combat::{
            Army, Troops, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait, Battle,
            BattleImpl, BattleTrait, BattleSide, Protector, Protectee, ProtecteeTrait
        },
    };
    use eternum::systems::resources::contracts::resource_systems::{InternalResourceSystemsImpl};
    use eternum::systems::transport::contracts::travel_systems::travel_systems::{
        InternalTravelSystemsImpl
    };

    use eternum::utils::math::{PercentageValueImpl, PercentageImpl};
    use eternum::utils::math::{min};
    use eternum::utils::random;
    use super::ICombatContract;

    #[abi(embed_v0)]
    impl CombatContractImpl of ICombatContract<ContractState> {
        fn army_create(world: IWorldDispatcher, army_owner_id: u128, protector: bool) {
            // ensure caller owns entity that will own army
            get!(world, army_owner_id, EntityOwner).assert_caller_owner(world);

            // make army 
            let mut army_id: u128 = world.uuid().into();
            set!(
                world,
                (Army {
                    entity_id: army_id,
                    troops: Default::default(),
                    battle_id: 0,
                    battle_side: Default::default()
                })
            );

            // set army owner entity
            set!(world, (EntityOwner { entity_id: army_id, entity_owner_id: army_owner_id }));

            // set army position to be owner position
            let owner_position: Position = get!(world, army_owner_id, Position);
            set!(
                world, (Position { entity_id: army_id, x: owner_position.x, y: owner_position.y })
            );

            if protector {
                ////// it's a structure protector //////////////

                // ensure entity is a structure
                get!(world, army_owner_id, Structure).assert_is_structure();

                // ensure entity does not already have a protector
                let mut protector: Protector = get!(world, army_owner_id, Protector);
                assert!(
                    protector.army_id.is_zero(),
                    "entity {} already has an army protector",
                    army_owner_id
                );

                // set structure protector
                protector.army_id = army_id;
                set!(world, (protector));

                // set army protectee
                set!(world, (Protectee { army_id, protectee_id: army_owner_id }));
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
                let army_carry_capacity: CapacityConfig = CapacityConfigImpl::get(
                    world, ARMY_ENTITY_TYPE
                );
                set!(
                    world,
                    (Capacity { entity_id: army_id, weight_gram: army_carry_capacity.weight_gram },)
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

        fn army_merge_troops(
            world: IWorldDispatcher, from_army_id: u128, to_army_id: u128, troops: Troops,
        ) {
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
            // ensure attacking army is not in any battle
            let mut attacking_army: Army = get!(world, attacking_army_id, Army);
            assert!(attacking_army.battle_id.is_zero(), "attacking army is in a battle");

            // ensure caller owns attacking army
            get!(world, attacking_army_id, EntityOwner).assert_caller_owner(world);

            // ensure defending army is not in any battle
            let mut defending_army: Army = get!(world, defending_army_id, Army);
            assert!(defending_army.battle_id.is_zero(), "defending army is in a battle");

            // ensure attacker and defender are in same location
            let attacking_army_position: Position = get!(world, attacking_army_id, Position);
            let defending_army_position: Position = get!(world, defending_army_id, Position);
            attacking_army_position.assert_same_location(defending_army_position.into());

            // update attacking army battle details
            let battle_id: u128 = world.uuid().into();
            attacking_army.battle_id = battle_id;
            attacking_army.battle_side = BattleSide::Attack;
            set!(world, (attacking_army));

            // update defending army battle details
            defending_army.battle_id = battle_id;
            defending_army.battle_side = BattleSide::Defence;
            set!(world, (defending_army));

            // make attacking army immovable
            let mut attacking_army_protectee: Protectee = get!(world, attacking_army_id, Protectee);
            let mut attacking_army_movable: Movable = get!(world, attacking_army_id, Movable);
            if attacking_army_protectee.is_none() {
                attacking_army_movable.assert_moveable();
                attacking_army_movable.blocked = true;
                set!(world, (attacking_army_movable));
            }

            // make defending army immovable
            let mut defending_army_protectee: Protectee = get!(world, defending_army_id, Protectee);
            let mut defending_army_movable: Movable = get!(world, defending_army_id, Movable);
            if defending_army_protectee.is_none() {
                defending_army_movable.assert_moveable();
                defending_army_movable.blocked = true;
                set!(world, (defending_army_movable));
            }

            // lock resources being protected by attacking army
            let mut attacking_army_protectee_resource_lock: ResourceLock = get!(
                world, attacking_army_protectee.protected_resources_owner(), ResourceLock
            );
            attacking_army_protectee_resource_lock.assert_not_locked();
            attacking_army_protectee_resource_lock.release_at = BoundedInt::max();
            set!(world, (attacking_army_protectee_resource_lock));

            // lock resources being protected by defending army
            let mut defending_army_protectee_resource_lock: ResourceLock = get!(
                world, defending_army_protectee.protected_resources_owner(), ResourceLock
            );
            defending_army_protectee_resource_lock.assert_not_locked();
            defending_army_protectee_resource_lock.release_at = BoundedInt::max();
            set!(world, (defending_army_protectee_resource_lock));

            // create battle 
            let attacking_army_health: Health = get!(world, attacking_army_id, Health);
            let defending_army_health: Health = get!(world, defending_army_id, Health);

            let tick = TickImpl::get(world);
            let mut battle: Battle = Default::default();
            battle.entity_id = battle_id;
            battle.attack_army = attacking_army;
            battle.defence_army = defending_army;
            battle.attack_army_health = attacking_army_health;
            battle.defence_army_health = defending_army_health;
            battle.tick_last_updated = tick.current();

            // set battle position 
            let mut battle_position: Position = Default::default();
            battle_position.y = attacking_army_position.x;
            battle_position.y = attacking_army_position.y;
            set!(world, (battle_position));

            // start battle
            let troop_config = TroopConfigImpl::get(world);
            battle.restart(tick, troop_config);
            set!(world, (battle));
        }


        fn battle_join(
            world: IWorldDispatcher, battle_id: u128, battle_side: BattleSide, army_id: u128
        ) {
            assert!(battle_side != BattleSide::None, "choose correct battle side");

            // ensure caller owns army
            get!(world, army_id, EntityOwner).assert_caller_owner(world);

            // update battle state before any other actions
            let mut battle: Battle = get!(world, battle_id, Battle);
            let tick = TickImpl::get(world);
            battle.update_state(tick);

            // ensure battle is still ongoing
            assert!(battle.tick_duration_left > 0, "Battle has ended");

            // ensure caller army is not in battle
            let mut caller_army: Army = get!(world, army_id, Army);
            assert!(caller_army.battle_id.is_zero(), "army is in a battle");

            // ensure caller army is at battle location
            let caller_army_position = get!(world, caller_army.entity_id, Position);
            let battle_position = get!(world, battle.entity_id, Position);
            caller_army_position.assert_same_location(battle_position.into());

            caller_army.battle_id = battle_id;
            caller_army.battle_side = battle_side;
            set!(world, (caller_army));

            // make caller army immovable
            let mut caller_army_protectee: Protectee = get!(world, army_id, Protectee);
            let mut caller_army_movable: Movable = get!(world, army_id, Movable);
            if caller_army_protectee.is_none() {
                caller_army_movable.assert_moveable();
                caller_army_movable.blocked = true;
                set!(world, (caller_army_movable));
            }

            // lock resources being protected by army
            let mut caller_army_protectee_resource_lock: ResourceLock = get!(
                world, caller_army_protectee.protected_resources_owner(), ResourceLock
            );
            caller_army_protectee_resource_lock.assert_not_locked();
            caller_army_protectee_resource_lock.release_at = BoundedInt::max();
            set!(world, (caller_army_protectee_resource_lock));

            // add caller army troops to battle army troops
            let mut battle_army = battle.attack_army;
            let mut battle_army_health = battle.attack_army_health;
            if battle_side == BattleSide::Defence {
                battle_army = battle.defence_army;
                battle_army_health = battle.defence_army_health;
            }
            battle_army.troops.add(caller_army.troops);

            // add caller army heath to battle army health 
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
            // ensure caller owns army
            get!(world, army_id, EntityOwner).assert_caller_owner(world);

            // update battle state before any other actions
            let mut battle: Battle = get!(world, battle_id, Battle);
            let tick = TickImpl::get(world);
            battle.update_state(tick);

            // ensure battle id is correct
            let mut caller_army: Army = get!(world, army_id, Army);
            assert!(caller_army.battle_id == battle_id, "wrong battle id");
            assert!(caller_army.battle_side != BattleSide::None, "choose correct battle side");

            // make caller army mobile again
            let mut caller_army_protectee: Protectee = get!(world, army_id, Protectee);
            let mut caller_army_movable: Movable = get!(world, army_id, Movable);
            if caller_army_protectee.is_none() {
                caller_army_movable.assert_blocked();
                caller_army_movable.blocked = false;
                set!(world, (caller_army_movable));
            }

            if battle.has_ended() {
                if battle.winner() == caller_army.battle_side
                    || battle.winner() == BattleSide::None {
                    // release lock on protected resources
                    let mut caller_army_protectee: Protectee = get!(world, army_id, Protectee);
                    let mut caller_army_protectee_resource_lock: ResourceLock = get!(
                        world, caller_army_protectee.protected_resources_owner(), ResourceLock
                    );
                    caller_army_protectee_resource_lock.assert_locked();
                    let now = starknet::get_block_timestamp();
                    caller_army_protectee_resource_lock.release_at = now;
                    set!(world, (caller_army_protectee_resource_lock));
                } else {
                    panic!("Battle has ended and your team lost");
                }
            }

            // remove caller army from army troops 
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


        fn battle_pillage(world: IWorldDispatcher, army_id: u128, structure_id: u128,) {
            // todo@credence need to decrease health 

            // ensure caller owns army
            get!(world, army_id, EntityOwner).assert_caller_owner(world);

            // ensure entity being pillaged is a structure
            get!(world, structure_id, Structure).assert_is_structure();

            // ensure army is at structure position
            let army_position: Position = get!(world, army_id, Position);
            let structure_position: Position = get!(world, structure_id, Position);
            army_position.assert_same_location(structure_position.into());

            let tick = TickImpl::get(world);
            let troop_config = TroopConfigImpl::get(world);

            let structure_army_id: u128 = get!(world, structure_id, Protector).army_id;
            let structure_army: Army = get!(world, structure_army_id, Army);
            let structure_army_health: Health = get!(world, structure_army_id, Health);

            // a percentage of it's full strength depending on structure army's health
            let structure_army_strength = structure_army.troops.full_strength(troop_config)
                * structure_army_health.percentage_left()
                / PercentageValueImpl::_100().into();

            // a percentage of its relative strength depending on loyalty
            let structure_loyalty: Loyalty = get!(world, structure_id, Loyalty);
            let structure_army_strength = structure_army_strength
                * structure_loyalty.value(tick).into()
                / LOYALTY_MAX_VALUE.into();

            // a percentage of it's full strength depending on structure army's health
            let attacking_army: Army = get!(world, army_id, Army);
            let attacking_army_health: Health = get!(world, army_id, Health);
            let attacking_army_strength = attacking_army.troops.full_strength(troop_config)
                * attacking_army_health.percentage_left()
                / PercentageValueImpl::_100().into();

            let attack_successful: @bool = random::choices(
                array![true, false].span(),
                array![attacking_army_strength, structure_army_strength].span(),
                array![].span(),
                1,
                true
            )[0];

            if *attack_successful {
                let success_probability = attacking_army_strength
                    * PercentageValueImpl::_100().into()
                    / structure_army_strength;

                let mut count = 0;
                loop {
                    if count == MAX_PILLAGE_TRIAL_COUNT {
                        break;
                    }
                    // choose a random resource to be stolen
                    let chosen_resource_type: @u8 = random::choices(
                        get_resources_for_pillage(),
                        get_resources_for_pillage_probs(),
                        array![].span(),
                        1,
                        true
                    )[0];
                    let pillaged_resource_from_structure: Resource = ResourceImpl::get(
                        world, (structure_id, *chosen_resource_type)
                    );
                    if pillaged_resource_from_structure.balance > 0 {
                        // find out the max resource amount carriable given entity's weight
                        let army_capacity: Capacity = get!(world, army_id, Capacity);
                        let army_total_capacity = army_capacity.weight_gram
                            * attacking_army.troops.count().into();
                        let army_weight: Weight = get!(world, army_id, Weight);
                        let max_carriable = (army_total_capacity - army_weight.value)
                            / WeightConfigImpl::get_weight(world, *chosen_resource_type, 1);
                        if max_carriable > 0 {
                            let max_resource_amount_stolen: u128 = attacking_army
                                .troops
                                .count()
                                .into()
                                * success_probability.into()
                                / PercentageValueImpl::_100().into();

                            let resource_amount_stolen: u128 = min(
                                pillaged_resource_from_structure.balance, max_resource_amount_stolen
                            );
                            let resource_amount_stolen: u128 = min(
                                max_carriable, resource_amount_stolen
                            );

                            InternalResourceSystemsImpl::transfer(
                                world,
                                0,
                                structure_id,
                                army_id,
                                array![(*chosen_resource_type, resource_amount_stolen)].span()
                            );

                            break;
                        }
                    }
                    count += 1;
                };
            }

            // army goes home 

            let army_owner_entity_id: u128 = get!(world, army_id, EntityOwner).entity_owner_id;
            let army_owner_position: Position = get!(world, army_owner_entity_id, Position);
            let army_movable: Movable = get!(world, army_id, Movable);

            InternalTravelSystemsImpl::travel(
                world, army_id, army_movable, army_position.into(), army_owner_position.into()
            );
        }
    }
}

