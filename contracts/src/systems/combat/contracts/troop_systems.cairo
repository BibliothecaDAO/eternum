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
    fn army_create(ref self: TContractState, army_owner_id: ID, is_defensive_army: bool) -> ID;

    /// Delete an army
    /// - army must not be a defensive army
    /// - army must be dead (in battle or otherwise)
    ///
    fn army_delete(ref self: TContractState, army_id: ID);
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
    fn army_buy_troops(ref self: TContractState, army_id: ID, payer_id: ID, troops: Troops);

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
    fn army_merge_troops(ref self: TContractState, from_army_id: ID, to_army_id: ID, troops: Troops);
}


#[dojo::contract]
mod troop_systems {
    use core::num::traits::Bounded;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
    use eternum::alias::ID;
    use eternum::constants::{ResourceTypes};
    use eternum::constants::{WORLD_CONFIG_ID, ARMY_ENTITY_TYPE, DEFAULT_NS};
    use eternum::models::buildings::{BuildingCategory, BuildingQuantityv2,};
    use eternum::models::capacity::{CapacityCategory};
    use eternum::models::combat::{ProtectorCustomTrait};
    use eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigCustomImpl, TroopConfigCustomTrait,
        BattleConfigCustomTrait, CapacityConfig, CapacityConfigCustomImpl, CapacityConfigCategory, StaminaRefillConfig
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
        fn army_create(ref self: ContractState, army_owner_id: ID, is_defensive_army: bool) -> ID {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns entity that will own army
            let entity_owner: EntityOwner = world.read_model(army_owner_id);
            entity_owner.assert_caller_owner(world);

            // ensure owner is a structure
            let structure: Structure = world.read_model(army_owner_id);
            structure.assert_is_structure();

            let army_id = if is_defensive_army {
                InternalTroopImpl::create_defensive_army(ref world, army_owner_id)
            } else {
                // ensure only realms can have attacking armies
                assert!(structure.category == StructureCategory::Realm, "only realms can have attacking armies");
                InternalTroopImpl::create_attacking_army(ref world, army_owner_id)
            };

            army_id
        }

        fn army_delete(ref self: ContractState, army_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns the entity paying
            let mut entity_owner: EntityOwner = world.read_model(army_id);
            entity_owner.assert_caller_owner(world);

            // ensure army is dead
            let mut army: Army = world.read_model(army_id);
            if army.is_in_battle() {
                let mut battle = BattleCustomImpl::get(world, army.battle_id);
                InternalBattleImpl::leave_battle_if_ended(ref world, ref battle, ref army);
                world.write_model(@battle);
            }

            // ensure number of troops is 0
            assert!(army.troops.count().is_zero(), "Army has troops");

            // ensure army is not a defensive army
            let army_protectee: Protectee = world.read_model(army_id);
            assert!(army_protectee.is_none(), "Army is a defensive army");

            // delete army
            InternalTroopImpl::delete_army(ref world, ref entity_owner, ref army);
        }


        fn army_buy_troops(ref self: ContractState, army_id: ID, payer_id: ID, mut troops: Troops) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure troop values are normalized
            troops.assert_normalized();

            // ensure caller owns the entity paying
            let entity_owner: EntityOwner = world.read_model(payer_id);
            entity_owner.assert_caller_owner(world);

            // ensure payer and army are at the same position
            let payer_position: Position = world.read_model(payer_id);
            let army_position: Position = world.read_model(army_id);
            payer_position.assert_same_location(army_position.into());

            // make payment for troops
            let knight_resource = ResourceCustomImpl::get(ref world, (payer_id, ResourceTypes::KNIGHT));
            let paladin_resource = ResourceCustomImpl::get(ref world, (payer_id, ResourceTypes::PALADIN));
            let crossbowman_resource = ResourceCustomImpl::get(ref world, (payer_id, ResourceTypes::CROSSBOWMAN));
            let (mut knight_resource, mut paladin_resource, mut crossbowman_resource) = troops
                .purchase(payer_id, (knight_resource, paladin_resource, crossbowman_resource));
            knight_resource.save(ref world);
            paladin_resource.save(ref world);
            crossbowman_resource.save(ref world);

            let mut army: Army = world.read_model(army_id);
            if army.is_in_battle() {
                let mut battle = BattleCustomImpl::get(world, army.battle_id);
                if battle.has_ended() {
                    // if battle has ended, leave the battle
                    InternalBattleImpl::leave_battle(ref world, ref battle, ref army);
                } else {
                    // if battle has not ended, add the troops to the battle
                    let troop_config = TroopConfigCustomImpl::get(world);
                    let troops_full_health = troops.full_health(troop_config);

                    battle.join(army.battle_side, troops, troops_full_health);
                    battle.reset_delta(troop_config);
                    world.write_model(@battle);
                }
            }

