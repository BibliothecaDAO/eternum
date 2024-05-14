use eternum::models::{combat::{Troops, Battle, BattleSide}};

#[dojo::interface]
trait ICombatContract<TContractState> {
    fn army_create(army_owner_id: u128, army_is_protector: bool);
    fn army_buy_troops(army_id: u128, payer_id: u128, troops: Troops);
    fn army_merge_troops(from_army_id: u128, to_army_id: u128, troops: Troops);

    fn battle_start(attacking_army_id: u128, defending_army_id: u128);
    fn battle_join(battle_id: u128, battle_side: BattleSide, army_id: u128);
    fn battle_leave(battle_id: u128, army_id: u128);
    fn battle_pillage(army_id: u128, structure_id: u128);
    fn battle_claim(army_id: u128, structure_id: u128);
// fn end_battle(battle_entity_id: u128, army_entity_id: u128 );
}


#[dojo::contract]
mod combat_systems {
    use core::array::SpanTrait;
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
    use eternum::models::buildings::{Building, BuildingImpl, BuildingCategory};
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
    use eternum::models::position::CoordTrait;
    use eternum::models::position::{Position, Coord, PositionTrait, Direction};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use eternum::models::resources::{ResourceTransferLock, ResourceTransferLockTrait};
    use eternum::models::structure::{Structure, StructureTrait, StructureCategory};
    use eternum::models::weight::Weight;
    use eternum::models::{
        combat::{
            Army, ArmyTrait, Troops, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait,
            Battle, BattleImpl, BattleTrait, BattleSide, Protector, Protectee, ProtecteeTrait,
            BattleHealthTrait
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

    #[derive(Drop, starknet::Event)]
    struct PillageEvent {
        #[key]
        structure_id: ID,
        #[key]
        attacker_realm_entity_id: ID,
        #[key]
        army_id: u128,
        winner: BattleSide,
        pillaged_resources: Span<(u8, u128)>,
        destroyed_building_category: BuildingCategory
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        PillageEvent: PillageEvent,
    }

    #[abi(embed_v0)]
    impl CombatContractImpl of ICombatContract<ContractState> {
        fn army_create(world: IWorldDispatcher, army_owner_id: u128, army_is_protector: bool) {
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

            if army_is_protector {
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
            attacking_army.assert_not_in_battle();

            // ensure caller owns attacking army
            get!(world, attacking_army_id, EntityOwner).assert_caller_owner(world);

            // ensure defending army is not in any battle
            let mut defending_army: Army = get!(world, defending_army_id, Army);
            defending_army.assert_not_in_battle();

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
            let mut attacking_army_protectee_resource_lock: ResourceTransferLock = get!(
                world, attacking_army_protectee.protected_resources_owner(), ResourceTransferLock
            );
            attacking_army_protectee_resource_lock.assert_not_locked();
            attacking_army_protectee_resource_lock.release_at = BoundedInt::max();
            set!(world, (attacking_army_protectee_resource_lock));

            // lock resources being protected by defending army
            let mut defending_army_protectee_resource_lock: ResourceTransferLock = get!(
                world, defending_army_protectee.protected_resources_owner(), ResourceTransferLock
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
            battle.attack_army = attacking_army.into();
            battle.defence_army = defending_army.into();
            battle.attack_army_health = attacking_army_health.into();
            battle.defence_army_health = defending_army_health.into();
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
            caller_army.assert_not_in_battle();

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
            let mut caller_army_protectee_resource_lock: ResourceTransferLock = get!(
                world, caller_army_protectee.protected_resources_owner(), ResourceTransferLock
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
                    let mut caller_army_protectee_resource_lock: ResourceTransferLock = get!(
                        world,
                        caller_army_protectee.protected_resources_owner(),
                        ResourceTransferLock
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


        fn battle_claim(world: IWorldDispatcher, army_id: u128, structure_id: u128) {
            // ensure caller owns army
            get!(world, army_id, EntityOwner).assert_caller_owner(world);

            // ensure entity being claimed is a structure
            let structure: Structure = get!(world, structure_id, Structure);
            structure.assert_is_structure();

            // ensure structure is not a realm
            assert!(structure.category != StructureCategory::Realm, "realms can not be claimed");

            // ensure claimer army is not in battle
            let claimer_army: Army = get!(world, army_id, Army);
            claimer_army.assert_not_in_battle();

            // ensure army is at structure position
            let claimer_army_position: Position = get!(world, army_id, Position);
            let structure_position: Position = get!(world, structure_id, Position);
            claimer_army_position.assert_same_location(structure_position.into());

            // ensure structure has no army protecting it 
            // or it has lost the battle it is currently in
            let tick = TickImpl::get(world);
            let structure_army_id: u128 = get!(world, structure_id, Protector).army_id;
            if structure_army_id.is_non_zero() {
                // ensure structure army is in battle
                let structure_army: Army = get!(world, structure_army_id, Army);
                structure_army.assert_in_battle();

                // update battle state before checking battle winner
                let mut battle: Battle = get!(world, structure_army.battle_id, Battle);
                battle.update_state(tick);
                set!(world, (battle));

                // ensure structure lost the battle
                assert!(battle.winner() != BattleSide::None, "battle has no winner");
                assert!(structure_army.battle_side != battle.winner(), "structure army won");
            }

            // pass ownership of structure to claimer
            let mut structure_owner_entity: EntityOwner = get!(world, structure_id, EntityOwner);
            let claimer_army_owner_entity_id: u128 = get!(world, army_id, EntityOwner)
                .entity_owner_id;
            structure_owner_entity.entity_owner_id = claimer_army_owner_entity_id;
            set!(world, (structure_owner_entity));

            // reset structure loyalty
            set!(world, (Loyalty { entity_id: structure_id, last_updated_tick: tick.current() }));
        }


        fn battle_pillage(world: IWorldDispatcher, army_id: u128, structure_id: u128,) {
            // ensure caller owns army
            get!(world, army_id, EntityOwner).assert_caller_owner(world);

            // ensure entity being pillaged is a structure
            let structure: Structure = get!(world, structure_id, Structure);
            structure.assert_is_structure();

            // ensure attacking army is not in a battle
            let attacking_army: Army = get!(world, army_id, Army);
            attacking_army.assert_not_in_battle();

            // ensure army is at structure position
            let army_position: Position = get!(world, army_id, Position);
            let structure_position: Position = get!(world, structure_id, Position);
            army_position.assert_same_location(structure_position.into());

            let tick = TickImpl::get(world);
            let troop_config = TroopConfigImpl::get(world);

            // get structure army and health

            let structure_army_id: u128 = get!(world, structure_id, Protector).army_id;
            let mut structure_army: Army = Default::default();
            let mut structure_army_health: Health = Default::default();
            if structure_army_id.is_non_zero() {
                structure_army = get!(world, structure_army_id, Army);
                structure_army.assert_not_in_battle();
                structure_army_health = get!(world, structure_army_id, Health);
            }

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
            let mut attacking_army_health: Health = get!(world, army_id, Health);
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

            let mut pillaged_resources: Array<(u8, u128)> = array![];

            if *attack_successful {
                let attack_success_probability = attacking_army_strength
                    * PercentageValueImpl::_100().into()
                    / (structure_army_strength + 1);

                // choose x random resource to be stolen
                let mut chosen_resource_types: Span<u8> = random::choices(
                    get_resources_for_pillage(),
                    get_resources_for_pillage_probs(),
                    array![].span(),
                    MAX_PILLAGE_TRIAL_COUNT.try_into().unwrap(),
                    true
                );

                loop {
                    match chosen_resource_types.pop_front() {
                        Option::Some(chosen_resource_type) => {
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
                                    / (WeightConfigImpl::get_weight(world, *chosen_resource_type, 1)
                                        + 1);

                                if max_carriable > 0 {
                                    let max_resource_amount_stolen: u128 = attacking_army
                                        .troops
                                        .count()
                                        .into()
                                        * attack_success_probability.into()
                                        / PercentageValueImpl::_100().into();

                                    let resource_amount_stolen: u128 = min(
                                        pillaged_resource_from_structure.balance,
                                        max_resource_amount_stolen
                                    );

                                    let resource_amount_stolen: u128 = min(
                                        max_carriable, resource_amount_stolen
                                    );

                                    pillaged_resources
                                        .append((*chosen_resource_type, resource_amount_stolen));

                                    InternalResourceSystemsImpl::transfer(
                                        world,
                                        structure_id,
                                        army_id,
                                        array![(*chosen_resource_type, resource_amount_stolen)]
                                            .span(),
                                        army_id,
                                        true,
                                        true
                                    );

                                    break;
                                }
                            }
                        },
                        Option::None => { break; }
                    }
                };
            }

            let mut destroyed_building_category = BuildingCategory::None;

            if structure.category == StructureCategory::Realm {
                // all buildings are at most 4 directions from the center
                // so first we pick a random between within 1 and 4 
                // with higher probability of high numbers

                let mut chosen_direction_count: u8 = *random::choices(
                    array![1_u8, 2, 3, 4].span(), // options are (1,2,3,4)
                    array![1, 7, 14, 30].span(), // these are the weights of each option
                    array![].span(),
                    1,
                    true
                )[0];

                // make different sets of direction arrangements so the targeted
                // building locations aren't clustered or so they arent facing only one direction
                let direction_arrangements = array![
                    array![
                        Direction::East,
                        Direction::NorthEast,
                        Direction::NorthWest,
                        Direction::West,
                        Direction::SouthWest,
                        Direction::SouthEast
                    ],
                    array![
                        Direction::SouthWest,
                        Direction::SouthEast,
                        Direction::East,
                        Direction::NorthEast,
                        Direction::NorthWest,
                        Direction::West,
                    ],
                    array![
                        Direction::NorthWest,
                        Direction::West,
                        Direction::SouthWest,
                        Direction::SouthEast,
                        Direction::East,
                        Direction::NorthEast,
                    ],
                    array![
                        Direction::NorthWest,
                        Direction::NorthEast,
                        Direction::SouthWest,
                        Direction::SouthEast,
                        Direction::East,
                        Direction::West
                    ],
                ];
                // move `chosen_direction_count` steps from the center in random directions
                let mut chosen_directions: Span<Direction> = random::choices(
                    direction_arrangements
                        .at(
                            // choose one arrangement at random
                            *random::choices(
                                array![0_u32, 1, 2, 3].span(), // options are (0,1,2,3) i.e index
                                array![1, 1, 1, 1]
                                    .span(), // each carry the same weight so equal probs
                                array![].span(),
                                1,
                                true
                            )[0]
                        )
                        .span(),
                    array![1, 2, 4, 7, 11, 15]
                        .span(), // direction weights are in ascending order so the last 3 carry the most weight
                    array![].span(),
                    chosen_direction_count.into(),
                    true
                );

                let mut final_coord = BuildingImpl::center();
                loop {
                    match chosen_directions.pop_front() {
                        Option::Some(direction) => {
                            final_coord = final_coord.neighbor(*direction);
                        },
                        Option::None => { break; }
                    }
                };

                if final_coord != BuildingImpl::center() {
                    // check if there is a building at the destination coordinate
                    let mut pillaged_building: Building = get!(
                        world,
                        (structure_position.x, structure_position.y, final_coord.x, final_coord.y),
                        Building
                    );
                    if pillaged_building.entity_id.is_non_zero() {
                        // destroy building if it exists
                        let building_category = BuildingImpl::destroy(
                            world, structure_id, final_coord
                        );
                        destroyed_building_category = building_category;
                    }
                }
            }

            // reduce attacking army's health by 10%
            // (pending better formula for health reduction)
            attacking_army_health
                .decrease_by(
                    attacking_army_health.current
                        * PercentageValueImpl::_10().into()
                        / PercentageValueImpl::_100().into()
                );
            set!(world, (attacking_army_health));

            // reduce structure army's health by 10%
            // (pending better formula for health reduction)
            if structure_army_id.is_non_zero() {
                structure_army_health
                    .decrease_by(
                        structure_army_health.current
                            * PercentageValueImpl::_10().into()
                            / PercentageValueImpl::_100().into()
                    );
                set!(world, (structure_army_health));
            }

            // army goes home 

            let army_owner_entity_id: u128 = get!(world, army_id, EntityOwner).entity_owner_id;
            let army_owner_position: Position = get!(world, army_owner_entity_id, Position);
            let army_movable: Movable = get!(world, army_id, Movable);

            InternalTravelSystemsImpl::travel(
                world, army_id, army_movable, army_position.into(), army_owner_position.into()
            );

            // emit pillage event
            emit!(
                world,
                (
                    Event::PillageEvent(
                        PillageEvent {
                            structure_id,
                            attacker_realm_entity_id: army_owner_entity_id,
                            army_id,
                            winner: if *attack_successful {
                                BattleSide::Attack
                            } else {
                                BattleSide::Defence
                            },
                            pillaged_resources: pillaged_resources.span(),
                            destroyed_building_category
                        }
                    ),
                )
            );
        }
    }
}

