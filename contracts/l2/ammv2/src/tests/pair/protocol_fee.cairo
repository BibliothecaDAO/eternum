use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
use ammv2::packages::core::interfaces::router::{IRealmsSwapRouterDispatcher, IRealmsSwapRouterDispatcherTrait};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use super::super::helpers::addresses::{ADMIN, ALICE, BOB, UPGRADER};
use super::super::helpers::contracts::{approve_erc20, mint_mock_erc20};
use super::super::helpers::fixtures::{DEADLINE, E18, deploy_core_with_pair};

#[test]
fn test_protocol_fee_mints_lp_to_fee_recipient() {
    let setup = deploy_core_with_pair();
    let factory = IRealmsSwapFactoryDispatcher { contract_address: setup.factory };
    let router = IRealmsSwapRouterDispatcher { contract_address: setup.router };

    start_cheat_caller_address(setup.factory, ADMIN());
    factory.set_fee_to(UPGRADER());
    stop_cheat_caller_address(setup.factory);

    mint_mock_erc20(setup.token0, ALICE(), 100 * E18);
    mint_mock_erc20(setup.token1, ALICE(), 100 * E18);
    mint_mock_erc20(setup.token0, BOB(), 100 * E18);
    mint_mock_erc20(setup.token1, BOB(), 100 * E18);

    approve_erc20(setup.token0, ALICE(), setup.router, 20 * E18);
    approve_erc20(setup.token1, ALICE(), setup.router, 40 * E18);
    start_cheat_caller_address(setup.router, ALICE());
    let (_, _, liquidity) = router
        .add_liquidity(setup.token0, setup.token1, 20 * E18, 40 * E18, 1, 1, ALICE(), DEADLINE);
    stop_cheat_caller_address(setup.router);

    approve_erc20(setup.token0, BOB(), setup.router, 2 * E18);
    start_cheat_caller_address(setup.router, BOB());
    let path = array![setup.token0, setup.token1];
    let _ = router.swap_exact_tokens_for_tokens(2 * E18, 0, path.span(), BOB(), DEADLINE);
    stop_cheat_caller_address(setup.router);

    approve_erc20(setup.pair, ALICE(), setup.router, liquidity);
    start_cheat_caller_address(setup.router, ALICE());
    let _ = router.remove_liquidity(setup.token0, setup.token1, liquidity, 1, 1, ALICE(), DEADLINE);
    stop_cheat_caller_address(setup.router);

    let fee_recipient_lp = IERC20Dispatcher { contract_address: setup.pair }.balance_of(UPGRADER());
    assert!(fee_recipient_lp > 0, "fee recipient should receive LP protocol fees after growth in k");
}
