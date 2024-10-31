use eternum::alias::ID;
use eternum::models::{combat::{Troops, Battle, BattleSide}};

#[starknet::interface]
trait ITroopContract<TContractState> {
    /// Creates an army entity.
    ///
    /// This function allows the creation of two types of armies:
    ///
    /// 1. **Defensive Army**:
    ///     - Assigned to protect a specific structure.
    ///     - Cannot move or hold resources.
    ///     - Ensures the safety of the structure and any resources it holds.
    ///     - Only one defensive army is allowed per structure. Attempting to create more than one
    ///     for
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
    /// - It generates a unique ID for the new army and sets common properties such as entity
    /// ownership,
    ///   initial position, and default battle settings.
    /// - For a defensive army:
    ///     - Validates that the owning entity is a structure.
    ///     - Ensures no other defensive army is assigned to the structure.
    ///     - Assigns the new army to protect the structure.
    ///     - Locks the army from resource transfer operations.
    /// - For a roaming army:
    ///     - Configures the army's movement speed and carrying capacity based on game world
    ///     settings.
    ///     - Initializes the army's stamina for map exploration.
    fn army_create(ref world: IWorldDispatcher, army_owner_id: ID, is_defensive_army: bool) -> ID;

    /// Delete an army
    /// - army must not be a defensive army
    /// - army must be dead (in battle or otherwise)
    ///
    fn army_delete(ref world: IWorldDispatcher, army_id: ID);
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
    fn army_buy_troops(ref world: IWorldDispatcher, army_id: ID, payer_id: ID, troops: Troops);

    /// Transfer of troops from one army to another.
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
    fn army_merge_troops(ref world: IWorldDispatcher, from_army_id: ID, to_army_id: ID, troops: Troops);
}


