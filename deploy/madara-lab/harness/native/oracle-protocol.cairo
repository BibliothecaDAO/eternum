use eternum_randomness_protocol::{Envelope, Intent, action_identity, encode_envelope};
use eternum_randomness_protocol::entrypoint::{ExecutionContext, IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{ContractClassTrait, DeclareResultTrait, declare};
use starknet::ContractAddress;
use world_native::commands::{Command, command_commitment};

pub fn deploy_submitter(address: ContractAddress, administrator: ContractAddress) {
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    declare("SequencingAccount").unwrap().contract_class().deploy_at(@array![administrator.into(), signer.public_key], address).unwrap();
}

pub fn action(season: ContractAddress, actor: ContractAddress, command: Command, timestamp: u64) -> Intent {
    let admission = IRecordedExecutionViewsDispatcher { contract_address: season }.get_admission(1, actor.into());
    let mut arguments = array![];
    command.serialize(ref arguments);
    Intent { chain: 'SN_TEST', deployment: season.into(), game_id: 1, actor: actor.into(), nonce: admission.nonce, command: command_commitment(command), rules: admission.rules, valid_from: timestamp, valid_until: timestamp, last_order: admission.order, arguments }
}

pub fn context(intent: @Intent, timestamp: u64, root: u256) -> ExecutionContext {
    let admission = IRecordedExecutionViewsDispatcher { contract_address: (*intent.deployment).try_into().unwrap() }.get_admission(*intent.game_id, *intent.actor);
    let envelope = Envelope { action: action_identity(intent), order: admission.order, predecessor: admission.predecessor, preceding_state: admission.preceding_state, timestamp, execution_config: admission.execution_config, l2_gas: 1200000000, root };
    ExecutionContext { envelope: encode_envelope(@envelope), authority_epoch: 1, accepted_public_key: admission.public_key }
}

pub fn authenticate(season: ContractAddress, submitter: ContractAddress) {
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let (r, s) = signer.sign(999).unwrap();
    snforge_std::start_cheat_account_contract_address(season, submitter);
    snforge_std::start_cheat_transaction_version(season, 3);
    snforge_std::start_cheat_transaction_hash(season, 999);
    snforge_std::start_cheat_signature(season, array![r, s].span());
    snforge_std::start_cheat_resource_bounds(season, array![starknet::ResourcesBounds { resource: 'L2_GAS', max_amount: 1200000000, max_price_per_unit: 0 }].span());
    snforge_std::cheat_caller_address(season, submitter, snforge_std::CheatSpan::TargetCalls(1));
}
