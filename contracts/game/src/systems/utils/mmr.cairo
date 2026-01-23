// MMR (Matchmaking Rating) Calculation Library
//
// This module implements the 8-step rating update formula for the Blitz MMR system.
// Uses fixed-point math via cubit library for exponential and transcendental functions.
//
// Formula Steps:
// 1. Median MMR: M = median{MMR_j}
// 2. Expected Percentile: p_exp = 1 / (1 + e^((MMR - M) / D))
// 3. Actual Percentile: p_act = (rank - 1) / (N - 1)
// 4. Raw Delta: Δ_base = K₀ × √(N/6) × [p_exp - p_act]
// 5. Diminishing Returns: Δ = Δ_max × tanh(Δ_base / Δ_max)
// 6. Split Lobby Adjustment: Δ_tier = Δ × (1 + w × clamp((M_game - M_global) / D, -0.5, 0.5))
// 7. Mean Regression: Δ_reg = Δ_tier - λ × (MMR - μ)
// 8. New Rating: MMR' = max(100, MMR + Δ_reg)

use cubit::f128::types::fixed::{Fixed, FixedTrait};
use crate::models::mmr::MMRConfig;


// ================================
// CONSTANTS
// ================================

// Fixed-point precision constants
const PRECISION_SCALE: u128 = 1_000_000; // 1e6 for config values


// ================================
// MMR CALCULATOR IMPLEMENTATION
// ================================

#[generate_trait]
pub impl MMRCalculatorImpl of MMRCalculatorTrait {
    // --------------------------------
    // HELPER FUNCTIONS
    // --------------------------------

    /// Convert u128 to Fixed (scaled by precision)
    fn to_fixed(value: u128) -> Fixed {
        FixedTrait::new_unscaled(value, false)
    }

    /// Convert Fixed to u128 (truncated)
    fn from_fixed(value: Fixed) -> u128 {
        // Handle negative values by returning 0
        if value.sign {
            return 0;
        }
        // Convert from fixed-point representation
        // Fixed uses 64-bit fractional part
        value.mag / 18446744073709551616 // 2^64
    }

    /// Hyperbolic tangent: tanh(x) = (e^(2x) - 1) / (e^(2x) + 1)
    fn tanh(x: Fixed) -> Fixed {
        let two = FixedTrait::new_unscaled(2, false);
        let exp_2x = (two * x).exp();
        let one = FixedTrait::ONE();
        (exp_2x - one) / (exp_2x + one)
    }

    /// Calculate square root using cubit's pow function
    fn sqrt(x: Fixed) -> Fixed {
        // sqrt(x) = x^0.5
        let half = FixedTrait::new(9223372036854775808, false); // 0.5 in fixed-point (2^63)
        x.pow(half)
    }

    // --------------------------------
    // MAIN FORMULA STEPS
    // --------------------------------

    /// Step 2: Calculate expected percentile using logistic function
    /// p_exp = 1 / (1 + e^((MMR - M) / D))
    fn expected_percentile(player_mmr: u128, median_mmr: u128, spread_factor: u128) -> Fixed {
        let d = Self::to_fixed(spread_factor);

        // (MMR - M) / D
        let diff = if player_mmr >= median_mmr {
            FixedTrait::new_unscaled(player_mmr - median_mmr, false)
        } else {
            FixedTrait::new_unscaled(median_mmr - player_mmr, true) // negative
        };
        let ratio = diff / d;

        // e^(ratio)
        let exp_ratio = ratio.exp();

        // 1 / (1 + e^ratio)
        let one = FixedTrait::ONE();
        one / (one + exp_ratio)
    }

    /// Step 3: Calculate actual percentile from rank
    /// p_act = (rank - 1) / (N - 1)
    fn actual_percentile(rank: u16, player_count: u16) -> Fixed {
        if player_count <= 1 {
            return FixedTrait::ZERO();
        }
        let numerator = Self::to_fixed((rank - 1).into());
        let denominator = Self::to_fixed((player_count - 1).into());
        numerator / denominator
    }

    /// Step 4: Calculate raw delta
    /// Δ_base = K₀ × √(N/6) × [p_exp - p_act]
    fn raw_delta(p_exp: Fixed, p_act: Fixed, k_factor: u128, player_count: u16) -> Fixed {
        let k = Self::to_fixed(k_factor);
        let n = Self::to_fixed(player_count.into());
        let six = Self::to_fixed(6);

        // √(N/6) - lobby size scaling factor
        let lobby_scale = Self::sqrt(n / six);

        // p_exp - p_act (can be positive or negative)
        let percentile_diff = p_exp - p_act;

        // K₀ × √(N/6) × [p_exp - p_act]
        k * lobby_scale * percentile_diff
    }

    /// Step 5: Apply diminishing returns cap using tanh
    /// Δ = Δ_max × tanh(Δ_base / Δ_max)
    fn apply_diminishing_returns(raw_delta: Fixed, max_delta: u128) -> Fixed {
        let d_max = Self::to_fixed(max_delta);

        // Δ_base / Δ_max
        let ratio = raw_delta / d_max;

        // tanh(ratio)
        let tanh_ratio = Self::tanh(ratio);

        // Δ_max × tanh(ratio)
        d_max * tanh_ratio
    }

