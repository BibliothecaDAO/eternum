#[derive(Copy, Drop, Default, Serde, starknet::Store)]
pub struct ExecutionHead {
    pub order: u64,
    pub binding: felt252,
    pub state: felt252,
    pub timestamp: u64,
    pub root: u256,
}

#[starknet::component]
pub mod RecordedState {
    use core::poseidon::poseidon_hash_span;
    use eternum_randomness_protocol::entrypoint::ExecutionResult;
    use eternum_randomness_protocol::{Envelope, envelope_binding};
    use starknet::storage::{Map, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use crate::events::RowSet;
    use super::ExecutionHead;

    #[storage]
    pub struct Storage {
        pub head: ExecutionHead,
        pub results: Map<u64, ExecutionResult>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn record(
            ref self: ComponentState<TContractState>, envelope: @Envelope, outcome: Result<Span<felt252>, felt252>,
        ) {
            let binding = envelope_binding(envelope);
            let (status, result) = match outcome {
                Result::Ok(values) => (1_u8, poseidon_hash_span(array![binding, 1, poseidon_hash_span(values)].span())),
                Result::Err(reason) => (2_u8, reason),
            };
            let state = poseidon_hash_span(array![self.head.read().state, *envelope.action, binding, result].span());
            let head = ExecutionHead {
                order: *envelope.order, binding, state, timestamp: *envelope.timestamp, root: *envelope.root,
            };
            let execution = ExecutionResult { status, binding, result, state };
            self.head.write(head);
            self.results.write(head.order, execution);
            let address: felt252 = starknet::get_contract_address().into();
            let mut values = array![];
            head.serialize(ref values);
            self
                .emit(
                    RowSet { version: 1, model: 'ExecutionHead', keys: array![address].span(), values: values.span() },
                );
            let mut values = array![];
            execution.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'ExecutionResult',
                        keys: array![address, head.order.into()].span(),
                        values: values.span(),
                    },
                );
        }
    }
}
