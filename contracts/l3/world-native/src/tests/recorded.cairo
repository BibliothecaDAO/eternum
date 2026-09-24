use eternum_randomness_protocol::authority::{
    ISequencingAccountDispatcher, ISequencingAccountDispatcherTrait, ISequencingAuthorityDispatcher,
    ISequencingAuthorityDispatcherTrait,
};
use eternum_randomness_protocol::entrypoint::{
    Admission, ExecutionContext, IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait,
    IRecordedExecutionFailureSafeDispatcher, IRecordedExecutionFailureSafeDispatcherTrait,
    IRecordedExecutionSafeDispatcher, IRecordedExecutionSafeDispatcherTrait, IRecordedExecutionViewsDispatcher,
    IRecordedExecutionViewsDispatcherTrait, IRecordedExecutionViewsSafeDispatcher,
    IRecordedExecutionViewsSafeDispatcherTrait,
};
use eternum_randomness_protocol::epochs::{
    IRandomnessEpochsDispatcher, IRandomnessEpochsDispatcherTrait, epoch_commitment,
};
use eternum_randomness_protocol::{Envelope, Intent, action_identity, encode_envelope};
use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, declare, start_cheat_account_contract_address, start_cheat_chain_id_global,
    start_cheat_resource_bounds, start_cheat_signature, start_cheat_transaction_hash, start_cheat_transaction_version,
};
use starknet::storage::{
    StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess,
};
use starknet::{ContractAddress, ResourcesBounds};
use crate::commands::{Command, ExecutionContext as DomainContext, command_commitment};
use crate::game::GameRegistry;
use crate::games::{
    IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait, IGamesAuthenticationSafeDispatcher,
};
use crate::recording::ExecutionHead;
use super::fixtures::{IFixtureDispatcher, IFixtureDispatcherTrait};
use super::recorded_receipts::RecordedReceiptsTrait;

#[derive(Copy, Drop, Serde)]
pub struct FixtureAction {
    pub game_id: u32,
    pub actor: ContractAddress,
    pub nonce: u64,
    pub deadline: u64,
    pub command: Command,
}

pub const BLITZ_COMMAND_MASK: u128 = 71478916396378193887;
pub const ETERNUM_COMMAND_MASK: u128 = 73786976294838206463;

pub const BLITZ_RULES: u32 = crate::rules::HOME_REWARDS
    + crate::rules::DISCOVER_CAMPS
    + crate::rules::DISCOVER_CHESTS
    + crate::rules::CAPTURE_VILLAGES
    + crate::rules::SAME_OWNER_TRANSFER
    + crate::rules::RESERVED_HYPERSTRUCTURES
    + crate::rules::OWNER_ONLY_SHARES
    + crate::rules::HYPERSTRUCTURE_MULTIPLIERS
    + crate::rules::PRODUCTION_START;

pub const ETERNUM_RULES: u32 = crate::rules::DISCOVER_HYPERSTRUCTURES
    + crate::rules::SPIRES
    + crate::rules::SEASON_CLOSE
    + crate::rules::DEV_VILLAGE_ENTRY;

