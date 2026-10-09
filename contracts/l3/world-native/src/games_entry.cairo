#[starknet::component]
pub mod GamesEntry {
    use core::num::traits::Zero;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address, get_tx_info};
    use crate::games::Authentication;
    use crate::logic::release::ReleaseState;
    use crate::logic::release::ReleaseState::InternalTrait as ReleaseInternal;
    use crate::presets::PresetDefinition;
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
        GameplayRejected: crate::commands::GameplayRejected,
        BatchProgress: crate::commands::BatchProgress,
        StoryEvent: crate::ownership::StoryEvent,
        PointsAwarded: crate::game::PointsAwarded,
        RowSet: crate::events::RowSet,
    }

    #[embeddable_as(AuthenticationImpl)]
    pub impl AuthenticationViews<TContractState, +HasComponent<TContractState>, +Drop<TContractState>>
        of crate::games::IGamesAuthentication<ComponentState<TContractState>> {
        fn authentication(self: @ComponentState<TContractState>) -> Authentication {
            self.authentication_state.authentication.read()
        }
    }

    #[embeddable_as(RolesImpl)]
    pub impl Roles<TContractState, +HasComponent<TContractState>, +Drop<TContractState>>
        of crate::games::IGamesRoles<ComponentState<TContractState>> {
        fn owner(self: @ComponentState<TContractState>) -> ContractAddress {
            self.data.authority.read()
        }
        fn launcher(self: @ComponentState<TContractState>) -> ContractAddress {
            self.data.launcher.read()
        }
        fn set_launcher(ref self: ComponentState<TContractState>, launcher: ContractAddress) {
            crate::logic::release::assert_authority();
            assert!(launcher.is_non_zero(), "zero launcher");
            self.data.launcher.write(launcher);
        }
        fn prepare_homes(ref self: ComponentState<TContractState>, game_id: u32, owners: Span<ContractAddress>) {
            crate::logic::release::assert_launcher();
            assert!(owners.len() <= crate::commands::MAX_COMMAND_ITEMS, "home preparation batch too large");
            for owner in owners { crate::entity_ids::reserve_homes(game_id, *owner); }
        }
    }

    #[embeddable_as(PlayImpl)]
    pub impl Play<
        TContractState, +HasComponent<TContractState>, impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::games::IGamesPlay<ComponentState<TContractState>> {
        fn play(
            ref self: ComponentState<TContractState>, game_id: u32, release_id: u32,
            preset_commitment: felt252, command: Span<felt252>,
        ) {
            let actor = self.validate_play(game_id, release_id, preset_commitment, command);
            let timestamp = starknet::get_block_timestamp();
            let raw_root = self.verify_stamp_before_roll();
            self.apply_gameplay(game_id, actor, command, crate::commands::ActionContext { raw_root, timestamp });
        }
    }

    #[generate_trait]
    pub impl InternalImpl<
        TContractState, +HasComponent<TContractState>, impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn initializer(
            ref self: ComponentState<TContractState>, owner: ContractAddress, launcher: ContractAddress,
            authentication: Authentication, release_id: u32, release: crate::logic::release::Release,
        ) {
            assert!(owner.is_non_zero(), "zero owner");
            assert!(launcher.is_non_zero(), "zero launcher");
            assert!(authentication.account_class.is_non_zero(), "zero account class");
            assert!(authentication.guardian_public_key.is_non_zero(), "zero guardian");
            games_storage::release::validate(release.classes);
            assert!(release_id != 0, "zero release id");
            self.data.authority.write(owner);
            self.data.launcher.write(launcher);
            self.data.current_release.write(release_id);
            self.data.releases.write(release_id, release);
            self.data.registrar.next_game.write(1);
            self.authentication_state.authentication.write(authentication);
        }

        fn validate_play(
            self: @ComponentState<TContractState>, game_id: u32, release_id: u32,
            preset_commitment: felt252, command: Span<felt252>,
        ) -> ContractAddress {
            let actor = get_caller_address();
            assert!(actor.is_non_zero() && actor == get_tx_info().unbox().account_contract_address, "direct account required");
            self.assert_approved_account(actor);
            assert!(game_id != 0 && crate::logic::game::game_exists(game_id), "invalid game");
            let game = crate::logic::game::game(game_id);
            assert!(release_id == self.data.game_releases.read(game_id), "stale release");
            assert!(preset_commitment == crate::logic::game::preset_commitment(game), "invalid preset");
            let (index, route, _payload) = crate::commands::validated_command(command).expect('INVALID_COMMAND');
            let rules = crate::logic::game::rules(game_id);
            assert!(crate::rules::command_enabled(rules.command_mask, index.into()), "command disabled");
            assert!(game.ready || index == crate::command_routes::SETTLE_BLITZ_ROSTER, "roster not ready");
            if route.selector == selector!("create_banks") || route.selector == selector!("settle_blitz_roster") {
                crate::logic::release::assert_launcher();
            }
            actor
        }

        fn assert_approved_account(self: @ComponentState<TContractState>, actor: ContractAddress) {
            let class = starknet::syscalls::get_class_hash_at_syscall(actor).expect('INVALID_ACTOR');
            let authentication = self.authentication_state.authentication.read();
            assert!(class == authentication.account_class, "unapproved account class");
            let identity = starknet::syscalls::call_contract_syscall(actor, selector!("realms_id"), array![].span())
                .expect('INVALID_ACTOR');
            assert!(identity.len() == 1, "invalid account identity");
            assert!(actor == crate::games::player_account_address(*identity[0], class, authentication.guardian_public_key), "foreign guardian");
        }

        // The verifier must bind this transaction's stamp before returning its root. Until it is installed, play
        // refuses every unstamped action; there is no fixed-root or player-supplied-root production fallback.
        fn verify_stamp_before_roll(self: @ComponentState<TContractState>) -> u256 {
            panic!("VRF stamp required")
        }

        fn apply_gameplay(
            ref self: ComponentState<TContractState>, game_id: u32, actor: ContractAddress,
            command: Span<felt252>, context: crate::commands::ActionContext,
        ) -> bool {
            let mut calldata = array![game_id.into(), actor.into()];
            command.serialize(ref calldata);
            context.serialize(ref calldata);
            let outcome = match starknet::syscalls::library_call_syscall(
                get_dep_component!(@self, Release).classes(game_id).season.read(), selector!("execute_gameplay"), calldata.span(),
            ) {
                Ok(mut output) => match Serde::<Result<Span<felt252>, crate::commands::Rejection>>::deserialize(ref output) {
                    Some(result) => if output.is_empty() { result } else { Err(crate::commands::rejection('INVALID_GAMEPLAY_RESULT')) },
                    None => Err(crate::commands::rejection('INVALID_GAMEPLAY_RESULT')),
                },
                Err(error) => Err(crate::commands::domain_rejection(error)),
            };
            if let Err(rejected) = outcome {
                self.emit(crate::commands::GameplayRejected {
                    version: 1, game_id, actor, tx_hash: get_tx_info().unbox().transaction_hash,
                    status_class: rejected.status_class, reason: rejected.reason,
                });
                false
            } else { true }
        }

        fn registrar(self: @ComponentState<TContractState>) -> IRegistrarLibraryDispatcher {
            let classes = self.data.releases.read(self.data.current_release.read()).classes;
            IRegistrarLibraryDispatcher { class_hash: classes.registry }
        }
    }

    #[embeddable_as(RegistrarImpl)]
    pub impl Registrar<
        TContractState, +HasComponent<TContractState>, impl Release: ReleaseState::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of crate::registrar::IRegistrar<ComponentState<TContractState>> {
        fn register_preset(ref self: ComponentState<TContractState>, preset_id: u32, definition: PresetDefinition) {
            crate::logic::release::assert_authority();
            self.registrar().register_preset(preset_id, definition);
        }
        fn create_game(ref self: ComponentState<TContractState>, params: CreateGameParams) -> u32 {
            crate::logic::release::assert_launcher();
            self.registrar().create_game(params)
        }
        fn freeze_blitz_roster(
            ref self: ComponentState<TContractState>, game_id: u32, players: Span<RosterPlayer>,
        ) {
            crate::logic::release::assert_launcher();
            self.registrar().freeze_blitz_roster(game_id, players);
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
