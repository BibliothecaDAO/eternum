use recorded_receipts::RecordedReceiptsTrait;
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use crate::logic::release::{IReleasesDispatcher, IReleasesDispatcherTrait};
use crate::tests::state::{GameState, TroopObservationTrait};
mod bitcoin;
mod bridge;
mod combat_actions;
mod combat_formula;
mod entry;
mod fact_wire;
mod fixtures;
pub(crate) mod games_fixture;
mod games_host;
mod hyperstructures;
mod market;
mod mines;
mod packer_bound;
mod preset_projection;
mod production;
mod realms;
mod recorded;
mod registrar;
mod releases;
mod relics;
mod resource_commands;
mod resources;
mod rule_storage;
mod settlement;
mod shared_storage;
mod spatial_replay;
mod spires;
mod state;
mod structure_storage;
mod trade;
mod troop_management;
mod village;
use eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher;
use fixtures::{
    IFixtureDispatcher, IFixtureDispatcherTrait, IRollbackFixtureDispatcher, IRollbackFixtureDispatcherTrait,
};
use recorded::{
    FixtureAction as Intent, FixtureSafeSeasonTrait, FixtureSeasonTrait, configure_submitter, make_context, make_intent,
};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyTrait, EventsFilterTrait, declare, spy_events,
    start_cheat_block_timestamp, start_cheat_caller_address,
};
use starknet::{ClassHash, ContractAddress};
use crate::commands::{
    Command, CreateExplorer, ExecutionContext, ICreateExplorerSafeDispatcher, ICreateExplorerSafeDispatcherTrait,
};
use crate::game::IGameDispatcherTrait;
use crate::games::{
    IGamesAuthenticationDispatcher, IGamesAuthenticationDispatcherTrait, IGamesAuthenticationSafeDispatcher,
    IGamesAuthenticationSafeDispatcherTrait,
};
use crate::troops::ExplorerKey;
use crate::upgrades::{
    IUpgradeRulesDispatcher, IUpgradeRulesDispatcherTrait, IUpgradeRulesSafeDispatcher,
    IUpgradeRulesSafeDispatcherTrait, UpgradeLimits, UpgradeRecipe,
};

#[derive(Drop, Copy)]
struct Deployment {
    games: ContractAddress,
    actor: ContractAddress,
    account_class: ClassHash,
}

fn keypair(secret: felt252) -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(secret)
}
const GUARDIAN: felt252 = 98765;

fn player_address(realms_id: felt252) -> ContractAddress {
    crate::games::player_account_address(realms_id, declare_logic("AccountFixture"), GUARDIAN)
}
fn deploy_player(realms_id: felt252, guardian: felt252) -> (ContractAddress, ClassHash) {
    let class = declare_logic("AccountFixture");
    let address = crate::games::player_account_address(realms_id, class, guardian);
    if starknet::syscalls::get_class_hash_at_syscall(address).unwrap() == 0.try_into().unwrap() {
        let (deployed, _) = starknet::syscalls::deploy_syscall(
            class, realms_id, array![realms_id, guardian].span(), true,
        )
            .unwrap();
        assert_eq!(deployed, address);
    }
    (address, class)
}
fn authority() -> ContractAddress {
    player_address(2)
}
fn submitter() -> ContractAddress {
    0x222.try_into().unwrap()
}
fn deploy(name: ByteArray, calldata: @Array<felt252>) -> (ContractAddress, ClassHash) {
    let class = declare(name).unwrap().contract_class();
    let (address, _) = class.deploy(calldata).unwrap();
    (address, *class.class_hash)
}
fn setup(seed_games: bool) -> Deployment {
    setup_with_structures(seed_games, "MapLogic")
}
fn setup_with_structures(seed_games: bool, structures_class: ByteArray) -> Deployment {
    setup_with_domains(seed_games, structures_class, "TroopFixture")
}
pub fn bind_authority(d: Deployment) -> Deployment {
    deploy_player(2, GUARDIAN);
    Deployment { actor: authority(), ..d }
}

fn declare_logic(name: ByteArray) -> ClassHash {
    *declare(name).unwrap().contract_class().class_hash
}

