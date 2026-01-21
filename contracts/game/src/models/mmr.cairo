// MMR (Matchmaking Rating) System Models
//
// This module defines the data models for the Blitz MMR system.
// MMR is a persistent skill rating that tracks player performance across games.

use core::num::traits::Zero;
use starknet::ContractAddress;


// ================================
// MMR CONFIGURATION
// ================================

/// Configuration for the MMR system
/// Stored as part of WorldConfig for easy access
#[derive(Introspect, Copy, Drop, Serde, DojoStore)]
pub struct MMRConfig {
    /// Whether MMR tracking is enabled
    pub enabled: bool,
    /// Address of the MMR token contract (soul-bound ERC20)
    pub mmr_token_address: ContractAddress,
    /// Initial MMR for new players (default: 1000)
    pub initial_mmr: u128,
    /// Hard floor - minimum MMR a player can have (default: 100)
    pub min_mmr: u128,
    /// Distribution mean (mu) - center of Gaussian (default: 1500)
    pub distribution_mean: u128,
    /// Spread factor (D) - controls expected percentile spread (default: 450)
    pub spread_factor: u128,
    /// Maximum delta - cap on rating change per game (default: 45)
    pub max_delta: u128,
    /// Base K-factor (K0) - scaling factor for raw delta (default: 50)
    pub k_factor: u128,
    /// Mean regression lambda - pull toward distribution mean (default: 0.015 scaled)
    pub mean_regression_scaled: u128,
    /// Minimum players for a game to be rated (default: 6)
    pub min_players: u16,
    /// Minimum entry fee for a game to be rated (in $LORDS wei)
    pub min_entry_fee: u256,
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
            // 0.015 scaled by 1e6 for fixed-point precision
            mean_regression_scaled: 15000,
            min_players: 6,
            // $1 in $LORDS (18 decimals)
            min_entry_fee: 1_000000000000000000,
        }
    }
}


// ================================
// PLAYER MMR STATISTICS
// ================================

/// Tracks per-player MMR statistics
/// Updated after each rated game
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerMMRStats {
    #[key]
    pub player: ContractAddress,
    /// Number of rated games played
    pub games_played: u32,
    /// Highest MMR ever achieved
    pub highest_mmr: u128,
    /// Lowest MMR ever recorded
    pub lowest_mmr: u128,
    /// Timestamp of last rated game
    pub last_game_timestamp: u64,
    /// MMR change from last game (positive = gain, uses magnitude + sign flag)
    pub last_mmr_change_magnitude: u128,
    /// True if last_mmr_change was negative
    pub last_mmr_change_negative: bool,
    /// Current win streak (consecutive games with positive MMR change)
    pub current_streak: u16,
    /// True if current streak is wins, false if losses
    pub streak_is_wins: bool,
}

#[generate_trait]
pub impl PlayerMMRStatsImpl of PlayerMMRStatsTrait {
    /// Initialize stats for a new player
    fn new(player: ContractAddress, initial_mmr: u128) -> PlayerMMRStats {
        PlayerMMRStats {
            player,
            games_played: 0,
            highest_mmr: initial_mmr,
            lowest_mmr: initial_mmr,
            last_game_timestamp: 0,
            last_mmr_change_magnitude: 0,
            last_mmr_change_negative: false,
            current_streak: 0,
            streak_is_wins: true,
        }
    }

    /// Update stats after a game
    fn record_game(ref self: PlayerMMRStats, new_mmr: u128, old_mmr: u128, timestamp: u64) {
        self.games_played += 1;
        self.last_game_timestamp = timestamp;

        // Calculate MMR change
        let (magnitude, is_negative) = if new_mmr >= old_mmr {
            (new_mmr - old_mmr, false)
        } else {
            (old_mmr - new_mmr, true)
        };

        self.last_mmr_change_magnitude = magnitude;
        self.last_mmr_change_negative = is_negative;

        // Update highest/lowest
        if new_mmr > self.highest_mmr {
            self.highest_mmr = new_mmr;
        }
        if new_mmr < self.lowest_mmr {
            self.lowest_mmr = new_mmr;
        }

        // Update streak
        let is_win = !is_negative && magnitude > 0;
        if is_win {
            if self.streak_is_wins {
                self.current_streak += 1;
            } else {
                self.current_streak = 1;
                self.streak_is_wins = true;
            }
        } else if is_negative {
            if !self.streak_is_wins {
                self.current_streak += 1;
            } else {
                self.current_streak = 1;
                self.streak_is_wins = false;
            }
        }
        // If magnitude == 0, don't change streak
    }
}


// ================================
// GAME MMR RECORD
// ================================

