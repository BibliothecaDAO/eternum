use ammv2::packages::core::utils::math::{MINIMUM_LIQUIDITY, burn_address, sqrt};
use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use super::super::helpers::addresses::{ALICE, BOB};
use super::super::helpers::contracts::{approve_erc20, mint_mock_erc20};
use super::super::helpers::fixtures::{
    E18, add_liquidity, deploy_core_with_pair, deploy_seeded_pair, pair_reserves, remove_liquidity,
};

#[test]
fn test_initial_mint_locks_minimum_liquidity_and_updates_supply() {
    let setup = deploy_core_with_pair();
    mint_mock_erc20(setup.token0, ALICE(), 100 * E18);
    mint_mock_erc20(setup.token1, ALICE(), 100 * E18);
    approve_erc20(setup.token0, ALICE(), setup.router, 2 * E18);
    approve_erc20(setup.token1, ALICE(), setup.router, 4 * E18);

    let (_, _, liquidity) = add_liquidity(setup.router, ALICE(), setup.token0, setup.token1, 2 * E18, 4 * E18);
    let total_supply = IERC20Dispatcher { contract_address: setup.pair }.total_supply();
    let provider_balance = IERC20Dispatcher { contract_address: setup.pair }.balance_of(ALICE());
    let locked_balance = IERC20Dispatcher { contract_address: setup.pair }.balance_of(burn_address());
    let (reserve0, reserve1, _) = pair_reserves(setup.pair);
    let expected_total_supply = sqrt((2 * E18) * (4 * E18));

    assert!(liquidity == expected_total_supply - MINIMUM_LIQUIDITY, "provider liquidity should exclude the lock");
    assert!(total_supply == expected_total_supply, "total supply should equal the initial square root mint");
    assert!(provider_balance == liquidity, "provider should receive the minted LP balance");
    assert!(locked_balance == MINIMUM_LIQUIDITY, "burn address should hold the minimum liquidity lock");
    assert!(reserve0 == 2 * E18, "reserve0 should match the deposited amount");
    assert!(reserve1 == 4 * E18, "reserve1 should match the deposited amount");
}

#[test]
fn test_second_mint_is_proportional() {
    let seeded = deploy_seeded_pair();
    let pair_token = IERC20Dispatcher { contract_address: seeded.core.pair };
    let total_supply_before = pair_token.total_supply();

    approve_erc20(seeded.core.token0, BOB(), seeded.core.router, 20 * E18);
    approve_erc20(seeded.core.token1, BOB(), seeded.core.router, 40 * E18);
    let (_, _, liquidity) = add_liquidity(
        seeded.core.router, BOB(), seeded.core.token0, seeded.core.token1, 20 * E18, 40 * E18,
    );
    let (reserve0, reserve1, _) = pair_reserves(seeded.core.pair);

    assert!(liquidity == total_supply_before, "second proportional mint should equal the pre-mint total supply");
    assert!(reserve0 == 40 * E18, "reserve0 should double after the second proportional mint");
    assert!(reserve1 == 80 * E18, "reserve1 should double after the second proportional mint");
}

#[test]
fn test_burn_returns_proportional_assets_and_updates_reserves() {
    let seeded = deploy_seeded_pair();
    let pair_token = IERC20Dispatcher { contract_address: seeded.core.pair };
    let provider_liquidity = pair_token.balance_of(ALICE());
    let total_supply_before = pair_token.total_supply();
    let (reserve0_before, reserve1_before, _) = pair_reserves(seeded.core.pair);

    approve_erc20(seeded.core.pair, ALICE(), seeded.core.router, provider_liquidity);
    let (amount0_out, amount1_out) = remove_liquidity(
        seeded.core.router, ALICE(), seeded.core.token0, seeded.core.token1, provider_liquidity,
    );
    let (reserve0_after, reserve1_after, _) = pair_reserves(seeded.core.pair);

    let expected_amount0 = (provider_liquidity * reserve0_before) / total_supply_before;
    let expected_amount1 = (provider_liquidity * reserve1_before) / total_supply_before;

    assert!(amount0_out == expected_amount0, "burn should return the proportional token0 amount");
    assert!(amount1_out == expected_amount1, "burn should return the proportional token1 amount");
    assert!(pair_token.balance_of(ALICE()) == 0, "provider LP balance should be burned");
    assert!(pair_token.total_supply() == MINIMUM_LIQUIDITY, "only the locked minimum liquidity should remain");
    assert!(reserve0_after == reserve0_before - amount0_out, "reserve0 should decrease by the burned output");
    assert!(reserve1_after == reserve1_before - amount1_out, "reserve1 should decrease by the burned output");
}
