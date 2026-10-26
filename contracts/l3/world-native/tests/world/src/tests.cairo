pub use world_test_support::tests::*;


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
    let mut preset = play_fixture::fixture_preset(play_fixture::rules());
    preset.structures.upgrade_limits = limits;
    preset.structures.upgrades = recipes;
    start_cheat_caller_address(settlement, deployment.actor);
    assert!(crate::registrar::IRegistrarSafeDispatcherTrait::register_preset(registrar, 20000, preset).is_err());
    start_cheat_caller_address(settlement, authority());
    let mut invalid = preset;
    invalid.structures.upgrades = array![].span();
    assert!(crate::registrar::IRegistrarSafeDispatcherTrait::register_preset(registrar, 20000, invalid).is_err());
    let games = crate::game::IGameDispatcher { contract_address: settlement };
    play_fixture::seed_game_with_preset(settlement, 1, games.game(1), preset);
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
    play_fixture::seed_game_with_preset(settlement, 2, games.game(2), preset);
    assert_eq!(rules.upgrade_limits(1), limits);
    assert_eq!(rules.upgrade_limits(2).realm_max, 0);
    assert!(safe.upgrade_limits(999).is_err());
}

#[test]
fn row_set_member_and_deleted_have_exact_wire_shapes_and_zero_is_present() {
    let deployment = setup(true);
    let mut spy = spy_events();
    execute(deployment, action(deployment, 1));
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
    execute(deployment, action(deployment, 1));
    assert_eq!(GameState { contract_address: deployment.games }.explorer(key).unwrap().troops.count, 0);
}

#[test]
fn player_address_matches_the_shared_identity_encoder() {
    let expected: ContractAddress = 0x407fc15527567765913410f7bd285549b7fc2cd7cd2ad7016d8a7f40ffd37e2
        .try_into()
        .unwrap();
    assert_eq!(crate::games::player_account_address(456, 123.try_into().unwrap(), 789), expected);
}

#[test]
fn initializer_refuses_zero_owner_launcher_class_and_guardian() {
    let d = setup(true);
    let authentication = IGamesAuthenticationDispatcher { contract_address: d.games }.authentication();
    let release = IReleasesDispatcher { contract_address: d.games }.release(1);
    for field in 0_u32..4 {
        let owner = if field == 0 {
            0
        } else {
            authority().into()
        };
        let launcher = if field == 1 {
            0
        } else {
            authority().into()
        };
        let mut args = array![owner, launcher];
        crate::games::Authentication {
            account_class: if field == 2 {
                0.try_into().unwrap()
            } else {
                authentication.account_class
            },
            guardian_public_key: if field == 3 {
                0
            } else {
                authentication.guardian_public_key
            },
        }
            .serialize(ref args);
        args.append(1);
        release.serialize(ref args);
        append_vrf_configuration(ref args);
        assert!(declare("Games").unwrap().contract_class().deploy(@args).is_err());
    }
}

#[test]
fn direct_actor_root_and_block_time_reach_each_game_domain() {
    let d = setup(true);
    for game_id in array![1, 2] {
        assert!(play_fixture::play(d.games, action(d, game_id), 987654321, 123));
        let fixture = IFixtureDispatcher { contract_address: d.games };
        assert_eq!(fixture.received_actor(), d.actor);
        assert_eq!(fixture.received_root(), 987654321);
        assert_eq!(fixture.received_timestamp(), 123);
        assert!(GameState { contract_address: d.games }.explorer(ExplorerKey { game_id, explorer_id: 7 }).is_some());
    }
}

#[test]
#[feature("safe_dispatcher")]
fn a_domain_refuses_a_context_carried_for_another_game() {
    let d = setup(true);
    let Command::CreateExplorer(command) = action(d, 1).command else {
        panic!("wrong command")
    };
    let troops = ICreateExplorerSafeLibraryDispatcher { class_hash: declare_logic("TroopFixture") };
    let explorer = ExplorerKey { game_id: 1, explorer_id: 7 };
    let foreign = crate::commands::action_context(ExecutionContext { raw_root: 5, ..context(d.games, 2) });
    let refused = snforge_std::interact_with_state(
        d.games, || troops.create_explorer(1, d.actor, command, foreign).unwrap_err(),
    );
    assert_eq!(crate::commands::domain_rejection(refused).reason, "context of another game");
    assert!(GameState { contract_address: d.games }.explorer(explorer).is_none());
    let own = crate::commands::action_context(ExecutionContext { raw_root: 5, ..context(d.games, 1) });
    snforge_std::interact_with_state(d.games, || troops.create_explorer(1, d.actor, command, own).unwrap());
    assert_eq!(IFixtureDispatcher { contract_address: d.games }.received_root(), 5);
    assert!(GameState { contract_address: d.games }.explorer(explorer).is_some());
}

