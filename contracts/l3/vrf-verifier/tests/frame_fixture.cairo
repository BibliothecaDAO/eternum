use snforge_std::{start_cheat_resource_bounds_global, start_cheat_transaction_version_global};
use starknet::ResourcesBounds as ResourceBounds;

pub fn fixed_frame() {
    start_cheat_transaction_version_global(3);
    start_cheat_resource_bounds_global(
        array![
            ResourceBounds { resource: 'L1_GAS', max_amount: 0, max_price_per_unit: 0 },
            ResourceBounds { resource: 'L2_GAS', max_amount: 1200000000, max_price_per_unit: 0 },
            ResourceBounds { resource: 'L1_DATA', max_amount: 0, max_price_per_unit: 0 },
        ]
            .span(),
    );
}