    /// Step 6: Apply split lobby adjustment
    /// When a large registration lobby is split into multiple games (tiers),
    /// adjust MMR swings based on relative tier strength.
    ///
    /// bias = clamp((M_game - M_global) / D, -0.5, 0.5)
    /// mult = 1 + w × bias
    /// Δ_tier = Δ × mult
    ///
    /// If M_game == M_global (no split), mult = 1 and delta is unchanged.
    fn apply_split_lobby_adjustment(
        delta: Fixed, game_median: u128, global_median: u128, spread_factor: u128, weight_scaled: u128,
    ) -> Fixed {
        // If no split (game median equals global), return unchanged
        if game_median == global_median {
            return delta;
        }

        let d = Self::to_fixed(spread_factor);

        // (M_game - M_global) / D
        let diff = if game_median >= global_median {
            FixedTrait::new_unscaled(game_median - global_median, false)
        } else {
            FixedTrait::new_unscaled(global_median - game_median, true) // negative
        };
        let ratio = diff / d;

        // Clamp to [-0.5, 0.5]
        let half_pos = FixedTrait::new(9223372036854775808, false); // 0.5 in fixed-point
        let half_neg = FixedTrait::new(9223372036854775808, true); // -0.5 in fixed-point

        let bias = if ratio.sign {
            // Negative ratio
            if ratio.mag > half_neg.mag {
                half_neg // clamp to -0.5
            } else {
                ratio
            }
        } else {
            // Positive ratio
            if ratio.mag > half_pos.mag {
                half_pos // clamp to 0.5
            } else {
                ratio
            }
        };

        // w = weight_scaled / 1e6
        let w = FixedTrait::new_unscaled(weight_scaled, false) / FixedTrait::new_unscaled(PRECISION_SCALE, false);

        // mult = 1 + w × bias
        let one = FixedTrait::ONE();
        let mult = one + (w * bias);

        // Δ_tier = Δ × mult
        delta * mult
    }

    /// Step 7: Apply mean regression
    /// Δ_reg = Δ_tier - λ × (MMR - μ)
    fn apply_mean_regression(delta_tier: Fixed, current_mmr: u128, mean: u128, lambda_scaled: u128) -> Fixed {
        // Convert lambda from scaled (1e6) to fixed
        let lambda = FixedTrait::new_unscaled(lambda_scaled, false) / FixedTrait::new_unscaled(PRECISION_SCALE, false);

        // (MMR - μ) - can be positive or negative
        let deviation = if current_mmr >= mean {
            FixedTrait::new_unscaled(current_mmr - mean, false)
        } else {
            FixedTrait::new_unscaled(mean - current_mmr, true) // negative
        };

        // λ × (MMR - μ)
        let regression_pull = lambda * deviation;

        // Δ_tier - λ × (MMR - μ)
        delta_tier - regression_pull
    }

    /// Step 8: Calculate final new MMR with floor enforcement
    /// MMR' = max(min_mmr, MMR + Δ_reg)
    fn calculate_new_mmr(current_mmr: u128, delta_reg: Fixed, min_mmr: u128) -> u128 {
        // Convert delta to signed integer change
        let delta_magnitude = Self::from_fixed(
            if delta_reg.sign {
                FixedTrait::new(delta_reg.mag, false)
            } else {
                delta_reg
            },
        );

        let new_mmr = if delta_reg.sign {
            // Negative delta - subtract
            if current_mmr > delta_magnitude {
                current_mmr - delta_magnitude
            } else {
                0
            }
        } else {
            // Positive delta - add
            current_mmr + delta_magnitude
        };

        // Enforce floor
        if new_mmr < min_mmr {
            min_mmr
        } else {
            new_mmr
        }
    }

    // --------------------------------
    // MAIN ENTRY POINT
    // --------------------------------

    /// Calculate new MMR for a single player given game results
    /// Returns the new MMR value
    ///
    /// Parameters:
    /// - config: MMR system configuration
    /// - player_mmr: Player's current MMR
    /// - rank: Player's finish rank in the game (1 = winner)
    /// - player_count: Total players in the game
    /// - game_median: Median MMR of players in this specific game
    /// - global_median: Median MMR across all registered players (for split lobbies)
    ///                  Pass same value as game_median if no split occurred
    fn calculate_player_mmr(
        config: MMRConfig, player_mmr: u128, rank: u16, player_count: u16, game_median: u128, global_median: u128,
    ) -> u128 {
        // Step 2: Expected percentile
        let p_exp = Self::expected_percentile(player_mmr, game_median, config.spread_factor);

        // Step 3: Actual percentile
        let p_act = Self::actual_percentile(rank, player_count);

        // Step 4: Raw delta
        let delta_base = Self::raw_delta(p_exp, p_act, config.k_factor, player_count);

        // Step 5: Apply diminishing returns
        let delta = Self::apply_diminishing_returns(delta_base, config.max_delta);

        // Step 6: Apply split lobby adjustment
        let delta_tier = Self::apply_split_lobby_adjustment(
            delta, game_median, global_median, config.spread_factor, config.lobby_split_weight_scaled,
        );

        // Step 7: Apply mean regression
        let delta_reg = Self::apply_mean_regression(
            delta_tier, player_mmr, config.distribution_mean, config.mean_regression_scaled,
        );

        // Step 8: Calculate new MMR with floor
        Self::calculate_new_mmr(player_mmr, delta_reg, config.min_mmr)
    }
}


// ================================
// TESTS
// ================================

#[cfg(test)]
mod tests {
    use cubit::f128::types::fixed::FixedTrait;
    use starknet::ContractAddress;
    use crate::models::mmr::MMRConfigDefaultImpl;
    use super::MMRCalculatorImpl;

    // ================================
    // ACTUAL PERCENTILE TESTS
    // ================================

