use starknet::ContractAddress;
use crate::authority::{ISequencingAuthorityDispatcher, ISequencingAuthorityDispatcherTrait};
use crate::{Envelope, Intent};

pub const MAX_CONTEXT_SKEW_SECONDS: u64 = 300;

/// Authority witnesses are outside the immutable action and envelope identities.
#[derive(Drop, Serde)]
pub struct ExecutionContext {
    pub envelope: Array<felt252>,
    pub authority_epoch: u64,
    pub accepted_public_key: felt252,
}

#[starknet::interface]
pub trait IRecordedExecution<T> {
    fn execute(ref self: T, intent: Intent, context: ExecutionContext, r: felt252, s: felt252);
}

#[derive(Copy, Drop, Serde)]
pub struct Admission {
    pub public_key: felt252,
    pub rules: felt252,
    pub execution_config: felt252,
    pub nonce: u64,
    pub order: u64,
    pub predecessor: felt252,
    pub preceding_state: felt252,
    pub timestamp: u64,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct ExecutionResult {
    pub status: u8,
    pub binding: felt252,
    pub result: felt252,
    pub state: felt252,
}

#[starknet::interface]
pub trait IRecordedExecutionViews<T> {
    fn get_admission(self: @T, game: felt252, actor: felt252) -> Admission;
    fn get_result(self: @T, order: u64) -> ExecutionResult;
}

pub fn authenticate_submission(authority: ContractAddress, epoch: u64, l2_gas: u64) {
    let tx = starknet::get_tx_info().unbox();
    assert!(starknet::get_caller_address() == authority, "only sequencing submitter");
    assert!(tx.version == 3 && tx.account_contract_address == authority, "invalid transaction context");
    let account = ISequencingAuthorityDispatcher { contract_address: authority };
    assert!(epoch == account.authority_epoch(), "stale authority");
    assert!(tx.signature.len() == 2, "invalid authority signature length");
    assert!(
        core::ecdsa::check_ecdsa_signature(
            tx.transaction_hash, account.get_public_key(), *tx.signature.at(0), *tx.signature.at(1),
        ),
        "invalid authority signature",
    );
    let mut bounded = false;
    for bound in tx.resource_bounds {
        if *bound.resource == 'L2_GAS' {
            bounded = *bound.max_amount == l2_gas && l2_gas > 0;
        }
    }
    assert!(bounded, "recorded resource bounds mismatch");
}

/// Expiry is checked against acceptance time, including after restart.
pub fn accepted_context_matches(intent: @Intent, envelope: @Envelope) -> bool {
    *envelope.order > 0
        && *envelope.l2_gas > 0
        && *envelope.timestamp >= *intent.valid_from
        && *envelope.timestamp <= *intent.valid_until
        && *envelope.order <= *intent.last_order
}

pub fn timestamp_in_bounds(recorded: u64, block_time: u64) -> bool {
    recorded <= block_time && block_time - recorded <= MAX_CONTEXT_SKEW_SECONDS
}
