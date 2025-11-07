use cubit::f128::types::fixed::{Fixed, FixedTrait};
use cubit::f128::math::ops as fixed_ops;

use crate::utils::fixed_constants as fc;

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

    // Get winner count based on registered player count and number of players with non-zero points
    fn get_winner_count(registered_player_count: u16, num_players_with_non_zero_points: u16) -> u16 {
        assert!(registered_player_count > 0, "Registered player count must be greater than zero");
        assert!(
            num_players_with_non_zero_points > 0, "Number of players with non-zero points must be greater than zero",
        );
        assert!(registered_player_count >= num_players_with_non_zero_points, "Invalid player counts");

        let registered_player_count_fixed: Fixed = registered_player_count.into();

        let one = fc::_1();
        let r = (registered_player_count_fixed / fc::_1000());
        let min = if fixed_ops::lt(one,r) {one} else {r};

        let winners_to_players_ratio = fc::_1() - (fc::_0_93() * min.pow(fc::_0_09()));
        let winner_count_from_ratio: u16 = (registered_player_count_fixed * winners_to_players_ratio)
            .ceil()
            .try_into()
            .unwrap();

        crate::utils::math::min(winner_count_from_ratio, num_players_with_non_zero_points)
    }


    // update this as well
    fn get_s_parameter(registered_player_count: u16) -> Fixed {
        // 0.3+(0.64*(1-(B3^(-0.7))))
        fc::_0_3() + (fc::_0_64() * (fc::_1() - (registered_player_count.into().pow(-fc::_0_7()))))
    }

    fn get_sum_rank_weights(rank_count: u16, s_parameter: Fixed) -> Fixed {
        assert!(rank_count > 0, "Rank count must be greater than zero");
        Self::_sum_of_powers(s_parameter, rank_count.into())
    }


    fn get_position_prize_amount(
        prize_pool: Fixed, position: u16, sum_position_weights: Fixed, s_parameter: Fixed, winner_count: u16
    ) -> u128 {

        if position > winner_count {
            return 0;
        }

        let norm_weight = Self::_norm_weight(Self::_rank_weight(position, s_parameter), sum_position_weights);
        let amount: u128 = (norm_weight * prize_pool).mag;
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
        let prize_pool_amount: u128 = (14_250 * _1e18); // incentive bonus
        let registered_player_count: u16 = 50;
        let total_players_with_non_zero_points: u16 = 50;

        let calc_prize_pool: Fixed = FixedTrait::new(prize_pool_amount, false);
        let calc_winner_count: u16 = iPrizeDistributionCalcImpl::get_winner_count(
            registered_player_count, total_players_with_non_zero_points,
        )
            .into();
        let calc_s_parameter: Fixed = iPrizeDistributionCalcImpl::get_s_parameter(registered_player_count);
        let calc_sum_position_weights: Fixed = iPrizeDistributionCalcImpl::get_sum_rank_weights(
            calc_winner_count, calc_s_parameter,
        );

        let p1 = iPrizeDistributionCalcImpl::get_position_prize_amount(
            calc_prize_pool, 1, // player.position
            calc_sum_position_weights, calc_s_parameter, calc_winner_count
        );

        let p5 = iPrizeDistributionCalcImpl::get_position_prize_amount(
            calc_prize_pool, 5, // player.position
            calc_sum_position_weights, calc_s_parameter, calc_winner_count
        );

        let p14 = iPrizeDistributionCalcImpl::get_position_prize_amount(
            calc_prize_pool, 14, // player.position
            calc_sum_position_weights, calc_s_parameter, calc_winner_count
        );

        let p15 = iPrizeDistributionCalcImpl::get_position_prize_amount(
            calc_prize_pool, 15, // player.position
            calc_sum_position_weights, calc_s_parameter, calc_winner_count
        );

        assert_eq!(p1, 1808665710182722317564);
        assert_eq!(p5, 1179348803697853754885);
        assert_eq!(p14, 450589631438543659187);
        assert_eq!(p15, 404904110226735944549);
    }
}

