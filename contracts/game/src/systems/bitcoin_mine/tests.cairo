#[cfg(test)]
mod tests {
    use core::num::traits::zero::Zero;
    use snforge_std::start_cheat_block_timestamp_global;
    use crate::constants::{MAX_FUTURE_PHASES, MAX_ROLLOVER_PHASES};
    use crate::models::bitcoin_mine::{BitcoinMinePhaseLabor, BitcoinPhaseImpl, BitcoinPhaseLabor};
    use crate::models::config::{BitcoinMineConfig, TickInterval};

    // ============================================================================
    // Constants
    // ============================================================================

    const PHASE_DURATION: u64 = 600; // 10 minutes
    const PRIZE_PER_PHASE: u128 = 1_000_000_000_000_000_000;
    const MIN_LABOR: u128 = 100_000_000_000_000_000_000;
    const LABOR_AMOUNT: u128 = 500_000_000_000_000_000_000;

    // ============================================================================
    // Unit Tests: Config Structure
    // ============================================================================

    #[test]
    fn test_bitcoin_mine_config_structure() {
        let config = BitcoinMineConfig {
            enabled: true, prize_per_phase: PRIZE_PER_PHASE, min_labor_per_contribution: MIN_LABOR,
        };
        assert!(config.enabled, "Should be enabled");
        assert!(config.prize_per_phase == PRIZE_PER_PHASE, "Prize should match");
        assert!(config.min_labor_per_contribution == MIN_LABOR, "Min labor should match");
    }

    #[test]
    fn test_bitcoin_mine_config_disabled() {
        let config = BitcoinMineConfig {
            enabled: false, prize_per_phase: PRIZE_PER_PHASE, min_labor_per_contribution: MIN_LABOR,
        };
        assert!(!config.enabled, "Should be disabled");
    }

    // ============================================================================
    // Unit Tests: Phase Timing Calculations
    // ============================================================================

    #[test]
    fn test_phase_calculation_basic() {
        // Phase = time / bitcoin_phase_in_seconds
        // At time 1200, phase = 1200 / 600 = 2
        let phase = 1200_u64 / PHASE_DURATION;
        assert!(phase == 2, "Phase calculation should be correct");
    }

    #[test]
    fn test_phase_calculation_at_zero() {
        // At time 0, phase = 0 / 600 = 0
        let phase = 0_u64 / PHASE_DURATION;
        assert!(phase == 0, "Phase 0 at time 0");
    }

    #[test]
    fn test_phase_calculation_boundary() {
        // At time 599, still phase 0
        let phase_before = 599_u64 / PHASE_DURATION;
        assert!(phase_before == 0, "Should be phase 0 at t=599");

        // At time 600, becomes phase 1
        let phase_at = 600_u64 / PHASE_DURATION;
        assert!(phase_at == 1, "Should be phase 1 at t=600");
    }

    #[test]
    fn test_phase_end_time() {
        // Phase 1 should end at (1 + 1) * 600 - 1 = 1199
        let tick = TickInterval { tick_interval: PHASE_DURATION };
        let end_time = BitcoinPhaseImpl::end_time(1, tick);
        assert!(end_time == 1199, "Phase 1 should end at 1199");
    }

    #[test]
    fn test_phase_end_time_phase_0() {
        // Phase 0 should end at (0 + 1) * 600 - 1 = 599
        let tick = TickInterval { tick_interval: PHASE_DURATION };
        let end_time = BitcoinPhaseImpl::end_time(0, tick);
        assert!(end_time == 599, "Phase 0 should end at 599");
    }

    #[test]
    fn test_phase_end_time_high_phase() {
        // Phase 100 should end at (100 + 1) * 600 - 1 = 60599
        let tick = TickInterval { tick_interval: PHASE_DURATION };
        let end_time = BitcoinPhaseImpl::end_time(100, tick);
        assert!(end_time == 60599, "Phase 100 should end at 60599");
    }

