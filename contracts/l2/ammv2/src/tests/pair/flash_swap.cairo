use ammv2::packages::core::interfaces::pair::{IRealmsSwapPairDispatcher, IRealmsSwapPairDispatcherTrait};
use ammv2::packages::core::utils::math::{DEFAULT_fee_amount, THOUSAND, get_amount_in};
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use super::super::helpers::addresses::BOB;
use super::super::helpers::contracts::{deploy_flash_callee, mint_mock_erc20};
use super::super::helpers::fixtures::{E18, deploy_seeded_pair, pair_reserves};
use super::super::mocks::flash_callee::{IMockFlashCalleeDispatcher, IMockFlashCalleeDispatcherTrait};

fn same_token_flash_repayment(amount_out: u256) -> u256 {
    ((amount_out * THOUSAND) + (DEFAULT_fee_amount - 1)) / DEFAULT_fee_amount
}

#[test]
#[should_panic(expected: "RealmsSwap::Pair::swap::insufficient liquidity")]
fn test_flash_swap_rejects_insufficient_liquidity() {
    let seeded = deploy_seeded_pair();
    let callee = deploy_flash_callee();
    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(200 * E18, 0, callee, array![1].span());
}

#[test]
#[should_panic(expected: "RealmsSwap::Pair::swap::invariant K")]
fn test_flash_swap_rejects_without_repayment() {
    let seeded = deploy_seeded_pair();
    let callee = deploy_flash_callee();
    IMockFlashCalleeDispatcher { contract_address: callee }
        .set_repayment(seeded.core.token0, seeded.core.token1, 2 * E18, 0);
    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(2 * E18, 0, callee, array![1].span());
}

#[test]
#[should_panic(expected: "RealmsSwap::Pair::swap::invariant K")]
fn test_flash_swap_rejects_with_insufficient_repayment() {
    let seeded = deploy_seeded_pair();
    let callee = deploy_flash_callee();
    let repay0 = same_token_flash_repayment(2 * E18) - 1;

    mint_mock_erc20(seeded.core.token0, callee, repay0);
    IMockFlashCalleeDispatcher { contract_address: callee }
        .set_repayment(seeded.core.token0, seeded.core.token1, repay0, 0);

    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(2 * E18, 0, callee, array![1].span());
}

#[test]
fn test_flash_swap_accepts_same_token_repayment() {
    let seeded = deploy_seeded_pair();
    let callee = deploy_flash_callee();
    let (reserve0_before, reserve1_before, _) = pair_reserves(seeded.core.pair);
    let repay0 = same_token_flash_repayment(2 * E18);

    mint_mock_erc20(seeded.core.token0, callee, repay0);
    IMockFlashCalleeDispatcher { contract_address: callee }
        .set_repayment(seeded.core.token0, seeded.core.token1, repay0, 0);

    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(2 * E18, 0, callee, array![1].span());
    stop_cheat_caller_address(seeded.core.pair);

    let (sender, amount0_out, amount1_out) = IMockFlashCalleeDispatcher { contract_address: callee }.get_last_call();
    let (reserve0_after, reserve1_after, _) = pair_reserves(seeded.core.pair);

    assert!(sender == BOB(), "flash callback should receive the original caller");
    assert!(amount0_out == 2 * E18, "flash callback should receive the borrowed token0 amount");
    assert!(amount1_out == 0, "flash callback should not receive token1 output");
    assert!(
        reserve0_after == reserve0_before - (2 * E18) + repay0,
        "reserve0 should reflect the borrowed amount and repayment",
    );
    assert!(reserve1_after == reserve1_before, "reserve1 should remain unchanged for same-token repayment");
}

#[test]
fn test_flash_swap_accepts_other_token_repayment() {
    let seeded = deploy_seeded_pair();
    let callee = deploy_flash_callee();
    let (reserve0_before, reserve1_before, _) = pair_reserves(seeded.core.pair);
    let repay1 = get_amount_in(2 * E18, reserve1_before, reserve0_before, DEFAULT_fee_amount);

    mint_mock_erc20(seeded.core.token1, callee, repay1);
    IMockFlashCalleeDispatcher { contract_address: callee }
        .set_repayment(seeded.core.token0, seeded.core.token1, 0, repay1);

    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(2 * E18, 0, callee, array![1].span());
    stop_cheat_caller_address(seeded.core.pair);

    let (reserve0_after, reserve1_after, _) = pair_reserves(seeded.core.pair);
    assert!(reserve0_after == reserve0_before - (2 * E18), "reserve0 should decrease by the flashed token0 amount");
    assert!(reserve1_after == reserve1_before + repay1, "reserve1 should increase by the repaid token1 amount");
}
