// MMR System Contract
//
// Handles MMR updates for Blitz games after rankings are finalized.
// Uses commit + permissionless per-player claims to avoid lobby-wide loops.

use crate::models::mmr::{GameMMRRecord, MMRGameMeta, PlayerMMRStats};
use starknet::ContractAddress;

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

    /// Commit MMR metadata (medians) for a completed game
    /// Enables permissionless per-player claims without lobby-wide loops
    fn commit_game_mmr_meta(ref self: T, trial_id: u128, game_median: u128, global_median: u128);

    /// Permissionless per-player MMR claim for a completed game
    fn claim_game_mmr(ref self: T, trial_id: u128, player: ContractAddress);

    /// Get a player's current MMR
    fn get_player_mmr(self: @T, player: ContractAddress) -> u128;

    /// Get a player's MMR stats
    fn get_player_stats(self: @T, player: ContractAddress) -> PlayerMMRStats;

    /// Get the MMR record for a player in a specific game
    fn get_game_mmr_record(self: @T, trial_id: u128, player: ContractAddress) -> GameMMRRecord;

    /// Get committed MMR metadata for a game
    fn get_game_mmr_meta(self: @T, trial_id: u128) -> MMRGameMeta;

    /// Check if a player has already claimed their MMR for a game
    fn has_player_claimed_mmr(self: @T, trial_id: u128, player: ContractAddress) -> bool;

    /// Check if a game is eligible for MMR updates
    fn is_game_mmr_eligible(self: @T, trial_id: u128, player_count: u16, entry_fee: u256) -> bool;
}


#[dojo::contract]
pub mod mmr_systems {
    use core::num::traits::Zero;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::WorldConfigUtilImpl;
    use crate::models::mmr::{
        GameMMRRecord, MMRClaimed, MMRConfig, MMRGameMeta, PlayerMMRStats, PlayerMMRStatsTrait, SeriesMMRConfig,
    };
    use crate::models::config::BlitzRegistrationConfig;
    use crate::models::rank::{PlayerRank, PlayersRankTrial};
    use crate::systems::config::contracts::config_systems::assert_caller_is_admin;
    use crate::systems::utils::mmr::MMRCalculatorImpl;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
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
    pub struct MMRGameCommitted {
        #[key]
        pub trial_id: u128,
        pub player_count: u16,
        pub game_median: u128,
        pub global_median: u128,
        pub committed_by: ContractAddress,
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

        fn commit_game_mmr_meta(ref self: ContractState, trial_id: u128, game_median: u128, global_median: u128) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // Get MMR config
            let mmr_config: MMRConfig = WorldConfigUtilImpl::get_member(world, selector!("mmr_config"));

            // Check if MMR is enabled
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

            // Check minimum entry fee
            let blitz_registration_config: BlitzRegistrationConfig =
                WorldConfigUtilImpl::get_member(world, selector!("blitz_registration_config"));
            if blitz_registration_config.fee_amount < mmr_config.min_entry_fee {
                return;
            }

            // Read the trial data
            let trial: PlayersRankTrial = world.read_model(trial_id);
            if trial.total_player_count_revealed == 0 {
                return;
            }
            if trial.total_player_count_revealed != trial.total_player_count_committed {
                return;
            }
            if trial.last_rank == 0 {
                return;
            }

            // Check minimum players
            if trial.total_player_count_revealed < mmr_config.min_players {
                return;
            }

            // Avoid overwriting an existing commit
            let mut meta: MMRGameMeta = world.read_model(trial_id);
            if meta.committed_at != 0 {
                return;
            }

            assert!(game_median > 0, "MMR: game median must be > 0");
            let effective_global_median = if global_median == 0 { game_median } else { global_median };

            let now = starknet::get_block_timestamp();
            let caller = starknet::get_caller_address();

            meta.trial_id = trial_id;
            meta.player_count = trial.total_player_count_revealed;
            meta.game_median = game_median;
            meta.global_median = effective_global_median;
            meta.committed_at = now;
            meta.committed_by = caller;
            meta.processed_count = 0;
            world.write_model(@meta);

            world.emit_event(
                @MMRGameCommitted {
                    trial_id,
                    player_count: meta.player_count,
                    game_median,
                    global_median: effective_global_median,
                    committed_by: caller,
                    timestamp: now,
                },
            );
        }

