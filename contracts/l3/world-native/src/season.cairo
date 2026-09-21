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
        Admission, ExecutionContext, IRecordedExecution, IRecordedExecutionFailure, IRecordedExecutionViews,
        RecordedAction, accepted_context_matches, authenticate_submission, timestamp_in_bounds,
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
    use crate::recording::{ExecutionHead, HeadPacking, RecordedState};
    use crate::rules::SliceRules;
    use super::{
        Authentication, IGameplayKeyDispatcher, IGameplayKeyDispatcherTrait, IPlayerRegistryDispatcher,
        IPlayerRegistryDispatcherTrait,
    };
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
        close_initiators: Map<u32, Option<ContractAddress>>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        RowSet: RowSet,
        GameEvent: GameState::Event,
        RecordingEvent: RecordedState::Event,
        StoryEvent: crate::ownership::StoryEvent,
        BatchProgress: crate::commands::BatchProgress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress, authentication: Authentication) {
        self.lifecycle.initialize(authority);
        self.write_authentication(authentication);
    }

    #[abi(embed_v0)]
    impl SeasonLifecycle of crate::game::ISeasonLifecycle<ContractState> {
        fn configure_season_win(ref self: ContractState, game_id: u32, points: u128) {
            self.lifecycle.assert_configurator();
            self.games.game(game_id);
            assert!(self.games.win_thresholds.read(game_id).is_none(), "season win threshold already configured");
            self.games.win_thresholds.write(game_id, Some(points));
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'SeasonWinThreshold',
                        keys: array![game_id.into()].span(),
                        values: array![points.into()].span(),
                    },
                );
        }
        fn season_win_threshold(self: @ContractState, game_id: u32) -> u128 {
            self.games.win_thresholds.read(game_id).expect('missing season win threshold')
        }
        fn close_season(ref self: ContractState, game_id: u32, actor: ContractAddress, context: DomainContext) -> u64 {
            let peers = self.lifecycle.require_active();
            assert!(get_caller_address() == get_contract_address(), "only authenticated command domain");
            crate::commands::assert_context_time(context.timestamp);
            let mut game = self.games.game(game_id);
            crate::game::assert_playing(game, context.timestamp);
            assert!(
                crate::rules::rule_enabled(self.games.rules(game_id), crate::rules::SEASON_CLOSE),
                "season closure is disabled",
            );
            let threshold = self.season_win_threshold(game_id);
            assert!(threshold != 0, "season win threshold is zero");
            let initiator = match self.close_initiators.read(game_id) {
                Some(initiator) => initiator,
                None => {
                    self.close_initiators.write(game_id, Some(actor));
                    actor
                },
            };
            let remaining = crate::hyperstructures::IHyperstructuresDispatcherTrait::settle_completed_hyperstructures(
                crate::hyperstructures::IHyperstructuresDispatcher { contract_address: peers.economy },
                game_id,
                context.timestamp,
            );
            if remaining != 0 {
                return remaining.into();
            }
            self.close_initiators.write(game_id, None);
            if self.games.player_points.read((game_id, initiator)) < threshold {
                return 0;
            }
            game.end_at = context.timestamp;
            self.games.write_game(game_id, game);
            self.record_season_end(game_id, initiator, context.timestamp);
            0
        }
    }

    #[abi(embed_v0)]
    impl GameSettlement of crate::registrar::IGameSettlement<ContractState> {
        fn mark_game_settled(
            ref self: ContractState, game_id: u32, actor: ContractAddress, context: DomainContext,
        ) -> u64 {
            assert!(
                get_caller_address() == self.lifecycle.require_active().season, "only authenticated command domain",
            );
            assert!(actor == self.lifecycle.domain_state().authority, "only domain authority");
            crate::commands::assert_context_time(context.timestamp);
            let mut game = self.games.game(game_id);
            if game.settled {
                return 0;
            }
            assert!(
                crate::game::status_at(game, context.timestamp) == crate::game::GameStatus::Ended, "game has not ended",
            );
            assert!(
                game.end_grace_seconds == 0 || context.timestamp > game.end_at + game.end_grace_seconds.into(),
                "game settlement grace period is active",
            );
            let remaining = self.settle_final_points(game_id, context.timestamp);
            if remaining != 0 {
                return remaining.into();
            }
            game.settled = true;
            self.games.write_game(game_id, game);
            0
        }
    }

    #[abi(embed_v0)]
    impl Season of super::ISeason<ContractState> {
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
        #[inline(never)]
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
        #[inline(never)]
        fn execute(ref self: ContractState, intent: Intent, context: ExecutionContext, r: felt252, s: felt252) {
            let peers = self.lifecycle.require_active();
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            self.authenticate_ticket(@intent, @envelope);
            let consumed = match self.authenticate_action(@intent, @envelope, r, s) {
                Ok(()) => self.consume_action_nonce(@intent),
                Err(reason) => Err(reason),
            };
            let outcome = match consumed {
                Ok((game_id, actor)) => self.execute_action(peers, @intent, @envelope, game_id, actor),
                Err(reason) => Err(reason),
            };
            self.recording.record(@intent, @envelope, consumed.is_ok(), outcome);
        }
        fn execute_batch(ref self: ContractState, actions: Array<RecordedAction>) {
            assert!(
                !actions.is_empty() && actions.len() <= eternum_randomness_protocol::entrypoint::MAX_EXECUTION_BATCH,
                "invalid execution batch size",
            );
            for action in actions {
                self.execute(action.intent, action.context, action.r, action.s);
            }
        }
    }

    #[abi(embed_v0)]
    impl ExecutionFailure of IRecordedExecutionFailure<ContractState> {
        fn reject_execution(
            ref self: ContractState, intent: Intent, context: ExecutionContext, r: felt252, s: felt252,
        ) {
            let envelope = decode_envelope(context.envelope.span()).expect('malformed envelope');
            self.authenticate_ticket(@intent, @envelope);
            // A transport failure cannot authorize consumption of an unauthenticated action.
            self.authenticate_action(@intent, @envelope, r, s).expect('unauthenticated action');
            assert!(accepted_context_matches(@intent, @envelope), "invalid acceptance");
            let consumed = self.consume_action_nonce(@intent).is_ok();
            self.recording.record(@intent, @envelope, consumed, Err('EXECUTION_FAILED'));
        }
    }

    #[abi(embed_v0)]
    impl AdmissionViews of IRecordedExecutionViews<ContractState> {
        fn get_admission(self: @ContractState, game: felt252, actor: felt252) -> Admission {
            let game_id: u32 = game.try_into().expect('invalid game id');
            let actor: ContractAddress = actor.try_into().expect('invalid actor');
            let head = self.recording.head.read();
            Admission {
                public_key: self.registered_key(actor),
                rules: self.rules_identity(game_id),
                execution_config: self.execution_config(),
                nonce: self.nonces.read((game_id, actor)),
                order: head.order + 1,
                timestamp: starknet::get_block_timestamp(),
            }
        }
        fn get_head(self: @ContractState) -> ExecutionHead {
            self.recording.head.read()
        }
    }

    #[abi(embed_v0)]
    impl Games of crate::game::IGame<ContractState> {
        fn ownership_rules_ready(self: @ContractState, game_id: u32) -> bool {
            self.games.ownership_rules_ready.read(game_id)
        }

        fn register_relic_points(ref self: ContractState, game_id: u32, actor: ContractAddress) {
            assert!(get_caller_address() == self.lifecycle.require_active().economy, "only economy domain");
            let points = self.games.rules(game_id).victory_points_grant_config.relic_open_points;
            self.games.register_points(game_id, actor, points.into(), crate::game::PointActivity::RelicChest);
        }
        fn register_hyperstructure_points(ref self: ContractState, game_id: u32, actor: ContractAddress, amount: u128) {
            assert!(get_caller_address() == self.lifecycle.require_active().economy, "only economy domain");
            self.games.game(game_id);
            self.games.register_points(game_id, actor, amount, crate::game::PointActivity::Hyperstructure);
        }
        fn player_points(self: @ContractState, game_id: u32, actor: ContractAddress) -> u128 {
            self.games.player_points.read((game_id, actor))
        }
        fn season_points(self: @ContractState, game_id: u32) -> u128 {
            self.games.season_points.read(game_id)
        }
        fn register_capture(ref self: ContractState, game_id: u32, actor: ContractAddress, category: u8) -> u128 {
            assert!(get_caller_address() == self.lifecycle.require_active().structures, "only structures domain");
            let rules = self.games.rules(game_id).victory_points_grant_config;
            let amount = if category == 2 {
                rules.claim_hyperstructure_points
            } else {
                rules.claim_otherstructure_points
            };
            self
                .games
                .register_points(
                    game_id,
                    actor,
                    amount.into(),
                    if category == 2 {
                        crate::game::PointActivity::HyperstructureCapture
                    } else {
                        crate::game::PointActivity::StructureCapture
                    },
                );
            amount.into()
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
            self.lifecycle.assert_configurator();
            self.games.create(game_id, game, rules);
        }
        fn start_blitz(ref self: ContractState, game_id: u32, timestamp: u64) {
            assert!(get_caller_address() == self.lifecycle.require_active().settlement, "only settlement domain");
            assert!(self.games.rules(game_id).entry_rule == crate::rules::ENTRY_ROSTER, "fixed roster required");
            let mut game = self.games.game(game_id);
            assert!(!game.ready, "roster already ready");
            let duration = game.end_at - game.start_main_at;
            game.start_main_at = core::cmp::max(game.start_main_at, timestamp);
            game.end_at = game.start_main_at + duration;
            game.ready = true;
            self.games.write_game(game_id, game);
        }
        fn allocate_entity(ref self: ContractState, game_id: u32) -> u32 {
            let peers = self.lifecycle.require_active();
            let caller = get_caller_address();
            assert!(
                caller == peers.troops
                    || caller == peers.map
                    || caller == peers.structures
                    || caller == peers.resources
                    || caller == peers.bridge
                    || caller == peers.economy
                    || caller == peers.prizes,
                "only gameplay domain",
            );
            self.games.allocate(game_id)
        }
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        #[inline(never)]
        fn settle_final_points(ref self: ContractState, game_id: u32, timestamp: u64) -> u32 {
            crate::hyperstructures::IHyperstructuresDispatcherTrait::settle_final_hyperstructures(
                crate::hyperstructures::IHyperstructuresDispatcher {
                    contract_address: self.lifecycle.require_active().economy,
                },
                game_id,
                timestamp,
            )
        }
        fn record_season_end(ref self: ContractState, game_id: u32, winner: ContractAddress, timestamp: u64) {
            self
                .emit(
                    crate::ownership::StoryEvent {
                        version: 1,
                        game_id,
                        id: self.games.allocate(game_id),
                        entity_id: None,
                        owner: Some(winner),
                        timestamp,
                        tx_hash: get_tx_info().unbox().transaction_hash,
                        story: crate::ownership::Story::SeasonEnded(winner),
                    },
                );
        }
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
        #[inline(never)]
        fn execution_config(self: @ContractState) -> felt252 {
            let mut values = array!['ETERNUM_EXECUTION', 1];
            self.lifecycle.require_active().serialize(ref values);
            poseidon_hash_span(values.span())
        }
        fn registered_key(self: @ContractState, actor: ContractAddress) -> felt252 {
            self.try_registered_key(actor).expect('unregistered actor')
        }
        fn try_registered_key(self: @ContractState, actor: ContractAddress) -> Result<felt252, felt252> {
            let authentication = self.authentication.read();
            let registry = IPlayerRegistryDispatcher { contract_address: authentication.registry };
            let owner = registry.owner_of(actor);
            if owner.is_zero() || registry.account_of(owner) != actor {
                return Err('INVALID_ACTOR');
            }
            let class = starknet::syscalls::get_class_hash_at_syscall(actor).map_err(|_error| 'INVALID_ACTOR')?;
            if class != authentication.account_class {
                return Err('INVALID_ACTOR');
            }
            Ok(IGameplayKeyDispatcher { contract_address: actor }.get_public_key())
        }
        fn authenticate_ticket(self: @ContractState, intent: @Intent, envelope: @Envelope) {
            authenticate_submission(self.authentication.read().submitter);
            let head = self.recording.head.read();
            assert!(*envelope.action == action_identity(intent), "altered action");
            assert!(*envelope.order == head.order + 1, "out of order");
            assert!(*envelope.execution_config == self.execution_config(), "execution config mismatch");
            assert!(timestamp_in_bounds(*envelope.timestamp, starknet::get_block_timestamp()), "future execution time");
            assert!(*envelope.timestamp >= head.timestamp, "backwards execution time");
        }
        fn execute_action(
            ref self: ContractState,
            peers: Peers,
            intent: @Intent,
            envelope: @Envelope,
            game_id: u32,
            actor: ContractAddress,
        ) -> Result<Span<felt252>, felt252> {
            self.validate_action(intent, envelope, game_id)?;
            let command = decode_command(intent.arguments.span(), *intent.command).map_err(|_error| 'INVALID_COMMAND')?;
            let rules = self.games.rules(game_id);
            let mut command_fields = array![];
            command.serialize(ref command_fields);
            let command_index: u128 = (*command_fields.at(0)).try_into().unwrap();
            if !crate::rules::command_enabled(rules.command_mask, command_index) {
                return Err('COMMAND_DISABLED');
            }
            if !self.games.game(game_id).ready && command != Command::SettleBlitzRoster {
                return Err('ROSTER_NOT_READY');
            }
            let result = dispatch(
                peers,
                game_id,
                actor,
                command,
                DomainContext { raw_root: *envelope.root, timestamp: *envelope.timestamp },
            )
                .map_err(|_error| 'GAMEPLAY_REJECTED')?;
            match command {
                Command::SettleBlitzRoster | Command::CloseSeason | Command::MarkGameSettled |
                Command::ClaimBitcoinPhase(_) |
                Command::RecordBlitzResults(_) => {
                    let mut output = result;
                    let remaining: u64 = Serde::deserialize(ref output).expect('missing batch result');
                    assert!(output.is_empty(), "invalid batch result");
                    self.emit(crate::commands::BatchProgress { game_id, actor, nonce: *intent.nonce, remaining });
                },
                _ => {},
            }
            Ok(result)
        }
        fn consume_action_nonce(ref self: ContractState, intent: @Intent) -> Result<(u32, ContractAddress), felt252> {
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
            Ok((game_id, actor))
        }
        fn authenticate_action(
            self: @ContractState, intent: @Intent, envelope: @Envelope, r: felt252, s: felt252,
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
            let public_key = self.try_registered_key(actor)?;
            if !check_ecdsa_signature(*envelope.action, public_key, r, s) {
                return Err('INVALID_SIGNATURE');
            }
            Ok(())
        }
        fn validate_action(
            self: @ContractState, intent: @Intent, envelope: @Envelope, game_id: u32,
        ) -> Result<(), felt252> {
            if !self.games.exists.read(game_id) {
                return Err('INVALID_GAME');
            }
            if *intent.rules != self.rules_identity(game_id) {
                return Err('INVALID_RULES');
            }
            if !accepted_context_matches(intent, envelope) {
                return Err('INVALID_ACCEPTANCE');
            }
            Ok(())
        }
        #[inline(never)]
        fn consume_nonce(ref self: ContractState, game_id: u32, actor: ContractAddress, nonce: u64) {
            let next_nonce = nonce + 1;
            self.nonces.write((game_id, actor), next_nonce);
        }
    }

    fn dispatch(
        peers: Peers, game_id: u32, actor: ContractAddress, command: Command, context: DomainContext,
    ) -> Result<Span<felt252>, Array<felt252>> {
        let mut calldata = array![game_id.into(), actor.into()];
        let (target, selector) = match command {
            Command::DepositResource(value) => {
                value.serialize(ref calldata);
                (peers.bridge, selector!("deposit_resource"))
            },
            Command::WithdrawResource(value) => {
                value.serialize(ref calldata);
                (peers.bridge, selector!("withdraw_resource"))
            },
            Command::ClaimBitcoinPhase(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("claim_bitcoin_phase"))
            },
            Command::ContributeBitcoinLabor(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("contribute_bitcoin_labor"))
            },
            Command::CloseBitcoinPhase(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("close_bitcoin_phase"))
            },
            Command::BindBitcoinPhase(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("bind_bitcoin_phase"))
            },
            Command::CreateGuild(value) => {
                value.serialize(ref calldata);
                (peers.registry, selector!("create_guild"))
            },
            Command::JoinGuild(value) => {
                value.serialize(ref calldata);
                (peers.registry, selector!("join_guild"))
            },
            Command::ManageTroops(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("manage_troops"))
            },
            Command::GuardAttack(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("guard_attack"))
            },
            Command::Raid(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("raid"))
            },
            Command::MarkGameSettled => (peers.season, selector!("mark_game_settled")),
            Command::LeaveGuild => (peers.registry, selector!("leave_guild")),
            Command::SetGuildWhitelist(value) => {
                value.serialize(ref calldata);
                (peers.registry, selector!("set_guild_whitelist"))
            },
            Command::RemoveGuildMember(value) => {
                value.serialize(ref calldata);
                (peers.registry, selector!("remove_guild_member"))
            },
            Command::CraftRelic(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("craft_relic"))
            },
            Command::RecordBlitzResults(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("record_blitz_results"))
            },
            Command::PledgeFaith(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("pledge_faith"))
            },
            Command::RemoveFaith(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("remove_faith"))
            },
            Command::UpdateWonderOwnership(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("update_wonder_ownership"))
            },
            Command::UpdateFaithfulOwnership(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("update_faithful_ownership"))
            },
            Command::ClaimWonderPoints(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("claim_wonder_points"))
            },
            Command::ClaimPlayerFaithPoints(value) => {
                value.serialize(ref calldata);
                (peers.prizes, selector!("claim_player_faith_points"))
            },
            Command::CloseSeason => (get_contract_address(), selector!("close_season")),
            Command::CreateExplorer(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("create_explorer"))
            },
            Command::Explore(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("explore"))
            },
            Command::CreateBanks(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("create_banks"))
            },
            Command::BuyFromBank(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("buy_from_bank"))
            },
            Command::SellToBank(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("sell_to_bank"))
            },
            Command::AddBankLiquidity(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("add_bank_liquidity"))
            },
            Command::RemoveBankLiquidity(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("remove_bank_liquidity"))
            },
            Command::InitializeHyperstructure(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("initialize_hyperstructure"))
            },
            Command::ContributeHyperstructure(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("contribute_hyperstructure"))
            },
            Command::AllocateHyperstructureShares(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("allocate_hyperstructure_shares"))
            },
            Command::SetConstructionAccess(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("set_construction_access"))
            },
            Command::OpenRelicChest(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("open_relic_chest"))
            },
            Command::ApplyRelic(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("apply_relic"))
            },
            Command::CreateTradeOrder(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("create_trade_order"))
            },
            Command::AcceptTradeOrder(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("accept_trade_order"))
            },
            Command::CancelTradeOrder(value) => {
                value.serialize(ref calldata);
                (peers.economy, selector!("cancel_trade_order"))
            },
            Command::BattleGuard(value) => {
                value.serialize(ref calldata);
                (peers.troops, selector!("battle_guard"))
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
            Command::SetEntityName(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("set_entity_name"))
            },
            Command::SettleVillage(value) => {
                value.serialize(ref calldata);
                (peers.settlement, selector!("settle_village"))
            },
            Command::ReceiveVillageArmy(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("receive_village_army"))
            },
            Command::SettleSeason(value) => {
                value.serialize(ref calldata);
                (peers.settlement, selector!("settle_season"))
            },
            Command::SettleBlitzRoster => (peers.settlement, selector!("settle_blitz_roster")),
            Command::ProvisionAndUpgradeRealm(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("provision_and_upgrade_realm"))
            },
            Command::ProvisionRealm(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("activate_realm_economy"))
            },
            Command::CreateReservedHyperstructure(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("create_reserved_hyperstructure"))
            },
            Command::LevelUp(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("level_up"))
            },
            Command::BurnLaborForResourceProduction(value) => {
                value.serialize(ref calldata);
                (peers.resources, selector!("burn_labor_for_resource_production"))
            },
            Command::BurnResourceForResourceProduction(value) => {
                value.serialize(ref calldata);
                (peers.resources, selector!("burn_resource_for_resource_production"))
            },
            Command::CreateBuilding(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("create_building"))
            },
            Command::DestroyBuilding(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("destroy_building"))
            },
            Command::PauseBuildingProduction(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("pause_building_production"))
            },
            Command::ResumeBuildingProduction(value) => {
                value.serialize(ref calldata);
                (peers.structures, selector!("resume_building_production"))
            },
            Command::BurnStructureResources(value) => {
                value.serialize(ref calldata);
                (peers.resources, selector!("burn_structure_resources"))
            },
            Command::TransferExplorerResources(value) => {
                value.serialize(ref calldata);
                (peers.resources, selector!("transfer_explorer_resources"))
            },
            Command::TransferStructureResourcesToExplorer(value) => {
                value.serialize(ref calldata);
                (peers.resources, selector!("transfer_structure_resources_to_explorer"))
            },
            Command::SendResources(value) => {
                value.serialize(ref calldata);
                (peers.resources, selector!("send_resources"))
            },
            Command::TransferExplorerResourcesToStructure(value) => {
                value.serialize(ref calldata);
                (peers.resources, selector!("transfer_explorer_resources_to_structure"))
            },
            Command::OffloadArrival(value) => {
                value.serialize(ref calldata);
                (peers.resources, selector!("offload_arrival"))
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