    #[test]
    fn test_actual_percentile() {
        // First place (rank 1) should have percentile 0
        let p1 = MMRCalculatorImpl::actual_percentile(1, 6);
        assert!(p1 == FixedTrait::ZERO(), "Rank 1 should have percentile 0");

        // Last place (rank 6 of 6) should have percentile 1
        let p6 = MMRCalculatorImpl::actual_percentile(6, 6);
        assert!(p6 == FixedTrait::ONE(), "Rank 6/6 should have percentile 1");

        // Middle rank should be in between
        let p3 = MMRCalculatorImpl::actual_percentile(3, 6);
        // (3-1)/(6-1) = 2/5 = 0.4
        let expected = FixedTrait::new_unscaled(2, false) / FixedTrait::new_unscaled(5, false);
        let diff = if p3 > expected {
            p3 - expected
        } else {
            expected - p3
        };
        assert!(diff.mag < 1000000000000, "Rank 3/6 should be ~0.4");
    }

    #[test]
    fn test_actual_percentile_single_player() {
        // Edge case: single player game
        let p = MMRCalculatorImpl::actual_percentile(1, 1);
        assert!(p == FixedTrait::ZERO(), "Single player should have percentile 0");
    }

    #[test]
    fn test_actual_percentile_two_players() {
        let p1 = MMRCalculatorImpl::actual_percentile(1, 2);
        assert!(p1 == FixedTrait::ZERO(), "Winner of 2-player should have percentile 0");

        let p2 = MMRCalculatorImpl::actual_percentile(2, 2);
        assert!(p2 == FixedTrait::ONE(), "Loser of 2-player should have percentile 1");
    }

    #[test]
    fn test_actual_percentile_large_lobby() {
        // 12-player game
        let p1 = MMRCalculatorImpl::actual_percentile(1, 12);
        assert!(p1 == FixedTrait::ZERO(), "Rank 1/12 should be 0");

        let p12 = MMRCalculatorImpl::actual_percentile(12, 12);
        assert!(p12 == FixedTrait::ONE(), "Rank 12/12 should be 1");

        // Rank 6 of 12: (6-1)/(12-1) = 5/11 ≈ 0.4545
        let p6 = MMRCalculatorImpl::actual_percentile(6, 12);
        let expected = FixedTrait::new_unscaled(5, false) / FixedTrait::new_unscaled(11, false);
        let diff = if p6 > expected {
            p6 - expected
        } else {
            expected - p6
        };
        assert!(diff.mag < 1000000000000, "Rank 6/12 should be ~0.4545");
    }

    // ================================
    // EXPECTED PERCENTILE TESTS
    // ================================

    #[test]
    fn test_expected_percentile_equal_to_median() {
        // When player MMR equals median, expected percentile should be 0.5
        let p = MMRCalculatorImpl::expected_percentile(1000, 1000, 450);
        let half = FixedTrait::new_unscaled(1, false) / FixedTrait::new_unscaled(2, false);
        let diff = if p > half {
            p - half
        } else {
            half - p
        };
        assert!(diff.mag < 100000000000000, "At median, expected percentile should be 0.5");
    }

    #[test]
    fn test_expected_percentile_high_mmr() {
        // High MMR player should have lower expected percentile (expected to place higher)
        let p = MMRCalculatorImpl::expected_percentile(1500, 1000, 450);
        let half = FixedTrait::new_unscaled(1, false) / FixedTrait::new_unscaled(2, false);
        // p should be < 0.5 for high MMR
        assert!(p < half, "High MMR should have expected percentile < 0.5");
    }

    #[test]
    fn test_expected_percentile_low_mmr() {
        // Low MMR player should have higher expected percentile (expected to place lower)
        let p = MMRCalculatorImpl::expected_percentile(500, 1000, 450);
        let half = FixedTrait::new_unscaled(1, false) / FixedTrait::new_unscaled(2, false);
        // p should be > 0.5 for low MMR
        assert!(p > half, "Low MMR should have expected percentile > 0.5");
    }

    #[test]
    fn test_expected_percentile_spread_factor_influence() {
        // With different spread factors, the expected percentile should vary
        let p_narrow = MMRCalculatorImpl::expected_percentile(1200, 1000, 200);
        let p_wide = MMRCalculatorImpl::expected_percentile(1200, 1000, 600);

        // Narrow spread = more extreme expectations
        // Wide spread = expectations closer to 0.5
        // For high MMR (1200 > median 1000):
        // - Narrow spread should give lower p_exp (more confident in high placement)
        // - Wide spread should give higher p_exp (less confident)
        assert!(p_narrow < p_wide, "Narrow spread should give more extreme percentile");
    }

    // ================================
    // RAW DELTA TESTS
    // ================================

    #[test]
    fn test_raw_delta_perfect_performance() {
        // Player expected to finish middle (p_exp=0.5) but wins (p_act=0)
        // Should have large positive delta
        let p_exp = FixedTrait::new_unscaled(1, false) / FixedTrait::new_unscaled(2, false);
        let p_act = FixedTrait::ZERO();
        let k_factor: u128 = 50;
        let player_count: u16 = 6;

        let delta = MMRCalculatorImpl::raw_delta(p_exp, p_act, k_factor, player_count);
        // Delta should be positive (outperformed expectations)
        assert!(!delta.sign, "Delta should be positive for overperformance");
        assert!(delta.mag > 0, "Delta magnitude should be > 0");
    }

    #[test]
    fn test_raw_delta_worst_performance() {
        // Player expected to finish middle (p_exp=0.5) but finishes last (p_act=1)
        // Should have large negative delta
        let p_exp = FixedTrait::new_unscaled(1, false) / FixedTrait::new_unscaled(2, false);
        let p_act = FixedTrait::ONE();
        let k_factor: u128 = 50;
        let player_count: u16 = 6;

        let delta = MMRCalculatorImpl::raw_delta(p_exp, p_act, k_factor, player_count);
        // Delta should be negative (underperformed expectations)
        assert!(delta.sign, "Delta should be negative for underperformance");
        assert!(delta.mag > 0, "Delta magnitude should be > 0");
    }

