use starknet::ContractAddress;
#[starknet::interface]
pub trait IFixture<T> {
    fn authority(self: @T) -> ContractAddress;
    fn outcome(self: @T) -> u256;
}

/// Single-actor conformance fixture; gameplay and registry remain native-domain responsibilities.
#[starknet::contract]
pub mod RecordedExecutionStub {
    use core::ecdsa::check_ecdsa_signature;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_block_timestamp, get_contract_address, get_tx_info};
    use crate::entrypoint::{
        Admission, ExecutionContext, IRecordedExecution, IRecordedExecutionFailure, accepted_context_matches,
        authenticate_submission, timestamp_in_bounds,
    };
    use crate::recording::{ExecutionHead, HeadPacking, RecordedState};
    use crate::{Intent, action_identity, decode_envelope};
    component!(path: RecordedState, storage: recording, event: RecordingEvent);
    impl RecordingInternal = RecordedState::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        submitter: ContractAddress,
        actor: felt252,
        public_key: felt252,
        nonce: u64,
        // Synthetic gameplay outcome for the conformance fixture only.
        root: u256,
        #[substorage(v0)]
        recording: RecordedState::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RecordingEvent: RecordedState::Event,
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
            self.authenticate_ticket(@intent, @context, @envelope);
            let reason = self.validate_action(@intent, @context, @envelope, r, s).err();
            let consumed = self.consume_nonce(@intent);
            let outcome = match reason {
                Some(code) => Err(code),
                None => {
                    self.root.write(envelope.root);
                    Ok(array![(envelope.root.low % 2).into()].span())
                },
            };
            self.recording.record(@intent, @envelope, consumed, outcome);
        }
    }

    #[abi(embed_v0)]
    impl Failure of IRecordedExecutionFailure<ContractState> {
        fn reject_execution(
            ref self: ContractState, intent: Intent, context: ExecutionContext, r: felt252, s: felt252,
        ) {
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            self.authenticate_ticket(@intent, @context, @envelope);
            assert!(intent.actor == self.actor.read(), "invalid actor");
            assert!(
                context.accepted_public_key == self.public_key.read()
                    && check_ecdsa_signature(envelope.action, self.public_key.read(), r, s),
                "invalid player signature",
            );
            assert!(accepted_context_matches(@intent, @envelope), "invalid acceptance");
            let consumed = self.consume_nonce(@intent);
            self.recording.record(@intent, @envelope, consumed, Err('EXECUTION_FAILED'));
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn authenticate_ticket(
            self: @ContractState, intent: @Intent, context: @ExecutionContext, envelope: @crate::Envelope,
        ) {
            authenticate_submission(self.submitter.read(), *context.authority_epoch, *envelope.l2_gas);
            let action = action_identity(intent);
            assert!(*envelope.action == action, "altered action");
            let head = self.recording.head.read();
            assert!(*envelope.order == head.order + 1, "out of order");
            assert!(*envelope.preceding_state == head.state, "state predecessor mismatch");
            assert!(*envelope.execution_config == 987, "execution config mismatch");
            assert!(timestamp_in_bounds(*envelope.timestamp, get_block_timestamp()), "future execution time");
            assert!(*envelope.timestamp >= head.timestamp, "backwards execution time");
        }
        fn consume_nonce(ref self: ContractState, intent: @Intent) -> bool {
            let consumed = *intent.game_id == 7
                && *intent.actor == self.actor.read()
                && *intent.nonce == self.nonce.read()
                && *intent.nonce < 0xffffffffffffffff;
            if consumed {
                self.nonce.write(*intent.nonce + 1);
            }
            consumed
        }
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
            if *context.accepted_public_key != self.public_key.read()
                || !check_ecdsa_signature(*envelope.action, self.public_key.read(), r, s) {
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
            let head = self.recording.head.read();
            Admission {
                public_key: self.public_key.read(),
                rules: 789,
                execution_config: 987,
                nonce: self.nonce.read(),
                order: head.order + 1,
                preceding_state: head.state,
                timestamp: get_block_timestamp(),
            }
        }
        fn get_head(self: @ContractState) -> ExecutionHead {
            self.recording.head.read()
        }
    }

    #[abi(embed_v0)]
    impl Fixture of super::IFixture<ContractState> {
        fn authority(self: @ContractState) -> ContractAddress {
            self.submitter.read()
        }
        fn outcome(self: @ContractState) -> u256 {
            self.root.read()
        }
    }
}