pub fn rules() -> crate::rules::SliceRules {
    let data = read_txt(@FileTrait::new("tests/fixtures/preset-3.txt"));
    let mut fields = data.span();
    Serde::deserialize(ref fields).unwrap()
}
pub fn create_games(registry: ContractAddress, authority: ContractAddress) {
    for game_id in array![1, 2] {
        seed_game(
            registry,
            game_id,
            GameRegistry {
                name: 'fixture',
                preset_id: 3,
                creator: authority,
                settled: false,
                ready: true,
                dev_mode_on: true,
                start_settling_at: 0,
                start_main_at: 0,
                end_at: 999999,
                end_grace_seconds: 0,
                seed: 1,
            },
            rules(),
        );
    }
}
pub fn deploy_submitter(address: ContractAddress) {
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    if starknet::syscalls::get_class_hash_at_syscall(address).unwrap() == 0.try_into().unwrap() {
        declare("SequencingAccount")
            .unwrap()
            .contract_class()
            .deploy_at(@array![super::authority().into(), signer.public_key], address)
            .unwrap();
    }
}
pub fn configure_submitter(season: ContractAddress, account: ContractAddress) {
    start_cheat_chain_id_global('TEST');
    start_cheat_transaction_version(season, 3);
    start_cheat_account_contract_address(season, account);
    start_cheat_transaction_hash(season, 999);
    let signer: StarkCurveKeyPair = KeyPairTrait::from_secret_key(54321);
    let (r, s) = signer.sign(999).unwrap();
    start_cheat_signature(season, array![r, s].span());
    start_cheat_resource_bounds(
        season, array![ResourcesBounds { resource: 'L2_GAS', max_amount: 1200000000, max_price_per_unit: 0 }].span(),
    );
}
pub fn make_intent(season: ContractAddress, action: FixtureAction) -> Intent {
    let (release_id, preset_commitment) = snforge_std::interact_with_state(
        season,
        || {
            let state = crate::state::read();
            (state.game_releases.read(action.game_id), crate::logic::game::preset_commitment(action.game_id))
        },
    );
    let mut arguments = array![];
    action.command.serialize(ref arguments);
    Intent {
        chain: 'TEST',
        deployment: season.into(),
        game_id: action.game_id.into(),
        actor: action.actor.into(),
        nonce: action.nonce,
        command: command_commitment(action.command),
        release_id,
        preset_commitment,
        valid_from: 0,
        valid_until: action.deadline,
        last_order: 100,
        arguments,
    }
}
pub fn head(season: ContractAddress, game_id: u32) -> ExecutionHead {
    IRecordedExecutionViewsDispatcher { contract_address: season }.get_head(game_id.into())
}
pub fn make_context(season: ContractAddress, action: FixtureAction, context: DomainContext) -> ExecutionContext {
    let head = head(season, action.game_id);
    let submitter = IGamesAuthenticationDispatcher { contract_address: season }.authentication().submitter;
    let intent = make_intent(season, action);
    let envelope = Envelope {
        action: action_identity(@intent),
        order: head.order + 1,
        timestamp: context.timestamp,
        release_id: intent.release_id,
        preset_commitment: intent.preset_commitment,
        epoch: IRandomnessEpochsDispatcher { contract_address: submitter }.current_randomness_epoch(),
        root: context.raw_root,
    };
    ExecutionContext { envelope: encode_envelope(@envelope) }
}
#[generate_trait]
pub impl FixtureSeason of FixtureSeasonTrait {
    fn hash_intent(self: IGamesAuthenticationDispatcher, action: FixtureAction) -> felt252 {
        action_identity(@make_intent(self.contract_address, action))
    }
    fn execute(
        self: IGamesAuthenticationDispatcher, action: FixtureAction, context: DomainContext, signed: Span<felt252>,
    ) {
        IRecordedExecutionDispatcher { contract_address: self.contract_address }
            .execute(
                make_intent(self.contract_address, action),
                make_context(self.contract_address, action, context),
                signed,
            );
    }
}
#[generate_trait]
pub impl FixtureSafeSeason of FixtureSafeSeasonTrait {
    #[feature("safe_dispatcher")]
    fn execute(
        self: IGamesAuthenticationSafeDispatcher, action: FixtureAction, context: DomainContext, signed: Span<felt252>,
    ) -> Result<(), Array<felt252>> {
        IRecordedExecutionSafeDispatcher { contract_address: self.contract_address }
            .execute(
                make_intent(self.contract_address, action),
                make_context(self.contract_address, action, context),
                signed,
            )
    }
}
#[feature("safe_dispatcher")]
pub fn admission(season: ContractAddress, actor: ContractAddress) -> Result<Admission, Array<felt252>> {
    IRecordedExecutionViewsSafeDispatcher { contract_address: season }.get_admission(1, actor.into())
}

