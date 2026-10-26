pub use world_test_support::tests::trade::*;

#[test]
fn public_trade_escrows_once_and_partial_fills_deliver_both_sides() {
    let (deployment, maker, taker) = setup();
    let key = create(deployment, offer(maker));
    assert_eq!(balance(deployment, maker, 2), 970);
    assert_eq!(balance(deployment, maker, 25), 9 * RESOURCE_PRECISION);
    assert!(execute(deployment, accept(key, taker, 1), 50));
    let view = ITradeDispatcher { contract_address: deployment.games };
    assert_eq!(view.trade_order(key).unwrap().remaining_lots, 2);
    assert_eq!(balance(deployment, maker, 2), 970);
    assert_eq!(balance(deployment, taker, 3), 980);
    assert_eq!(balance(deployment, taker, 25), 9 * RESOURCE_PRECISION);
    assert_eq!(arrival(deployment, maker, 50, 20), array![ResourceAmount { resource_type: 3, amount: 20 }].span());
    assert_eq!(arrival(deployment, taker, 50, 20), array![ResourceAmount { resource_type: 2, amount: 10 }].span());
    assert!(execute(deployment, accept(key, taker, 2), 50));
    assert!(view.trade_order(key).is_none());
    assert_eq!(arrival(deployment, maker, 50, 20), array![ResourceAmount { resource_type: 3, amount: 60 }].span());
    assert_eq!(arrival(deployment, taker, 50, 20), array![ResourceAmount { resource_type: 2, amount: 30 }].span());
    assert_eq!(balance(deployment, taker, 3), 940);
    assert_terminal_rejection(deployment, accept(key, taker, 1), 51);
}
#[test]
fn cancellation_refunds_only_remaining_escrow_and_frees_order_capacity() {
    let (deployment, maker, taker) = setup();
    let first = create(deployment, offer(maker));
    let second = create(deployment, offer(maker));
    assert_terminal_rejection(deployment, Command::CreateTradeOrder(offer(maker)), 41);
    assert!(execute(deployment, accept(first, taker, 1), 50));
    assert!(execute(deployment, Command::CancelTradeOrder(first.trade_id), 60));
    assert_eq!(balance(deployment, maker, 2), 960);
    assert_eq!(balance(deployment, maker, 25), 9 * RESOURCE_PRECISION);
    assert!(execute(deployment, Command::CreateTradeOrder(offer(maker)), 61));
    assert!(execute(deployment, Command::CancelTradeOrder(second.trade_id), 200));
    assert_terminal_rejection(deployment, Command::CancelTradeOrder(second.trade_id), 201);
}
#[test]
fn malformed_offers_reject_atomically() {
    let (deployment, maker, _) = setup();
    let valid = offer(maker);
    for invalid in array![
        CreateOrder { offered_per_lot: 0, ..valid }, CreateOrder { requested_per_lot: 0, ..valid },
        CreateOrder { lots: 0, ..valid }, CreateOrder { expires_at: 40, ..valid },
        CreateOrder { requested_resource: 2, ..valid }, CreateOrder { offered_resource: 57, ..valid },
        CreateOrder { requested_resource: 57, ..valid }, CreateOrder { offered_resource: 0, ..valid },
        CreateOrder { requested_resource: 59, ..valid }, CreateOrder { offered_per_lot: 1000, ..valid },
        CreateOrder { taker_id: 999, ..valid }, CreateOrder { maker_id: 999, ..valid },
    ] {
        assert_terminal_rejection(deployment, Command::CreateTradeOrder(invalid), 40);
        assert_eq!(balance(deployment, maker, 2), 1000);
        assert_eq!(balance(deployment, maker, 25), 10 * RESOURCE_PRECISION);
    }
}
#[test]
fn rejected_fills_leave_escrow_balances_and_arrivals_unchanged() {
    let (deployment, maker, taker) = setup();
    let key = create(deployment, CreateOrder { taker_id: maker.entity_id, ..offer(maker) });
    assert_terminal_rejection(deployment, accept(key, taker, 1), 50);
    assert_terminal_rejection(deployment, accept(key, maker, 0), 50);
    assert_terminal_rejection(deployment, accept(key, maker, 4), 50);
    assert_terminal_rejection(deployment, accept(key, maker, 1), 180);
    assert_eq!(ITradeDispatcher { contract_address: deployment.games }.trade_order(key).unwrap().remaining_lots, 3);
    assert_eq!(balance(deployment, taker, 3), 1000);
    assert_eq!(balance(deployment, taker, 25), 10 * RESOURCE_PRECISION);
    assert!(arrival(deployment, maker, 50, 20).is_empty());
    assert!(execute(deployment, Command::CancelTradeOrder(key.trade_id), 200));
    assert_eq!(balance(deployment, maker, 2), 1000);
}
#[test]
fn escrow_uses_current_structure_owner_and_private_taker_identity() {
    let (deployment, maker, taker) = setup();
    let key = create(deployment, CreateOrder { taker_id: taker.entity_id, ..offer(maker) });
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: deployment.games };
    let record = crate::tests::state::StructureObservationTrait::structure(structures, maker).unwrap();
    super::resource_commands::set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, maker.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: 0x999.try_into().unwrap(),
            base: record.base,
            resources_packed: record.resources_packed,
            metadata: record.metadata,
        },
    );
    assert_terminal_rejection(deployment, Command::CancelTradeOrder(key.trade_id), 50);
    assert_terminal_rejection(deployment, Command::CreateTradeOrder(offer(maker)), 50);
    assert!(execute(deployment, accept(key, taker, 1), 50));
    assert_eq!(arrival(deployment, maker, 50, 20), array![ResourceAmount { resource_type: 3, amount: 20 }].span());
}
#[test]
fn trade_uses_block_time_and_cancel_has_only_game_grace() {
    let (deployment, maker, taker) = setup();
    let key = create(deployment, offer(maker));
    assert!(execute(deployment, accept(key, taker, 1), 50));
    assert_eq!(arrival(deployment, taker, 50, 20), array![ResourceAmount { resource_type: 2, amount: 10 }].span());
    assert!(execute(deployment, Command::CancelTradeOrder(key.trade_id), 210));
    assert_eq!(balance(deployment, maker, 2), 990);
    let (late, maker, _) = setup();
    let open = create(late, offer(maker));
    assert_terminal_rejection(late, Command::CancelTradeOrder(open.trade_id), 211);
    assert!(ITradeDispatcher { contract_address: late.games }.trade_order(open).is_some());
}
#[test]
#[feature("safe_dispatcher")]
fn trade_rules_are_authorized_immutable_and_game_scoped() {
    let (deployment, maker, _) = setup();
    let economy = deployment.games;
    let safe = ITradeSafeDispatcher { contract_address: economy };
    start_cheat_block_timestamp_global(40);
    start_cheat_caller_address(economy, deployment.actor);
    let registry = crate::registrar::IRegistrarSafeDispatcher { contract_address: economy };
    let mut preset = super::play_fixture::fixture_preset(super::play_fixture::rules());
    preset.economy.trade = TradeRules { max_count: 1 };
    assert!(registry.register_preset(20000, preset).is_err());
    start_cheat_caller_address(economy, super::authority());
    assert!(registry.register_preset(10003, preset).is_err());
    super::play_fixture::seed_game_with_preset(
        economy, 4, crate::game::IGameDispatcher { contract_address: economy }.game(3), preset,
    );
    assert_eq!(safe.trade_rules(4).unwrap().max_count, 1);
    assert_eq!(safe.trade_rules(3).unwrap().max_count, 2);
    assert!(safe.trade_rules(999).is_err());
    stop_cheat_caller_address(economy);
    let key = create(deployment, offer(maker));
    assert!(safe.trade_order(TradeKey { game_id: 1, trade_id: key.trade_id }).unwrap().is_none());
    start_cheat_caller_address(deployment.games, deployment.actor);
}