    #[test]
    fn test_raw_delta_meets_expectations() {
        // Player finishes exactly as expected (p_exp = p_act)
        // Delta should be close to zero
        let p = FixedTrait::new_unscaled(1, false) / FixedTrait::new_unscaled(2, false);
        let k_factor: u128 = 50;
        let player_count: u16 = 6;

        let delta = MMRCalculatorImpl::raw_delta(p, p, k_factor, player_count);
        // Delta should be near zero
        // Using Fixed comparison - very small magnitude
        assert!(delta.mag < 1000000000000000, "Delta should be near zero when meeting expectations");
    }

    #[test]
    fn test_raw_delta_scales_with_lobby_size() {
        let p_exp = FixedTrait::new_unscaled(1, false) / FixedTrait::new_unscaled(2, false);
        let p_act = FixedTrait::ZERO();
        let k_factor: u128 = 50;

        let delta_small = MMRCalculatorImpl::raw_delta(p_exp, p_act, k_factor, 6);
        let delta_large = MMRCalculatorImpl::raw_delta(p_exp, p_act, k_factor, 12);

        // Larger lobby = larger potential delta (sqrt(N/6) scaling)
        // sqrt(12/6) = sqrt(2) ≈ 1.41 > sqrt(6/6) = 1
        assert!(delta_large.mag > delta_small.mag, "Larger lobby should have larger delta");
    }

    // ================================
    // DIMINISHING RETURNS TESTS
    // ================================

    #[test]
    fn test_diminishing_returns_small_delta() {
        // Small raw delta should pass through mostly unchanged
        let raw = FixedTrait::new_unscaled(10, false);
        let max_delta: u128 = 45;

        let capped = MMRCalculatorImpl::apply_diminishing_returns(raw, max_delta);
        // tanh(10/45) ≈ tanh(0.22) ≈ 0.217
        // Result ≈ 45 * 0.217 ≈ 9.77 (close to original 10)
        let diff = if capped > raw {
            capped - raw
        } else {
            raw - capped
        };
        // Should be within 10% of original
        let threshold = FixedTrait::new_unscaled(2, false);
        assert!(diff < threshold, "Small delta should pass through mostly unchanged");
    }

    #[test]
    fn test_diminishing_returns_large_delta() {
        // Large raw delta should be capped close to max_delta
        let raw = FixedTrait::new_unscaled(200, false);
        let max_delta: u128 = 45;

        let capped = MMRCalculatorImpl::apply_diminishing_returns(raw, max_delta);
        // tanh(200/45) ≈ tanh(4.44) ≈ 0.9996
        // Result ≈ 45 * 0.9996 ≈ 44.98 (close to max)
        let max_fixed = FixedTrait::new_unscaled(max_delta, false);
        assert!(capped < max_fixed, "Capped delta should be less than max");
        // Should be close to max though (> 40)
        let min_threshold = FixedTrait::new_unscaled(40, false);
        assert!(capped > min_threshold, "Large raw delta should result in near-max capped delta");
    }

    #[test]
    fn test_diminishing_returns_negative() {
        // Negative delta should work similarly
        let raw = FixedTrait::new_unscaled(200, true); // negative
        let max_delta: u128 = 45;

        let capped = MMRCalculatorImpl::apply_diminishing_returns(raw, max_delta);
        // Should be negative and close to -max
        assert!(capped.sign, "Negative delta should remain negative");
        let min_threshold = FixedTrait::new_unscaled(40, false);
        // Compare magnitudes
        assert!(capped.mag > min_threshold.mag, "Negative large delta should cap near -max");
    }

    // ================================
    // MEAN REGRESSION TESTS
    // ================================

    #[test]
    fn test_mean_regression_above_mean() {
        // Player above mean should have delta reduced
        let delta = FixedTrait::new_unscaled(20, false);
        let current_mmr: u128 = 1700;
        let mean: u128 = 1500;
        let lambda_scaled: u128 = 15000; // 0.015 * 1e6

        let adjusted = MMRCalculatorImpl::apply_mean_regression(delta, current_mmr, mean, lambda_scaled);
        // Δ_reg = 20 - 0.015 * (1700 - 1500) = 20 - 0.015 * 200 = 20 - 3 = 17
        assert!(adjusted < delta, "Delta should be reduced for player above mean");
        assert!(!adjusted.sign, "Adjusted delta should still be positive");
    }

    #[test]
    fn test_mean_regression_below_mean() {
        // Player below mean should have delta increased
        let delta = FixedTrait::new_unscaled(20, false);
        let current_mmr: u128 = 1300;
        let mean: u128 = 1500;
        let lambda_scaled: u128 = 15000; // 0.015 * 1e6

        let adjusted = MMRCalculatorImpl::apply_mean_regression(delta, current_mmr, mean, lambda_scaled);
        // Δ_reg = 20 - 0.015 * (1300 - 1500) = 20 - 0.015 * (-200) = 20 + 3 = 23
        assert!(adjusted > delta, "Delta should be increased for player below mean");
    }

    #[test]
    fn test_mean_regression_at_mean() {
        // Player at mean should have unchanged delta
        let delta = FixedTrait::new_unscaled(20, false);
        let current_mmr: u128 = 1500;
        let mean: u128 = 1500;
        let lambda_scaled: u128 = 15000;

        let adjusted = MMRCalculatorImpl::apply_mean_regression(delta, current_mmr, mean, lambda_scaled);
        let diff = if adjusted > delta {
            adjusted - delta
        } else {
            delta - adjusted
        };
        assert!(diff.mag < 1000000000000, "Delta should be unchanged for player at mean");
    }

