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

    fn _get_minimum(a: Fixed, b: Fixed) -> Fixed {
        if fixed_ops::lt(a, b) {
            a
        } else {
            b
        }
    }
    
    fn _clamp_min_max(value: Fixed, min_value: Fixed, max_value: Fixed) -> Fixed {
        if fixed_ops::lt(value, min_value) {
            min_value
        } else if fixed_ops::gt(value, max_value) {
            max_value
        } else {
            value
        }
    }

    fn _sponsorship_factor(total_entry_fee_amount: u128, total_prize_pool_amount: u128) -> Fixed {
        // 1 - (B6/B8)^0.5
        let total_entry_fee_amount_fixed: Fixed = FixedTrait::new(total_entry_fee_amount, false);
        let total_prize_pool_amount: Fixed = FixedTrait::new(total_prize_pool_amount, false);
        fc::_1() - (total_entry_fee_amount_fixed / total_prize_pool_amount).pow(fc::_0_5())
    }

    fn _get_rb_raw(registered_player_count: u16) -> Fixed {
        // 1 - (1.03 * (MIN(1,(B3/1000)))^ 0.13)
        let min_ratio = Self::_get_minimum(fc::_1(), registered_player_count.into() / fc::_1000());
        let rb_raw = fc::_1() - (fc::_1_03() * min_ratio.pow(fc::_0_13()));
        rb_raw
    }


    fn get_winner_count(
        registered_player_count: u16,
        num_players_with_non_zero_points: u16,
        total_entry_fee_amount: u128,
        total_prize_pool_amount: u128,
    ) -> u16 {
        assert!(registered_player_count > 0, "Registered player count must be greater than zero");
        assert!(num_players_with_non_zero_points > 0, "Number of players with non-zero points must be greater than zero");
        assert!(registered_player_count >= num_players_with_non_zero_points, "Invalid player counts");

        let registered_player_count_fixed: Fixed = registered_player_count.into();

        let rb_raw = Self::_get_rb_raw(registered_player_count);

        // clamp min max to be between 0.02 and 0.6
        let rb = Self::_clamp_min_max(rb_raw, fc::_0_02(), fc::_0_6());
        let a = Self::_sponsorship_factor(total_entry_fee_amount, total_prize_pool_amount);
        let rcap = fc::_0_5() + (fc::_0_5() * a);

        // gw = 0.05 + (0.95 * (20 / (X + 20))^2)
        let twenty = FixedTrait::new_unscaled(20, false);
        let twenty_over = twenty / (registered_player_count_fixed + twenty);
        let gw = fc::_0_05() + (fc::_0_95() * twenty_over.pow(fc::_2()));

        // r = max(0.02, min(rcap, rb + (3.3 * a * gw * (rcap - rb))))
        let raw_ratio = rb + (fc::_3_3() * a * gw * (rcap - rb));
        let r = Self::_clamp_min_max(raw_ratio, fc::_0_02(), rcap);

        let winner_ratio = (registered_player_count_fixed * r).ceil();
        let winner_count_from_ratio: u16 = winner_ratio.try_into().unwrap();

        if winner_count_from_ratio < num_players_with_non_zero_points {
            winner_count_from_ratio
        } else {
            num_players_with_non_zero_points
        }
    }


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
        let total_entry_fee_amount: u128 = (6_300 * _1e18);
        let total_sponsored_fee_amount: u128 = (10_000 * _1e18); 
        let total_prize_amount: u128 = total_entry_fee_amount + total_sponsored_fee_amount;
        
        let registered_player_count: u16 = 36;
        let total_players_with_non_zero_points: u16 = 36;

        let calc_prize_pool: Fixed = FixedTrait::new(total_prize_amount, false);
        let calc_winner_count: u16 = iPrizeDistributionCalcImpl::get_winner_count(
            registered_player_count, total_players_with_non_zero_points,
            total_entry_fee_amount, total_prize_amount

        );
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

        assert_eq!(p1, 2196_243_834_924_649_237_442);
        assert_eq!(p5, 1365064247722514238314);
        assert_eq!(p14, 468237616212351302112);
        assert_eq!(p15, 415_752_083_516_790_685_844);
    }
}

