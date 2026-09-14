use starknet::ContractAddress;
#[starknet::interface]
pub trait IFixture<T> {
    fn authority(self: @T) -> ContractAddress;
    fn progress(self: @T) -> (u64, felt252, felt252, u64, u256);
}

/// Single-actor conformance fixture; gameplay and registry remain native-domain responsibilities.
#[starknet::contract]
pub mod RecordedExecutionStub {
    use core::ecdsa::check_ecdsa_signature;
    use core::poseidon::poseidon_hash_span;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address, get_tx_info};
    use crate::entrypoint::{
        Admission, ExecutionContext, ExecutionResult, IRecordedExecution, accepted_context_matches,
        authenticate_submission, timestamp_in_bounds,
    };
    use crate::{Intent, action_identity, decode_envelope, envelope_binding};

    #[storage]
    struct Storage {
        submitter: ContractAddress,
        actor: felt252,
        public_key: felt252,
        order: u64,
        nonce: u64,
        binding: felt252,
        state: felt252,
        timestamp: u64,
        root: u256,
        results: Map<u64, ExecutionResult>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, submitter: ContractAddress, actor: felt252, public_key: felt252) {
        self.submitter.write(submitter);
        self.actor.write(actor);
        self.public_key.write(public_key);
    }

    #[abi(embed_v0)]
    impl Execute of IRecordedExecution<ContractState> {
        fn execute(ref self: ContractState, intent: Intent, context: ExecutionContext, r: felt252, s: felt252) {
            assert!(get_caller_address() == self.submitter.read(), "only sequencing submitter");
            assert!(intent.chain == get_tx_info().unbox().chain_id, "foreign chain");
            assert!(intent.deployment == get_contract_address().into(), "foreign deployment");
            assert!(intent.game == 7, "foreign game");
            assert!(intent.actor == self.actor.read(), "foreign actor");
            assert!(intent.rules == 789, "rules mismatch");
            assert!(intent.nonce == self.nonce.read(), "consumed nonce");
            let action = action_identity(@intent);
            assert!(check_ecdsa_signature(action, context.accepted_public_key, r, s), "invalid intent signature");
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            authenticate_submission(self.submitter.read(), context.authority_epoch, envelope.l2_gas);
            assert!(envelope.action == action, "altered action");
            assert!(envelope.order == self.order.read() + 1, "out of order");
            assert!(envelope.predecessor == self.binding.read(), "binding predecessor mismatch");
            assert!(envelope.preceding_state == self.state.read(), "state predecessor mismatch");
            assert!(envelope.execution_config == 987, "execution config mismatch");
            assert!(accepted_context_matches(@intent, @envelope), "invalid acceptance context");
            assert!(timestamp_in_bounds(envelope.timestamp, get_block_timestamp()), "execution timestamp mismatch");
            self.nonce.write(intent.nonce + 1);
            self.order.write(envelope.order);
            self.binding.write(envelope_binding(@envelope));
            self.timestamp.write(envelope.timestamp);
            self.root.write(envelope.root);
            let binding = envelope_binding(@envelope);
            let status = if intent.arguments.len() == 2 {
                1_u8
            } else {
                2_u8
            };
            let result = poseidon_hash_span(array![binding, status.into(), (envelope.root.low % 2).into()].span());
            let state = poseidon_hash_span(array![self.state.read(), action, binding, result].span());
            self.state.write(state);
            self.results.write(envelope.order, ExecutionResult { status, binding, result, state });
        }
    }

    #[abi(embed_v0)]
    impl Views of crate::entrypoint::IRecordedExecutionViews<ContractState> {
        fn get_admission(self: @ContractState, game: felt252, actor: felt252) -> Admission {
            assert!(game == 7 && actor == self.actor.read(), "unknown fixture actor or game");
            Admission {
                public_key: self.public_key.read(),
                rules: 789,
                execution_config: 987,
                nonce: self.nonce.read(),
                order: self.order.read() + 1,
                predecessor: self.binding.read(),
                preceding_state: self.state.read(),
                timestamp: get_block_timestamp(),
            }
        }
        fn get_result(self: @ContractState, order: u64) -> ExecutionResult {
            self.results.read(order)
        }
    }

    #[abi(embed_v0)]
    impl Fixture of super::IFixture<ContractState> {
        fn authority(self: @ContractState) -> ContractAddress {
            self.submitter.read()
        }
        fn progress(self: @ContractState) -> (u64, felt252, felt252, u64, u256) {
            (self.order.read(), self.binding.read(), self.state.read(), self.timestamp.read(), self.root.read())
        }
    }
}
