use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
use ammv2::packages::core::interfaces::router::{IRealmsSwapRouterDispatcher, IRealmsSwapRouterDispatcherTrait};
use ammv2::packages::core::utils::math::{get_amount_in, get_amount_out};
use super::super::helpers::fixtures::{E18, deploy_core_without_pair, deploy_two_hop_route, pair_reserves_for_tokens};

#[test]
#[should_panic(expected: "RealmsSwap::Router::_get_amounts_out::invalid path")]
fn test_get_amounts_out_rejects_invalid_path() {
    let (_, router, token0, _) = deploy_core_without_pair();
    let path = array![token0];
    IRealmsSwapRouterDispatcher { contract_address: router }.get_amounts_out(E18, path.span());
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_get_amounts_in::invalid path")]
fn test_get_amounts_in_rejects_invalid_path() {
    let (_, router, token0, _) = deploy_core_without_pair();
    let path = array![token0];
    IRealmsSwapRouterDispatcher { contract_address: router }.get_amounts_in(E18, path.span());
}

#[test]
fn test_get_amounts_out_matches_two_hop_reference() {
    let route = deploy_two_hop_route();
    let router = IRealmsSwapRouterDispatcher { contract_address: route.seeded.core.router };
    let factory = IRealmsSwapFactoryDispatcher { contract_address: route.seeded.core.factory };
    let fee_amount = factory.get_fee_amount();
    let path = array![route.seeded.core.token0, route.seeded.core.token1, route.token2];

    let (reserve01_in, reserve01_out) = pair_reserves_for_tokens(
        route.seeded.core.router, route.seeded.core.pair, route.seeded.core.token0, route.seeded.core.token1,
    );
    let amount1 = get_amount_out(2 * E18, reserve01_in, reserve01_out, fee_amount);

    let (reserve12_in, reserve12_out) = pair_reserves_for_tokens(
        route.seeded.core.router, route.pair12, route.seeded.core.token1, route.token2,
    );
    let amount2 = get_amount_out(amount1, reserve12_in, reserve12_out, fee_amount);

    let amounts = router.get_amounts_out(2 * E18, path.span());
    assert!(amounts.len() == 3, "two-hop exact-in quote should return one amount per path token");
    assert!(*amounts.at(0) == 2 * E18, "first amount should be the input amount");
    assert!(*amounts.at(1) == amount1, "middle amount should match the first hop quote");
    assert!(*amounts.at(2) == amount2, "final amount should match the second hop quote");
}

#[test]
fn test_get_amounts_in_matches_two_hop_reference() {
    let route = deploy_two_hop_route();
    let router = IRealmsSwapRouterDispatcher { contract_address: route.seeded.core.router };
    let factory = IRealmsSwapFactoryDispatcher { contract_address: route.seeded.core.factory };
    let fee_amount = factory.get_fee_amount();
    let desired_output = E18;
    let path = array![route.seeded.core.token0, route.seeded.core.token1, route.token2];

    let (reserve12_in, reserve12_out) = pair_reserves_for_tokens(
        route.seeded.core.router, route.pair12, route.seeded.core.token1, route.token2,
    );
    let amount1 = get_amount_in(desired_output, reserve12_in, reserve12_out, fee_amount);

    let (reserve01_in, reserve01_out) = pair_reserves_for_tokens(
        route.seeded.core.router, route.seeded.core.pair, route.seeded.core.token0, route.seeded.core.token1,
    );
    let amount0 = get_amount_in(amount1, reserve01_in, reserve01_out, fee_amount);

    let amounts = router.get_amounts_in(desired_output, path.span());
    assert!(amounts.len() == 3, "two-hop exact-out quote should return one amount per path token");
    assert!(*amounts.at(0) == amount0, "first amount should match the required input");
    assert!(*amounts.at(1) == amount1, "middle amount should match the intermediate input");
    assert!(*amounts.at(2) == desired_output, "last amount should be the desired output");
}
