use crate::alias::ID;

/// # Faith Systems Interface
///
/// The Faith system allows players to pledge their structures (Realms, Villages, Holy Sites)
/// to Wonders, creating a faith-based leaderboard with end-of-season prize distribution.
///
/// ## Overview
///
/// - **Wonders** are special structures that can receive faith from other structures
/// - **Faith Points (FP)** accumulate over time based on pledged structures
/// - **Leaderboard** tracks which wonder has the most accumulated FP
/// - **Prize Pool** is distributed at season end to winning wonders and their followers
///
/// ## FP Emission Rates (configurable via FaithConfig)
///
/// | Structure Type | Base FP/sec | Owner Share (30%) | Pledger Share (70%) |
/// |----------------|-------------|-------------------|---------------------|
/// | Wonder (self)  | 50          | 15                | 35                  |
/// | Holy Site      | 50          | 15                | 35                  |
/// | Realm          | 10          | 3                 | 7                   |
/// | Village        | 1           | 0.3               | 0.7                 |
///
/// Note: Actual rates may include a precision multiplier (e.g., 10x) applied in config.
///
/// ## Key Concepts
///
/// ### Wonder Self-Pledge
/// A wonder must first pledge to itself (`pledge_faith(wonder_id, wonder_id)`) before
/// it can receive pledges from other structures. This initializes the wonder's faith state.
///
/// ### Subservient Wonders
/// A wonder can submit to another wonder, forfeiting its ability to attract followers.
/// - The submitting wonder must have `num_structures_pledged == 0`
/// - Once subservient, the wonder cannot receive new pledges
/// - The subservient wonder contributes 50 FP/sec to the dominant wonder
///
/// ### Ownership Tracking
/// Both wonder and structure ownership changes are tracked to ensure FP is credited
/// to the correct players. The system uses `last_recorded_owner` fields to detect
/// ownership changes and settle points accordingly.
///
/// ## Client Integration Workflow
///
/// ### 1. Initialize a Wonder
/// ```
/// faith_systems.pledge_faith(wonder_id, wonder_id);  // Wonder self-pledges
/// ```
///
/// ### 2. Pledge a Structure to a Wonder
/// ```
/// faith_systems.pledge_faith(realm_id, wonder_id);  // Realm pledges to wonder
/// ```
///
/// ### 3. After Ownership Transfer (wonder or structure)
/// ```
/// // Call immediately after any ownership change to ensure proper FP crediting
/// faith_systems.update_wonder_ownership(wonder_id);
/// faith_systems.update_structure_ownership(structure_id);
/// ```
///
/// ### 4. Settle Points (optional, happens automatically on state changes)
/// ```
/// faith_systems.claim_wonder_points(wonder_id);     // Updates wonder's total FP
/// faith_systems.claim_player_points(player, wonder_id);  // Settles player's pending FP
/// ```
///
/// ### 5. Remove Faith (change allegiance)
/// ```
/// faith_systems.remove_faith(structure_id);  // Structure owner or wonder owner can call
/// ```
#[starknet::interface]
pub trait IFaithSystems<T> {
    /// Pledge a structure's faith to a wonder.
    ///
    /// # Description
    ///
    /// Commits a structure to serve a wonder, generating Faith Points (FP) over time.
    /// The FP is split between the wonder owner (30%) and the structure owner (70%).
    ///
    /// # Parameters
    ///
    /// * `structure_id` - The ID of the structure pledging faith (Realm, Village, Holy Site, or Wonder)
    /// * `wonder_id` - The ID of the wonder receiving the pledge
    ///
    /// # Behavior Cases
    ///
    /// | Case | Condition | Effect |
    /// |------|-----------|--------|
    /// | Self-Pledge | `structure_id == wonder_id` | Initializes wonder, starts 50 FP/sec |
    /// | Wonder Submission | structure is a wonder, pledging to different wonder | Contributes 50 FP/sec, becomes subservient |
    /// | Normal Pledge | structure is Realm/Village/Holy Site | Contributes FP based on structure type |
    ///
    /// # Requirements
    ///
    /// - Season must be active (started and not ended)
    /// - Structure must not already be faithful to any wonder
    /// - Target wonder must exist and have a valid owner
    /// - Target wonder must be self-pledged (have `last_recorded_owner` set)
    /// - Target wonder must NOT be subservient to another wonder
    /// - Structure/caller must not be blacklisted by the wonder
    /// - Faith system must be enabled in config
    /// - If structure is a wonder pledging to another wonder:
    ///   - The submitting wonder must have `num_structures_pledged == 0`
    ///
    /// # Errors
    ///
    /// - `"Structure is already faithful to wonder {id}"` - Structure already pledged
    /// - `"Invalid wonder"` - Target wonder doesn't exist
    /// - `"Wonder faith no owner initialized"` - Wonder hasn't self-pledged yet
    /// - `"Wonder owner mismatch"` - Ownership state inconsistent (call update_wonder_ownership)
    /// - `"Structure is blacklisted"` - Structure ID is on wonder's blacklist
    /// - `"Address is blacklisted"` - Caller address is on wonder's blacklist
    /// - `"Faith system is not enabled"` - FaithConfig.enabled is false
    /// - `"Cannot submit wonder with active pledges"` - Wonder trying to submit but has followers
    /// - `"Cannot pledge to a subservient wonder"` - Target wonder is pledged to another wonder
    ///
    /// # Events
    ///
    /// Emits `FaithPledgedStory` with structure_id, wonder_id, structure_owner, and FP rates.
    ///
    /// # Example
    ///
    /// ```
    /// // Step 1: Wonder owner initializes their wonder
    /// faith_systems.pledge_faith(wonder_id, wonder_id);
    ///
    /// // Step 2: Other players pledge their structures
    /// faith_systems.pledge_faith(my_realm_id, wonder_id);
    /// faith_systems.pledge_faith(my_village_id, wonder_id);
    /// ```
    fn pledge_faith(ref self: T, structure_id: ID, wonder_id: ID);

