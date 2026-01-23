// MMR System Contract
//
// Handles MMR updates for Blitz games after rankings are finalized.
// Uses commit + permissionless per-player claims to avoid lobby-wide loops.

use starknet::ContractAddress;

/// Interface for the MMR token contract
/// Simplified: balance_of returns INITIAL_MMR if player has never been set
#[starknet::interface]
pub trait IMMRToken<T> {
    /// Get player's current MMR balance
    /// Returns INITIAL_MMR (1000) if player has never been initialized
    fn balance_of(self: @T, player: ContractAddress) -> u256;

    /// Update a player's MMR to a new value
    /// Enforces minimum MMR floor, auto-initializes if first update
    fn update_mmr(ref self: T, player: ContractAddress, new_mmr: u256);

    /// Batch update multiple players' MMR
    fn update_mmr_batch(ref self: T, updates: Array<(ContractAddress, u256)>);
}

/// Interface for the MMR systems
#[starknet::interface]
pub trait IMMRSystems<T> {
    /// Commit MMR metadata for a completed game with on-chain verification
    /// Caller provides player list; contract verifies each player and calculates median
    fn commit_game_mmr_meta(ref self: T, players: Array<ContractAddress>);
    /// Permissionless per-player MMR claim for a completed game
    fn claim_game_mmr(ref self: T, players: Array<ContractAddress>);
}


