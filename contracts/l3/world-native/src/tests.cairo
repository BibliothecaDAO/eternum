mod fixtures;
mod production;
mod realms;
mod recorded;
mod resource_commands;
mod resources;
mod rule_storage;
mod settlement;
mod structure_storage;
mod village;
use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionViewsDispatcher, IRecordedExecutionViewsDispatcherTrait,
};
use fixtures::{
    IFixtureDispatcher, IFixtureDispatcherTrait, IRollbackFixtureDispatcher, IRollbackFixtureDispatcherTrait,
    IUpgradeFixtureDispatcher, IUpgradeFixtureDispatcherTrait,
};
use recorded::{
    FixtureAction as Intent, FixtureSafeSeasonTrait, FixtureSeasonTrait, configure_submitter, make_context, make_intent,
};
use snforge_std::signature::stark_curve::{StarkCurveKeyPair, StarkCurveKeyPairImpl, StarkCurveSignerImpl};
use snforge_std::signature::{KeyPairTrait, SignerTrait};
use snforge_std::{
    ContractClassTrait, DeclareResultTrait, EventSpyTrait, EventsFilterTrait, declare, spy_events,
    start_cheat_block_timestamp, start_cheat_caller_address, stop_cheat_caller_address,
};
use starknet::{ClassHash, ContractAddress};
use crate::commands::{
    Command, CreateExplorer, ExecutionContext, ITroopCommandsSafeDispatcher, ITroopCommandsSafeDispatcherTrait,
};
use crate::lifecycle::{
    IDomainDispatcher, IDomainDispatcherTrait, IDomainSafeDispatcher, IDomainSafeDispatcherTrait, Peers,
};
use crate::map::{IMapDispatcher, IMapDispatcherTrait, IMapSafeDispatcher, IMapSafeDispatcherTrait, TileKey};
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait, ISeasonSafeDispatcher, ISeasonSafeDispatcherTrait};
use crate::troops::ExplorerKey;
use crate::upgrades::{
    IUpgradeRulesDispatcher, IUpgradeRulesDispatcherTrait, IUpgradeRulesSafeDispatcher,
    IUpgradeRulesSafeDispatcherTrait, UpgradeLimits, UpgradeRecipe,
};

#[derive(Drop, Copy)]
struct Deployment {
    peers: Peers,
    actor: ContractAddress,
    account_class: ClassHash,
}

fn keypair(secret: felt252) -> StarkCurveKeyPair {
    KeyPairTrait::from_secret_key(secret)
}
fn authority() -> ContractAddress {
    0x111.try_into().unwrap()
}
fn submitter() -> ContractAddress {
    0x222.try_into().unwrap()
}
fn deploy(name: ByteArray, calldata: @Array<felt252>) -> (ContractAddress, ClassHash) {
    let class = declare(name).unwrap().contract_class();
    let (address, _) = class.deploy(calldata).unwrap();
    (address, *class.class_hash)
}
fn setup(activate: bool) -> Deployment {
    setup_with_structures(activate, "MapDomain")
}
fn setup_with_structures(activate: bool, structures_class: ByteArray) -> Deployment {
    setup_with_domains(activate, structures_class, "TroopFixture")
}
fn setup_with_domains(activate: bool, structures_class: ByteArray, troops_class: ByteArray) -> Deployment {
    let pair = keypair(12345);
    recorded::deploy_submitter(submitter());
    let (actor, account_class) = deploy("AccountFixture", @array![pair.public_key]);
    let (registry, _) = deploy("RegistryFixture", @array![0x333, actor.into()]);
    let (season, _) = deploy(
        "SeasonDomain", @array![authority().into(), submitter().into(), registry.into(), account_class.into()],
    );
    let (map, _) = deploy("MapDomain", @array![authority().into()]);
    let (structures, _) = deploy(structures_class, @array![authority().into()]);
    let (troops, _) = deploy(troops_class, @array![authority().into()]);
    let (settlement, _) = deploy("SettlementDomain", @array![authority().into()]);
    let (resources, _) = deploy("ResourcesDomain", @array![authority().into()]);
    let peers = Peers { season, map, structures, troops, settlement, resources };
    for address in array![season, map, structures, troops, settlement, resources] {
        start_cheat_caller_address(address, authority());
        IDomainDispatcher { contract_address: address }.configure(peers);
    }
    if activate {
        for address in array![season, map, structures, troops, settlement, resources] {
            IDomainDispatcher { contract_address: address }.activate();
        }
    }
    for address in array![season, map, structures, troops, settlement, resources] {
        stop_cheat_caller_address(address);
    }
    if activate {
        recorded::create_games(season, authority());
    }
    configure_submitter(season, submitter());
    start_cheat_caller_address(season, submitter());
    start_cheat_block_timestamp(season, 100);
    Deployment { peers, actor, account_class }
}
fn intent(deployment: Deployment, game_id: u32) -> Intent {
    Intent {
        game_id,
        rules: recorded::rules(),
        actor: deployment.actor,
        nonce: 0,
        deadline: 200,
        command: Command::CreateExplorer(
            CreateExplorer { structure_id: 7, category: 0, tier: 0, amount: 0, direction: 0 },
        ),
    }
}
fn context() -> ExecutionContext {
    ExecutionContext { raw_root: 987654321, timestamp: 100 }
}
fn signature(deployment: Deployment, action: Intent) -> (felt252, felt252) {
    keypair(12345).sign(ISeasonDispatcher { contract_address: deployment.peers.season }.hash_intent(action)).unwrap()
}
fn execute(deployment: Deployment, action: Intent) {
    let (r, s) = signature(deployment, action);
    ISeasonDispatcher { contract_address: deployment.peers.season }.execute(action, context(), r, s);
}

