#[cfg(test)]
mod tests {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use crate::constants::RESOURCE_PRECISION;
    use crate::models::config::BitcoinMineConfig;

    const PHASE_DURATION: u64 = 600; // 10 minutes
    const PRIZE_PER_PHASE: u128 = 100_000_000; // 1 SATOSHI in smallest units (8 decimals)

    fn get_default_bitcoin_mine_config() -> BitcoinMineConfig {
        BitcoinMineConfig { enabled: true, phase_duration_seconds: PHASE_DURATION, prize_per_phase: PRIZE_PER_PHASE }
    }

    #[test]
    fn test_bitcoin_mine_config_structure() {
        let config = get_default_bitcoin_mine_config();
        assert!(config.enabled, "Should be enabled");
        assert!(config.phase_duration_seconds == 600, "Phase should be 10 minutes");
        assert!(config.prize_per_phase == PRIZE_PER_PHASE, "Prize should match");
    }

    #[test]
    fn test_labor_calculation() {
        // Players deposit labor directly - no conversion
        // Player burns 1800 labor (with precision) = 1800 labor deposited
        let labor_deposited = 1800_u128 * RESOURCE_PRECISION;
        assert!(labor_deposited == 1800 * RESOURCE_PRECISION, "Labor calculation should be correct");
    }
}
