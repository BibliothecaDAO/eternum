use realms_player_account::realms_account::{
    ADD_DEVICE, IRealmsAccountDispatcher, IRealmsAccountDispatcherTrait, MAX_DEVICES, REVOKE_DEVICE, device_change_hash,
};
use snforge_std::signature::KeyPairTrait;
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, start_cheat_chain_id, start_cheat_chain_id_global, start_cheat_signature,
    start_cheat_transaction_hash,
};
use starknet::{ContractAddress, VALIDATED};

const CHAIN: felt252 = 'REALMS_SHARD_A';
const OTHER_CHAIN: felt252 = 'REALMS_SHARD_B';
const REALMS_ID: felt252 = 0x7e41;
const TX_HASH: felt252 = 0x7a11;

fn guardian() -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(0x6a4d)
}

fn device(index: u8) -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(0xde71ce + index.into())
}

fn account_class() -> snforge_std::ContractClass {
    *snforge_std::declare("RealmsAccount").unwrap().contract_class()
}

fn deploy_account() -> IRealmsAccountDispatcher {
    let (address, _) = account_class().deploy(@array![REALMS_ID, guardian().public_key]).unwrap();
    start_cheat_chain_id(address, CHAIN);
    IRealmsAccountDispatcher { contract_address: address }
}

fn guardian_approval(
    chain_id: felt252, account: ContractAddress, action: felt252, device_key: felt252, counter: u64,
) -> (felt252, felt252) {
    guardian().sign(device_change_hash(chain_id, account, action, device_key, counter)).unwrap()
}

/// Sends the account a transaction signed by `joining`, carrying the guardian's approval to add it.
fn join_with(account: IRealmsAccountDispatcher, joining: StarkCurveKeyPair, approval: (felt252, felt252)) -> felt252 {
    let (r, s) = joining.sign(TX_HASH).unwrap();
    let (guardian_r, guardian_s) = approval;
    start_cheat_transaction_hash(account.contract_address, TX_HASH);
    start_cheat_signature(account.contract_address, array![joining.public_key, r, s, guardian_r, guardian_s].span());
    account.__validate__(array![])
}

fn join(account: IRealmsAccountDispatcher, joining: StarkCurveKeyPair, counter: u64) -> felt252 {
    join_with(
        account, joining, guardian_approval(CHAIN, account.contract_address, ADD_DEVICE, joining.public_key, counter),
    )
}

fn device_signature(signer: StarkCurveKeyPair, hash: felt252) -> Array<felt252> {
    let (r, s) = signer.sign(hash).unwrap();
    array![signer.public_key, r, s]
}

#[test]
fn deployment_registers_the_guardian_approved_device() {
    let account = deploy_account();
    let first = device(0);
    let (r, s) = first.sign(TX_HASH).unwrap();
    let (guardian_r, guardian_s) = guardian_approval(CHAIN, account.contract_address, ADD_DEVICE, first.public_key, 1);
    start_cheat_transaction_hash(account.contract_address, TX_HASH);
    start_cheat_signature(account.contract_address, array![first.public_key, r, s, guardian_r, guardian_s].span());

    let class_hash = account_class().class_hash.into();
    assert!(
        account.__validate_deploy__(class_hash, REALMS_ID, REALMS_ID, guardian().public_key) == VALIDATED,
        "deployment refused",
    );
    assert!(account.is_valid_signature('intent', device_signature(first, 'intent')) == VALIDATED, "device refused");
    assert!(account.device_change_counter() == 1, "counter not advanced");
}

#[test]
fn second_device_joins_and_revoked_device_is_refused() {
    let account = deploy_account();
    let (first, second) = (device(0), device(1));
    join(account, first, 1);
    join(account, second, 2);

    let (guardian_r, guardian_s) = guardian_approval(
        CHAIN, account.contract_address, REVOKE_DEVICE, first.public_key, 3,
    );
    account.revoke_device(first.public_key, guardian_r, guardian_s);

    assert!(account.is_valid_signature('intent', device_signature(first, 'intent')) == 0, "revoked device accepted");
    assert!(account.is_valid_signature('intent', device_signature(second, 'intent')) == VALIDATED, "device refused");
}

#[test]
fn unknown_device_is_refused() {
    let account = deploy_account();
    join(account, device(0), 1);

    assert!(
        account.is_valid_signature('intent', device_signature(device(1), 'intent')) == 0, "unknown device accepted",
    );
}

#[test]
#[should_panic(expected: "invalid signature")]
fn unknown_device_cannot_send_a_transaction() {
    let account = deploy_account();
    join(account, device(0), 1);
    let stranger = device(1);
    start_cheat_signature(account.contract_address, device_signature(stranger, TX_HASH).span());

    account.__validate__(array![]);
}

#[test]
#[should_panic(expected: "invalid guardian signature")]
fn replayed_guardian_change_is_refused() {
    let account = deploy_account();
    join(account, device(0), 1);

    join(account, device(0), 1);
}

#[test]
#[should_panic(expected: "invalid guardian signature")]
fn out_of_order_guardian_change_is_refused() {
    let account = deploy_account();

    join(account, device(0), 2);
}

#[test]
#[should_panic(expected: "invalid guardian signature")]
fn guardian_change_for_another_chain_is_refused() {
    let account = deploy_account();
    let joining = device(0);

    join_with(
        account, joining, guardian_approval(OTHER_CHAIN, account.contract_address, ADD_DEVICE, joining.public_key, 1),
    );
}

#[test]
#[should_panic(expected: "invalid guardian signature")]
fn guardian_change_for_another_account_is_refused() {
    let account = deploy_account();
    let joining = device(0);
    let other_account: ContractAddress = 'other account'.try_into().unwrap();

    join_with(account, joining, guardian_approval(CHAIN, other_account, ADD_DEVICE, joining.public_key, 1));
}

#[test]
#[should_panic(expected: "device limit")]
fn device_set_is_bounded() {
    let account = deploy_account();
    for index in 0..MAX_DEVICES {
        join(account, device(index), index.into() + 1);
    }

    join(account, device(MAX_DEVICES), MAX_DEVICES.into() + 1);
}

#[test]
fn account_deployed_on_one_chain_lands_at_the_chain_free_address() {
    assert_deploys_at_the_chain_free_address(CHAIN);
}

#[test]
fn account_deployed_on_another_chain_lands_at_the_same_address() {
    assert_deploys_at_the_chain_free_address(OTHER_CHAIN);
}

fn assert_deploys_at_the_chain_free_address(chain_id: felt252) {
    start_cheat_chain_id_global(chain_id);
    let class_hash = account_class().class_hash;
    let calldata = array![REALMS_ID, guardian().public_key].span();

    let (address, _) = starknet::syscalls::deploy_syscall(class_hash, REALMS_ID, calldata, true).unwrap();

    let expected = pedersen_on_elements(
        array!['STARKNET_CONTRACT_ADDRESS', 0, REALMS_ID, class_hash.into(), pedersen_on_elements(calldata)].span(),
    );
    assert!(address.into() == expected, "address depends on the chain");
}

/// Starknet's contract address derivation for an account deployed by itself (deployer zero); no chain id enters it.
fn pedersen_on_elements(elements: Span<felt252>) -> felt252 {
    let mut state = 0;
    for element in elements {
        state = core::pedersen::pedersen(state, *element);
    }
    core::pedersen::pedersen(state, elements.len().into())
}
