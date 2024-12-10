use achievement::store::{Store, StoreTrait};
use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
use s0_eternum::alias::ID;
use s0_eternum::models::config::{TroopConfig, TroopConfigImpl, TroopConfigTrait};


use s0_eternum::models::movable::{Movable, MovableTrait};
use s0_eternum::models::quantity::{Quantity};
use s0_eternum::models::{
    combat::{
        Army, ArmyTrait, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait, BattleImpl, BattleTrait, Protector,
        Protectee, ProtecteeTrait, BattleHealthTrait, BattleEscrowImpl,
    },
};
use s0_eternum::models::{combat::{Troops, Battle, BattleSide}};
use s0_eternum::utils::tasks::index::{Task, TaskTrait};

#[starknet::interface]
trait IBattleContract<T> {
    /// Initiates a battle between an attacking and defending army within the game world.
    ///
    /// # Preconditions:
    /// - The caller must own the `attacking_army_id`.
    /// - Both `attacking_army_id` and `defending_army_id` must not already be in battle.
    ///   If the attacked army is in a battle that has ended, it is automatically forced
    ///   to leave the battle.
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
    ///     - Ensure that both armies are alive
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
    ///     - If an army is not a defensive army, the items they are securing are the items they
    ///     hold.
    ///       So we lock these items. We also transfer the items into the battle escrow pool
    ///
    ///     - If an army is a defensive army, the items they are securing are the items owned
    ///       by the structure they are protecting and so these items are lock. The structures can't
    ///       receive or send any resources.
    ///
    ///       However, for a couple of reasons, we do not transfer resources owned by structures
    ///       into the escrow pool because if a structure is producing resources, it would be
    ///       impossible to continously donate resources into the battle escrow. Even if it was
    ///       possible, it would take too much gas.
    ///
    ///       Instead, what we do is that we just lock up the structure's resources and if you win
    ///       the battle against the structure, you can continuously pillage it without being sent
    ///       back to your base.
    ///
    /// # Returns:
    /// * None
    fn battle_start(ref self: T, attacking_army_id: ID, defending_army_id: ID) -> ID;

    /// Force start a battle between two armies
    ///
    /// # Preconditions:
    /// - The caller must own the `defending_army_id`.
    /// - the army must be on the defensive side
    /// - The battle must not have already started
    ///
    /// # Arguments:
    /// * `world` - The game world dispatcher interface.
    /// * `battle_id` - The id of the battle to force start.
    /// * `defending_army_id` - The id of the defending army.
    ///
    fn battle_force_start(ref self: T, battle_id: ID, defending_army_id: ID);

    /// Join an existing battle with the specified army, assigning it to a specific side in the
    /// battle.
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
    ///     - Ensures both armies are alive
    ///     - Ensures the army is not already in a battle.
    ///     - Checks that the army is at the same location as the battle.
    /// 4. **Army Assignment to Battle**:
    ///     - Assigns the battle ID and side to the army.
    ///     - Blocks the army's movement if it is not protecting any entity.
    /// 5. **Resource Locking**:
    ///     - Locks the resources protected by the army, transferring them to the battle escrow if
    ///     necessary.
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
    fn battle_join(ref self: T, battle_id: ID, battle_side: BattleSide, army_id: ID);

    /// Allows an army to leave an ongoing battle, releasing its resources and restoring its
    /// mobility (if it was previously mobile).
    ///
    /// # Preconditions:
    /// - The caller must own the `army_id`.
    /// - The battle ID must match the current battle of the army.
    /// - The army must have a valid battle side (`BattleSide::Attack` or `BattleSide::Defence`).
    ///
    /// # Arguments:
    /// * `world` - The game world dispatcher interface.
    /// * `battle_id` - The id of the battle from which the army is leaving.
    /// * `army_id` - The id of the army leaving the battle.
    ///
    /// # Implementation Details:
    /// 1. **Initial Validations**:
    ///     - Verifies the caller owns the army.
    ///     - Updates the state of the battle before any actions.
    /// 2. **Battle Validation**:
    ///     - Ensures the battle ID matches the army's current battle ID.
    ///     - Checks that the army is participating in a valid battle side.
    /// 3. **Army Restoration**:
    ///     - Restores mobility for the army if it is not protecting any entity.
    ///     - Withdraws any resources stuck in the battle escrow and any rewards due.
    /// 4. **Resource and Troop Management**:
    ///     - Deducts the army's original troops and health from the battle army.
    ///     - Adjusts the army's health based on its remaining battle contribution.
    /// 5. **Battle State Update**:
    ///     - Updates the battle with the adjusted troop and health values.
    ///     - Resets the battle delta
    /// 6. **Final Army State Update**:
    ///     - Clears the army's battle ID and battle side, indicating it is no longer in battle.
    ///
    /// # Notes on Reward:
    ///     -   If you leave in the middle of a battle that doesn't yet have a decided outcome,
    ///         you lose all the resources deposited in the battle escrow.
    ///
    ///         Because Structures` rescources are not deposited into escrow, and so we can't make
    ///         them lose all their resources, structure defensive armies CAN NOT leave a battle
    ///         until it is done. There must be a winner, loser or it must have been a draw
    ///
    ///     -   If you leave after a battle has ended;
    ///             a. if you won, you leave with your initial resources and you also take a portion
    ///                 of the resources deposited in escrow by the opposing team based on the
    ///                 number of troops you contributed to the battle.
    ///
    ///                 This method has the downside that a big army can just swoop in, close to the
    ///                 end of the battle, and take the giant share of the loot. But such is life.
    ///
    ///                 If you won against a structure, you can pillage them to infinity.
    ///
    ///             b. if you lost, you lose all the resources deposited in escrow
    ///             c. if the battle was drawn, you can leave with your deposited resources
    ///
    /// # Returns:
    /// * None
    fn battle_leave(ref self: T, battle_id: ID, army_id: ID);