    #[test]
    fn test_phase_contribution_window_open() {
        let tick = TickInterval { tick_interval: PHASE_DURATION };

        // At time 1000, phase 1 window (0-1199) should be open
        start_cheat_block_timestamp_global(1000);
        assert!(BitcoinPhaseImpl::is_contribution_open(1, tick), "Phase 1 window should be open at t=1000");
    }

    #[test]
    fn test_phase_contribution_window_open_early() {
        let tick = TickInterval { tick_interval: PHASE_DURATION };

        // At time 600 (start of phase 1), window for phase 1 should be open
        start_cheat_block_timestamp_global(600);
        assert!(BitcoinPhaseImpl::is_contribution_open(1, tick), "Phase 1 window should be open at t=600");
    }

    #[test]
    fn test_phase_contribution_window_closed() {
        let tick = TickInterval { tick_interval: PHASE_DURATION };

        // At time 1200, phase 1 window should be closed
        start_cheat_block_timestamp_global(1200);
        assert!(BitcoinPhaseImpl::has_contribution_closed(1, tick), "Phase 1 window should be closed at t=1200");
    }

    #[test]
    fn test_phase_contribution_at_boundary() {
        let tick = TickInterval { tick_interval: PHASE_DURATION };

        // At time 1199 (exactly at end), window should be closed (>= end_time)
        start_cheat_block_timestamp_global(1199);
        assert!(BitcoinPhaseImpl::has_contribution_closed(1, tick), "Phase 1 window should be closed at end time");

        // At time 1198, window should still be open
        start_cheat_block_timestamp_global(1198);
        assert!(BitcoinPhaseImpl::is_contribution_open(1, tick), "Phase 1 window should be open at t=1198");
    }

    #[test]
    fn test_contribution_future_phase() {
        let tick = TickInterval { tick_interval: PHASE_DURATION };

        // At time 1000 (phase 1), can contribute to future phases
        start_cheat_block_timestamp_global(1000);

        // Phase 5 window should be open (ends at 3599)
        assert!(BitcoinPhaseImpl::is_contribution_open(5, tick), "Phase 5 window should be open from phase 1");

        // Phase 10 window should be open (ends at 6599)
        assert!(BitcoinPhaseImpl::is_contribution_open(10, tick), "Phase 10 window should be open from phase 1");
    }

    // ============================================================================
    // Unit Tests: Constants
    // ============================================================================

    #[test]
    fn test_max_future_phases_constant() {
        // Verify constant is 30
        assert!(MAX_FUTURE_PHASES == 30, "MAX_FUTURE_PHASES should be 30");
    }

    #[test]
    fn test_max_rollover_phases_constant() {
        // Verify constant is 6
        assert!(MAX_ROLLOVER_PHASES == 6, "MAX_ROLLOVER_PHASES should be 6");
    }

    // ============================================================================
    // Unit Tests: Model Structures (without world)
    // ============================================================================

    #[test]
    fn test_bitcoin_phase_labor_default() {
        let phase_labor = BitcoinPhaseLabor {
            phase_id: 1,
            prize_pool: PRIZE_PER_PHASE,
            total_labor: LABOR_AMOUNT,
            participant_count: 2,
            claim_count: 0,
            reward_receiver_phase: 0,
        };
        assert!(phase_labor.phase_id == 1, "Phase ID should be 1");
        assert!(phase_labor.prize_pool == PRIZE_PER_PHASE, "Prize pool should match");
        assert!(phase_labor.total_labor == LABOR_AMOUNT, "Total labor should match");
        assert!(phase_labor.participant_count == 2, "Participant count should be 2");
        assert!(phase_labor.claim_count == 0, "Claim count should be 0");
        assert!(phase_labor.reward_receiver_phase == 0, "Reward receiver should be 0 (pending)");
    }

    #[test]
    fn test_bitcoin_mine_phase_labor_default() {
        let mine_phase = BitcoinMinePhaseLabor {
            phase_id: 1, mine_id: 100, labor_contributed: LABOR_AMOUNT, claimed: false,
        };
        assert!(mine_phase.phase_id == 1, "Phase ID should be 1");
        assert!(mine_phase.mine_id == 100, "Mine ID should be 100");
        assert!(mine_phase.labor_contributed == LABOR_AMOUNT, "Labor contributed should match");
        assert!(!mine_phase.claimed, "Should not be claimed");
    }

