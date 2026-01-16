// Chest Controller module (no contract). 
// Can be embedded into any game contract by storing `SeriesChestRewardState` in storage
// and using `allocate_chests` to update state per game.


pub mod series_chest_reward_calculator {

    use crate::utils::math::div_round;
    use crate::constants::WORLD_CONFIG_ID;
    use crate::models::series_chest_reward::{SeriesChestRewardState, RecentRingImpl, AnchorRingImpl};

    
    // Constants
    const BPS: u128 = 10_000; // 100% in basis points
    const SCALE_MIN_BPS: u128 = 6_250; // 0.625x
    const SCALE_MAX_BPS: u128 = 16_000; // 1.6x
    const RECENT_PLAYERS_MAX: u32 = 3; // fixed ring capacity

    // Some sensible defaults (used in tests / examples)
    const NUM_GAMES_IN_SERIES: u32 = 9;
    const TOTAL_NUM_CHESTS_TO_BE_DISTRIBUTED: u128 = 730;
    const CAP_RATIO_BPS: u128 = 11_000; // 1.10
    const EXPECTED_PLAYERS_START: u128 = 30;
    const EXPECTED_PLAYERS_END: u128 = 30;
    const FORECAST_SCHEDULE_WEIGHT_BPS: u128 = 6_000; // 0.6
    const RECENT_RATE_WEIGHT_BPS: u128 = 6_000; // 0.6
    const ANCHOR_WINDOW: u32 = 2; 
    const EMA_WINDOW: u32 = 3;
    const MIN_EFFECTIVE_PLAYERS: u128 = 1;
    const MAX_RATE_INCREASE_BPS: u128 = 600; // 6%
    const MAX_RATE_DECREASE_BPS: u128 = 600; // 6%


    // Pure function: EMA alpha in bps, derived from EMA_WINDOW constant
    // α = round(2 / (ema_window + 1)) in bps
    #[inline(always)]
    fn ema_alpha_bps() -> u128 {
        let denom: u128 = (EMA_WINDOW.into() + 1_u128);
        div_round(2_u128 * BPS, denom)
    }

    #[generate_trait]
    pub impl SeriesChestRewardStateImpl of SeriesChestRewardStateTrait {
        fn new() -> SeriesChestRewardState {
            SeriesChestRewardState{
                world_id: WORLD_CONFIG_ID,
                game_index: 0_u32,
                ema_players_scaled: EXPECTED_PLAYERS_START * BPS,

                recent: RecentRingImpl::new(),
                anchor: AnchorRingImpl::new(),

                has_last_rate: false,
                last_rate_bps: 0_u128,

                soft_supply: TOTAL_NUM_CHESTS_TO_BE_DISTRIBUTED,
                overspend_remaining: (TOTAL_NUM_CHESTS_TO_BE_DISTRIBUTED * (CAP_RATIO_BPS - BPS)) / BPS,
            }
        }
        fn games_remaining(self: @SeriesChestRewardState) -> u32 {
            let g = *self.game_index;
            let G = NUM_GAMES_IN_SERIES;
            if G > g { G - g } else { 0_u32 }
        }

        fn total_spent(self: @SeriesChestRewardState) -> u128 {
            let soft_spent = TOTAL_NUM_CHESTS_TO_BE_DISTRIBUTED - *self.soft_supply;
            let over_spent = ((TOTAL_NUM_CHESTS_TO_BE_DISTRIBUTED * (CAP_RATIO_BPS - BPS)) / BPS) - *self.overspend_remaining;
            soft_spent + over_spent
        }

        fn supplies(self: @SeriesChestRewardState) -> (u128, u128) { (*self.soft_supply, *self.overspend_remaining) }

