pub use world_test_support::tests::resource_commands::*;

#[test]
fn explicit_burn_does_not_harvest_and_rejection_keeps_the_stream_moving() {
    let (deployment, source, _) = setup();
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let slot = ResourceSlot { game_id: 3, entity_id: source.entity_id, resource_type: 1 };
    let burn = ResourceBurn { entity_id: source.entity_id, resources: amount(1, 10) };
    assert!(execute(deployment, Command::BurnStructureResources(burn), 40));
    assert_eq!(resources.resource_balance(slot), 90);
    assert_eq!(resources.resource_production(slot).last_settled_at, 30);
    let production = resources.resource_production(slot);
    assert!(
        !execute(deployment, Command::BurnStructureResources(ResourceBurn { resources: amount(1, 120), ..burn }), 45),
    );
    assert_eq!(resources.resource_balance(slot), 90);
    assert_eq!(resources.resource_production(slot), production);
    assert!(execute(deployment, Command::BurnStructureResources(burn), 45));
    assert_eq!(resources.resource_balance(slot), 80);
    assert_eq!(resources.resource_production(slot), production);
}

#[test]
fn explorer_transfers_keep_capacity_loss_and_reject_wrong_layers_atomically() {
    let (deployment, home, _) = setup();
    let from = explorer_fixture(deployment, 70, home.entity_id, Coord { alt: true, x: 2000000, y: 2000000 }, 100);
    let to = explorer_fixture(deployment, 71, home.entity_id, Coord { alt: true, x: 2000015, y: 2000000 }, 5);
    let surface = explorer_fixture(deployment, 72, home.entity_id, Coord { alt: false, x: 2000015, y: 2000000 }, 100);
    grant(deployment, from, crate::resources::LABOR, 50);
    assert_eq!(
        GameState { contract_address: deployment.games }
            .authorized_explorer(ExplorerKey { game_id: 3, explorer_id: from.entity_id }, deployment.actor, 40)
            .owner,
        home.entity_id,
    );
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let command = crate::resources::ResourceTransfer {
        from_entity_id: from.entity_id, to_entity_id: to.entity_id, resources: amount(crate::resources::LABOR, 10),
    };
    assert!(execute(deployment, Command::TransferExplorerResources(command), 40));
    assert_eq!(
        resources
            .resource_balance(
                ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: crate::resources::LABOR },
            ),
        40,
    );
    assert_eq!(
        resources
            .resource_balance(
                ResourceSlot { game_id: 3, entity_id: to.entity_id, resource_type: crate::resources::LABOR },
            ),
        5,
    );
    let production = resources
        .resource_production(
            ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: crate::resources::LABOR },
        );
    assert!(
        !execute(
            deployment,
            Command::TransferExplorerResources(
                crate::resources::ResourceTransfer { to_entity_id: surface.entity_id, ..command },
            ),
            50,
        ),
    );
    assert_eq!(
        resources
            .resource_balance(
                ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: crate::resources::LABOR },
            ),
        40,
    );
    assert_eq!(
        resources
            .resource_production(
                ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: crate::resources::LABOR },
            ),
        production,
    );
    assert!(
        !execute(
            deployment,
            Command::TransferExplorerResources(
                crate::resources::ResourceTransfer { to_entity_id: from.entity_id, ..command },
            ),
            50,
        ),
    );
    assert!(
        !execute(
            deployment,
            Command::TransferExplorerResources(crate::resources::ResourceTransfer { to_entity_id: 999, ..command }),
            50,
        ),
    );
}

