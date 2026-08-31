use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
use ammv2::packages::core::utils::math::pair_salt;
use core::num::traits::Zero;
use core::traits::TryInto;
use openzeppelin::utils::deployments::calculate_contract_address_from_deploy_syscall;
use snforge_std::start_cheat_caller_address;
use starknet::ContractAddress;
use super::super::helpers::addresses::ADMIN;
use super::super::helpers::fixtures::{create_pair, deploy_core_without_pair, sort_tokens};

fn ZERO_ADDRESS() -> ContractAddress {
    0.try_into().unwrap()
}

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_create_pair_requires_pool_creator_role() {
    let (factory, _, token_a, token_b) = deploy_core_without_pair();
    IRealmsSwapFactoryDispatcher { contract_address: factory }.create_pair(token_a, token_b);
}

#[test]
#[should_panic(expected: "RealmsSwap::Factory::create_pair::tokenA and tokenB must be non zero")]
fn test_create_pair_rejects_zero_tokens() {
    let (factory, _, token_a, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };
    start_cheat_caller_address(factory, ADMIN());
    let _ = dispatcher.create_pair(ZERO_ADDRESS(), ZERO_ADDRESS());
    let _ = dispatcher.create_pair(token_a, ZERO_ADDRESS());
}

#[test]
#[should_panic(expected: "RealmsSwap::Factory::create_pair::tokenA and tokenB must be different")]
fn test_create_pair_rejects_identical_tokens() {
    let (factory, _, token_a, _) = deploy_core_without_pair();
    start_cheat_caller_address(factory, ADMIN());
    let _ = IRealmsSwapFactoryDispatcher { contract_address: factory }.create_pair(token_a, token_a);
}

#[test]
fn test_create_pair_returns_non_zero_address() {
    let (factory, _, token_a, token_b) = deploy_core_without_pair();
    start_cheat_caller_address(factory, ADMIN());
    let pair = IRealmsSwapFactoryDispatcher { contract_address: factory }.create_pair(token_a, token_b);
    assert!(!pair.is_zero(), "pair should be deployed");
}

#[test]
#[should_panic(expected: "RealmsSwap::Factory::create_pair::pair already exists for tokenA and tokenB")]
fn test_create_pair_rejects_duplicate_same_order() {
    let (factory, _, token_a, token_b) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };
    start_cheat_caller_address(factory, ADMIN());
    let _ = dispatcher.create_pair(token_a, token_b);
    let _ = dispatcher.create_pair(token_a, token_b);
}

#[test]
#[should_panic(expected: "RealmsSwap::Factory::create_pair::pair already exists for tokenA and tokenB")]
fn test_create_pair_rejects_duplicate_reversed_order() {
    let (factory, _, token_a, token_b) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };
    start_cheat_caller_address(factory, ADMIN());
    let _ = dispatcher.create_pair(token_a, token_b);
    let _ = dispatcher.create_pair(token_b, token_a);
}

#[test]
fn test_create_pair_deploys_expected_address() {
    let (factory, router, token_a, token_b) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };
    let (token0, token1) = sort_tokens(router, token_a, token_b);

    let pair_class_hash = dispatcher.get_pair_contract_class_hash();
    let pair_default_admin = dispatcher.get_pair_default_admin();
    let pair_upgrader = dispatcher.get_pair_upgrader();

    let mut constructor_calldata = array![];
    constructor_calldata.append(token0.into());
    constructor_calldata.append(token1.into());
    constructor_calldata.append(factory.into());
    constructor_calldata.append(pair_default_admin.into());
    constructor_calldata.append(pair_upgrader.into());

    let expected = calculate_contract_address_from_deploy_syscall(
        pair_salt(token0, token1), pair_class_hash, constructor_calldata.span(), factory,
    );

    let pair = create_pair(factory, token_a, token_b);
    assert!(pair == expected, "pair should be deployed at the deterministic address");
}
