use starknet::ContractAddress;
use crate::alias::ID;

#[starknet::interface]
pub trait IFaithSystems<T> {
    /// Pledge a structure's faith to a wonder.
    /// Special cases:
    /// - Wonder pledging to itself (structure_id == wonder_id): Starts base FP accumulation
    /// - Wonder pledging to another wonder: Only allowed if num_structures_pledged == 0
    /// - New wonder owner: Must call this to claim ownership and settle previous owner
    fn pledge_faith(ref self: T, structure_id: ID, wonder_id: ID);

    /// Remove a structure's faith from a wonder.
    /// Can be called by structure owner or wonder owner.
    fn remove_faith(ref self: T, structure_id: ID);

    /// Claim accumulated faith points for a wonder.
    fn claim_faith_points(ref self: T, wonder_id: ID);

    /// Blacklist a structure or address from pledging to a wonder.
    fn blacklist(ref self: T, wonder_id: ID, blocked_id: felt252);

    /// Remove a structure or address from blacklist.
    fn unblacklist(ref self: T, wonder_id: ID, blocked_id: felt252);

    /// View: Get pending faith points for a player
    fn get_pending_faith_points(self: @T, player: ContractAddress) -> u128;

    /// View: Get wonder's current FP emission rate
    fn get_wonder_fp_rate(self: @T, wonder_id: ID) -> u16;
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
        FaithfulStructure, PlayerTotalFaithPoints, WonderFaith, WonderFaithBlacklist, WonderFaithWinner,
    };
    use crate::models::owner::OwnerAddressTrait;
    use crate::models::structure::{
        StructureBase, StructureBaseStoreImpl, StructureCategory, StructureOwnerStoreImpl, Wonder,
    };

    #[abi(embed_v0)]
    impl FaithSystemsImpl of super::IFaithSystems<ContractState> {
        fn pledge_faith(ref self: ContractState, structure_id: ID, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_started_and_not_over();

            let caller = starknet::get_caller_address();
            let now = starknet::get_block_timestamp();

            // Get structure and verify ownership
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            let structure_base: StructureBase = StructureBaseStoreImpl::retrieve(ref world, structure_id);

            // Verify wonder exists
            let wonder: Wonder = world.read_model(wonder_id);
            assert!(wonder.structure_id == wonder_id && wonder.structure_id != 0, "Invalid wonder");

            // Load wonder faith state
            let mut wonder_faith: WonderFaith = world.read_model(wonder_id);
            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);

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
            let (to_owner, to_pledger) = InternalImpl::_get_fp_rates(
                structure_base.category, structure_id, wonder_id, faith_config,
            );

            // Check if this is a wonder pledging to another wonder
            let is_self_pledge = structure_id == wonder_id;
            let is_wonder_submitting = InternalImpl::_is_wonder(ref world, structure_id) && !is_self_pledge;

            if is_wonder_submitting {
                // Can only submit if no one is pledged to the submitting wonder
                let submitting_wonder_faith: WonderFaith = world.read_model(structure_id);
                assert!(
                    submitting_wonder_faith.num_structures_pledged == 0, "Cannot submit wonder with active pledges",
                );
            }

            // Handle self-pledge (wonder pledging to itself)
            if is_self_pledge {
                assert!(caller == wonder_owner, "Only wonder owner can self-pledge");

                // Settle previous owner's points if owner changed
                if wonder_faith.last_recorded_owner != wonder_owner && wonder_faith.last_recorded_owner.is_non_zero() {
                    InternalImpl::_settle_owner_points(ref world, wonder_faith.last_recorded_owner, now);
                }
                wonder_faith.last_recorded_owner = wonder_owner;
            } else {
                // Regular pledge - must own the structure
                structure_owner.assert_caller_owner();
            }

            // Check if already faithful somewhere
            let mut faithful_structure: FaithfulStructure = world.read_model(structure_id);
            if faithful_structure.wonder_id != 0 && faithful_structure.faithful_since != 0 {
                // Remove from previous wonder first
                InternalImpl::_remove_from_wonder(ref world, structure_id, faithful_structure.wonder_id, now);
            }

            // Claim current wonder's points before state change
            InternalImpl::_claim_wonder_points_internal(ref world, wonder_id, now);

            // Update faithful structure
            faithful_structure.structure_id = structure_id;
            faithful_structure.wonder_id = wonder_id;
            faithful_structure.faithful_since = now;
            faithful_structure.fp_to_wonder_owner_per_sec = to_owner;
            faithful_structure.fp_to_struct_owner_per_sec = to_pledger;
            world.write_model(@faithful_structure);

            // Update wonder faith state
            wonder_faith.claim_per_sec += to_owner + to_pledger;
            wonder_faith.num_structures_pledged += 1;
            world.write_model(@wonder_faith);

            // Update player points rates
            InternalImpl::_update_player_rates_add(ref world, structure_owner, 0, to_pledger, now);
            InternalImpl::_update_player_rates_add(ref world, wonder_owner, to_owner, 0, now);

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
            let faithful_structure: FaithfulStructure = world.read_model(structure_id);
            assert!(faithful_structure.wonder_id != 0, "Structure not faithful to any wonder");

            let wonder_id = faithful_structure.wonder_id;
            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);

            // Authorization: structure owner OR wonder owner can remove
            assert!(
                caller == structure_owner || caller == wonder_owner, "Only structure owner or wonder owner can remove",
            );

            // Special case: Wonder removing itself (self-pledge)
            if structure_id == wonder_id {
                let wonder_faith: WonderFaith = world.read_model(wonder_id);
                // num_structures_pledged includes self, so check if only self remains
                assert!(wonder_faith.num_structures_pledged <= 1, "Cannot remove self while others are pledged");
            }

            // Perform removal
            InternalImpl::_remove_from_wonder(ref world, structure_id, wonder_id, now);

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

        fn claim_faith_points(ref self: ContractState, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);
            season_config.assert_main_game_started_and_point_registration_grace_not_elapsed();

            let now = starknet::get_block_timestamp();
            InternalImpl::_claim_wonder_points_internal(ref world, wonder_id, now);
        }

        fn blacklist(ref self: ContractState, wonder_id: ID, blocked_id: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();

            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(caller == wonder_owner, "Only wonder owner can blacklist");

            let mut blacklist_entry: WonderFaithBlacklist = world.read_model((wonder_id, blocked_id));
            blacklist_entry.wonder_id = wonder_id;
            blacklist_entry.blocked_id = blocked_id;
            blacklist_entry.is_blocked = true;
            world.write_model(@blacklist_entry);
        }

        fn unblacklist(ref self: ContractState, wonder_id: ID, blocked_id: felt252) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();

            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(caller == wonder_owner, "Only wonder owner can unblacklist");

            let mut blacklist_entry: WonderFaithBlacklist = world.read_model((wonder_id, blocked_id));
            blacklist_entry.is_blocked = false;
            world.write_model(@blacklist_entry);
        }

        fn get_pending_faith_points(self: @ContractState, player: ContractAddress) -> u128 {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let season_config = SeasonConfigImpl::get(world);

            let now = starknet::get_block_timestamp();
            let end_time = if season_config.has_ended() {
                season_config.end_at
            } else {
                now
            };

            let player_fp: PlayerTotalFaithPoints = world.read_model(player);
            if player_fp.last_updated_at == 0 {
                return 0;
            }

            let time_elapsed = end_time - player_fp.last_updated_at;
            let pending = (player_fp.points_per_sec_as_owner + player_fp.points_per_sec_as_pledger).into()
                * time_elapsed.into();

            player_fp.points_claimed + pending
        }

        fn get_wonder_fp_rate(self: @ContractState, wonder_id: ID) -> u16 {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let wonder_faith: WonderFaith = world.read_model(wonder_id);
            wonder_faith.claim_per_sec
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _get_fp_rates(category: u8, structure_id: ID, wonder_id: ID, faith_config: FaithConfig) -> (u16, u16) {
            let is_self_pledge = structure_id == wonder_id;

            let total = if is_self_pledge {
                faith_config.wonder_base_fp_per_sec
            } else if category == StructureCategory::Realm.into() {
                faith_config.realm_fp_per_sec
            } else if category == StructureCategory::Village.into() {
                faith_config.village_fp_per_sec
            } else if category == StructureCategory::HolySite.into() {
                faith_config.holy_site_fp_per_sec
            } else {
                // Check if it's a wonder submitting to another wonder
                faith_config.wonder_base_fp_per_sec
            };

            let to_owner: u16 = (total.into() * faith_config.owner_share_percent.into() / 10000_u32)
                .try_into()
                .unwrap();
            let to_pledger: u16 = total - to_owner;
            (to_owner, to_pledger)
        }

        fn _is_wonder(ref world: WorldStorage, structure_id: ID) -> bool {
            let wonder: Wonder = world.read_model(structure_id);
            wonder.structure_id == structure_id && wonder.structure_id != 0
        }

        fn _remove_from_wonder(ref world: WorldStorage, structure_id: ID, wonder_id: ID, now: u64) {
            // Load current state
            let mut faithful_structure: FaithfulStructure = world.read_model(structure_id);
            let mut wonder_faith: WonderFaith = world.read_model(wonder_id);

            let structure_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, structure_id);
            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);

            let to_owner = faithful_structure.fp_to_wonder_owner_per_sec;
            let to_pledger = faithful_structure.fp_to_struct_owner_per_sec;

            // Claim wonder points before state change
            Self::_claim_wonder_points_internal(ref world, wonder_id, now);

            // Update wonder faith state (subtract rates)
            wonder_faith.claim_per_sec -= to_owner + to_pledger;
            wonder_faith.num_structures_pledged -= 1;
            world.write_model(@wonder_faith);

            // Clear faithful structure
            faithful_structure.wonder_id = 0;
            faithful_structure.faithful_since = 0;
            faithful_structure.fp_to_wonder_owner_per_sec = 0;
            faithful_structure.fp_to_struct_owner_per_sec = 0;
            world.write_model(@faithful_structure);

            // Update player points rates (subtract)
            Self::_update_player_rates_sub(ref world, structure_owner, 0, to_pledger, now);
            Self::_update_player_rates_sub(ref world, wonder_owner, to_owner, 0, now);
        }

        fn _claim_wonder_points_internal(ref world: WorldStorage, wonder_id: ID, now: u64) {
            let season_config = SeasonConfigImpl::get(world);
            let mut wonder_faith: WonderFaith = world.read_model(wonder_id);

            // Determine end time (cap at season end)
            let end_time = if season_config.has_ended() {
                season_config.end_at
            } else {
                now
            };

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

            // Settle last recorded owner's points
            if wonder_faith.last_recorded_owner.is_non_zero() {
                Self::_settle_owner_points(ref world, wonder_faith.last_recorded_owner, end_time);
            }

            // Check and update winner
            let mut winner: WonderFaithWinner = world.read_model(WORLD_CONFIG_ID);
            if wonder_faith.claimed_points > winner.claimed_points {
                let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
                winner.world_id = WORLD_CONFIG_ID;
                winner.wonder_id = wonder_id;
                winner.claimed_points = wonder_faith.claimed_points;
                winner.owner = wonder_owner;
                world.write_model(@winner);
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

        fn _update_player_rates_add(
            ref world: WorldStorage, player: ContractAddress, owner_delta: u16, pledger_delta: u16, now: u64,
        ) {
            let season_config = SeasonConfigImpl::get(world);
            let end_time = if season_config.has_ended() {
                season_config.end_at
            } else {
                now
            };

            let mut player_fp: PlayerTotalFaithPoints = world.read_model(player);

            // First, claim pending points
            if player_fp.last_updated_at > 0 {
                let time_elapsed = end_time - player_fp.last_updated_at;
                if time_elapsed > 0 {
                    let pending: u128 = (player_fp.points_per_sec_as_owner + player_fp.points_per_sec_as_pledger).into()
                        * time_elapsed.into();
                    player_fp.points_claimed += pending;
                }
            }

            // Update rates (add)
            player_fp.player = player;
            player_fp.points_per_sec_as_owner += owner_delta;
            player_fp.points_per_sec_as_pledger += pledger_delta;
            player_fp.last_updated_at = end_time;

            world.write_model(@player_fp);
        }

        fn _update_player_rates_sub(
            ref world: WorldStorage, player: ContractAddress, owner_delta: u16, pledger_delta: u16, now: u64,
        ) {
            let season_config = SeasonConfigImpl::get(world);
            let end_time = if season_config.has_ended() {
                season_config.end_at
            } else {
                now
            };

            let mut player_fp: PlayerTotalFaithPoints = world.read_model(player);

            // First, claim pending points
            if player_fp.last_updated_at > 0 {
                let time_elapsed = end_time - player_fp.last_updated_at;
                if time_elapsed > 0 {
                    let pending: u128 = (player_fp.points_per_sec_as_owner + player_fp.points_per_sec_as_pledger).into()
                        * time_elapsed.into();
                    player_fp.points_claimed += pending;
                }
            }

            // Update rates (subtract)
            player_fp.points_per_sec_as_owner -= owner_delta;
            player_fp.points_per_sec_as_pledger -= pledger_delta;
            player_fp.last_updated_at = end_time;

            world.write_model(@player_fp);
        }

        fn _settle_owner_points(ref world: WorldStorage, owner: ContractAddress, now: u64) {
            // This settles the owner's accumulated points
            Self::_update_player_rates_add(ref world, owner, 0, 0, now);
        }
    }
}
