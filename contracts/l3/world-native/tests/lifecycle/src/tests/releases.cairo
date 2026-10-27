pub use world_test_support::tests::releases::*;


#[test]
#[feature("safe_dispatcher")]
fn fresh_shard_uses_the_published_release_without_running_its_upgrade_migration() {
    let d = super::registrar::setup();
    let authentication = IGamesAuthenticationDispatcher { contract_address: d.games }.authentication();
    let release = Release {
        migration: declare_logic("FailingReleaseMigrationFixture"),
        ..IReleasesDispatcher { contract_address: d.games }.release(1),
    };
    let mut args = array![authority().into(), authority().into()];
    authentication.serialize(ref args);
    args.append(7);
    release.serialize(ref args);
    super::append_vrf_configuration(ref args);
    let (games, _) = super::deploy("Games", @args);
    let releases = IReleasesDispatcher { contract_address: games };
    let safe = IReleasesSafeDispatcher { contract_address: games };
    assert_eq!(releases.current_release(), 7);
    assert_eq!(releases.release(7), release);
    assert!(safe.release(1).is_err());
    let registrar = IRegistrarDispatcher { contract_address: games };
    let preset = super::registrar::definition(true);
    start_cheat_caller_address(games, authority());
    registrar.register_preset(1, preset);
    let game_id = registrar.create_game(super::registrar::params(true));
    assert_eq!(releases.game_release(game_id), 7);
    releases.register_release(7, release);
    releases.apply_release(game_id, 7);
    assert_eq!(releases.game_release(game_id), 7);
}

#[test]
#[feature("safe_dispatcher")]
fn release_registration_is_authorized_immutable_and_pins_only_new_games() {
    let d = super::registrar::setup();
    let releases = IReleasesDispatcher { contract_address: d.games };
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    let registrar = IRegistrarDispatcher { contract_address: d.games };
    let preset = super::registrar::definition(true);
    let params = super::registrar::params(true);
    start_cheat_caller_address(d.games, authority());
    registrar.register_preset(1, preset);
    let first = registrar.create_game(params);
    let original = releases.release(1);
    let next = Release {
        classes: games_storage::release::LogicClasses { movement: declare_logic("TroopFixture"), ..original.classes },
        ..original,
    };
    start_cheat_caller_address(d.games, d.actor);
    assert!(safe.register_release(2, next).is_err());
    start_cheat_caller_address(d.games, authority());
    let missing_movement = Release {
        classes: games_storage::release::LogicClasses { movement: 0.try_into().unwrap(), ..original.classes },
        ..original,
    };
    assert!(safe.register_release(2, missing_movement).is_err());
    releases.register_release(2, next);
    assert_eq!(releases.current_release(), 2);
    assert_eq!(releases.game_release(first), 1);
    assert_eq!(registrar.create_game(params), first);
    let second = registrar.create_game(CreateGameParams { name: 'new-release', ..params });
    assert_eq!(releases.game_release(second), 2);
    let mut events = spy_events();
    releases.register_release(2, next);
    releases.register_release(1, original);
    assert_eq!(releases.current_release(), 2);
    assert!(events.get_events().emitted_by(d.games).events.is_empty());
    let error = safe.register_release(2, original).unwrap_err();
    let mut expected = array![core::byte_array::BYTE_ARRAY_MAGIC];
    let message: ByteArray = "release is immutable";
    message.serialize(ref expected);
    expected.append('ENTRYPOINT_FAILED');
    assert_eq!(error, expected);
    assert!(safe.register_release(0, original).is_err());
    assert!(safe.register_release(4, original).is_err());
    assert_eq!(releases.release(2), next);
}

