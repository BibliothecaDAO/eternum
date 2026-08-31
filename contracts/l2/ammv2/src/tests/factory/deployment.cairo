use ammv2::packages::core::contracts::factory::{
    FEE_TO_MANAGER_ROLE, POOL_CREATOR_ROLE, UPGRADER_ROLE as FACTORY_UPGRADER_ROLE,
};
use ammv2::packages::core::contracts::pair::UPGRADER_ROLE as PAIR_UPGRADER_ROLE;
use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
use ammv2::packages::core::interfaces::pair::{IRealmsSwapPairDispatcher, IRealmsSwapPairDispatcherTrait};
use ammv2::packages::core::interfaces::router::{IRealmsSwapRouterDispatcher, IRealmsSwapRouterDispatcherTrait};
use openzeppelin::access::accesscontrol::DEFAULT_ADMIN_ROLE;
use openzeppelin::access::accesscontrol::interface::{IAccessControlDispatcher, IAccessControlDispatcherTrait};
use openzeppelin::token::erc20::interface::{IERC20MetadataDispatcher, IERC20MetadataDispatcherTrait};
use snforge_std::{DeclareResultTrait, declare, start_cheat_caller_address, stop_cheat_caller_address};
use super::super::helpers::addresses::{ADMIN, ALICE, BOB, UPGRADER};
use super::super::helpers::contracts::deploy_mock_erc20;
use super::super::helpers::fixtures::{deploy_core_with_pair, deploy_core_without_pair};

#[test]
fn test_pair_deployment_wiring_and_metadata() {
    let setup = deploy_core_with_pair();
    let pair = IRealmsSwapPairDispatcher { contract_address: setup.pair };
    let metadata = IERC20MetadataDispatcher { contract_address: setup.pair };

    assert!(pair.factory() == setup.factory, "pair should point at the creating factory");
    assert!(pair.token0() == setup.token0, "pair token0 should be sorted");
    assert!(pair.token1() == setup.token1, "pair token1 should be sorted");
    assert!(metadata.name() == "RealmsSwap Pair", "pair name should match the wrapper metadata");
    assert!(metadata.symbol() == "REALMS-P", "pair symbol should match the wrapper metadata");
    assert!(metadata.decimals() == 18, "pair decimals should match the ERC20 default");
}

#[test]
fn test_factory_registry_returns_created_pair_in_both_orders() {
    let setup = deploy_core_with_pair();
    let factory = IRealmsSwapFactoryDispatcher { contract_address: setup.factory };

    assert!(factory.get_pair(setup.token0, setup.token1) == setup.pair, "sorted lookup should find the pair");
    assert!(factory.get_pair(setup.token1, setup.token0) == setup.pair, "reversed lookup should find the pair");

    let all_pairs = factory.get_all_pairs();
    assert!(all_pairs.len() == 1, "factory should track one pair");
    assert!(*all_pairs.at(0) == setup.pair, "factory should return the created pair");
    assert!(factory.get_num_of_pairs() == 1, "factory pair count should be one");
}

#[test]
fn test_router_points_at_factory() {
    let setup = deploy_core_with_pair();
    let router = IRealmsSwapRouterDispatcher { contract_address: setup.router };
    assert!(router.factory() == setup.factory, "router should expose the configured factory");
}

#[test]
fn test_factory_exposes_pair_class_hash() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let pair_class_hash = declare("RealmsSwapPair").unwrap().contract_class().class_hash;
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };

    assert!(*pair_class_hash == dispatcher.get_pair_contract_class_hash(), "factory should store the pair class hash");
}

#[test]
fn test_factory_grants_expected_roles_at_construction() {
    let setup = deploy_core_with_pair();
    let access = IAccessControlDispatcher { contract_address: setup.factory };

    assert!(access.has_role(DEFAULT_ADMIN_ROLE, ADMIN()), "factory admin should have default admin role");
    assert!(access.has_role(FEE_TO_MANAGER_ROLE, ADMIN()), "factory admin should manage fees");
    assert!(access.has_role(POOL_CREATOR_ROLE, ADMIN()), "factory admin should be able to create pools");
    assert!(access.has_role(FACTORY_UPGRADER_ROLE, UPGRADER()), "configured upgrader should have upgrade role");
}

#[test]
fn test_factory_pair_defaults_apply_to_new_pair_roles() {
    let (factory, _, token_a, _) = deploy_core_without_pair();
    let token_c = deploy_mock_erc20("Token C", "TKC");
    let factory_dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };

    start_cheat_caller_address(factory, ADMIN());
    factory_dispatcher.set_pair_default_admin(BOB());
    factory_dispatcher.set_pair_upgrader(ALICE());
    stop_cheat_caller_address(factory);

    start_cheat_caller_address(factory, ADMIN());
    let pair = factory_dispatcher.create_pair(token_a, token_c);
    stop_cheat_caller_address(factory);
    let pair_access = IAccessControlDispatcher { contract_address: pair };

    assert!(pair_access.has_role(DEFAULT_ADMIN_ROLE, BOB()), "new pair should inherit the updated default admin");
    assert!(pair_access.has_role(PAIR_UPGRADER_ROLE, ALICE()), "new pair should inherit the updated upgrader");
    assert!(!pair_access.has_role(PAIR_UPGRADER_ROLE, UPGRADER()), "old upgrader should not be assigned on new pairs");
}