#[test]
fn definitive_execution_failure_consumes_only_its_ticket_then_successor_executes() {
    let d = super::setup(true);
    let action = super::intent(d, 1);
    let signed = super::signature(d, action);
    let authority = super::submitter();
    snforge_std::start_cheat_caller_address(authority, super::authority());
    ISequencingAuthorityDispatcher { contract_address: authority }.configure(d.games);
    snforge_std::start_cheat_caller_address(authority, authority);
    IRandomnessEpochsDispatcher { contract_address: authority }.open_randomness_epoch(epoch_commitment(123456));
    snforge_std::start_cheat_caller_address(authority, 0.try_into().unwrap());
    let original = make_context(d.games, action, super::context(d.games, 1));
    configure_submitter(authority, authority);
    let mut calldata = array![];
    make_intent(d.games, action).serialize(ref calldata);
    original.serialize(ref calldata);
    signed.serialize(ref calldata);
    ISequencingAccountDispatcher { contract_address: authority }
        .__execute__(
            array![
                starknet::account::Call {
                    to: d.games, selector: selector!("reject_execution"), calldata: calldata.span(),
                },
            ],
        );
    let view = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    assert_eq!(view.recorded_outcome(1, 1).unwrap().status, 2);
    assert_eq!(view.recorded_outcome(1, 1).unwrap().status_class, 'EXECUTION_FAILED');
    let season = IGamesAuthenticationDispatcher { contract_address: d.games };
    assert_eq!(season.next_nonce(1, d.actor), 1);
    assert_eq!(head(d.games, 1).order, 1);
    super::execute(d, FixtureAction { nonce: 1, ..action });
    assert_eq!(view.recorded_outcome(1, 2).unwrap().status, 1);
    assert_eq!(season.next_nonce(1, d.actor), 2);
}

#[test]
#[feature("safe_dispatcher")]
fn failure_recording_rejects_unauthenticated_and_already_executed_tickets() {
    let d = super::setup(true);
    let action = super::intent(d, 1);
    let signed = super::signature(d, action);
    let call = IRecordedExecutionFailureSafeDispatcher { contract_address: d.games };
    snforge_std::start_cheat_caller_address(d.games, d.actor);
    assert!(
        call
            .reject_execution(
                make_intent(d.games, action), make_context(d.games, action, super::context(d.games, 1)), signed,
            )
            .is_err(),
    );
    let season = IGamesAuthenticationDispatcher { contract_address: d.games };
    assert_eq!(head(d.games, 1).order, 0);
    assert_eq!(season.next_nonce(1, d.actor), 0);
    snforge_std::start_cheat_caller_address(d.games, super::submitter());
    let original = make_context(d.games, action, super::context(d.games, 1));
    super::execute(d, action);
    assert!(call.reject_execution(make_intent(d.games, action), original, signed).is_err());
    assert_eq!(head(d.games, 1).order, 1);
    assert_eq!(season.next_nonce(1, d.actor), 1);
    assert_eq!(
        IRecordedExecutionViewsDispatcher { contract_address: d.games }.recorded_outcome(1, 1).unwrap().status, 1,
    );
}

