use starknet::ContractAddress;

#[starknet::interface]
pub trait IFaithSystems<T> {
    fn pledge_faith(ref self: T, entity_id: u32, wonder_id: u32);
    fn revoke_faith(ref self: T, entity_id: u32);
    fn process_faith(ref self: T, wonder_id: u32);
    fn settle_faith_balance(ref self: T, entity_id: u32);
    fn fund_faith_prize_pool(ref self: T, season_id: u32, amount: u128);
    fn distribute_faith_season_prizes(ref self: T, season_id: u32, ranked_wonders: Span<u32>);
    fn claim_faith_prize(ref self: T, season_id: u32, wonder_id: u32);
    fn withdraw_unclaimed_faith_prize(ref self: T, season_id: u32);
    fn allocate_faith_holder_prizes(
        ref self: T,
        season_id: u32,
        wonder_id: u32,
        holders: Span<ContractAddress>,
    );
    fn record_wonder_capture(ref self: T, wonder_id: u32, new_owner: ContractAddress);
    fn update_faith_leaderboard(ref self: T, season_id: u32, wonder_ids: Span<u32>);
}

#[dojo::contract]
pub mod faith_systems {
    use core::num::traits::zero::Zero;
    use dojo::model::{Model, ModelStorage};
    use dojo::world::WorldStorage;
    use starknet::ContractAddress;

    use crate::alias::ID;
    use crate::constants::{DEFAULT_NS, ErrorMessages};
    use crate::models::config::{TickImpl, WorldConfigUtilImpl};
    use crate::models::faith::{
        FaithConfig, FaithPrizeBalance, FaithSeasonSnapshot, FaithSeasonState, FollowerAllegiance,
        FaithLeaderboardEntry, FaithPrizeConfig, FollowerFaithBalance, FollowerType, WonderFaith, WonderFaithHistory,
        WonderRank,
    };
    use crate::models::structure::{Structure, StructureCategory, StructureMetadata, StructureOwnerStoreImpl};

    const MAX_WONDER_ALLEGIANCE_DEPTH: u32 = 16;

    #[abi(embed_v0)]
    impl FaithSystemsImpl of super::IFaithSystems<ContractState> {
        fn fund_faith_prize_pool(ref self: ContractState, season_id: u32, amount: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut state: FaithSeasonState = world.read_model(season_id);
            if state.season_id == 0 {
                state.season_id = season_id;
            }
            state.prize_pool_total += amount;
            world.write_model(@state);
        }

        fn distribute_faith_season_prizes(ref self: ContractState, season_id: u32, ranked_wonders: Span<ID>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let current_tick = TickImpl::get_tick_interval(ref world).current();
            let mut state: FaithSeasonState = world.read_model(season_id);
            assert!(state.season_end_tick.is_non_zero(), "Season end not set");
            assert!(current_tick >= state.season_end_tick, "Season not ended");
            assert!(!state.distributed, "Already distributed");

            let config: FaithConfig = WorldConfigUtilImpl::get_member(world, selector!("faith_config"));
            let prize_config: FaithPrizeConfig = WorldConfigUtilImpl::get_member(world, selector!("faith_prize_config"));

            let mut prize_pool: u128 = state.prize_pool_total;
            if prize_pool.is_zero() {
                prize_pool = config.prize_pool_total;
                state.prize_pool_total = prize_pool;
            }

            let total_wonders: u32 = ranked_wonders.len();
            let mut idx: u32 = 0;
            let mut rank_pos: u32 = 1;
            loop {
                if idx >= total_wonders || rank_pos > 10 {
                    break;
                }

                let wonder_id: ID = *ranked_wonders.at(idx);
                let faith: WonderFaith = world.read_model(wonder_id);
                if faith.season_id != season_id {
                    idx += 1;
                    continue;
                }

                let mut tie_count: u32 = 1;
                loop {
                    if idx + tie_count >= total_wonders {
                        break;
                    }
                    let other_id: ID = *ranked_wonders.at(idx + tie_count);
                    let other_faith: WonderFaith = world.read_model(other_id);
                    if other_faith.season_fp != faith.season_fp {
                        break;
                    }
                    tie_count += 1;
                }

                let mut sum_bps: u32 = 0;
                let mut k: u32 = 0;
                loop {
                    if k >= tie_count {
                        break;
                    }
                    let rank = rank_pos + k;
                    if rank <= 10 {
                        sum_bps += rank_share_bps(prize_config, rank).into();
                    }
                    k += 1;
                }

                let group_prize: u128 = prize_pool * sum_bps.into() / 10_000_u128;
                let per_prize: u128 = if tie_count.is_non_zero() { group_prize / tie_count.into() } else { 0 };
                let owner_prize: u128 = per_prize * prize_config.wonder_owner_share_bps.into() / 10_000_u128;
                let holders_prize: u128 = per_prize * prize_config.fp_holders_share_bps.into() / 10_000_u128;

                let mut t: u32 = 0;
                loop {
                    if t >= tie_count {
                        break;
                    }
                    let tied_wonder: ID = *ranked_wonders.at(idx + t);
                    distribute_faith_prize_internal(
                        ref world,
                        season_id,
                        tied_wonder,
                        rank_pos,
                        per_prize,
                        owner_prize,
                        holders_prize,
                        Zero::zero(),
                    );
                    t += 1;
                }

                idx += tie_count;
                rank_pos += tie_count;
            }

            let mut unallocated_bps: u32 = 0;
            while rank_pos <= 10 {
                unallocated_bps += rank_share_bps(prize_config, rank_pos).into();
                rank_pos += 1;
            }
            if state.claim_window_end_tick == 0 {
                state.claim_window_end_tick = current_tick + config.claim_window_ticks.into();
            }
            state.unallocated_prize = prize_pool * unallocated_bps.into() / 10_000_u128;
            state.distributed = true;
            world.write_model(@state);
        }
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

