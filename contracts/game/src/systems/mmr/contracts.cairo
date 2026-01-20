// MMR System Contract
//
// Handles MMR updates for Blitz games after rankings are finalized.
// Called by prize_distribution_systems when a game completes.

use starknet::ContractAddress;
use crate::models::mmr::{GameMMRRecord, PlayerMMRStats};

/// Interface for the MMR token contract
#[starknet::interface]
pub trait IMMRToken<T> {
    fn get_mmr(self: @T, player: ContractAddress) -> u256;
    fn has_mmr(self: @T, player: ContractAddress) -> bool;
    fn initialize_player(ref self: T, player: ContractAddress);
    fn update_mmr(ref self: T, player: ContractAddress, new_mmr: u256);
    fn update_mmr_batch(ref self: T, updates: Array<(ContractAddress, u256)>);
}

/// Interface for the MMR systems
#[starknet::interface]
pub trait IMMRSystems<T> {
    /// Mark a series as ranked (MMR-eligible)
    /// Only callable by admin
    fn set_series_ranked(ref self: T, trial_id: u128, is_ranked: bool);

    /// Check if a series is ranked
    fn is_series_ranked(self: @T, trial_id: u128) -> bool;

    /// Process MMR updates for a completed game using explicit player/rank arrays
    fn process_game_mmr(
        ref self: T,
        trial_id: u128,
        players: Array<ContractAddress>,
        ranks: Array<u16>,
    );

    /// Process MMR updates for a completed game by reading from trial models
    /// This is the preferred method - called by prize_distribution_systems
    fn process_game_mmr_from_trial(ref self: T, trial_id: u128);

    /// Get a player's current MMR
    fn get_player_mmr(self: @T, player: ContractAddress) -> u128;

    /// Get a player's MMR stats
    fn get_player_stats(self: @T, player: ContractAddress) -> PlayerMMRStats;

    /// Get the MMR record for a player in a specific game
    fn get_game_mmr_record(self: @T, trial_id: u128, player: ContractAddress) -> GameMMRRecord;

    /// Check if a game is eligible for MMR updates
    fn is_game_mmr_eligible(self: @T, trial_id: u128, player_count: u16, entry_fee: u256) -> bool;
}


#[dojo::contract]
pub mod mmr_systems {
    use core::num::traits::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::WorldConfigUtilImpl;
    use crate::models::mmr::{
        GameMMRRecord, MMRConfig, MMRConfigDefaultImpl, PlayerMMRStats, PlayerMMRStatsTrait, SeriesMMRConfig,
    };
    use crate::models::rank::{PlayersRankTrial, RankList, RankPrize};
    use crate::systems::config::contracts::config_systems::assert_caller_is_admin;
    use crate::systems::utils::mmr::MMRCalculatorImpl;
    use super::{IMMRSystems, IMMRTokenDispatcher, IMMRTokenDispatcherTrait};

    // ================================
    // EVENTS
    // ================================

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct MMRGameProcessed {
        #[key]
        pub trial_id: u128,
        pub player_count: u16,
        pub median_mmr: u128,
        pub timestamp: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct PlayerMMRChanged {
        #[key]
        pub player: ContractAddress,
        #[key]
        pub trial_id: u128,
        pub old_mmr: u128,
        pub new_mmr: u128,
        pub rank: u16,
        pub timestamp: u64,
    }

    // ================================
    // IMPLEMENTATION
    // ================================

    #[abi(embed_v0)]
    pub impl MMRSystemsImpl of IMMRSystems<ContractState> {
        fn set_series_ranked(ref self: ContractState, trial_id: u128, is_ranked: bool) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // Only admin can set series as ranked
            assert_caller_is_admin(world);

            let mut series_config: SeriesMMRConfig = world.read_model(trial_id);
            series_config.is_ranked = is_ranked;
            world.write_model(@series_config);
        }

        fn is_series_ranked(self: @ContractState, trial_id: u128) -> bool {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let series_config: SeriesMMRConfig = world.read_model(trial_id);
            series_config.is_ranked
        }

        fn process_game_mmr(
            ref self: ContractState,
            trial_id: u128,
            players: Array<ContractAddress>,
            ranks: Array<u16>,
        ) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // Get MMR config
            let mmr_config: MMRConfig = WorldConfigUtilImpl::get_member(world, selector!("mmr_config"));

            // Check if MMR is enabled
            if !mmr_config.enabled {
                return;
            }

            // Check if this trial has already been processed
            let mut series_config: SeriesMMRConfig = world.read_model(trial_id);
            if series_config.mmr_processed {
                return;
            }

            // Check if series is ranked
            if !series_config.is_ranked {
                return;
            }

            // Verify arrays match
            let player_count: u16 = players.len().try_into().unwrap();
            assert!(player_count == ranks.len().try_into().unwrap(), "Players and ranks arrays must match");

            // Check minimum players
            if player_count < mmr_config.min_players {
                return;
            }

            // Check if token is configured (optional - we can still process records without it)
            let has_token = !mmr_config.mmr_token_address.is_zero();

            // Collect current MMRs
            let mut current_mmrs: Array<u128> = array![];
            let mut players_span = players.span();
            let mut i: u32 = 0;

            if has_token {
                // Get MMRs from token contract
                let mmr_token = IMMRTokenDispatcher { contract_address: mmr_config.mmr_token_address };

                while i < player_count.into() {
                    let player = *players_span.at(i);

                    // Initialize player if they don't have MMR
                    if !mmr_token.has_mmr(player) {
                        mmr_token.initialize_player(player);
                    }

                    // Get current MMR
                    let current_mmr: u128 = mmr_token.get_mmr(player).try_into().unwrap();
                    current_mmrs.append(current_mmr);
                    i += 1;
                };
            } else {
                // Use initial MMR from config (for testing or when token not deployed)
                // All players start at the same initial MMR
                while i < player_count.into() {
                    current_mmrs.append(mmr_config.initial_mmr);
                    i += 1;
                };
            }

            // Calculate new MMRs
            let updates = MMRCalculatorImpl::calculate_game_mmr_updates(
                mmr_config, players.span(), ranks.span(), current_mmrs.span(),
            );

            // Calculate median for event
            let median_mmr = MMRCalculatorImpl::calculate_median(current_mmrs.span());

            // Update records, stats, and optionally token
            let now = starknet::get_block_timestamp();
            let mut update_batch: Array<(ContractAddress, u256)> = array![];

            let mut j: u32 = 0;
            for (player, new_mmr) in updates {
                let old_mmr = *current_mmrs.span().at(j);
                let rank = *ranks.span().at(j);

                // Store game record
                let record = GameMMRRecord {
                    trial_id,
                    player,
                    mmr_before: old_mmr,
                    mmr_after: new_mmr,
                    rank,
                    player_count,
                    median_mmr,
                    timestamp: now,
                };
                world.write_model(@record);

                // Update player stats
                let mut stats: PlayerMMRStats = world.read_model(player);
                if stats.games_played == 0 {
                    // Initialize stats
                    stats = PlayerMMRStatsTrait::new(player, mmr_config.initial_mmr);
                }
                stats.record_game(new_mmr, old_mmr, now);
                world.write_model(@stats);

                // Add to batch update (for token)
                update_batch.append((player, new_mmr.into()));

                // Emit player event
                world
                    .emit_event(
                        @PlayerMMRChanged { player, trial_id, old_mmr, new_mmr, rank, timestamp: now },
                    );

                j += 1;
            };

            // Batch update MMR tokens (only if token is configured)
            if has_token {
                let mmr_token = IMMRTokenDispatcher { contract_address: mmr_config.mmr_token_address };
                mmr_token.update_mmr_batch(update_batch);
            }

            // Mark trial as processed
            series_config.mmr_processed = true;
            world.write_model(@series_config);

            // Emit game processed event
            world.emit_event(@MMRGameProcessed { trial_id, player_count, median_mmr, timestamp: now });
        }

