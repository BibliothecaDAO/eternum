use starknet::ContractAddress;

#[starknet::interface]
pub trait IFaithSystems<T> {
    fn pledge_faith(ref self: T, entity_id: u32, wonder_id: u32);
    fn revoke_faith(ref self: T, entity_id: u32);
    fn process_faith(ref self: T, wonder_id: u32, follower_ids: Span<u32>);
    fn distribute_faith_prize(
        ref self: T,
        season_id: u32,
        wonder_id: u32,
        rank: u32,
        total_prize: u128,
        owner_prize: u128,
        holders_prize: u128,
        owner_recipient: ContractAddress,
    );
    fn claim_faith_prize(ref self: T, season_id: u32, wonder_id: u32);
    fn withdraw_unclaimed_faith_prize(ref self: T, season_id: u32);
    fn record_wonder_capture(ref self: T, wonder_id: u32, new_owner: ContractAddress);
}

#[dojo::contract]
pub mod faith_systems {
    use core::array::ArrayTrait;
    use core::num::traits::zero::Zero;
    use dojo::model::{Model, ModelStorage};
    use dojo::world::WorldStorage;
    use starknet::ContractAddress;

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, ErrorMessages};
    use crate::models::config::{TickImpl, WorldConfigUtilImpl};
    use crate::models::faith::{
        FaithConfig, FaithPrizeBalance, FaithSeasonSnapshot, FaithSeasonState, FollowerAllegiance,
        FollowerFaithBalance, FollowerType, WonderFaith, WonderFaithHistory,
    };
    use crate::models::structure::{Structure, StructureCategory, StructureMetadata, StructureOwnerStoreImpl};

    #[abi(embed_v0)]
    impl FaithSystemsImpl of super::IFaithSystems<ContractState> {
        fn pledge_faith(ref self: ContractState, entity_id: ID, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();

            let entity_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, entity_id);
            assert!(entity_owner.is_non_zero(), "Entity not found");
            assert(entity_owner == caller, ErrorMessages::NOT_OWNER);

            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(wonder_owner.is_non_zero(), "Wonder not found");

            if entity_owner == wonder_owner {
                panic!("Cannot pledge to own Wonder");
            }

            let allegiance: FollowerAllegiance = world.read_model(entity_id);
            assert!(allegiance.wonder_id.is_zero(), "Already pledged");

            let structure_ptr = Model::<Structure>::ptr_from_keys(entity_id);
            let category: u8 = world.read_member(structure_ptr, selector!("category"));
            assert!(category.is_non_zero(), "Entity not found");
            let metadata: StructureMetadata = world.read_member(structure_ptr, selector!("metadata"));

            let entity_type = if metadata.has_wonder {
                FollowerType::Wonder
            } else if category == StructureCategory::Village.into() {
                FollowerType::Village
            } else {
                FollowerType::Realm
            };

            let now = starknet::get_block_timestamp();
            world.write_model(
                @FollowerAllegiance {
                    entity_id,
                    wonder_id,
                    pledge_tick: now,
                    last_fp_tick: now,
                    accumulated_fp: 0,
                    entity_type,
                },
            );

            let mut faith: WonderFaith = world.read_model(wonder_id);
            match entity_type {
                FollowerType::Realm => { faith.realm_follower_count += 1; },
                FollowerType::Village => { faith.village_follower_count += 1; },
                FollowerType::Wonder => { faith.wonder_follower_count += 1; },
                FollowerType::None => {},
            }
            world.write_model(@faith);
        }

        fn revoke_faith(ref self: ContractState, entity_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let caller = starknet::get_caller_address();
            let entity_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, entity_id);
            assert!(entity_owner.is_non_zero(), "Entity not found");
            assert(entity_owner == caller, ErrorMessages::NOT_OWNER);

            let mut allegiance: FollowerAllegiance = world.read_model(entity_id);
            assert!(allegiance.wonder_id.is_non_zero(), "Not pledged");
            let wonder_id = allegiance.wonder_id;

            let mut faith: WonderFaith = world.read_model(wonder_id);
            match allegiance.entity_type {
                FollowerType::Realm => {
                    if faith.realm_follower_count > 0 {
                        faith.realm_follower_count -= 1;
                    }
                },
                FollowerType::Village => {
                    if faith.village_follower_count > 0 {
                        faith.village_follower_count -= 1;
                    }
                },
                FollowerType::Wonder => {
                    if faith.wonder_follower_count > 0 {
                        faith.wonder_follower_count -= 1;
                    }
                },
                FollowerType::None => {},
            }
            world.write_model(@faith);

            allegiance.wonder_id = 0;
            world.write_model(@allegiance);
        }

        fn process_faith(ref self: ContractState, wonder_id: ID, follower_ids: Span<ID>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let tick_config = TickImpl::get_tick_interval(ref world);
            let current_tick = tick_config.current();
            let mut faith: WonderFaith = world.read_model(wonder_id);

            if faith.last_tick_processed == 0 {
                faith.last_tick_processed = current_tick;
                world.write_model(@faith);
                return;
            }

            if current_tick <= faith.last_tick_processed {
                return;
            }

            let elapsed_ticks: u64 = current_tick - faith.last_tick_processed;
            let config: FaithConfig = WorldConfigUtilImpl::get_member(world, selector!("faith_config"));

            let mut per_tick_fp: u128 = config.wonder_base_fp.into();
            per_tick_fp += (faith.realm_follower_count.into() * config.realm_follower_fp.into());
            per_tick_fp += (faith.village_follower_count.into() * config.village_follower_fp.into());
            per_tick_fp += (faith.wonder_follower_count.into() * config.wonder_follower_fp.into());

            let generated_fp: u128 = per_tick_fp * elapsed_ticks.into();
            if generated_fp.is_zero() {
                faith.last_tick_processed = current_tick;
                world.write_model(@faith);
                return;
            }

            let owner_share: u128 = generated_fp * config.owner_share_bps.into() / 10_000_u128;
            let follower_pool: u128 = generated_fp * config.follower_share_bps.into() / 10_000_u128;

            let owner_contribution: u128 = config.wonder_base_fp.into();
            let mut total_contribution: u128 = owner_contribution;
            let mut contributions: Array<(ID, u128)> = array![];

            for follower_id in follower_ids {
                let allegiance: FollowerAllegiance = world.read_model(*follower_id);
                if allegiance.wonder_id != wonder_id {
                    continue;
                }
                let contribution: u128 = match allegiance.entity_type {
                    FollowerType::Realm => config.realm_follower_fp.into(),
                    FollowerType::Village => config.village_follower_fp.into(),
                    FollowerType::Wonder => config.wonder_follower_fp.into(),
                    FollowerType::None => 0_u128,
                };
                if contribution.is_zero() {
                    continue;
                }
                total_contribution += contribution;
                contributions.append((*follower_id, contribution));
            }

            let owner_holder_share: u128 = if total_contribution.is_non_zero() {
                follower_pool * owner_contribution / total_contribution
            } else {
                0_u128
            };

            let wonder_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            if wonder_owner.is_non_zero() {
                let mut owner_balance: FollowerFaithBalance = world.read_model((wonder_id, faith.season_id, wonder_owner));
                owner_balance.total_fp += owner_holder_share;
                owner_balance.last_fp_update_tick = current_tick;
                world.write_model(@owner_balance);
            }

            for (follower_id, contribution) in contributions {
                let share: u128 = follower_pool * contribution / total_contribution;
                if share.is_non_zero() {
                    let holder: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, follower_id);
                    if holder.is_non_zero() {
                        let mut balance: FollowerFaithBalance = world.read_model((wonder_id, faith.season_id, holder));
                        balance.total_fp += share;
                        balance.last_fp_update_tick = current_tick;
                        world.write_model(@balance);
                    }
                }

                let mut allegiance: FollowerAllegiance = world.read_model(follower_id);
                if allegiance.wonder_id == wonder_id {
                    allegiance.accumulated_fp += contribution * elapsed_ticks.into();
                    allegiance.last_fp_tick = current_tick;
                    world.write_model(@allegiance);
                }
            }

            faith.total_fp_generated += generated_fp;
            faith.season_fp += generated_fp;
            faith.current_owner_fp += owner_share + owner_holder_share;
            faith.last_tick_processed = current_tick;
            world.write_model(@faith);
        }

        fn distribute_faith_prize(
            ref self: ContractState,
            season_id: u32,
            wonder_id: ID,
            rank: u32,
            total_prize: u128,
            owner_prize: u128,
            holders_prize: u128,
            owner_recipient: ContractAddress,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let current_tick = TickImpl::get_tick_interval(ref world).current();
            let config: FaithConfig = WorldConfigUtilImpl::get_member(world, selector!("faith_config"));

            let mut state: FaithSeasonState = world.read_model(season_id);
            if state.season_id == 0 {
                state.season_id = season_id;
            }
            if state.season_end_tick == 0 {
                state.season_end_tick = current_tick;
            }
            if state.claim_window_end_tick == 0 {
                state.claim_window_end_tick = current_tick + config.claim_window_ticks.into();
            }
            state.prize_pool_total = total_prize;
            state.distributed = true;
            world.write_model(@state);

            let faith: WonderFaith = world.read_model(wonder_id);
            let snapshot = FaithSeasonSnapshot {
                season_id,
                wonder_id,
                season_fp: faith.season_fp,
                total_holder_fp: 0,
                total_owner_fp: faith.current_owner_fp,
                rank,
                total_prize,
                owner_prize,
                holders_prize,
                distributed: true,
            };
            world.write_model(@snapshot);

            let mut recipient: ContractAddress = owner_recipient;
            if recipient.is_zero() {
                recipient = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            }
            if recipient.is_non_zero() {
                let prize = FaithPrizeBalance {
                    season_id,
                    wonder_id,
                    claimant: recipient,
                    amount: owner_prize,
                    claimed: false,
                };
                world.write_model(@prize);
            }
        }

        fn claim_faith_prize(ref self: ContractState, season_id: u32, wonder_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let current_tick = TickImpl::get_tick_interval(ref world).current();
            let state: FaithSeasonState = world.read_model(season_id);
            assert!(state.distributed, "Not distributed");
            assert!(current_tick <= state.claim_window_end_tick, "Claim window closed");

            let caller = starknet::get_caller_address();
            let mut balance: FaithPrizeBalance = world.read_model((season_id, wonder_id, caller));
            assert!(balance.amount.is_non_zero(), "No prize");
            assert!(!balance.claimed, "Already claimed");
            balance.claimed = true;
            world.write_model(@balance);
        }

        fn withdraw_unclaimed_faith_prize(ref self: ContractState, season_id: u32) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let current_tick = TickImpl::get_tick_interval(ref world).current();
            let mut state: FaithSeasonState = world.read_model(season_id);
            assert!(state.distributed, "Not distributed");
            assert!(current_tick > state.claim_window_end_tick, "Claim window not ended");
            state.leftover_withdrawn = true;
            world.write_model(@state);
        }

        fn record_wonder_capture(ref self: ContractState, wonder_id: ID, new_owner: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let old_owner: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, wonder_id);
            assert!(old_owner.is_non_zero(), "Wonder not found");

            let mut faith: WonderFaith = world.read_model(wonder_id);
            let current_tick = TickImpl::get_tick_interval(ref world).current();
            let history = WonderFaithHistory {
                wonder_id,
                season_id: faith.season_id,
                original_owner: old_owner,
                fp_earned_while_owner: faith.current_owner_fp,
                ownership_start_tick: faith.last_tick_processed,
                ownership_end_tick: current_tick,
                prize_claimed: false,
            };
            world.write_model(@history);

            faith.current_owner_fp = 0;
            world.write_model(@faith);

            if new_owner.is_non_zero() && new_owner != old_owner {
                StructureOwnerStoreImpl::store(new_owner, ref world, wonder_id);
            }
        }
    }
}