    // ================================
    // NEW MMR CALCULATION TESTS
    // ================================

    #[test]
    fn test_new_mmr_positive_delta() {
        let current_mmr: u128 = 1000;
        let delta_reg = FixedTrait::new_unscaled(25, false);
        let min_mmr: u128 = 100;

        let new_mmr = MMRCalculatorImpl::calculate_new_mmr(current_mmr, delta_reg, min_mmr);
        assert!(new_mmr == 1025, "New MMR should be current + delta");
    }

    #[test]
    fn test_new_mmr_negative_delta() {
        let current_mmr: u128 = 1000;
        let delta_reg = FixedTrait::new_unscaled(25, true); // negative
        let min_mmr: u128 = 100;

        let new_mmr = MMRCalculatorImpl::calculate_new_mmr(current_mmr, delta_reg, min_mmr);
        assert!(new_mmr == 975, "New MMR should be current - delta");
    }

    #[test]
    fn test_new_mmr_floor_enforcement() {
        let current_mmr: u128 = 150;
        let delta_reg = FixedTrait::new_unscaled(100, true); // negative
        let min_mmr: u128 = 100;

        let new_mmr = MMRCalculatorImpl::calculate_new_mmr(current_mmr, delta_reg, min_mmr);
        // 150 - 100 = 50, but floor is 100
        assert!(new_mmr == 100, "New MMR should not go below floor");
    }

    #[test]
    fn test_new_mmr_floor_when_delta_exceeds_current() {
        let current_mmr: u128 = 50;
        let delta_reg = FixedTrait::new_unscaled(100, true); // negative
        let min_mmr: u128 = 100;

        let new_mmr = MMRCalculatorImpl::calculate_new_mmr(current_mmr, delta_reg, min_mmr);
        // 50 - 100 would be negative, should floor at min
        assert!(new_mmr == 100, "New MMR should be floor when delta exceeds current");
    }

    // ================================
    // FULL MMR CALCULATION TESTS
    // ================================

    #[test]
    fn test_winner_gains_mmr() {
        let config = MMRConfigDefaultImpl::default();

        // Player at median MMR, finishes first
        let current_mmr: u128 = 1000;
        let rank: u16 = 1;
        let player_count: u16 = 6;
        let median_mmr: u128 = 1000;

        // No split: game_median == global_median
        let new_mmr = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, rank, player_count, median_mmr, median_mmr,
        );