    /// Claims ownership of a non realm structure by an army after meeting all necessary conditions.
    ///
    /// # Preconditions:
    /// - The caller must own the `army_id`.
    /// - The entity being claimed (`structure_id`) must be a valid structure.
    /// - The structure must not be a realm (StructureCategory::Realm).
    /// - The claiming army (`army_id`) must not be currently in battle.
    /// - The claiming army must be at the same location as the structure.
    /// - If the structure has a defensive army, that army must be dead (in battle or otherwise).
    ///
    /// # Arguments:
    /// * `world` - The game world dispatcher interface.
    /// * `army_id` - The id of the army claiming ownership of the structure.
    /// * `structure_id` - The id of the structure being claimed.
    ///
    /// # Implementation Details:
    /// 1. **Initial Validations**:
    ///     - Verifies the caller owns the army (`army_id`).
    ///     - Ensures the entity being claimed is indeed a structure.
    ///     - Checks that the structure is not a realm, which cannot be claimed.
    /// 2. **Location and Battle Checks**:
    ///     - Confirms that the claiming army is not currently in battle.
    ///     - Verifies that the claiming army is at the same location as the structure.
    ///     - Checks if the structure has a defensive army (`structure_army_id`).
    ///     - If the structure has a defensive army, ensures that army is dead.
    /// 4. **Ownership Transfer**:
    ///     - Transfers ownership of the structure to the claiming army.
    ///
    /// # Note:
    ///     - This function is used to transfer ownership of non-realm structures.
    ///     - Realms cannot be claimed due to their unique status in the game.
    ///
    /// # Returns:
    /// * None
    fn battle_claim(ref self: T, army_id: ID, structure_id: ID);

    /// Resolve any battle that has ended
    fn battle_resolve(ref self: T, battle_id: ID, army_id: ID);
}


#[starknet::interface]
trait IBattlePillageContract<T> {
    /// Pillage a structure.
    ///
    /// # Preconditions:
    /// - The caller must own the `army_id`.
    /// - The entity being pillaged (`structure_id`) must be a valid structure.
    /// - The attacking army (`army_id`) must not be currently in battle.
    /// - The attacking army must be at the same location as the structure.
    /// - If the structure has a protecting army in battle, the attacking army must join the battle
    ///   or wait till the structure's defensive army is done with the battle.
    ///
    /// # Arguments:
    /// * `world` - The game world dispatcher interface.
    /// * `army_id` - The id of the attacking army.
    /// * `structure_id` - The id of the structure being pillaged.
    ///
    /// # Implementation Details:
    /// 1. **Initial Validations**:
    ///     - Verifies the caller owns the attacking army (`army_id`).
    ///     - Ensures the entity being pillaged is indeed a structure.
    ///     - Checks that the attacking army is not currently in battle.
    ///     - Confirms that the attacking army is at the same location as the structure.
    /// 2. **Protection Check**:
    ///     - Determines if the structure is protected by another army (`structure_army_id`).
    ///     - If the protecting army is in battle, ensure that outcome is finalized.
    /// 3. **Pillage Calculation**:
    ///     - Calculates the strength of the attacking and defending armies based on their troops
    ///     and health.
    ///     - Uses a probabilistic model to determine if the pillaging attempt is successful.
    ///     - Randomly selects resources from the structure to pillage, considering army capacity
    ///     and resource availability.
    /// 4. **Outcome Effects**:
    ///     - If the pillage attempt is successful, transfers resources from the structure to the
    ///     attacking army.
    ///     - Optionally destroys a building within the structure based on specific conditions.
    ///     - Deducts health from both armies involved in the battle.
    ///         If any army is dead, no health is deducted.
    ///
    /// 5. **Final Actions**:
    ///     - Handles the movement of the attacking army back to its owner after a successful
    ///     pillage,
    ///       if continuous pillaging is not possible.
    ///     - Emits a `BattlePillageData` to signify the outcome of the pillage action.
    ///
    /// # Note:
    ///     - Continous pillaging simply means you are allowed to pillage without being sent back
    ///       to base if the structure army is dead.
    ///
    /// # Returns:
    /// * None
    fn battle_pillage(ref self: T, army_id: ID, structure_id: ID);
}

#[starknet::interface]
trait IBattleUtilsContract<T> {
    fn leave_battle(ref self: T, battle: Battle, army: Army) -> (Battle, Army);
    fn leave_battle_if_ended(ref self: T, battle: Battle, army: Army) -> (Battle, Army);
}

#[dojo::contract]
mod battle_systems {
    use achievement::store::{Store, StoreTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;

    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::{
        ResourceTypes, ErrorMessages, get_resources_without_earthenshards, get_resources_without_earthenshards_probs
    };
    use s0_eternum::constants::{MAX_PILLAGE_TRIAL_COUNT, RESOURCE_PRECISION, DEFAULT_NS};
    use s0_eternum::models::buildings::{Building, BuildingImpl, BuildingCategory, BuildingQuantityv2,};
    use s0_eternum::models::combat::{BattleEscrowTrait, ProtectorTrait};
    use s0_eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigImpl, TroopConfigTrait, BattleConfig,
        BattleConfigImpl, BattleConfigTrait, CapacityConfig, CapacityConfigImpl, CapacityConfigCategory, VRFConfigImpl
    };
    use s0_eternum::models::config::{WeightConfig, WeightConfigImpl};
    use s0_eternum::models::event::{
        EventType, EventData, BattleStartData, BattleJoinData, BattleLeaveData, BattleClaimData, BattlePillageData
    };