        fn process_game_mmr_from_trial(ref self: ContractState, trial_id: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // Get MMR config first to check if enabled
            let mmr_config: MMRConfig = WorldConfigUtilImpl::get_member(world, selector!("mmr_config"));
            if !mmr_config.enabled {
                return;
            }

            // Check if already processed
            let series_config: SeriesMMRConfig = world.read_model(trial_id);
            if series_config.mmr_processed {
                return;
            }

            // Check if ranked
            if !series_config.is_ranked {
                return;
            }

            // Read the trial data
            let trial: PlayersRankTrial = world.read_model(trial_id);
            if trial.total_player_count_revealed == 0 {
                return;
            }

            // Check minimum players
            if trial.total_player_count_revealed < mmr_config.min_players {
                return;
            }

            // Collect all players and their ranks from the RankList model
            let mut players: Array<ContractAddress> = array![];
            let mut ranks: Array<u16> = array![];

            // Iterate through each rank (1 to last_rank)
            let mut rank: u16 = 1;
            while rank <= trial.last_rank {
                // Get the number of players at this rank
                let rank_prize: RankPrize = world.read_model((trial_id, rank));

                // Get each player at this rank
                let mut index: u16 = 0;
                while index < rank_prize.total_players_same_rank_count {
                    let rank_list: RankList = world.read_model((trial_id, rank, index));
                    players.append(rank_list.player);
                    ranks.append(rank);
                    index += 1;
                };

                rank += 1;
            };

            // Call the main process function
            self.process_game_mmr(trial_id, players, ranks);
        }

        fn get_player_mmr(self: @ContractState, player: ContractAddress) -> u128 {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let mmr_config: MMRConfig = WorldConfigUtilImpl::get_member(world, selector!("mmr_config"));

            if mmr_config.mmr_token_address.is_zero() {
                return mmr_config.initial_mmr;
            }

            let mmr_token = IMMRTokenDispatcher { contract_address: mmr_config.mmr_token_address };
            if !mmr_token.has_mmr(player) {
                return mmr_config.initial_mmr;
            }

            mmr_token.get_mmr(player).try_into().unwrap()
        }

        fn get_player_stats(self: @ContractState, player: ContractAddress) -> PlayerMMRStats {
            let world: WorldStorage = self.world(DEFAULT_NS());
            world.read_model(player)
        }

        fn get_game_mmr_record(self: @ContractState, trial_id: u128, player: ContractAddress) -> GameMMRRecord {
            let world: WorldStorage = self.world(DEFAULT_NS());
            world.read_model((trial_id, player))
        }

        fn is_game_mmr_eligible(
            self: @ContractState, trial_id: u128, player_count: u16, entry_fee: u256,
        ) -> bool {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let mmr_config: MMRConfig = WorldConfigUtilImpl::get_member(world, selector!("mmr_config"));

            // Check if MMR is enabled
            if !mmr_config.enabled {
                return false;
            }

            // Check if series is ranked
            let series_config: SeriesMMRConfig = world.read_model(trial_id);
            if !series_config.is_ranked {
                return false;
            }

            // Check minimum players
            if player_count < mmr_config.min_players {
                return false;
            }

            // Check minimum entry fee
            if entry_fee < mmr_config.min_entry_fee {
                return false;
            }

            true
        }
    }

    /// Get dispatcher for MMR systems
    pub fn get_dispatcher(world: @WorldStorage) -> super::IMMRSystemsDispatcher {
        let (addr, _) = world.dns(@"mmr_systems").unwrap();
        super::IMMRSystemsDispatcher { contract_address: addr }
    }
}