#[test]
fn signed_actor_and_root_reach_domain_with_game_scoped_nonces() {
    let deployment = setup(true);
    execute(deployment, intent(deployment, 1));
    execute(deployment, intent(deployment, 2));
    let gateway = ISeasonDispatcher { contract_address: deployment.peers.season };
    assert_eq!(gateway.next_nonce(1, deployment.actor), 1);
    assert_eq!(gateway.next_nonce(2, deployment.actor), 1);
    let troops = IFixtureDispatcher { contract_address: deployment.peers.troops };
    assert_eq!(troops.received_actor(), deployment.actor);
    assert_eq!(troops.received_root(), context().raw_root);
    assert!(troops.explorer(ExplorerKey { game_id: 1, explorer_id: 7 }).is_some());
    assert!(troops.explorer(ExplorerKey { game_id: 2, explorer_id: 7 }).is_some());
}

#[test]
#[feature("safe_dispatcher")]
fn forged_signature_actor_game_and_replayed_intent_are_rejected() {
    let deployment = setup(true);
    let action = intent(deployment, 1);
    let (r, s) = signature(deployment, action);
    let gateway = ISeasonSafeDispatcher { contract_address: deployment.peers.season };
    let (bad_r, bad_s) = keypair(999)
        .sign(ISeasonDispatcher { contract_address: deployment.peers.season }.hash_intent(action))
        .unwrap();
    let results = IRecordedExecutionViewsDispatcher { contract_address: deployment.peers.season };
    gateway.execute(action, context(), bad_r, bad_s).unwrap();
    assert_eq!(results.get_result(1).result, 'INVALID_SIGNATURE');
    let mut forged = action;
    forged.actor = 0x999.try_into().unwrap();
    gateway.execute(forged, context(), r, s).unwrap();
    assert_eq!(results.get_result(2).result, 'INVALID_SIGNATURE');
    forged = action;
    forged.game_id = 2;
    gateway.execute(forged, context(), r, s).unwrap();
    assert_eq!(results.get_result(3).result, 'INVALID_SIGNATURE');
    let mut successor = action;
    successor.nonce = 1;
    let (r, s) = signature(deployment, successor);
    gateway.execute(successor, context(), r, s).unwrap();
    assert_eq!(results.get_result(4).status, 1);
    gateway.execute(successor, context(), r, s).unwrap();
    assert_eq!(results.get_result(5).result, 'STALE_NONCE');
    assert_eq!(ISeasonDispatcher { contract_address: deployment.peers.season }.next_nonce(1, deployment.actor), 2);
}

