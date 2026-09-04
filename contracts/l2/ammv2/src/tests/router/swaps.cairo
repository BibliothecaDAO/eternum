use openzeppelin::token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
use super::super::helpers::addresses::BOB;
use super::super::helpers::contracts::approve_erc20;
use super::super::helpers::fixtures::{
    E18, deploy_seeded_pair, deploy_two_hop_route, pair_reserves_for_tokens, swap_exact_tokens_for_tokens,
    swap_tokens_for_exact_tokens,
};

fn balance_of(token: starknet::ContractAddress, account: starknet::ContractAddress) -> u256 {
    IERC20Dispatcher { contract_address: token }.balance_of(account)
}

#[test]
fn test_swap_exact_0_to_1() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.token0, BOB(), seeded.core.router, 2 * E18);

    let initial_token0 = balance_of(seeded.core.token0, BOB());
    let initial_token1 = balance_of(seeded.core.token1, BOB());
    let (reserve0_before, reserve1_before) = pair_reserves_for_tokens(
        seeded.core.router, seeded.core.pair, seeded.core.token0, seeded.core.token1,
    );

    let path = array![seeded.core.token0, seeded.core.token1];
    let amounts = swap_exact_tokens_for_tokens(seeded.core.router, BOB(), 2 * E18, 0, path.span(), BOB());
    let amount0_in = *amounts.at(0);
    let amount1_out = *amounts.at(1);

    assert!(amounts.len() == 2, "single-hop exact-in swap should return two amounts");
    assert!(amount0_in == 2 * E18, "first amount should be the supplied token0 input");
    assert!(
        initial_token0 - balance_of(seeded.core.token0, BOB()) == amount0_in, "token0 spend should match the quote",
    );
    assert!(
        balance_of(seeded.core.token1, BOB()) - initial_token1 == amount1_out, "token1 receipt should match the quote",
    );

    let (reserve0_after, reserve1_after) = pair_reserves_for_tokens(
        seeded.core.router, seeded.core.pair, seeded.core.token0, seeded.core.token1,
    );
    assert!(reserve0_after == reserve0_before + amount0_in, "token0 reserve should increase by the input amount");
    assert!(reserve1_after == reserve1_before - amount1_out, "token1 reserve should decrease by the output amount");
}

#[test]
fn test_swap_0_to_exact_1() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.token0, BOB(), seeded.core.router, 100 * E18);

    let initial_token0 = balance_of(seeded.core.token0, BOB());
    let initial_token1 = balance_of(seeded.core.token1, BOB());
    let path = array![seeded.core.token0, seeded.core.token1];
    let amounts = swap_tokens_for_exact_tokens(seeded.core.router, BOB(), 2 * E18, 100 * E18, path.span(), BOB());

    assert!(amounts.len() == 2, "single-hop exact-out swap should return two amounts");
    assert!(
        initial_token0 - balance_of(seeded.core.token0, BOB()) == *amounts.at(0),
        "token0 spend should match the required input",
    );
    assert!(
        balance_of(seeded.core.token1, BOB()) - initial_token1 == *amounts.at(1),
        "token1 receipt should match the requested output",
    );
}

#[test]
fn test_swap_exact_1_to_0() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.token1, BOB(), seeded.core.router, 2 * E18);

    let initial_token0 = balance_of(seeded.core.token0, BOB());
    let initial_token1 = balance_of(seeded.core.token1, BOB());
    let (reserve1_before, reserve0_before) = pair_reserves_for_tokens(
        seeded.core.router, seeded.core.pair, seeded.core.token1, seeded.core.token0,
    );

    let path = array![seeded.core.token1, seeded.core.token0];
    let amounts = swap_exact_tokens_for_tokens(seeded.core.router, BOB(), 2 * E18, 0, path.span(), BOB());
    let amount1_in = *amounts.at(0);
    let amount0_out = *amounts.at(1);

    assert!(amounts.len() == 2, "reverse exact-in swap should return two amounts");
    assert!(
        initial_token1 - balance_of(seeded.core.token1, BOB()) == amount1_in, "token1 spend should match the quote",
    );
    assert!(
        balance_of(seeded.core.token0, BOB()) - initial_token0 == amount0_out, "token0 receipt should match the quote",
    );

    let (reserve1_after, reserve0_after) = pair_reserves_for_tokens(
        seeded.core.router, seeded.core.pair, seeded.core.token1, seeded.core.token0,
    );
    assert!(reserve1_after == reserve1_before + amount1_in, "token1 reserve should increase by the input amount");
    assert!(reserve0_after == reserve0_before - amount0_out, "token0 reserve should decrease by the output amount");
}

