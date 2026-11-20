pub use world_test_support::tests::hyperstructures::*;

#[test]
fn initialization_burns_only_shards_and_progress_completes_with_clamped_contributions() {
    let (deployment, hyper, from, _) = setup();
    let original_points = points(deployment, deployment.actor);
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Foundation);
    assert_eq!(view(deployment).hyperstructure_count(3), 1);
    assert_eq!(view(deployment).hyperstructure_count(2), 0);
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    assert_eq!(balance(deployment, hyper, 24), 0);
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Construction);
    assert_terminal_rejection(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40);
    assert!(execute(deployment, contribute(hyper, from, array![amount(2, 4)].span()), 45));
    assert_eq!(points(deployment, deployment.actor) - original_points, 400);
    assert!(execute(deployment, contribute(hyper, from, array![amount(2, 999), amount(3, 999)].span()), 50));
    assert_eq!(balance(deployment, from, 2), 90 * RESOURCE_PRECISION);
    assert_eq!(balance(deployment, from, 3), 80 * RESOURCE_PRECISION);
    assert_eq!(points(deployment, deployment.actor) - original_points, 3000);
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Complete);
    assert_eq!(view(deployment).completed_hyperstructure_count(3), 1);
    let allocation = view(deployment).hyperstructure_shares(hyper);
    assert_eq!(allocation.start_at, 50);
    assert_eq!(allocation.multiplier, 1);
    assert_eq!(allocation.shareholders, array![Share { player: deployment.actor, bps: 10000 }].span());
    let key = crate::map::TileKey { game_id: 3, alt: false, col: 2000100, row: 2000000 };
    let occupied = snforge_std::interact_with_state(deployment.games, || crate::map::structure_occupant(key));
    assert_eq!(occupied, Some(hyper.entity_id));
}
#[test]
fn contribution_rejections_roll_back_the_whole_batch() {
    let (deployment, hyper, from, _) = setup();
    assert_terminal_rejection(deployment, contribute(hyper, from, array![amount(2, 1)].span()), 35);
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    let initial = points(deployment, deployment.actor);
    for resources in array![
        array![].span(), array![amount(2, 0)].span(),
        array![amount(2, 1), ResourceAmount { resource_type: 3, amount: 1 }].span(),
        array![amount(2, 10), amount(2, 1)].span(), array![amount(24, 1)].span(),
    ] {
        assert_terminal_rejection(deployment, contribute(hyper, from, resources), 45);
        assert_eq!(balance(deployment, from, 2), 100 * RESOURCE_PRECISION);
        assert_eq!(
            view(deployment)
                .hyperstructure_progress(ResourceSlot { game_id: 3, entity_id: hyper.entity_id, resource_type: 2 }),
            0,
        );
        assert_eq!(points(deployment, deployment.actor), initial);
    }
    assert_terminal_rejection(deployment, contribute(hyper, from, array![amount(2, 1)].span()), 200);
    assert_eq!(
        crate::game::IPointsDispatcher { contract_address: deployment.games }.season_points(3),
        points(deployment, deployment.actor),
    );
}