fn setup_with_domains(seed_games: bool, structures_class: ByteArray, troops_class: ByteArray) -> Deployment {
    setup_with_host(seed_games, structures_class, troops_class, "GamesTest")
}
fn setup_with_host(
    seed_games: bool, structures_class: ByteArray, troops_class: ByteArray, host: ByteArray,
) -> Deployment {
    recorded::deploy_submitter(submitter());
    let (actor, account_class) = deploy_player(1, GUARDIAN);
    let movement = if troops_class == "TroopFixture" {
        declare_logic("TroopFixture")
    } else {
        declare_logic("MovementLogic")
    };
    let classes = games_storage::release::LogicClasses {
        season: declare_logic("SeasonLogic"),
        map: declare_logic("MapLogic"),
        placement: declare_logic("PlacementLogic"),
        construction: declare_logic("ConstructionLogic"),
        production: declare_logic("ProductionLogic"),
        structures: declare_logic(structures_class),
        troops: declare_logic(troops_class),
        settlement: declare_logic("SettlementLogic"),
        resources: declare_logic("ResourcesLogic"),
        economy: declare_logic("EconomyLogic"),
        prizes: declare_logic("PrizesLogic"),
        registry: declare_logic("RegistryLogic"),
        combat: declare_logic("CombatLogic"),
        raid: declare_logic("RaidLogic"),
        bridge: declare_logic("BridgeLogic"),
        relics: declare_logic("RelicsLogic"),
        movement,
    };
    let authentication = crate::games::Authentication {
        submitter: submitter(), account_class, guardian_public_key: GUARDIAN,
    };
    let mut calldata = array![authority().into()];
    authentication.serialize(ref calldata);
    calldata.append(1);
    classes.serialize(ref calldata);
    calldata.append(0);
    let (games, _) = deploy(host, @calldata);
    if seed_games {
        recorded::create_games(games, authority());
    }
    configure_submitter(games, submitter());
    start_cheat_caller_address(games, submitter());
    start_cheat_block_timestamp(games, 100);
    Deployment { games, actor, account_class }
}

fn intent(deployment: Deployment, game_id: u32) -> Intent {
    Intent {
        game_id,
        actor: deployment.actor,
        nonce: 0,
        deadline: 200,
        command: Command::CreateExplorer(
            CreateExplorer { structure_id: 7, category: 0, tier: 0, amount: 0, direction: 0 },
        ),
    }
}
fn story_cursor() -> crate::ownership::StoryCursor {
    crate::ownership::StoryCursor { order: 1, index: 0 }
}

fn context(games: ContractAddress, game_id: u32) -> ExecutionContext {
    snforge_std::interact_with_state(
        games,
        || {
            let state = crate::state::read();
            ExecutionContext {
                raw_root: 987654321,
                timestamp: 100,
                game: BoxTrait::new(state.games.games.read(game_id)),
                rules: BoxTrait::new(crate::logic::game::rules(game_id)),
            }
        },
    )
}
/// The actor's device signature, `[device_key, r, s]`, as the shard's account class checks it.
fn signature(deployment: Deployment, action: Intent) -> Span<felt252> {
    let device = keypair(12345);
    let (r, s) = device
        .sign(IGamesAuthenticationDispatcher { contract_address: deployment.games }.hash_intent(action))
        .unwrap();
    array![device.public_key, r, s].span()
}
fn execute(deployment: Deployment, action: Intent) {
    let signed = signature(deployment, action);
    IGamesAuthenticationDispatcher { contract_address: deployment.games }
        .execute(action, context(deployment.games, action.game_id), signed);
}

#[test]
fn player_address_matches_the_shared_identity_encoder() {
    // starknet.js calculateContractAddressFromHash(456, 123, [456, 789], 0).
    let expected: ContractAddress = 0x407fc15527567765913410f7bd285549b7fc2cd7cd2ad7016d8a7f40ffd37e2
        .try_into()
        .unwrap();
    assert_eq!(crate::games::player_account_address(456, 123.try_into().unwrap(), 789), expected);
}

#[test]
fn initializer_refuses_a_zero_guardian() {
    let deployment = setup(true);
    let authentication = crate::games::Authentication {
        guardian_public_key: 0,
        ..IGamesAuthenticationDispatcher { contract_address: deployment.games }.authentication(),
    };
    let release = IReleasesDispatcher { contract_address: deployment.games }.release(1);
    let mut calldata = array![authority().into()];
    authentication.serialize(ref calldata);
    calldata.append(1);
    release.serialize(ref calldata);
    assert!(declare("Games").unwrap().contract_class().deploy(@calldata).is_err());
}