#[dojo::contract]
pub mod mmr_systems {
    use core::dict::Felt252Dict;
    use core::num::traits::Zero;
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};
    use starknet::ContractAddress;
    use crate::constants::{DEFAULT_NS, WORLD_CONFIG_ID};
    use crate::models::config::WorldConfigUtilImpl;
    use crate::models::mmr::{MMRClaimed, MMRConfig, MMRGameMeta};
    use crate::models::rank::{PlayerRank, PlayersRankFinal, PlayersRankTrial};
    use crate::systems::utils::mmr::MMRCalculatorImpl;
    use super::{IMMRSystems, IMMRTokenDispatcher, IMMRTokenDispatcherTrait};

    // Token uses 18 decimals, but MMR calculator works with logical values (1000 = 1000 MMR)
    const MMR_PRECISION: u256 = 1_000000000000000000; // 1e18

    // ================================
    // EVENTS
    // ================================

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
        fn commit_game_mmr_meta(ref self: ContractState, players: Array<ContractAddress>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let player_count: u16 = players.len().try_into().unwrap();
            assert!(player_count.is_non_zero(), "Eternum: no players");

            let players_rank_final: PlayersRankFinal = world.read_model(WORLD_CONFIG_ID);
            assert!(players_rank_final.trial_id.is_non_zero(), "Eternum: rankings not finalized");

            let final_trial_id = players_rank_final.trial_id;

            // Get MMR config
            let mmr_config: MMRConfig = WorldConfigUtilImpl::get_member(world, selector!("mmr_config"));

            // Check if MMR is enabled
            assert!(mmr_config.enabled, "Eternum: MMR not enabled");

            // Read the trial data
            let trial: PlayersRankTrial = world.read_model(final_trial_id);
            assert!(!trial.total_player_count_revealed.is_zero(), "Eternum: no players");

            // Check minimum players
            assert!(trial.total_player_count_revealed >= mmr_config.min_players, "Eternum: not enough players");

            // Avoid overwriting an existing commit
            let mut meta: MMRGameMeta = world.read_model(final_trial_id);
            assert!(meta.game_median.is_zero(), "Eternum: mmr meta already committed");

            // Verify player count matches trial
            assert!(
                player_count == trial.total_player_count_revealed,
                "Eternum: MMR: player count mismatch - expected {}, got {}",
                trial.total_player_count_revealed,
                player_count,
            );

            // Check if token is configured
            assert!(mmr_config.mmr_token_address.is_non_zero(), "MMR: zero token address");

            // Verify each player and collect their MMRs
            // Client MUST sort players by MMR ascending - we verify this on-chain
            let mut mmrs: Array<u128> = array![];
            let mut last_mmr: u128 = 0;
            let mut player_address_used: Felt252Dict<bool> = Default::default();
            let mmr_token = IMMRTokenDispatcher { contract_address: mmr_config.mmr_token_address };

            for player in players {
                assert!(!player_address_used.get(player.into()), "MMR: player address repeated");
                player_address_used.insert(player.into(), true);

                // Verify player has a valid rank in this trial
                let player_rank: PlayerRank = world.read_model((final_trial_id, player));
                assert!(player_rank.rank > 0, "MMR: player {:?} has no rank in trial", player);

                // Get player's current MMR (balance_of returns INITIAL_MMR if uninitialized)
                // Token stores with 18 decimals, divide to get logical value
                let player_mmr: u128 = (mmr_token.balance_of(player) / MMR_PRECISION).try_into().unwrap();

                // Verify ascending MMR order (client must sort by MMR)
                assert!(player_mmr >= last_mmr, "MMR: players must be sorted by MMR ascending");
                last_mmr = player_mmr;

                mmrs.append(player_mmr);
            }

            // Calculate median - O(1) since client sorted by MMR
            let mmrs_span = mmrs.span();
            let game_median = if player_count == 1 {
                // Single player: median is their MMR
                *mmrs_span.at(0)
            } else if player_count % 2 == 1 {
                // Odd count: true middle element
                let mid_idx: u32 = (player_count / 2).into();
                *mmrs_span.at(mid_idx)
            } else {
                // Even count: average of two middle elements
                let upper_idx: u32 = (player_count / 2).into();
                let lower_idx: u32 = upper_idx - 1;
                (*mmrs_span.at(lower_idx) + *mmrs_span.at(upper_idx)) / 2
            };
            meta.game_median = game_median;
            world.write_model(@meta);

            let now = starknet::get_block_timestamp();
            let caller = starknet::get_caller_address();

            world
                .emit_event(
                    @MMRGameCommitted {
                        trial_id: final_trial_id,
                        player_count,
                        game_median,
                        global_median: game_median, // Same as game_median (no split lobby support)
                        committed_by: caller,
                        timestamp: now,
                    },
                );
        }

        fn claim_game_mmr(ref self: ContractState, players: Array<ContractAddress>) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());

            let players_rank_final: PlayersRankFinal = world.read_model(WORLD_CONFIG_ID);
            assert!(players_rank_final.trial_id.is_non_zero(), "Eternum: rankings not finalized");

            let final_trial_id = players_rank_final.trial_id;

            let player_rank_trial_final: PlayersRankTrial = world.read_model(final_trial_id);
            let player_count: u16 = players.len().try_into().unwrap();

            // Verify player count matches trial. all claims must be made at once
            assert!(
                player_count == player_rank_trial_final.total_player_count_revealed,
                "Eternum: MMR: player count mismatch - expected {}, got {}",
                player_rank_trial_final.total_player_count_revealed,
                player_count,
            );

            // Get MMR config
            let mmr_config: MMRConfig = WorldConfigUtilImpl::get_member(world, selector!("mmr_config"));

            // Check if MMR is enabled
            assert!(mmr_config.enabled, "Eternum: MMR not enabled");

            // Ensure meta has been committed
            let meta: MMRGameMeta = world.read_model(final_trial_id);
            assert!(meta.game_median.is_non_zero(), "Eternum: mmr meta not committed");

            // Ensure claim hasnt been called previously
            let mut claimed: MMRClaimed = world.read_model(WORLD_CONFIG_ID);
            assert!(claimed.claimed_at.is_zero(), "Eternum: mmr already claimed");

            // ensure mmr token address is set
            assert!(mmr_config.mmr_token_address.is_non_zero(), "MMR: zero token address");

            let now = starknet::get_block_timestamp();

            // Mark claimed (once, before processing)
            claimed.claimed_at = now;
            world.write_model(@claimed);

            let mmr_token = IMMRTokenDispatcher { contract_address: mmr_config.mmr_token_address };
            let mut player_address_used: Felt252Dict<bool> = Default::default();

            for player in players {
                assert!(!player_address_used.get(player.into()), "MMR: player address repeated");
                player_address_used.insert(player.into(), true);

                // Read player rank
                let player_rank: PlayerRank = world.read_model((final_trial_id, player));
                assert!(player_rank.rank.is_non_zero(), "Eternum: player zero rank");

                // Load current MMR (balance_of returns INITIAL_MMR if uninitialized)
                // Token stores with 18 decimals, divide to get logical value
                let current_mmr: u128 = (mmr_token.balance_of(player) / MMR_PRECISION).try_into().unwrap();

                // Calculate new MMR (works with logical values like 1000)
                let new_mmr = MMRCalculatorImpl::calculate_player_mmr(
                    mmr_config, current_mmr, player_rank.rank, player_count, meta.game_median, meta.game_median,
                );

                // Update MMR token - multiply by precision for token storage
                let new_mmr_scaled: u256 = new_mmr.into() * MMR_PRECISION;
                mmr_token.update_mmr(player, new_mmr_scaled);

                // Emit player event
                world
                    .emit_event(
                        @PlayerMMRChanged {
                            player,
                            trial_id: final_trial_id,
                            old_mmr: current_mmr,
                            new_mmr,
                            rank: player_rank.rank,
                            timestamp: now,
                        },
                    );
            }
        }
    }

    /// Get dispatcher for MMR systems
    pub fn get_dispatcher(world: @WorldStorage) -> super::IMMRSystemsDispatcher {
        let (addr, _) = world.dns(@"mmr_systems").unwrap();
        super::IMMRSystemsDispatcher { contract_address: addr }
    }
}