    /// Remove a structure's faith from its pledged wonder.
    ///
    /// # Description
    ///
    /// Removes a structure from its current wonder allegiance, stopping FP accumulation
    /// and settling all pending points for both the structure owner and wonder owner.
    ///
    /// # Parameters
    ///
    /// * `structure_id` - The ID of the structure to remove from its wonder
    ///
    /// # Authorization
    ///
    /// Can be called by:
    /// - **Structure owner**: Wants to change allegiance or stop participating
    /// - **Wonder owner**: Wants to remove an unwanted follower
    ///
    /// # Special Cases
    ///
    /// | Case | Behavior |
    /// |------|----------|
    /// | Wonder self-removal | Only allowed if `num_structures_pledged <= 1` (no other followers) |
    /// | Subservient wonder removal | Updates both wonder ownerships before removal |
    ///
    /// # Requirements
    ///
    /// - Season must be active
    /// - Structure must be faithful to a wonder
    /// - Caller must be structure owner OR wonder owner
    /// - If removing wonder's self-pledge: wonder must have no other followers
    ///
    /// # Side Effects
    ///
    /// 1. Calls `update_wonder_ownership` on the target wonder
    /// 2. If structure is a wonder: calls `update_wonder_ownership` on the structure
    /// 3. Calls `update_structure_ownership` on the structure
    /// 4. Claims wonder points before state change
    /// 5. Settles player FP for both structure and wonder owners
    /// 6. Clears `FaithfulStructure` state
    ///
    /// # Errors
    ///
    /// - `"Structure not faithful to any wonder"` - Structure isn't pledged
    /// - `"Only structure owner or wonder owner can remove"` - Unauthorized caller
    /// - `"Cannot remove self while others are pledged"` - Wonder trying to un-self-pledge with followers
    ///
    /// # Events
    ///
    /// Emits `FaithRemovedStory` with structure_id, previous_wonder_id, and structure_owner.
    ///
    /// # Example
    ///
    /// ```
    /// // Structure owner removes their own structure
    /// faith_systems.remove_faith(my_realm_id);
    ///
    /// // Wonder owner kicks out a follower
    /// faith_systems.remove_faith(unwanted_realm_id);
    /// ```
    fn remove_faith(ref self: T, structure_id: ID);