        fn allocate_chests(ref self: SeriesChestRewardState, observed_players: u128) -> u128 {
            // Bail out if out of games or no supply left
            let no_supply = self.soft_supply == 0_u128 && self.overspend_remaining == 0_u128;
            if self.game_index >= NUM_GAMES_IN_SERIES || no_supply {
                if self.game_index < NUM_GAMES_IN_SERIES {
                    self.game_index = self.game_index + 1_u32;
                }
                return 0_u128;
            }

            // Enforce minimum effective players
            let mut n_obs = observed_players;
            if n_obs < MIN_EFFECTIVE_PLAYERS { n_obs = MIN_EFFECTIVE_PLAYERS; }

            // Update EMA: ema = alpha * obs + (1-alpha) * ema_prev (scaled by BPS)
            let obs_scaled = n_obs * BPS;
            let alpha = ema_alpha_bps();
            let ema_prev = self.ema_players_scaled;
            self.ema_players_scaled = div_round(alpha * obs_scaled + (BPS - alpha) * ema_prev, BPS);

            // Estimate current attendance
            let G: u128 = NUM_GAMES_IN_SERIES.into();
            let g: u128 = self.game_index.into();
            let scheduled_current: u128 = if G <= 1_u128 { EXPECTED_PLAYERS_END } else {
                let denom = G - 1_u128;
                let s0 = EXPECTED_PLAYERS_START;
                let s1 = EXPECTED_PLAYERS_END;
                let delta = if s1 >= s0 { s1 - s0 } else { 0_u128 };
                s0 + div_round(delta * g, denom)
            };

            let w_sched = FORECAST_SCHEDULE_WEIGHT_BPS;
            let curr_est_players = div_round(
                w_sched * scheduled_current + div_round((BPS - w_sched) * self.ema_players_scaled, BPS),
                BPS,
            );
            let curr_est_players_nonzero = if curr_est_players >= 1_u128 { curr_est_players } else { 1_u128 };

            // Forecast remaining players
            let mut expected_remaining_players = forecast_total_players(@self, self.ema_players_scaled);
            if expected_remaining_players == 0_u128 { expected_remaining_players = n_obs; }

            // Update recent players window (keep last RECENT_PLAYERS_MAX values)
            self.recent.push(n_obs, RECENT_PLAYERS_MAX);
            let rp_window_len: u32 = self.recent.window_len();

            // Compute growth ratio = avg_obs / current_est
            let denom_gr = (rp_window_len.into() * curr_est_players_nonzero);
            let recent_sum = self.recent.sum;
            let mut growth_ratio_bps = if denom_gr == 0_u128 { BPS } else { div_round(recent_sum * BPS, denom_gr) };
            if curr_est_players_nonzero < 1_u128 { growth_ratio_bps = BPS; }

            // Supply scaling
            let mut scale_bps = if growth_ratio_bps < BPS && growth_ratio_bps > 0_u128 {
                div_round(BPS * BPS, growth_ratio_bps)
            } else { BPS };
            if scale_bps < SCALE_MIN_BPS { scale_bps = SCALE_MIN_BPS; }
            if scale_bps > SCALE_MAX_BPS { scale_bps = SCALE_MAX_BPS; }

            // Baseline per-player rate in bps
            let r_budget_bps = if expected_remaining_players == 0_u128 { 0_u128 }
                else { (self.soft_supply * scale_bps) / expected_remaining_players };

            // Anchor rate: average over last anchor_window games
            let r_anchor_bps = self.anchor.avg_or(r_budget_bps);

            // Dynamic weight
            let mut dyn_w_bps = if growth_ratio_bps >= BPS {
                div_round(RECENT_RATE_WEIGHT_BPS * growth_ratio_bps, BPS)
            } else {
                div_round(RECENT_RATE_WEIGHT_BPS * growth_ratio_bps * growth_ratio_bps, BPS * BPS)
            };
            if dyn_w_bps > BPS { dyn_w_bps = BPS; }

            // Blend anchor and budget
            let r_blend_bps = div_round(dyn_w_bps * r_anchor_bps + (BPS - dyn_w_bps) * r_budget_bps, BPS);

            // Apply change caps
            let mut r_capped_bps = r_blend_bps;
            if self.has_last_rate {
                let up_limit = div_round(self.last_rate_bps * (BPS + MAX_RATE_INCREASE_BPS), BPS);
                let down_limit = div_round(self.last_rate_bps * (BPS - MAX_RATE_DECREASE_BPS), BPS);
                if r_capped_bps > up_limit { r_capped_bps = up_limit; }
                if r_capped_bps < down_limit { r_capped_bps = down_limit; }
            }

            // Compute integer pot with nearest rounding
            let mut pot = div_round(n_obs * r_capped_bps, BPS);

            // Do not exceed available supply
            let available = self.soft_supply + self.overspend_remaining;
            if pot > available { pot = available; }

            // Debit supplies (soft first)
            if pot <= self.soft_supply {
                self.soft_supply = self.soft_supply - pot;
            } else {
                let from_soft = self.soft_supply;
                let from_over = pot - from_soft;
                self.soft_supply = 0_u128;
                self.overspend_remaining = if self.overspend_remaining > from_over { self.overspend_remaining - from_over } else { 0_u128 };
            }

            // Update anchor with realised chests per player; maintain window via ring buffer
            let tpp_bps = if n_obs == 0_u128 { 0_u128 } else { div_round(pot * BPS, n_obs) };
            self.anchor.push_with_cap(tpp_bps, ANCHOR_WINDOW);

            // Store last rate and advance game index
            self.last_rate_bps = r_capped_bps;
            self.has_last_rate = true;
            self.game_index = self.game_index + 1_u32;

            pot
        }
    }

    // Forecast the total number of players across remaining games.
    // Returns an integer number of players (rounded to nearest).
    fn forecast_total_players(self: @SeriesChestRewardState, current_ema_players_scaled: u128) -> u128 {
        let g: u128 = (*self.game_index).into();
        let G: u128 = NUM_GAMES_IN_SERIES.into();
        if G <= g { return 0_u128; }
        let remaining: u128 = G - g;

        let s0: u128 = EXPECTED_PLAYERS_START;
        let s1: u128 = EXPECTED_PLAYERS_END;

        let schedule_sum: u128 = if G <= 1_u128 {
            remaining * s1
        } else {
            let denom = G - 1_u128; // (G-1)
            let sum_indices = ((g + (G - 1_u128)) * (G - g)) / 2_u128;
            let base = remaining * s0;
            let delta = if s1 >= s0 { s1 - s0 } else { 0_u128 };
            base + div_round(delta * sum_indices, denom)
        };

        let w: u128 = FORECAST_SCHEDULE_WEIGHT_BPS; // in bps
        let part_sched_scaled = w * schedule_sum; // players * bps
        let part_ema_scaled = div_round((BPS - w) * current_ema_players_scaled * remaining, BPS);
        div_round(part_sched_scaled + part_ema_scaled, BPS)
    }
}
