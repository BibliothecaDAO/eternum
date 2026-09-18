use starknet::ContractAddress;
use crate::{Envelope, Intent};

pub const MAX_EXECUTION_BATCH: u32 = 64;

/// Canonical recorded context supplied by the sequencing account.
#[derive(Drop, Serde)]
pub struct ExecutionContext {
    pub envelope: Array<felt252>,
}

#[derive(Drop, Serde)]
pub struct RecordedAction {
    pub intent: Intent,
    pub context: ExecutionContext,
    pub r: felt252,
    pub s: felt252,
}

#[starknet::interface]
pub trait IRecordedExecution<T> {
    fn execute(ref self: T, intent: Intent, context: ExecutionContext, r: felt252, s: felt252);
    fn execute_batch(ref self: T, actions: Array<RecordedAction>);
}

/// The sequencing authority attests to a definitive execution failure of this exact ticket.
#[starknet::interface]
pub trait IRecordedExecutionFailure<T> {
    fn reject_execution(ref self: T, intent: Intent, context: ExecutionContext, r: felt252, s: felt252);
}

#[derive(Copy, Drop, Serde)]
pub struct Admission {
    pub public_key: felt252,
    pub rules: felt252,
    pub execution_config: felt252,
    pub nonce: u64,
    pub order: u64,
    pub timestamp: u64,
}

#[starknet::interface]
pub trait IRecordedExecutionViews<T> {
    fn get_admission(self: @T, game: felt252, actor: felt252) -> Admission;
    fn get_head(self: @T) -> crate::recording::ExecutionHead;
}

pub fn authenticate_submission(authority: ContractAddress) {
    assert!(starknet::get_caller_address() == authority, "only sequencing submitter");
}

/// Expiry is checked against acceptance time, including after restart.
pub fn accepted_context_matches(intent: @Intent, envelope: @Envelope) -> bool {
    *envelope.order > 0
        && *envelope.timestamp >= *intent.valid_from
        && *envelope.timestamp <= *intent.valid_until
        && *envelope.order <= *intent.last_order
}

/// Accepted contexts do not expire; recovery must retain their original time.
pub fn timestamp_in_bounds(recorded: u64, block_time: u64) -> bool {
    recorded <= block_time
}