    use s0_eternum::models::movable::{Movable, MovableTrait};
    use s0_eternum::models::name::{AddressName};
    use s0_eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner, OwnerTrait};
    use s0_eternum::models::position::CoordTrait;
    use s0_eternum::models::position::{Position, Coord, PositionTrait, Direction};
    use s0_eternum::models::quantity::{Quantity, QuantityTracker};
    use s0_eternum::models::realm::Realm;
    use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use s0_eternum::models::resources::{ResourceTransferLock, ResourceTransferLockTrait};

    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::stamina::{Stamina, StaminaTrait};
    use s0_eternum::models::structure::{Structure, StructureTrait, StructureCategory};
    use s0_eternum::models::weight::Weight;

    use s0_eternum::models::{
        combat::{
            Army, ArmyTrait, Troops, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait, Battle, BattleImpl,
            BattleTrait, BattleSide, Protector, Protectee, ProtecteeTrait, BattleHealthTrait, BattleEscrowImpl,
            AttackingArmyQuantityTrackerTrait, AttackingArmyQuantityTrackerImpl, BattleStructureImpl
        },
    };
    use s0_eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};

    use s0_eternum::utils::math::{PercentageValueImpl, PercentageImpl};
    use s0_eternum::utils::math::{min, max};
    use s0_eternum::utils::random;
    use s0_eternum::utils::tasks::index::{Task, TaskTrait};

    use super::{IBattleContract, IBattleUtilsContractDispatcher, IBattleUtilsContractDispatcherTrait};


    #[abi(embed_v0)]
    impl BattleContractImpl of IBattleContract<ContractState> {
        fn battle_start(ref self: ContractState, attacking_army_id: ID, defending_army_id: ID) -> ID {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let mut attacking_army: Army = world.read_model(attacking_army_id);
            attacking_army.assert_not_in_battle();

            let attacking_army_entity_owner: EntityOwner = world.read_model(attacking_army_id);
            attacking_army_entity_owner.assert_caller_owner(world);

            let armies_tick_config = TickImpl::get_armies_tick_config(ref world);
            let battle_config = BattleConfigImpl::get(world);

            let mut defending_army: Army = world.read_model(defending_army_id);
            let defending_army_entity_owner: EntityOwner = world.read_model(defending_army_id);
            let defending_army_owner_entity_id = defending_army_entity_owner.entity_owner_id;

            let defending_army_owner_structure: Structure = world.read_model(defending_army_owner_entity_id);
            if defending_army_owner_structure.category != StructureCategory::None {
                defending_army_owner_structure.assert_no_initial_attack_immunity(battle_config, armies_tick_config);
            }

            let attacking_army_owner_entity_id = attacking_army_entity_owner.entity_owner_id;
            let attacking_army_owner_structure: Structure = world.read_model(attacking_army_owner_entity_id);
            if attacking_army_owner_structure.category != StructureCategory::None {
                attacking_army_owner_structure.assert_no_initial_attack_immunity(battle_config, armies_tick_config);
            }

            if defending_army.battle_id.is_non_zero() {
                // defending army appears to be in battle
                // so we want to update the defending army's battle status
                // to see if the battle has ended. if it has ended, then the
                // army will be removed from the battle
                let mut defending_army_battle = BattleImpl::get(world, defending_army.battle_id);
                let (contract_address, _) = world.dns(@"battle_utils_systems").unwrap();
                let battle_utils_systems = IBattleUtilsContractDispatcher { contract_address };
                let (r_defending_army_battle, r_defending_army) = battle_utils_systems
                    .leave_battle_if_ended(defending_army_battle, defending_army);

                defending_army = r_defending_army;
                defending_army_battle = r_defending_army_battle;
            }

            // ensure defending army is not in battle
            defending_army.assert_not_in_battle();

            let troop_config = TroopConfigImpl::get(world);
            let attacking_army_health: Health = world.read_model(attacking_army_id);
            let defending_army_health: Health = world.read_model(defending_army_id);
            // ensure health invariant checks pass
            assert!(
                attacking_army_health.current == attacking_army.troops.full_health(troop_config),
                "attacking army health sanity check fail"
            );
            assert!(
                defending_army_health.current == defending_army.troops.full_health(troop_config),
                "defending army health sanity check fail"
            );

            // ensure both armies are alive
            attacking_army_health.assert_alive("your army");
            defending_army_health.assert_alive("the army you are attacking");

            // ensure both armies are in the same location
            let attacking_army_position: Position = world.read_model(attacking_army_id);
            let defending_army_position: Position = world.read_model(defending_army_id);
            attacking_army_position.assert_same_location(defending_army_position.into());

            let battle_id: ID = world.dispatcher.uuid();
            attacking_army.battle_id = battle_id;
            attacking_army.battle_side = BattleSide::Attack;
            world.write_model(@attacking_army);

            defending_army.battle_id = battle_id;
            defending_army.battle_side = BattleSide::Defence;
            world.write_model(@defending_army);

            let mut attacking_army_protectee: Protectee = world.read_model(attacking_army_id);
            let mut attacking_army_movable: Movable = world.read_model(attacking_army_id);
            if attacking_army_protectee.is_none() {
                attacking_army_movable.assert_moveable();
                attacking_army_movable.blocked = true;
                world.write_model(@attacking_army_movable);
            }

            let mut defending_army_protectee: Protectee = world.read_model(defending_army_id);
            let mut defending_army_movable: Movable = world.read_model(defending_army_id);
            if defending_army_protectee.is_none() {
                defending_army_movable.assert_moveable();
                defending_army_movable.blocked = true;
                world.write_model(@defending_army_movable);
            }

            // create battle
            let now = starknet::get_block_timestamp();
            let mut battle: Battle = Default::default();
            battle.entity_id = battle_id;
            battle.attack_army = attacking_army.into();
            battle.attack_army_lifetime = attacking_army.into();
            battle.defence_army = defending_army.into();
            battle.defence_army_lifetime = defending_army.into();
            battle.attackers_resources_escrow_id = world.dispatcher.uuid();
            battle.defenders_resources_escrow_id = world.dispatcher.uuid();
            battle.attack_army_health = attacking_army_health.into();
            battle.defence_army_health = defending_army_health.into();
            battle.last_updated = now;
            battle.start_at = now;
            // add battle start time delay when a structure is being attacked.
            // if the structure is the attacker, the battle starts immediately.
            if BattleStructureImpl::should_seige(defending_army_owner_structure.category) {
                if defending_army_protectee.is_other() {
                    battle.start_at = now + battle_config.battle_delay_seconds;
                }
            }

            // deposit resources protected by armies into battle escrow pots/boxes
            battle.deposit_balance(ref world, attacking_army, attacking_army_protectee);
            battle.deposit_balance(ref world, defending_army, defending_army_protectee);

            // set battle position
            let mut battle_position: Position = Default::default();
            battle_position.entity_id = battle_id;
            battle_position.x = attacking_army_position.x;
            battle_position.y = attacking_army_position.y;
            world.write_model(@battle_position);

            battle.reset_delta(troop_config);

            world.write_model(@battle);

            let id = world.dispatcher.uuid();

            let attacker = starknet::get_caller_address();
            let defender_entity_owner: EntityOwner = world.read_model(defending_army_id);
            let defender_owner: Owner = world.read_model(defender_entity_owner.entity_owner_id);
            let defender = defender_owner.address;

            let protectee: Protectee = world.read_model(defending_army_id);
            let defender_structure: Structure = world.read_model(protectee.protectee_id);
            let attacker_address_name: AddressName = world.read_model(starknet::get_caller_address());
            let defender_address_name: AddressName = world.read_model(defender);
            world
                .emit_event(
                    @BattleStartData {
                        id,
                        event_id: EventType::BattleStart,
                        battle_entity_id: battle_id,
                        attacker,
                        attacker_name: attacker_address_name.name,
                        attacker_army_entity_id: attacking_army_id,
                        defender_name: defender_address_name.name,
                        defender,
                        defender_army_entity_id: defending_army_id,
                        duration_left: battle.duration_left,
                        x: battle_position.x,
                        y: battle_position.y,
                        structure_type: defender_structure.category,
                        timestamp: starknet::get_block_timestamp(),
                    }
                );
            battle_id
        }

        fn battle_force_start(ref self: ContractState, battle_id: ID, defending_army_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            let defender_entity_owner: EntityOwner = world.read_model(defending_army_id);
            defender_entity_owner.assert_caller_owner(world);

            let mut defending_army: Army = world.read_model(defending_army_id);
            assert!(defending_army.battle_id == battle_id, "army is not in battle");
            assert!(defending_army.battle_side == BattleSide::Defence, "army is not on defensive");

            let mut defending_army_protectee: Protectee = world.read_model(defending_army_id);
            let defending_army_owner_structure: Structure = world.read_model(defending_army_protectee.protectee_id);
            // these conditions below should not be possible unless there is a bug in `battle_start`
            assert!(defending_army_protectee.is_other(), "only structures can force start");
            assert!(
                BattleStructureImpl::should_seige(defending_army_owner_structure.category),
                "this structure cannot force start battle because there is no delay"
            );

            let now = starknet::get_block_timestamp();
            let mut battle = BattleImpl::get(world, battle_id);
            assert!(now < battle.start_at, "Battle already started");

            // update battle
            battle.start_at = now;
            battle.deposit_lock_immediately(ref world, defending_army_protectee);
            world.write_model(@battle);
        }

        fn battle_join(ref self: ContractState, battle_id: ID, battle_side: BattleSide, army_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            assert!(battle_side != BattleSide::None, "choose correct battle side");

            // ensure caller owns army
            let caller_entity_owner: EntityOwner = world.read_model(army_id);
            caller_entity_owner.assert_caller_owner(world);

            // ensure battle has not ended
            let mut battle = BattleImpl::get(world, battle_id);
            assert!(!battle.has_ended(), "Battle has ended");

            // ensure caller army is not in battle
            let mut caller_army: Army = world.read_model(army_id);
            caller_army.assert_not_in_battle();

            // ensure caller army is not dead
            let mut caller_army_health: Health = world.read_model(army_id);
            caller_army_health.assert_alive("Your army");

            // caller army health sanity check
            let troop_config = TroopConfigImpl::get(world);
            assert!(
                caller_army_health.current == caller_army.troops.full_health(troop_config),
                "caller health sanity check fail"
            );

            // ensure caller army is at battle location
            let caller_army_position: Position = world.read_model(caller_army.entity_id);
            let battle_position: Position = world.read_model(battle.entity_id);
            caller_army_position.assert_same_location(battle_position.into());

            caller_army.battle_id = battle_id;
            caller_army.battle_side = battle_side;
            world.write_model(@caller_army);

            // make caller army immovable
            let mut caller_army_protectee: Protectee = world.read_model(army_id);
            let mut caller_army_movable: Movable = world.read_model(army_id);
            if caller_army_protectee.is_none() {
                caller_army_movable.assert_moveable();
                caller_army_movable.blocked = true;
                world.write_model(@caller_army_movable);
            }

            // lock resources being protected by army
            battle.deposit_balance(ref world, caller_army, caller_army_protectee);

            // add troops to battle army troops
            let troop_config = TroopConfigImpl::get(world);
            battle.join(battle_side, caller_army.troops, caller_army_health.current);
            battle.reset_delta(troop_config);
            world.write_model(@battle);

            let id = world.dispatcher.uuid();
            let joiner = starknet::get_caller_address();
            let joiner_name: AddressName = world.read_model(joiner);
            world
                .emit_event(
                    @BattleJoinData {
                        id,
                        event_id: EventType::BattleJoin,
                        battle_entity_id: battle_id,
                        joiner,
                        joiner_name: joiner_name.name,
                        joiner_army_entity_id: army_id,
                        joiner_side: battle_side,
                        duration_left: battle.duration_left,
                        x: battle_position.x,
                        y: battle_position.y,
                        timestamp: starknet::get_block_timestamp(),
                    }
                );
        }


        fn battle_resolve(ref self: ContractState, battle_id: ID, army_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure battle exists and matches army
            let mut army: Army = world.read_model(army_id);
            assert!(army.battle_id == battle_id, "wrong battle id");
            assert!(army.battle_side != BattleSide::None, "wrong battle side");

            // leave battle if it has ended
            let mut battle = BattleImpl::get(world, battle_id);
            let (contract_address, _) = world.dns(@"battle_utils_systems").unwrap();
            let battle_utils_systems = IBattleUtilsContractDispatcher { contract_address };
            battle_utils_systems.leave_battle_if_ended(battle, army);
        }


        fn battle_leave(ref self: ContractState, battle_id: ID, army_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns army
            let caller_entity_owner: EntityOwner = world.read_model(army_id);
            caller_entity_owner.assert_caller_owner(world);

            // ensure caller is in the correct battle
            let mut caller_army: Army = world.read_model(army_id);
            assert!(caller_army.battle_id == battle_id, "wrong battle id");
            assert!(caller_army.battle_side != BattleSide::None, "wrong battle side");

            // get battle
            let mut battle = BattleImpl::get(world, battle_id);

            // check if army left early
            let army_left_early = !battle.has_ended();

            // leave battle
            let (contract_address, _) = world.dns(@"battle_utils_systems").unwrap();
            let battle_utils_systems = IBattleUtilsContractDispatcher { contract_address };
            let (r_battle, r_caller_army) = battle_utils_systems.leave_battle(battle, caller_army);
            battle = r_battle;
            caller_army = r_caller_army;

            // slash army if battle was not concluded before they left
            let leaver = starknet::get_caller_address();
            let mut army: Army = world.read_model(army_id);
            if army_left_early {
                let troop_config = TroopConfigImpl::get(world);
                let troops_deducted = Troops {
                    knight_count: (army.troops.knight_count * troop_config.battle_leave_slash_num.into())
                        / troop_config.battle_leave_slash_denom.into(),
                    paladin_count: (army.troops.paladin_count * troop_config.battle_leave_slash_num.into())
                        / troop_config.battle_leave_slash_denom.into(),
                    crossbowman_count: (army.troops.crossbowman_count * troop_config.battle_leave_slash_num.into())
                        / troop_config.battle_leave_slash_denom.into(),
                };
                army.troops.deduct(troops_deducted);
                army.troops.normalize_counts();

                let army_health = Health {
                    entity_id: army_id,
                    current: army.troops.full_health(troop_config),
                    lifetime: army.troops.full_health(troop_config)
                };

                let army_quantity = Quantity { entity_id: army_id, value: army.troops.count().into() };
                world.write_model(@army);
                world.write_model(@army_health);
                world.write_model(@army_quantity);
            }
        }


        fn battle_claim(ref self: ContractState, army_id: ID, structure_id: ID) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns army
            let caller_entity_owner: EntityOwner = world.read_model(army_id);
            caller_entity_owner.assert_caller_owner(world);

            // ensure entity being claimed is a structure
            let structure: Structure = world.read_model(structure_id);
            structure.assert_is_structure();

            let armies_tick_config = TickImpl::get_armies_tick_config(ref world);
            let battle_config = BattleConfigImpl::get(world);
            structure.assert_no_initial_attack_immunity(battle_config, armies_tick_config);

            // ensure claimer army is not in battle
            let claimer_army: Army = world.read_model(army_id);
            claimer_army.assert_not_in_battle();

            // ensure army is at structure position
            let claimer_army_position: Position = world.read_model(army_id);
            let structure_position: Position = world.read_model(structure_id);
            claimer_army_position.assert_same_location(structure_position.into());

            // ensure structure has no army protecting it
            let claimer = starknet::get_caller_address();
            let structure_protector: Protector = world.read_model(structure_id);
            let structure_army_id: ID = structure_protector.army_id;
            if structure_army_id.is_non_zero() {
                let mut structure_army: Army = world.read_model(structure_army_id);
                if structure_army.is_in_battle() {
                    let mut battle = BattleImpl::get(world, structure_army.battle_id);

                    let (contract_address, _) = world.dns(@"battle_utils_systems").unwrap();
                    let battle_utils_systems = IBattleUtilsContractDispatcher { contract_address };
                    let (r_battle, r_structure_army) = battle_utils_systems
                        .leave_battle_if_ended(battle, structure_army);
                    battle = r_battle;
                    structure_army = r_structure_army;
                }

                // ensure structure army is dead
                let structure_army_health: Health = world.read_model(structure_army_id);
                assert!(!structure_army_health.is_alive(), "can only claim when structure army is dead");
            }

            // transfer structure ownership to claimer
            let mut structure_owner: Owner = world.read_model(structure_id);
            let claimee_address = structure_owner.address;
            let claimee_address_name: AddressName = world.read_model(claimee_address);

            structure_owner.transfer(claimer);
            world.write_model(@structure_owner);

            // emit battle claim event
            let structure_position: Position = world.read_model(structure_id);
            let claimer_name: AddressName = world.read_model(claimer);
            world
                .emit_event(
                    @BattleClaimData {
                        id: world.dispatcher.uuid(),
                        event_id: EventType::BattleClaim,
                        structure_entity_id: structure_id,
                        claimer,
                        claimer_name: claimer_name.name,
                        claimer_army_entity_id: army_id,
                        claimee_address,
                        claimee_name: claimee_address_name.name,
                        x: structure_position.x,
                        y: structure_position.y,
                        structure_type: structure.category,
                        timestamp: starknet::get_block_timestamp(),
                    }
                );

            // [Achievement] Claim either a realm, bank or fragment mine
            match structure.category {
                StructureCategory::Realm => {
                    let player_id: felt252 = claimer.into();
                    let task_id: felt252 = Task::Conqueror.identifier();
                    let mut store = StoreTrait::new(world);
                    store.progress(player_id, task_id, 1, starknet::get_block_timestamp());
                },
                StructureCategory::Bank => {
                    let player_id: felt252 = claimer.into();
                    let task_id: felt252 = Task::Ruler.identifier();
                    let mut store = StoreTrait::new(world);
                    store.progress(player_id, task_id, 1, starknet::get_block_timestamp());
                },
                StructureCategory::FragmentMine => {
                    let player_id: felt252 = claimer.into();
                    let task_id: felt252 = Task::Claimer.identifier();
                    let mut store = StoreTrait::new(world);
                    store.progress(player_id, task_id, 1, starknet::get_block_timestamp());
                },
                _ => {},
            }
        }
    }
}