    /// Update faith point tracking after wonder ownership changes.
    ///
    /// # Description
    ///
    /// Synchronizes the faith system's ownership tracking with the actual wonder owner.
    /// Must be called after any wonder ownership transfer (battle capture, trade, etc.)
    /// to ensure FP is credited to the correct player.
    ///
    /// # Parameters
    ///
    /// * `wonder_id` - The ID of the wonder that changed ownership
    ///
    /// # When to Call
    ///
    /// **IMPORTANT**: This should be called immediately after any wonder ownership change:
    /// - After a wonder is captured in battle
    /// - After a wonder is traded/transferred
    /// - Before any faith-related operations if ownership might have changed
    ///
    /// # What It Does
    ///
    /// 1. Compares `WonderFaith.last_recorded_owner` with current `Structure.owner`
    /// 2. If different:
    ///    - Claims all pending wonder points (updates leaderboard)
    ///    - Deducts `owner_claim_per_sec` rate from old owner's `PlayerFaithPoints`
    ///    - Adds `owner_claim_per_sec` rate to new owner's `PlayerFaithPoints`
    ///    - Updates `WonderFaith.last_recorded_owner`
    /// 3. Also calls `update_structure_ownership` for the wonder (since wonder is also a structure)
    ///
    /// # Authorization
    ///
    /// **Permissionless** - Anyone can call this. It simply synchronizes state.
    ///
    /// # Requirements
    ///
    /// - Season must be active
    /// - Wonder must exist (valid realm_id)
    /// - Wonder must have an owner
    ///
    /// # Example
    ///
    /// ```
    /// // After winning a battle that captured a wonder
    /// faith_systems.update_wonder_ownership(captured_wonder_id);
    ///
    /// // Before pledging to a wonder (to ensure state is current)
    /// faith_systems.update_wonder_ownership(target_wonder_id);
    /// faith_systems.pledge_faith(my_realm_id, target_wonder_id);
    /// ```
    fn update_wonder_ownership(ref self: T, wonder_id: ID);

    /// Update faith point tracking after pledged structure ownership changes.
    ///
    /// # Description
    ///
    /// Synchronizes the faith system's ownership tracking with the actual structure owner.
    /// Must be called after any pledged structure ownership transfer to ensure the new
    /// owner receives the pledger FP share.
    ///
    /// # Parameters
    ///
    /// * `structure_id` - The ID of the structure that changed ownership
    ///
    /// # When to Call
    ///
    /// Call after any ownership change of a structure that is currently pledged:
    /// - After a realm/village/holy site is captured
    /// - After a structure is traded/transferred
    ///
    /// # What It Does
    ///
    /// 1. Checks if structure is faithful to any wonder (if not, returns early)
    /// 2. Compares `FaithfulStructure.last_recorded_owner` with current `Structure.owner`
    /// 3. If different:
    ///    - Settles pending FP for old owner
    ///    - Transfers `fp_to_struct_owner_per_sec` (pledger rate) from old to new owner
    ///    - Updates `FaithfulStructure.last_recorded_owner`
    ///
    /// # Authorization
    ///
    /// **Permissionless** - Anyone can call this.
    ///
    /// # Example
    ///
    /// ```
    /// // After capturing an enemy realm that was pledged to a wonder
    /// faith_systems.update_structure_ownership(captured_realm_id);
    /// ```
    fn update_structure_ownership(ref self: T, structure_id: ID);

    /// Claim and settle a wonder's accumulated faith points.
    ///
    /// # Description
    ///
    /// Calculates and records all FP accumulated by a wonder since the last claim.
    /// Updates the faith leaderboard if the wonder achieves a new high score.
    ///
    /// # Parameters
    ///
    /// * `wonder_id` - The ID of the wonder to claim points for
    ///
    /// # When to Call
    ///
    /// - Periodically to update leaderboard standings
    /// - Before season end to ensure final scores are recorded
    /// - Called automatically during ownership updates and pledge changes
    ///
    /// # Calculation
    ///
    /// ```
    /// new_points = claim_per_sec * (current_time - claim_last_at)
    /// claimed_points += new_points
    /// ```
    ///
    /// Note: Time is capped at `season_end_at` - no points accumulate after season ends.
    ///
    /// # Leaderboard Update
    ///
    /// - If `claimed_points > WonderFaithWinners.high_score`: Wonder becomes sole leader
    /// - If `claimed_points == high_score`: Wonder is added to tied winners list
    ///
    /// # Requirements
    ///
    /// - Season main phase must have started
    /// - Wonder must exist
    ///
    /// # Side Effects
    ///
    /// - Calls `update_wonder_ownership` first (ensures ownership is current)
    /// - Updates `WonderFaith.claimed_points` and `claim_last_at`
    /// - May update `WonderFaithWinners` if new high score
    /// - Emits `FaithPointsClaimedStory` event
    ///
    /// # Example
    ///
    /// ```
    /// // Update leaderboard before checking standings
    /// faith_systems.claim_wonder_points(my_wonder_id);
    /// ```
    fn claim_wonder_points(ref self: T, wonder_id: ID);

