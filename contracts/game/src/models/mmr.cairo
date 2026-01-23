// MMR (Matchmaking Rating) System Models
//
// This module defines the data models for the Blitz MMR system.
// MMR is a persistent skill rating that tracks player performance across games.

use core::num::traits::Zero;
use starknet::ContractAddress;
use crate::alias::ID;


// ================================
// MMR CONFIGURATION
// ================================

/// Configuration for the MMR system
/// Stored as part of WorldConfig for easy access
/// Note: ContractAddress prevents IntrospectPacked, but smaller types reduce storage costs
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct MMRConfig {
    /// Whether MMR tracking is enabled
    pub enabled: bool,
    /// Address of the MMR token contract (soul-bound ERC20)
    pub mmr_token_address: ContractAddress,
    /// Initial MMR for new players (default: 1000, max: 65535)
    pub initial_mmr: u16,
    /// Hard floor - minimum MMR a player can have (default: 100, max: 65535)
    pub min_mmr: u16,
    /// Distribution mean (mu) - center of Gaussian (default: 1500, max: 65535)
    pub distribution_mean: u16,
    /// Spread factor (D) - controls expected percentile spread (default: 450, max: 65535)
    pub spread_factor: u16,
    /// Maximum delta - cap on rating change per game (default: 45, max: 255)
    pub max_delta: u8,
    /// Base K-factor (K0) - scaling factor for raw delta (default: 50, max: 255)
    pub k_factor: u8,
    /// Split lobby weight (w) - scales tier adjustment (default: 0.25 scaled as 2500, using 10000 = 100%)
    pub lobby_split_weight_scaled: u16,
    /// Mean regression lambda - pull toward distribution mean (default: 0.015 scaled as 150, using 10000 = 100%)
    pub mean_regression_scaled: u16,
    /// Minimum players for a game to be rated (default: 6, max: 255)
    pub min_players: u8,
}

/// Helper to get default MMR config values
#[generate_trait]
pub impl MMRConfigDefaultImpl of MMRConfigDefaultTrait {
    /// Default configuration values based on spec
    fn default() -> MMRConfig {
        MMRConfig {
            enabled: false,
            mmr_token_address: Zero::zero(),
            initial_mmr: 1000,
            min_mmr: 100,
            distribution_mean: 1500,
            spread_factor: 450,
            max_delta: 45,
            k_factor: 50,
            // 0.25 scaled by 10000 (PercentageValueImpl::_100()) for fixed-point precision
            lobby_split_weight_scaled: 2500,
            // 0.015 scaled by 10000 (PercentageValueImpl::_100()) for fixed-point precision
            mean_regression_scaled: 150,
            min_players: 6,
        }
    }
}


// ================================
// MMR GAME META + CLAIM TRACKING
// ================================

/// Stores committed MMR metadata for a trial (medians + progress)
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct MMRGameMeta {
    #[key]
    pub world_id: ID,
    /// Total players in the game
    pub game_median: u128,
}

/// Tracks whether a player has claimed their MMR update for a trial
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct MMRClaimed {
    #[key]
    pub world_id: ID,
    pub claimed_at: u64,
}


// ================================
// TESTS
// ================================

#[cfg(test)]
mod tests {
    use super::MMRConfigDefaultImpl;

    #[test]
    fn test_mmr_config_default() {
        let config = MMRConfigDefaultImpl::default();

        assert!(config.enabled == false, "Default should be disabled");
        assert!(config.initial_mmr == 1000, "Initial MMR should be 1000");
        assert!(config.min_mmr == 100, "Min MMR should be 100");
        assert!(config.distribution_mean == 1500, "Mean should be 1500");
        assert!(config.spread_factor == 450, "Spread factor should be 450");
        assert!(config.max_delta == 45, "Max delta should be 45");
        assert!(config.k_factor == 50, "K factor should be 50");
        assert!(config.lobby_split_weight_scaled == 2500, "Split weight scaled should be 2500");
        assert!(config.mean_regression_scaled == 150, "Lambda scaled should be 150");
        assert!(config.min_players == 6, "Min players should be 6");
    }
}