#[test]
fn arrivals_offload_only_the_requested_prefix_and_delete_the_last_row() {
    let (deployment, home, _) = setup();
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let values = array![
        ResourceAmount { resource_type: 2, amount: 10 }, ResourceAmount { resource_type: 3, amount: 20 },
    ]
        .span();
    let key = arrival_fixture(deployment, home.entity_id, 1, values);
    let later = arrival_fixture(deployment, home.entity_id, 2, amount(2, 30));
    let offload = crate::arrivals::OffloadArrival { entity_id: home.entity_id, day: 0, slot: 1, resource_count: 1 };
    assert!(!execute(deployment, Command::OffloadArrival(offload), 179));
    assert_eq!(resources.resource_arrival(key).resources, values);
    assert!(execute(deployment, Command::OffloadArrival(offload), 180));
    assert_eq!(resources.resource_arrival(key).resources, values.slice(1, 1));
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 2 }), 10,
    );
    assert_eq!(resources.resource_balance(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 3 }), 0);
    assert!(
        !execute(
            deployment, Command::OffloadArrival(crate::arrivals::OffloadArrival { resource_count: 0, ..offload }), 180,
        ),
    );
    assert_eq!(resources.resource_arrival(key).resources, values.slice(1, 1));
    assert!(
        execute(
            deployment,
            Command::OffloadArrival(crate::arrivals::OffloadArrival { resource_count: 255, ..offload }),
            180,
        ),
    );
    assert!(resources.resource_arrival(key).resources.is_empty());
    assert_eq!(resources.resource_arrival(later).resources, amount(2, 30));
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 3 }), 20,
    );
    assert!(execute(deployment, Command::OffloadArrival(offload), 180));
    assert!(!execute(deployment, Command::OffloadArrival(crate::arrivals::OffloadArrival { slot: 2, ..offload }), 180));
    assert!(!execute(deployment, Command::OffloadArrival(crate::arrivals::OffloadArrival { slot: 0, ..offload }), 180));
    assert!(
        !execute(deployment, Command::OffloadArrival(crate::arrivals::OffloadArrival { slot: 49, ..offload }), 180),
    );
}

#[test]
fn full_capacity_discards_offloaded_excess_as_the_original_rules_do() {
    let (deployment, home, _) = setup();
    let key = arrival_fixture(deployment, home.entity_id, 1, amount(crate::resources::WHEAT, 30));
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("weights"),
        array![3, home.entity_id.into()].span(),
        crate::resources::Weight { capacity: 100, weight: 100 },
    );
    assert!(
        execute(
            deployment,
            Command::OffloadArrival(
                crate::arrivals::OffloadArrival { entity_id: home.entity_id, day: 0, slot: 1, resource_count: 1 },
            ),
            180,
        ),
    );
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    assert!(resources.resource_arrival(key).resources.is_empty());
    assert_eq!(
        resources
            .resource_balance(
                ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: crate::resources::WHEAT },
            ),
        0,
    );
    assert_eq!(resources.resource_weight(home), crate::resources::Weight { capacity: 100, weight: 100 });
}

#[test]
fn arrival_day_rollover_preserves_the_previous_tick_rule() {
    let yesterday = ArrivalKey { game_id: 1, entity_id: 1, day: 0, slot: 48 };
    let today = ArrivalKey { day: 1, slot: 1, ..yesterday };
    assert!(!has_arrived(yesterday, 180, 48 * 180 - 1));
    assert!(has_arrived(yesterday, 180, 48 * 180));
    assert!(!has_arrived(today, 180, 48 * 180));
    assert!(!has_arrived(today, 180, 49 * 180 - 1));
    assert!(has_arrived(today, 180, 49 * 180));
}

#[test]
fn every_transfer_rejects_duplicates_without_changing_facts() {
    let (deployment, from, to) = setup();
    let explorer = explorer_fixture(deployment, 70, from.entity_id, Coord { alt: false, x: 2000001, y: 2000000 }, 1000);
    let other = explorer_fixture(deployment, 71, from.entity_id, Coord { alt: false, x: 2000002, y: 2000000 }, 1000);
    grant(deployment, explorer, 1, 100);
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let source_before = resource_facts(deployment, from);
    let recipient_before = resource_facts(deployment, to);
    let explorer_before = resource_facts(deployment, explorer);
    let other_before = resource_facts(deployment, other);
    let duplicate = array![
        ResourceAmount { resource_type: 1, amount: 10 }, ResourceAmount { resource_type: 2, amount: 0 },
        ResourceAmount { resource_type: 1, amount: 20 },
    ]
        .span();
    let transfer = crate::resources::ResourceTransfer {
        from_entity_id: from.entity_id, to_entity_id: to.entity_id, resources: duplicate,
    };
    for command in array![
        Command::SendResources(transfer),
        Command::TransferExplorerResources(
            crate::resources::ResourceTransfer {
                from_entity_id: explorer.entity_id, to_entity_id: other.entity_id, ..transfer,
            },
        ),
        Command::TransferExplorerResourcesToStructure(
            crate::resources::ResourceTransfer {
                from_entity_id: explorer.entity_id, to_entity_id: from.entity_id, ..transfer,
            },
        ),
    ] {
        assert_terminal_rejection(deployment, command, 40);
        assert_eq!(resource_facts(deployment, from), source_before);
        assert_eq!(resource_facts(deployment, to), recipient_before);
        assert_eq!(resource_facts(deployment, explorer), explorer_before);
        assert_eq!(resource_facts(deployment, other), other_before);
        for slot in 1_u8..49 {
            assert!(
                resources
                    .resource_arrival(ArrivalKey { game_id: 3, entity_id: to.entity_id, day: 0, slot })
                    .resources
                    .is_empty(),
            );
        }
    }
    assert!(
        execute(
            deployment,
            Command::BurnStructureResources(ResourceBurn { entity_id: from.entity_id, resources: amount(1, 10) }),
            40,
        ),
    );
}

