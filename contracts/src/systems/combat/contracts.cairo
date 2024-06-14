use eternum::models::{combat::{Troops, Battle, BattleSide}};

#[dojo::interface]
trait ICombatContract<TContractState> {
    fn army_create(army_owner_id: u128, is_defensive_army: bool) -> u128;
    fn army_buy_troops(army_id: u128, payer_id: u128, troops: Troops);
    fn army_merge_troops(from_army_id: u128, to_army_id: u128, troops: Troops);

    fn battle_start(attacking_army_id: u128, defending_army_id: u128);
    fn battle_join(battle_id: u128, battle_side: BattleSide, army_id: u128);
    fn battle_leave(battle_id: u128, army_id: u128);
    fn battle_pillage(army_id: u128, structure_id: u128);
    fn battle_claim(army_id: u128, structure_id: u128);
}


#[dojo::contract]
mod combat_systems {
    use core::array::SpanTrait;
    use core::integer::BoundedInt;
    use core::option::OptionTrait;
    use core::traits::Into;
    use eternum::alias::ID;
    use eternum::constants::{
        ResourceTypes, ErrorMessages, get_resources_without_earthenshards,
        get_resources_without_earthenshards_probs
    };
    use eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, MAX_PILLAGE_TRIAL_COUNT};
    use eternum::models::buildings::{Building, BuildingImpl, BuildingCategory};
    use eternum::models::capacity::Capacity;
    use eternum::models::combat::BattleEscrowTrait;
    use eternum::models::combat::ProtectorTrait;
    use eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigImpl,
        TroopConfigTrait, BattleConfig, BattleConfigImpl, BattleConfigTrait, CapacityConfig,
        CapacityConfigImpl
    };
    use eternum::models::config::{WeightConfig, WeightConfigImpl};

    use eternum::models::movable::{Movable, MovableTrait};
    use eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner, OwnerTrait};
    use eternum::models::position::CoordTrait;
    use eternum::models::position::{Position, Coord, PositionTrait, Direction};
    use eternum::models::quantity::{Quantity, QuantityTrait};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use eternum::models::resources::{ResourceTransferLock, ResourceTransferLockTrait};
    use eternum::models::stamina::Stamina;
    use eternum::models::structure::{Structure, StructureTrait, StructureCategory};
    use eternum::models::weight::Weight;
    use eternum::models::{
        combat::{
            Army, ArmyTrait, Troops, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait,
            Battle, BattleImpl, BattleTrait, BattleSide, Protector, Protectee, ProtecteeTrait,
            BattleHealthTrait, BattleEscrowImpl
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
        /// Creates an army entity.
        /// 
        /// This function allows the creation of two types of armies:
        /// 
        /// 1. **Defensive Army**:
        ///     - Assigned to protect a specific structure.
        ///     - Cannot move or hold resources.
        ///     - Ensures the safety of the structure and any resources it holds.
        ///     - Only one defensive army is allowed per structure. Attempting to create more than one for
        ///       the same structure will result in an error.
        ///     - Specify `is_defensive_army` as `true` to create this type of army.
        /// 
        /// 2. **Roaming Army**:
        ///     - Can move freely across the map.
        ///     - Engages in exploring hexes, joining battles, and pillaging structures.
        ///     - There is no limit to the number of roaming armies you can create.
        ///     - Specify `is_defensive_army` as `false` to create this type of army.
        /// 
        /// # Preconditions:
        /// - The caller must own the entity identified by `army_owner_id`.
        ///
        /// # Arguments:
        /// * `world` - The game world dispatcher interface.
        /// * `army_owner_id` - The id of the army owner entity.
        /// * `is_defensive_army` - A boolean flag indicating the type of army to create.
        ///
        /// # Returns:
        /// * `u128` - The id of the created army.
        ///
        /// # Implementation Details:
        /// - The function checks if the caller owns the entity specified by `army_owner_id`.
        /// - It generates a unique ID for the new army and sets common properties such as entity ownership,
        ///   initial position, and default battle settings.
        /// - For a defensive army:
        ///     - Validates that the owning entity is a structure.
        ///     - Ensures no other defensive army is assigned to the structure.
        ///     - Assigns the new army to protect the structure.
        ///     - Locks the army from resource transfer operations.
        /// - For a roaming army:
        ///     - Configures the army's movement speed and carrying capacity based on game world settings.
        ///     - Initializes the army's stamina for map exploration.
        fn army_create(
            world: IWorldDispatcher, army_owner_id: u128, is_defensive_army: bool
        ) -> u128 {
            // ensure caller owns entity that will own army
            get!(world, army_owner_id, EntityOwner).assert_caller_owner(world);

            // set common army models
            let mut army_id: u128 = world.uuid().into();
            let army_owner_position: Position = get!(world, army_owner_id, Position);
            set!(
                world,
                (
                    Army {
                        entity_id: army_id,
                        troops: Default::default(),
                        battle_id: 0,
                        battle_side: Default::default()
                    },
                    EntityOwner { entity_id: army_id, entity_owner_id: army_owner_id },
                    Owner { entity_id: army_id, address: starknet::get_caller_address() },
                    Position {
                        entity_id: army_id, x: army_owner_position.x, y: army_owner_position.y
                    }
                )
            );

            if is_defensive_army {
                // Defensive armies can only be assigned as structure protectors
                get!(world, army_owner_id, Structure).assert_is_structure();

                // ensure the structure does not have a defensive army 
                let mut structure_protector: Protector = get!(world, army_owner_id, Protector);
                structure_protector.assert_has_no_defensive_army();

                // add army as structure protector
                structure_protector.army_id = army_id;
                set!(
                    world, (structure_protector, Protectee { army_id, protectee_id: army_owner_id })
                );

                // stop the army from sending or receiving resources
                set!(
                    world,
                    (ResourceTransferLock { entity_id: army_id, release_at: BoundedInt::max() })
                );
            } else {
                // set the army's speed and capacity
                let army_sec_per_km = get!(world, (WORLD_CONFIG_ID, ARMY_ENTITY_TYPE), SpeedConfig)
                    .sec_per_km;
                let army_carry_capacity: CapacityConfig = CapacityConfigImpl::get(
                    world, ARMY_ENTITY_TYPE
                );
                set!(
                    world,
                    (
                        Movable {
                            entity_id: army_id,
                            sec_per_km: army_sec_per_km,
                            blocked: false,
                            round_trip: false,
                            start_coord_x: army_owner_position.x,
                            start_coord_y: army_owner_position.y,
                            intermediate_coord_x: 0,
                            intermediate_coord_y: 0,
                        },
                        Capacity {
                            entity_id: army_id, weight_gram: army_carry_capacity.weight_gram
                        }
                    )
                );

                // create stamina for map exploration
                let armies_tick_config = TickImpl::get_armies_tick_config(world);
                set!(
                    world,
                    (Stamina {
                        entity_id: army_id,
                        amount: 0,
                        last_refill_tick: armies_tick_config.current() - 1
                    })
                )
            }
            army_id
        }

        /// Purchases and adds troops to an existing army entity.
        ///
        /// # Preconditions:
        /// - The caller must own the entity identified by `payer_id`.
        /// - The payer and the army must be at the same position. E.g
        ///   if the payer is a structure (a realm for example), the army 
        ///   must be at the realm in order to add troops to its army.
        ///
        /// # Arguments:
        /// * `world` - The game world dispatcher interface.
        /// * `army_id` - The id of the army entity receiving the troops.
        /// * `payer_id` - The id of the entity paying for the troops.
        /// * `troops` - The troops to be purchased and added to the army.
        ///
        /// # Implementation Details:
        /// 1. **Ownership and Position Check**:
        ///     - Ensures the caller owns the `payer_id` entity.
        ///     - Verifies that `payer_id` and `army_id` are at the same location.
        /// 2. **Payment Processing**:
        ///     - Deducts the appropriate resources from `payer_id`.
        /// 3. **Army Update**:
        ///     - Adds the purchased troops to the army.
        ///     - Updates the army's health and troop quantity.
        ///
        /// # Returns:
        /// * None
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

        /// This function facilitates the transfer of troops from one army to another.
        ///
        /// # Preconditions:
        /// - The caller must own both the `from_army_id` and `to_army_id` entities.
        /// - The `from_army_id` and `to_army_id` entities must be at the same location.
        ///
        /// # Arguments:
        /// * `world` - The game world dispatcher interface.
        /// * `from_army_id` - The id of the army transferring troops.
        /// * `to_army_id` - The id of the army receiving troops.
        /// * `troops` - The troops to be transferred.
        ///
        /// # Implementation Details:
        /// 1. **Ownership and Position Check**:
        ///     - Ensures the caller owns both `from_army_id` and `to_army_id`.
        ///     - Verifies that `from_army_id` and `to_army_id` are at the same location.
        /// 2. **Troop Transfer**:
        ///     - Decreases the number of troops, health, and quantity in the `from_army_id`.
        ///     - Increases the number of troops, health, and quantity in the `to_army_id`.
        /// 
        /// # Note:
        ///     It is important to know that you can only transfer troops with full health from 
        ///     one army to another. e.g if the first army has 
        ///     `FirstArmy(100 knights, 100 paladins,100 crossbowman)` but it went to battle and now
        ///     it only has half it's initial `Health`` left, you'll only be able to transfer half, i.e 
        ///     `(100 knights, 100 paladins,100 crossbowman)``, to the SecondArmy.
        ///
        /// # Returns:
        /// * None
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
            let troop_full_health = troops.full_health(troop_config);
            if troop_full_health > from_army_health.current {
                panic!("not enough health for troops");
            }
            from_army_health.decrease_by(troop_full_health);
            from_army_health.lifetime -= (troop_full_health);
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
            to_army_health.increase_by(troop_full_health);
            set!(world, (to_army_health));

            // increase to army quantity
            let mut to_army_quantity: Quantity = get!(world, to_army_id, Quantity);
            to_army_quantity.value += troops.count().into();
            set!(world, (to_army_quantity));
        }


        /// Initiates a battle between an attacking and defending army within the game world.
        ///
        /// # Preconditions:
        /// - The caller must own the `attacking_army_id`.
        /// - Both `attacking_army_id` and `defending_army_id` must not already be in battle.
        /// - Both armies must be at the same location.
        ///
        /// # Arguments:
        /// * `world` - The game world dispatcher interface.
        /// * `attacking_army_id` - The id of the attacking army.
        /// * `defending_army_id` - The id of the defending army.
        ///
        /// # Implementation Details:
        /// 1. **Initial Checks and Setup**:
        ///     - Verifies the attacking and defending armies are not already in battle.
        ///     - Ensures the caller owns the attacking army.
        ///     - Checks that both armies are at the same position.
        /// 2. **Battle ID Assignment**:
        ///     - Generates a new unique battle ID and assigns it to both armies.
        ///     - Sets the battle side for each army (attack or defense).
        /// 3. **Movement Blocking**:
        ///     - Blocks movement for both armies if they are not protecting any entity.
        /// 4. **Battle Creation**:
        ///     - Initializes the battle with both armies and their respective health.
        ///     - Deposits resources protected by the armies into the battle escrow.
        ///     - Sets the battle position and resets the battle delta.
        ///
        /// # Note:
        ///     This is how the deposited resources are escrowed. Whenever any army joins a 
        ///     battle, the items which they are securing are locked from being transferred 
        ///     and they will also not be able to receive resources. 
        /// 
        ///     For example;
        ///     - If an army is not a defensive army, the items they are securing are the items they hold. 
        ///       So we lock these items. We also transfer the items into the battle escrow pool
        ///      
        ///     - If an army is a defensive army, the items they are securing are the items owned 
        ///       by the structure they are protecting and so these items are lock. The structures can't
        ///       receive or send any resources.
        /// 
        ///       However, for a couple of reasons, we do not transfer resources owned by structures into the
        ///       escrow pool because if a structure is producing resources, it would be impossible to 
        ///       continously donate resources into the battle escrow. Even if it was possible, it would take
        ///       too much gas.
        /// 
        ///       Instead, what we do is that we just lock up the structure's resources and if you win the battle
        ///       against the structure, you can continuously pillage it without being sent back to your base.
        ///             
        /// # Returns:
        /// * None
        fn battle_start(world: IWorldDispatcher, attacking_army_id: u128, defending_army_id: u128) {
            let mut attacking_army: Army = get!(world, attacking_army_id, Army);
            attacking_army.assert_not_in_battle();

            get!(world, attacking_army_id, EntityOwner).assert_caller_owner(world);

            let mut defending_army: Army = get!(world, defending_army_id, Army);
            defending_army.assert_not_in_battle();

            let attacking_army_position: Position = get!(world, attacking_army_id, Position);
            let defending_army_position: Position = get!(world, defending_army_id, Position);
            attacking_army_position.assert_same_location(defending_army_position.into());

            let battle_id: u128 = world.uuid().into();
            attacking_army.battle_id = battle_id;
            attacking_army.battle_side = BattleSide::Attack;
            set!(world, (attacking_army));

            defending_army.battle_id = battle_id;
            defending_army.battle_side = BattleSide::Defence;
            set!(world, (defending_army));

            let mut attacking_army_protectee: Protectee = get!(world, attacking_army_id, Protectee);
            let mut attacking_army_movable: Movable = get!(world, attacking_army_id, Movable);
            if attacking_army_protectee.is_none() {
                attacking_army_movable.assert_moveable();
                attacking_army_movable.blocked = true;
                set!(world, (attacking_army_movable));
            }

            let mut defending_army_protectee: Protectee = get!(world, defending_army_id, Protectee);
            let mut defending_army_movable: Movable = get!(world, defending_army_id, Movable);
            if defending_army_protectee.is_none() {
                defending_army_movable.assert_moveable();
                defending_army_movable.blocked = true;
                set!(world, (defending_army_movable));
            }

            // create battle 
            let attacking_army_health: Health = get!(world, attacking_army_id, Health);
            let defending_army_health: Health = get!(world, defending_army_id, Health);
            defending_army_health.assert_alive("Army");

            let mut battle: Battle = Default::default();
            battle.entity_id = battle_id;
            battle.attack_army = attacking_army.into();
            battle.defence_army = defending_army.into();
            battle.attackers_resources_escrow_id = world.uuid().into();
            battle.defenders_resources_escrow_id = world.uuid().into();
            battle.attack_army_health = attacking_army_health.into();
            battle.defence_army_health = defending_army_health.into();
            battle.last_updated = starknet::get_block_timestamp();

            // deposit resources protected by armies into battle escrow pots/boxes
            battle.deposit_balance(world, attacking_army, attacking_army_protectee);
            battle.deposit_balance(world, defending_army, defending_army_protectee);

            // set battle position 
            let mut battle_position: Position = Default::default();
            battle_position.x = attacking_army_position.x;
            battle_position.y = attacking_army_position.y;
            set!(world, (battle_position));

            let troop_config = TroopConfigImpl::get(world);
            battle.reset_delta(troop_config);
            set!(world, (battle));
        }


        /// Joins an existing battle with the specified army, assigning it to a specific side in the battle.
        ///
        /// # Preconditions:
        /// - The specified `battle_side` must be either `BattleSide::Attack` or `BattleSide::Defence`.
        /// - The caller must own the `army_id`.
        /// - The battle must be ongoing.
        /// - The army must not already be in a battle.
        /// - The army must be at the same location as the battle.
        ///
        /// # Arguments:
        /// * `world` - The game world dispatcher interface.
        /// * `battle_id` - The id of the battle to join.
        /// * `battle_side` - The side to join in the battle (attack or defense).
        /// * `army_id` - The id of the army joining the battle.
        ///
        /// # Implementation Details:
        /// 1. **Initial Checks and Setup**:
        ///     - Ensures the specified `battle_side` is valid (not `BattleSide::None`).
        ///     - Verifies the caller owns the army.
        /// 2. **Battle State Update**:
        ///     - Updates the battle state before performing any other actions.
        ///     - Ensures the battle is still ongoing.
        /// 3. **Army Validations**:
        ///     - Ensures the army is not already in a battle.
        ///     - Checks that the army is at the same location as the battle.
        /// 4. **Army Assignment to Battle**:
        ///     - Assigns the battle ID and side to the army.
        ///     - Blocks the army's movement if it is not protecting any entity.
        /// 5. **Resource Locking**:
        ///     - Locks the resources protected by the army, transferring them to the battle escrow if necessary.
        /// 6. **Troop and Health Addition**:
        ///     - Adds the army's troops and health to the respective side in the battle.
        ///     - Updates the battle state with the new army's contributions.
        /// 7. **Battle Delta Reset**:
        ///     - Resets the battle delta with the troop configuration.
        ///
        /// # Note:
        ///     When an army joins a battle, its protected resources are locked and transferred 
        ///     to the battle escrow. This ensures that resources cannot be transferred in or out 
        ///     of the army while it is engaged in the battle. 
        ///     
        ///     For defensive armies, the resources owned by the structures they protect are locked 
        ///     but not transferred into the escrow to avoid continuous donation issues.
        ///     see. the `battle_start` function for more info on this
        ///
        /// # Returns:
        /// * None
        fn battle_join(
            world: IWorldDispatcher, battle_id: u128, battle_side: BattleSide, army_id: u128
        ) {
            assert!(battle_side != BattleSide::None, "choose correct battle side");

            // ensure caller owns army
            get!(world, army_id, EntityOwner).assert_caller_owner(world);

            // update battle state before any other actions
            let mut battle: Battle = get!(world, battle_id, Battle);
            battle.update_state();

            // ensure battle is still ongoing
            assert!(battle.duration_left > 0, "Battle has ended");

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
            battle.deposit_balance(world, caller_army, caller_army_protectee);

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
            battle.reset_delta(troop_config);
            set!(world, (battle));
        }


        fn battle_leave(world: IWorldDispatcher, battle_id: u128, army_id: u128) {
            // ensure caller owns army
            get!(world, army_id, EntityOwner).assert_caller_owner(world);

            // update battle state before any other actions
            let mut battle: Battle = get!(world, battle_id, Battle);
            battle.update_state();

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

            // withdraw resources stuck in battle
            battle.withdraw_balance_and_reward(world, caller_army, caller_army_protectee);

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
            set!(world, (caller_army_health));

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
            battle.reset_delta(troop_config);
            set!(world, (battle));

            caller_army.battle_id = 0;
            caller_army.battle_side = BattleSide::None;
            set!(world, (caller_army));
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
            let structure_army_id: u128 = get!(world, structure_id, Protector).army_id;
            if structure_army_id.is_non_zero() {
                // ensure structure army is in battle
                let structure_army_health: Health = get!(world, structure_army_id, Health);
                if structure_army_health.is_alive() {
                    let structure_army: Army = get!(world, structure_army_id, Army);
                    structure_army.assert_in_battle();

                    // update battle state before checking battle winner
                    let mut battle: Battle = get!(world, structure_army.battle_id, Battle);
                    battle.update_state();
                    set!(world, (battle));

                    // ensure structure lost the battle
                    assert!(structure_army.battle_side != battle.winner(), "structure army won");
                }
            }

            // pass ownership of structure to claimer
            let mut structure_owner_entity: EntityOwner = get!(world, structure_id, EntityOwner);
            let claimer_army_owner_entity_id: u128 = get!(world, army_id, EntityOwner)
                .entity_owner_id;
            structure_owner_entity.entity_owner_id = claimer_army_owner_entity_id;
            set!(world, (structure_owner_entity));
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

            let troop_config = TroopConfigImpl::get(world);

            // get structure army and health

            let structure_army_id: u128 = get!(world, structure_id, Protector).army_id;
            assert!(structure_army_id != army_id, "self attack");

            let mut structure_army: Army = Default::default();
            let mut structure_army_health: Health = Default::default();
            let mut can_pillage_only_once = false;
            if structure_army_id.is_non_zero() {
                structure_army_health = get!(world, structure_army_id, Health);
                structure_army = get!(world, structure_army_id, Army);
                if structure_army.battle_id.is_non_zero() {
                    // structure army is in battle

                    // force pillager to join battle if it hasnt ended
                    let mut battle: Battle = get!(world, structure_army.battle_id, Battle);
                    battle.update_state();
                    set!(world, (battle));

                    if !battle.has_ended() {
                        panic!("Join the battle or wait for it to end");
                    }

                    // battle has ended
                    //
                    // allow continuous pillage when structure army loses battle
                    let battle_has_winner = !(battle.winner() == BattleSide::None);
                    let structure_army_didnt_win = structure_army.battle_side != battle.winner();
                    if battle_has_winner && structure_army_didnt_win {
                        can_pillage_only_once = false;
                    } else {
                        can_pillage_only_once = true;
                    }
                } else {
                    // structure army is not in battle
                    if structure_army_health.current.is_non_zero() {
                        // structure army is alive
                        can_pillage_only_once = true;
                    }
                }
            }

            // a percentage of it's full strength depending on structure army's health
            let mut structure_army_strength = structure_army.troops.full_strength(troop_config)
                * structure_army_health.percentage_left()
                / PercentageValueImpl::_100().into();
            structure_army_strength += 1;

            // a percentage of it's full strength depending on structure army's health
            let mut attacking_army_health: Health = get!(world, army_id, Health);
            attacking_army_health.assert_alive("Army");

            let mut attacking_army_strength = attacking_army.troops.full_strength(troop_config)
                * attacking_army_health.percentage_left()
                / PercentageValueImpl::_100().into();
            attacking_army_strength += 1;

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
                    / (attacking_army_strength + structure_army_strength);

                // choose x random resource to be stolen
                let mut chosen_resource_types: Span<u8> = random::choices(
                    get_resources_without_earthenshards(),
                    get_resources_without_earthenshards_probs(),
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

            // Deduct health from both armies if structure has an army
            if structure_army_health.is_alive() {
                let mut mock_battle: Battle = Battle {
                    entity_id: 45,
                    attack_army: attacking_army.into(),
                    defence_army: structure_army.into(),
                    attackers_resources_escrow_id: 0,
                    defenders_resources_escrow_id: 0,
                    attack_army_health: attacking_army_health.into(),
                    defence_army_health: structure_army_health.into(),
                    attack_delta: 0,
                    defence_delta: 0,
                    last_updated: starknet::get_block_timestamp(),
                    duration_left: 0
                };
                mock_battle.reset_delta(troop_config);

                attacking_army_health
                    .decrease_by(
                        ((mock_battle.defence_delta.into() * mock_battle.duration_left.into())
                            / troop_config.pillage_health_divisor.into())
                    );
                set!(world, (attacking_army_health));

                structure_army_health
                    .decrease_by(
                        ((mock_battle.attack_delta.into() * mock_battle.duration_left.into())
                            / troop_config.pillage_health_divisor.into())
                    );
                set!(world, (structure_army_health));
            }

            let army_owner_entity_id: u128 = get!(world, army_id, EntityOwner).entity_owner_id;
            if can_pillage_only_once {
                // army goes home if structure cant be continuously pillage
                let army_owner_position: Position = get!(world, army_owner_entity_id, Position);
                let army_movable: Movable = get!(world, army_id, Movable);

                InternalTravelSystemsImpl::travel(
                    world, army_id, army_movable, army_position.into(), army_owner_position.into()
                );
            }

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