#[test]
#[feature("safe_dispatcher")]
fn transport_failure_after_account_upgrade_records_refusal_and_advances_without_nonce_consumption() {
    let d = super::setup(true);
    let views = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    let admitted = views.get_admission(1, d.actor.into());
    let action = super::intent(d, 1);
    let signed = super::signature(d, action);
    let retained_intent = make_intent(d.games, action);
    let retained_context = make_context(d.games, action, super::context(d.games, 1));
    let before = gameplay_snapshot(d.games);
    let upgraded = declare("AccountUpgradeFixture").unwrap().contract_class();
    super::fixtures::IAccountUpgradeDispatcherTrait::upgrade(
        super::fixtures::IAccountUpgradeDispatcher { contract_address: d.actor }, *upgraded.class_hash,
    );
    IRecordedExecutionFailureSafeDispatcher { contract_address: d.games }
        .reject_execution(retained_intent, retained_context, signed)
        .unwrap();
    let outcome = views.recorded_outcome(1, admitted.order).unwrap();
    assert_eq!(outcome.status, 2);
    assert_eq!(outcome.status_class, 'INVALID_ACTOR');
    assert!(!outcome.nonce_consumed);
    assert_eq!(views.get_head(1).order, admitted.order);
    assert_eq!(IGamesAuthenticationDispatcher { contract_address: d.games }.next_nonce(1, d.actor), admitted.nonce);
    assert_eq!(gameplay_snapshot(d.games), before);
    let (next_actor, _) = super::deploy_player(3, super::GUARDIAN);
    let next = super::Deployment { actor: next_actor, ..d };
    super::execute(next, super::intent(next, 1));
    assert_eq!(views.get_head(1).order, admitted.order + 1);
    assert_eq!(views.recorded_outcome(1, admitted.order + 1).unwrap().status, 1);
}

#[test]
fn unexecuted_ticket_recovery_preserves_original_context_after_delay() {
    let d = super::setup(true);
    let action = super::intent(d, 1);
    let signed = super::signature(d, action);
    let retained_intent = make_intent(d.games, action);
    let retained_context = make_context(d.games, action, super::context(d.games, 1));
    snforge_std::start_cheat_block_timestamp(d.games, 86400);
    IRecordedExecutionDispatcher { contract_address: d.games }.execute(retained_intent, retained_context, signed);
    let season = IGamesAuthenticationDispatcher { contract_address: d.games };
    assert_eq!(head(d.games, 1).timestamp, 100);
    assert_eq!(head(d.games, 1).order, 1);
    assert_eq!(season.next_nonce(1, d.actor), 1);
    assert_eq!(IFixtureDispatcher { contract_address: d.games }.received_root(), 987654321);
}

#[test]
fn oversized_command_is_terminal_and_the_next_ticket_executes() {
    let d = super::setup(true);
    let mut directions = array![];
    for _ in 1_u32..66 {
        directions.append(1_u8);
    }
    let action = FixtureAction {
        command: Command::Move(crate::commands::Move { explorer_id: 1, directions: directions.span() }),
        ..super::intent(d, 1),
    };
    super::execute(d, action);
    let view = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    assert_eq!(view.recorded_outcome(1, 1).unwrap().status, 2);
    assert_eq!(view.recorded_outcome(1, 1).unwrap().status_class, 'INVALID_COMMAND');
    let season = IGamesAuthenticationDispatcher { contract_address: d.games };
    assert_eq!(season.next_nonce(1, d.actor), 1);
    super::execute(d, FixtureAction { nonce: 1, ..super::intent(d, 1) });
    assert_eq!(view.recorded_outcome(1, 2).unwrap().status, 1);
    assert_eq!(season.next_nonce(1, d.actor), 2);
}

#[test]
fn command_item_bound_counts_items_not_their_serialized_fields() {
    let mut resources = array![];
    for resource_type in 1_u8..59 {
        resources.append(crate::resources::ResourceAmount { resource_type, amount: 1 });
    }
    let command = Command::BurnStructureResources(
        crate::resources::ResourceBurn { entity_id: 1, resources: resources.span() },
    );
    let mut fields = array![];
    command.serialize(ref fields);
    assert!(fields.len() > crate::commands::MAX_COMMAND_ITEMS);
    assert!(crate::commands::route_command(fields.span()).is_ok());

    let mut mine_ids = array![];
    for mine_id in 1_u32..65 {
        mine_ids.append(mine_id);
    }
    let command = Command::ClaimBitcoinPhase(crate::bitcoin::ClaimPhase { phase: 1, mine_ids: mine_ids.span() });
    let mut fields = array![];
    command.serialize(ref fields);
    assert!(crate::commands::route_command(fields.span()).is_ok());
    mine_ids.append(65);
    let command = Command::ClaimBitcoinPhase(crate::bitcoin::ClaimPhase { phase: 1, mine_ids: mine_ids.span() });
    let mut fields = array![];
    command.serialize(ref fields);
    assert_eq!(crate::commands::route_command(fields.span()).unwrap_err(), 'INVALID_COMMAND');
}

