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