        // Winner should gain MMR
        assert!(new_mmr > current_mmr, "Winner should gain MMR");
    }

    #[test]
    fn test_loser_loses_mmr() {
        let config = MMRConfigDefaultImpl::default();

        // Player at median MMR, finishes last
        let current_mmr: u128 = 1000;
        let rank: u16 = 6;
        let player_count: u16 = 6;
        let median_mmr: u128 = 1000;

        // No split: game_median == global_median
        let new_mmr = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, rank, player_count, median_mmr, median_mmr,
        );

        // Loser should lose MMR
        assert!(new_mmr < current_mmr, "Loser should lose MMR");
    }

    #[test]
    fn test_floor_enforcement() {
        let config = MMRConfigDefaultImpl::default();

        // Player with very low MMR loses
        let current_mmr: u128 = 100;
        let rank: u16 = 6;
        let player_count: u16 = 6;
        let median_mmr: u128 = 1500;

        // No split: game_median == global_median
        let new_mmr = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, rank, player_count, median_mmr, median_mmr,
        );

        // Should not go below floor
        assert!(new_mmr >= config.min_mmr, "MMR should not go below floor");
    }

    #[test]
    fn test_high_mmr_winner_smaller_gain() {
        let config = MMRConfigDefaultImpl::default();

        // Two players win, one with high MMR, one with median MMR
        let high_mmr: u128 = 1500;
        let median_player_mmr: u128 = 1000;
        let median_mmr: u128 = 1000;
        let player_count: u16 = 6;
        let rank: u16 = 1;

        // No split: game_median == global_median
        let high_new = MMRCalculatorImpl::calculate_player_mmr(
            config, high_mmr, rank, player_count, median_mmr, median_mmr,
        );
        let med_new = MMRCalculatorImpl::calculate_player_mmr(
            config, median_player_mmr, rank, player_count, median_mmr, median_mmr,
        );

        let high_gain = high_new - high_mmr;
        let med_gain = med_new - median_player_mmr;

        // High MMR player expected to win, so smaller gain
        // Median player exceeded expectations more, so larger gain
        assert!(high_gain < med_gain, "High MMR winner should gain less than median MMR winner");
    }

    #[test]
    fn test_low_mmr_loser_behavior() {
        let config = MMRConfigDefaultImpl::default();

        // Low MMR player loses - expected behavior
        let low_mmr: u128 = 500;
        let median_mmr: u128 = 1000;
        let player_count: u16 = 6;
        let rank: u16 = 6; // last place

        // No split: game_median == global_median
        let low_new = MMRCalculatorImpl::calculate_player_mmr(
            config, low_mmr, rank, player_count, median_mmr, median_mmr,
        );

        // Low MMR player was expected to lose, so performance matches expectations
        // Mean regression pulls toward 1500, which can actually offset losses
        // Key behavior: floor is enforced and result is reasonable
        assert!(low_new >= config.min_mmr, "Should not go below floor");

        // Compare to a player with higher MMR losing
        let med_mmr: u128 = 1000;
        let med_new = MMRCalculatorImpl::calculate_player_mmr(
            config, med_mmr, rank, player_count, median_mmr, median_mmr,
        );

        // The median player underperformed more, so should lose more
        let low_change = if low_new > low_mmr {
            low_new - low_mmr
        } else {
            low_mmr - low_new
        };
        let med_loss = med_mmr - med_new;
        // Median player's loss should be larger (they underperformed expectations more)
        assert!(med_loss > low_change, "Median MMR loser should have larger net change");
    }

    #[test]
    fn test_middle_rank_minimal_change() {
        let config = MMRConfigDefaultImpl::default();

        // Player at median MMR finishes middle
        let current_mmr: u128 = 1000;
        let rank: u16 = 3; // middle-ish
        let player_count: u16 = 6;
        let median_mmr: u128 = 1000;

        // No split: game_median == global_median
        let new_mmr = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, rank, player_count, median_mmr, median_mmr,
        );

        // Change should be relatively small
        let change = if new_mmr > current_mmr {
            new_mmr - current_mmr
        } else {
            current_mmr - new_mmr
        };
        assert!(change < 20, "Middle rank should have small MMR change");
    }

    // ================================
    // GAME MMR UPDATES TESTS
    // ================================

    fn addr(val: felt252) -> ContractAddress {
        val.try_into().unwrap()
    }

    // ================================
    // EDGE CASES
    // ================================

    #[test]
    fn test_two_player_game() {
        let config = MMRConfigDefaultImpl::default();

        let current_mmr: u128 = 1000;
        let median_mmr: u128 = 1000;
        let player_count: u16 = 2;

        // No split: game_median == global_median
        // Winner
        let winner_new = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 1, player_count, median_mmr, median_mmr,
        );
        // Loser
        let loser_new = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 2, player_count, median_mmr, median_mmr,
        );

        assert!(winner_new > current_mmr, "2-player winner should gain");
        assert!(loser_new < current_mmr, "2-player loser should lose");
    }

    #[test]
    fn test_large_lobby() {
        let config = MMRConfigDefaultImpl::default();

        // 12-player game
        let current_mmr: u128 = 1000;
        let median_mmr: u128 = 1000;
        let player_count: u16 = 12;

        // No split: game_median == global_median
        let winner_new = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 1, player_count, median_mmr, median_mmr,
        );
        let loser_new = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 12, player_count, median_mmr, median_mmr,
        );

        // Larger lobby should have larger potential changes (sqrt(N/6) scaling)
        assert!(winner_new > current_mmr, "12-player winner should gain");
        assert!(loser_new < current_mmr, "12-player loser should lose");

        let winner_6_new = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, 1, 6, median_mmr, median_mmr);
        let winner_12_gain = winner_new - current_mmr;
        let winner_6_gain = winner_6_new - current_mmr;
        assert!(winner_12_gain > winner_6_gain, "12-player winner should gain more than 6-player");
    }

    #[test]
    fn test_extreme_mmr_difference() {
        let config = MMRConfigDefaultImpl::default();

        // Very high MMR player (2500) in median 1000 lobby
        let high_mmr: u128 = 2500;
        let median_mmr: u128 = 1000;
        let player_count: u16 = 6;

        // No split: game_median == global_median
        // If they win (expected), they may still gain a tiny amount
        let high_winner = MMRCalculatorImpl::calculate_player_mmr(
            config, high_mmr, 1, player_count, median_mmr, median_mmr,
        );
        // Due to mean regression pulling toward 1500, very high MMR
        // player may actually lose MMR even when winning!
        // This is expected behavior - the system pulls back to mean
        // Just verify it doesn't explode
        assert!(high_winner > 0, "Winner MMR should be positive");

        // If they lose (unexpected), they lose MMR
        let high_loser = MMRCalculatorImpl::calculate_player_mmr(
            config, high_mmr, 6, player_count, median_mmr, median_mmr,
        );
        // Loser should have less MMR than winner
        assert!(high_loser < high_winner, "Loser should have less than winner");
    }

    #[test]
    fn test_tanh_helper() {
        // tanh(0) = 0
        let t0 = MMRCalculatorImpl::tanh(FixedTrait::ZERO());
        assert!(t0.mag < 1000000000000, "tanh(0) should be ~0");

        // tanh(large) approaches 1
        let t_large = MMRCalculatorImpl::tanh(FixedTrait::new_unscaled(5, false));
        let one = FixedTrait::ONE();
        let diff = one - t_large;
        assert!(diff.mag < 100000000000000000, "tanh(5) should be close to 1");
    }

    #[test]
    fn test_sqrt_helper() {
        // sqrt(4) = 2
        let s4 = MMRCalculatorImpl::sqrt(FixedTrait::new_unscaled(4, false));
        let two = FixedTrait::new_unscaled(2, false);
        let diff = if s4 > two {
            s4 - two
        } else {
            two - s4
        };
        assert!(diff.mag < 100000000000000000, "sqrt(4) should be ~2");

        // sqrt(1) = 1
        let s1 = MMRCalculatorImpl::sqrt(FixedTrait::ONE());
        let diff1 = if s1 > FixedTrait::ONE() {
            s1 - FixedTrait::ONE()
        } else {
            FixedTrait::ONE() - s1
        };
        assert!(diff1.mag < 100000000000000000, "sqrt(1) should be ~1");
    }

    #[test]
    fn test_fixed_conversion() {
        // to_fixed and from_fixed roundtrip
        let original: u128 = 1234;
        let fixed = MMRCalculatorImpl::to_fixed(original);
        let back = MMRCalculatorImpl::from_fixed(fixed);
        assert!(back == original, "Fixed conversion should roundtrip");
    }

    #[test]
    fn test_from_fixed_negative() {
        // Negative fixed should return 0
        let neg = FixedTrait::new_unscaled(100, true); // -100
        let result = MMRCalculatorImpl::from_fixed(neg);
        assert!(result == 0, "Negative fixed should convert to 0");
    }

    // ================================
    // SPLIT LOBBY ADJUSTMENT TESTS
    // ================================

    #[test]
    fn test_split_lobby_no_adjustment_when_equal() {
        // When game_median == global_median, no adjustment occurs
        let delta = FixedTrait::new_unscaled(20, false);
        let game_median: u128 = 1000;
        let global_median: u128 = 1000;
        let spread_factor: u128 = 450;
        let weight_scaled: u128 = 250000; // 0.25

        let adjusted = MMRCalculatorImpl::apply_split_lobby_adjustment(
            delta, game_median, global_median, spread_factor, weight_scaled,
        );

        // Should be unchanged
        let diff = if adjusted > delta {
            adjusted - delta
        } else {
            delta - adjusted
        };
        assert!(diff.mag < 1000000000000, "No adjustment when medians equal");
    }

    #[test]
    fn test_split_lobby_high_tier_amplifies() {
        // High-tier game (game_median > global_median) should have amplified delta
        let delta = FixedTrait::new_unscaled(20, false);
        let game_median: u128 = 1200; // High-tier game
        let global_median: u128 = 1000;
        let spread_factor: u128 = 450;
        let weight_scaled: u128 = 250000; // 0.25

        let adjusted = MMRCalculatorImpl::apply_split_lobby_adjustment(
            delta, game_median, global_median, spread_factor, weight_scaled,
        );

        // mult = 1 + 0.25 * ((1200-1000)/450) = 1 + 0.25 * 0.444 ≈ 1.111
        // adjusted should be > delta
        assert!(adjusted > delta, "High-tier game should amplify delta");
    }

    #[test]
    fn test_split_lobby_low_tier_dampens() {
        // Low-tier game (game_median < global_median) should have dampened delta
        let delta = FixedTrait::new_unscaled(20, false);
        let game_median: u128 = 800; // Low-tier game
        let global_median: u128 = 1000;
        let spread_factor: u128 = 450;
        let weight_scaled: u128 = 250000; // 0.25

        let adjusted = MMRCalculatorImpl::apply_split_lobby_adjustment(
            delta, game_median, global_median, spread_factor, weight_scaled,
        );

        // mult = 1 + 0.25 * ((800-1000)/450) = 1 + 0.25 * (-0.444) ≈ 0.889
        // adjusted should be < delta
        assert!(adjusted < delta, "Low-tier game should dampen delta");
    }

    #[test]
    fn test_split_lobby_clamps_to_half() {
        // Extreme difference should be clamped to ±0.5
        let delta = FixedTrait::new_unscaled(20, false);
        let game_median: u128 = 2000; // Very high tier
        let global_median: u128 = 1000;
        let spread_factor: u128 = 450;
        let weight_scaled: u128 = 250000; // 0.25

        let adjusted = MMRCalculatorImpl::apply_split_lobby_adjustment(
            delta, game_median, global_median, spread_factor, weight_scaled,
        );

        // bias = clamp((2000-1000)/450, -0.5, 0.5) = clamp(2.22, -0.5, 0.5) = 0.5
        // mult = 1 + 0.25 * 0.5 = 1.125
        // Max possible mult with w=0.25 is 1.125 (when bias=0.5)
        let max_mult = FixedTrait::new_unscaled(1125, false) / FixedTrait::new_unscaled(1000, false);
        let expected_max = delta * max_mult;

        // adjusted should be close to expected_max (not exceeding)
        let diff = if adjusted > expected_max {
            adjusted - expected_max
        } else {
            expected_max - adjusted
        };
        assert!(diff.mag < 1000000000000000, "Should clamp at 0.5 bias");
    }

    #[test]
    fn test_split_lobby_negative_delta() {
        // Split adjustment should work with negative deltas too
        let delta = FixedTrait::new_unscaled(20, true); // negative
        let game_median: u128 = 1200; // High-tier game
        let global_median: u128 = 1000;
        let spread_factor: u128 = 450;
        let weight_scaled: u128 = 250000;

        let adjusted = MMRCalculatorImpl::apply_split_lobby_adjustment(
            delta, game_median, global_median, spread_factor, weight_scaled,
        );

        // Negative delta in high-tier should become more negative
        assert!(adjusted.sign, "Should stay negative");
        assert!(adjusted.mag > delta.mag, "Magnitude should increase for high-tier");
    }

    #[test]
    fn test_split_lobby_full_calculation() {
        let config = MMRConfigDefaultImpl::default();

        // Same player, same rank, but in different tiers
        let current_mmr: u128 = 1000;
        let rank: u16 = 1;
        let player_count: u16 = 6;
        let global_median: u128 = 1000;

        // High-tier game (median 1200)
        let high_tier_new = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, rank, player_count, 1200, global_median,
        );

        // Low-tier game (median 800)
        let low_tier_new = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, rank, player_count, 800, global_median,
        );

        // Normal game (no split)
        let normal_new = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, rank, player_count, global_median, global_median,
        );

        // High-tier winner should gain more, low-tier winner should gain less
        // But expected percentile also affects this...
        // In high-tier game, player at 1000 is below median (1200), so expected to do poorly
        // Winning should give bigger gain
        assert!(high_tier_new > normal_new, "High-tier upset win should give bigger gain");

        // In low-tier game, player at 1000 is above median (800), so expected to win
        // Winning gives smaller gain (meeting expectations)
        assert!(low_tier_new < normal_new, "Low-tier expected win should give smaller gain");
    }

    // ================================
    // INLINE MEDIAN CALCULATION TESTS
    // ================================
    // These test the median algorithm used inline in commit_game_mmr_meta
    // The contract calculates median from client-sorted MMR values

    /// Helper to compute expected median for sorted MMR values
    /// This mirrors the inline logic in commit_game_mmr_meta
    fn compute_expected_median(sorted_mmrs: Span<u128>) -> u128 {
        let len = sorted_mmrs.len();
        if len == 0 {
            return 0;
        }
        if len == 1 {
            return *sorted_mmrs.at(0);
        }
        if len % 2 == 1 {
            // Odd count: middle element
            let mid_idx = len / 2;
            *sorted_mmrs.at(mid_idx)
        } else {
            // Even count: average of two middle elements
            let upper_idx = len / 2;
            let lower_idx = upper_idx - 1;
            (*sorted_mmrs.at(lower_idx) + *sorted_mmrs.at(upper_idx)) / 2
        }
    }

    #[test]
    fn test_inline_median_single_player() {
        let mmrs: Span<u128> = array![1000].span();
        let median = compute_expected_median(mmrs);
        assert!(median == 1000, "Single player median should be their MMR");
    }

    #[test]
    fn test_inline_median_two_players() {
        let mmrs: Span<u128> = array![800, 1200].span();
        let median = compute_expected_median(mmrs);
        assert!(median == 1000, "Two player median should be average");
    }

    #[test]
    fn test_inline_median_three_players() {
        let mmrs: Span<u128> = array![800, 1000, 1200].span();
        let median = compute_expected_median(mmrs);
        assert!(median == 1000, "Three player median should be middle element");
    }

    #[test]
    fn test_inline_median_six_players() {
        let mmrs: Span<u128> = array![700, 850, 950, 1050, 1150, 1300].span();
        let median = compute_expected_median(mmrs);
        assert!(median == 1000, "Six player median should be 1000");
    }

    #[test]
    fn test_inline_median_twelve_players() {
        let mmrs: Span<u128> = array![800, 900, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1400, 1500, 1600].span();
        let median = compute_expected_median(mmrs);
        assert!(median == 1175, "12-player median should be 1175");
    }

    #[test]
    fn test_inline_median_thirty_players() {
        let mmrs: Span<u128> = array![
            700, 750, 800, 850, 900, 950, 1000, 1020, 1040, 1060, 1080, 1100, 1120, 1140, 1160, 1180, 1200, 1220, 1240,
            1260, 1280, 1300, 1350, 1400, 1450, 1500, 1550, 1600, 1700, 1800,
        ]
            .span();
        let median = compute_expected_median(mmrs);
        assert!(median == 1170, "30-player median should be 1170");
    }

    #[test]
    fn test_inline_median_with_duplicates() {
        let mmrs: Span<u128> = array![1000, 1000, 1000, 1000, 1000, 1200].span();
        let median = compute_expected_median(mmrs);
        assert!(median == 1000, "Median with duplicates should work");
    }

    #[test]
    fn test_inline_median_empty() {
        let mmrs: Span<u128> = array![].span();
        let median = compute_expected_median(mmrs);
        assert!(median == 0, "Empty array should give 0");
    }

    // ================================
    // FULL GAME SIMULATION TESTS
    // ================================

    #[test]
    fn test_all_ranks_monotonic_in_six_player_game() {
        let config = MMRConfigDefaultImpl::default();
        let current_mmr: u128 = 1000;
        let median_mmr: u128 = 1000;
        let player_count: u16 = 6;

        let rank1 = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 1, player_count, median_mmr, median_mmr,
        );
        let rank2 = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 2, player_count, median_mmr, median_mmr,
        );
        let rank3 = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 3, player_count, median_mmr, median_mmr,
        );
        let rank4 = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 4, player_count, median_mmr, median_mmr,
        );
        let rank5 = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 5, player_count, median_mmr, median_mmr,
        );
        let rank6 = MMRCalculatorImpl::calculate_player_mmr(
            config, current_mmr, 6, player_count, median_mmr, median_mmr,
        );

        // Verify monotonic decrease: better rank = more MMR
        assert!(rank1 > rank2, "Rank 1 > Rank 2");
        assert!(rank2 > rank3, "Rank 2 > Rank 3");
        assert!(rank3 > rank4, "Rank 3 > Rank 4");
        assert!(rank4 > rank5, "Rank 4 > Rank 5");
        assert!(rank5 > rank6, "Rank 5 > Rank 6");
    }

    #[test]
    fn test_full_game_six_players_upset_scenario() {
        let config = MMRConfigDefaultImpl::default();
        let player_mmrs: Array<u128> = array![800, 900, 1000, 1100, 1200, 1400];
        let player_count: u16 = 6;

        let mmrs_span = player_mmrs.span();
        let game_median = compute_expected_median(mmrs_span);
        assert!(game_median == 1050, "Game median should be 1050");

        // 800 MMR player wins (upset), 1400 loses (expected)
        let upset_winner_new = MMRCalculatorImpl::calculate_player_mmr(
            config, 800, 1, player_count, game_median, game_median,
        );
        let expected_loser_new = MMRCalculatorImpl::calculate_player_mmr(
            config, 1400, 6, player_count, game_median, game_median,
        );

        let winner_gain = upset_winner_new - 800;
        assert!(winner_gain > 25, "Upset winner should gain > 25 MMR");
        assert!(expected_loser_new < 1400, "Expected loser should lose MMR");
    }
}