#[test]
fn test_swap_exact_0_to_2() {
    let route = deploy_two_hop_route();
    approve_erc20(route.seeded.core.token0, BOB(), route.seeded.core.router, 2 * E18);

    let initial_token0 = balance_of(route.seeded.core.token0, BOB());
    let initial_token2 = balance_of(route.token2, BOB());
    let (reserve01_in_before, reserve01_out_before) = pair_reserves_for_tokens(
        route.seeded.core.router, route.seeded.core.pair, route.seeded.core.token0, route.seeded.core.token1,
    );
    let (reserve12_in_before, reserve12_out_before) = pair_reserves_for_tokens(
        route.seeded.core.router, route.pair12, route.seeded.core.token1, route.token2,
    );

    let path = array![route.seeded.core.token0, route.seeded.core.token1, route.token2];
    let amounts = swap_exact_tokens_for_tokens(route.seeded.core.router, BOB(), 2 * E18, 0, path.span(), BOB());
    let amount0_in = *amounts.at(0);
    let amount1_out = *amounts.at(1);
    let amount2_out = *amounts.at(2);

    assert!(amounts.len() == 3, "two-hop exact-in swap should return three amounts");
    assert!(
        initial_token0 - balance_of(route.seeded.core.token0, BOB()) == amount0_in,
        "token0 spend should match the quote",
    );
    assert!(balance_of(route.token2, BOB()) - initial_token2 == amount2_out, "token2 receipt should match the quote");

    let (reserve01_in_after, reserve01_out_after) = pair_reserves_for_tokens(
        route.seeded.core.router, route.seeded.core.pair, route.seeded.core.token0, route.seeded.core.token1,
    );
    assert!(
        reserve01_in_after == reserve01_in_before + amount0_in,
        "first pair input reserve should increase by token0 input",
    );
    assert!(
        reserve01_out_after == reserve01_out_before - amount1_out,
        "first pair output reserve should decrease by token1 output",
    );

    let (reserve12_in_after, reserve12_out_after) = pair_reserves_for_tokens(
        route.seeded.core.router, route.pair12, route.seeded.core.token1, route.token2,
    );
    assert!(
        reserve12_in_after == reserve12_in_before + amount1_out,
        "second pair input reserve should increase by intermediate token1 output",
    );
    assert!(
        reserve12_out_after == reserve12_out_before - amount2_out,
        "second pair output reserve should decrease by token2 output",
    );
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::swap_exact_tokens_for_tokens::insufficient output amount")]
fn test_swap_exact_tokens_for_tokens_rejects_excessive_output_floor() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.token0, BOB(), seeded.core.router, 2 * E18);

    let path = array![seeded.core.token0, seeded.core.token1];
    let _ = swap_exact_tokens_for_tokens(seeded.core.router, BOB(), 2 * E18, 4 * E18, path.span(), BOB());
}

#[test]
#[should_panic(expected: "RealmsSwap::Router::swap_tokens_for_exact_tokens::excessive input amount")]
fn test_swap_tokens_for_exact_tokens_rejects_tight_input_ceiling() {
    let seeded = deploy_seeded_pair();
    approve_erc20(seeded.core.token0, BOB(), seeded.core.router, 100 * E18);

    let path = array![seeded.core.token0, seeded.core.token1];
    let _ = swap_tokens_for_exact_tokens(seeded.core.router, BOB(), 2 * E18, 1, path.span(), BOB());
}
