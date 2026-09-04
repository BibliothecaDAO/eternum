use cubit::f128::types::fixed::{Fixed, FixedTrait};
use game_ledger::types::MmrParams;

const BPS: u128 = 10_000;
const MIN_MMR: u128 = 100;

#[generate_trait]
pub impl MmrCalculatorImpl of MmrCalculatorTrait {
    fn calculate_player_mmr(
        params: MmrParams, current_mmr: u128, rank: u16, tie_count: u16, player_count: u16, median_mmr: u128,
    ) -> u128 {
        let expected = Self::expected_percentile(current_mmr, median_mmr, params.spread.into());
        let actual = Self::actual_percentile(rank, tie_count, player_count);
        let raw_delta = Self::raw_delta(expected, actual, params.k.into(), player_count);
        let capped_delta = Self::apply_diminishing_returns(raw_delta, params.max_delta.into());
        let regressed_delta = Self::apply_mean_regression(
            capped_delta, current_mmr, params.mean.into(), params.regression_bps.into(),
        );
        Self::apply_delta(current_mmr, regressed_delta)
    }

    fn apply_flag_modifier(current_mmr: u128, calculated_mmr: u128, sword: bool, shield: bool) -> u128 {
        if sword && calculated_mmr > current_mmr {
            current_mmr + (calculated_mmr - current_mmr) * 2
        } else if shield && calculated_mmr < current_mmr {
            current_mmr - (current_mmr - calculated_mmr) / 2
        } else {
            calculated_mmr
        }
    }

    fn actual_percentile(rank: u16, tie_count: u16, player_count: u16) -> Fixed {
        if player_count <= 1 {
            return FixedTrait::ZERO();
        }

        let first_position: u128 = rank.into() - 1;
        let last_position: u128 = rank.into() + tie_count.into() - 2;
        let numerator = Self::to_fixed(first_position + last_position);
        let denominator = Self::to_fixed(2 * (player_count - 1).into());
        numerator / denominator
    }

    fn expected_percentile(player_mmr: u128, median_mmr: u128, spread: u128) -> Fixed {
        let difference = if player_mmr >= median_mmr {
            FixedTrait::new_unscaled(player_mmr - median_mmr, false)
        } else {
            FixedTrait::new_unscaled(median_mmr - player_mmr, true)
        };
        let ratio = difference / Self::to_fixed(spread);
        FixedTrait::ONE() / (FixedTrait::ONE() + ratio.exp())
    }

    fn raw_delta(expected: Fixed, actual: Fixed, k: u128, player_count: u16) -> Fixed {
        let lobby_scale = Self::sqrt(Self::to_fixed(player_count.into()) / Self::to_fixed(6));
        Self::to_fixed(k) * lobby_scale * (expected - actual)
    }

    fn apply_diminishing_returns(raw_delta: Fixed, max_delta: u128) -> Fixed {
        let maximum = Self::to_fixed(max_delta);
        maximum * Self::tanh(raw_delta / maximum)
    }

    fn apply_mean_regression(delta: Fixed, current_mmr: u128, mean: u128, regression_bps: u128) -> Fixed {
        let regression = Self::to_fixed(regression_bps) / Self::to_fixed(BPS);
        let deviation = if current_mmr >= mean {
            FixedTrait::new_unscaled(current_mmr - mean, false)
        } else {
            FixedTrait::new_unscaled(mean - current_mmr, true)
        };
        delta - regression * deviation
    }

    fn apply_delta(current_mmr: u128, delta: Fixed) -> u128 {
        let magnitude = Self::from_fixed(FixedTrait::new(delta.mag, false));
        let updated_mmr = if delta.sign {
            if magnitude < current_mmr {
                current_mmr - magnitude
            } else {
                0
            }
        } else {
            current_mmr + magnitude
        };
        if updated_mmr < MIN_MMR {
            MIN_MMR
        } else {
            updated_mmr
        }
    }

    fn tanh(value: Fixed) -> Fixed {
        let exponential = (Self::to_fixed(2) * value).exp();
        (exponential - FixedTrait::ONE()) / (exponential + FixedTrait::ONE())
    }

    fn sqrt(value: Fixed) -> Fixed {
        value.pow(FixedTrait::new(9223372036854775808, false))
    }

