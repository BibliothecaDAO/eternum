use cubit::f128::types::fixed::{Fixed, FixedTrait};

use s1_eternum::utils::fixed_constants as fc;

#[generate_trait]
pub impl iPrizeDistributionCalcImpl of iPrizeDistributionCalcTrait {
    fn _sum_of_powers(x: Fixed, y: u128) -> Fixed {
        if y == 0 {
            return FixedTrait::ZERO();
        }

        if x == FixedTrait::ONE() {
            // Special case: 1^1 + 1^2 + ... + 1^(y-1) = y
            FixedTrait::new_unscaled(y, false)
        } else {
            // General case: (x^y - 1)/(x - 1)
            let x_pow_y = x.pow(FixedTrait::new_unscaled(y, false));
            (x_pow_y - FixedTrait::ONE()) / (x - FixedTrait::ONE())
        }
    }

    // Should be very nearly equivalent to _sum_of_powers. 
    // the _sum_of_powers may be slightly higher than this one e.g _sum_of_powers(0.95, 50)
    // but it means _norm_weight will be slightly lower which will make calculations round downwards
    // and thus be more conservative in prize distribution.
    fn _sum_of_powers_using_loop(x: Fixed, y: u128) -> Fixed {
        let mut sum = FixedTrait::ZERO();
        let mut current_power = FixedTrait::ONE(); // x^0 is 1

        for _ in 0..y {
            sum += current_power;
            current_power *= x; // Move to the next power of x
        };

        sum
    }

    fn _rank_weight(rank: u16, s_parameter: Fixed) -> Fixed {
        assert!(rank > 0, "Rank must be greater than zero");
        s_parameter.pow(rank.into() - FixedTrait::ONE())
    }


    fn _norm_weight(rank_weight: Fixed, sum_rank_weights: Fixed) -> Fixed {
        rank_weight / sum_rank_weights
    }

    fn _prize_amount(entry_cost: Fixed, norm_weight: Fixed, remainder: Fixed) -> Fixed {
        entry_cost + (norm_weight * remainder)
    }


    // Get winner count based on registered player count and number of players with non-zero points
    fn get_winner_count(registered_player_count: u16, num_players_with_non_zero_points: u16) -> u16 {
        assert!(registered_player_count > 0, "Registered player count must be greater than zero");
        assert!(
            num_players_with_non_zero_points > 0, "Number of players with non-zero points must be greater than zero",
        );

        let winners_to_players_ratio = fc::_0_2();
        let registered_player_count_fixed: Fixed = registered_player_count.into();
        let winner_count_from_ratio: u16 = (registered_player_count_fixed * winners_to_players_ratio)
            .ceil()
            .try_into()
            .unwrap();

        if num_players_with_non_zero_points < winner_count_from_ratio {
            return num_players_with_non_zero_points;
        } else {
            return winner_count_from_ratio;
        }
    }

    fn get_s_parameter(registered_player_count: u16) -> Fixed {
        let registered_player_count_fixed: Fixed = registered_player_count.into();
        let a = fc::_0_95();
        let b = fc::_0_2() * registered_player_count_fixed.log10() + fc::_0_4();

        if a < b {
            a
        } else {
            b
        }
    }

    fn get_remainder(prize_pool: Fixed, total_baseline: Fixed) -> Fixed {
        prize_pool - total_baseline
    }

    fn get_total_baseline(entry_cost: Fixed, winner_count: Fixed) -> Fixed {
        entry_cost * winner_count
    }

    fn get_sum_rank_weights(rank_count: u16, s_parameter: Fixed) -> Fixed {
        assert!(rank_count > 0, "Rank count must be greater than zero");
        Self::_sum_of_powers(s_parameter, rank_count.into())
    }


    fn get_position_prize_amount(
        entry_cost_amount: Fixed, position: u16, remainder: Fixed, sum_position_weights: Fixed, s_parameter: Fixed,
    ) -> u128 {
        let norm_weight = Self::_norm_weight(Self::_rank_weight(position, s_parameter), sum_position_weights);

        let amount: u128 = Self::_prize_amount(entry_cost_amount, norm_weight, remainder).mag;

        return amount;
    }
}


#[cfg(test)]
mod tests {
    use cubit::f128::types::fixed::{Fixed, FixedTrait};
    use super::iPrizeDistributionCalcImpl;

    #[test]
    fn test_get_position_prize_amount() {
        let _1e18: u128 = 1_000_000_000_000_000_000;
        let entry_cost_amount: u128 = 250 * _1e18;
        let prize_pool_amount: u128 = 100_000 * _1e18;
        let registered_player_count: u16 = 500;
        let total_players_with_non_zero_points: u16 = 100;

        let calc_entry_cost: Fixed = FixedTrait::new(entry_cost_amount, false);
        let calc_prize_pool: Fixed = FixedTrait::new(prize_pool_amount, false);
        let calc_winner_count: u16 = iPrizeDistributionCalcImpl::get_winner_count(
            registered_player_count, total_players_with_non_zero_points,
        )
            .into();
        let calc_s_parameter: Fixed = iPrizeDistributionCalcImpl::get_s_parameter(registered_player_count);
        let calc_total_baseline: Fixed = iPrizeDistributionCalcImpl::get_total_baseline(
            calc_entry_cost, calc_winner_count.into(),
        );
        let calc_remainder: Fixed = iPrizeDistributionCalcImpl::get_remainder(calc_prize_pool, calc_total_baseline);
        let calc_sum_position_weights: Fixed = iPrizeDistributionCalcImpl::get_sum_rank_weights(
            calc_winner_count, calc_s_parameter,
        );

        let p1 = iPrizeDistributionCalcImpl::get_position_prize_amount(
            calc_entry_cost, 1, // player.position
            calc_remainder, calc_sum_position_weights, calc_s_parameter,
        );

        let p14 = iPrizeDistributionCalcImpl::get_position_prize_amount(
            calc_entry_cost, 14, // player.position
            calc_remainder, calc_sum_position_weights, calc_s_parameter,
        );

        let p57 = iPrizeDistributionCalcImpl::get_position_prize_amount(
            calc_entry_cost, 57, // player.position
            calc_remainder, calc_sum_position_weights, calc_s_parameter,
        );

        assert_eq!(p1, 4773996946891670404406);
        assert_eq!(p14, 2268120083233636506941);
        assert_eq!(p57, 389749989822782670308);
    }
}