    /// Claim and settle a player's accumulated faith points for a specific wonder.
    ///
    /// # Description
    ///
    /// Settles all pending FP for a player's participation in a specific wonder.
    /// This converts their rate-based accumulation into claimed points.
    ///
    /// # Parameters
    ///
    /// * `player` - The address of the player to settle points for
    /// * `wonder_id` - The ID of the wonder the player has points in
    ///
    /// # When to Call
    ///
    /// - Before season end to lock in final point totals
    /// - Before prize distribution to ensure accurate share calculation
    /// - Called automatically during ownership updates and pledge changes
    ///
    /// # Authorization
    ///
    /// **Permissionless** - Anyone can call this on behalf of any player.
    /// This is intentional to allow batch settlement operations.
    ///
    /// # Calculation
    ///
    /// ```
    /// time_elapsed = min(season_end_at, now) - last_updated_at
    /// new_points = (points_per_sec_as_owner + points_per_sec_as_pledger) * time_elapsed
    /// points_claimed += new_points
    /// ```
    ///
    /// # Data Updated
    ///
    /// - `PlayerFaithPoints.points_claimed` - Increases by newly settled points
    /// - `PlayerFaithPoints.last_updated_at` - Set to current time (capped at season end)
    ///
    /// # Example
    ///
    /// ```
    /// // Settle your own points
    /// faith_systems.claim_player_points(my_address, wonder_id);
    ///
    /// // Settle another player's points (e.g., before prize distribution)
    /// faith_systems.claim_player_points(other_player, wonder_id);
    /// ```
    fn claim_player_points(ref self: T, player: starknet::ContractAddress, wonder_id: ID);

    /// Blacklist a structure or address from pledging to a wonder.
    ///
    /// # Description
    ///
    /// Prevents a specific structure ID or wallet address from pledging to the wonder.
    /// Useful for wonder owners who want to curate their follower base.
    ///
    /// # Parameters
    ///
    /// * `wonder_id` - The ID of the wonder setting the blacklist
    /// * `blocked_id` - Either a structure ID (as felt252) or an address (as felt252)
    ///
    /// # Authorization
    ///
    /// **Wonder owner only** - Only the current owner of the wonder can blacklist.
    ///
    /// # Requirements
    ///
    /// - Caller must be the wonder owner
    /// - If `blocked_id` is a structure ID: that structure must NOT be currently pledged
    ///   to this wonder (must remove first, then blacklist)
    ///
    /// # Usage
    ///
    /// ```
    /// // Blacklist a specific structure
    /// let realm_id_felt: felt252 = unwanted_realm_id.into();
    /// faith_systems.blacklist(my_wonder_id, realm_id_felt);
    ///
    /// // Blacklist a wallet address (all their structures)
    /// let address_felt: felt252 = unwanted_player.into();
    /// faith_systems.blacklist(my_wonder_id, address_felt);
    /// ```
    ///
    /// # Errors
    ///
    /// - `"Only wonder owner can blacklist"` - Caller is not wonder owner
    /// - `"Structure must be removed from wonder before blacklisting"` - Can't blacklist active follower
    fn blacklist(ref self: T, wonder_id: ID, blocked_id: felt252);

    /// Remove a structure or address from a wonder's blacklist.
    ///
    /// # Description
    ///
    /// Allows a previously blacklisted structure or address to pledge to the wonder again.
    ///
    /// # Parameters
    ///
    /// * `wonder_id` - The ID of the wonder modifying its blacklist
    /// * `blocked_id` - The structure ID or address to unblacklist (as felt252)
    ///
    /// # Authorization
    ///
    /// **Wonder owner only**
    ///
    /// # Example
    ///
    /// ```
    /// // Remove a structure from blacklist
    /// faith_systems.unblacklist(my_wonder_id, realm_id_felt);
    /// ```
    fn unblacklist(ref self: T, wonder_id: ID, blocked_id: felt252);
}

#[dojo::contract]
pub mod faith_systems {
    use core::num::traits::zero::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{IWorldDispatcherTrait, WorldStorage};
    use starknet::ContractAddress;
    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use crate::models::config::{FaithConfig, SeasonConfigImpl, WorldConfigUtilImpl};
    use crate::models::events::{FaithPledgedStory, FaithPointsClaimedStory, FaithRemovedStory, Story, StoryEvent};
    use crate::models::faith::{
        FaithfulStructure, PlayerFaithPoints, WonderFaith, WonderFaithBlacklist, WonderFaithWinners,
    };
    use crate::models::structure::{
        StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl, Wonder,
    };
    use crate::utils::math::{PercentageImpl, PercentageValueImpl};

    #[abi(embed_v0)]
    impl FaithSystemsImpl of super::IFaithSystems<ContractState> {
        fn pledge_faith(ref self: ContractState, structure_id: ID, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            self.update_wonder_ownership(wonder_id);

            let mut faithful_structure: FaithfulStructure = world.read_model(structure_id);
            assert!(
                faithful_structure.wonder_id.is_zero(),
                "Structure is already faithful to wonder {}",
                faithful_structure.wonder_id,
            );

            let caller = starknet::get_caller_address();
            let now = starknet::get_block_timestamp();

            // Get structure and verify ownership
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);