        fn claim_game_mmr(ref self: ContractState, trial_id: u128, player: ContractAddress) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            // Get MMR config
            let mmr_config: MMRConfig = WorldConfigUtilImpl::get_member(world, selector!("mmr_config"));

            // Check if MMR is enabled
            if !mmr_config.enabled {
                return;
            }

            // Check if already processed
            let mut series_config: SeriesMMRConfig = world.read_model(trial_id);
            if series_config.mmr_processed {
                return;
            }

            // Check if ranked
            if !series_config.is_ranked {
                return;
            }

            // Ensure meta has been committed
            let mut meta: MMRGameMeta = world.read_model(trial_id);
            if meta.committed_at == 0 || meta.player_count == 0 {
                return;
            }

            // Ensure player hasn't already claimed
            let mut claimed: MMRClaimed = world.read_model((trial_id, player));
            if claimed.claimed {
                return;
            }

            // Read player rank
            let player_rank: PlayerRank = world.read_model((trial_id, player));
            if player_rank.rank == 0 {
                return;
            }

            // Check if token is configured (optional - we can still process records without it)
            let has_token = !mmr_config.mmr_token_address.is_zero();

            // Load current MMR
            let current_mmr: u128 = if has_token {
                let mmr_token = IMMRTokenDispatcher { contract_address: mmr_config.mmr_token_address };
                if !mmr_token.has_mmr(player) {
                    mmr_token.initialize_player(player);
                }
                mmr_token.get_mmr(player).try_into().unwrap()
            } else {
                mmr_config.initial_mmr
            };

            let new_mmr = MMRCalculatorImpl::calculate_player_mmr(
                mmr_config,
                current_mmr,
                player_rank.rank,
                meta.player_count,
                meta.game_median,
                meta.global_median,
            );

            // Store game record
            let now = starknet::get_block_timestamp();
            let record = GameMMRRecord {
                trial_id,
                player,
                mmr_before: current_mmr,
                mmr_after: new_mmr,
                rank: player_rank.rank,
                player_count: meta.player_count,
                median_mmr: meta.game_median,
                timestamp: now,
            };
            world.write_model(@record);

            // Update player stats
            let mut stats: PlayerMMRStats = world.read_model(player);
            if stats.games_played == 0 {
                stats = PlayerMMRStatsTrait::new(player, mmr_config.initial_mmr);
            }
            stats.record_game(new_mmr, current_mmr, now);
            world.write_model(@stats);

            // Update MMR token (if configured)
            if has_token {
                let mmr_token = IMMRTokenDispatcher { contract_address: mmr_config.mmr_token_address };
                mmr_token.update_mmr(player, new_mmr.into());
            }

            // Mark claimed
            claimed.trial_id = trial_id;
            claimed.player = player;
            claimed.claimed = true;
            claimed.claimed_at = now;
            world.write_model(@claimed);

            // Emit player event
            world.emit_event(
                @PlayerMMRChanged {
                    player,
                    trial_id,
                    old_mmr: current_mmr,
                    new_mmr,
                    rank: player_rank.rank,
                    timestamp: now,
                },
            );

            // Update processed count + finalize if complete
            if meta.processed_count < meta.player_count {
                meta.processed_count += 1;
                world.write_model(@meta);
            }

            if meta.processed_count == meta.player_count {
                series_config.mmr_processed = true;
                world.write_model(@series_config);
                world.emit_event(
                    @MMRGameProcessed {
                        trial_id,
                        player_count: meta.player_count,
                        median_mmr: meta.game_median,
                        timestamp: now,
                    },
                );
            }
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

        fn get_game_mmr_meta(self: @ContractState, trial_id: u128) -> MMRGameMeta {
            let world: WorldStorage = self.world(DEFAULT_NS());
            world.read_model(trial_id)
        }

        fn has_player_claimed_mmr(self: @ContractState, trial_id: u128, player: ContractAddress) -> bool {
            let world: WorldStorage = self.world(DEFAULT_NS());
            let claimed: MMRClaimed = world.read_model((trial_id, player));
            claimed.claimed
        }

        fn is_game_mmr_eligible(self: @ContractState, trial_id: u128, player_count: u16, entry_fee: u256) -> bool {
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