            if entity_type == FollowerType::Wonder {
                assert_no_wonder_cycle(ref world, entity_id, wonder_id);
            }

            let mut faith: WonderFaith = world.read_model(wonder_id);
            let last_fp_index: u128 = match entity_type {
                FollowerType::Realm => faith.realm_fp_index,
                FollowerType::Village => faith.village_fp_index,
                FollowerType::Wonder => faith.wonder_fp_index,
                FollowerType::None => 0,
            };
            let current_tick = TickImpl::get_tick_interval(ref world).current();
            world.write_model(
                @FollowerAllegiance {
                    entity_id,
                    wonder_id,
                    pledge_tick: current_tick,
                    last_fp_tick: current_tick,
                    last_fp_index,
                    accumulated_fp: 0,
                    entity_type,
                },
            );

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

            self.settle_faith_balance(entity_id);
            allegiance = world.read_model(entity_id);

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

        fn process_faith(ref self: ContractState, wonder_id: ID) {
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
            total_contribution += faith.realm_follower_count.into() * config.realm_follower_fp.into();
            total_contribution += faith.village_follower_count.into() * config.village_follower_fp.into();
            total_contribution += faith.wonder_follower_count.into() * config.wonder_follower_fp.into();

            if total_contribution.is_zero() {
                faith.last_tick_processed = current_tick;
                world.write_model(@faith);
                return;
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

            let realm_share: u128 = if faith.realm_follower_count > 0 {
                follower_pool * config.realm_follower_fp.into() / total_contribution
            } else {
                0_u128
            };
            let village_share: u128 = if faith.village_follower_count > 0 {
                follower_pool * config.village_follower_fp.into() / total_contribution
            } else {
                0_u128
            };
            let wonder_share: u128 = if faith.wonder_follower_count > 0 {
                follower_pool * config.wonder_follower_fp.into() / total_contribution
            } else {
                0_u128
            };
            faith.realm_fp_index += realm_share;
            faith.village_fp_index += village_share;
            faith.wonder_fp_index += wonder_share;

            faith.total_fp_generated += generated_fp;
            faith.season_fp += generated_fp;
            faith.current_owner_fp += owner_share + owner_holder_share;
            faith.last_tick_processed = current_tick;
            world.write_model(@faith);
        }

        fn settle_faith_balance(ref self: ContractState, entity_id: ID) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut allegiance: FollowerAllegiance = world.read_model(entity_id);
            assert!(allegiance.wonder_id.is_non_zero(), "Not pledged");

            let faith: WonderFaith = world.read_model(allegiance.wonder_id);
            let current_index: u128 = match allegiance.entity_type {
                FollowerType::Realm => faith.realm_fp_index,
                FollowerType::Village => faith.village_fp_index,
                FollowerType::Wonder => faith.wonder_fp_index,
                FollowerType::None => 0,
            };
            assert!(current_index >= allegiance.last_fp_index, "Invalid faith index");
            let delta: u128 = current_index - allegiance.last_fp_index;
            let current_tick = TickImpl::get_tick_interval(ref world).current();

            if delta.is_non_zero() {
                let holder: ContractAddress = StructureOwnerStoreImpl::retrieve(ref world, entity_id);
                if holder.is_non_zero() {
                    let mut balance: FollowerFaithBalance =
                        world.read_model((allegiance.wonder_id, faith.season_id, holder));
                    balance.total_fp += delta;
                    balance.last_fp_update_tick = current_tick;
                    world.write_model(@balance);
                }
                allegiance.accumulated_fp += delta;
                allegiance.last_fp_tick = current_tick;
            }

            allegiance.last_fp_index = current_index;
            world.write_model(@allegiance);
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

        fn allocate_faith_holder_prizes(
            ref self: ContractState,
            season_id: u32,
            wonder_id: ID,
            holders: Span<ContractAddress>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut snapshot: FaithSeasonSnapshot = world.read_model((season_id, wonder_id));
            let mut total_holder_fp: u128 = 0;
            for holder in holders {
                let balance: FollowerFaithBalance = world.read_model((wonder_id, season_id, *holder));
                total_holder_fp += balance.total_fp;
            }
            snapshot.total_holder_fp = total_holder_fp;
            world.write_model(@snapshot);

            for holder in holders {
                let balance: FollowerFaithBalance = world.read_model((wonder_id, season_id, *holder));
                if total_holder_fp.is_zero() {
                    continue;
                }
                let share: u128 = snapshot.holders_prize * balance.total_fp / total_holder_fp;
                let mut prize: FaithPrizeBalance = world.read_model((season_id, wonder_id, *holder));
                if prize.amount.is_zero() {
                    prize.season_id = season_id;
                    prize.wonder_id = wonder_id;
                    prize.claimant = *holder;
                }
                prize.amount += share;
                world.write_model(@prize);
            }
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

        fn update_faith_leaderboard(ref self: ContractState, season_id: u32, wonder_ids: Span<ID>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            let mut i: u32 = 0;
            let total: u32 = wonder_ids.len();
            loop {
                if i >= total {
                    break;
                }
                let wonder_id: ID = *wonder_ids.at(i);
                let faith: WonderFaith = world.read_model(wonder_id);
                if faith.season_id != season_id {
                    i += 1;
                    continue;
                }

                let mut rank: u32 = 1;
                let mut j: u32 = 0;
                loop {
                    if j >= total {
                        break;
                    }
                    if j != i {
                        let other_id: ID = *wonder_ids.at(j);
                        let other_faith: WonderFaith = world.read_model(other_id);
                        if other_faith.season_id == season_id {
                            if (other_faith.season_fp > faith.season_fp)
                                || ((other_faith.season_fp == faith.season_fp) && (other_id < wonder_id)) {
                                rank += 1;
                            }
                        }
                    }
                    j += 1;
                }

                let follower_count: u32 =
                    faith.realm_follower_count + faith.village_follower_count + faith.wonder_follower_count;
                let entry = FaithLeaderboardEntry {
                    rank,
                    season_id,
                    wonder_id,
                    total_season_fp: faith.season_fp,
                    follower_count,
                };
                world.write_model(@entry);

                let mut stored_rank: WonderRank = world.read_model((wonder_id, season_id));
                stored_rank.wonder_id = wonder_id;
                stored_rank.season_id = season_id;
                stored_rank.current_rank = rank;
                world.write_model(@stored_rank);

                i += 1;
            }
        }
    }

    pub(crate) fn distribute_faith_prize_internal(
        ref world: WorldStorage,
        season_id: u32,
        wonder_id: ID,
        rank: u32,
        total_prize: u128,
        owner_prize: u128,
        holders_prize: u128,
        owner_recipient: ContractAddress,
    ) {
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

    fn rank_share_bps(config: FaithPrizeConfig, rank: u32) -> u16 {
        match rank {
            1 => config.rank_1_share_bps,
            2 => config.rank_2_share_bps,
            3 => config.rank_3_share_bps,
            4 => config.rank_4_share_bps,
            5 => config.rank_5_share_bps,
            6 => config.rank_6_share_bps,
            7 => config.rank_7_share_bps,
            8 => config.rank_8_share_bps,
            9 => config.rank_9_share_bps,
            10 => config.rank_10_share_bps,
            _ => 0,
        }
    }

    fn assert_no_wonder_cycle(ref world: WorldStorage, follower_id: ID, target_wonder_id: ID) {
        let mut current: ID = target_wonder_id;
        let mut depth: u32 = 0;
        loop {
            if current == follower_id {
                panic!("Circular wonder allegiance");
            }
            let allegiance: FollowerAllegiance = world.read_model(current);
            if allegiance.wonder_id.is_zero() {
                break;
            }
            depth += 1;
            assert!(depth < MAX_WONDER_ALLEGIANCE_DEPTH, "Faith chain too deep");
            current = allegiance.wonder_id;
        }
    }
}
