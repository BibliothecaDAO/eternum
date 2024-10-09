#[cfg(test)]
mod tests {
    use debug::PrintTrait;
    use eternum::models::config::{SettlementConfig, SettlementConfigImpl};
    const RADIUS_PRECISION: u8 = 100;

    #[test]
    fn config_test_get_next_settlement_coord() {
        // starting values
        let mut settlement_config = SettlementConfig {
            config_id: 0,
            radius: 50 * RADIUS_PRECISION.into(),
            angle_scaled: 0,
            center: 2147483646,
            min_distance: 1 * RADIUS_PRECISION.into(),
            max_distance: 5 * RADIUS_PRECISION.into(),
            min_scaling_factor_scaled: 1844674407370955161,
            min_angle_increase: 30,
            max_angle_increase: 100,
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
