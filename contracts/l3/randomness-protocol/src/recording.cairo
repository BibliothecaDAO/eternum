use core::poseidon::poseidon_hash_span;
use crate::{Envelope, envelope_binding};

#[derive(Copy, Drop, Default, Serde)]
pub struct ExecutionHead {
    pub order: u64,
    pub timestamp: u64,
    pub state: felt252,
}

#[derive(Copy, Drop, starknet::Store)]
pub struct PackedHead {
    pub order_and_timestamp: u128,
    pub state: felt252,
}

const U64_SCALE: u128 = 0x10000000000000000;

pub impl HeadPacking of starknet::storage_access::StorePacking<ExecutionHead, PackedHead> {
    fn pack(value: ExecutionHead) -> PackedHead {
        PackedHead { order_and_timestamp: value.order.into() + value.timestamp.into() * U64_SCALE, state: value.state }
    }
    fn unpack(value: PackedHead) -> ExecutionHead {
        ExecutionHead {
            order: (value.order_and_timestamp % U64_SCALE).try_into().unwrap(),
            timestamp: (value.order_and_timestamp / U64_SCALE).try_into().unwrap(),
            state: value.state,
        }
    }
}

#[derive(Drop, Serde)]
pub struct Rejection {
    pub status_class: felt252,
    pub reason: ByteArray,
}

// Replaces the single felt that used to conflate classification and the domain reason.
pub fn rejection(code: felt252) -> Rejection {
    Rejection { status_class: code, reason: short_reason(code) }
}

pub fn short_reason(word: felt252) -> ByteArray {
    let mut remaining: u256 = word.into();
    let mut len = 0;
    while remaining != 0 {
        remaining = remaining / 256;
        len += 1;
    }
    let mut reason = "";
    reason.append_word(word, len);
    reason
}

#[derive(Drop, Serde, starknet::Event)]
pub struct ExecutionRecorded {
    pub game_id: felt252,
    pub actor: felt252,
    pub nonce: u64,
    pub nonce_consumed: bool,
    pub order: u64,
    pub status: u8,
    pub status_class: felt252,
    pub reason: ByteArray,
}

pub fn following_state(previous_state: felt252, envelope: @Envelope, event: @ExecutionRecorded) -> felt252 {
    let mut fields = array![
        previous_state, envelope_binding(envelope), (*event.status).into(), *event.status_class,
        (*event.nonce_consumed).into(),
    ];
    event.reason.serialize(ref fields);
    poseidon_hash_span(fields.span())
}

// Shared by hosts of the protocol; the protocol owns its recording layout.
#[starknet::storage_node]
pub struct RecordingStorage {
    pub heads: starknet::storage::Map<felt252, ExecutionHead>,
}

#[starknet::component]
pub mod RecordedState {
    use starknet::get_block_timestamp;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::entrypoint::timestamp_in_bounds;
    use crate::{Envelope, Intent};
    use super::{ExecutionHead, ExecutionRecorded, HeadPacking, Rejection, following_state};

    /// Each game keeps its own recorded chain, so one game's actions replay and verify alone.
    #[storage]
    pub struct Storage {
        #[flat]
        pub data: super::RecordingStorage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ExecutionRecorded: ExecutionRecorded,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        /// The action is its own game's next, no earlier than that game's head, drawn from the open epoch.
        fn require_next(self: @ComponentState<TContractState>, intent: @Intent, envelope: @Envelope, epoch: u64) {
            let head = self.data.heads.read(*intent.game_id);
            assert!(*envelope.order == head.order + 1, "out of order");
            assert!(timestamp_in_bounds(*envelope.timestamp, get_block_timestamp()), "future execution time");
            assert!(*envelope.timestamp >= head.timestamp, "backwards execution time");
            assert!(*envelope.epoch == epoch, "stale randomness epoch");
        }
        fn record(
            ref self: ComponentState<TContractState>,
            intent: @Intent,
            envelope: @Envelope,
            nonce_consumed: bool,
            outcome: Result<Span<felt252>, Rejection>,
        ) {
            let (status, status_class, reason) = match outcome {
                Ok(_) => (1_u8, 0, ""),
                Err(error) => (2_u8, error.status_class, error.reason),
            };
            let event = ExecutionRecorded {
                game_id: *intent.game_id,
                actor: *intent.actor,
                nonce: *intent.nonce,
                nonce_consumed,
                order: *envelope.order,
                status,
                status_class,
                reason,
            };
            let previous = self.data.heads.read(*intent.game_id);
            self
                .data
                .heads
                .write(
                    *intent.game_id,
                    ExecutionHead {
                        order: *envelope.order,
                        timestamp: *envelope.timestamp,
                        state: following_state(previous.state, envelope, @event),
                    },
                );
            self.emit(event);
        }
    }
}