#[test]
fn trade_rejects_blitz_and_either_ethereal_endpoint() {
    let (deployment, maker, taker) = setup();
    change_structure(deployment, maker, 1, true);
    assert_terminal_rejection(deployment, Command::CreateTradeOrder(offer(maker)), 40);
    change_structure(deployment, maker, 1, false);
    change_structure(deployment, taker, 1, true);
    assert_terminal_rejection(
        deployment, Command::CreateTradeOrder(CreateOrder { taker_id: taker.entity_id, ..offer(maker) }), 40,
    );
    let key = create(deployment, offer(maker));
    assert_terminal_rejection(deployment, accept(key, taker, 1), 50);
    let mut rules = super::play_fixture::rules();
    rules.mode_rules = super::play_fixture::BLITZ_RULES;
    rules.command_mask = super::play_fixture::BLITZ_COMMAND_MASK;
    rules.entry_rule = crate::rules::ENTRY_ROSTER;
    let (blitz, source, _) = setup_with_rules(rules);
    assert_terminal_rejection(blitz, Command::CreateTradeOrder(offer(source)), 40);
}

#[test]
fn insufficient_payment_or_donkeys_reverts_the_entire_fill() {
    let (deployment, maker, taker) = setup();
    let key = create(deployment, CreateOrder { requested_per_lot: 1001, ..offer(maker) });
    assert_terminal_rejection(deployment, accept(key, taker, 1), 50);
    assert_eq!(balance(deployment, taker, 25), 10 * RESOURCE_PRECISION);
    assert!(arrival(deployment, maker, 50, 20).is_empty());
    assert_eq!(ITradeDispatcher { contract_address: deployment.games }.trade_order(key).unwrap().remaining_lots, 3);
    assert!(
        execute(
            deployment,
            Command::BurnStructureResources(
                crate::resources::ResourceBurn {
                    entity_id: taker.entity_id,
                    resources: array![ResourceAmount { resource_type: 25, amount: 10 * RESOURCE_PRECISION }].span(),
                },
            ),
            50,
        ),
    );
    let second = create_at(deployment, offer(maker), 50);
    assert_terminal_rejection(deployment, accept(second, taker, 1), 50);
    assert_eq!(balance(deployment, taker, 3), 1000);
}