#[dojo::contract]
mod troop_systems {
    use core::num::traits::Bounded;
    use eternum::alias::ID;
    use eternum::constants::{ResourceTypes};
    use eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE};
    use eternum::models::buildings::{BuildingCategory, BuildingQuantityv2,};
    use eternum::models::capacity::{CapacityCategory};
    use eternum::models::combat::{ProtectorCustomTrait};
    use eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigCustomImpl, TroopConfigCustomTrait,
        BattleConfigCustomTrait, CapacityConfig, CapacityConfigCustomImpl, CapacityConfigCategory
    };
    use eternum::models::movable::{Movable, MovableCustomTrait};

    use eternum::models::owner::{EntityOwner, EntityOwnerCustomImpl, EntityOwnerCustomTrait, Owner, OwnerCustomTrait};
    use eternum::models::position::CoordTrait;
    use eternum::models::position::{Position, Coord, PositionCustomTrait, Direction};
    use eternum::models::quantity::{Quantity, QuantityTracker};
    use eternum::models::realm::Realm;
    use eternum::models::resources::{ResourceCustomImpl, ResourceCost};
    use eternum::models::resources::{ResourceTransferLock, ResourceTransferLockCustomTrait};

    use eternum::models::season::SeasonImpl;
    use eternum::models::stamina::{Stamina, StaminaCustomTrait};
    use eternum::models::structure::{Structure, StructureCustomTrait, StructureCategory};
    use eternum::models::weight::Weight;

    use eternum::models::{
        combat::{
            Army, ArmyCustomTrait, Troops, TroopsImpl, TroopsTrait, Health, HealthCustomImpl, HealthCustomTrait, Battle,
            BattleCustomImpl, BattleCustomTrait, Protector, Protectee, ProtecteeCustomTrait, BattleHealthCustomTrait,
            AttackingArmyQuantityTrackerCustomTrait, AttackingArmyQuantityTrackerCustomImpl,
        },
    };
    use eternum::systems::combat::contracts::battle_systems::battle_systems::{InternalBattleImpl};

    use super::ITroopContract;


    #[abi(embed_v0)]
    impl TroopContractImpl of ITroopContract<ContractState> {
        fn army_create(ref world: IWorldDispatcher, army_owner_id: ID, is_defensive_army: bool) -> ID {
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns entity that will own army
            get!(world, army_owner_id, EntityOwner).assert_caller_owner(world);

            // ensure owner is a structure
            let structure: Structure = get!(world, army_owner_id, Structure);
            structure.assert_is_structure();

            let army_id = if is_defensive_army {
                InternalTroopImpl::create_defensive_army(world, army_owner_id, starknet::get_caller_address())
            } else {
                // ensure only realms can have attacking armies
                assert!(structure.category == StructureCategory::Realm, "only realms can have attacking armies");
                InternalTroopImpl::create_attacking_army(world, army_owner_id, starknet::get_caller_address())
            };

            army_id
        }

        fn army_delete(ref world: IWorldDispatcher, army_id: ID) {
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns the entity paying
            let mut entity_owner: EntityOwner = get!(world, army_id, EntityOwner);
            entity_owner.assert_caller_owner(world);

            // ensure army is dead
            let mut army: Army = get!(world, army_id, Army);
            if army.is_in_battle() {
                let mut battle = BattleCustomImpl::get(world, army.battle_id);
                InternalBattleImpl::leave_battle_if_ended(world, ref battle, ref army);
                set!(world, (battle));
            }

            // ensure number of troops is 0
            assert!(army.troops.count().is_zero(), "Army has troops");

            // ensure army is not a defensive army
            let army_protectee: Protectee = get!(world, army_id, Protectee);
            assert!(army_protectee.is_none(), "Army is a defensive army");

            // delete army
            InternalTroopImpl::delete_army(world, ref entity_owner, ref army);
        }


        fn army_buy_troops(ref world: IWorldDispatcher, army_id: ID, payer_id: ID, mut troops: Troops) {
            SeasonImpl::assert_season_is_not_over(world);

            // ensure troop values are normalized
            troops.assert_normalized();

            // ensure caller owns the entity paying
            get!(world, payer_id, EntityOwner).assert_caller_owner(world);

            // ensure payer and army are at the same position
            let payer_position: Position = get!(world, payer_id, Position);
            let army_position: Position = get!(world, army_id, Position);
            payer_position.assert_same_location(army_position.into());

            // make payment for troops
            let knight_resource = ResourceCustomImpl::get(world, (payer_id, ResourceTypes::KNIGHT));
            let paladin_resource = ResourceCustomImpl::get(world, (payer_id, ResourceTypes::PALADIN));
            let crossbowman_resource = ResourceCustomImpl::get(world, (payer_id, ResourceTypes::CROSSBOWMAN));
            let (mut knight_resource, mut paladin_resource, mut crossbowman_resource) = troops
                .purchase(payer_id, (knight_resource, paladin_resource, crossbowman_resource));
            knight_resource.save(ref world);
            paladin_resource.save(ref world);
            crossbowman_resource.save(ref world);

            let mut army: Army = get!(world, army_id, Army);
            if army.is_in_battle() {
                let mut battle = BattleCustomImpl::get(world, army.battle_id);
                if battle.has_ended() {
                    // if battle has ended, leave the battle
                    InternalBattleImpl::leave_battle(world, ref battle, ref army);
                } else {
                    // if battle has not ended, add the troops to the battle
                    let troop_config = TroopConfigCustomImpl::get(world);
                    let troops_full_health = troops.full_health(troop_config);

                    battle.join(army.battle_side, troops, troops_full_health);
                    battle.reset_delta(troop_config);
                    set!(world, (battle));
                }
            }

            InternalTroopImpl::add_troops_to_army(world, troops, army_id);
        }


        fn army_merge_troops(ref world: IWorldDispatcher, from_army_id: ID, to_army_id: ID, troops: Troops,) {
            SeasonImpl::assert_season_is_not_over(world);

            // ensure troop values are normalized
            troops.assert_normalized();

            // ensure caller owns from army
            let mut from_army_owner: EntityOwner = get!(world, from_army_id, EntityOwner);
            from_army_owner.assert_caller_owner(world);

            // ensure from and to armies are at the same position
            let from_army_position: Position = get!(world, from_army_id, Position);
            let to_army_position: Position = get!(world, to_army_id, Position);
            from_army_position.assert_same_location(to_army_position.into());

            let troop_config = TroopConfigCustomImpl::get(world);

            // decrease from army troops
            let mut from_army: Army = get!(world, from_army_id, Army);
            if from_army.is_in_battle() {
                let mut battle = BattleCustomImpl::get(world, from_army.battle_id);
                InternalBattleImpl::leave_battle_if_ended(world, ref battle, ref from_army);
            }
            from_army.assert_not_in_battle();
            from_army.troops.deduct(troops);
            from_army.troops.assert_normalized();

            let from_army_weight: Weight = get!(world, from_army_id, Weight);

            // decrease from army  quantity
            let mut from_army_quantity: Quantity = get!(world, from_army_id, Quantity);
            from_army_quantity.value -= troops.count().into();

            let capacity_config = get!(world, CapacityConfigCategory::Army, CapacityConfig);
            capacity_config.assert_can_carry(from_army_quantity, from_army_weight);

            // decrease from army health
            let mut from_army_health: Health = get!(world, from_army_id, Health);
            let troop_full_health = troops.full_health(troop_config);
            if troop_full_health > from_army_health.current {
                panic!("not enough health for troops");
            }
            from_army_health.decrease_current_by(troop_full_health);
            from_army_health.lifetime -= (troop_full_health);

            set!(world, (from_army, from_army_health, from_army_quantity));

            // delete army if troop count is 0 and if it's not a defensive army
            let protectee = get!(world, from_army_id, Protectee);
            if from_army.troops.count().is_zero() && protectee.is_none() {
                InternalTroopImpl::delete_army(world, ref from_army_owner, ref from_army);
            }

            // increase to army troops
            let mut to_army: Army = get!(world, to_army_id, Army);
            if to_army.is_in_battle() {
                let mut battle = BattleCustomImpl::get(world, to_army.battle_id);
                InternalBattleImpl::leave_battle_if_ended(world, ref battle, ref to_army);
            }

            to_army.assert_not_in_battle();

            InternalTroopImpl::add_troops_to_army(world, troops, to_army_id);
        }
    }


    #[generate_trait]
    pub impl InternalTroopImpl of InternalBattleTrait {
        fn create_attacking_army(
            world: IWorldDispatcher, army_owner_id: ID, owner_address: starknet::ContractAddress
        ) -> ID {
            let army_id = Self::create_base_army(world, army_owner_id, owner_address);

            // ensure owner has enough military buildings to create army
            let owner_armies_key: felt252 = AttackingArmyQuantityTrackerCustomImpl::key(army_owner_id);
            let mut owner_armies_quantity: QuantityTracker = get!(world, owner_armies_key, QuantityTracker);

            let troop_config = TroopConfigCustomImpl::get(world);
            if owner_armies_quantity.count >= troop_config.army_free_per_structure.into() {
                let archery_range_building_count = get!(
                    world, (army_owner_id, BuildingCategory::ArcheryRange), BuildingQuantityv2
                )
                    .value;
                let barracks_building_count = get!(
                    world, (army_owner_id, BuildingCategory::Barracks), BuildingQuantityv2
                )
                    .value;
                let stables_building_count = get!(world, (army_owner_id, BuildingCategory::Stable), BuildingQuantityv2)
                    .value;
                let total_military_building_count = stables_building_count
                    + archery_range_building_count
                    + barracks_building_count;
                let total_allowed_armies = troop_config.army_free_per_structure.into()
                    + (troop_config.army_extra_per_building.into() * total_military_building_count);
                assert!(
                    owner_armies_quantity.count < total_allowed_armies.into(),
                    "not enough military buildings to support new army"
                );

                // ensure army quantity is less than hard maximum
                assert!(
                    owner_armies_quantity.count < troop_config.army_max_per_structure.into(),
                    "reached hard limit of armies per structure"
                );
            }
            // increment army count
            owner_armies_quantity.count += 1;
            set!(world, (owner_armies_quantity));

            // set the army's speed and capacity
            let army_sec_per_km = get!(world, (WORLD_CONFIG_ID, ARMY_ENTITY_TYPE), SpeedConfig).sec_per_km;
            let army_owner_position: Position = get!(world, army_owner_id, Position);

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
                    CapacityCategory { entity_id: army_id, category: CapacityConfigCategory::Army },
                )
            );

            // create stamina for map exploration
            let armies_tick_config = TickImpl::get_armies_tick_config(ref world);
            set!(
                world, (Stamina { entity_id: army_id, amount: 0, last_refill_tick: armies_tick_config.current() - 1 })
            );

            army_id
        }

        fn create_defensive_army(
            world: IWorldDispatcher, army_owner_id: ID, owner_address: starknet::ContractAddress
        ) -> ID {
            let army_id = Self::create_base_army(world, army_owner_id, owner_address);

            // Defensive armies can only be assigned as structure protectors
            get!(world, army_owner_id, Structure).assert_is_structure();

            // ensure the structure does not have a defensive army
            let mut structure_protector: Protector = get!(world, army_owner_id, Protector);
            structure_protector.assert_has_no_defensive_army();

            // add army as structure protector
            structure_protector.army_id = army_id;
            set!(world, (structure_protector, Protectee { army_id, protectee_id: army_owner_id }));

            // stop the army from sending or receiving resources
            set!(
                world,
                (ResourceTransferLock {
                    entity_id: army_id, start_at: starknet::get_block_timestamp(), release_at: Bounded::MAX
                })
            );
            army_id
        }

        fn create_base_army(
            world: IWorldDispatcher, army_owner_id: ID, owner_address: starknet::ContractAddress
        ) -> ID {
            // ensure army owner is a structure
            get!(world, army_owner_id, Structure).assert_is_structure();

            // create army
            let mut army_id: ID = world.dispatcher.uuid();
            let army_owner_position: Position = get!(world, army_owner_id, Position);
            set!(
                world,
                (
                    Army {
                        entity_id: army_id, troops: Default::default(), battle_id: 0, battle_side: Default::default()
                    },
                    EntityOwner { entity_id: army_id, entity_owner_id: army_owner_id },
                    Position { entity_id: army_id, x: army_owner_position.x, y: army_owner_position.y }
                )
            );
            army_id
        }

        fn add_troops_to_army(world: IWorldDispatcher, troops: Troops, army_id: ID) {
            // increase troops number
            let mut army: Army = get!(world, army_id, Army);
            army.troops.add(troops);
            set!(world, (army));

            let army_not_defensive = get!(world, army_id, Protectee).is_none();
            if army_not_defensive {
                let troop_config = TroopConfigCustomImpl::get(world);
                army.assert_within_limit(troop_config);
            }

            // increase army health
            let mut army_health: Health = get!(world, army_id, Health);
            army_health.increase_by(troops.full_health(TroopConfigCustomImpl::get(world)));
            set!(world, (army_health));

            // set troop quantity (for capacity calculation)
            let mut army_quantity: Quantity = get!(world, army_id, Quantity);
            army_quantity.value += troops.count().into();
            set!(world, (army_quantity));
        }

        fn delete_army(world: IWorldDispatcher, ref entity_owner: EntityOwner, ref army: Army) {
            // decrement attack army count
            let owner_armies_key: felt252 = AttackingArmyQuantityTrackerCustomImpl::key(entity_owner.entity_owner_id);
            let mut owner_armies_quantity: QuantityTracker = get!(world, owner_armies_key, QuantityTracker);
            owner_armies_quantity.count -= 1;
            set!(world, (owner_armies_quantity));

            let protectee: Protectee = get!(world, army.entity_id, Protectee);
            if (protectee.protectee_id != 0) {
                delete!(world, (protectee));
            }

            // delete army by resetting components connected to army
            let (owner, position, quantity, health, stamina, resource_transfer_lock, movable, capacity) = get!(
                world,
                army.entity_id,
                (Owner, Position, Quantity, Health, Stamina, ResourceTransferLock, Movable, CapacityCategory)
            );
            delete!(
                world,
                (
                    army,
                    entity_owner,
                    owner,
                    position,
                    quantity,
                    health,
                    stamina,
                    resource_transfer_lock,
                    movable,
                    capacity
                )
            );
        }
    }
}
