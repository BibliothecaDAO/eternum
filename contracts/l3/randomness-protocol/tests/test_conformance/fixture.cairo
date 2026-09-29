use eternum_randomness_protocol::authority::{ISequencingAuthorityDispatcher, ISequencingAuthorityDispatcherTrait};
use eternum_randomness_protocol::entrypoint::{
    ExecutionContext, IRecordedExecutionFailureSafeDispatcher, IRecordedExecutionFailureSafeDispatcherTrait,
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
};
pub use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait, IRecordedExecutionSafeDispatcher,
    IRecordedExecutionSafeDispatcherTrait,
};
use eternum_randomness_protocol::epochs::{
    IRandomnessEpochsDispatcher, IRandomnessEpochsDispatcherTrait, epoch_commitment,
};
pub use eternum_randomness_protocol::stub::{IFixtureDispatcher, IFixtureDispatcherTrait};
use eternum_randomness_protocol::{Envelope, Intent, action_identity, encode_envelope};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_account_contract_address, start_cheat_block_timestamp,
    start_cheat_caller_address, start_cheat_chain_id, start_cheat_resource_bounds, start_cheat_signature,
    start_cheat_transaction_hash, start_cheat_transaction_version,
};
use starknet::{ContractAddress, ResourcesBounds};
use super::receipts::RecordedReceiptsTrait;

pub fn actor() -> felt252 {
    456
}

pub fn pair() -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(12345)
}
/// The actor's device signature: `[device_key, r, s]` under the fixture's registered key.
pub fn signed(r: felt252, s: felt252) -> Span<felt252> {
    array![pair().public_key, r, s].span()
}
pub fn setup() -> ContractAddress {
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let account_class = declare("SequencingAccount").unwrap().contract_class();
    let (account, _) = account_class.deploy(@array![222, signer.public_key]).unwrap();
    let class = declare("RecordedExecutionStub").unwrap().contract_class();
    let (address, _) = class.deploy(@array![account.into(), 456, pair().public_key]).unwrap();
    start_cheat_caller_address(account, 222.try_into().unwrap());
    ISequencingAuthorityDispatcher { contract_address: account }.configure(address);
    start_cheat_caller_address(address, account);
    start_cheat_transaction_version(address, 3);
    start_cheat_account_contract_address(address, account);
    start_cheat_transaction_hash(address, 999);
    let (r, s) = signer.sign(999).unwrap();
    start_cheat_signature(address, array![r, s].span());
    start_cheat_resource_bounds(
        address, array![ResourcesBounds { resource: 'L2_GAS', max_amount: 1200000000, max_price_per_unit: 0 }].span(),
    );
    start_cheat_chain_id(address, 'TEST');
    start_cheat_block_timestamp(address, 1100);
    snforge_std::cheat_caller_address(account, account, snforge_std::CheatSpan::TargetCalls(1));
    IRandomnessEpochsDispatcher { contract_address: account }.open_randomness_epoch(epoch_commitment(123456));
    start_cheat_caller_address(account, 222.try_into().unwrap());
    address
}
pub fn intent(address: ContractAddress) -> Intent {
    Intent {
        chain: 'TEST',
        deployment: address.into(),
        game_id: 7,
        actor: 456,
        nonce: 0,
        command: 'explore',
        release_id: 1,
        preset_commitment: 789,
        valid_from: 1000,
        valid_until: 1010,
        last_order: 10,
        arguments: array![1, 2],
    }
}
pub fn envelope(action: @Intent) -> Envelope {
    Envelope {
        action: action_identity(action),
        order: 1,
        timestamp: 1005,
        release_id: *action.release_id,
        preset_commitment: *action.preset_commitment,
        epoch: 1,
        root: 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
    }
}
pub fn context(envelope: @Envelope) -> ExecutionContext {
    ExecutionContext { envelope: encode_envelope(envelope) }
}

pub fn terminal_arguments(ref action: Intent) {
    action.arguments = array![];
}

pub fn outcome(address: ContractAddress) -> Array<felt252> {
    let timestamp = IRecordedExecutionViewsDispatcher { contract_address: address }.get_head(7).timestamp;
    let root = IFixtureDispatcher { contract_address: address }.outcome();
    let result = IRecordedExecutionViewsDispatcher { contract_address: address }.recorded_outcome(7, 1).unwrap();
    array![result.status.into(), timestamp.into(), root.low.into(), root.high.into(), (root.low % 2).into()]
}

#[feature("safe_dispatcher")]
pub fn reject_execution(
    address: ContractAddress, intent: Intent, context: ExecutionContext, r: felt252, s: felt252,
) -> Result<(), Array<felt252>> {
    IRecordedExecutionFailureSafeDispatcher { contract_address: address }
        .reject_execution(intent, context, signed(r, s))
}
