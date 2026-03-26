use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
use ammv2::packages::core::interfaces::router::{IRealmsSwapRouterDispatcher, IRealmsSwapRouterDispatcherTrait};
use ammv2::packages::core::utils::math::{MINIMUM_LIQUIDITY, burn_address};
use core::num::traits::Zero;
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use snforge_std::start_cheat_caller_address;
use super::super::helpers::addresses::{ALICE, BOB};
use super::super::helpers::contracts::{approve_erc20, deploy_mock_erc20, mint_mock_erc20};
use super::super::helpers::fixtures::{
    DEADLINE, E18, add_liquidity, deploy_core_with_pair, deploy_core_without_pair, deploy_seeded_pair, pair_reserves,
    remove_liquidity, sort_tokens,
};

fn assert_total_supply_stays_below_geometric_mean(total_supply: u256, reserve0: u256, reserve1: u256) {
    let reserve_product = reserve0 * reserve1;
    assert!(total_supply * total_supply <= reserve_product, "total supply should stay below geometric mean");
}

fn fund_liquidity_provider(
    token0: starknet::ContractAddress, token1: starknet::ContractAddress, provider: starknet::ContractAddress,
) {
    mint_mock_erc20(token0, provider, 100 * E18);
    mint_mock_erc20(token1, provider, 100 * E18);
}

fn approve_router_for_liquidity(
    router: starknet::ContractAddress,
    provider: starknet::ContractAddress,
    token0: starknet::ContractAddress,
    token1: starknet::ContractAddress,
) {
    approve_erc20(token0, provider, router, 100 * E18);
    approve_erc20(token1, provider, router, 100 * E18);
}