#[test]
#[feature("safe_dispatcher")]
fn launcher_hotfix_migrates_a_populated_frontier_day_once_and_play_continues() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (first, second) = super::registrar::expedition_armies(d, game_id, category);
    let other = super::bind_authority(d);
    super::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![2].span(), 0x4000001_u32,
    );
    let other_home = ResourceKey {
        game_id,
        entity_id: interact_with_state(d.games, || crate::state::read().games.next_entity.read(game_id)).into(),
    };
    super::play_fixture::reserve_fixture_homes(d.games, game_id, other.actor);
    assert!(
        super::resource_commands::execute_in_game(
            other,
            game_id,
            crate::commands::Command::SettleSeason(crate::realms::SettleSeason { selected_realm: Some(2) }),
            351,
        ),
    );
    let home_state = crate::structures::IStructureOperationsDispatcher { contract_address: d.games }
        .structure(other_home)
        .unwrap();
    assert_eq!(home_state.owner, other.actor);
    assert_eq!(home_state.metadata.realm_id, 2);
    let guard = crate::guards::IGuardsDispatcherTrait::guard(
        crate::guards::IGuardsDispatcher { contract_address: d.games },
        crate::guards::GuardKey { game_id, structure_id: other_home.entity_id, slot: 0 },
    );
    assert!(
        super::resource_commands::execute_in_game(
            other,
            game_id,
            crate::commands::Command::CreateExplorer(
                crate::commands::CreateExplorer {
                    slot: 0,
                    structure_id: other_home.entity_id,
                    category: guard.troops.category.into(),
                    tier: 0,
                    amount: crate::rules::RESOURCE_PRECISION,
                    direction: 0,
                },
            ),
            351,
        ),
    );
    let third = ExplorerKey {
        game_id,
        explorer_id: *crate::structures::IStructureOperationsDispatcher { contract_address: d.games }
            .home_armies(other_home)
            .at(0),
    };
    let homes = array![ResourceKey { game_id, entity_id: 1 }, other_home].span();
    let armies = array![first, second, third].span();
    super::set_launcher(d, d.actor);
    let releases = IReleasesDispatcher { contract_address: d.games };
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    let games = IGameDispatcher { contract_address: d.games };
    let before = populated_facts(d, game_id, homes, armies);
    let seed = games.game(game_id).seed;
    start_cheat_caller_address(d.games, authority());
    releases
        .register_release(2, Release { migration: declare_logic("ReleaseMigrationFixture"), ..releases.release(1) });
    assert!(safe.apply_release(game_id, 2).is_err());
    assert_eq!(releases.game_release(game_id), 1);
    start_cheat_caller_address(d.games, d.actor);
    let mut events = spy_events();
    releases.apply_release(game_id, 2);
    assert_eq!(releases.game_release(game_id), 2);
    assert_eq!(games.game(game_id).seed, seed + 1);
    assert_eq!(populated_facts(d, game_id, homes, armies), before);
    let emitted = events.get_events().emitted_by(d.games);
    assert_eq!(emitted.events.len(), 2);
    let (_, pin) = emitted.events.at(0);
    assert_eq!(pin.keys.span(), array![selector!("GameEvent"), selector!("RowSet"), 1, 'GameRelease'].span());
    assert_eq!(pin.data.span(), array![1, game_id.into(), 3, 2, crate::presets::commitment(preset), 1].span());
    let mut repeated = spy_events();
    releases.apply_release(game_id, 2);
    assert!(repeated.get_events().emitted_by(d.games).events.is_empty());
    assert_eq!(games.game(game_id).seed, seed + 1);
    assert!(safe.apply_release(game_id, 1).is_err());
    assert!(safe.apply_release(game_id, 3).is_err());
    assert!(super::resource_commands::execute_in_game(d, game_id, super::registrar::transfer(first, second, 1), 352));
}

#[test]
#[feature("safe_dispatcher")]
fn failing_migration_rolls_back_pin_and_data() {
    let d = super::setup(true);
    let releases = IReleasesDispatcher { contract_address: d.games };
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    let games = IGameDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    releases
        .register_release(
            2, Release { migration: declare_logic("FailingReleaseMigrationFixture"), ..releases.release(1) },
        );
    let game = games.game(1);
    let release_fact = stored_release_fact(d.games, 1);
    // snforge syscall_hooks.rs appends spy events without revert truncation; verify their source storage instead.
    assert!(safe.apply_release(1, 2).is_err());
    assert_eq!(releases.game_release(1), 1);
    assert_eq!(games.game(1), game);
    assert_eq!(stored_release_fact(d.games, 1), release_fact);
}

