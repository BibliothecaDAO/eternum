use realms_vrf_verifier::vendor::ecvrf::Point;
use snforge_std::{
    start_cheat_account_deployment_data_global, start_cheat_fee_data_availability_mode_global,
    start_cheat_nonce_data_availability_mode_global, start_cheat_paymaster_data_global,
    start_cheat_resource_bounds_global, start_cheat_tip_global, start_cheat_transaction_version_global,
};
use starknet::ResourcesBounds as ResourceBounds;
use super::frame_fixture;

// Every case uses no stamp and an invalid point: the expected frame refusal must precede their interpretation.
fn root() {
    realms_vrf_verifier::transaction_root(Point { x: 0, y: 0 }, 1200000000);
}
#[test]
#[should_panic(expected: ("ordinary zero-tip V3 required",))]
fn query_versions_refuse_before_proof() {
    frame_fixture::fixed_frame();
    start_cheat_transaction_version_global(0x100000000000000000000000000000003);
    root();
}
#[test]
#[should_panic(expected: ("ordinary zero-tip V3 required",))]
fn nonzero_tip_refuses_before_proof() {
    frame_fixture::fixed_frame();
    start_cheat_tip_global(1);
    root();
}
#[test]
#[should_panic(expected: ("ordinary invoke required",))]
fn paymaster_refuses_before_proof() {
    frame_fixture::fixed_frame();
    start_cheat_paymaster_data_global(array![1].span());
    root();
}
#[test]
#[should_panic(expected: ("ordinary invoke required",))]
fn deployment_data_refuses_before_proof() {
    frame_fixture::fixed_frame();
    start_cheat_account_deployment_data_global(array![1].span());
    root();
}
#[test]
#[should_panic(expected: ("L1 availability required",))]
fn nonce_da_refuses_before_proof() {
    frame_fixture::fixed_frame();
    start_cheat_nonce_data_availability_mode_global(1);
    root();
}
#[test]
#[should_panic(expected: ("L1 availability required",))]
fn fee_da_refuses_before_proof() {
    frame_fixture::fixed_frame();
    start_cheat_fee_data_availability_mode_global(1);
    root();
}
fn bounds(l2_amount: u64, price: u128, resource: felt252, l1_amount: u64) {
    start_cheat_resource_bounds_global(
        array![
            ResourceBounds { resource: 'L1_GAS', max_amount: l1_amount, max_price_per_unit: 0 },
            ResourceBounds { resource: 'L2_GAS', max_amount: l2_amount, max_price_per_unit: price },
            ResourceBounds { resource, max_amount: 0, max_price_per_unit: 0 },
        ]
            .span(),
    );
}
#[test]
#[should_panic(expected: ("fixed L2 gas required",))]
fn undersized_bound_refuses_before_proof() {
    frame_fixture::fixed_frame();
    bounds(1199999999, 0, 'L1_DATA', 0);
    root();
}
#[test]
#[should_panic(expected: ("fixed L2 gas required",))]
fn oversized_bound_refuses_before_proof() {
    frame_fixture::fixed_frame();
    bounds(1200000001, 0, 'L1_DATA', 0);
    root();
}
#[test]
#[should_panic(expected: ("zero resource price required",))]
fn nonzero_price_refuses_before_proof() {
    frame_fixture::fixed_frame();
    bounds(1200000000, 1, 'L1_DATA', 0);
    root();
}
#[test]
#[should_panic(expected: ("zero L1 gas required",))]
fn nonzero_l1_bound_refuses_before_proof() {
    frame_fixture::fixed_frame();
    bounds(1200000000, 0, 'L1_DATA', 1);
    root();
}
#[test]
#[should_panic(expected: ("duplicate resource bound",))]
fn duplicate_resource_refuses_before_proof() {
    frame_fixture::fixed_frame();
    bounds(1200000000, 0, 'L1_GAS', 0);
    root();
}
#[test]
#[should_panic(expected: ("unknown resource bound",))]
fn unknown_resource_refuses_before_proof() {
    frame_fixture::fixed_frame();
    bounds(1200000000, 0, 'OTHER', 0);
    root();
}
#[test]
#[should_panic(expected: ("fixed resource bounds required",))]
fn missing_resources_refuse_before_proof() {
    frame_fixture::fixed_frame();
    start_cheat_resource_bounds_global(array![].span());
    root();
}