            InternalTroopImpl::add_troops_to_army(ref world, troops, army_id);
        }


        fn army_merge_troops(ref self: ContractState, from_army_id: ID, to_army_id: ID, troops: Troops,) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure troop values are normalized
            troops.assert_normalized();

            // ensure caller owns from army
            let mut from_army_owner: EntityOwner = world.read_model(from_army_id);
            from_army_owner.assert_caller_owner(world);

            // ensure from and to armies are at the same position
            let from_army_position: Position = world.read_model(from_army_id);
            let to_army_position: Position = world.read_model(to_army_id);
            from_army_position.assert_same_location(to_army_position.into());

            let troop_config = TroopConfigCustomImpl::get(world);

            // decrease from army troops
            let mut from_army: Army = world.read_model(from_army_id);
            if from_army.is_in_battle() {
                let mut battle = BattleCustomImpl::get(world, from_army.battle_id);
                InternalBattleImpl::leave_battle_if_ended(ref world, ref battle, ref from_army);
            }
            from_army.assert_not_in_battle();
            from_army.troops.deduct(troops);
            from_army.troops.assert_normalized();

            let from_army_weight: Weight = world.read_model(from_army_id);

            // decrease from army  quantity
            let mut from_army_quantity: Quantity = world.read_model(from_army_id);
            from_army_quantity.value -= troops.count().into();

            let capacity_config = world.read_model(CapacityConfigCategory::Army);
            capacity_config.assert_can_carry(from_army_quantity, from_army_weight);

            // decrease from army health
            let mut from_army_health: Health = world.read_model(from_army_id);
            let troop_full_health = troops.full_health(troop_config);
            if troop_full_health > from_army_health.current {
                panic!("not enough health for troops");
            }
            from_army_health.decrease_current_by(troop_full_health);
            from_army_health.lifetime -= (troop_full_health);

            world.write_model(@from_army);
            world.write_model(@from_army_health);
            world.write_model(@from_army_quantity);

            // delete army if troop count is 0 and if it's not a defensive army
            let protectee: Protectee = world.read_model(from_army_id);
            if from_army.troops.count().is_zero() && protectee.is_none() {
                InternalTroopImpl::delete_army(ref world, ref from_army_owner, ref from_army);
            }

            // increase to army troops
            let mut to_army: Army = world.read_model(to_army_id);
            if to_army.is_in_battle() {
                let mut battle = BattleCustomImpl::get(world, to_army.battle_id);
                InternalBattleImpl::leave_battle_if_ended(ref world, ref battle, ref to_army);
            }

            to_army.assert_not_in_battle();

            InternalTroopImpl::add_troops_to_army(ref world, troops, to_army_id);
        }
    }


    #[generate_trait]
    pub impl InternalTroopImpl of InternalBattleTrait {
        fn create_attacking_army(ref world: WorldStorage, army_owner_id: ID) -> ID {
            let army_id = Self::create_base_army(ref world, army_owner_id);

            // ensure owner has enough military buildings to create army
            let owner_armies_key: felt252 = AttackingArmyQuantityTrackerCustomImpl::key(army_owner_id);
            let mut owner_armies_quantity: QuantityTracker = world.read_model(owner_armies_key);

            let troop_config = TroopConfigCustomImpl::get(world);
            if owner_armies_quantity.count >= troop_config.army_free_per_structure.into() {
                let archery_range_building_count: BuildingQuantityv2 = world
                    .read_model((army_owner_id, BuildingCategory::ArcheryRange));
                let archery_range_building_count = archery_range_building_count.value;

                let barracks_building_count: BuildingQuantityv2 = world
                    .read_model((army_owner_id, BuildingCategory::Barracks));
                let barracks_building_count = barracks_building_count.value;

                let stables_building_count: BuildingQuantityv2 = world
                    .read_model((army_owner_id, BuildingCategory::Stable));
                let stables_building_count = stables_building_count.value;

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
            world.write_model(@owner_armies_quantity);

            // set the army's speed and capacity
            let army_sec_per_km: SpeedConfig = world.read_model((WORLD_CONFIG_ID, ARMY_ENTITY_TYPE));
            let army_sec_per_km = army_sec_per_km.sec_per_km;
            let army_owner_position: Position = world.read_model(army_owner_id);

            world
                .write_model(
                    @Movable {
                        entity_id: army_id,
                        sec_per_km: army_sec_per_km,
                        blocked: false,
                        round_trip: false,
                        start_coord_x: army_owner_position.x,
                        start_coord_y: army_owner_position.y,
                        intermediate_coord_x: 0,
                        intermediate_coord_y: 0,
                    }
                );

            world.write_model(@CapacityCategory { entity_id: army_id, category: CapacityConfigCategory::Army });

            // create stamina for map exploration
            let armies_tick_config = TickImpl::get_armies_tick_config(ref world);
            let stamina_refill_config: StaminaRefillConfig = world.read_model(WORLD_CONFIG_ID);

            world
                .write_model(
                    @Stamina {
                        entity_id: army_id,
                        amount: 0,
                        last_refill_tick: (armies_tick_config.current()
                            - stamina_refill_config.start_boost_tick_count.into())
                    }
                );

            army_id
        }

        fn create_defensive_army(ref world: WorldStorage, army_owner_id: ID) -> ID {
            let army_id = Self::create_base_army(ref world, army_owner_id);

            // Defensive armies can only be assigned as structure protectors
            let structure: Structure = world.read_model(army_owner_id);
            structure.assert_is_structure();

            // ensure the structure does not have a defensive army
            let mut structure_protector: Protector = world.read_model(army_owner_id);
            structure_protector.assert_has_no_defensive_army();

            // add army as structure protector
            structure_protector.army_id = army_id;
            world.write_model(@structure_protector);
            world.write_model(@Protectee { army_id, protectee_id: army_owner_id });
            // stop the army from sending or receiving resources
            world
                .write_model(
                    @ResourceTransferLock {
                        entity_id: army_id, start_at: starknet::get_block_timestamp(), release_at: Bounded::MAX
                    }
                );

            army_id
        }

        fn create_base_army(ref world: WorldStorage, army_owner_id: ID) -> ID {
            // ensure army owner is a structure
            let structure: Structure = world.read_model(army_owner_id);
            structure.assert_is_structure();

            // create army
            let mut army_id: ID = world.dispatcher.uuid();
            let army_owner_position: Position = world.read_model(army_owner_id);
            world
                .write_model(
                    @Army {
                        entity_id: army_id, troops: Default::default(), battle_id: 0, battle_side: Default::default()
                    }
                );
            world.write_model(@EntityOwner { entity_id: army_id, entity_owner_id: army_owner_id });
            world.write_model(@Position { entity_id: army_id, x: army_owner_position.x, y: army_owner_position.y });

            army_id
        }

        fn add_troops_to_army(ref world: WorldStorage, troops: Troops, army_id: ID) {
            // increase troops number
            let mut army: Army = world.read_model(army_id);
            army.troops.add(troops);
            world.write_model(@army);

            let army_protectee: Protectee = world.read_model(army_id);
            let army_not_defensive = army_protectee.is_none();
            if army_not_defensive {
                let troop_config = TroopConfigCustomImpl::get(world);
                army.assert_within_limit(troop_config);
            }

            // increase army health
            let mut army_health: Health = world.read_model(army_id);
            army_health.increase_by(troops.full_health(TroopConfigCustomImpl::get(world)));
            world.write_model(@army_health);

            // set troop quantity (for capacity calculation)
            let mut army_quantity: Quantity = world.read_model(army_id);
            army_quantity.value += troops.count().into();
            world.write_model(@army_quantity);
        }

        fn delete_army(ref world: WorldStorage, ref entity_owner: EntityOwner, ref army: Army) {
            // decrement attack army count
            let owner_armies_key: felt252 = AttackingArmyQuantityTrackerCustomImpl::key(entity_owner.entity_owner_id);
            let mut owner_armies_quantity: QuantityTracker = world.read_model(owner_armies_key);
            owner_armies_quantity.count -= 1;
            world.write_model(@owner_armies_quantity);

            let protectee: Protectee = world.read_model(army.entity_id);
            if (protectee.protectee_id != 0) {
                world.erase_model(@protectee);
            }

            // delete army by resetting components connected to army
            let owner: Owner = world.read_model(army.entity_id);
            let position: Position = world.read_model(army.entity_id);
            let quantity: Quantity = world.read_model(army.entity_id);
            let health: Health = world.read_model(army.entity_id);
            let stamina: Stamina = world.read_model(army.entity_id);
            let resource_transfer_lock: ResourceTransferLock = world.read_model(army.entity_id);
            let movable: Movable = world.read_model(army.entity_id);
            let capacity: CapacityCategory = world.read_model(army.entity_id);

            world.erase_model(@army);
            world.erase_model(@entity_owner);
            world.erase_model(@owner);
            world.erase_model(@position);
            world.erase_model(@quantity);
            world.erase_model(@health);
            world.erase_model(@stamina);
            world.erase_model(@resource_transfer_lock);
            world.erase_model(@movable);
            world.erase_model(@capacity);
        }
    }
}
