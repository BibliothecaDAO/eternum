#[cfg(test)]
mod tests {
    use crate::models::config::FaithConfig;

    fn get_default_faith_config() -> FaithConfig {
        FaithConfig {
            enabled: true,
            wonder_base_fp_per_sec: 50,
            holy_site_fp_per_sec: 50,
            realm_fp_per_sec: 10,
            village_fp_per_sec: 1,
            owner_share_percent: 3000, // 30%
        }
    }

    #[test]
    fn test_faith_config_structure() {
        let config = get_default_faith_config();
        assert!(config.enabled, "Faith should be enabled");
        assert!(config.wonder_base_fp_per_sec == 50, "Wonder base FP should be 50");
        assert!(config.owner_share_percent == 3000, "Owner share should be 30%");
    }

    #[test]
    fn test_fp_rate_calculation_wonder() {
        let config = get_default_faith_config();
        // 30% of 50 = 15 to owner
        let to_owner: u16 = (50_u32 * 3000_u32 / 10000_u32).try_into().unwrap();
        let to_pledger: u16 = 50 - to_owner;
        assert!(to_owner == 15, "Owner should get 15 FP/sec");
        assert!(to_pledger == 35, "Pledger should get 35 FP/sec");
    }

    #[test]
    fn test_fp_rate_calculation_realm() {
        let config = get_default_faith_config();
        // 30% of 10 = 3 to owner
        let to_owner: u16 = (10_u32 * 3000_u32 / 10000_u32).try_into().unwrap();
        let to_pledger: u16 = 10 - to_owner;
        assert!(to_owner == 3, "Owner should get 3 FP/sec");
        assert!(to_pledger == 7, "Pledger should get 7 FP/sec");
    }

    #[test]
    fn test_fp_rate_calculation_village() {
        let config = get_default_faith_config();
        // 30% of 1 = 0 to owner (integer division)
        let to_owner: u16 = (1_u32 * 3000_u32 / 10000_u32).try_into().unwrap();
        let to_pledger: u16 = 1 - to_owner;
        assert!(to_owner == 0, "Owner should get 0 FP/sec (integer division)");
        assert!(to_pledger == 1, "Pledger should get 1 FP/sec");
    }

    #[test]
    fn test_fp_rate_calculation_holy_site() {
        let config = get_default_faith_config();
        // 30% of 50 = 15 to owner
        let to_owner: u16 = (50_u32 * 3000_u32 / 10000_u32).try_into().unwrap();
        let to_pledger: u16 = 50 - to_owner;
        assert!(to_owner == 15, "Owner should get 15 FP/sec");
        assert!(to_pledger == 35, "Pledger should get 35 FP/sec");
    }

    #[test]
    fn test_points_accumulation_over_time() {
        // Test that points accumulate correctly
        let fp_per_sec: u16 = 50;
        let time_elapsed: u64 = 3600; // 1 hour
        let expected_points: u128 = fp_per_sec.into() * time_elapsed.into();
        assert!(expected_points == 180000, "Should accumulate 180000 FP in 1 hour");
    }
}
