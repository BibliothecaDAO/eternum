use ammv2::packages::core::interfaces::router::{IRealmsSwapRouterDispatcher, IRealmsSwapRouterDispatcherTrait};
use snforge_std::start_cheat_block_timestamp;
use super::super::helpers::addresses::ALICE;
use super::super::helpers::fixtures::{E18, deploy_core_without_pair};

#[test]
#[should_panic(expected: "RealmsSwap::Router::_ensure_deadline::expired")]
fn test_add_liquidity_expired_deadline() {
    let (_, router, token0, token1) = deploy_core_without_pair();
    start_cheat_block_timestamp(router, 1);
    IRealmsSwapRouterDispatcher { contract_address: router }
        .add_liquidity(token0, token1, 2 * E18, 4 * E18, 1, 1, ALICE(), 0);
}
