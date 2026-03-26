use ammv2::packages::core::interfaces::pair::{IRealmsSwapPairDispatcher, IRealmsSwapPairDispatcherTrait};
use snforge_std::start_cheat_caller_address;
use super::super::helpers::addresses::BOB;
use super::super::helpers::fixtures::{E18, deploy_seeded_pair};

#[test]
#[should_panic(expected: "RealmsSwap::Pair::swap::insufficient output amount")]
fn test_swap_rejects_zero_output_amount() {
    let seeded = deploy_seeded_pair();
    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(0, 0, BOB(), array![].span());
}

#[test]
#[should_panic(expected: "RealmsSwap::Pair::swap::insufficient liquidity")]
fn test_swap_rejects_output_above_liquidity() {
    let seeded = deploy_seeded_pair();
    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(21 * E18, 0, BOB(), array![].span());
}

#[test]
#[should_panic(expected: "RealmsSwap::Pair::swap::invalid to")]
fn test_swap_rejects_invalid_to() {
    let seeded = deploy_seeded_pair();
    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(0, E18, seeded.core.token0, array![].span());
}

#[test]
#[should_panic(expected: "RealmsSwap::Pair::swap::insufficient input amount")]
fn test_swap_rejects_missing_input_amount() {
    let seeded = deploy_seeded_pair();
    start_cheat_caller_address(seeded.core.pair, BOB());
    IRealmsSwapPairDispatcher { contract_address: seeded.core.pair }.swap(0, E18, BOB(), array![].span());
}
