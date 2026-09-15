use starknet::{ClassHash, ContractAddress};
use crate::recording::ExecutionHead;

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Authentication {
    pub submitter: ContractAddress,
    pub registry: ContractAddress,
    pub account_class: ClassHash,
}

#[starknet::interface]
pub trait IGameplayKey<T> {
    fn get_public_key(self: @T) -> felt252;
}

#[starknet::interface]
pub trait ISeason<T> {
    fn set_agent_controller(ref self: T, address: ContractAddress);
    fn set_authentication(
        ref self: T, submitter: ContractAddress, registry: ContractAddress, approved_account_class: ClassHash,
    );
    fn command_commitment(self: @T, command: crate::commands::Command) -> felt252;
    fn rules_commitment(self: @T, rules: crate::rules::SliceRules) -> felt252;
    fn authentication(self: @T) -> Authentication;
    fn next_nonce(self: @T, game_id: u32, actor: ContractAddress) -> u64;
    fn execution_head(self: @T) -> ExecutionHead;
}

#[starknet::contract]
pub mod SeasonDomain {
    use core::ecdsa::check_ecdsa_signature;
    use core::num::traits::Zero;
    use core::poseidon::poseidon_hash_span;
    use eternum_randomness_protocol::entrypoint::{
        Admission, ExecutionContext, ExecutionResult, IRecordedExecution, IRecordedExecutionViews,
        accepted_context_matches, authenticate_submission, timestamp_in_bounds,
    };
    use eternum_randomness_protocol::{Envelope, Intent, action_identity, decode_envelope};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
    };
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_tx_info};
    use crate::commands::{Command, ExecutionContext as DomainContext, decode_command};
    use crate::events::RowSet;
    use crate::game::{GameRegistry, GameState};
    use crate::lifecycle::{Lifecycle, Peers};
    use crate::recording::{ExecutionHead, RecordedState};
    use crate::rules::SliceRules;
    use crate::upgrades::{UpgradeLimits, UpgradeRecipe, UpgradeState};
    use super::{
        Authentication, IGameplayKeyDispatcher, IGameplayKeyDispatcherTrait, IPlayerRegistryDispatcher,
        IPlayerRegistryDispatcherTrait,
    };
    component!(path: UpgradeState, storage: upgrades, event: UpgradeEvent);
    impl UpgradeInternal = UpgradeState::InternalImpl<ContractState>;
    component!(path: RecordedState, storage: recording, event: RecordingEvent);
    impl RecordingInternal = RecordedState::InternalImpl<ContractState>;
    component!(path: GameState, storage: games, event: GameEvent);
    impl GameInternal = GameState::InternalImpl<ContractState>;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        authentication: Authentication,
        nonces: Map<(u32, ContractAddress), u64>,
        #[substorage(v0)]
        games: GameState::Storage,
        #[substorage(v0)]
        recording: RecordedState::Storage,
        agent_controller: ContractAddress,
        #[substorage(v0)]
        upgrades: UpgradeState::Storage,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        RowSet: RowSet,
        GameEvent: GameState::Event,
        RecordingEvent: RecordedState::Event,
        UpgradeEvent: UpgradeState::Event,
    }

    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress, authentication: Authentication) {
        self.lifecycle.initialize(authority);
        self.write_authentication(authentication);
    }

    #[abi(embed_v0)]
    impl UpgradeRules of crate::upgrades::IUpgradeRules<ContractState> {
        fn configure_upgrades(
            ref self: ContractState, game_id: u32, limits: UpgradeLimits, recipes: Span<UpgradeRecipe>,
        ) {
            assert!(get_caller_address() == self.lifecycle.domain_state().authority, "only domain authority");
            let _ = self.games.game(game_id);
            self.upgrades.configure(game_id, limits, recipes);
        }
        fn upgrade_limits(self: @ContractState, game_id: u32) -> UpgradeLimits {
            self.upgrades.limits(game_id)
        }
        fn upgrade_recipe(self: @ContractState, game_id: u32, level: u8) -> UpgradeRecipe {
            self.upgrades.recipe(game_id, level)
        }
    }

    #[abi(embed_v0)]
    impl Season of super::ISeason<ContractState> {
        fn set_agent_controller(ref self: ContractState, address: ContractAddress) {
            assert!(get_caller_address() == self.lifecycle.domain_state().authority, "only domain authority");
            self.agent_controller.write(address);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'AgentController',
                        keys: array![get_contract_address().into()].span(),
                        values: array![address.into()].span(),
                    },
                );
        }
        fn set_authentication(
            ref self: ContractState,
            submitter: ContractAddress,
            registry: ContractAddress,
            approved_account_class: starknet::ClassHash,
        ) {
            assert!(get_caller_address() == self.lifecycle.domain_state().authority, "only domain authority");
            self.write_authentication(Authentication { submitter, registry, account_class: approved_account_class });
        }
        fn command_commitment(self: @ContractState, command: Command) -> felt252 {
            crate::commands::command_commitment(command)
        }
        fn rules_commitment(self: @ContractState, rules: SliceRules) -> felt252 {
            let mut values = array!['ETERNUM_RULES', 1];
            rules.serialize(ref values);
            poseidon_hash_span(values.span())
        }
        fn authentication(self: @ContractState) -> Authentication {
            self.authentication.read()
        }
        fn next_nonce(self: @ContractState, game_id: u32, actor: ContractAddress) -> u64 {
            self.nonces.read((game_id, actor))
        }
        fn execution_head(self: @ContractState) -> ExecutionHead {
            self.recording.head.read()
        }
    }

    #[abi(embed_v0)]
    impl Execute of IRecordedExecution<ContractState> {
        fn execute(ref self: ContractState, intent: Intent, context: ExecutionContext, r: felt252, s: felt252) {
            let peers = self.lifecycle.require_active();
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            self.authenticate_ticket(@intent, @context, @envelope);
            let outcome = self.execute_action(peers, @intent, @context, @envelope, r, s);
            self.recording.record(@envelope, outcome);
        }
    }

    #[abi(embed_v0)]
    impl AdmissionViews of IRecordedExecutionViews<ContractState> {
        fn get_admission(self: @ContractState, game: felt252, actor: felt252) -> Admission {
            self.lifecycle.require_active();
            let game_id: u32 = game.try_into().expect('invalid game id');
            let actor: ContractAddress = actor.try_into().expect('invalid actor');
            let head = self.recording.head.read();
            Admission {
                public_key: self.registered_key(actor),
                rules: self.rules_identity(game_id),
                execution_config: self.execution_config(),
                nonce: self.nonces.read((game_id, actor)),
                order: head.order + 1,
                predecessor: head.binding,
                preceding_state: head.state,
                timestamp: starknet::get_block_timestamp(),
            }
        }
        fn get_result(self: @ContractState, order: u64) -> ExecutionResult {
            self.recording.results.read(order)
        }
    }

    #[abi(embed_v0)]
    impl Games of crate::game::IGame<ContractState> {
        fn ownership_rules_ready(self: @ContractState, game_id: u32) -> bool {
            self.games.ownership_rules_ready.read(game_id)
        }
        fn agent_controller(self: @ContractState) -> ContractAddress {
            self.agent_controller.read()
        }
        fn player_points(self: @ContractState, game_id: u32, actor: ContractAddress) -> u128 {
            self.games.player_points.read((game_id, actor))
        }
        fn season_points(self: @ContractState, game_id: u32) -> u128 {
            self.games.season_points.read(game_id)
        }
        fn register_exploration(ref self: ContractState, game_id: u32, actor: ContractAddress) {
            assert!(get_caller_address() == self.lifecycle.require_active().troops, "only troops domain");
            self.games.register_exploration(game_id, actor);
        }
        fn game(self: @ContractState, game_id: u32) -> GameRegistry {
            self.games.game(game_id)
        }
        fn rules(self: @ContractState, game_id: u32) -> SliceRules {
            self.games.rules(game_id)
        }
        fn create_game(ref self: ContractState, game_id: u32, game: GameRegistry, rules: SliceRules) {
            let state = self.lifecycle.domain_state();
            assert!(get_caller_address() == state.authority, "only domain authority");
            self.lifecycle.require_active();
            self.games.create(game_id, game, rules);
        }
        fn allocate_entity(ref self: ContractState, game_id: u32) -> u32 {
            let peers = self.lifecycle.require_active();
            let caller = get_caller_address();
            assert!(caller == peers.troops || caller == peers.structures, "only gameplay domain");
            self.games.allocate(game_id)
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn write_authentication(ref self: ContractState, authentication: Authentication) {
            assert!(
                authentication.submitter.is_non_zero() && authentication.registry.is_non_zero(), "zero authentication",
            );
            assert!(authentication.account_class.is_non_zero(), "zero account class");
            self.authentication.write(authentication);
            let mut values = array![];
            authentication.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'Authentication',
                        keys: array![get_contract_address().into()].span(),
                        values: values.span(),
                    },
                );
        }

        fn rules_identity(self: @ContractState, game_id: u32) -> felt252 {
            self.rules_commitment(self.games.rules(game_id))
        }
        fn execution_config(self: @ContractState) -> felt252 {
            let mut values = array!['ETERNUM_EXECUTION', 1];
            self.lifecycle.require_active().serialize(ref values);
            poseidon_hash_span(values.span())
        }
        fn registered_key(self: @ContractState, actor: ContractAddress) -> felt252 {
            let authentication = self.authentication.read();
            let registry = IPlayerRegistryDispatcher { contract_address: authentication.registry };
            let owner = registry.owner_of(actor);
            assert!(owner.is_non_zero() && registry.account_of(owner) == actor, "unregistered actor");
            let class = starknet::syscalls::get_class_hash_at_syscall(actor).unwrap();
            assert!(class == authentication.account_class, "unapproved gameplay account");
            IGameplayKeyDispatcher { contract_address: actor }.get_public_key()
        }
        fn authenticate_ticket(self: @ContractState, intent: @Intent, context: @ExecutionContext, envelope: @Envelope) {
            authenticate_submission(self.authentication.read().submitter, *context.authority_epoch, *envelope.l2_gas);
            let head = self.recording.head.read();
            assert!(*envelope.action == action_identity(intent), "altered action");
            assert!(*envelope.order == head.order + 1, "out of order");
            assert!(*envelope.predecessor == head.binding, "binding predecessor mismatch");
            assert!(*envelope.preceding_state == head.state, "state predecessor mismatch");
            assert!(*envelope.execution_config == self.execution_config(), "execution config mismatch");
            assert!(timestamp_in_bounds(*envelope.timestamp, starknet::get_block_timestamp()), "future execution time");
        }
        fn execute_action(
            ref self: ContractState,
            peers: Peers,
            intent: @Intent,
            context: @ExecutionContext,
            envelope: @Envelope,
            r: felt252,
            s: felt252,
        ) -> Result<Span<felt252>, felt252> {
            let game_id: u32 = (*intent.game_id).try_into().ok_or('INVALID_GAME')?;
            let actor: ContractAddress = (*intent.actor).try_into().ok_or('INVALID_ACTOR')?;
            if game_id == 0 {
                return Err('INVALID_GAME');
            }
            if actor.is_zero() {
                return Err('INVALID_ACTOR');
            }
            if *intent.nonce != self.nonces.read((game_id, actor)) {
                return Err('STALE_NONCE');
            }
            // The last u64 value cannot represent a successor and is never admitted.
            if *intent.nonce == 0xffffffffffffffff {
                return Err('NONCE_EXHAUSTED');
            }
            self.consume_nonce(game_id, actor, *intent.nonce);
            self.validate_action(intent, context, envelope, game_id, r, s)?;
            let command = decode_command(intent.arguments.span(), *intent.command).map_err(|_error| 'INVALID_COMMAND')?;
            dispatch(
                peers,
                game_id,
                actor,
                command,
                DomainContext { raw_root: *envelope.root, timestamp: *envelope.timestamp },
            )
                .map_err(|_error| 'GAMEPLAY_REJECTED')
        }
        fn validate_action(
            self: @ContractState,
            intent: @Intent,
            context: @ExecutionContext,
            envelope: @Envelope,
            game_id: u32,
            r: felt252,
            s: felt252,
        ) -> Result<(), felt252> {
            if *intent.chain != get_tx_info().unbox().chain_id {
                return Err('FOREIGN_CHAIN');
            }
            if *intent.deployment != get_contract_address().into() {
                return Err('FOREIGN_DEPLOYMENT');
            }
            if !self.games.exists.read(game_id) {
                return Err('INVALID_GAME');
            }
            if *intent.rules != self.rules_identity(game_id) {
                return Err('INVALID_RULES');
            }
            // The authority attests to the gameplay key at admission, including across rotation.
            if !check_ecdsa_signature(*envelope.action, *context.accepted_public_key, r, s) {
                return Err('INVALID_SIGNATURE');
            }
            if !accepted_context_matches(intent, envelope) {
                return Err('INVALID_ACCEPTANCE');
            }
            Ok(())
        }
        fn consume_nonce(ref self: ContractState, game_id: u32, actor: ContractAddress, nonce: u64) {
            let next_nonce = nonce + 1;
            self.nonces.write((game_id, actor), next_nonce);
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
    }

    fn dispatch(
        peers: Peers, game_id: u32, actor: ContractAddress, command: Command, context: DomainContext,
    ) -> Result<Span<felt252>, Array<felt252>> {
        let mut calldata = array![game_id.into(), actor.into()];
        let (target, selector) = match command {
            Command::CreateExplorer(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("create_explorer"))
            },
            Command::Explore(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("explore"))
            },
            Command::Battle(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("battle"))
            },
            Command::Move(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("move_explorer"))
            },
            Command::ToggleAlternate(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("toggle_alternate"))
            },
            Command::TransferStructureOwnership(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("transfer_structure_ownership"))
            },
            Command::TransferAgentOwnership(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("transfer_agent_ownership"))
            },
            Command::SetAddressName(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("set_address_name"))
            },
            Command::LevelUp(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("level_up"))
            },
            Command::ClaimProduction(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("claim_production"))
            },
        };
        context.serialize(ref calldata);
        starknet::syscalls::call_contract_syscall(target, selector, calldata.span())
    }
}

#[starknet::interface]
pub trait IPlayerRegistry<T> {
    fn owner_of(self: @T, account: ContractAddress) -> ContractAddress;
    fn account_of(self: @T, owner: ContractAddress) -> ContractAddress;
}
