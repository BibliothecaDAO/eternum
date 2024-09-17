#[cfg(test)]
mod tests {
    use eternum::models::config::{SettlementConfig, SettlementConfigImpl};

    #[test]
    fn test_get_next_settlement_coord() {
        // starting values
        let mut settlement_config = SettlementConfig {
            config_id: 0,
            radius: 50,
            angle_scaled: 0,
            center: 2147483646,
            min_distance: 1,
            max_distance: 5,
            min_scaling_factor_scaled: 1844674407370955161,
            min_radius_increase: 30,
            max_radius_increase: 100,
        };
        let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config, 2);
        assert(coords.x == 2147483696, 'x coord');
        assert(coords.y == 2147483662, 'y coord');

        let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config, 3);
        assert(coords.x == 2147483691, 'x coord');
        assert(coords.y == 2147483680, 'y coord');

        let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config, 4);
        assert(coords.x == 2147483680, 'x coord');
        assert(coords.y == 2147483697, 'y coord');
    }
}
