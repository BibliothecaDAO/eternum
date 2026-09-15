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
    use starknet::{ContractAddress, get_block_timestamp, get_contract_address, get_tx_info};
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

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RowSet: RowSet,
    }

    #[derive(Drop, starknet::Event)]
    struct RowSet {
        #[key]
        version: u8,
        #[key]
        model: felt252,
        keys: Span<felt252>,
        values: Span<felt252>,
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
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            authenticate_submission(self.submitter.read(), context.authority_epoch, envelope.l2_gas);
            let action = action_identity(@intent);
            assert!(envelope.action == action, "altered action");
            assert!(envelope.order == self.order.read() + 1, "out of order");
            assert!(envelope.predecessor == self.binding.read(), "binding predecessor mismatch");
            assert!(envelope.preceding_state == self.state.read(), "state predecessor mismatch");
            assert!(envelope.execution_config == 987, "execution config mismatch");
            assert!(timestamp_in_bounds(envelope.timestamp, get_block_timestamp()), "future execution time");
            let reason = self.validate_action(@intent, @context, @envelope, r, s).err();
            if intent.game_id == 7
                && intent.actor == self.actor.read()
                && intent.nonce == self.nonce.read()
                && intent.nonce < 0xffffffffffffffff {
                self.nonce.write(intent.nonce + 1);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'ActionNonce',
                            keys: array![intent.game_id, intent.actor].span(),
                            values: array![(intent.nonce + 1).into()].span(),
                        },
                    );
            }
            self.order.write(envelope.order);
            self.binding.write(envelope_binding(@envelope));
            self.timestamp.write(envelope.timestamp);
            self.root.write(envelope.root);
            let binding = envelope_binding(@envelope);
            let (status, result) = match reason {
                Some(code) => (2_u8, code),
                None => (1_u8, poseidon_hash_span(array![binding, 1, (envelope.root.low % 2).into()].span())),
            };
            let state = poseidon_hash_span(array![self.state.read(), action, binding, result].span());
            self.state.write(state);
            self.results.write(envelope.order, ExecutionResult { status, binding, result, state });
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn validate_action(
            self: @ContractState,
            intent: @Intent,
            context: @ExecutionContext,
            envelope: @crate::Envelope,
            r: felt252,
            s: felt252,
        ) -> Result<(), felt252> {
            if *intent.game_id != 7 {
                return Err('INVALID_GAME');
            }
            if *intent.actor != self.actor.read() {
                return Err('INVALID_ACTOR');
            }
            if *intent.nonce != self.nonce.read() {
                return Err('STALE_NONCE');
            }
            if *intent.nonce == 0xffffffffffffffff {
                return Err('NONCE_EXHAUSTED');
            }
            if *intent.chain != get_tx_info().unbox().chain_id {
                return Err('FOREIGN_CHAIN');
            }
            if *intent.deployment != get_contract_address().into() {
                return Err('FOREIGN_DEPLOYMENT');
            }
            if *intent.rules != 789 {
                return Err('INVALID_RULES');
            }
            if !check_ecdsa_signature(*envelope.action, *context.accepted_public_key, r, s) {
                return Err('INVALID_SIGNATURE');
            }
            if !accepted_context_matches(intent, envelope) {
                return Err('INVALID_ACCEPTANCE');
            }
            if intent.arguments.len() != 2 {
                return Err('INVALID_COMMAND');
            }
            Ok(())
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