#[test]
fn same_structure_trade_uses_a_zero_distance_arrival_without_immediate_credit() {
    let (deployment, maker, _) = setup();
    let key = create(deployment, CreateOrder { taker_id: maker.entity_id, ..offer(maker) });
    assert!(execute(deployment, accept(key, maker, 1), 50));
    assert_eq!(balance(deployment, maker, 2), 970);
    assert_eq!(balance(deployment, maker, 3), 980);
    assert_eq!(
        arrival(deployment, maker, 50, 0),
        array![ResourceAmount { resource_type: 3, amount: 20 }, ResourceAmount { resource_type: 2, amount: 10 }].span(),
    );
}

#[test]
fn village_troop_purchases_use_trade_ownership_and_troop_transport_speed() {
    let (deployment, maker, taker) = setup();
    change_structure(deployment, taker, 5, false);
    grant(deployment, maker, 26, 1000);
    let key = create(deployment, CreateOrder { offered_resource: 26, ..offer(maker) });
    assert!(execute(deployment, accept(key, taker, 1), 50));
    assert_eq!(arrival(deployment, taker, 50, 40), array![ResourceAmount { resource_type: 26, amount: 10 }].span());
    assert_eq!(arrival(deployment, maker, 50, 20), array![ResourceAmount { resource_type: 3, amount: 20 }].span());
}

#[test]
fn trade_creation_and_cancellation_emit_their_gameplay_stories() {
    let (d, maker, _) = setup();
    let mut spy = spy_events();
    let key = create(d, offer(maker));
    assert!(execute(d, Command::CancelTradeOrder(key.trade_id), 50));
    let mut stories = array![];
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("StoryEvent") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
            stories.append(story.story);
        }
    }
    assert_eq!(stories.len(), 2);
    assert_ne!(*stories.at(0), *stories.at(1));
}