#[test]
fn signed_actor_and_root_reach_domain_with_game_scoped_nonces() {
    let deployment = setup(true);
    execute(deployment, intent(deployment, 1));
    execute(deployment, intent(deployment, 2));
    let gateway = IGamesAuthenticationDispatcher { contract_address: deployment.games };
    assert_eq!(gateway.next_nonce(1, deployment.actor), 1);
    assert_eq!(gateway.next_nonce(2, deployment.actor), 1);
    let troops = IFixtureDispatcher { contract_address: deployment.games };
    assert_eq!(troops.received_actor(), deployment.actor);
    assert_eq!(troops.received_root(), context(deployment.games, 1).raw_root);
    assert!(
        GameState { contract_address: deployment.games }.explorer(ExplorerKey { game_id: 1, explorer_id: 7 }).is_some(),
    );
    assert!(
        GameState { contract_address: deployment.games }.explorer(ExplorerKey { game_id: 2, explorer_id: 7 }).is_some(),
    );
}

#[test]
#[feature("safe_dispatcher")]
fn forged_signature_actor_game_and_replayed_intent_are_rejected() {
    let deployment = setup(true);
    let action = intent(deployment, 1);
    let signed = signature(deployment, action);
    let gateway = IGamesAuthenticationSafeDispatcher { contract_address: deployment.games };
    let unknown = keypair(999);
    let (unknown_r, unknown_s) = unknown
        .sign(IGamesAuthenticationDispatcher { contract_address: deployment.games }.hash_intent(action))
        .unwrap();
    let results = IRecordedExecutionViewsDispatcher { contract_address: deployment.games };
    gateway
        .execute(action, context(deployment.games, 1), array![unknown.public_key, unknown_r, unknown_s].span())
        .unwrap();
    assert_eq!(results.recorded_outcome(1, 1).unwrap().status_class, 'INVALID_SIGNATURE');
    let mut forged = action;
    forged.actor = 0x999.try_into().unwrap();
    gateway.execute(forged, context(deployment.games, 1), signed).unwrap();
    assert_eq!(results.recorded_outcome(1, 2).unwrap().status_class, 'INVALID_ACTOR');
    forged = action;
    forged.game_id = 2;
    gateway.execute(forged, context(deployment.games, 1), signed).unwrap();
    // The forged game's action is recorded on that game's own chain.
    assert_eq!(results.recorded_outcome(2, 1).unwrap().status_class, 'INVALID_SIGNATURE');
    assert!(!results.recorded_outcome(1, 1).unwrap().nonce_consumed);
    assert!(!results.recorded_outcome(1, 2).unwrap().nonce_consumed);
    assert!(!results.recorded_outcome(2, 1).unwrap().nonce_consumed);
    assert_eq!(
        IGamesAuthenticationDispatcher { contract_address: deployment.games }.next_nonce(1, deployment.actor), 0,
    );
    let successor = action;
    let signed = signature(deployment, successor);
    gateway.execute(successor, context(deployment.games, 1), signed).unwrap();
    assert_eq!(results.recorded_outcome(1, 3).unwrap().status, 1);
    gateway.execute(successor, context(deployment.games, 1), signed).unwrap();
    assert_eq!(results.recorded_outcome(1, 4).unwrap().status_class, 'STALE_NONCE');
    assert_eq!(
        IGamesAuthenticationDispatcher { contract_address: deployment.games }.next_nonce(1, deployment.actor), 1,
    );
}

#[test]
#[feature("safe_dispatcher")]
fn direct_player_submission_and_forged_domain_calls_are_rejected() {
    let deployment = setup_with_host(true, "MapLogic", "TroopFixture", "Games");
    let action = intent(deployment, 1);
    let signed = signature(deployment, action);
    start_cheat_caller_address(deployment.games, deployment.actor);
    assert!(
        IGamesAuthenticationSafeDispatcher { contract_address: deployment.games }
            .execute(action, context(deployment.games, 1), signed)
            .is_err(),
    );
    start_cheat_caller_address(deployment.games, deployment.actor);
    let Command::CreateExplorer(command) = action.command else {
        panic!("wrong command")
    };
    assert!(
        ICreateExplorerSafeDispatcher { contract_address: deployment.games }
            .create_explorer(
                1,
                deployment.actor,
                command,
                crate::commands::action_context(context(deployment.games, 1)),
                crate::tests::story_cursor(),
            )
            .is_err(),
    );
    assert!(
        starknet::syscalls::call_contract_syscall(
            deployment.games, selector!("reveal"), array![1, 0, 12, 34, 11].span(),
        )
            .is_err(),
    );
}