#[test]
#[feature("safe_dispatcher")]
fn hotfix_refuses_old_release_pins_and_accepts_current_pins() {
    let d = super::setup(true);
    super::execute(d, super::action(d, 1));
    let action = super::play_fixture::TestAction {
        command: crate::commands::Command::CreateExplorer(
            crate::commands::CreateExplorer { slot: 0, structure_id: 8, category: 0, tier: 0, amount: 0, direction: 0 },
        ),
        ..super::action(d, 1),
    };
    let (old_release, commitment) = super::play_fixture::pins(d.games, 1);
    let releases = IReleasesDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    releases.register_release(2, releases.release(1));
    releases.apply_release(1, 2);
    let before = gameplay_facts(d.games);
    super::play_fixture::caller(d.games, d.actor, 100);
    let mut spy = spy_events();
    assert!(
        super::play_fixture::IPlayFixtureSafeDispatcherTrait::play_with_root(
            super::play_fixture::IPlayFixtureSafeDispatcher { contract_address: d.games },
            1,
            old_release,
            commitment,
            super::play_fixture::encode(action.command),
            987654321,
        )
            .is_err(),
    );
    assert_eq!(gameplay_facts(d.games), before);
    assert_eq!(super::play_fixture::pins(d.games, 1), (2, commitment));
    assert!(spy.get_events().emitted_by(d.games).events.is_empty());
    super::execute(d, action);
    assert!(GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: 1, explorer_id: 8 }).is_some());
}

#[test]
#[feature("safe_dispatcher")]
fn migrations_cannot_be_skipped_and_rollback_is_a_new_forward_release() {
    let d = super::setup(true);
    let releases = IReleasesDispatcher { contract_address: d.games };
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    let original = releases.release(1);
    let migration = Release { migration: declare_logic("ReleaseMigrationFixture"), ..original };
    releases.register_release(2, migration);
    releases.register_release(3, migration);
    let games = IGameDispatcher { contract_address: d.games };
    let before = games.game(1);
    let error = safe.apply_release(1, 3).unwrap_err();
    let mut expected = array![core::byte_array::BYTE_ARRAY_MAGIC];
    let message: ByteArray = "release must follow game pin";
    message.serialize(ref expected);
    expected.append('ENTRYPOINT_FAILED');
    assert_eq!(error, expected);
    assert_eq!(releases.game_release(1), 1);
    assert_eq!(games.game(1), before);
    releases.apply_release(1, 2);
    assert_eq!(games.game(1).seed, before.seed + 1);
    releases.apply_release(1, 3);
    assert_eq!(games.game(1).seed, before.seed + 11);
    releases.apply_release(1, 3);
    assert_eq!(games.game(1).seed, before.seed + 11);
    assert!(safe.apply_release(1, 2).is_err());
    releases.register_release(4, original);
    releases.apply_release(1, 4);
    assert_eq!(releases.game_release(1), 4);
    assert_eq!(releases.release(4), original);
    assert_eq!(games.game(1).seed, before.seed + 11);
}

#[test]
fn creation_release_survives_hotfixes_and_retried_launches() {
    let d = super::registrar::setup();
    let releases = IReleasesDispatcher { contract_address: d.games };
    let registrar = IRegistrarDispatcher { contract_address: d.games };
    let preset = super::registrar::definition(true);
    let params = super::registrar::params(true);
    start_cheat_caller_address(d.games, authority());
    registrar.register_preset(1, preset);
    let logic = releases.release(1);
    releases.register_release(2, logic);
    let existing = registrar.create_game(params);
    let legacy = registrar.create_game(CreateGameParams { name: 'before-origin', ..params });
    // Simulate a game created before this storage field existed.
    interact_with_state(d.games, || crate::state::write().game_creation_releases.write(legacy, 0));
    releases.register_release(3, logic);
    let next = registrar.create_game(CreateGameParams { name: 'next-season', ..params });
    releases.apply_release(existing, 3);
    releases.apply_release(legacy, 3);
    releases.register_release(4, logic);
    let mut spy = spy_events();
    for (game_id, created_release) in array![(existing, 2_u32), (legacy, 0), (next, 3)] {
        releases.apply_release(game_id, 4);
        assert_eq!(releases.game_release(game_id), 4);
        assert_eq!(
            interact_with_state(d.games, || crate::state::read().game_creation_releases.read(game_id)), created_release,
        );
    }
    let events = spy.get_events().emitted_by(d.games);
    assert_eq!(events.events.len(), 3);
    for (index, created_release) in array![(0_u32, 2_u32), (1, 0), (2, 3)] {
        let (_, pin) = events.events.at(index);
        assert_eq!(pin.keys.span(), array![selector!("GameEvent"), selector!("RowSet"), 1, 'GameRelease'].span());
        assert_eq!(*pin.data.at(2), 3);
        assert_eq!(*pin.data.at(3), 4);
        assert_eq!(*pin.data.at(5), created_release.into());
    }
    assert_eq!(registrar.create_game(params), existing);
    assert_eq!(interact_with_state(d.games, || crate::state::read().game_creation_releases.read(existing)), 2);
}