#[test]
fn nested_loot_lists_obey_the_shared_command_limit() {
    let mut loot = array![];
    for resource_type in 1_u8..66 {
        loot.append(crate::resources::ResourceAmount { resource_type, amount: 1 });
        if resource_type < 64 {
            continue;
        }
        let battle = Command::Battle(
            crate::combat_actions::AttackExplorer { attacker_id: 1, defender_id: 2, steal_resources: loot.span() },
        );
        let raid = Command::Raid(
            crate::combat_actions::Raid { explorer_id: 1, structure_id: 2, steal_resources: loot.span() },
        );
        for command in array![battle, raid] {
            let mut arguments = array![];
            command.serialize(ref arguments);
            let decoded = crate::commands::route_command(arguments.span());
            if resource_type == 64 {
                assert!(decoded.is_ok());
            } else {
                assert_eq!(decoded.unwrap_err(), 'INVALID_COMMAND');
            }
        }
    }
}

#[test]
fn oversized_battle_loot_is_terminal_before_gameplay_and_next_ticket_executes() {
    assert_oversized_loot_terminal(false);
}

#[test]
fn oversized_raid_loot_is_terminal_before_gameplay_and_next_ticket_executes() {
    assert_oversized_loot_terminal(true);
}

fn assert_oversized_loot_terminal(raid: bool) {
    let mut loot = array![];
    for resource_type in 1_u8..66 {
        loot.append(crate::resources::ResourceAmount { resource_type, amount: 1 });
    }
    let command = if raid {
        Command::Raid(crate::combat_actions::Raid { explorer_id: 1, structure_id: 2, steal_resources: loot.span() })
    } else {
        Command::Battle(
            crate::combat_actions::AttackExplorer { attacker_id: 1, defender_id: 2, steal_resources: loot.span() },
        )
    };
    let d = super::setup(true);
    super::execute(d, FixtureAction { command, ..super::intent(d, 1) });
    let view = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    assert_eq!(view.recorded_outcome(1, 1).unwrap().status_class, 'INVALID_COMMAND');
    assert_eq!(IFixtureDispatcher { contract_address: d.games }.received_root(), 0);
    super::execute(d, FixtureAction { nonce: 1, ..super::intent(d, 1) });
    assert_eq!(view.recorded_outcome(1, 2).unwrap().status, 1);
}

pub fn seed_game(registry: ContractAddress, game_id: u32, game: GameRegistry, rules: crate::rules::SliceRules) {
    snforge_std::interact_with_state(
        registry,
        || {
            let state = crate::state::write();
            state.game_releases.write(game_id, state.current_release.read());
            if state.registrar.presets.read(game.preset_id) == 0 {
                state.registrar.presets.write(game.preset_id, 789);
            }
        },
    );
    super::resource_commands::set_fixture(
        registry, selector!("games"), selector!("games"), array![game_id.into()].span(), game,
    );
    super::resource_commands::set_fixture(
        registry, selector!("games"), selector!("rules"), array![game_id.into()].span(), rules,
    );
    super::resource_commands::set_fixture(
        registry, selector!("games"), selector!("next_entity"), array![game_id.into()].span(), 1_u32,
    );
}

