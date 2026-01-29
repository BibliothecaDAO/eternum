use crate::alias::ID;

#[starknet::interface]
pub trait IFaithSystems<T> {
    /// Pledge a structure's faith to a wonder.
    /// Special cases:
    /// - Wonder pledging to itself (structure_id == wonder_id): Starts base FP accumulation
    /// - Wonder pledging to another wonder: Only allowed if num_structures_pledged == 0
    fn pledge_faith(ref self: T, structure_id: ID, wonder_id: ID);

    /// Remove a structure's faith from a wonder.
    /// Can be called by structure owner or wonder owner.
    fn remove_faith(ref self: T, structure_id: ID);

    /// Update wonder ownership for faith point accumulation.
    /// Called when wonder ownership changes to:
    /// - Settle previous owner's accumulated points
    /// - Transfer ongoing rates to new owner
    fn update_wonder_ownership(ref self: T, wonder_id: ID);

    /// Update structure ownership for faith point accumulation.
    /// Called when pledged structure ownership changes to:
    /// - Settle previous owner's accumulated points
    /// - Transfer ongoing pledger rates to new owner
    fn update_structure_ownership(ref self: T, structure_id: ID);

    /// Claim accumulated faith points for a wonder.
    fn claim_wonder_points(ref self: T, wonder_id: ID);

    /// Claim a player's accumulated faith points for a specific wonder on their behalf.
    /// Anyone can call this to settle another player's pending points.
    fn claim_player_points(ref self: T, player: starknet::ContractAddress, wonder_id: ID);

    /// Blacklist a structure or address from pledging to a wonder.
    fn blacklist(ref self: T, wonder_id: ID, blocked_id: felt252);

    /// Remove a structure or address from blacklist.
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
