#[cfg(test)]
mod tests {
    use crate::models::config::BitcoinMineConfig;

    const PRIZE_PER_PHASE: u128 = 100_000_000; // 1 SATOSHI in smallest units (8 decimals)

    fn get_default_bitcoin_mine_config() -> BitcoinMineConfig {
        BitcoinMineConfig { enabled: true, prize_per_phase: PRIZE_PER_PHASE, min_labor_per_contribution: 1 }
    }

    #[test]
    fn test_bitcoin_mine_config_structure() {
        let config = get_default_bitcoin_mine_config();
        assert!(config.enabled, "Should be enabled");
        assert!(config.prize_per_phase == PRIZE_PER_PHASE, "Prize should match");
        assert!(config.min_labor_per_contribution == 1, "Min labor should match");
    }

    #[test]
    fn test_phase_calculation() {
        // Phase = time / bitcoin_phase_in_seconds
        // With 600 seconds per phase (10 minutes):
        // At time 0, phase = 0
        // At time 600, phase = 1
        // At time 1200, phase = 2
        let bitcoin_phase_in_seconds: u64 = 600;
        let time: u64 = 1200;
        let phase = time / bitcoin_phase_in_seconds;
        assert!(phase == 2, "Phase calculation should be correct");
    }
}
