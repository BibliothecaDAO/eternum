/// Fixed fees are checked in the same read-only library before any proof is interpreted.
pub fn assert_frame(tx: @starknet::TxInfo, l2_gas_bound: u64) {
    assert!(*tx.version == 3 && *tx.tip == 0, "ordinary zero-tip V3 required");
    assert!((*tx.paymaster_data).is_empty() && (*tx.account_deployment_data).is_empty(), "ordinary invoke required");
    assert!(*tx.nonce_data_availability_mode == 0 && *tx.fee_data_availability_mode == 0, "L1 availability required");
    assert!((*tx.proof_facts).is_empty(), "no client proof facts");
    assert_fixed_bounds(*tx.resource_bounds, l2_gas_bound);
}

fn assert_fixed_bounds(bounds: Span<starknet::ResourcesBounds>, l2_gas_bound: u64) {
    assert!(l2_gas_bound != 0 && bounds.len() == 3, "fixed resource bounds required");
    let mut seen = 0_u8;
    for bound in bounds {
        assert!(*bound.max_price_per_unit == 0, "zero resource price required");
        let bit = if *bound.resource == 'L2_GAS' {
            assert!(*bound.max_amount == l2_gas_bound, "fixed L2 gas required");
            1_u8
        } else if *bound.resource == 'L1_GAS' {
            assert!(*bound.max_amount == 0, "zero L1 gas required");
            2
        } else if *bound.resource == 'L1_DATA' {
            assert!(*bound.max_amount == 0, "zero L1 data gas required");
            4
        } else {
            panic!("unknown resource bound")
        };
        assert!(seen & bit == 0, "duplicate resource bound");
        seen = seen | bit;
    }
    assert!(seen == 7, "missing resource bound");
}