            // Verify wonder exists (realm_id > 0 indicates the wonder was properly created)
            let wonder: Wonder = world.read_model(wonder_id);
            assert!(wonder.realm_id > 0, "Invalid wonder");

            // Load wonder faith state
            let mut wonder_faith: WonderFaith = world.read_model(wonder_id);
            assert!(wonder_faith.last_recorded_owner.is_non_zero(), "Wonder faith no owner initialized");

            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(wonder_owner.is_non_zero(), "Wonder has no owner");
            assert!(wonder_owner == wonder_faith.last_recorded_owner, "Wonder owner mismatch");

            // Check blacklist
            let structure_id_felt: felt252 = structure_id.into();
            let caller_felt: felt252 = caller.into();
            let structure_blacklist: WonderFaithBlacklist = world.read_model((wonder_id, structure_id_felt));
            let address_blacklist: WonderFaithBlacklist = world.read_model((wonder_id, caller_felt));
            assert!(!structure_blacklist.is_blocked, "Structure is blacklisted");
            assert!(!address_blacklist.is_blocked, "Address is blacklisted");

            // Get FP rates based on structure category
            let faith_config: FaithConfig = WorldConfigUtilImpl::get_member(world, selector!("faith_config"));
            assert!(faith_config.enabled, "Faith system is not enabled");

            // Check if this is a wonder pledging to another wonder
            let is_self_pledge = structure_id == wonder_id;
            let is_wonder_submitting_to_another = InternalImpl::_is_wonder(ref world, structure_id) && !is_self_pledge;
            if is_wonder_submitting_to_another {
                // Can only submit if no one is pledged to the submitting wonder
                let submitting_wonder_faith: WonderFaith = world.read_model(structure_id);
                assert!(
                    submitting_wonder_faith.num_structures_pledged == 0, "Cannot submit wonder with active pledges",
                );
            }

            // Check if target wonder is subservient (already pledged to another wonder)
            // Subservient wonders cannot attract new faith
            if !is_self_pledge {
                let target_wonder_faithful: FaithfulStructure = world.read_model(wonder_id);
                let target_is_subservient = target_wonder_faithful.wonder_id.is_non_zero()
                    && target_wonder_faithful.wonder_id != wonder_id;
                assert!(!target_is_subservient, "Cannot pledge to a subservient wonder");
            }

            let (to_owner, to_pledger) = InternalImpl::_get_fp_rates(
                structure_base.category, structure_id, wonder_id, is_wonder_submitting_to_another, faith_config,
            );
            // Update faithful structure
            faithful_structure.wonder_id = wonder_id;
            faithful_structure.faithful_since = now;
            faithful_structure.fp_to_wonder_owner_per_sec = to_owner;
            faithful_structure.fp_to_struct_owner_per_sec = to_pledger;
            faithful_structure.last_recorded_owner = structure_owner;
            world.write_model(@faithful_structure);

            // Update wonder faith state
            InternalImpl::_claim_wonder_points_internal(ref world, ref wonder_faith, now, season_config.end_at);
            wonder_faith.claim_per_sec += to_owner.into() + to_pledger.into();
            wonder_faith.owner_claim_per_sec += to_owner.into();
            wonder_faith.num_structures_pledged += 1;
            world.write_model(@wonder_faith);

            // Update player points rates (ADD)
            let sea = season_config.end_at;
            InternalImpl::_update_player_rates(
                ref world, true, structure_owner, wonder_id, 0, to_pledger.into(), now, sea,
            );
            InternalImpl::_update_player_rates(ref world, true, wonder_owner, wonder_id, to_owner.into(), 0, now, sea);

