use openzeppelin_account::interface::{IPublicKeyDispatcher, IPublicKeyDispatcherTrait};
use realms_player_account::player_account::{IRealmsPlayerAccountDispatcher, IRealmsPlayerAccountDispatcherTrait};
use realms_player_account::player_registry::{IPlayerRegistryDispatcher, IPlayerRegistryDispatcherTrait};
use snforge_std::{ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;

fn authority() -> ContractAddress {
    'authority'.try_into().unwrap()
}

fn owner() -> ContractAddress {
    'owner'.try_into().unwrap()
}

fn second_owner() -> ContractAddress {
    'second_owner'.try_into().unwrap()
}

fn guest_owner() -> ContractAddress {
    0.try_into().unwrap()
}

fn deploy_registry() -> (IPlayerRegistryDispatcher, ContractAddress) {
    let class = snforge_std::declare("PlayerRegistry").unwrap().contract_class();
    let (address, _) = class.deploy(@array![authority().into()]).unwrap();
    (IPlayerRegistryDispatcher { contract_address: address }, address)
}

fn deploy_account() -> (IRealmsPlayerAccountDispatcher, IPublicKeyDispatcher, ContractAddress) {
    let class = snforge_std::declare("RealmsPlayerAccount").unwrap().contract_class();
    let (address, _) = class.deploy(@array![0x123, owner().into(), authority().into()]).unwrap();
    (
        IRealmsPlayerAccountDispatcher { contract_address: address },
        IPublicKeyDispatcher { contract_address: address },
        address,
    )
}

#[test]
fn registry_binds_one_account_to_one_owner() {
    let (registry, registry_address) = deploy_registry();
    let (_, _, account_address) = deploy_account();

    start_cheat_caller_address(registry_address, authority());
    registry.bind(owner(), account_address);
    stop_cheat_caller_address(registry_address);

    assert!(registry.account_of(owner()) == account_address, "account lookup failed");
    assert!(registry.owner_of(account_address) == owner(), "owner lookup failed");
}

#[test]
#[should_panic(expected: "owner already bound")]
fn registry_refuses_a_second_account_for_an_owner() {
    let (registry, registry_address) = deploy_registry();
    let (_, _, account_address) = deploy_account();

    start_cheat_caller_address(registry_address, authority());
    registry.bind(owner(), account_address);
    registry.bind(owner(), second_owner());
}

#[test]
#[should_panic(expected: "account already bound")]
fn registry_refuses_one_account_for_two_owners() {
    let (registry, registry_address) = deploy_registry();
    let (_, _, account_address) = deploy_account();

    start_cheat_caller_address(registry_address, authority());
    registry.bind(owner(), account_address);
    registry.bind(second_owner(), account_address);
}

#[test]
#[should_panic(expected: "owner already bound")]
fn registry_tracks_a_zero_guest_owner_as_bound() {
    let (registry, registry_address) = deploy_registry();
    let (_, _, account_address) = deploy_account();

    start_cheat_caller_address(registry_address, authority());
    registry.bind(guest_owner(), account_address);
    registry.bind(guest_owner(), second_owner());
}

#[test]
#[should_panic(expected: "not binding authority")]
fn registry_refuses_an_unauthorized_binding() {
    let (registry, registry_address) = deploy_registry();
    let (_, _, account_address) = deploy_account();

    start_cheat_caller_address(registry_address, owner());
    registry.bind(owner(), account_address);
}

#[test]
fn authority_rotates_the_key_without_changing_the_owner() {
    let (account, public_key, account_address) = deploy_account();
    assert!(account.owner() == owner(), "owner mismatch");
    assert!(account.binding_authority() == authority(), "authority mismatch");
    assert!(public_key.get_public_key() == 0x123, "initial key mismatch");

    start_cheat_caller_address(account_address, authority());
    account.rotate_public_key(0x456);
    stop_cheat_caller_address(account_address);

    assert!(public_key.get_public_key() == 0x456, "rotated key mismatch");
    assert!(account.owner() == owner(), "owner changed");
}

#[test]
#[should_panic(expected: "not binding authority")]
fn owner_cannot_rotate_the_key() {
    let (account, _, account_address) = deploy_account();

    start_cheat_caller_address(account_address, owner());
    account.rotate_public_key(0x456);
}