#[test]
#[feature("safe_dispatcher")]
fn indirect_or_zero_caller_is_rejected_before_root() {
    let d = setup(true);
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    for caller in array![authority(), 0.try_into().unwrap()] {
        start_cheat_caller_address(d.games, caller);
        assert_entry_refusal(
            d, 1, release, preset, play_fixture::encode(action(d, 1).command), "direct account required",
        );
    }
}

#[test]
#[feature("safe_dispatcher")]
fn account_upgrade_and_non_account_are_rejected_before_identity_read() {
    let d = setup(true);
    let (release, preset) = play_fixture::pins(d.games, 1);
    fixtures::IAccountUpgradeDispatcherTrait::upgrade(
        fixtures::IAccountUpgradeDispatcher { contract_address: d.actor }, declare_logic("AccountUpgradeFixture"),
    );
    play_fixture::caller(d.games, d.actor, 100);
    assert_entry_refusal(d, 1, release, preset, play_fixture::encode(action(d, 1).command), "unapproved account class");
    let (non_account, _) = deploy("BankTokenFixture", @array![d.actor.into()]);
    play_fixture::caller(d.games, non_account, 100);
    assert_entry_refusal(d, 1, release, preset, play_fixture::encode(action(d, 1).command), "unapproved account class");
}

#[test]
#[feature("safe_dispatcher")]
fn foreign_guardian_is_rejected_before_root() {
    let d = setup(true);
    let (actor, _) = deploy_player(3, GUARDIAN + 1);
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, actor, 100);
    assert_entry_refusal(d, 1, release, preset, play_fixture::encode(action(d, 1).command), "foreign guardian");
}

#[test]
#[feature("safe_dispatcher")]
fn invalid_game_release_and_preset_are_rejected_without_gameplay() {
    let d = setup(true);
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    let command = play_fixture::encode(action(d, 1).command);
    for game_id in array![0, 999] {
        assert_entry_refusal(d, game_id, release, preset, command, "invalid game");
    }
    assert_entry_refusal(d, 1, release + 1, preset, command, "stale release");
    assert_entry_refusal(d, 1, release, preset + 1, command, "invalid preset");
}

#[test]
#[feature("safe_dispatcher")]
fn malformed_commands_are_rejected_before_root() {
    let d = setup(true);
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    let mut trailing = array![];
    action(d, 1).command.serialize(ref trailing);
    trailing.append(0);
    for command in array![array![].span(), array![999].span(), array![0].span(), trailing.span()] {
        let mut spy = spy_events();
        assert!(
            IPlayFixtureSafeDispatcher { contract_address: d.games }
                .play_with_root(1, release, preset, command, 987654321)
                .is_err(),
        );
        assert_eq!(play_fixture::pins(d.games, 1), (release, preset));
        assert!(spy.get_events().emitted_by(d.games).events.is_empty());
    }
}

#[test]
#[feature("safe_dispatcher")]
fn production_play_refuses_a_missing_stamp_and_exposes_no_domain_routes() {
    let verifier = declare_logic("Verifier");
    assert_eq!(verifier, crate::vrf_class::VRF_VERIFIER_CLASS_HASH.try_into().unwrap());
    let d = setup_with_host(true, "MapLogic", "TroopFixture", "Games");
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    let mut spy = spy_events();
    assert!(
        IGamesPlaySafeDispatcher { contract_address: d.games }
            .play(1, release, preset, play_fixture::encode(action(d, 1).command))
            .is_err(),
    );
    assert!(spy.get_events().emitted_by(d.games).events.is_empty());
    assert!(GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: 1, explorer_id: 7 }).is_none());
    let Command::CreateExplorer(command) = action(d, 1).command else {
        panic!("wrong command")
    };
    assert!(
        ICreateExplorerSafeDispatcher { contract_address: d.games }
            .create_explorer(
                1,
                d.actor,
                command,
                crate::commands::action_context(ExecutionContext { raw_root: 1, ..context(d.games, 1) }),
            )
            .is_err(),
    );
    assert!(
        starknet::syscalls::call_contract_syscall(d.games, selector!("reveal"), array![1, 0, 12, 34, 11].span())
            .is_err(),
    );
}