#[test]
fn release_admission_uses_the_game_pin_and_refusals_preserve_nonce_and_gameplay() {
    let d = super::setup(true);
    let view = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    let original = view.get_admission(1, d.actor.into());
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            state.releases.write(2, state.releases.read(1));
            state.current_release.write(2);
        },
    );
    let admission = view.get_admission(1, d.actor.into());
    assert_eq!(admission.release_id, original.release_id);
    assert_eq!(admission.preset_commitment, original.preset_commitment);
    let before = gameplay_snapshot(d.games);
    for (release_id, preset_commitment, reason) in array![
        (2, admission.preset_commitment, 'STALE_RELEASE'),
        (admission.release_id, admission.preset_commitment + 1, 'INVALID_PRESET'),
    ] {
        let mut intent = make_intent(d.games, super::intent(d, 1));
        intent.release_id = release_id;
        intent.preset_commitment = preset_commitment;
        let envelope = Envelope {
            action: action_identity(@intent),
            order: head(d.games, 1).order + 1,
            timestamp: 100,
            release_id,
            preset_commitment,
            epoch: 0,
            root: 987654321,
        };
        let device = super::keypair(12345);
        let (r, s) = device.sign(envelope.action).unwrap();
        IRecordedExecutionDispatcher { contract_address: d.games }
            .execute(
                intent,
                ExecutionContext { envelope: encode_envelope(@envelope) },
                array![device.public_key, r, s].span(),
            );
        let outcome = view.recorded_outcome(1, envelope.order).unwrap();
        assert_eq!(outcome.status_class, reason);
        assert!(!outcome.nonce_consumed);
        assert_eq!(view.get_admission(1, d.actor.into()).nonce, admission.nonce);
        assert_eq!(gameplay_snapshot(d.games), before);
    }
    super::execute(d, super::intent(d, 1));
    assert_eq!(view.recorded_outcome(1, 3).unwrap().status, 1);
    assert_eq!(view.get_admission(1, d.actor.into()).nonce, admission.nonce + 1);
}

pub(crate) fn gameplay_snapshot(games: ContractAddress) -> Array<felt252> {
    snforge_std::interact_with_state(
        games,
        || {
            let state = crate::state::read();
            let mut values = array![];
            state.games.games.read(1).serialize(ref values);
            state.games.rules.read(1).serialize(ref values);
            state.games.next_entity.read(1).serialize(ref values);
            crate::logic::troops::explorer(crate::troops::ExplorerKey { game_id: 1, explorer_id: 7 })
                .serialize(ref values);
            values
        },
    )
}

#[test]
#[feature("safe_dispatcher")]
fn transport_failure_records_a_bad_pin_and_allows_the_next_ticket() {
    let d = super::setup(true);
    let call = IRecordedExecutionFailureSafeDispatcher { contract_address: d.games };
    let views = IRecordedExecutionViewsDispatcher { contract_address: d.games };
    let before = gameplay_snapshot(d.games);
    let original = make_intent(d.games, super::intent(d, 1));
    for (release_id, preset_commitment) in array![
        (original.release_id + 1, original.preset_commitment), (original.release_id, original.preset_commitment + 1),
    ] {
        let original = make_intent(d.games, super::intent(d, 1));
        let intent = Intent {
            nonce: views.get_admission(1, d.actor.into()).nonce,
            release_id,
            preset_commitment,
            arguments: original.arguments.clone(),
            ..original,
        };
        let envelope = Envelope {
            action: action_identity(@intent),
            order: head(d.games, 1).order + 1,
            timestamp: 100,
            release_id,
            preset_commitment,
            epoch: 0,
            root: 987654321,
        };
        let device = super::keypair(12345);
        let (r, s) = device.sign(envelope.action).unwrap();
        assert!(
            call
                .reject_execution(
                    intent,
                    ExecutionContext { envelope: encode_envelope(@envelope) },
                    array![device.public_key, r, s].span(),
                )
                .is_ok(),
        );
        let outcome = views.recorded_outcome(1, envelope.order).unwrap();
        assert_eq!(outcome.status_class, 'EXECUTION_FAILED');
        assert!(outcome.nonce_consumed);
        assert_eq!(head(d.games, 1).order, envelope.order);
        assert_eq!(gameplay_snapshot(d.games), before);
    }
    super::execute(d, FixtureAction { nonce: 2, ..super::intent(d, 1) });
    assert_eq!(views.recorded_outcome(1, 3).unwrap().status, 1);
    assert_eq!(views.get_admission(1, d.actor.into()).nonce, 3);
}