/// Records MMR changes for a specific player in a specific game
/// Used for historical tracking and analytics
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct GameMMRRecord {
    #[key]
    pub trial_id: u128,
    #[key]
    pub player: ContractAddress,
    /// MMR before the game
    pub mmr_before: u128,
    /// MMR after the game
    pub mmr_after: u128,
    /// Player's rank in this game (1 = winner)
    pub rank: u16,
    /// Total players in the game
    pub player_count: u16,
    /// Median MMR of all players in the game
    pub median_mmr: u128,
    /// Timestamp when the game ended
    pub timestamp: u64,
}


// ================================
// SERIES MMR CONFIGURATION
// ================================

/// Marks whether a specific series/trial is eligible for MMR tracking
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct SeriesMMRConfig {
    #[key]
    pub trial_id: u128,
    /// Whether this series is ranked (MMR-eligible)
    pub is_ranked: bool,
    /// Whether MMR has been processed for this trial
    pub mmr_processed: bool,
}


// ================================
// TESTS
// ================================

#[cfg(test)]
mod tests {
    use starknet::ContractAddress;
    use super::{MMRConfigDefaultImpl, PlayerMMRStatsTrait};

    fn addr(val: felt252) -> ContractAddress {
        val.try_into().unwrap()
    }

    // ================================
    // MMRConfig Default Tests
    // ================================

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
        assert!(config.mean_regression_scaled == 15000, "Lambda scaled should be 15000");
        assert!(config.min_players == 6, "Min players should be 6");
    }

    // ================================
    // PlayerMMRStats Tests
    // ================================

    #[test]
    fn test_player_stats_new() {
        let player = addr('player1');
        let initial_mmr: u128 = 1000;

        let stats = PlayerMMRStatsTrait::new(player, initial_mmr);

        assert!(stats.player == player, "Player should match");
        assert!(stats.games_played == 0, "Should have 0 games");
        assert!(stats.highest_mmr == initial_mmr, "Highest should be initial");
        assert!(stats.lowest_mmr == initial_mmr, "Lowest should be initial");
        assert!(stats.last_game_timestamp == 0, "Timestamp should be 0");
        assert!(stats.last_mmr_change_magnitude == 0, "Change should be 0");
        assert!(stats.last_mmr_change_negative == false, "Should not be negative");
        assert!(stats.current_streak == 0, "Streak should be 0");
        assert!(stats.streak_is_wins == true, "Streak type defaults to wins");
    }

    #[test]
    fn test_record_game_win() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        // Record a win (MMR increase)
        stats.record_game(1025, 1000, 12345);

        assert!(stats.games_played == 1, "Should have 1 game");
        assert!(stats.last_game_timestamp == 12345, "Timestamp should update");
        assert!(stats.last_mmr_change_magnitude == 25, "Change should be 25");
        assert!(stats.last_mmr_change_negative == false, "Should not be negative");
        assert!(stats.highest_mmr == 1025, "Highest should update");
        assert!(stats.lowest_mmr == 1000, "Lowest should not change");
        assert!(stats.current_streak == 1, "Win streak should be 1");
        assert!(stats.streak_is_wins == true, "Should be win streak");
    }

    #[test]
    fn test_record_game_loss() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        // Record a loss (MMR decrease)
        stats.record_game(975, 1000, 12345);

        assert!(stats.games_played == 1, "Should have 1 game");
        assert!(stats.last_mmr_change_magnitude == 25, "Change magnitude should be 25");
        assert!(stats.last_mmr_change_negative == true, "Should be negative");
        assert!(stats.highest_mmr == 1000, "Highest should not change");
        assert!(stats.lowest_mmr == 975, "Lowest should update");
        assert!(stats.current_streak == 1, "Loss streak should be 1");
        assert!(stats.streak_is_wins == false, "Should be loss streak");
    }

    #[test]
    fn test_record_game_no_change() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        // First record a win to start a streak
        stats.record_game(1025, 1000, 100);
        assert!(stats.current_streak == 1, "Should have 1 win");

        // Record a game with no change
        stats.record_game(1025, 1025, 200);

        assert!(stats.games_played == 2, "Should have 2 games");
        assert!(stats.last_mmr_change_magnitude == 0, "Change should be 0");
        assert!(stats.last_mmr_change_negative == false, "Should not be negative");
        // Streak should remain unchanged when no MMR change
        assert!(stats.current_streak == 1, "Streak should stay at 1");
        assert!(stats.streak_is_wins == true, "Should still be win streak");
    }

    #[test]
    fn test_win_streak_consecutive() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        // Record 3 consecutive wins
        stats.record_game(1020, 1000, 100);
        assert!(stats.current_streak == 1, "Streak should be 1");

        stats.record_game(1040, 1020, 200);
        assert!(stats.current_streak == 2, "Streak should be 2");

        stats.record_game(1055, 1040, 300);
        assert!(stats.current_streak == 3, "Streak should be 3");
        assert!(stats.streak_is_wins == true, "Should be win streak");
        assert!(stats.highest_mmr == 1055, "Highest should be 1055");
    }

    #[test]
    fn test_loss_streak_consecutive() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        // Record 3 consecutive losses
        stats.record_game(980, 1000, 100);
        assert!(stats.current_streak == 1, "Streak should be 1");
        assert!(stats.streak_is_wins == false, "Should be loss streak");

        stats.record_game(960, 980, 200);
        assert!(stats.current_streak == 2, "Streak should be 2");

        stats.record_game(945, 960, 300);
        assert!(stats.current_streak == 3, "Streak should be 3");
        assert!(stats.streak_is_wins == false, "Should be loss streak");
        assert!(stats.lowest_mmr == 945, "Lowest should be 945");
    }

    #[test]
    fn test_streak_breaks_on_opposite_result() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        // Build a 3-win streak
        stats.record_game(1020, 1000, 100);
        stats.record_game(1040, 1020, 200);
        stats.record_game(1060, 1040, 300);
        assert!(stats.current_streak == 3, "Win streak should be 3");
        assert!(stats.streak_is_wins == true, "Should be win streak");

        // Now lose - streak should reset to 1 loss
        stats.record_game(1035, 1060, 400);
        assert!(stats.current_streak == 1, "Streak should reset to 1");
        assert!(stats.streak_is_wins == false, "Should now be loss streak");

        // Another loss - streak grows
        stats.record_game(1010, 1035, 500);
        assert!(stats.current_streak == 2, "Loss streak should be 2");

        // Win again - resets to 1 win
        stats.record_game(1030, 1010, 600);
        assert!(stats.current_streak == 1, "Streak should reset to 1");
        assert!(stats.streak_is_wins == true, "Should be win streak again");
    }

    #[test]
    fn test_highest_lowest_tracking() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        // Go up
        stats.record_game(1050, 1000, 100);
        assert!(stats.highest_mmr == 1050, "Highest should be 1050");
        assert!(stats.lowest_mmr == 1000, "Lowest should be 1000");

        // Go down below initial
        stats.record_game(950, 1050, 200);
        assert!(stats.highest_mmr == 1050, "Highest should stay 1050");
        assert!(stats.lowest_mmr == 950, "Lowest should be 950");

        // New high
        stats.record_game(1100, 950, 300);
        assert!(stats.highest_mmr == 1100, "Highest should be 1100");
        assert!(stats.lowest_mmr == 950, "Lowest should stay 950");

        // New low
        stats.record_game(900, 1100, 400);
        assert!(stats.highest_mmr == 1100, "Highest should stay 1100");
        assert!(stats.lowest_mmr == 900, "Lowest should be 900");
    }

    #[test]
    fn test_games_played_increments() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        assert!(stats.games_played == 0, "Should start at 0");

        for i in 1..11_u32 {
            stats.record_game(1000, 1000, i.into() * 100);
            assert!(stats.games_played == i, "Games should match iteration");
        }

        assert!(stats.games_played == 10, "Should have 10 games");
    }

    #[test]
    fn test_timestamp_updates() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        stats.record_game(1000, 1000, 1000);
        assert!(stats.last_game_timestamp == 1000, "Timestamp should be 1000");

        stats.record_game(1000, 1000, 5000);
        assert!(stats.last_game_timestamp == 5000, "Timestamp should be 5000");

        stats.record_game(1000, 1000, 3000); // Earlier timestamp (shouldn't happen but test anyway)
        assert!(stats.last_game_timestamp == 3000, "Timestamp should update to 3000");
    }

    #[test]
    fn test_large_mmr_changes() {
        let player = addr('player1');
        let mut stats = PlayerMMRStatsTrait::new(player, 1000);

        // Large gain
        stats.record_game(2000, 1000, 100);
        assert!(stats.last_mmr_change_magnitude == 1000, "Change should be 1000");
        assert!(stats.last_mmr_change_negative == false, "Should be positive");
        assert!(stats.highest_mmr == 2000, "Highest should be 2000");

        // Large loss
        stats.record_game(500, 2000, 200);
        assert!(stats.last_mmr_change_magnitude == 1500, "Change should be 1500");
        assert!(stats.last_mmr_change_negative == true, "Should be negative");
        assert!(stats.lowest_mmr == 500, "Lowest should be 500");
    }
}
