// MMR (Matchmaking Rating) Calculation Library
//
// This module implements the 7-step rating update formula for the Blitz MMR system.
// Uses fixed-point math via cubit library for exponential and transcendental functions.
//
// Formula Steps:
// 1. Median MMR: M = median{MMR_j}
// 2. Expected Percentile: p_exp = 1 / (1 + e^((MMR - M) / D))
// 3. Actual Percentile: p_act = (rank - 1) / (N - 1)
// 4. Raw Delta: Δ_base = K₀ × √(N/6) × [p_exp - p_act]
// 5. Diminishing Returns: Δ = Δ_max × tanh(Δ_base / Δ_max)
// 6. Mean Regression: Δ_reg = Δ - λ × (MMR - μ)
// 7. New Rating: MMR' = max(100, MMR + Δ_reg)

use cubit::f128::types::fixed::{Fixed, FixedTrait};
use starknet::ContractAddress;
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

    /// Sort array and return the median value
    /// For even-length arrays, returns the lower of the two middle values
    fn calculate_median(values: Span<u128>) -> u128 {
        let len = values.len();
        if len == 0 {
            return 0;
        }
        if len == 1 {
            return *values.at(0);
        }

        // Copy to mutable array for sorting
        let mut sorted: Array<u128> = array![];
        for v in values {
            sorted.append(*v);
        }

        // Simple insertion sort (efficient for small arrays)
        let mut i: u32 = 1;
        while i < len {
            let mut j = i;
            while j > 0 {
                let current = *sorted.at(j);
                let prev = *sorted.at(j - 1);
                if current < prev {
                    // Swap - rebuild array with swapped elements
                    let mut new_sorted: Array<u128> = array![];
                    let mut k: u32 = 0;
                    while k < len {
                        if k == j - 1 {
                            new_sorted.append(current);
                        } else if k == j {
                            new_sorted.append(prev);
                        } else {
                            new_sorted.append(*sorted.at(k));
                        }
                        k += 1;
                    }
                    sorted = new_sorted;
                    j -= 1;
                } else {
                    break;
                }
            }
            i += 1;
        }

        // Return median (middle element, or lower-middle for even length)
        let mid_idx = (len - 1) / 2;
        *sorted.at(mid_idx)
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

    /// Step 6: Apply mean regression
    /// Δ_reg = Δ - λ × (MMR - μ)
    fn apply_mean_regression(delta: Fixed, current_mmr: u128, mean: u128, lambda_scaled: u128) -> Fixed {
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

        // Δ - λ × (MMR - μ)
        delta - regression_pull
    }

    /// Step 7: Calculate final new MMR with floor enforcement
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
    fn calculate_player_mmr(
        config: MMRConfig, player_mmr: u128, rank: u16, player_count: u16, median_mmr: u128,
    ) -> u128 {
        // Step 2: Expected percentile
        let p_exp = Self::expected_percentile(player_mmr, median_mmr, config.spread_factor);

        // Step 3: Actual percentile
        let p_act = Self::actual_percentile(rank, player_count);

        // Step 4: Raw delta
        let delta_base = Self::raw_delta(p_exp, p_act, config.k_factor, player_count);

        // Step 5: Apply diminishing returns
        let delta = Self::apply_diminishing_returns(delta_base, config.max_delta);

        // Step 6: Apply mean regression
        let delta_reg = Self::apply_mean_regression(
            delta, player_mmr, config.distribution_mean, config.mean_regression_scaled,
        );

        // Step 7: Calculate new MMR with floor
        Self::calculate_new_mmr(player_mmr, delta_reg, config.min_mmr)
    }

    /// Calculate MMR updates for all players in a game
    /// Returns array of (player, new_mmr) tuples
    fn calculate_game_mmr_updates(
        config: MMRConfig, players: Span<ContractAddress>, ranks: Span<u16>, current_mmrs: Span<u128>,
    ) -> Array<(ContractAddress, u128)> {
        let player_count: u16 = players.len().try_into().unwrap();

        // Step 1: Calculate median MMR
        let median_mmr = Self::calculate_median(current_mmrs);

        // Calculate new MMR for each player
        let mut updates: Array<(ContractAddress, u128)> = array![];
        let mut i: u32 = 0;
        while i < players.len() {
            let player = *players.at(i);
            let rank = *ranks.at(i);
            let current_mmr = *current_mmrs.at(i);

            let new_mmr = Self::calculate_player_mmr(config, current_mmr, rank, player_count, median_mmr);

            updates.append((player, new_mmr));
            i += 1;
        }

        updates
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
    // MEDIAN CALCULATION TESTS
    // ================================

    #[test]
    fn test_median_odd_count() {
        let values: Span<u128> = array![1200, 1000, 1100].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        assert!(median == 1100, "Median of [1200, 1000, 1100] should be 1100");
    }

    #[test]
    fn test_median_even_count() {
        let values: Span<u128> = array![1000, 1100, 1200, 1300].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        // Lower middle for even count
        assert!(median == 1100, "Median of [1000, 1100, 1200, 1300] should be 1100");
    }

    #[test]
    fn test_median_single() {
        let values: Span<u128> = array![1000].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        assert!(median == 1000, "Median of single element should be that element");
    }

    #[test]
    fn test_median_two_elements() {
        let values: Span<u128> = array![800, 1200].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        // For two elements, returns lower middle (index 0)
        assert!(median == 800, "Median of two elements should be lower value");
    }

    #[test]
    fn test_median_identical_elements() {
        let values: Span<u128> = array![1000, 1000, 1000, 1000].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        assert!(median == 1000, "Median of identical elements should be that value");
    }

    #[test]
    fn test_median_already_sorted() {
        let values: Span<u128> = array![100, 200, 300, 400, 500].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        assert!(median == 300, "Median of sorted array should be middle element");
    }

    #[test]
    fn test_median_reverse_sorted() {
        let values: Span<u128> = array![500, 400, 300, 200, 100].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        assert!(median == 300, "Median of reverse sorted array should be middle element");
    }

    #[test]
    fn test_median_empty() {
        let values: Span<u128> = array![].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        assert!(median == 0, "Median of empty array should be 0");
    }

    #[test]
    fn test_median_large_lobby() {
        // 12-player game with varying MMRs
        let values: Span<u128> = array![800, 900, 1000, 1050, 1100, 1150, 1200, 1250, 1300, 1400, 1500, 1600].span();
        let median = MMRCalculatorImpl::calculate_median(values);
        // Index (12-1)/2 = 5, so 6th element when sorted = 1150
        assert!(median == 1150, "Median of 12-player game should be 1150");
    }

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

        let new_mmr = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, rank, player_count, median_mmr);

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

        let new_mmr = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, rank, player_count, median_mmr);

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

        let new_mmr = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, rank, player_count, median_mmr);

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

        let high_new = MMRCalculatorImpl::calculate_player_mmr(config, high_mmr, rank, player_count, median_mmr);
        let med_new = MMRCalculatorImpl::calculate_player_mmr(
            config, median_player_mmr, rank, player_count, median_mmr,
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

        let low_new = MMRCalculatorImpl::calculate_player_mmr(config, low_mmr, rank, player_count, median_mmr);

        // Low MMR player was expected to lose, so performance matches expectations
        // Mean regression pulls toward 1500, which can actually offset losses
        // Key behavior: floor is enforced and result is reasonable
        assert!(low_new >= config.min_mmr, "Should not go below floor");

        // Compare to a player with higher MMR losing
        let med_mmr: u128 = 1000;
        let med_new = MMRCalculatorImpl::calculate_player_mmr(config, med_mmr, rank, player_count, median_mmr);

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

        let new_mmr = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, rank, player_count, median_mmr);

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

    #[test]
    fn test_calculate_game_mmr_updates_basic() {
        let config = MMRConfigDefaultImpl::default();

        // 6 players with equal MMR
        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')].span();
        let ranks = array![1_u16, 2, 3, 4, 5, 6].span();
        let mmrs = array![1000_u128, 1000, 1000, 1000, 1000, 1000].span();

        let updates = MMRCalculatorImpl::calculate_game_mmr_updates(config, players, ranks, mmrs);

        // Should have 6 updates
        assert!(updates.len() == 6, "Should have 6 updates");

        // Winner should gain, loser should lose
        let (_, winner_new) = *updates.at(0);
        let (_, loser_new) = *updates.at(5);
        assert!(winner_new > 1000, "Winner should gain MMR");
        assert!(loser_new < 1000, "Loser should lose MMR");
    }

    #[test]
    fn test_calculate_game_mmr_updates_varied_mmrs() {
        let config = MMRConfigDefaultImpl::default();

        // 6 players with varied MMRs
        let players = array![addr('p1'), addr('p2'), addr('p3'), addr('p4'), addr('p5'), addr('p6')].span();
        let ranks = array![1_u16, 2, 3, 4, 5, 6].span();
        let mmrs = array![800_u128, 900, 1000, 1100, 1200, 1300].span();

        let updates = MMRCalculatorImpl::calculate_game_mmr_updates(config, players, ranks, mmrs);

        // Low MMR player wins (huge upset) - should get significant gain
        let (_, low_winner_new) = *updates.at(0);
        assert!(low_winner_new > 800, "Low MMR upset winner should gain");

        // High MMR player loses (big upset) - should lose
        let (_, high_loser_new) = *updates.at(5);
        assert!(high_loser_new < 1300, "High MMR upset loser should lose");

        // Verify the relative magnitude makes sense
        let gain = low_winner_new - 800;
        let loss = 1300 - high_loser_new;
        // Both should be positive (gain and loss occurred)
        assert!(gain > 0, "Winner should gain");
        assert!(loss > 0, "Loser should lose");
    }

    #[test]
    fn test_calculate_game_mmr_updates_preserves_order() {
        let config = MMRConfigDefaultImpl::default();

        let p1 = addr('alice');
        let p2 = addr('bob');
        let p3 = addr('charlie');

        let players = array![p1, p2, p3].span();
        let ranks = array![2_u16, 1, 3].span();
        let mmrs = array![1000_u128, 1000, 1000].span();

        let updates = MMRCalculatorImpl::calculate_game_mmr_updates(config, players, ranks, mmrs);

        // Check order is preserved
        let (addr1, _) = *updates.at(0);
        let (addr2, _) = *updates.at(1);
        let (addr3, _) = *updates.at(2);
        assert!(addr1 == p1, "First player should be alice");
        assert!(addr2 == p2, "Second player should be bob");
        assert!(addr3 == p3, "Third player should be charlie");

        // Bob (rank 1) should gain most
        let (_, bob_new) = *updates.at(1);
        assert!(bob_new > 1000, "Bob (winner) should gain MMR");

        // Charlie (rank 3) should lose most
        let (_, charlie_new) = *updates.at(2);
        assert!(charlie_new < 1000, "Charlie (loser) should lose MMR");
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

        // Winner
        let winner_new = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, 1, player_count, median_mmr);
        // Loser
        let loser_new = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, 2, player_count, median_mmr);

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

        let winner_new = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, 1, player_count, median_mmr);
        let loser_new = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, 12, player_count, median_mmr);

        // Larger lobby should have larger potential changes (sqrt(N/6) scaling)
        assert!(winner_new > current_mmr, "12-player winner should gain");
        assert!(loser_new < current_mmr, "12-player loser should lose");

        let winner_6_new = MMRCalculatorImpl::calculate_player_mmr(config, current_mmr, 1, 6, median_mmr);
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

        // If they win (expected), they may still gain a tiny amount
        let high_winner = MMRCalculatorImpl::calculate_player_mmr(config, high_mmr, 1, player_count, median_mmr);
        // Due to mean regression pulling toward 1500, very high MMR
        // player may actually lose MMR even when winning!
        // This is expected behavior - the system pulls back to mean
        // Just verify it doesn't explode
        assert!(high_winner > 0, "Winner MMR should be positive");

        // If they lose (unexpected), they lose MMR
        let high_loser = MMRCalculatorImpl::calculate_player_mmr(config, high_mmr, 6, player_count, median_mmr);
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
}