#[test]
fn test_add_remove_liquidity_created_pair() {
    let setup = deploy_core_with_pair();
    let pair_erc20 = IERC20Dispatcher { contract_address: setup.pair };
    let token0_erc20 = IERC20Dispatcher { contract_address: setup.token0 };
    let token1_erc20 = IERC20Dispatcher { contract_address: setup.token1 };

    fund_liquidity_provider(setup.token0, setup.token1, ALICE());
    approve_router_for_liquidity(setup.router, ALICE(), setup.token0, setup.token1);

    let (amount0, amount1, _) = add_liquidity(setup.router, ALICE(), setup.token0, setup.token1, 2 * E18, 4 * E18);
    assert!(amount0 == 2 * E18, "first add should use the requested token0 amount");
    assert!(amount1 == 4 * E18, "first add should use the requested token1 amount");

    let (reserve0, reserve1, _) = pair_reserves(setup.pair);
    let total_supply = pair_erc20.total_supply();
    assert_total_supply_stays_below_geometric_mean(total_supply, reserve0, reserve1);

    let (amount0_again, amount1_again, _) = add_liquidity(
        setup.router, ALICE(), setup.token0, setup.token1, 2 * E18, 4 * E18,
    );
    assert!(amount0_again == 2 * E18, "second add should preserve the token0 ratio");
    assert!(amount1_again == 4 * E18, "second add should preserve the token1 ratio");

    let (reserve0_again, reserve1_again, _) = pair_reserves(setup.pair);
    let total_supply_again = pair_erc20.total_supply();
    assert_total_supply_stays_below_geometric_mean(total_supply_again, reserve0_again, reserve1_again);

    assert!(100 * E18 - token0_erc20.balance_of(ALICE()) == reserve0_again, "token0 reserve should match user spend");
    assert!(100 * E18 - token1_erc20.balance_of(ALICE()) == reserve1_again, "token1 reserve should match user spend");

    let pair_balance = pair_erc20.balance_of(ALICE());
    assert!(
        pair_balance + MINIMUM_LIQUIDITY == total_supply_again,
        "provider LP balance plus minimum liquidity should equal total supply",
    );

    approve_erc20(setup.pair, ALICE(), setup.router, pair_balance);
    let (amount0_burn, amount1_burn) = remove_liquidity(
        setup.router, ALICE(), setup.token0, setup.token1, pair_balance,
    );
    assert!(amount0_burn > 0, "burn should return token0");
    assert!(amount1_burn > 0, "burn should return token1");

    assert!(pair_erc20.balance_of(ALICE()) == 0, "provider LP should be fully burned");
    assert!(pair_erc20.total_supply() == MINIMUM_LIQUIDITY, "only minimum liquidity should remain");
    assert!(
        pair_erc20.balance_of(burn_address()) == MINIMUM_LIQUIDITY,
        "burn address should hold the locked minimum liquidity",
    );

    let (reserve0_after_burn, reserve1_after_burn, _) = pair_reserves(setup.pair);
    assert!(
        MINIMUM_LIQUIDITY * MINIMUM_LIQUIDITY <= reserve0_after_burn * reserve1_after_burn,
        "remaining reserves should still cover the locked minimum liquidity",
    );
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_add_liquidity::pair does not exist")]
fn test_add_liquidity_rejects_non_created_pair() {
    let (factory, router, unsorted_token0, _) = deploy_core_without_pair();
    let unsorted_token1 = deploy_mock_erc20("Token C", "TKC");
    let (token0, token1) = sort_tokens(router, unsorted_token0, unsorted_token1);

    fund_liquidity_provider(token0, token1, ALICE());
    approve_router_for_liquidity(router, ALICE(), token0, token1);

    assert!(
        IRealmsSwapFactoryDispatcher { contract_address: factory }.get_pair(token0, token1).is_zero(),
        "pair should not exist before liquidity is added",
    );

    let _ = add_liquidity(router, ALICE(), token0, token1, 2 * E18, 4 * E18);
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_add_liquidity::insufficient B amount")]
fn test_add_liquidity_rejects_below_minimum_b_amount() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.token0, BOB(), seeded.core.router, 2 * E18);
    approve_erc20(seeded.core.token1, BOB(), seeded.core.router, 100 * E18);

    start_cheat_caller_address(seeded.core.router, BOB());
    IRealmsSwapRouterDispatcher { contract_address: seeded.core.router }
        .add_liquidity(seeded.core.token0, seeded.core.token1, 2 * E18, 100 * E18, 1, 5 * E18, BOB(), DEADLINE);
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::_add_liquidity::insufficient A amount")]
fn test_add_liquidity_rejects_below_minimum_a_amount() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.token0, BOB(), seeded.core.router, 100 * E18);
    approve_erc20(seeded.core.token1, BOB(), seeded.core.router, 4 * E18);

    start_cheat_caller_address(seeded.core.router, BOB());
    IRealmsSwapRouterDispatcher { contract_address: seeded.core.router }
        .add_liquidity(seeded.core.token0, seeded.core.token1, 100 * E18, 4 * E18, 3 * E18, 1, BOB(), DEADLINE);
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::remove_liquidity::insufficient A amount")]
fn test_remove_liquidity_rejects_below_minimum_a_amount() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.pair, ALICE(), seeded.core.router, seeded.initial_liquidity);

    start_cheat_caller_address(seeded.core.router, ALICE());
    IRealmsSwapRouterDispatcher { contract_address: seeded.core.router }
        .remove_liquidity(
            seeded.core.token0, seeded.core.token1, seeded.initial_liquidity, 21 * E18, 1, ALICE(), DEADLINE,
        );
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::remove_liquidity::insufficient B amount")]
fn test_remove_liquidity_rejects_below_minimum_b_amount() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.pair, ALICE(), seeded.core.router, seeded.initial_liquidity);

    start_cheat_caller_address(seeded.core.router, ALICE());
    IRealmsSwapRouterDispatcher { contract_address: seeded.core.router }
        .remove_liquidity(
            seeded.core.token0, seeded.core.token1, seeded.initial_liquidity, 1, 41 * E18, ALICE(), DEADLINE,
        );
}
