use eternum_randomness_protocol::authority::{
    ISequencingAccountSafeDispatcher, ISequencingAccountSafeDispatcherTrait, ISequencingAuthorityDispatcher,
    ISequencingAuthorityDispatcherTrait,
};
use eternum_randomness_protocol::entrypoint::{
    ExecutionContext, IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
    accepted_context_matches, timestamp_in_bounds,
};
pub use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait, IRecordedExecutionSafeDispatcher,
    IRecordedExecutionSafeDispatcherTrait,
};
pub use eternum_randomness_protocol::stub::{IFixtureDispatcher, IFixtureDispatcherTrait};
use eternum_randomness_protocol::{Envelope, Intent, action_identity, encode_envelope, envelope_binding};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_account_contract_address, start_cheat_block_timestamp,
    start_cheat_caller_address, start_cheat_chain_id, start_cheat_resource_bounds, start_cheat_signature,
    start_cheat_transaction_hash, start_cheat_transaction_version,
};
use starknet::account::Call;
use starknet::{ContractAddress, ResourcesBounds};

pub fn pair() -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(12345)
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
        rules: 789,
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
        predecessor: 0,
        preceding_state: 0,
        timestamp: 1005,
        execution_config: 987,
        l2_gas: 1200000000,
        root: 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,
    }
}
pub fn context(envelope: @Envelope) -> ExecutionContext {
    ExecutionContext { envelope: encode_envelope(envelope), authority_epoch: 1, accepted_public_key: pair().public_key }
}

pub fn terminal_arguments(ref action: Intent) {
    action.arguments = array![];
}
