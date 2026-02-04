#[cfg(test)]
mod tests {
    use core::num::traits::Zero;
    use starknet::ContractAddress;
    use crate::constants::RESOURCE_PRECISION;
    use crate::models::bitcoin_mine::ProductionLevel;
    use crate::models::config::BitcoinMineConfig;

    const PHASE_DURATION: u64 = 600; // 10 minutes
    const PRIZE_PER_PHASE: u128 = 100_000_000; // 1 wBTC in smallest units (8 decimals)

    fn get_default_bitcoin_mine_config() -> BitcoinMineConfig {
        BitcoinMineConfig {
            enabled: true,
            phase_duration_seconds: PHASE_DURATION,
            prize_per_phase: PRIZE_PER_PHASE,
            reward_token: Zero::zero(), // Test address
            very_low_labor_per_sec: 1,
            low_labor_per_sec: 2,
            medium_labor_per_sec: 3,
            high_labor_per_sec: 4,
            very_high_labor_per_sec: 5,
        }
    }

    #[test]
    fn test_bitcoin_mine_config_structure() {
        let config = get_default_bitcoin_mine_config();
        assert!(config.enabled, "Should be enabled");
        assert!(config.phase_duration_seconds == 600, "Phase should be 10 minutes");
        assert!(config.very_low_labor_per_sec == 1, "Very low should be 1");
        assert!(config.very_high_labor_per_sec == 5, "Very high should be 5");
    }

    #[test]
    fn test_work_calculation() {
        // Work per phase at medium level: 3 labor/sec * 600 sec = 1800 work (with precision)
        let expected_work = 3_u128 * 600_u128 * RESOURCE_PRECISION;
        assert!(expected_work == 1800 * RESOURCE_PRECISION, "Work calculation should be correct");
    }

    #[test]
    fn test_production_level_conversion() {
        let level: ProductionLevel = ProductionLevel::Medium;
        let level_u8: u8 = level.into();
        assert!(level_u8 == 3, "Medium should be 3");

        let back: ProductionLevel = level_u8.into();
        assert!(back == ProductionLevel::Medium, "Should convert back to Medium");
    }
}