#[test]
fn post_root_failure_rolls_back_child_storage_and_emits_rejection_wire() {
    let d = setup(true);
    let before = play_fixture::pins(d.games, 1);
    snforge_std::start_cheat_transaction_hash(d.games, 123456);
    let mut spy = spy_events();
    assert!(!play_fixture::play(d.games, action(d, 1), 0, 100));
    assert_eq!(play_fixture::pins(d.games, 1), before);
    assert!(GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: 1, explorer_id: 7 }).is_none());
    let fixture = IFixtureDispatcher { contract_address: d.games };
    assert_eq!(fixture.received_actor(), 0.try_into().unwrap());
    assert_eq!(fixture.received_root(), 0);
    assert_eq!(fixture.received_timestamp(), 0);
    assert!(
        snforge_std::interact_with_state(
            d.games,
            || {
                !crate::logic::structures::exists(crate::resources::ResourceKey { game_id: 1, entity_id: 7 })
            },
        ),
    );
    let rejected = play_fixture::rejection(ref spy, d.games);
    assert_eq!(rejected.version, 1);
    assert_eq!(rejected.game_id, 1);
    assert_eq!(rejected.actor, d.actor);
    assert_eq!(rejected.tx_hash, 123456);
    assert_eq!(rejected.status_class, 'GAMEPLAY_REJECTED');
    assert_eq!(rejected.reason, "fixture late rejection");
    let mut rejection_count = 0;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("GameplayRejected") {
            assert_eq!(event.keys.span(), array![selector!("GameplayRejected"), 1, 1, d.actor.into(), 123456].span());
            let mut expected = array!['GAMEPLAY_REJECTED'];
            let reason: ByteArray = "fixture late rejection";
            reason.serialize(ref expected);
            assert_eq!(event.data.span(), expected.span());
            rejection_count += 1;
        }
    }
    assert_eq!(rejection_count, 1);
    // Source rows verify that every child write rolled back.
    assert!(
        snforge_std::interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::map::TileKey { game_id: 1, alt: false, col: 12, row: 34 }),
        )
            .is_none(),
    );
    execute(d, action(d, 1));
}

#[test]
#[feature("safe_dispatcher")]
fn only_owner_rotates_launcher_and_authentication_is_immutable() {
    let d = setup(true);
    let roles = IGamesRolesDispatcher { contract_address: d.games };
    let safe = IGamesRolesSafeDispatcher { contract_address: d.games };
    let authentication = IGamesAuthenticationDispatcher { contract_address: d.games }.authentication();
    assert_eq!(roles.owner(), authority());
    assert_eq!(roles.launcher(), authority());
    start_cheat_caller_address(d.games, d.actor);
    assert!(safe.set_launcher(d.actor).is_err());
    set_launcher(d, d.actor);
    assert_eq!(roles.launcher(), d.actor);
    start_cheat_caller_address(d.games, authority());
    assert!(safe.set_launcher(0.try_into().unwrap()).is_err());
    assert_eq!(roles.launcher(), d.actor);
    assert_eq!(roles.owner(), authority());
    let current = IGamesAuthenticationDispatcher { contract_address: d.games }.authentication();
    assert_eq!(current.account_class, authentication.account_class);
    assert_eq!(current.guardian_public_key, authentication.guardian_public_key);
    assert!(
        starknet::syscalls::call_contract_syscall(
            d.games, selector!("set_authentication"), array![d.actor.into(), d.account_class.into()].span(),
        )
            .is_err(),
    );
}

