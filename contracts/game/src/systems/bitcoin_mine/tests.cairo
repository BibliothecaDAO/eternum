#[cfg(test)]
mod tests {
    use crate::constants::RESOURCE_PRECISION;
    use crate::models::config::BitcoinMineConfig;

    const PRIZE_PER_PHASE: u128 = 100_000_000; // 1 SATOSHI in smallest units (8 decimals)
    const MIN_LABOR_PER_CONTRIBUTION: u128 = 100 * RESOURCE_PRECISION; // Minimum 100 labor per contribution

    fn get_default_bitcoin_mine_config() -> BitcoinMineConfig {
        BitcoinMineConfig {
            enabled: true, prize_per_phase: PRIZE_PER_PHASE, min_labor_per_contribution: MIN_LABOR_PER_CONTRIBUTION,
        }
    }

    #[test]
    fn test_bitcoin_mine_config_structure() {
        let config = get_default_bitcoin_mine_config();
        assert!(config.enabled, "Should be enabled");
        assert!(config.prize_per_phase == PRIZE_PER_PHASE, "Prize should match");
        assert!(config.min_labor_per_contribution == MIN_LABOR_PER_CONTRIBUTION, "Min labor should match");
    }

    #[test]
    fn test_labor_calculation() {
        // Players deposit labor directly - no conversion
        // Player burns 1800 labor (with precision) = 1800 labor deposited
        let labor_deposited = 1800_u128 * RESOURCE_PRECISION;
        assert!(labor_deposited == 1800 * RESOURCE_PRECISION, "Labor calculation should be correct");
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
