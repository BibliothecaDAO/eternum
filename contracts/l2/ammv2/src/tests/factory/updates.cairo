use ammv2::packages::core::components::factory::FactoryComponent::{
    Event as FactoryEvent, FeeAmountChanged, FeeToChanged, PairDefaultAdminChanged, PairUpgraderChanged,
};
use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
use core::traits::TryInto;
use openzeppelin::upgrades::interface::{IUpgradeableDispatcher, IUpgradeableDispatcherTrait};
use snforge_std::{
    DeclareResultTrait, EventSpyAssertionsTrait, declare, get_class_hash, spy_events, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use super::super::helpers::addresses::{ADMIN, BOB, UPGRADER};
use super::super::helpers::fixtures::deploy_core_without_pair;

fn ZERO_ADDRESS() -> ContractAddress {
    0.try_into().unwrap()
}

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_set_fee_to_requires_fee_manager_role() {
    let (factory, _, _, _) = deploy_core_without_pair();
    IRealmsSwapFactoryDispatcher { contract_address: factory }.set_fee_to(BOB());
}

#[test]
fn test_set_fee_to_updates_fee_recipient() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };
    let mut spy = spy_events();

    start_cheat_caller_address(factory, ADMIN());
    dispatcher.set_fee_to(BOB());
    stop_cheat_caller_address(factory);

    assert!(dispatcher.get_fee_to() == BOB(), "fee recipient should be updated");
    let expected = array![
        (factory, FactoryEvent::FeeToChanged(FeeToChanged { old_fee_to: ZERO_ADDRESS(), new_fee_to: BOB() })),
    ];
    spy.assert_emitted(@expected);
}

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_set_fee_amount_requires_fee_manager_role() {
    let (factory, _, _, _) = deploy_core_without_pair();
    IRealmsSwapFactoryDispatcher { contract_address: factory }.set_fee_amount(996);
}

#[test]
fn test_set_fee_amount_updates_factory_fee() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };
    let mut spy = spy_events();

    start_cheat_caller_address(factory, ADMIN());
    dispatcher.set_fee_amount(996);
    stop_cheat_caller_address(factory);

    assert!(dispatcher.get_fee_amount() == 996, "fee amount should be updated");
    let expected = array![
        (factory, FactoryEvent::FeeAmountChanged(FeeAmountChanged { old_fee_amount: 997, new_fee_amount: 996 })),
    ];
    spy.assert_emitted(@expected);
}

#[test]
#[should_panic(expected: "RealmsSwap::Math::fee amount over 1000 must be positive")]
fn test_set_fee_amount_rejects_zero_fee() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };

    start_cheat_caller_address(factory, ADMIN());
    dispatcher.set_fee_amount(0);
}

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_set_pair_default_admin_requires_default_admin_role() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };

    start_cheat_caller_address(factory, BOB());
    dispatcher.set_pair_default_admin(BOB());
}

#[test]
#[should_panic(expected: "RealmsSwap::Factory::set_pair_default_admin::new_pair_default_admin must be non zero")]
fn test_set_pair_default_admin_rejects_zero_address() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };

    start_cheat_caller_address(factory, ADMIN());
    dispatcher.set_pair_default_admin(ZERO_ADDRESS());
}

#[test]
fn test_set_pair_default_admin_updates_value_and_emits_event() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };
    let mut spy = spy_events();

    start_cheat_caller_address(factory, ADMIN());
    dispatcher.set_pair_default_admin(BOB());
    stop_cheat_caller_address(factory);

    assert!(dispatcher.get_pair_default_admin() == BOB(), "pair default admin should be updated");
    let expected = array![
        (
            factory,
            FactoryEvent::PairDefaultAdminChanged(
                PairDefaultAdminChanged { old_pair_default_admin: ADMIN(), new_pair_default_admin: BOB() },
            ),
        ),
    ];
    spy.assert_emitted(@expected);
}

#[test]
#[should_panic(expected: "RealmsSwap::Factory::set_pair_upgrader::new_pair_upgrader must be non zero")]
fn test_set_pair_upgrader_rejects_zero_address() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };

    start_cheat_caller_address(factory, ADMIN());
    dispatcher.set_pair_upgrader(ZERO_ADDRESS());
}

#[test]
fn test_set_pair_upgrader_updates_value_and_emits_event() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let dispatcher = IRealmsSwapFactoryDispatcher { contract_address: factory };
    let mut spy = spy_events();

    start_cheat_caller_address(factory, ADMIN());
    dispatcher.set_pair_upgrader(BOB());
    stop_cheat_caller_address(factory);

    assert!(dispatcher.get_pair_upgrader() == BOB(), "pair upgrader should be updated");
    let expected = array![
        (
            factory,
            FactoryEvent::PairUpgraderChanged(
                PairUpgraderChanged { old_pair_upgrader: UPGRADER(), new_pair_upgrader: BOB() },
            ),
        ),
    ];
    spy.assert_emitted(@expected);
}

#[test]
#[should_panic(expected: 'Caller is missing role')]
fn test_factory_upgrade_requires_upgrader_role() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let new_class_hash = declare("RealmsSwapFactory").unwrap().contract_class().class_hash;
    IUpgradeableDispatcher { contract_address: factory }.upgrade(*new_class_hash);
}

#[test]
fn test_factory_upgrade_accepts_upgrader_role() {
    let (factory, _, _, _) = deploy_core_without_pair();
    let new_class_hash = declare("RealmsSwapFactory").unwrap().contract_class().class_hash;

    start_cheat_caller_address(factory, UPGRADER());
    IUpgradeableDispatcher { contract_address: factory }.upgrade(*new_class_hash);
    stop_cheat_caller_address(factory);

    assert!(get_class_hash(factory) == *new_class_hash, "factory should accept upgrades from the configured upgrader");
}
