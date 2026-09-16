use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use crate::commands::{Command, ExecutionContext};
use crate::resources::{IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceKey, ResourceSlot};
use crate::rules::RESOURCE_PRECISION;
use crate::trade::{
    AcceptOrder, CreateOrder, ITradeDispatcher, ITradeDispatcherTrait, ITradeSafeDispatcher, ITradeSafeDispatcherTrait,
    TradeKey, TradeRules,
};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, grant, setup_with_rules};

fn setup() -> (super::Deployment, ResourceKey, ResourceKey) {
    let mut rules = super::recorded::rules();
    rules.blitz_mode_on = false;
    rules.speed_config.donkey_sec_per_km = 1;
    rules.speed_config.donkey_sec_per_km_troops = 2;
    rules.tick_config.delivery_tick_in_seconds = 1;
    rules.capacity_config.donkey_capacity = 10;
    let (deployment, maker, taker) = setup_with_rules(rules);
    let trades = ITradeDispatcher { contract_address: deployment.peers.economy };
    start_cheat_caller_address(deployment.peers.economy, super::authority());
    trades.configure_trade(3, TradeRules { max_count: 2 });
    stop_cheat_caller_address(deployment.peers.economy);
    for key in array![maker, taker] {
        grant(deployment, key, 2, 1000);
        grant(deployment, key, 3, 1000);
        grant(deployment, key, 25, 10 * RESOURCE_PRECISION);
    }
    (deployment, maker, taker)
}
fn offer(maker: ResourceKey) -> CreateOrder {
    CreateOrder {
        maker_id: maker.entity_id,
        taker_id: 0,
        offered_resource: 2,
        requested_resource: 3,
        offered_per_lot: 10,
        requested_per_lot: 20,
        lots: 3,
        expires_at: 180,
    }
}
fn balance(deployment: super::Deployment, key: ResourceKey, resource_type: u8) -> u128 {
    IResourcesDispatcher { contract_address: deployment.peers.resources }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type })
}
fn create(deployment: super::Deployment, command: CreateOrder) -> TradeKey {
    assert!(execute(deployment, Command::CreateTradeOrder(command), 40));
    let view = ITradeDispatcher { contract_address: deployment.peers.economy };
    let mut latest = 0;
    for trade_id in 1_u32..100 {
        if view.trade_order(TradeKey { game_id: 3, trade_id }).is_some() {
            latest = trade_id;
        }
    }
    assert!(latest != 0);
    TradeKey { game_id: 3, trade_id: latest }
}
fn accept(key: TradeKey, taker: ResourceKey, lots: u64) -> Command {
    Command::AcceptTradeOrder(AcceptOrder { trade_id: key.trade_id, taker_id: taker.entity_id, lots })
}
fn arrival(deployment: super::Deployment, key: ResourceKey, at: u64, duration: u64) -> Span<ResourceAmount> {
    IResourcesDispatcher { contract_address: deployment.peers.resources }
        .resource_arrival(crate::arrivals::arrival_key(3, key.entity_id, 1, at, duration))
        .resources
}
#[test]
fn public_trade_escrows_once_and_partial_fills_deliver_both_sides() {
    let (deployment, maker, taker) = setup();
    let key = create(deployment, offer(maker));
    assert_eq!(balance(deployment, maker, 2), 970);
    assert_eq!(balance(deployment, maker, 25), 9 * RESOURCE_PRECISION);
    assert!(execute(deployment, accept(key, taker, 1), 50));
    let view = ITradeDispatcher { contract_address: deployment.peers.economy };
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
fn malformed_offers_reject_atomically_and_consume_only_the_ticket() {
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
    assert_eq!(
        ITradeDispatcher { contract_address: deployment.peers.economy }.trade_order(key).unwrap().remaining_lots, 3,
    );
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
    let structures = crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures };
    let record = crate::structures::IStructuresDispatcherTrait::structure(structures, maker).unwrap();
    super::resource_commands::set_fixture(
        deployment.peers.structures,
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
fn recorded_trade_times_survive_outages_and_cancel_has_only_game_grace() {
    let (deployment, maker, taker) = setup();
    let key = create(deployment, offer(maker));
    assert!(execute_recorded_at(deployment, accept(key, taker, 1), 50, 1000));
    assert_eq!(arrival(deployment, taker, 50, 20), array![ResourceAmount { resource_type: 2, amount: 10 }].span());
    assert_terminal_rejection(deployment, Command::CancelTradeOrder(key.trade_id), 211);
    assert!(execute_recorded_at(deployment, Command::CancelTradeOrder(key.trade_id), 210, 1000));
    assert_eq!(balance(deployment, maker, 2), 990);
}
#[test]
#[feature("safe_dispatcher")]
fn trade_rules_are_immutable_game_scoped_and_internal_calls_authenticated() {
    let (deployment, maker, _) = setup();
    let economy = deployment.peers.economy;
    let safe = ITradeSafeDispatcher { contract_address: economy };
    start_cheat_block_timestamp_global(40);
    start_cheat_caller_address(economy, deployment.actor);
    assert!(safe.configure_trade(1, TradeRules { max_count: 1 }).is_err());
    assert!(
        safe
            .create_trade_order(
                3, deployment.actor, offer(maker), ExecutionContext { timestamp: 40, ..super::context() },
            )
            .is_err(),
    );
    start_cheat_caller_address(economy, super::authority());
    assert!(safe.configure_trade(3, TradeRules { max_count: 1 }).is_err());
    safe.configure_trade(1, TradeRules { max_count: 1 }).unwrap();
    assert_eq!(safe.trade_rules(1).unwrap().max_count, 1);
    assert_eq!(safe.trade_rules(3).unwrap().max_count, 2);
    assert!(safe.trade_rules(2).is_err());
    stop_cheat_caller_address(economy);
    let key = create(deployment, offer(maker));
    assert!(safe.trade_order(TradeKey { game_id: 1, trade_id: key.trade_id }).unwrap().is_none());
    start_cheat_caller_address(deployment.peers.resources, deployment.actor);
    assert!(
        crate::trade::IEconomyDeliverySafeDispatcherTrait::queue_economy_delivery(
            crate::trade::IEconomyDeliverySafeDispatcher { contract_address: deployment.peers.resources },
            maker,
            ResourceAmount { resource_type: 2, amount: 10 },
            0,
            40,
        )
            .is_err(),
    );
}

fn change_structure(deployment: super::Deployment, key: ResourceKey, category: u8, alt: bool) {
    let view = crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures };
    let structure = crate::structures::IStructuresDispatcherTrait::structure(view, key).unwrap();
    super::resource_commands::set_fixture(
        deployment.peers.structures,
        selector!("structures"),
        array![3, key.entity_id.into()].span(),
        crate::structures::StructureRecord {
            owner: structure.owner,
            base: crate::structures::StructureBase { category, alt, ..structure.base },
            resources_packed: structure.resources_packed,
            metadata: structure.metadata,
        },
    );
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
    let mut rules = super::recorded::rules();
    rules.blitz_mode_on = true;
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
    assert_eq!(
        ITradeDispatcher { contract_address: deployment.peers.economy }.trade_order(key).unwrap().remaining_lots, 3,
    );
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
    let second = create(deployment, offer(maker));
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