#[test]
#[feature("safe_dispatcher")]
fn games_reinitialization_is_rejected_without_changing_authentication_or_state() {
    let verifier = declare_logic("Verifier");
    assert_eq!(verifier, crate::vrf_class::VRF_VERIFIER_CLASS_HASH.try_into().unwrap());
    let d = setup_with_host(true, "MapLogic", "TroopFixture", "Games");
    let entry = IGamesAuthenticationDispatcher { contract_address: d.games };
    let authentication = entry.authentication();
    let release = IReleasesDispatcher { contract_address: d.games }.release(1);
    let mut calldata = array![d.actor.into(), d.actor.into()];
    authentication.serialize(ref calldata);
    calldata.append(1);
    release.serialize(ref calldata);
    append_vrf_configuration(ref calldata);
    start_cheat_caller_address(d.games, authority());
    for selector in array![selector!("constructor"), selector!("initializer")] {
        assert!(starknet::syscalls::call_contract_syscall(d.games, selector, calldata.span()).is_err());
    }
    let after = entry.authentication();
    assert_eq!(after.account_class, authentication.account_class);
    assert_eq!(after.guardian_public_key, authentication.guardian_public_key);
    assert_eq!(IGamesRolesDispatcher { contract_address: d.games }.owner(), authority());
    let (release_id, _) = play_fixture::pins(d.games, 1);
    assert_eq!(release_id, 1);
}

#[test]
#[feature("safe_dispatcher")]
fn an_identity_that_does_not_match_the_account_address_is_rejected() {
    let d = setup(true);
    snforge_std::store(d.actor, selector!("realms_id"), array![999].span());
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    assert_entry_refusal(d, 1, release, preset, play_fixture::encode(action(d, 1).command), "foreign guardian");
}

#[test]
#[feature("safe_dispatcher")]
fn disabled_commands_and_unready_rosters_revert_before_root() {
    let d = setup(true);
    let game = crate::game::IGameDispatcherTrait::game(crate::game::IGameDispatcher { contract_address: d.games }, 1);
    let rules = crate::rules::SliceRules { command_mask: 0, ..play_fixture::rules() };
    play_fixture::seed_game(d.games, 1, game, rules);
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    assert_entry_refusal(d, 1, release, preset, play_fixture::encode(action(d, 1).command), "command disabled");
    play_fixture::seed_game(d.games, 1, crate::game::GameRegistry { ready: false, ..game }, play_fixture::rules());
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    assert_entry_refusal(d, 1, release, preset, play_fixture::encode(action(d, 1).command), "roster not ready");
}

#[test]
#[feature("safe_dispatcher")]
fn only_current_launcher_can_create_banks_before_root() {
    let d = setup(true);
    let banks = array![
        crate::market::BankPlacement {
            name: 'bank', coord: crate::troops::Coord { alt: false, x: 2000000, y: 2000000 },
        },
    ]
        .span();
    let command = play_fixture::encode(Command::CreateBanks(banks));
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    assert_entry_refusal(d, 1, release, preset, command, "only launcher");
    set_launcher(d, d.actor);
    let old_launcher = bind_authority(d);
    play_fixture::caller(d.games, old_launcher.actor, 100);
    assert_entry_refusal(d, 1, release, preset, command, "only launcher");
    let mut spy = spy_events();
    assert!(!play_fixture::play(d.games, TestAction { command: Command::CreateBanks(banks), ..action(d, 1) }, 1, 100));
    let rejected = play_fixture::rejection(ref spy, d.games);
    assert_eq!(rejected.status_class, 'GAMEPLAY_REJECTED');
    assert_eq!(rejected.reason, "six regional banks required");
}

#[test]
#[feature("safe_dispatcher")]
fn command_list_and_calldata_limits_are_checked_before_root() {
    let d = setup(true);
    let (release, preset) = play_fixture::pins(d.games, 1);
    play_fixture::caller(d.games, d.actor, 100);
    let mut directions = array![];
    for _ in 0_u32..65 {
        directions.append(0_u8);
    }
    let oversized_list = play_fixture::encode(
        Command::Move(crate::commands::Move { explorer_id: 7, directions: directions.span() }),
    );
    let mut oversized_calldata = array![];
    for _ in 0_u32..257 {
        oversized_calldata.append(0);
    }
    for command in array![oversized_list, oversized_calldata.span(), array![0, 7, 256, 0, 0, 0].span()] {
        let mut spy = spy_events();
        assert!(
            IPlayFixtureSafeDispatcher { contract_address: d.games }
                .play_with_root(1, release, preset, command, 1)
                .is_err(),
        );
        assert_eq!(play_fixture::pins(d.games, 1), (release, preset));
        assert!(GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: 1, explorer_id: 7 }).is_none());
        assert!(spy.get_events().emitted_by(d.games).events.is_empty());
    }
}