            // Emit event
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(structure_owner),
                        entity_id: Option::Some(structure_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::FaithPledgedStory(
                            FaithPledgedStory {
                                structure_id,
                                wonder_id,
                                structure_owner,
                                fp_to_owner: to_owner,
                                fp_to_pledger: to_pledger,
                            },
                        ),
                        timestamp: now,
                    },
                );
        }

        fn remove_faith(ref self: ContractState, structure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let caller = starknet::get_caller_address();
            let now = starknet::get_block_timestamp();

            // Load faithful structure
            let mut faithful_structure: FaithfulStructure = world.read_model(structure_id);
            assert!(faithful_structure.wonder_id.is_non_zero(), "Structure not faithful to any wonder");

            // Update ownerships before removal
            let wonder_id = faithful_structure.wonder_id;
            self.update_wonder_ownership(wonder_id);
            // If structure_id is also a wonder (pledged to another wonder), update its wonder ownership too
            if structure_id != wonder_id && InternalImpl::_is_wonder(ref world, structure_id) {
                self.update_wonder_ownership(structure_id);
            }
            self.update_structure_ownership(structure_id);

            // Re-read after ownership updates
            let mut faithful_structure: FaithfulStructure = world.read_model(structure_id);
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            let mut wonder_faith: WonderFaith = world.read_model(wonder_id);

            // Authorization: structure owner OR wonder owner can remove
            assert!(
                caller == structure_owner || caller == wonder_owner, "Only structure owner or wonder owner can remove",
            );

            // Special case: Wonder removing itself (self-pledge)
            if structure_id == wonder_id {
                // num_structures_pledged includes self, so check if only self remains
                assert!(wonder_faith.num_structures_pledged <= 1, "Cannot remove self while others are pledged");
            }

            // Perform removal
            InternalImpl::_remove_from_wonder(
                ref world, ref faithful_structure, ref wonder_faith, structure_id, wonder_id, now, season_config.end_at,
            );

            // Emit event
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::Some(structure_owner),
                        entity_id: Option::Some(structure_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::FaithRemovedStory(
                            FaithRemovedStory { structure_id, previous_wonder_id: wonder_id, structure_owner },
                        ),
                        timestamp: now,
                    },
                );
        }

        fn update_wonder_ownership(ref self: ContractState, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            // Verify wonder exists
            let wonder: Wonder = world.read_model(wonder_id);
            assert!(wonder.realm_id > 0, "Invalid wonder");

            // Wonder must already be self-pledged (faithful to itself)
            let wonder_new_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(wonder_new_owner.is_non_zero(), "Wonder has no owner");

            // Check if ownership changed
            let mut wonder_faith: WonderFaith = world.read_model(wonder_id);
            let wonder_old_owner: ContractAddress = wonder_faith.last_recorded_owner;
            if wonder_old_owner != wonder_new_owner {
                // Claim wonder points
                let now = starknet::get_block_timestamp();
                InternalImpl::_claim_wonder_points_internal(ref world, ref wonder_faith, now, season_config.end_at);

                // Deduct accruing points from old owner
                // and reassign points to new owner
                let owner_claim_per_sec = wonder_faith.owner_claim_per_sec;
                let sea = season_config.end_at;
                InternalImpl::_update_player_rates(
                    ref world, false, wonder_old_owner, wonder_id, owner_claim_per_sec, 0, now, sea,
                );
                InternalImpl::_update_player_rates(
                    ref world, true, wonder_new_owner, wonder_id, owner_claim_per_sec, 0, now, sea,
                );

                // Update last_recorded_owner to new owner
                // Future claims will now settle points to the new owner
                wonder_faith.last_recorded_owner = wonder_new_owner;
                world.write_model(@wonder_faith);
            }
            self.update_structure_ownership(wonder_id);
        }

        fn update_structure_ownership(ref self: ContractState, structure_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let mut faithful_structure: FaithfulStructure = world.read_model(structure_id);
            // Only process if structure is faithful to a wonder
            if faithful_structure.wonder_id.is_zero() {
                return;
            }

            let structure_new_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            let structure_old_owner: ContractAddress = faithful_structure.last_recorded_owner;

            if structure_old_owner != structure_new_owner {
                let now = starknet::get_block_timestamp();
                let to_pledger = faithful_structure.fp_to_struct_owner_per_sec;
                let sea = season_config.end_at;

                // Transfer pledger rate from old owner to new owner
                let wonder_id = faithful_structure.wonder_id;
                InternalImpl::_update_player_rates(
                    ref world, false, structure_old_owner, wonder_id, 0, to_pledger.into(), now, sea,
                );
                InternalImpl::_update_player_rates(
                    ref world, true, structure_new_owner, wonder_id, 0, to_pledger.into(), now, sea,
                );

                faithful_structure.last_recorded_owner = structure_new_owner;
                world.write_model(@faithful_structure);
            }
        }

        fn claim_wonder_points(ref self: ContractState, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_main();

            let wonder: Wonder = world.read_model(wonder_id);
            assert!(wonder.realm_id > 0, "Invalid wonder");

            // Update wonder ownership before claiming
            self.update_wonder_ownership(wonder_id);

            let now = starknet::get_block_timestamp();
            let mut wonder_faith: WonderFaith = world.read_model(wonder_id);
            InternalImpl::_claim_wonder_points_internal(ref world, ref wonder_faith, now, season_config.end_at);
        }

        fn claim_player_points(ref self: ContractState, player: ContractAddress, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_main();

            assert!(player.is_non_zero(), "Invalid player address");

            let wonder: Wonder = world.read_model(wonder_id);
            assert!(wonder.realm_id > 0, "Invalid wonder");

            let now = starknet::get_block_timestamp();
            let end_time = crate::utils::math::min(season_config.end_at, now);

            // Read player's faith points for this wonder
            let mut player_fp: PlayerFaithPoints = world.read_model((player, wonder_id));

            // Calculate time elapsed since last update
            let time_elapsed = if player_fp.last_updated_at > 0 {
                end_time - player_fp.last_updated_at
            } else {
                0
            };

            // Settle pending points
            let player_total_points_per_sec = player_fp.points_per_sec_as_owner + player_fp.points_per_sec_as_pledger;
            player_fp.points_claimed += player_total_points_per_sec.into() * time_elapsed.into();
            player_fp.last_updated_at = end_time;
            world.write_model(@player_fp);
        }

        fn blacklist(ref self: ContractState, wonder_id: ID, blocked_id: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();

            let wonder: Wonder = world.read_model(wonder_id);
            assert!(wonder.realm_id > 0, "Invalid wonder");

            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(caller == wonder_owner, "Only wonder owner can blacklist");

            // Check if blocked_id represents a structure that is currently pledged to this wonder
            // If so, they must be removed first before blacklisting
            let structure_id: Option<ID> = blocked_id.try_into();
            if let Option::Some(id) = structure_id {
                let faithful_structure: FaithfulStructure = world.read_model(id);
                assert!(
                    faithful_structure.wonder_id != wonder_id,
                    "Structure must be removed from wonder before blacklisting",
                );
            }

            let mut blacklist_entry: WonderFaithBlacklist = world.read_model((wonder_id, blocked_id));
            blacklist_entry.wonder_id = wonder_id;
            blacklist_entry.blocked_id = blocked_id;
            blacklist_entry.is_blocked = true;
            world.write_model(@blacklist_entry);
        }

        fn unblacklist(ref self: ContractState, wonder_id: ID, blocked_id: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();

            let wonder: Wonder = world.read_model(wonder_id);
            assert!(wonder.realm_id > 0, "Invalid wonder");

            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(caller == wonder_owner, "Only wonder owner can unblacklist");

            let mut blacklist_entry: WonderFaithBlacklist = world.read_model((wonder_id, blocked_id));
            blacklist_entry.is_blocked = false;
            world.write_model(@blacklist_entry);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _get_fp_rates(
            category: u8, structure_id: ID, wonder_id: ID, is_wonder_submitting: bool, faith_config: FaithConfig,
        ) -> (u16, u16) {
            let is_self_pledge = structure_id == wonder_id;

            // Config values are pre-scaled by client (FAITH_PRECISION applied in config)
            let total: u16 = if is_self_pledge {
                faith_config.wonder_base_fp_per_sec
            } else if is_wonder_submitting {
                // Wonder submitting to another wonder uses wonder base rate
                faith_config.wonder_base_fp_per_sec
            } else if category == StructureCategory::Realm.into() {
                faith_config.realm_fp_per_sec
            } else if category == StructureCategory::Village.into() {
                faith_config.village_fp_per_sec
            } else if category == StructureCategory::HolySite.into() {
                faith_config.holy_site_fp_per_sec
            } else {
                assert!(false, "Eternum: invalid structure category for faith pledge");
                faith_config.realm_fp_per_sec // unreachable
            };

            let to_owner: u128 = ((total.into() * faith_config.owner_share_percent.into())
                / PercentageValueImpl::_100().into());
            let to_owner: u16 = to_owner.try_into().unwrap();
            let to_pledger: u16 = total - to_owner;
            (to_owner, to_pledger)
        }

        fn _is_wonder(ref world: WorldStorage, structure_id: ID) -> bool {
            let wonder: Wonder = world.read_model(structure_id);
            wonder.realm_id > 0
        }

        fn _remove_from_wonder(
            ref world: WorldStorage,
            ref faithful_structure: FaithfulStructure,
            ref wonder_faith: WonderFaith,
            structure_id: ID,
            wonder_id: ID,
            now: u64,
            season_end_at: u64,
        ) {
            // Claim wonder points before state change
            Self::_claim_wonder_points_internal(ref world, ref wonder_faith, now, season_end_at);

            // Update wonder faith state (subtract rates)
            let to_owner = faithful_structure.fp_to_wonder_owner_per_sec;
            let to_pledger = faithful_structure.fp_to_struct_owner_per_sec;

            wonder_faith.claim_per_sec -= to_owner.into() + to_pledger.into();
            wonder_faith.owner_claim_per_sec -= to_owner.into();
            wonder_faith.num_structures_pledged -= 1;
            world.write_model(@wonder_faith);

            // Get owners from last_recorded_owner before clearing
            let structure_owner: ContractAddress = faithful_structure.last_recorded_owner;
            let wonder_owner: ContractAddress = wonder_faith.last_recorded_owner;

            // Clear faithful structure
            faithful_structure.wonder_id = 0;
            faithful_structure.faithful_since = 0;
            faithful_structure.fp_to_wonder_owner_per_sec = 0;
            faithful_structure.fp_to_struct_owner_per_sec = 0;
            faithful_structure.last_recorded_owner = starknet::contract_address_const::<0>();
            world.write_model(@faithful_structure);

            // Update player points rates (subtract)
            Self::_update_player_rates(
                ref world, false, structure_owner, wonder_id, 0, to_pledger.into(), now, season_end_at,
            );
            Self::_update_player_rates(
                ref world, false, wonder_owner, wonder_id, to_owner.into(), 0, now, season_end_at,
            );
        }

        fn _claim_wonder_points_internal(
            ref world: WorldStorage, ref wonder_faith: WonderFaith, now: u64, season_end_at: u64,
        ) {
            // Determine end time (cap at season end)
            let end_time = crate::utils::math::min(season_end_at, now);

            // Skip if no time elapsed or not yet initialized
            if wonder_faith.claim_last_at == 0 || end_time <= wonder_faith.claim_last_at {
                if wonder_faith.claim_last_at == 0 {
                    wonder_faith.claim_last_at = now;
                    world.write_model(@wonder_faith);
                }
                return;
            }

            // Calculate time elapsed since last claim
            let time_elapsed = end_time - wonder_faith.claim_last_at;

            // Calculate new points
            let new_points: u128 = wonder_faith.claim_per_sec.into() * time_elapsed.into();

            // Update wonder faith
            wonder_faith.claimed_points += new_points;
            wonder_faith.claim_last_at = end_time;
            world.write_model(@wonder_faith);

            // Check and update winners
            let wonder_id = wonder_faith.wonder_id;
            let mut winners: WonderFaithWinners = world.read_model(WORLD_CONFIG_ID);

            if wonder_faith.claimed_points > winners.high_score {
                // New high score - replace all previous winners with this one
                winners.high_score = wonder_faith.claimed_points;
                winners.wonder_ids = array![wonder_id];
                world.write_model(@winners);
            } else if wonder_faith.claimed_points == winners.high_score && winners.high_score > 0 {
                // Tied for high score - add to winners if not already present
                let mut already_winner = false;
                for existing_id in winners.wonder_ids.span() {
                    if *existing_id == wonder_id {
                        already_winner = true;
                        break;
                    }
                }

                if !already_winner {
                    winners.wonder_ids.append(wonder_id);
                    world.write_model(@winners);
                }
            }

            // Emit event
            world
                .emit_event(
                    @StoryEvent {
                        id: world.dispatcher.uuid(),
                        owner: Option::None,
                        entity_id: Option::Some(wonder_id),
                        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
                        story: Story::FaithPointsClaimedStory(
                            FaithPointsClaimedStory {
                                wonder_id, new_points, total_points: wonder_faith.claimed_points,
                            },
                        ),
                        timestamp: now,
                    },
                );
        }

        fn _update_player_rates(
            ref world: WorldStorage,
            add: bool,
            player: ContractAddress,
            wonder_id: ID,
            owner_delta: u32,
            pledger_delta: u32,
            now: u64,
            season_end_at: u64,
        ) {
            if player.is_zero() {
                return;
            }
            let end_time = crate::utils::math::min(season_end_at, now);
            let mut player_fp: PlayerFaithPoints = world.read_model((player, wonder_id));
            let time_elapsed = if player_fp.last_updated_at > 0 {
                end_time - player_fp.last_updated_at
            } else {
                0
            };

            // Claim previously accrued points
            let player_total_points_per_sec = player_fp.points_per_sec_as_owner + player_fp.points_per_sec_as_pledger;
            player_fp.points_claimed += player_total_points_per_sec.into() * time_elapsed.into();
            player_fp.last_updated_at = end_time;

            if add {
                // Update rates (add)
                player_fp.points_per_sec_as_owner += owner_delta;
                player_fp.points_per_sec_as_pledger += pledger_delta;
            } else {
                // Update rates (subtract)
                player_fp.points_per_sec_as_owner -= owner_delta;
                player_fp.points_per_sec_as_pledger -= pledger_delta;
            }
            world.write_model(@player_fp);
        }
    }
}
