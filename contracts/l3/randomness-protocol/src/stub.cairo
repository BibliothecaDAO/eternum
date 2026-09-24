use starknet::ContractAddress;
#[starknet::interface]
pub trait IFixture<T> {
    fn authority(self: @T) -> ContractAddress;
    fn outcome(self: @T) -> u256;
}

/// Single-actor, two-game conformance fixture; gameplay and registry remain native-domain responsibilities.
#[starknet::contract]
pub mod RecordedExecutionStub {
    use core::ecdsa::check_ecdsa_signature;
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_block_timestamp, get_contract_address, get_tx_info};
    use crate::entrypoint::{
        Admission, ExecutionContext, IRecordedExecution, IRecordedExecutionFailure, RecordedAction,
        accepted_context_matches, authenticate_submission,
    };
    use crate::epochs::{IRandomnessEpochsDispatcher, IRandomnessEpochsDispatcherTrait};
    use crate::recording::{ExecutionHead, HeadPacking, RecordedState, rejection};
    use crate::{Intent, action_identity, decode_envelope};
    component!(path: RecordedState, storage: recording, event: RecordingEvent);
    impl RecordingInternal = RecordedState::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        submitter: ContractAddress,
        actor: felt252,
        public_key: felt252,
        nonces: Map<felt252, u64>,
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
        fn execute(ref self: ContractState, intent: Intent, context: ExecutionContext, signature: Span<felt252>) {
            let epoch = self.randomness_epoch();
            self.execute_ticket(intent, context, signature, epoch);
        }
        fn execute_batch(ref self: ContractState, actions: Array<RecordedAction>) {
            assert!(
                !actions.is_empty() && actions.len() <= crate::entrypoint::MAX_EXECUTION_BATCH,
                "invalid execution batch size",
            );
            let epoch = self.randomness_epoch();
            for action in actions {
                self.execute_ticket(action.intent, action.context, action.signature, epoch);
            }
        }
    }

    #[generate_trait]
    impl Tickets of TicketsTrait {
        #[inline(never)]
        fn execute_ticket(
            ref self: ContractState, intent: Intent, context: ExecutionContext, signature: Span<felt252>, epoch: u64,
        ) {
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            self.authenticate_ticket(@intent, @envelope, epoch);
            let authentication = self.authenticate_action(@intent, @envelope, signature);
            let reason = match authentication {
                Ok(()) => self.validate_action(@intent, @envelope).err(),
                Err(reason) => Some(reason),
            };
            let consumed = authentication.is_ok() && self.consume_nonce(@intent);
            let outcome = match reason {
                Some(code) => Err(rejection(code)),
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
            ref self: ContractState, intent: Intent, context: ExecutionContext, signature: Span<felt252>,
        ) {
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            self.authenticate_ticket(@intent, @envelope, self.randomness_epoch());
            assert!(accepted_context_matches(@intent, @envelope), "invalid acceptance");
            let (consumed, reason) = match self.authenticate_action(@intent, @envelope, signature) {
                Ok(()) => (self.consume_nonce(@intent), 'EXECUTION_FAILED'),
                Err(reason) => (false, reason),
            };
            self.recording.record(@intent, @envelope, consumed, Err(rejection(reason)));
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        /// Read once per call; every ticket in a batch must name this epoch.
        fn randomness_epoch(self: @ContractState) -> u64 {
            IRandomnessEpochsDispatcher { contract_address: self.submitter.read() }.current_randomness_epoch()
        }
        fn authenticate_ticket(self: @ContractState, intent: @Intent, envelope: @crate::Envelope, epoch: u64) {
            authenticate_submission(self.submitter.read());
            let action = action_identity(intent);
            assert!(*envelope.action == action, "altered action");
            assert!(
                envelope.release_id == intent.release_id && envelope.preset_commitment == intent.preset_commitment,
                "execution release mismatch",
            );
            self.recording.require_next(intent, envelope, epoch);
        }
        fn consume_nonce(ref self: ContractState, intent: @Intent) -> bool {
            let consumed = fixture_game(*intent.game_id)
                && *intent.actor == self.actor.read()
                && *intent.nonce == self.nonces.read(*intent.game_id)
                && *intent.nonce < 0xffffffffffffffff;
            if consumed {
                self.nonces.write(*intent.game_id, *intent.nonce + 1);
            }
            consumed
        }
        fn authenticate_action(
            self: @ContractState, intent: @Intent, envelope: @crate::Envelope, signature: Span<felt252>,
        ) -> Result<(), felt252> {
            if *intent.chain != get_tx_info().unbox().chain_id {
                return Err('FOREIGN_CHAIN');
            }
            if *intent.deployment != get_contract_address().into() {
                return Err('FOREIGN_DEPLOYMENT');
            }
            if *intent.actor != self.actor.read() {
                return Err('INVALID_ACTOR');
            }
            // The stub stands in for the actor's account: one device key, signatures `[device_key, r, s]`.
            let valid = signature.len() == 3
                && *signature[0] == self.public_key.read()
                && check_ecdsa_signature(*envelope.action, *signature[0], *signature[1], *signature[2]);
            if !valid {
                return Err('INVALID_SIGNATURE');
            }
            if *intent.release_id != 1 {
                return Err('STALE_RELEASE');
            }
            if *intent.preset_commitment != 789 {
                return Err('INVALID_PRESET');
            }
            Ok(())
        }
        fn validate_action(self: @ContractState, intent: @Intent, envelope: @crate::Envelope) -> Result<(), felt252> {
            if !fixture_game(*intent.game_id) {
                return Err('INVALID_GAME');
            }
            if *intent.nonce != self.nonces.read(*intent.game_id) {
                return Err('STALE_NONCE');
            }
            if *intent.nonce == 0xffffffffffffffff {
                return Err('NONCE_EXHAUSTED');
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
            assert!(fixture_game(game) && actor == self.actor.read(), "unknown fixture actor or game");
            let head = self.recording.data.heads.read(game);
            Admission {
                release_id: 1,
                preset_commitment: 789,
                nonce: self.nonces.read(game),
                order: head.order + 1,
                timestamp: get_block_timestamp(),
            }
        }
        fn get_head(self: @ContractState, game: felt252) -> ExecutionHead {
            self.recording.data.heads.read(game)
        }
    }

    fn fixture_game(game: felt252) -> bool {
        game == 7 || game == 9
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