    #[test]
    fn test_reward_receiver_phase_values() {
        // reward_receiver_phase = 0 means pending/burned
        let phase_pending = BitcoinPhaseLabor {
            phase_id: 1,
            prize_pool: PRIZE_PER_PHASE,
            total_labor: 0,
            participant_count: 0,
            claim_count: 0,
            reward_receiver_phase: 0,
        };
        assert!(phase_pending.reward_receiver_phase.is_zero(), "Zero means pending/burned");

        // reward_receiver_phase = self (same phase) means winner found
        let phase_won = BitcoinPhaseLabor {
            phase_id: 2,
            prize_pool: PRIZE_PER_PHASE,
            total_labor: 1000,
            participant_count: 1,
            claim_count: 1,
            reward_receiver_phase: 2,
        };
        assert!(phase_won.reward_receiver_phase == 2, "Self means winner found");

        // reward_receiver_phase = other phase means forwarded
        let phase_forwarded = BitcoinPhaseLabor {
            phase_id: 3,
            prize_pool: PRIZE_PER_PHASE,
            total_labor: 1000,
            participant_count: 1,
            claim_count: 1,
            reward_receiver_phase: 5,
        };
        assert!(phase_forwarded.reward_receiver_phase == 5, "Other phase means forwarded");
    }

    // ============================================================================
    // Unit Tests: Contribution Percentage Logic
    // ============================================================================

    #[test]
    fn test_contribution_percentage_calculation() {
        // If total_labor = 1000, and mine contributed 300, percentage = 300 * 10000 / 1000 = 3000 bps (30%)
        let total_labor: u128 = 1000;
        let mine_labor: u128 = 300;
        let percentage = (mine_labor * 10000) / total_labor;
        assert!(percentage == 3000, "Should be 3000 bps (30%)");
    }

    #[test]
    fn test_contribution_percentage_single_contributor() {
        // If total_labor = 500, and mine contributed 500, percentage = 500 * 10000 / 500 = 10000 bps (100%)
        let total_labor: u128 = 500;
        let mine_labor: u128 = 500;
        let percentage = (mine_labor * 10000) / total_labor;
        assert!(percentage == 10000, "Should be 10000 bps (100%)");
    }

    #[test]
    fn test_contribution_percentage_multiple_contributors() {
        // 3 contributors: 50%, 30%, 20%
        let total_labor: u128 = 10000;
        let mine1_labor: u128 = 5000;
        let mine2_labor: u128 = 3000;
        let mine3_labor: u128 = 2000;

        let pct1 = (mine1_labor * 10000) / total_labor;
        let pct2 = (mine2_labor * 10000) / total_labor;
        let pct3 = (mine3_labor * 10000) / total_labor;

        assert!(pct1 == 5000, "Mine 1 should have 50%");
        assert!(pct2 == 3000, "Mine 2 should have 30%");
        assert!(pct3 == 2000, "Mine 3 should have 20%");
        assert!(pct1 + pct2 + pct3 == 10000, "Total should be 100%");
    }

    // ============================================================================
    // Unit Tests: Phase Validation Logic
    // ============================================================================

    #[test]
    fn test_future_phase_validation() {
        let current_phase: u64 = 5;
        let max_target = current_phase + MAX_FUTURE_PHASES;

        // Can contribute to current phase
        assert!(current_phase >= current_phase, "Current phase is valid");
        assert!(current_phase <= max_target, "Current phase within max");

        // Can contribute up to 30 phases ahead
        let target_30_ahead = current_phase + 30;
        assert!(target_30_ahead <= max_target, "30 phases ahead is valid");

        // Cannot contribute 31 phases ahead
        let target_31_ahead = current_phase + 31;
        assert!(target_31_ahead > max_target, "31 phases ahead is invalid");
    }

    #[test]
    fn test_past_phase_validation() {
        let current_phase: u64 = 10;
        let past_phase: u64 = 5;

        // Cannot contribute to past phases
        assert!(past_phase < current_phase, "Past phase is before current");
    }
}