#[test]
fn share_rejections_preserve_allocation_and_points() {
    let (deployment, hyper, from, _) = setup();
    complete(deployment, hyper, from);
    let initial = view(deployment).hyperstructure_shares(hyper);
    let old = points(deployment, deployment.actor);
    for shares in array![
        array![].span(), array![Share { player: deployment.actor, bps: 9999 }].span(),
        array![Share { player: 0.try_into().unwrap(), bps: 10000 }].span(),
        array![Share { player: deployment.actor, bps: 99 }, Share { player: deployment.actor, bps: 9901 }].span(),
    ] {
        assert_terminal_rejection(deployment, allocate(hyper, shares), 60);
        assert_eq!(view(deployment).hyperstructure_shares(hyper), initial);
        assert_eq!(points(deployment, deployment.actor), old);
    }
    let mut too_many = array![];
    for _ in 0_u32..21 {
        too_many.append(Share { player: deployment.actor, bps: 100 });
    }
    assert_terminal_rejection(deployment, allocate(hyper, too_many.span()), 60);
}
#[test]
#[feature("safe_dispatcher")]
fn construction_access_applies_to_contributor_and_current_owners_guild() {
    let (deployment, hyper, from, other) = setup();
    assert_terminal_rejection(deployment, access(hyper, ConstructionAccess::Public), 35);
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    let friend: starknet::ContractAddress = 987.try_into().unwrap();
    owner(deployment, other, friend);
    let safe = IHyperstructuresSafeDispatcher { contract_address: deployment.games };
    let command = Contribution {
        hyperstructure_id: hyper.entity_id, from_structure_id: other.entity_id, resources: array![amount(2, 1)].span(),
    };
    start_cheat_block_timestamp_global(45);
    start_cheat_caller_address(deployment.games, deployment.games);
    assert!(
        safe
            .contribute_hyperstructure(
                3,
                friend,
                command,
                crate::commands::action_context(
                    ExecutionContext { timestamp: 45, ..super::context(deployment.games, 3) },
                ),
            )
            .is_err(),
    );
    stop_cheat_caller_address(deployment.games);
    assert_terminal_rejection(deployment, access(hyper, ConstructionAccess::GuildOnly), 45);
    set_fixture(
        deployment.games,
        selector!("guilds"),
        selector!("members"),
        array![3, deployment.actor.into()].span(),
        1_felt252,
    );
    assert!(execute(deployment, access(hyper, ConstructionAccess::GuildOnly), 45));
    start_cheat_caller_address(deployment.games, deployment.games);
    assert!(
        safe
            .contribute_hyperstructure(
                3,
                friend,
                command,
                crate::commands::action_context(
                    ExecutionContext { timestamp: 45, ..super::context(deployment.games, 3) },
                ),
            )
            .is_err(),
    );
    set_fixture(
        deployment.games, selector!("guilds"), selector!("members"), array![3, friend.into()].span(), 1_felt252,
    );
    assert!(
        safe
            .contribute_hyperstructure(
                3,
                friend,
                command,
                crate::commands::action_context(
                    ExecutionContext { timestamp: 45, ..super::context(deployment.games, 3) },
                ),
            )
            .is_ok(),
    );
    stop_cheat_caller_address(deployment.games);
    assert!(execute(deployment, access(hyper, ConstructionAccess::Public), 46));
    set_fixture(
        deployment.games, selector!("guilds"), selector!("members"), array![3, friend.into()].span(), 2_felt252,
    );
    start_cheat_caller_address(deployment.games, deployment.games);
    start_cheat_block_timestamp_global(46);
    assert!(
        safe
            .contribute_hyperstructure(
                3,
                friend,
                command,
                crate::commands::action_context(
                    ExecutionContext { timestamp: 46, ..super::context(deployment.games, 3) },
                ),
            )
            .is_ok(),
    );
    assert!(
        safe
            .contribute_hyperstructure(
                3,
                friend,
                Contribution { from_structure_id: from.entity_id, ..command },
                crate::commands::action_context(
                    ExecutionContext { timestamp: 46, ..super::context(deployment.games, 3) },
                ),
            )
            .is_err(),
    );
}
#[test]
#[feature("safe_dispatcher")]
fn hyperstructure_configuration_requires_authority_and_initialization_requires_owner() {
    let (deployment, hyper, from, _) = setup();
    let registry = crate::registrar::IRegistrarSafeDispatcher { contract_address: deployment.games };
    let mut preset = super::play_fixture::fixture_preset(super::play_fixture::rules());
    preset.economy.hyperstructures = rules();
    assert!(registry.register_preset(20000, preset).is_err());
    start_cheat_caller_address(deployment.games, super::authority());
    assert!(registry.register_preset(10003, preset).is_err());
    let invalid = crate::presets::PresetDefinition {
        economy: crate::presets::EconomyPreset {
            race: None,
            banes: None,
            hyperstructures: HyperstructureRules { resources: array![].span(), ..rules() },
            ..preset.economy,
        },
        ..preset,
    };
    assert!(registry.register_preset(20000, invalid).is_err());
    assert!(registry.register_preset(20000, preset).is_ok());
    stop_cheat_caller_address(deployment.games);
    assert_terminal_rejection(deployment, Command::InitializeHyperstructure(from.entity_id), 40);
    owner(deployment, hyper, 987.try_into().unwrap());
    assert_terminal_rejection(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40);
}
#[test]
fn construction_requirements_preserve_per_resource_seed_division_and_exclusive_maximum() {
    let cost = ConstructionResource { resource_type: 2, minimum: 10, maximum: 20, points: 1000 };
    assert_eq!(crate::hyperstructures::required_amount(101, cost), 10 * RESOURCE_PRECISION);
    assert_eq!(crate::hyperstructures::required_amount(119, cost), 19 * RESOURCE_PRECISION);
    assert_eq!(
        crate::hyperstructures::required_amount(119, ConstructionResource { resource_type: 3, ..cost }),
        19 * RESOURCE_PRECISION,
    );
    assert_eq!(
        crate::hyperstructures::required_amount(999, ConstructionResource { maximum: 10, ..cost }),
        10 * RESOURCE_PRECISION,
    );
}