#[test]
fn sending_queues_arrivals_and_spends_only_the_senders_donkeys() {
    let (deployment, from, to) = setup();
    let precision = crate::rules::RESOURCE_PRECISION;
    grant(deployment, from, 25, 10 * precision);
    grant(deployment, to, 25, 10 * precision);
    grant(deployment, from, crate::resources::LABOR, 10);
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let transfer = crate::resources::ResourceTransfer {
        from_entity_id: from.entity_id, to_entity_id: to.entity_id, resources: amount(crate::resources::LABOR, 10),
    };
    assert!(execute(deployment, Command::SendResources(transfer), 40));
    // Ten surface hexes at nine seconds each: arrival remains in slot one.
    let key = ArrivalKey { game_id: 3, entity_id: to.entity_id, day: 0, slot: 1 };
    assert_eq!(resources.resource_arrival(key).resources, amount(crate::resources::LABOR, 10));
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: 25 }),
        9 * precision,
    );
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: to.entity_id, resource_type: 25 }),
        10 * precision,
    );
}

#[test]
fn eternum_troop_deposits_require_ownership_for_category_1() {
    troop_deposit_ownership(false, 1);
}

#[test]
fn eternum_troop_deposits_require_ownership_for_category_2() {
    troop_deposit_ownership(false, 2);
}

#[test]
fn eternum_troop_deposits_require_ownership_for_category_3() {
    troop_deposit_ownership(false, 3);
}

#[test]
fn eternum_troop_deposits_require_ownership_for_category_4() {
    troop_deposit_ownership(false, 4);
}

#[test]
fn eternum_troop_deposits_require_ownership_for_category_5() {
    troop_deposit_ownership(false, 5);
}

#[test]
fn eternum_troop_deposits_require_ownership_for_category_7() {
    troop_deposit_ownership(false, 7);
}

#[test]
fn eternum_troop_deposits_require_ownership_for_category_8() {
    troop_deposit_ownership(false, 8);
}

#[test]
fn duplicate_resource_ids_reject_without_mutating_balances() {
    let (d, source, _) = setup();
    let before = resource_facts(d, source);
    let resources = array![
        ResourceAmount { resource_type: 1, amount: 10 }, ResourceAmount { resource_type: 1, amount: 20 },
    ]
        .span();
    for command in array![Command::BurnStructureResources(ResourceBurn { entity_id: source.entity_id, resources })] {
        assert_terminal_rejection(d, command, 40);
        assert_eq!(resource_facts(d, source), before);
    }
}

#[test]
fn fixture_grants_preserve_the_existing_production_clock() {
    let (deployment, source, _) = setup();
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let slot = ResourceSlot { game_id: source.game_id, entity_id: source.entity_id, resource_type: 1 };
    start_cheat_caller_address(deployment.games, deployment.games);
    resources
        .settle_production(
            source,
            40,
            crate::commands::resource_context(
                ExecutionContext { timestamp: 40, ..context(deployment.games, source.game_id) },
            ),
        );
    stop_cheat_caller_address(deployment.games);
    let production = resources.resource_production(slot);
    assert_eq!(production.last_settled_at, 40);
    assert_eq!(resources.resource_balance(slot), 120);
    grant(deployment, source, 1, 7);
    assert_eq!(resources.resource_balance(slot), 127);
    assert_eq!(resources.resource_production(slot), production);
    grant(deployment, source, 1, 3);
    assert_eq!(resources.resource_balance(slot), 130);
    assert_eq!(resources.resource_production(slot), production);
}
