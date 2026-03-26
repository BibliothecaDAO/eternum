use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
use ammv2::packages::core::interfaces::pair::{IRealmsSwapPairDispatcher, IRealmsSwapPairDispatcherTrait};
use ammv2::packages::core::interfaces::router::{IRealmsSwapRouterDispatcher, IRealmsSwapRouterDispatcherTrait};
use openzeppelin::token::erc20::interface::{
    IERC20Dispatcher, IERC20DispatcherTrait, IERC20MetadataDispatcher, IERC20MetadataDispatcherTrait,
};
use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
use snforge_std::{DeclareResultTrait, declare, get_class_hash, start_cheat_caller_address, stop_cheat_caller_address};
use super::super::helpers::addresses::{ADMIN, ALICE, BOB, UPGRADER};
use super::super::helpers::fixtures::{deploy_core_with_pair, deploy_seeded_pair};
use super::super::mocks::upgrade_v2::{ITestV2SurfaceDispatcher, ITestV2SurfaceDispatcherTrait};

#[test]
fn test_factory_upgrade_to_v2_preserves_state_and_exposes_v2_surface() {
    let setup = deploy_core_with_pair();
    let factory = IRealmsSwapFactoryDispatcher { contract_address: setup.factory };
    let new_class_hash = declare("RealmsSwapFactoryV2").unwrap().contract_class().class_hash;

    start_cheat_caller_address(setup.factory, ADMIN());
    factory.set_fee_to(BOB());
    factory.set_fee_amount(996);
    factory.set_pair_default_admin(ALICE());
    factory.set_pair_upgrader(BOB());
    stop_cheat_caller_address(setup.factory);

    start_cheat_caller_address(setup.factory, UPGRADER());
    IUpgradeableDispatcher { contract_address: setup.factory }.upgrade(*new_class_hash);
    stop_cheat_caller_address(setup.factory);

    assert!(get_class_hash(setup.factory) == *new_class_hash, "factory should upgrade to the V2 class");
    assert!(
        ITestV2SurfaceDispatcher { contract_address: setup.factory }.test_v2_contract() == 1,
        "factory should expose the V2 surface after upgrade",
    );
    assert!(factory.get_num_of_pairs() == 1, "factory pair count should persist through upgrade");
    assert!(*factory.get_all_pairs().at(0) == setup.pair, "factory pair registry should persist through upgrade");
    assert!(
        factory.get_pair(setup.token0, setup.token1) == setup.pair,
        "factory pair lookup should persist through upgrade",
    );
    assert!(factory.get_fee_to() == BOB(), "factory fee recipient should persist through upgrade");
    assert!(factory.get_fee_amount() == 996, "factory fee amount should persist through upgrade");
    assert!(factory.get_pair_default_admin() == ALICE(), "factory pair default admin should persist through upgrade");
    assert!(factory.get_pair_upgrader() == BOB(), "factory pair upgrader should persist through upgrade");
}

#[test]
fn test_router_upgrade_to_v2_preserves_factory_and_sorting_surface() {
    let setup = deploy_core_with_pair();
    let router = IRealmsSwapRouterDispatcher { contract_address: setup.router };
    let new_class_hash = declare("RealmsSwapRouterV2").unwrap().contract_class().class_hash;
    let expected_factory = router.factory();
    let (expected_token0, expected_token1) = router.sort_tokens(setup.token1, setup.token0);

    start_cheat_caller_address(setup.router, UPGRADER());
    IUpgradeableDispatcher { contract_address: setup.router }.upgrade(*new_class_hash);
    stop_cheat_caller_address(setup.router);

    assert!(get_class_hash(setup.router) == *new_class_hash, "router should upgrade to the V2 class");
    assert!(
        ITestV2SurfaceDispatcher { contract_address: setup.router }.test_v2_contract() == 1,
        "router should expose the V2 surface after upgrade",
    );
    assert!(router.factory() == expected_factory, "router factory pointer should persist through upgrade");
    let (token0_after, token1_after) = router.sort_tokens(setup.token1, setup.token0);
    assert!(token0_after == expected_token0, "router token0 sorting should persist through upgrade");
    assert!(token1_after == expected_token1, "router token1 sorting should persist through upgrade");
}

#[test]
fn test_pair_upgrade_to_v2_preserves_state_and_metadata() {
    let seeded = deploy_seeded_pair();
    let pair = IRealmsSwapPairDispatcher { contract_address: seeded.core.pair };
    let pair_erc20 = IERC20Dispatcher { contract_address: seeded.core.pair };
    let metadata = IERC20MetadataDispatcher { contract_address: seeded.core.pair };
    let new_class_hash = declare("RealmsSwapPairV2").unwrap().contract_class().class_hash;

    let expected_factory = pair.factory();
    let expected_token0 = pair.token0();
    let expected_token1 = pair.token1();
    let (expected_reserve0, expected_reserve1, expected_timestamp) = pair.get_reserves();
    let expected_total_supply = pair_erc20.total_supply();
    let expected_alice_balance = pair_erc20.balance_of(ALICE());
    let expected_name = metadata.name();
    let expected_symbol = metadata.symbol();
    let expected_decimals = metadata.decimals();

    start_cheat_caller_address(seeded.core.pair, UPGRADER());
    IUpgradeableDispatcher { contract_address: seeded.core.pair }.upgrade(*new_class_hash);
    stop_cheat_caller_address(seeded.core.pair);

    assert!(get_class_hash(seeded.core.pair) == *new_class_hash, "pair should upgrade to the V2 class");
    assert!(
        ITestV2SurfaceDispatcher { contract_address: seeded.core.pair }.test_v2_contract() == 1,
        "pair should expose the V2 surface after upgrade",
    );
    assert!(pair.factory() == expected_factory, "pair factory pointer should persist through upgrade");
    assert!(pair.token0() == expected_token0, "pair token0 should persist through upgrade");
    assert!(pair.token1() == expected_token1, "pair token1 should persist through upgrade");
    let (reserve0_after, reserve1_after, timestamp_after) = pair.get_reserves();
    assert!(reserve0_after == expected_reserve0, "pair reserve0 should persist through upgrade");
    assert!(reserve1_after == expected_reserve1, "pair reserve1 should persist through upgrade");
    assert!(timestamp_after == expected_timestamp, "pair timestamp should persist through upgrade");
    assert!(pair_erc20.total_supply() == expected_total_supply, "pair total supply should persist through upgrade");
    assert!(pair_erc20.balance_of(ALICE()) == expected_alice_balance, "LP balances should persist through upgrade");
    assert!(metadata.name() == expected_name, "pair name should persist through upgrade");
    assert!(metadata.symbol() == expected_symbol, "pair symbol should persist through upgrade");
    assert!(metadata.decimals() == expected_decimals, "pair decimals should persist through upgrade");
}
