use ammv2::packages::core::contracts::factory::UPGRADER_ROLE as FACTORY_UPGRADER_ROLE;
use ammv2::packages::core::contracts::pair::UPGRADER_ROLE as PAIR_UPGRADER_ROLE;
use ammv2::packages::core::contracts::router::UPGRADER_ROLE as ROUTER_UPGRADER_ROLE;
use openzeppelin::access::accesscontrol::interface::{IAccessControlDispatcher, IAccessControlDispatcherTrait};
use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
use snforge_std::{DeclareResultTrait, declare, get_class_hash, start_cheat_caller_address, stop_cheat_caller_address};
use super::super::helpers::addresses::{ADMIN, BOB, UPGRADER};
use super::super::helpers::fixtures::{deploy_core_with_pair, deploy_seeded_pair};

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_router_upgrade_requires_upgrader_role() {
    let setup = deploy_core_with_pair();
    let new_class_hash = declare("RealmsSwapRouterV2").unwrap().contract_class().class_hash;
    IUpgradeableDispatcher { contract_address: setup.router }.upgrade(*new_class_hash);
}

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_pair_upgrade_requires_upgrader_role() {
    let seeded = deploy_seeded_pair();
    let new_class_hash = declare("RealmsSwapPairV2").unwrap().contract_class().class_hash;
    IUpgradeableDispatcher { contract_address: seeded.core.pair }.upgrade(*new_class_hash);
}

#[test]
fn test_factory_upgrader_role_rotation_updates_upgrade_authority() {
    let setup = deploy_core_with_pair();
    let access = IAccessControlDispatcher { contract_address: setup.factory };
    let new_class_hash = declare("RealmsSwapFactoryV2").unwrap().contract_class().class_hash;

    start_cheat_caller_address(setup.factory, ADMIN());
    access.grant_role(FACTORY_UPGRADER_ROLE, BOB());
    access.revoke_role(FACTORY_UPGRADER_ROLE, UPGRADER());
    stop_cheat_caller_address(setup.factory);

    assert!(access.has_role(FACTORY_UPGRADER_ROLE, BOB()), "new upgrader should hold the role");
    assert!(!access.has_role(FACTORY_UPGRADER_ROLE, UPGRADER()), "old upgrader should no longer hold the role");

    start_cheat_caller_address(setup.factory, BOB());
    IUpgradeableDispatcher { contract_address: setup.factory }.upgrade(*new_class_hash);
    stop_cheat_caller_address(setup.factory);

    assert!(get_class_hash(setup.factory) == *new_class_hash, "rotated factory upgrader should be able to upgrade");
}

#[test]
fn test_router_upgrader_role_rotation_updates_upgrade_authority() {
    let setup = deploy_core_with_pair();
    let access = IAccessControlDispatcher { contract_address: setup.router };
    let new_class_hash = declare("RealmsSwapRouterV2").unwrap().contract_class().class_hash;

    start_cheat_caller_address(setup.router, ADMIN());
    access.grant_role(ROUTER_UPGRADER_ROLE, BOB());
    access.revoke_role(ROUTER_UPGRADER_ROLE, UPGRADER());
    stop_cheat_caller_address(setup.router);

    assert!(access.has_role(ROUTER_UPGRADER_ROLE, BOB()), "new upgrader should hold the role");
    assert!(!access.has_role(ROUTER_UPGRADER_ROLE, UPGRADER()), "old upgrader should no longer hold the role");

    start_cheat_caller_address(setup.router, BOB());
    IUpgradeableDispatcher { contract_address: setup.router }.upgrade(*new_class_hash);
    stop_cheat_caller_address(setup.router);

    assert!(get_class_hash(setup.router) == *new_class_hash, "rotated router upgrader should be able to upgrade");
}

#[test]
fn test_pair_upgrader_role_rotation_updates_upgrade_authority() {
    let seeded = deploy_seeded_pair();
    let access = IAccessControlDispatcher { contract_address: seeded.core.pair };
    let new_class_hash = declare("RealmsSwapPairV2").unwrap().contract_class().class_hash;

    start_cheat_caller_address(seeded.core.pair, ADMIN());
    access.grant_role(PAIR_UPGRADER_ROLE, BOB());
    access.revoke_role(PAIR_UPGRADER_ROLE, UPGRADER());
    stop_cheat_caller_address(seeded.core.pair);

    assert!(access.has_role(PAIR_UPGRADER_ROLE, BOB()), "new upgrader should hold the role");
    assert!(!access.has_role(PAIR_UPGRADER_ROLE, UPGRADER()), "old upgrader should no longer hold the role");

    start_cheat_caller_address(seeded.core.pair, BOB());
    IUpgradeableDispatcher { contract_address: seeded.core.pair }.upgrade(*new_class_hash);
    stop_cheat_caller_address(seeded.core.pair);

    assert!(get_class_hash(seeded.core.pair) == *new_class_hash, "rotated pair upgrader should be able to upgrade");
}