    fn to_fixed(value: u128) -> Fixed {
        FixedTrait::new_unscaled(value, false)
    }

    fn from_fixed(value: Fixed) -> u128 {
        value.mag / 18446744073709551616
    }
}

#[cfg(test)]
mod tests {
    use cubit::f128::types::fixed::FixedTrait;
    use game_ledger::types::MmrParams;
    use super::MmrCalculatorImpl;

    fn params() -> MmrParams {
        MmrParams { enabled: true, mean: 1500, spread: 450, max_delta: 45, k: 50, regression_bps: 150, min_players: 6 }
    }

    #[test]
    fn rank_percentiles_preserve_the_existing_formula() {
        assert!(MmrCalculatorImpl::actual_percentile(1, 1, 6) == FixedTrait::ZERO());
        assert!(MmrCalculatorImpl::actual_percentile(6, 1, 6) == FixedTrait::ONE());
    }

    #[test]
    fn ties_use_the_average_zero_based_position() {
        let tied = MmrCalculatorImpl::actual_percentile(1, 2, 4);
        let expected = FixedTrait::new_unscaled(1, false) / FixedTrait::new_unscaled(6, false);
        assert!(tied == expected, "rank 1 tie should average positions 0 and 1");
    }

    #[test]
    fn winner_gains_and_loser_loses() {
        let winner = MmrCalculatorImpl::calculate_player_mmr(params(), 1000, 1, 1, 6, 1000);
        let loser = MmrCalculatorImpl::calculate_player_mmr(params(), 1000, 6, 1, 6, 1000);
        assert!(winner > 1000, "winner should gain MMR");
        assert!(loser < 1000, "loser should lose MMR");
    }

    #[test]
    fn inherited_no_split_fixtures_stay_stable() {
        let high_winner = MmrCalculatorImpl::calculate_player_mmr(params(), 1500, 1, 1, 6, 1000);
        let median_winner = MmrCalculatorImpl::calculate_player_mmr(params(), 1000, 1, 1, 6, 1000);
        assert!(high_winner - 1500 < median_winner - 1000, "expected winners should gain less");

        let middle = MmrCalculatorImpl::calculate_player_mmr(params(), 1000, 3, 1, 6, 1000);
        assert!(middle - 1000 < 20, "middle rank should move less than twenty points");

        let six_player_winner = MmrCalculatorImpl::calculate_player_mmr(params(), 1000, 1, 1, 6, 1000);
        let twelve_player_winner = MmrCalculatorImpl::calculate_player_mmr(params(), 1000, 1, 1, 12, 1000);
        assert!(twelve_player_winner > six_player_winner, "larger lobbies should scale the winner delta");

        let upset_winner = MmrCalculatorImpl::calculate_player_mmr(params(), 800, 1, 1, 6, 1050);
        let expected_loser = MmrCalculatorImpl::calculate_player_mmr(params(), 1400, 6, 1, 6, 1050);
        assert!(upset_winner - 800 > 25, "upset winner should gain more than twenty-five points");
        assert!(expected_loser < 1400, "expected loser should lose MMR");
    }

    #[test]
    fn inherited_rank_order_is_monotonic() {
        let mut previous = MmrCalculatorImpl::calculate_player_mmr(params(), 1000, 1, 1, 6, 1000);
        let mut rank: u16 = 2;
        while rank <= 6 {
            let next = MmrCalculatorImpl::calculate_player_mmr(params(), 1000, rank, 1, 6, 1000);
            assert!(previous > next, "better rank should produce more MMR");
            previous = next;
            rank += 1;
        }
    }

    #[test]
    fn sword_and_shield_modify_only_their_direction() {
        assert!(MmrCalculatorImpl::apply_flag_modifier(1000, 1025, true, false) == 1050);
        assert!(MmrCalculatorImpl::apply_flag_modifier(1000, 975, false, true) == 988);
        assert!(MmrCalculatorImpl::apply_flag_modifier(1000, 975, true, false) == 975);
        assert!(MmrCalculatorImpl::apply_flag_modifier(1000, 1025, false, true) == 1025);
    }

    #[test]
    fn mmr_never_falls_below_the_token_floor() {
        let loss = FixedTrait::new_unscaled(50, true);
        assert!(MmrCalculatorImpl::apply_delta(110, loss) == 100, "ledger MMR should match the token floor");
    }
}