#[test]
#[feature("safe_dispatcher")]
fn direct_player_submission_and_forged_domain_calls_are_rejected() {
    let deployment = setup(true);
    let action = intent(deployment, 1);
    let (r, s) = signature(deployment, action);
    start_cheat_caller_address(deployment.peers.season, deployment.actor);
    assert!(
        ISeasonSafeDispatcher { contract_address: deployment.peers.season }.execute(action, context(), r, s).is_err(),
    );
    start_cheat_caller_address(deployment.peers.troops, deployment.actor);
    let Command::CreateExplorer(command) = action.command else {
        panic!("wrong command")
    };
    assert!(
        ITroopCommandsSafeDispatcher { contract_address: deployment.peers.troops }
            .create_explorer(1, deployment.actor, command, context())
            .is_err(),
    );
    start_cheat_caller_address(deployment.peers.map, deployment.actor);
    assert!(
        IMapSafeDispatcher { contract_address: deployment.peers.map }
            .reveal(TileKey { game_id: 1, alt: false, col: 12, row: 34 }, 11)
            .is_err(),
    );
}

#[test]
#[feature("safe_dispatcher")]
fn late_domain_failure_consumes_ticket_and_rolls_back_gameplay_rows() {
    let deployment = setup(true);
    let action = intent(deployment, 1);
    let (r, s) = signature(deployment, action);
    let (wrapper, _) = deploy("RollbackFixture", @array![]);
    let success = IRollbackFixtureDispatcher { contract_address: wrapper }
        .attempt(
            deployment.peers.season,
            make_intent(deployment.peers.season, action),
            make_context(deployment.peers.season, action, ExecutionContext { raw_root: 0, timestamp: 100 }),
            r,
            s,
        );
    assert!(success);
    assert_eq!(ISeasonDispatcher { contract_address: deployment.peers.season }.next_nonce(1, deployment.actor), 1);
    assert!(
        IFixtureDispatcher { contract_address: deployment.peers.troops }
            .explorer(ExplorerKey { game_id: 1, explorer_id: 7 })
            .is_none(),
    );
    assert_eq!(IFixtureDispatcher { contract_address: deployment.peers.troops }.received_root(), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn gameplay_before_activation_and_reinitialization_are_rejected() {
    let deployment = setup(false);
    let action = intent(deployment, 1);
    let (r, s) = signature(deployment, action);
    assert!(
        ISeasonSafeDispatcher { contract_address: deployment.peers.season }.execute(action, context(), r, s).is_err(),
    );
    start_cheat_caller_address(deployment.peers.season, authority());
    assert!(IDomainSafeDispatcher { contract_address: deployment.peers.season }.configure(deployment.peers).is_err());
}

#[test]
fn row_set_member_and_deleted_have_exact_wire_shapes_and_zero_is_present() {
    let deployment = setup(true);
    let mut spy = spy_events();
    execute(deployment, intent(deployment, 1));
    let fixture = IFixtureDispatcher { contract_address: deployment.peers.troops };
    let key = ExplorerKey { game_id: 1, explorer_id: 7 };
    let mut explorer = fixture.explorer(key).unwrap();
    assert_eq!(explorer.troops.count, 0);
    let mut values = array![];
    explorer.serialize(ref values);
    let events = spy.get_events().emitted_by(deployment.peers.troops);
    assert_eq!(events.events.len(), 1);
    let (_, event) = events.events.at(0);
    assert_eq!(event.keys.span(), array![selector!("TroopEvent"), selector!("RowSet"), 1, 'ExplorerTroops'].span());
    let mut expected = array![2, 1, 7, values.len().into()];
    expected.append_span(values.span());
    assert_eq!(event.data.span(), expected.span());
    let mut spy = spy_events();
    explorer.troops.count = 25;
    fixture.update_troops(key, explorer.troops);
    fixture.destroy(key);
    let events = spy.get_events().emitted_by(deployment.peers.troops);
    assert_eq!(events.events.len(), 2);
    let (_, member) = events.events.at(0);
    let (_, deleted) = events.events.at(1);
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
    assert!(fixture.explorer(key).is_none());
    let mut action = intent(deployment, 1);
    action.nonce = 1;
    execute(deployment, action);
    assert_eq!(fixture.explorer(key).unwrap().troops.count, 0);
}

#[test]
fn append_only_replace_class_preserves_and_mutates_existing_tiles() {
    let deployment = setup(true);
    start_cheat_caller_address(deployment.peers.map, deployment.peers.troops);
    let map = IMapDispatcher { contract_address: deployment.peers.map };
    let key = TileKey { game_id: 1, alt: false, col: 12, row: 34 };
    let other_game = TileKey { game_id: 2, alt: true, col: 12, row: 34 };
    map.reveal(key, 11);
    map.reveal(other_game, 17);
    map.occupy(key, 7, 15, false);
    let before = map.tile(key).unwrap();
    let other_before = map.tile(other_game).unwrap();
    let class = declare("MapUpgradeFixture").unwrap().contract_class();
    start_cheat_caller_address(deployment.peers.map, authority());
    IDomainDispatcher { contract_address: deployment.peers.map }.upgrade(*class.class_hash);
    assert_eq!(starknet::syscalls::get_class_hash_at_syscall(deployment.peers.map).unwrap(), *class.class_hash);
    assert_eq!(map.tile(key).unwrap(), before);
    assert_eq!(map.tile(other_game).unwrap(), other_before);
    let upgrade = IUpgradeFixtureDispatcher { contract_address: deployment.peers.map };
    assert_eq!(upgrade.revision(), 0);
    upgrade.set_revision(2);
    assert_eq!(upgrade.revision(), 2);
    start_cheat_caller_address(deployment.peers.map, deployment.peers.troops);
    map.vacate(key, 7);
    map.occupy(key, 8, 16, false);
    assert_eq!(map.tile(key).unwrap().data, before.data + 514);
    assert_eq!(map.tile(other_game).unwrap(), other_before);
}

#[test]
#[feature("safe_dispatcher")]
fn signatures_are_bound_to_deployment_command_nonce_and_deadline() {
    let first = setup(true);
    let second = setup(true);
    let action = intent(first, 1);
    let (r, s) = signature(first, action);
    let gateway = ISeasonSafeDispatcher { contract_address: first.peers.season };
    let results = IRecordedExecutionViewsDispatcher { contract_address: first.peers.season };
    let mut changed = action;
    changed.command = Command::ClaimProduction(7);
    gateway.execute(changed, context(), r, s).unwrap();
    assert_eq!(results.get_result(1).result, 'INVALID_SIGNATURE');
    changed = action;
    changed.nonce = 1;
    gateway.execute(changed, context(), r, s).unwrap();
    assert_eq!(results.get_result(2).result, 'INVALID_SIGNATURE');
    changed = action;
    changed.nonce = 2;
    changed.deadline = 99;
    let (expired_r, expired_s) = signature(first, changed);
    gateway.execute(changed, context(), expired_r, expired_s).unwrap();
    assert_eq!(results.get_result(3).result, 'INVALID_ACCEPTANCE');
    assert!(gateway.execute(action, ExecutionContext { raw_root: 1, timestamp: 101 }, r, s).is_err());
    // Both deployments use the same test key; address binding still changes the digest.
    assert!(
        ISeasonDispatcher { contract_address: second.peers.season }
            .hash_intent(action) != ISeasonDispatcher { contract_address: first.peers.season }
            .hash_intent(action),
    );
    assert_eq!(ISeasonDispatcher { contract_address: first.peers.season }.next_nonce(1, first.actor), 3);
}

#[test]
#[feature("safe_dispatcher")]
fn registered_account_with_unapproved_class_is_rejected_before_key_read() {
    let pair = keypair(12345);
    let (actor, _) = deploy("AccountFixture", @array![pair.public_key]);
    let (registry, _) = deploy("RegistryFixture", @array![0x333, actor.into()]);
    let wrong_class = declare("MapUpgradeFixture").unwrap().contract_class();
    let (season, _) = deploy(
        "SeasonDomain",
        @array![authority().into(), submitter().into(), registry.into(), (*wrong_class.class_hash).into()],
    );
    let (map, _) = deploy("MapDomain", @array![authority().into()]);
    let (structures, _) = deploy("MapDomain", @array![authority().into()]);
    let (troops, _) = deploy("TroopFixture", @array![authority().into()]);
    let (settlement, _) = deploy("SettlementDomain", @array![authority().into()]);
    let (resources, _) = deploy("ResourcesDomain", @array![authority().into()]);
    let peers = Peers { season, map, structures, troops, settlement, resources };
    for address in array![season, map, structures, troops, settlement, resources] {
        start_cheat_caller_address(address, authority());
        IDomainDispatcher { contract_address: address }.configure(peers);
    }
    IDomainDispatcher { contract_address: season }.activate();
    start_cheat_caller_address(season, submitter());
    start_cheat_block_timestamp(season, 100);
    recorded::create_games(season, authority());
    let error = recorded::admission(season, actor).unwrap_err();
    assert_eq!(
        snforge_std::byte_array::try_deserialize_bytearray_error(error.span()).unwrap(), "unapproved gameplay account",
    );
    assert_eq!(ISeasonDispatcher { contract_address: season }.next_nonce(1, actor), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn recorded_context_survives_outage_and_rejects_future_time() {
    let deployment = setup(true);
    let mut action = intent(deployment, 1);
    action.deadline = 100;
    let (r, s) = signature(deployment, action);
    let gateway = ISeasonSafeDispatcher { contract_address: deployment.peers.season };
    start_cheat_block_timestamp(deployment.peers.season, 99);
    assert!(gateway.execute(action, context(), r, s).is_err());
    start_cheat_block_timestamp(deployment.peers.season, 86500);
    gateway.execute(action, context(), r, s).unwrap();
    let troops = IFixtureDispatcher { contract_address: deployment.peers.troops };
    assert_eq!(troops.received_timestamp(), 100);
    assert_eq!(troops.received_root(), context().raw_root);
    assert_eq!(ISeasonDispatcher { contract_address: deployment.peers.season }.next_nonce(1, deployment.actor), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn authority_rotates_authentication_without_replacing_the_domain() {
    let deployment = setup(true);
    let gateway = ISeasonDispatcher { contract_address: deployment.peers.season };
    let safe = ISeasonSafeDispatcher { contract_address: deployment.peers.season };
    let previous = gateway.authentication();
    let replacement = crate::season::Authentication { submitter: 0x777.try_into().unwrap(), ..previous };
    assert!(safe.set_authentication(replacement.submitter, replacement.registry, replacement.account_class).is_err());
    start_cheat_caller_address(deployment.peers.season, authority());
    gateway.set_authentication(replacement.submitter, replacement.registry, replacement.account_class);
    let current = gateway.authentication();
    assert_eq!(current.submitter, replacement.submitter);
    assert_eq!(current.registry, previous.registry);
    assert_eq!(current.account_class, previous.account_class);
    let action = intent(deployment, 1);
    let (r, s) = signature(deployment, action);
    start_cheat_caller_address(deployment.peers.season, submitter());
    assert!(safe.execute(action, context(), r, s).is_err());
    recorded::deploy_submitter(replacement.submitter);
    configure_submitter(deployment.peers.season, replacement.submitter);
    start_cheat_caller_address(deployment.peers.season, replacement.submitter);
    gateway.execute(action, context(), r, s);
    assert_eq!(gateway.next_nonce(1, deployment.actor), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn agent_controller_requires_authority_and_projects_the_new_address() {
    let deployment = setup(true);
    let gateway = ISeasonDispatcher { contract_address: deployment.peers.season };
    let safe = ISeasonSafeDispatcher { contract_address: deployment.peers.season };
    let game = crate::game::IGameDispatcher { contract_address: deployment.peers.season };
    assert_eq!(crate::game::IGameDispatcherTrait::agent_controller(game), 0.try_into().unwrap());
    assert!(safe.set_agent_controller(0x777.try_into().unwrap()).is_err());
    start_cheat_caller_address(deployment.peers.season, authority());
    let mut spy = spy_events();
    gateway.set_agent_controller(0x777.try_into().unwrap());
    let events = spy.get_events().emitted_by(deployment.peers.season);
    assert_eq!(events.events.len(), 1);
    let (_, event) = events.events.at(0);
    assert_eq!(event.keys.span(), array![selector!("RowSet"), 1, 'AgentController'].span());
    assert_eq!(event.data.span(), array![1, deployment.peers.season.into(), 1, 0x777].span());
    assert_eq!(crate::game::IGameDispatcherTrait::agent_controller(game), 0x777.try_into().unwrap());
}

#[test]
#[feature("safe_dispatcher")]
fn approved_account_class_can_follow_a_player_account_upgrade() {
    let deployment = setup(true);
    let season = ISeasonDispatcher { contract_address: deployment.peers.season };
    let class = declare("AccountUpgradeFixture").unwrap().contract_class();
    fixtures::IAccountUpgradeDispatcherTrait::upgrade(
        fixtures::IAccountUpgradeDispatcher { contract_address: deployment.actor }, *class.class_hash,
    );
    let action = intent(deployment, 1);
    let (r, s) = signature(deployment, action);
    assert!(recorded::admission(deployment.peers.season, deployment.actor).is_err());
    let authentication = crate::season::Authentication { account_class: *class.class_hash, ..season.authentication() };
    start_cheat_caller_address(deployment.peers.season, authority());
    season.set_authentication(authentication.submitter, authentication.registry, authentication.account_class);
    start_cheat_caller_address(deployment.peers.season, submitter());
    assert!(recorded::admission(deployment.peers.season, deployment.actor).is_ok());
    season.execute(action, context(), r, s);
    assert_eq!(season.next_nonce(1, deployment.actor), 1);
}

#[test]
#[feature("safe_dispatcher")]
fn admission_rejects_unregistered_actor_and_registry_round_trip_mismatch() {
    let deployment = setup(true);
    assert!(recorded::admission(deployment.peers.season, 0x999.try_into().unwrap()).is_err());
    let season = ISeasonDispatcher { contract_address: deployment.peers.season };
    let (registry, _) = deploy("RegistryRoundTripFixture", @array![]);
    let authentication = season.authentication();
    start_cheat_caller_address(deployment.peers.season, authority());
    let mut spy = spy_events();
    season.set_authentication(authentication.submitter, registry, authentication.account_class);
    let events = spy.get_events().emitted_by(deployment.peers.season);
    assert_eq!(events.events.len(), 1);
    let (_, event) = events.events.at(0);
    assert_eq!(event.keys.span(), array![selector!("RowSet"), 1, 'Authentication'].span());
    assert_eq!(
        event.data.span(),
        array![
            1, deployment.peers.season.into(), 3, authentication.submitter.into(), registry.into(),
            authentication.account_class.into(),
        ]
            .span(),
    );
    assert!(recorded::admission(deployment.peers.season, deployment.actor).is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn map_rejects_foreign_occupancy_commands_and_duplicate_mutations() {
    let deployment = setup(true);
    let address = deployment.peers.map;
    let map = IMapDispatcher { contract_address: address };
    let safe = IMapSafeDispatcher { contract_address: address };
    let key = TileKey { game_id: 1, alt: false, col: 12, row: 34 };
    start_cheat_caller_address(address, deployment.peers.troops);
    map.reveal(key, 11);
    let revealed = map.tile(key).unwrap();
    assert!(safe.reveal(key, 12).is_err());
    assert_eq!(map.tile(key).unwrap(), revealed);
    start_cheat_caller_address(address, deployment.actor);
    assert!(safe.occupy(key, 7, 15, false).is_err());
    assert_eq!(map.tile(key).unwrap(), revealed);
    start_cheat_caller_address(address, deployment.peers.troops);
    map.occupy(key, 7, 15, false);
    let occupied = map.tile(key).unwrap();
    assert!(safe.occupy(key, 8, 16, false).is_err());
    start_cheat_caller_address(address, deployment.actor);
    assert!(safe.vacate(key, 7).is_err());
    assert_eq!(map.tile(key).unwrap(), occupied);
}

#[test]
#[feature("safe_dispatcher")]
fn activation_rejects_peer_mismatch_authority_mismatch_and_double_activation() {
    for wrong_authority in array![false, true] {
        let (season, _) = deploy("MapDomain", @array![authority().into()]);
        let other_authority: ContractAddress = if wrong_authority {
            0x999.try_into().unwrap()
        } else {
            authority()
        };
        let (map, _) = deploy("MapDomain", @array![other_authority.into()]);
        let (structures, _) = deploy("MapDomain", @array![authority().into()]);
        let (troops, _) = deploy("MapDomain", @array![authority().into()]);
        let (settlement, _) = deploy("SettlementDomain", @array![authority().into()]);
        let (resources, _) = deploy("ResourcesDomain", @array![authority().into()]);
        let peers = Peers { season, map, structures, troops, settlement, resources };
        for address in array![season, structures, troops, settlement] {
            start_cheat_caller_address(address, authority());
            IDomainDispatcher { contract_address: address }.configure(peers);
        }
        start_cheat_caller_address(map, other_authority);
        let map_peers = if wrong_authority {
            peers
        } else {
            Peers { structures: troops, troops: structures, ..peers }
        };
        IDomainDispatcher { contract_address: map }.configure(map_peers);
        let error = IDomainSafeDispatcher { contract_address: season }.activate().unwrap_err();
        let expected = if wrong_authority {
            "authority mismatch"
        } else {
            "peer mismatch"
        };
        assert_eq!(snforge_std::byte_array::try_deserialize_bytearray_error(error.span()).unwrap(), expected);
        assert!(!IDomainDispatcher { contract_address: season }.domain_state().active);
    }
    let deployment = setup(true);
    start_cheat_caller_address(deployment.peers.season, authority());
    assert!(IDomainSafeDispatcher { contract_address: deployment.peers.season }.activate().is_err());
}

#[test]
#[feature("safe_dispatcher")]
fn upgrade_rules_are_immutable_complete_and_game_scoped() {
    let deployment = setup(true);
    let season = deployment.peers.season;
    let rules = IUpgradeRulesDispatcher { contract_address: season };
    let safe = IUpgradeRulesSafeDispatcher { contract_address: season };
    let limits = UpgradeLimits { realm_max: 1, village_max: 0 };
    let recipes = array![
        UpgradeRecipe { costs: array![crate::resources::ResourceAmount { resource_type: 23, amount: 17 }].span() },
    ]
        .span();
    assert!(safe.upgrade_limits(1).is_err());
    assert!(safe.configure_upgrades(1, limits, recipes).is_err());
    start_cheat_caller_address(season, authority());
    assert!(safe.configure_upgrades(1, limits, array![].span()).is_err());
    assert!(safe.upgrade_limits(1).is_err());
    rules.configure_upgrades(1, limits, recipes);
    assert_eq!(rules.upgrade_limits(1), limits);
    assert_eq!(rules.upgrade_recipe(1, 1), *recipes.at(0));
    assert!(safe.configure_upgrades(1, limits, recipes).is_err());
    assert!(safe.upgrade_limits(2).is_err());
    assert!(safe.upgrade_recipe(1, 2).is_err());
    rules.configure_upgrades(2, UpgradeLimits { realm_max: 0, village_max: 0 }, array![].span());
    assert_eq!(rules.upgrade_limits(1), limits);
    assert_eq!(rules.upgrade_limits(2).realm_max, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn realm_upgrade_changes_only_its_display_and_rejects_foreign_occupants() {
    let deployment = setup(true);
    let address = deployment.peers.map;
    let map = IMapDispatcher { contract_address: address };
    let safe = IMapSafeDispatcher { contract_address: address };
    let key = TileKey { game_id: 1, alt: false, col: 12, row: 34 };
    start_cheat_caller_address(address, deployment.peers.structures);
    map.reveal(key, 11);
    map.occupy(key, 7, 1, true);
    let before = map.tile(key).unwrap();
    start_cheat_caller_address(address, deployment.peers.troops);
    assert!(safe.upgrade_realm(key, 7, false, 1).is_err());
    start_cheat_caller_address(address, deployment.peers.structures);
    assert!(safe.upgrade_realm(key, 8, false, 1).is_err());
    assert_eq!(map.tile(key).unwrap(), before);
    map.upgrade_realm(key, 7, false, 1);
    assert_eq!(map.tile(key).unwrap().data, before.data + 2);
    map.upgrade_realm(key, 7, true, 3);
    assert_eq!(map.tile(key).unwrap().data, before.data + 14);
    assert!(safe.vacate(key, 7).is_err());
}

mod building_commands;
