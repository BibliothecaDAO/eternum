#[starknet::component]
pub mod GamesEntry {
    use core::num::traits::Zero;
    use core::poseidon::poseidon_hash_span;
    use eternum_randomness_protocol::entrypoint::{
        Admission, ExecutionContext, IRecordedExecution, IRecordedExecutionFailure, IRecordedExecutionViews,
        RecordedAction, accepted_context_matches, authenticate_submission,
    };
    use eternum_randomness_protocol::epochs::{IRandomnessEpochsDispatcher, IRandomnessEpochsDispatcherTrait};
    use eternum_randomness_protocol::recording::{Rejection, rejection};
    use eternum_randomness_protocol::{Envelope, Intent, action_identity, decode_envelope};
    use starknet::storage::{
        StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_tx_info};
    use crate::commands::ActionContext as DomainContext;
    use crate::events::RowSet;
    use crate::games::Authentication;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as ReleaseInternal;
    use crate::presets::PresetDefinition;
    use crate::recording::RecordedState::InternalTrait as RecordingInternal;
    use crate::recording::{ExecutionHead, HeadPacking, RecordedState};
    use crate::registrar::{CreateGameParams, IRegistrarDispatcherTrait, IRegistrarLibraryDispatcher, RosterPlayer};
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        data: crate::state::Storage,
        #[flat]
        authentication_state: games_storage::authentication::AuthenticationStorage<Authentication>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        PointsAwarded: crate::game::PointsAwarded,
        StoryEvent: crate::ownership::StoryEvent,
        RowSet: RowSet,
        BatchProgress: crate::commands::BatchProgress,
    }

    #[embeddable_as(SeasonImpl)]
    pub impl Season<
        TContractState,
        +HasComponent<TContractState>,
        impl Recording: RecordedState::HasComponent<TContractState>,
        impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::games::IGamesAuthentication<ComponentState<TContractState>> {
        fn set_authentication(
            ref self: ComponentState<TContractState>,
            submitter: ContractAddress,
            approved_account_class: starknet::ClassHash,
        ) {
            assert!(get_caller_address() == get_dep_component!(@self, Release).authority(), "only domain authority");
            let previous = self.authentication_state.authentication.read();
            assert!(approved_account_class == previous.account_class, "immutable account class");
            self.write_authentication(Authentication { submitter, ..previous });
        }

        fn authentication(self: @ComponentState<TContractState>) -> Authentication {
            self.authentication_state.authentication.read()
        }
        fn next_nonce(self: @ComponentState<TContractState>, game_id: u32, actor: ContractAddress) -> u64 {
            self.authentication_state.nonces.read((game_id, actor))
        }
    }

    #[embeddable_as(ExecuteImpl)]
    pub impl Execute<
        TContractState,
        +HasComponent<TContractState>,
        impl Recording: RecordedState::HasComponent<TContractState>,
        impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of IRecordedExecution<ComponentState<TContractState>> {
        #[inline(never)]
        fn execute(
            ref self: ComponentState<TContractState>,
            intent: Intent,
            context: ExecutionContext,
            signature: Span<felt252>,
        ) {
            let epoch = self.randomness_epoch();
            self.execute_ticket(intent, context, signature, epoch);
        }
        fn execute_batch(ref self: ComponentState<TContractState>, actions: Array<RecordedAction>) {
            assert!(
                !actions.is_empty() && actions.len() <= eternum_randomness_protocol::entrypoint::MAX_EXECUTION_BATCH,
                "invalid execution batch size",
            );
            let epoch = self.randomness_epoch();
            for action in actions {
                self.execute_ticket(action.intent, action.context, action.signature, epoch);
            }
        }
    }

    #[embeddable_as(ExecutionFailureImpl)]
    pub impl ExecutionFailure<
        TContractState,
        +HasComponent<TContractState>,
        impl Recording: RecordedState::HasComponent<TContractState>,
        impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of IRecordedExecutionFailure<ComponentState<TContractState>> {
        fn reject_execution(
            ref self: ComponentState<TContractState>,
            intent: Intent,
            context: ExecutionContext,
            signature: Span<felt252>,
        ) {
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            self.authenticate_ticket(@intent, @envelope, self.randomness_epoch());
            assert!(accepted_context_matches(@intent, @envelope), "invalid acceptance");
            // Account or pin changes after admission must not strand the order or consume the player's nonce.
            let (consumed, reason) = match self.consume_authenticated_action(@intent, @envelope, signature) {
                Ok(_) => (true, 'EXECUTION_FAILED'),
                Err(reason) => (false, reason),
            };
            get_dep_component_mut!(ref self, Recording).record(@intent, @envelope, consumed, Err(rejection(reason)));
        }
    }

    #[embeddable_as(AdmissionViewsImpl)]
    pub impl AdmissionViews<
        TContractState,
        +HasComponent<TContractState>,
        impl Recording: RecordedState::HasComponent<TContractState>,
        impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of IRecordedExecutionViews<ComponentState<TContractState>> {
        fn get_admission(self: @ComponentState<TContractState>, game: felt252, actor: felt252) -> Admission {
            let game_id: u32 = game.try_into().expect('invalid game id');
            let actor: ContractAddress = actor.try_into().expect('invalid actor');
            if let Err(reason) = self.approved_account(actor) {
                core::panic_with_felt252(reason);
            }
            let head = get_dep_component!(self, Recording).data.heads.read(game);
            let game = crate::logic::game::game(game_id);
            Admission {
                release_id: self.data.game_releases.read(game_id),
                preset_commitment: crate::logic::game::preset_commitment(game),
                nonce: self.authentication_state.nonces.read((game_id, actor)),
                order: head.order + 1,
                timestamp: starknet::get_block_timestamp(),
            }
        }
        fn get_head(self: @ComponentState<TContractState>, game: felt252) -> ExecutionHead {
            get_dep_component!(self, Recording).data.heads.read(game)
        }
    }

    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl Recording: RecordedState::HasComponent<TContractState>,
        impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn execute_ticket(
            ref self: ComponentState<TContractState>,
            intent: Intent,
            context: ExecutionContext,
            signature: Span<felt252>,
            epoch: u64,
        ) {
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            self.authenticate_ticket(@intent, @envelope, epoch);
            let consumed = self.consume_authenticated_action(@intent, @envelope, signature);
            let outcome = match consumed {
                Ok((game_id, actor)) => self.execute_action(@intent, @envelope, game_id, actor),
                Err(reason) => Err(rejection(reason)),
            };
            get_dep_component_mut!(ref self, Recording).record(@intent, @envelope, consumed.is_ok(), outcome);
        }
        fn initializer(
            ref self: ComponentState<TContractState>,
            authority: ContractAddress,
            authentication: Authentication,
            release_id: u32,
            release: crate::logic::release::Release,
        ) {
            assert!(authority.is_non_zero(), "zero authority");
            games_storage::release::validate(release.classes);
            assert!(release_id != 0, "zero release id");
            self.data.authority.write(authority);
            self.data.current_release.write(release_id);
            self.data.releases.write(release_id, release);
            self.data.registrar.next_game.write(1);
            self.write_authentication(authentication);
        }

        fn write_authentication(ref self: ComponentState<TContractState>, authentication: Authentication) {
            assert!(authentication.submitter.is_non_zero(), "zero authentication");
            assert!(authentication.account_class.is_non_zero(), "zero account class");
            assert!(authentication.guardian_public_key.is_non_zero(), "zero guardian");
            self.authentication_state.authentication.write(authentication);
        }

        fn approved_account(self: @ComponentState<TContractState>, actor: ContractAddress) -> Result<(), felt252> {
            let class = starknet::syscalls::get_class_hash_at_syscall(actor).map_err(|_error| 'INVALID_ACTOR')?;
            let authentication = self.authentication_state.authentication.read();
            if class != authentication.account_class {
                return Err('INVALID_ACTOR');
            }
            let identity = starknet::syscalls::call_contract_syscall(actor, selector!("realms_id"), array![].span())
                .map_err(|_error| 'INVALID_ACTOR')?;
            if identity.len() != 1 {
                return Err('INVALID_ACTOR');
            }
            if actor != crate::games::player_account_address(*identity[0], class, authentication.guardian_public_key) {
                return Err('FOREIGN_GUARDIAN');
            }
            Ok(())
        }
        fn signed_by_actor(
            self: @ComponentState<TContractState>, actor: ContractAddress, action: felt252, signature: Span<felt252>,
        ) -> Result<(), felt252> {
            let mut calldata = array![action];
            signature.serialize(ref calldata);
            let valid =
                match starknet::syscalls::call_contract_syscall(
                    actor, selector!("is_valid_signature"), calldata.span(),
                ) {
                Ok(result) => result.len() == 1 && *result[0] == starknet::VALIDATED,
                Err(_error) => false,
            };
            if !valid {
                return Err('INVALID_SIGNATURE');
            }
            Ok(())
        }
        fn randomness_epoch(self: @ComponentState<TContractState>) -> u64 {
            IRandomnessEpochsDispatcher { contract_address: self.authentication_state.authentication.read().submitter }
                .current_randomness_epoch()
        }
        fn authenticate_ticket(
            self: @ComponentState<TContractState>, intent: @Intent, envelope: @Envelope, epoch: u64,
        ) {
            authenticate_submission(self.authentication_state.authentication.read().submitter);
            assert!(*envelope.action == action_identity(intent), "altered action");
            assert!(*envelope.release_id == *intent.release_id, "envelope release mismatch");
            assert!(*envelope.preset_commitment == *intent.preset_commitment, "envelope preset mismatch");
            get_dep_component!(self, Recording).require_next(intent, envelope, epoch);
        }
        fn execute_action(
            ref self: ComponentState<TContractState>,
            intent: @Intent,
            envelope: @Envelope,
            game_id: u32,
            actor: ContractAddress,
        ) -> Result<Span<felt252>, Rejection> {
            if !accepted_context_matches(intent, envelope) {
                return Err(rejection('INVALID_ACCEPTANCE'));
            }
            if intent.arguments.len() > 256 {
                return Err(rejection('INVALID_COMMAND'));
            }
            let mut committed = array!['ETERNUM_COMMAND', 1];
            committed.append_span(intent.arguments.span());
            if poseidon_hash_span(committed.span()) != *intent.command {
                return Err(rejection('INVALID_COMMAND'));
            }
            // The route consumes the index; the logic entrypoint decodes the unchanged payload.
            let mut calldata = array![game_id.into(), actor.into()];
            intent.arguments.span().serialize(ref calldata);
            calldata.append((*intent.nonce).into());
            DomainContext { raw_root: *envelope.root, timestamp: *envelope.timestamp }.serialize(ref calldata);
            crate::ownership::StoryCursor { order: *envelope.order, index: 0 }.serialize(ref calldata);
            let mut result = starknet::syscalls::library_call_syscall(
                get_dep_component!(@self, Release).classes(game_id).season.read(),
                selector!("execute_gameplay"),
                calldata.span(),
            )
                .map_err(|_error| rejection('INVALID_COMMAND'))?;
            Serde::deserialize(ref result).expect('invalid gameplay result')
        }
        fn consume_authenticated_action(
            ref self: ComponentState<TContractState>, intent: @Intent, envelope: @Envelope, signature: Span<felt252>,
        ) -> Result<(u32, ContractAddress), felt252> {
            self.authenticate_action(intent, envelope, signature)?;
            self.validate_game_pin(intent)?;
            self.consume_action_nonce(intent)
        }
        fn consume_action_nonce(
            ref self: ComponentState<TContractState>, intent: @Intent,
        ) -> Result<(u32, ContractAddress), felt252> {
            let game_id: u32 = (*intent.game_id).try_into().ok_or('INVALID_GAME')?;
            let actor: ContractAddress = (*intent.actor).try_into().ok_or('INVALID_ACTOR')?;
            if game_id == 0 {
                return Err('INVALID_GAME');
            }
            if actor.is_zero() {
                return Err('INVALID_ACTOR');
            }
            if *intent.nonce != self.authentication_state.nonces.read((game_id, actor)) {
                return Err('STALE_NONCE');
            }
            // The last u64 value cannot represent a successor and is never admitted.
            if *intent.nonce == 0xffffffffffffffff {
                return Err('NONCE_EXHAUSTED');
            }
            self.consume_nonce(game_id, actor, *intent.nonce);
            Ok((game_id, actor))
        }
        fn authenticate_action(
            self: @ComponentState<TContractState>, intent: @Intent, envelope: @Envelope, signature: Span<felt252>,
        ) -> Result<(), felt252> {
            if *intent.chain != get_tx_info().unbox().chain_id {
                return Err('FOREIGN_CHAIN');
            }
            if *intent.deployment != get_contract_address().into() {
                return Err('FOREIGN_DEPLOYMENT');
            }
            let actor: ContractAddress = (*intent.actor).try_into().ok_or('INVALID_ACTOR')?;
            if actor.is_zero() {
                return Err('INVALID_ACTOR');
            }
            self.approved_account(actor)?;
            self.signed_by_actor(actor, *envelope.action, signature)
        }
        fn validate_game_pin(self: @ComponentState<TContractState>, intent: @Intent) -> Result<(), felt252> {
            let game_id: u32 = (*intent.game_id).try_into().ok_or('INVALID_GAME')?;
            let game = self.data.games.games.read(game_id);
            if game_id == 0 || game.creator.is_zero() {
                return Err('INVALID_GAME');
            }
            if *intent.release_id != self.data.game_releases.read(game_id) {
                return Err('STALE_RELEASE');
            }
            if *intent.preset_commitment != crate::logic::game::preset_commitment(game) {
                return Err('INVALID_PRESET');
            }
            Ok(())
        }
        #[inline(never)]
        fn consume_nonce(ref self: ComponentState<TContractState>, game_id: u32, actor: ContractAddress, nonce: u64) {
            let next_nonce = nonce + 1;
            self.authentication_state.nonces.write((game_id, actor), next_nonce);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'ActionNonce',
                        keys: array![game_id.into(), actor.into()].span(),
                        values: array![next_nonce.into()].span(),
                    },
                );
        }
        fn assert_authority(self: @ComponentState<TContractState>) {
            assert!(starknet::get_caller_address() == self.data.authority.read(), "only domain authority");
        }
        fn registrar(self: @ComponentState<TContractState>) -> IRegistrarLibraryDispatcher {
            let classes = self.data.releases.read(self.data.current_release.read()).classes;
            IRegistrarLibraryDispatcher { class_hash: classes.registry }
        }
    }

    #[embeddable_as(RegistrarImpl)]
    pub impl Registrar<
        TContractState,
        +HasComponent<TContractState>,
        impl Recording: RecordedState::HasComponent<TContractState>,
        impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::registrar::IRegistrar<ComponentState<TContractState>> {
        fn register_preset(ref self: ComponentState<TContractState>, preset_id: u32, definition: PresetDefinition) {
            self.assert_authority();
            self.registrar().register_preset(preset_id, definition);
        }

        fn create_game(ref self: ComponentState<TContractState>, params: CreateGameParams) -> u32 {
            self.assert_authority();
            self.registrar().create_game(params)
        }

        fn preset_commitment(self: @ComponentState<TContractState>, preset_id: u32) -> felt252 {
            self.data.registrar.presets.read(preset_id)
        }

        fn next_game_id(self: @ComponentState<TContractState>) -> u32 {
            self.data.registrar.next_game.read()
        }

        fn game_id_by_name(self: @ComponentState<TContractState>, name: felt252) -> u32 {
            self.data.registrar.launch_ids.read(name)
        }

        fn blitz_roster(self: @ComponentState<TContractState>, game_id: u32) -> Span<RosterPlayer> {
            crate::logic::registrar::blitz_roster(game_id)
        }
    }
}