#[test]
fn insufficient_shards_or_a_later_resource_leave_construction_unchanged() {
    let (deployment, hyper, from, _) = setup();
    assert!(
        execute(
            deployment,
            Command::BurnStructureResources(
                crate::resources::ResourceBurn { entity_id: hyper.entity_id, resources: array![amount(24, 5)].span() },
            ),
            35,
        ),
    );
    assert_terminal_rejection(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40);
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Foundation);
    grant(deployment, hyper, 24, 5 * RESOURCE_PRECISION);
    assert!(execute(deployment, Command::InitializeHyperstructure(hyper.entity_id), 40));
    assert!(
        execute(
            deployment,
            Command::BurnStructureResources(
                crate::resources::ResourceBurn { entity_id: from.entity_id, resources: array![amount(3, 100)].span() },
            ),
            41,
        ),
    );
    assert_terminal_rejection(deployment, contribute(hyper, from, array![amount(2, 10), amount(3, 20)].span()), 45);
    assert_eq!(balance(deployment, from, 2), 100 * RESOURCE_PRECISION);
    assert_eq!(
        view(deployment)
            .hyperstructure_progress(ResourceSlot { game_id: 3, entity_id: hyper.entity_id, resource_type: 2 }),
        0,
    );
    assert_eq!(view(deployment).hyperstructure(hyper).unwrap().stage, Stage::Construction);
}

#[test]
fn reserved_complete_hyperstructures_have_no_seed_and_discoveries_keep_their_seed() {
    let (deployment, unfinished, _, _) = setup_mode(true);
    let original = view(deployment).hyperstructure(unfinished).unwrap();
    assert_eq!(original.stage, Stage::Foundation);
    assert_eq!(original.seed, 101);
    let reserved = view(deployment).hyperstructure(create_reserved(deployment, 31)).unwrap();
    assert_eq!(reserved.stage, Stage::Complete);
    assert_eq!(reserved.seed, 0);
    assert_eq!(view(deployment).hyperstructure(unfinished).unwrap(), original);
}

#[test]
fn a_hyperstructure_recorded_complete_emits_its_empty_shares_row() {
    let (deployment, _, _, _) = setup_mode(true);
    let key = ResourceKey { game_id: 3, entity_id: 777 };
    let mut events = snforge_std::spy_events();
    view(deployment).record_hyperstructure(key, 0, true);
    assert_eq!(share_writes(ref events, deployment, key), array!['set']);
    assert_eq!(
        view(deployment).hyperstructure_shares(key),
        ShareAllocation { start_at: 0, multiplier: 0, shareholders: array![].span() },
    );
}

#[test]
fn capture_leaves_shared_allocations_with_their_shareholders() {
    let (deployment, hyper, from, second) = setup();
    complete(deployment, hyper, from);
    let other: starknet::ContractAddress = 987.try_into().unwrap();
    assert!(
        execute(
            deployment,
            allocate(
                hyper, array![Share { player: deployment.actor, bps: 2500 }, Share { player: other, bps: 7500 }].span(),
            ),
            100,
        ),
    );
    let allocation = view(deployment).hyperstructure_shares(hyper);
    let before = (points(deployment, deployment.actor), points(deployment, other));
    let captor: starknet::ContractAddress = 654.try_into().unwrap();
    owner(deployment, second, captor);
    capture(deployment, hyper, second, 120);
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: deployment.games }.structure(hyper).unwrap().owner, captor,
    );
    assert_eq!(view(deployment).hyperstructure_shares(hyper), allocation);
    assert_eq!((points(deployment, deployment.actor), points(deployment, other)), before);
}
