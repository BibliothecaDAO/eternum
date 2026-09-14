#[starknet::interface]
pub trait IFixture<T> {
    fn progress(self: @T) -> (u64, felt252, felt252, u64, u256);
}

/// Single-actor conformance fixture; gameplay and registry remain native-domain responsibilities.
#[starknet::contract]
pub mod RecordedExecutionStub {
    use core::ecdsa::check_ecdsa_signature;
    use core::poseidon::poseidon_hash_span;
    use eternum_randomness_protocol::entrypoint::{
        ExecutionContext, IRecordedExecution, accepted_context_matches, timestamp_in_bounds,
    };
    use eternum_randomness_protocol::{Intent, action_identity, decode_envelope, envelope_binding};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address, get_tx_info};

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
            assert!(context.authority_epoch == 1, "stale authority");
            assert!(intent.chain == get_tx_info().unbox().chain_id, "foreign chain");
            assert!(intent.deployment == get_contract_address().into(), "foreign deployment");
            assert!(intent.game == 7, "foreign game");
            assert!(intent.actor == self.actor.read(), "foreign actor");
            assert!(intent.rules == 789, "rules mismatch");
            assert!(intent.nonce == self.nonce.read(), "consumed nonce");
            assert!(context.accepted_public_key == self.public_key.read(), "authorization mismatch");
            let action = action_identity(@intent);
            assert!(check_ecdsa_signature(action, context.accepted_public_key, r, s), "invalid intent signature");
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
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
            self.state.write(poseidon_hash_span(array![self.state.read(), action, envelope_binding(@envelope)].span()));
        }
    }

    #[abi(embed_v0)]
    impl Fixture of super::IFixture<ContractState> {
        fn progress(self: @ContractState) -> (u64, felt252, felt252, u64, u256) {
            (self.order.read(), self.binding.read(), self.state.read(), self.timestamp.read(), self.root.read())
        }
    }
}
