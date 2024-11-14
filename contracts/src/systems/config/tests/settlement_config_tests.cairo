#[cfg(test)]
mod tests {
    use debug::PrintTrait;
    use eternum::models::config::{SettlementConfig, SettlementConfigImpl};

    #[test]
    fn config_test_get_next_settlement_coord() {
        // starting values
        let mut settlement_config = SettlementConfig {
            config_id: 0,
            center: 2147483646,
            base_distance: 10,
            min_first_layer_distance: 30,
            points_placed: 0,
            current_layer: 1,
            current_side: 1,
            current_point_on_side: 0,
        };
        let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config);
        assert(coords.x == 2147483646, 'x coord');
        assert(coords.y == 2147483671, 'y coord');

        let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config);
        assert(coords.x == 2147483623, 'x coord');
        assert(coords.y == 2147483658, 'y coord');

        let coords = SettlementConfigImpl::get_next_settlement_coord(ref settlement_config);
        assert(coords.x == 2147483623, 'x coord');
        assert(coords.y == 2147483633, 'y coord');
    }
}