#[test]
#[feature("safe_dispatcher")]
fn late_domain_failure_consumes_ticket_and_rolls_back_gameplay_rows() {
    let deployment = setup(true);
    let action = intent(deployment, 1);
    let signed = signature(deployment, action);
    let (wrapper, _) = deploy("RollbackFixture", @array![]);
    let success = IRollbackFixtureDispatcher { contract_address: wrapper }
        .attempt(
            deployment.games,
            make_intent(deployment.games, action),
            make_context(
                deployment.games,
                action,
                ExecutionContext { raw_root: 0, timestamp: 100, ..crate::tests::context(deployment.games, 1) },
            ),
            signed,
        );
    assert!(success);
    assert_eq!(
        IGamesAuthenticationDispatcher { contract_address: deployment.games }.next_nonce(1, deployment.actor), 1,
    );
    assert!(
        GameState { contract_address: deployment.games }.explorer(ExplorerKey { game_id: 1, explorer_id: 7 }).is_none(),
    );
    assert_eq!(IFixtureDispatcher { contract_address: deployment.games }.received_root(), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn signatures_are_bound_to_deployment_command_nonce_and_deadline() {
    let first = setup(true);
    let second = setup(true);
    let action = intent(first, 1);
    let signed = signature(first, action);
    let gateway = IGamesAuthenticationSafeDispatcher { contract_address: first.games };
    let results = IRecordedExecutionViewsDispatcher { contract_address: first.games };
    let mut changed = action;
    changed.command = Command::CloseSeason;
    gateway.execute(changed, context(first.games, 1), signed).unwrap();
    assert_eq!(results.recorded_outcome(1, 1).unwrap().status_class, 'INVALID_SIGNATURE');
    changed = action;
    changed.nonce = 1;
    gateway.execute(changed, context(first.games, 1), signed).unwrap();
    assert_eq!(results.recorded_outcome(1, 2).unwrap().status_class, 'INVALID_SIGNATURE');
    changed = action;
    assert!(!results.recorded_outcome(1, 1).unwrap().nonce_consumed);
    assert!(!results.recorded_outcome(1, 2).unwrap().nonce_consumed);
    changed.deadline = 99;
    gateway.execute(changed, context(first.games, 1), signature(first, changed)).unwrap();
    assert_eq!(results.recorded_outcome(1, 3).unwrap().status_class, 'INVALID_ACCEPTANCE');
    assert!(
        gateway
            .execute(
                action,
                ExecutionContext { raw_root: 1, timestamp: 101, ..crate::tests::context(first.games, 1) },
                signed,
            )
            .is_err(),
    );
    // Both deployments use the same test key; address binding still changes the digest.
    assert!(
        IGamesAuthenticationDispatcher { contract_address: second.games }
            .hash_intent(action) != IGamesAuthenticationDispatcher { contract_address: first.games }
            .hash_intent(action),
    );
    assert_eq!(IGamesAuthenticationDispatcher { contract_address: first.games }.next_nonce(1, first.actor), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn registered_account_with_unapproved_class_is_rejected_before_key_read() {
    let d = setup(true);
    let actor = d.actor;
    let season = d.games;
    let wrong_class = declare("BankTokenFixture").unwrap().contract_class();
    fixtures::IAccountUpgradeDispatcherTrait::upgrade(
        fixtures::IAccountUpgradeDispatcher { contract_address: actor }, *wrong_class.class_hash,
    );
    let error = recorded::admission(season, actor).unwrap_err();
    assert_eq!(error.span(), array!['INVALID_ACTOR', 'ENTRYPOINT_FAILED'].span());
    assert_eq!(IGamesAuthenticationDispatcher { contract_address: season }.next_nonce(1, actor), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn recorded_context_survives_outage_and_rejects_future_time() {
    let deployment = setup(true);
    let mut action = intent(deployment, 1);
    action.deadline = 100;
    let signed = signature(deployment, action);
    let gateway = IGamesAuthenticationSafeDispatcher { contract_address: deployment.games };
    start_cheat_block_timestamp(deployment.games, 99);
    assert!(gateway.execute(action, context(deployment.games, 1), signed).is_err());
    start_cheat_block_timestamp(deployment.games, 86500);
    gateway.execute(action, context(deployment.games, 1), signed).unwrap();
    let troops = IFixtureDispatcher { contract_address: deployment.games };
    assert_eq!(troops.received_timestamp(), 100);
    assert_eq!(troops.received_root(), context(deployment.games, 1).raw_root);
    assert_eq!(
        IGamesAuthenticationDispatcher { contract_address: deployment.games }.next_nonce(1, deployment.actor), 1,
    );
}

#[test]
#[feature("safe_dispatcher")]
fn authority_rotates_authentication_without_replacing_the_domain() {
    let deployment = setup(true);
    let gateway = IGamesAuthenticationDispatcher { contract_address: deployment.games };
    let safe = IGamesAuthenticationSafeDispatcher { contract_address: deployment.games };
    let previous = gateway.authentication();
    let replacement = crate::games::Authentication { submitter: 0x777.try_into().unwrap(), ..previous };
    assert!(safe.set_authentication(replacement.submitter, replacement.account_class).is_err());
    start_cheat_caller_address(deployment.games, authority());
    gateway.set_authentication(replacement.submitter, replacement.account_class);
    let current = gateway.authentication();
    assert_eq!(current.submitter, replacement.submitter);
    assert_eq!(current.account_class, previous.account_class);
    assert_eq!(current.guardian_public_key, previous.guardian_public_key);
    recorded::deploy_submitter(replacement.submitter);
    let action = intent(deployment, 1);
    let signed = signature(deployment, action);
    start_cheat_caller_address(deployment.games, submitter());
    assert!(safe.execute(action, context(deployment.games, 1), signed).is_err());
    configure_submitter(deployment.games, replacement.submitter);
    start_cheat_caller_address(deployment.games, replacement.submitter);
    gateway.execute(action, context(deployment.games, action.game_id), signed);
    assert_eq!(gateway.next_nonce(1, deployment.actor), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn in_place_player_account_upgrade_is_refused_without_execution_or_nonce_consumption() {
    let deployment = setup(true);
    let season = IGamesAuthenticationDispatcher { contract_address: deployment.games };
    let action = intent(deployment, 1);
    let signed = signature(deployment, action);
    let before = recorded::gameplay_snapshot(deployment.games);
    let class = declare("AccountUpgradeFixture").unwrap().contract_class();
    fixtures::IAccountUpgradeDispatcherTrait::upgrade(
        fixtures::IAccountUpgradeDispatcher { contract_address: deployment.actor }, *class.class_hash,
    );
    assert_eq!(
        recorded::admission(deployment.games, deployment.actor).unwrap_err().span(),
        array!['INVALID_ACTOR', 'ENTRYPOINT_FAILED'].span(),
    );
    season.execute(action, context(deployment.games, action.game_id), signed);
    assert_eq!(
        IRecordedExecutionViewsDispatcher { contract_address: deployment.games }
            .recorded_outcome(1, 1)
            .unwrap()
            .status_class,
        'INVALID_ACTOR',
    );
    assert_eq!(season.next_nonce(1, deployment.actor), 0);
    assert_eq!(recorded::gameplay_snapshot(deployment.games), before);
    start_cheat_caller_address(deployment.games, authority());
    let safe = IGamesAuthenticationSafeDispatcher { contract_address: deployment.games };
    assert!(safe.set_authentication(submitter(), *class.class_hash).is_err());
    assert_eq!(season.authentication().account_class, deployment.account_class);
}

#[test]
#[feature("safe_dispatcher")]
fn foreign_guardian_is_refused_before_signature_without_gameplay_or_nonce_consumption() {
    let deployment = setup(true);
    let (foreign, _) = deploy_player(1, GUARDIAN + 1);
    let foreign_deployment = Deployment { actor: foreign, ..deployment };
    let action = intent(foreign_deployment, 1);
    let before = recorded::gameplay_snapshot(deployment.games);
    assert_eq!(
        recorded::admission(deployment.games, foreign).unwrap_err().span(),
        array!['FOREIGN_GUARDIAN', 'ENTRYPOINT_FAILED'].span(),
    );
    // An invalid signature cannot hide the earlier guardian refusal.
    let season = IGamesAuthenticationDispatcher { contract_address: deployment.games };
    season.execute(action, context(deployment.games, 1), array![].span());
    assert_eq!(
        IRecordedExecutionViewsDispatcher { contract_address: deployment.games }
            .recorded_outcome(1, 1)
            .unwrap()
            .status_class,
        'FOREIGN_GUARDIAN',
    );
    assert_eq!(season.next_nonce(1, foreign), 0);
    assert_eq!(recorded::gameplay_snapshot(deployment.games), before);
    execute(deployment, intent(deployment, 1));
    assert_eq!(season.next_nonce(1, deployment.actor), 1);
}


#[test]
#[feature("safe_dispatcher")]
fn admission_rejects_a_non_account_and_authentication_row_keeps_its_shape() {
    let deployment = setup(true);
    assert!(recorded::admission(deployment.games, 0x999.try_into().unwrap()).is_err());
    let season = IGamesAuthenticationDispatcher { contract_address: deployment.games };
    let authentication = season.authentication();
    start_cheat_caller_address(deployment.games, authority());
    let mut spy = spy_events();
    season.set_authentication(authentication.submitter, authentication.account_class);
    let events = spy.get_events().emitted_by(deployment.games);
    assert_eq!(events.events.len(), 1);
    let (_, event) = events.events.at(0);
    assert_eq!(event.keys.span(), array![selector!("RowSet"), 1, 'Authentication'].span());
    assert_eq!(
        event.data.span(),
        array![
            1, deployment.games.into(), 3, authentication.submitter.into(), authentication.account_class.into(),
            authentication.guardian_public_key,
        ]
            .span(),
    );
}


#[test]
#[feature("safe_dispatcher")]
fn upgrade_rules_are_immutable_complete_and_game_scoped() {
    let deployment = setup(true);
    let settlement = deployment.games;
    let rules = IUpgradeRulesDispatcher { contract_address: settlement };
    let safe = IUpgradeRulesSafeDispatcher { contract_address: settlement };
    let limits = UpgradeLimits { realm_max: 1, village_max: 0 };
    let recipes = array![
        UpgradeRecipe { costs: array![crate::resources::ResourceAmount { resource_type: 23, amount: 17 }].span() },
    ]
        .span();
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: settlement };
    let mut preset = recorded::fixture_preset(recorded::rules());
    preset.structures.upgrade_limits = limits;
    preset.structures.upgrades = recipes;
    start_cheat_caller_address(settlement, deployment.actor);
    assert!(crate::registrar::IRegistrarSafeDispatcherTrait::register_preset(registrar, 20000, preset).is_err());
    start_cheat_caller_address(settlement, authority());
    let mut invalid = preset;
    invalid.structures.upgrades = array![].span();
    assert!(crate::registrar::IRegistrarSafeDispatcherTrait::register_preset(registrar, 20000, invalid).is_err());
    let games = crate::game::IGameDispatcher { contract_address: settlement };
    recorded::seed_game_with_preset(settlement, 1, games.game(1), preset);
    assert_eq!(rules.upgrade_limits(1), limits);
    assert_eq!(rules.upgrade_recipe(1, 1), *recipes.at(0));
    start_cheat_caller_address(settlement, authority());
    assert!(
        crate::registrar::IRegistrarSafeDispatcherTrait::register_preset(registrar, games.game(1).preset_id, preset)
            .is_err(),
    );
    assert!(safe.upgrade_recipe(1, 2).is_err());
    preset.structures.upgrade_limits = UpgradeLimits { realm_max: 0, village_max: 0 };
    preset.structures.upgrades = array![].span();
    recorded::seed_game_with_preset(settlement, 2, games.game(2), preset);
    assert_eq!(rules.upgrade_limits(1), limits);
    assert_eq!(rules.upgrade_limits(2).realm_max, 0);
    assert!(safe.upgrade_limits(999).is_err());
}


mod artificer;

mod blitz_results;

mod building_commands;
mod camps;

mod faith;

mod guilds;

mod random_vectors;

mod recorded_receipts;

mod season_lifecycle;

mod structure_rules;

mod test_conformance;

#[test]
fn row_set_member_and_deleted_have_exact_wire_shapes_and_zero_is_present() {
    let deployment = setup(true);
    let mut spy = spy_events();
    execute(deployment, intent(deployment, 1));
    let fixture = IFixtureDispatcher { contract_address: deployment.games };
    let key = ExplorerKey { game_id: 1, explorer_id: 7 };
    let mut explorer = GameState { contract_address: deployment.games }.explorer(key).unwrap();
    assert_eq!(explorer.troops.count, 0);
    let mut values = array![];
    crate::troops::ExplorerRecordTrait::into_record(explorer).serialize(ref values);
    let events = spy.get_events().emitted_by(deployment.games);
    let mut matched = array![];
    for (address, event) in events.events {
        if event.keys.span() == array![selector!("TroopEvent"), selector!("RowSet"), 1, 'ExplorerTroops'].span() {
            matched.append((address, event));
        }
    }
    assert_eq!(matched.len(), 1);
    let (_, event) = matched.at(0);
    assert_eq!(event.keys.span(), array![selector!("TroopEvent"), selector!("RowSet"), 1, 'ExplorerTroops'].span());
    let mut expected = array![2, 1, 7, values.len().into()];
    expected.append_span(values.span());
    assert_eq!(event.data.span(), expected.span());
    let mut spy = spy_events();
    explorer.troops.count = 25;
    fixture.update_troops(key, explorer.troops);
    fixture.destroy(key);
    let events = spy.get_events().emitted_by(deployment.games);
    assert_eq!(events.events.len(), 3);
    let (_, member) = events.events.at(0);
    let (_, occupancy_deleted) = events.events.at(1);
    assert_eq!(
        occupancy_deleted.keys.span(),
        array![selector!("MapEvent"), selector!("RowDeleted"), 1, 'TileOccupancy'].span(),
    );
    assert_eq!(occupancy_deleted.data.span(), array![4, 1, 0, 12, 34].span());
    let (_, deleted) = events.events.at(2);
    assert_eq!(
        member.keys.span(),
        array![selector!("TroopEvent"), selector!("RowMemberSet"), 1, 'ExplorerTroops', 'troops'].span(),
    );
    let mut troop_values = array![];
    explorer.troops.serialize(ref troop_values);
    let mut expected = array![2, 1, 7, troop_values.len().into()];
    expected.append_span(troop_values.span());
    assert_eq!(member.data.span(), expected.span());
    assert_eq!(
        deleted.keys.span(), array![selector!("TroopEvent"), selector!("RowDeleted"), 1, 'ExplorerTroops'].span(),
    );
    assert_eq!(deleted.data.span(), array![2, 1, 7].span());
    assert!(GameState { contract_address: deployment.games }.explorer(key).is_none());
    let mut action = intent(deployment, 1);
    action.nonce = 1;
    execute(deployment, action);
    assert_eq!(GameState { contract_address: deployment.games }.explorer(key).unwrap().troops.count, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn games_reinitialization_is_rejected_without_changing_authentication_or_state() {
    let deployment = setup_with_host(true, "MapLogic", "TroopFixture", "Games");
    let entry = IGamesAuthenticationDispatcher { contract_address: deployment.games };
    let authentication = entry.authentication();
    let classes = snforge_std::interact_with_state(
        deployment.games,
        || {
            let state = crate::state::read();
            state.releases.read(state.current_release.read()).classes
        },
    );
    let mut calldata = array![deployment.actor.into()];
    authentication.serialize(ref calldata);
    calldata.append(1);
    classes.serialize(ref calldata);
    calldata.append(0);
    start_cheat_caller_address(deployment.games, authority());
    assert!(
        starknet::syscalls::call_contract_syscall(deployment.games, selector!("constructor"), calldata.span()).is_err(),
    );
    assert!(
        starknet::syscalls::call_contract_syscall(deployment.games, selector!("initializer"), calldata.span()).is_err(),
    );
    start_cheat_caller_address(deployment.games, deployment.actor);
    let safe = IGamesAuthenticationSafeDispatcher { contract_address: deployment.games };
    assert!(safe.set_authentication(deployment.actor, authentication.account_class).is_err());
    let after = entry.authentication();
    assert_eq!(after.submitter, authentication.submitter);
    assert_eq!(after.account_class, authentication.account_class);
    assert_eq!(entry.next_nonce(1, deployment.actor), 0);
}

#[generate_trait]
impl StoryResultTestImpl<T> of StoryResultTestTrait<T> {
    fn story_result(self: (T, crate::ownership::StoryCursor)) -> T {
        let (result, _) = self;
        result
    }
}