#[test]
#[feature("safe_dispatcher")]
fn owner_registration_and_launcher_game_creation_have_separate_roles() {
    let d = registrar::setup();
    let registry = crate::registrar::IRegistrarDispatcher { contract_address: d.games };
    let safe = crate::registrar::IRegistrarSafeDispatcher { contract_address: d.games };
    let releases = IReleasesDispatcher { contract_address: d.games };
    let release = releases.release(1);
    set_launcher(d, d.actor);
    start_cheat_caller_address(d.games, d.actor);
    assert!(
        crate::registrar::IRegistrarSafeDispatcherTrait::register_preset(safe, 1, registrar::definition(true)).is_err(),
    );
    assert!(
        crate::logic::release::IReleasesSafeDispatcherTrait::register_release(
            crate::logic::release::IReleasesSafeDispatcher { contract_address: d.games }, 2, release,
        )
            .is_err(),
    );
    start_cheat_caller_address(d.games, authority());
    crate::registrar::IRegistrarDispatcherTrait::register_preset(registry, 1, registrar::definition(true));
    releases.register_release(2, release);
    assert!(crate::registrar::IRegistrarSafeDispatcherTrait::create_game(safe, registrar::params(true)).is_err());
    start_cheat_caller_address(d.games, d.actor);
    let game_id = crate::registrar::IRegistrarDispatcherTrait::create_game(registry, registrar::params(true));
    assert_eq!(releases.game_release(game_id), 2);
    assert_eq!(IGamesRolesDispatcher { contract_address: d.games }.owner(), authority());
    assert_eq!(IGamesRolesDispatcher { contract_address: d.games }.launcher(), d.actor);
}

#[test]
fn game_registry_wire_contains_only_game_configuration() {
    let d = setup(true);
    let game = crate::game::IGameDispatcherTrait::game(crate::game::IGameDispatcher { contract_address: d.games }, 1);
    let mut encoded = array![];
    game.serialize(ref encoded);
    assert_eq!(
        encoded.span(),
        array![
            game.name, game.preset_id.into(), 0, 1, 1, game.start_settling_at.into(), game.start_main_at.into(),
            game.end_at.into(), game.end_grace_seconds.into(), game.seed,
        ]
            .span(),
    );
}


#[test]
fn constructor_vrf_configuration_is_immutable_and_refuses_invalid_inputs() {
    let verifier = declare_logic("Verifier");
    assert_eq!(verifier, crate::vrf_class::VRF_VERIFIER_CLASS_HASH.try_into().unwrap());
    let d = setup_with_host(true, "MapLogic", "TroopFixture", "Games");
    let randomness = crate::games::IGamesRandomnessDispatcher { contract_address: d.games };
    let key = randomness.vrf_public_key();
    assert_eq!((key.x, key.y), (vrf_key().x, vrf_key().y));
    assert_eq!(randomness.l2_gas_bound(), TEST_L2_GAS_BOUND);
    start_cheat_caller_address(d.games, authority());
    assert!(
        starknet::syscalls::call_contract_syscall(d.games, selector!("set_vrf_public_key"), array![0, 0].span())
            .is_err(),
    );
    assert!(
        starknet::syscalls::call_contract_syscall(d.games, selector!("set_l2_gas_bound"), array![1].span()).is_err(),
    );
    let after = randomness.vrf_public_key();
    assert_eq!((after.x, after.y), (key.x, key.y));
    assert_eq!(randomness.l2_gas_bound(), TEST_L2_GAS_BOUND);
    let authentication = IGamesAuthenticationDispatcher { contract_address: d.games }.authentication();
    let release = IReleasesDispatcher { contract_address: d.games }.release(1);
    for invalid_key in array![true, false] {
        let mut args = array![authority().into(), authority().into()];
        authentication.serialize(ref args);
        args.append(1);
        release.serialize(ref args);
        let key = if invalid_key {
            realms_vrf_verifier::vendor::ecvrf::Point { x: 0, y: 0 }
        } else {
            vrf_key()
        };
        key.serialize(ref args);
        args.append(if invalid_key {
            TEST_L2_GAS_BOUND.into()
        } else {
            0
        });
        assert!(declare("Games").unwrap().contract_class().deploy(@args).is_err());
    }
}
mod bridge;
mod days;
mod entity_ids;
mod faith;
mod guilds;
mod preset_projection;
mod progression;
mod rule_storage;
mod shared_storage;
mod spires;
mod stamina;
mod structure_rules;
mod structure_storage;
mod terrain;