#[dojo::contract]
mod battle_pillage_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::{
        ResourceTypes, ErrorMessages, get_resources_without_earthenshards, get_resources_without_earthenshards_probs
    };
    use s0_eternum::constants::{MAX_PILLAGE_TRIAL_COUNT, RESOURCE_PRECISION, DEFAULT_NS};
    use s0_eternum::models::buildings::{Building, BuildingImpl, BuildingCategory, BuildingQuantityv2,};
    use s0_eternum::models::combat::{BattleEscrowTrait, ProtectorTrait};
    use s0_eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigImpl, TroopConfigTrait, BattleConfig,
        BattleConfigImpl, BattleConfigTrait, CapacityConfig, CapacityConfigImpl, CapacityConfigCategory, VRFConfigImpl
    };
    use s0_eternum::models::config::{WeightConfig, WeightConfigImpl};
    use s0_eternum::models::event::{
        EventType, EventData, BattleStartData, BattleJoinData, BattleLeaveData, BattleClaimData, BattlePillageData
    };

    use s0_eternum::models::movable::{Movable, MovableTrait};
    use s0_eternum::models::name::{AddressName};
    use s0_eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner, OwnerTrait};
    use s0_eternum::models::position::CoordTrait;
    use s0_eternum::models::position::{Position, Coord, PositionTrait, Direction};
    use s0_eternum::models::quantity::{Quantity, QuantityTracker};
    use s0_eternum::models::realm::Realm;
    use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use s0_eternum::models::resources::{ResourceTransferLock, ResourceTransferLockTrait};

    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::stamina::{Stamina, StaminaTrait};
    use s0_eternum::models::structure::{Structure, StructureTrait, StructureCategory};
    use s0_eternum::models::weight::Weight;

    use s0_eternum::models::{
        combat::{
            Army, ArmyTrait, Troops, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait, Battle, BattleImpl,
            BattleTrait, BattleSide, Protector, Protectee, ProtecteeTrait, BattleHealthTrait, BattleEscrowImpl,
            AttackingArmyQuantityTrackerTrait, AttackingArmyQuantityTrackerImpl,
        },
    };
    use s0_eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};

    use s0_eternum::utils::math::{PercentageValueImpl, PercentageImpl};
    use s0_eternum::utils::math::{min, max};
    use s0_eternum::utils::random::{VRFImpl};
    use s0_eternum::utils::random;
    use starknet::ContractAddress;

    use super::{IBattlePillageContract, IBattleUtilsContractDispatcher, IBattleUtilsContractDispatcherTrait};

    #[abi(embed_v0)]
    impl BattlePillageContractImpl of IBattlePillageContract<ContractState> {
        fn battle_pillage(ref self: ContractState, army_id: ID, structure_id: ID,) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            // ensure caller owns army
            let caller_entity_owner: EntityOwner = world.read_model(army_id);
            caller_entity_owner.assert_caller_owner(world);

            // ensure entity being pillaged is a structure
            let structure: Structure = world.read_model(structure_id);
            structure.assert_is_structure();
            let armies_tick_config = TickImpl::get_armies_tick_config(ref world);
            let battle_config = BattleConfigImpl::get(world);
            structure.assert_no_initial_attack_immunity(battle_config, armies_tick_config);

            // ensure attacking army is not in a battle
            let mut attacking_army: Army = world.read_model(army_id);
            attacking_army.assert_not_in_battle();

            // ensure army is at structure position
            let army_position: Position = world.read_model(army_id);
            let structure_position: Position = world.read_model(structure_id);
            army_position.assert_same_location(structure_position.into());

            // ensure army has stamina
            let mut army_stamina: Stamina = world.read_model(army_id);
            army_stamina.refill_if_next_tick(ref world);
            assert!(army_stamina.amount.is_non_zero(), "army needs stamina to pillage");

            let troop_config = TroopConfigImpl::get(world);

            // get structure army and health

            let structure_protector: Protector = world.read_model(structure_id);
            let structure_army_id: ID = structure_protector.army_id;
            assert!(structure_army_id != army_id, "self attack");

            let mut structure_army: Army = Default::default();
            let mut structure_army_health: Health = Default::default();
            if structure_army_id.is_non_zero() {
                structure_army = world.read_model(structure_army_id);
                if structure_army.is_in_battle() {
                    let (contract_address, _) = world.dns(@"battle_utils_systems").unwrap();
                    let battle_utils_systems = IBattleUtilsContractDispatcher { contract_address };

                    let mut battle = BattleImpl::get(world, structure_army.battle_id);

                    let (r_battle, r_structure_army) = battle_utils_systems
                        .leave_battle_if_ended(battle, structure_army);
                    battle = r_battle;
                    structure_army = r_structure_army;
                }

                // get accurate structure army health
                structure_army_health = world.read_model(structure_army_id);
            }

            // a percentage of it's full strength depending on structure army's health
            let mut structure_army_strength = structure_army.troops.full_strength(troop_config)
                * structure_army_health.percentage_left()
                / PercentageValueImpl::_100().into();

            // a percentage of it's full strength depending on structure army's health
            let mut attacking_army_health: Health = world.read_model(army_id);
            attacking_army_health.assert_alive("Army");

            let mut attacking_army_strength = attacking_army.troops.full_strength(troop_config)
                * attacking_army_health.percentage_left()
                / PercentageValueImpl::_100().into();

            let vrf_provider: ContractAddress = VRFConfigImpl::get_provider_address(ref world);
            let vrf_seed: u256 = VRFImpl::seed(starknet::get_caller_address(), vrf_provider);
            let attack_successful: @bool = random::choices(
                array![true, false].span(),
                array![attacking_army_strength, structure_army_strength].span(),
                array![].span(),
                1,
                true,
                vrf_seed
            )[0];

            let mut pillaged_resources: Array<(u8, u128)> = array![(0, 0)];
            if *attack_successful {
                let attack_success_probability = attacking_army_strength
                    * PercentageValueImpl::_100().into()
                    / max((attacking_army_strength + structure_army_strength), 1);

                // choose x random resource to be stolen
                let mut chosen_resource_types: Span<u8> = random::choices(
                    get_resources_without_earthenshards(),
                    get_resources_without_earthenshards_probs(),
                    array![].span(),
                    MAX_PILLAGE_TRIAL_COUNT.try_into().unwrap(),
                    true,
                    vrf_seed
                );

                loop {
                    match chosen_resource_types.pop_front() {
                        Option::Some(chosen_resource_type) => {
                            let pillaged_resource_from_structure: Resource = ResourceImpl::get(
                                ref world, (structure_id, *chosen_resource_type)
                            );

                            if pillaged_resource_from_structure.balance > 0 {
                                // find out the max resource amount carriable given entity's weight
                                let army_capacity_config: CapacityConfig = world
                                    .read_model(CapacityConfigCategory::Army);

                                // Divided by resource precision because we need capacity in gram
                                // per client unit
                                let army_total_capacity = army_capacity_config.weight_gram
                                    * attacking_army.troops.count().into()
                                    / RESOURCE_PRECISION;

                                let army_weight: Weight = world.read_model(army_id);

                                let max_carriable = if army_total_capacity > army_weight.value {
                                    (army_total_capacity - (army_weight.value))
                                        / max(
                                            (WeightConfigImpl::get_weight_grams(ref world, *chosen_resource_type, 1)), 1
                                        )
                                } else {
                                    0
                                };

                                if max_carriable > 0 {
                                    let max_resource_amount_stolen: u128 = attacking_army.troops.count().into()
                                        * attack_success_probability.into()
                                        / PercentageValueImpl::_100().into();

                                    let resource_amount_stolen: u128 = min(
                                        pillaged_resource_from_structure.balance, max_resource_amount_stolen
                                    );

                                    let resource_amount_stolen: u128 = min(max_carriable, resource_amount_stolen);

                                    // express resource amount stolen to be a percentage of stamina
                                    // left
                                    let resource_amount_stolen: u128 = (resource_amount_stolen
                                        * army_stamina.amount.into())
                                        / army_stamina.max(ref world).into();

                                    if resource_amount_stolen.is_non_zero() {
                                        pillaged_resources.append((*chosen_resource_type, resource_amount_stolen));
                                        InternalResourceSystemsImpl::transfer(
                                            ref world,
                                            structure_id,
                                            army_id,
                                            array![(*chosen_resource_type, resource_amount_stolen)].span(),
                                            army_id,
                                            true,
                                            true
                                        );
                                    }

                                    break;
                                }
                            }
                        },
                        Option::None => { break; }
                    }
                };
            }

            // drain stamina
            army_stamina.drain(ref world);

            // destroy a building
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
                    true,
                    vrf_seed
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
                                array![1, 1, 1, 1].span(), // each carry the same weight so equal probs
                                array![].span(),
                                1,
                                true,
                                vrf_seed
                            )[0]
                        )
                        .span(),
                    array![1, 2, 4, 7, 11, 15]
                        .span(), // direction weights are in ascending order so the last 3 carry the most weight
                    array![].span(),
                    chosen_direction_count.into(),
                    true,
                    vrf_seed
                );

                let mut final_coord = BuildingImpl::center();
                loop {
                    match chosen_directions.pop_front() {
                        Option::Some(direction) => { final_coord = final_coord.neighbor(*direction); },
                        Option::None => { break; }
                    }
                };

                if final_coord != BuildingImpl::center() {
                    // check if there is a building at the destination coordinate
                    let mut pillaged_building: Building = world
                        .read_model((structure_position.x, structure_position.y, final_coord.x, final_coord.y));
                    if pillaged_building.entity_id.is_non_zero() {
                        // destroy building if it exists
                        let building_category = BuildingImpl::destroy(ref world, structure_id, final_coord);
                        destroyed_building_category = building_category;
                    }
                }
            }

            // store previous attacking troops to calculate lost troops
            let mut attacker_lost_troops = attacking_army.troops.clone();
            // store previous structure troops to calculate lost troops
            let mut structure_lost_troops = structure_army.troops.clone();

            // Deduct health from both armies if structure has an army
            if structure_army_health.is_alive() {
                let mut mock_battle: Battle = Battle {
                    entity_id: 45,
                    attack_army: attacking_army.into(),
                    attack_army_lifetime: attacking_army.into(),
                    defence_army: structure_army.into(),
                    defence_army_lifetime: structure_army.into(),
                    attackers_resources_escrow_id: 0,
                    defenders_resources_escrow_id: 0,
                    attack_army_health: attacking_army_health.into(),
                    defence_army_health: structure_army_health.into(),
                    attack_delta: 0,
                    defence_delta: 0,
                    last_updated: starknet::get_block_timestamp(),
                    duration_left: 0,
                    start_at: starknet::get_block_timestamp()
                };
                mock_battle.reset_delta(troop_config);

                // reset attacking army health and troop count
                attacking_army_health
                    .decrease_current_by(
                        ((mock_battle.defence_delta.into() * mock_battle.duration_left.into())
                            / troop_config.pillage_health_divisor.into())
                    );

                attacking_army.troops.reset_count_and_health(ref attacking_army_health, troop_config);
                let attacking_army_quantity = Quantity {
                    entity_id: attacking_army.entity_id, value: attacking_army.troops.count().into()
                };
                world.write_model(@attacking_army);
                world.write_model(@attacking_army_health);
                world.write_model(@attacking_army_quantity);

                // reset structure army health and troop count
                structure_army_health
                    .decrease_current_by(
                        ((mock_battle.attack_delta.into() * mock_battle.duration_left.into())
                            / troop_config.pillage_health_divisor.into())
                    );
                structure_army.troops.reset_count_and_health(ref structure_army_health, troop_config);

                let structure_army_quantity = Quantity {
                    entity_id: structure_army_id, value: structure_army.troops.count().into()
                };
                world.write_model(@structure_army);
                world.write_model(@structure_army_health);
                world.write_model(@structure_army_quantity);
            }

            // emit pillage event
            let army_owner_entity: EntityOwner = world.read_model(army_id);
            let army_owner_entity_id: ID = army_owner_entity.entity_owner_id;

            let structure_owner: Owner = world.read_model(structure_id);
            let structure_owner: starknet::ContractAddress = structure_owner.address;
            let structure_owner_name_address_name: AddressName = world.read_model(structure_owner);

            let pillager_address_name: AddressName = world.read_model(starknet::get_caller_address());

            attacker_lost_troops.deduct(attacking_army.troops);
            structure_lost_troops.deduct(structure_army.troops);

            world
                .emit_event(
                    @BattlePillageData {
                        id: world.dispatcher.uuid(),
                        event_id: EventType::BattlePillage,
                        pillager: starknet::get_caller_address(),
                        pillager_name: pillager_address_name.name,
                        pillager_realm_entity_id: army_owner_entity_id,
                        pillager_army_entity_id: army_id,
                        pillaged_structure_owner: structure_owner,
                        pillaged_structure_entity_id: structure_id,
                        attacker_lost_troops,
                        structure_lost_troops,
                        pillaged_structure_owner_name: structure_owner_name_address_name.name,
                        winner: if *attack_successful {
                            BattleSide::Attack
                        } else {
                            BattleSide::Defence
                        },
                        x: structure_position.x,
                        y: structure_position.y,
                        structure_type: structure.category,
                        pillaged_resources: pillaged_resources.span(),
                        destroyed_building_category,
                        timestamp: starknet::get_block_timestamp(),
                    }
                );
        }
    }
}

#[dojo::contract]
mod battle_utils_systems {
    use achievement::store::{Store, StoreTrait};
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait, WorldStorage, WorldStorageTrait};
    use s0_eternum::alias::ID;
    use s0_eternum::constants::{
        ResourceTypes, ErrorMessages, get_resources_without_earthenshards, get_resources_without_earthenshards_probs
    };
    use s0_eternum::constants::{MAX_PILLAGE_TRIAL_COUNT, RESOURCE_PRECISION, DEFAULT_NS};
    use s0_eternum::models::buildings::{Building, BuildingImpl, BuildingCategory, BuildingQuantityv2,};
    use s0_eternum::models::combat::{BattleEscrowTrait, ProtectorTrait};
    use s0_eternum::models::config::{
        TickConfig, TickImpl, TickTrait, SpeedConfig, TroopConfig, TroopConfigImpl, TroopConfigTrait, BattleConfig,
        BattleConfigImpl, BattleConfigTrait, CapacityConfig, CapacityConfigImpl, CapacityConfigCategory
    };
    use s0_eternum::models::config::{WeightConfig, WeightConfigImpl};
    use s0_eternum::models::event::{
        EventType, EventData, BattleStartData, BattleJoinData, BattleLeaveData, BattleClaimData, BattlePillageData
    };

    use s0_eternum::models::movable::{Movable, MovableTrait};
    use s0_eternum::models::name::{AddressName};
    use s0_eternum::models::owner::{EntityOwner, EntityOwnerImpl, EntityOwnerTrait, Owner, OwnerTrait};
    use s0_eternum::models::position::CoordTrait;
    use s0_eternum::models::position::{Position, Coord, PositionTrait, Direction};
    use s0_eternum::models::quantity::{Quantity, QuantityTracker};
    use s0_eternum::models::realm::Realm;
    use s0_eternum::models::resources::{Resource, ResourceImpl, ResourceCost};
    use s0_eternum::models::resources::{ResourceTransferLock, ResourceTransferLockTrait};

    use s0_eternum::models::season::SeasonImpl;
    use s0_eternum::models::stamina::{Stamina, StaminaTrait};
    use s0_eternum::models::structure::{Structure, StructureTrait, StructureCategory};
    use s0_eternum::models::weight::Weight;

    use s0_eternum::models::{
        combat::{
            Army, ArmyTrait, Troops, TroopsImpl, TroopsTrait, Health, HealthImpl, HealthTrait, Battle, BattleImpl,
            BattleTrait, BattleSide, Protector, Protectee, ProtecteeTrait, BattleHealthTrait, BattleEscrowImpl,
            AttackingArmyQuantityTrackerTrait, AttackingArmyQuantityTrackerImpl,
        },
    };
    use s0_eternum::systems::resources::contracts::resource_systems::resource_systems::{InternalResourceSystemsImpl};

    use s0_eternum::utils::math::{PercentageValueImpl, PercentageImpl};
    use s0_eternum::utils::math::{min, max};
    use s0_eternum::utils::random;
    use s0_eternum::utils::tasks::index::{Task, TaskTrait};

    use super::{IBattlePillageContract};

    #[abi(embed_v0)]
    impl BattleUtilsContractImpl of super::IBattleUtilsContract<ContractState> {
        fn leave_battle(ref self: ContractState, battle: Battle, army: Army) -> (Battle, Army) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            InternalBattleImpl::assert_caller_authorized(ref world);
            return InternalBattleImpl::leave_battle(ref world, battle, army);
        }

        fn leave_battle_if_ended(ref self: ContractState, battle: Battle, army: Army) -> (Battle, Army) {
            let mut world = self.world(DEFAULT_NS());
            SeasonImpl::assert_season_is_not_over(world);

            InternalBattleImpl::assert_caller_authorized(ref world);
            return InternalBattleImpl::leave_battle_if_ended(ref world, battle, army);
        }
    }

    #[generate_trait]
    pub impl InternalBattleImpl of InternalBattleTrait {
        fn assert_caller_authorized(ref world: WorldStorage) {
            let caller_address = starknet::get_caller_address();
            let (battle_systems_address, _) = world.dns(@"battle_systems").unwrap();
            let (battle_pillage_systems_address, _) = world.dns(@"battle_pillage_systems").unwrap();
            let (troop_systems_address, _) = world.dns(@"troop_systems").unwrap();

            if !(caller_address == battle_systems_address)
                && !(caller_address == battle_pillage_systems_address)
                && !(caller_address == troop_systems_address) {
                panic!("caller must be battle_systems, battle_pillage_systems, or troop_systems");
            }
        }

        fn leave_battle_if_ended(ref world: WorldStorage, battle: Battle, army: Army) -> (Battle, Army) {
            assert!(battle.entity_id == army.battle_id, "army must be in same battle");
            if battle.has_ended() {
                // leave battle to update structure army's health
                return Self::leave_battle(ref world, battle, army);
            }
            return (battle, army);
        }


        /// Make army leave battle
        fn leave_battle(ref world: WorldStorage, mut battle: Battle, mut original_army: Army) -> (Battle, Army) {
            // save battle end status for achievement
            let battle_has_ended = battle.has_ended();
            let battle_id = battle.entity_id;

            // make caller army mobile again
            let army_id = original_army.entity_id;
            let original_army_side = original_army.battle_side;
            let mut army_protectee: Protectee = world.read_model(army_id);
            let mut army_movable: Movable = world.read_model(army_id);
            if army_protectee.is_none() {
                army_movable.assert_blocked();
                army_movable.blocked = false;
                world.write_model(@army_movable);
            } else {
                assert!(battle.has_ended(), "structure can only leave battle after it ends");
            }

            // get normalized share of army left after battle
            let army_left = battle.get_troops_share_left(original_army);

            // update army quantity to correct value before calling `withdraw_balance_and_reward`
            // because it is used to calculate the loot amount sent to army if it wins the battle
            // i.e when the `withdraw_balance_and_reward` calls
            // `InternalResourceSystemsImpl::mint_if_adequate_capacity`
            let army_quantity_left = Quantity { entity_id: army_id, value: army_left.troops.count().into() };
            world.write_model(@army_quantity_left);

            // withdraw battle deposit and reward
            battle.withdraw_balance_and_reward(ref world, army_left, army_protectee);

            // reduce battle army values
            let troop_config = TroopConfigImpl::get(world);
            battle.reduce_battle_army_troops_and_health_by(army_left, troop_config);
            battle.reduce_battle_army_lifetime_by(original_army);

            if (battle.is_empty()) {
                // delete battle when the last participant leaves
                world.erase_model(@battle);
            } else {
                // update battle if it still has participants
                battle.reset_delta(troop_config);
                world.write_model(@battle);
            }

            // update army
            original_army = army_left;
            original_army.battle_id = 0;
            original_army.battle_side = BattleSide::None;
            world.write_model(@original_army);

            // update army health
            let army_health = Health {
                entity_id: army_id,
                current: original_army.troops.full_health(troop_config),
                lifetime: original_army.troops.full_health(troop_config)
            };
            world.write_model(@army_health);

            // [Achievement] Win a battle
            if battle_has_ended && army_left.troops.count() > 0 {
                let player_id: felt252 = starknet::get_caller_address().into();
                let task_id: felt252 = Task::Battlelord.identifier();
                let time = starknet::get_block_timestamp();
                let mut store = StoreTrait::new(world);
                store.progress(player_id, task_id, 1, time);
            }

            // emit battle leave event
            let army_entity_owner: EntityOwner = world.read_model(army_id);
            let army_owner: Owner = world.read_model(army_entity_owner.entity_owner_id);
            let army_owner_address: starknet::ContractAddress = army_owner.address;
            let army_owner_name: AddressName = world.read_model(army_owner_address);

            let battle_position: Position = world.read_model(battle_id);
            let duration_left = if battle_has_ended {
                0
            } else {
                battle.duration_left
            };
            world
                .emit_event(
                    @BattleLeaveData {
                        id: world.dispatcher.uuid(),
                        event_id: EventType::BattleLeave,
                        battle_entity_id: battle_id,
                        leaver: army_owner_address,
                        leaver_name: army_owner_name.name,
                        leaver_army_entity_id: army_id,
                        leaver_side: original_army_side,
                        duration_left,
                        x: battle_position.x,
                        y: battle_position.y,
                        timestamp: starknet::get_block_timestamp(),
                    }
                );

            // return updated battle and army
            (battle, original_army)
        }
    }
}

