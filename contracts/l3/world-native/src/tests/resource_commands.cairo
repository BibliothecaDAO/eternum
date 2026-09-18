use eternum_randomness_protocol::entrypoint::{
    IRecordedExecutionDispatcher, IRecordedExecutionDispatcherTrait, IRecordedExecutionViewsDispatcher,
};
use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use crate::arrivals::{ArrivalKey, has_arrived};
use crate::commands::{Command, ExecutionContext, IResourceCommandsSafeDispatcher, IResourceCommandsSafeDispatcherTrait};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::resources::{
    AllowanceKey, IResourceAllowanceDispatcher, IResourceAllowanceDispatcherTrait, IResourcesDispatcher,
    IResourcesDispatcherTrait, IResourcesSafeDispatcher, IResourcesSafeDispatcherTrait, ResourceAmount,
    ResourceApproval, ResourceBurn, ResourceKey, ResourceRule, ResourceSlot,
};
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use crate::settlement::{
    ISettlementCreationDispatcher, ISettlementCreationDispatcherTrait, RealmCreation, SettlementCreation,
};
use crate::structures::{IStructuresDispatcher, IStructuresDispatcherTrait, StructureRecord};
use crate::troops::{Coord, ExplorerKey, ITroopsDispatcher, ITroopsDispatcherTrait};
use super::recorded_receipts::RecordedReceiptsTrait;
use super::{Deployment, authority, context, intent, recorded, signature};

pub fn setup() -> (Deployment, ResourceKey, ResourceKey) {
    setup_with_rules(recorded::rules())
}

pub fn setup_with_rules(rules: crate::rules::SliceRules) -> (Deployment, ResourceKey, ResourceKey) {
    let deployment = super::setup_with_domains(true, "StructuresDomain", "TroopsDomain");
    let peers = deployment.peers;
    let games = IGameDispatcher { contract_address: peers.season };
    start_cheat_caller_address(peers.season, authority());
    games
        .create_game(
            3,
            crate::game::GameRegistry {
                dev_mode_on: false,
                start_settling_at: 10,
                start_main_at: 20,
                end_at: 200,
                end_grace_seconds: 10,
                ..games.game(1),
            },
            rules,
        );
    stop_cheat_caller_address(peers.season);
    let mut rules = array![];
    for resource_type in 1_u8..59 {
        rules
            .append(
                ResourceRule {
                    resource_type,
                    unit_weight: if resource_type == 58 {
                        0
                    } else {
                        1
                    },
                    realm_rate: 2,
                    village_rate: 1,
                    labor_output_per_resource: 0,
                },
            );
    }
    let resources = IResourcesDispatcher { contract_address: peers.resources };
    start_cheat_caller_address(peers.resources, authority());
    resources.configure_resources(3, rules.span());
    stop_cheat_caller_address(peers.resources);
    start_cheat_caller_address(peers.structures, peers.settlement);
    let creation = ISettlementCreationDispatcher { contract_address: peers.structures };
    let mut ids = array![];
    for offset in array![0_u32, 10] {
        ids
            .append(
                creation
                    .create_settlement(
                        3,
                        deployment.actor,
                        Coord { alt: false, x: 2000000 + offset, y: 2000000 },
                        SettlementCreation::Realm(
                            RealmCreation {
                                realm_id: 1,
                                traits: crate::realms::RealmTraits { wonder: 0, order: 0, resources: array![].span() },
                                grant_troops: false,
                                activate_economy: false,
                            },
                        ),
                        ExecutionContext { timestamp: 30, ..context() },
                    ),
            );
    }
    stop_cheat_caller_address(peers.structures);
    let source = ResourceKey { game_id: 3, entity_id: *ids.at(0) };
    start_cheat_caller_address(peers.resources, peers.structures);
    resources.grant_resource(source, 1, 100, 30);
    resources.start_production(source, 1, 2, 100, 30);
    stop_cheat_caller_address(peers.resources);
    (deployment, source, ResourceKey { game_id: 3, entity_id: *ids.at(1) })
}

pub fn execute(deployment: Deployment, command: Command, timestamp: u64) -> bool {
    execute_recorded_at(deployment, command, timestamp, timestamp)
}

pub fn execute_recorded_at(deployment: Deployment, command: Command, timestamp: u64, executed_at: u64) -> bool {
    execute_in_game(deployment, 3, command, timestamp, executed_at)
}

pub fn execute_in_game(
    deployment: Deployment, game_id: u32, command: Command, timestamp: u64, executed_at: u64,
) -> bool {
    let season = ISeasonDispatcher { contract_address: deployment.peers.season };
    let action = recorded::FixtureAction {
        command,
        rules: IGameDispatcher { contract_address: deployment.peers.season }.rules(game_id),
        nonce: season.next_nonce(game_id, deployment.actor),
        deadline: 10000,
        ..intent(deployment, game_id),
    };
    let (r, s) = signature(deployment, action);
    start_cheat_block_timestamp_global(executed_at);
    let ticket = recorded::make_intent(deployment.peers.season, action);
    let recorded_context = recorded::make_context(
        deployment.peers.season, action, ExecutionContext { timestamp, ..context() },
    );
    snforge_std::cheat_caller_address(
        deployment.peers.season, super::submitter(), snforge_std::CheatSpan::TargetCalls(1),
    );
    IRecordedExecutionDispatcher { contract_address: deployment.peers.season }.execute(ticket, recorded_context, r, s);
    IRecordedExecutionViewsDispatcher { contract_address: deployment.peers.season }
        .recorded_outcome(season.execution_head().order)
        .unwrap()
        .status == 1
}

fn amount(resource_type: u8, amount: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type, amount }].span()
}

#[test]
fn explicit_burn_does_not_harvest_and_rejection_keeps_the_stream_moving() {
    let (deployment, source, _) = setup();
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let slot = ResourceSlot { game_id: 3, entity_id: source.entity_id, resource_type: 1 };
    let burn = ResourceBurn { entity_id: source.entity_id, resources: amount(1, 10) };
    assert!(execute(deployment, Command::BurnStructureResources(burn), 40));
    assert_eq!(resources.resource_balance(slot), 90);
    assert_eq!(resources.resource_production(slot).last_updated_at, 30);
    assert!(execute(deployment, Command::ClaimProduction(source.entity_id), 40));
    assert_eq!(resources.resource_balance(slot), 110);
    let production = resources.resource_production(slot);
    assert!(
        !execute(deployment, Command::BurnStructureResources(ResourceBurn { resources: amount(1, 120), ..burn }), 45),
    );
    assert_eq!(resources.resource_balance(slot), 110);
    assert_eq!(resources.resource_production(slot), production);
    assert!(execute(deployment, Command::BurnStructureResources(burn), 45));
    assert_eq!(resources.resource_balance(slot), 100);
    assert_eq!(ISeasonDispatcher { contract_address: deployment.peers.season }.next_nonce(3, deployment.actor), 4);
}

#[test]
fn approvals_overwrite_and_revoke_through_the_inclusive_grace_deadline() {
    let (deployment, source, destination) = setup();
    let approval = ResourceApproval {
        owner_entity_id: source.entity_id, approved_entity_id: destination.entity_id, resources: amount(1, 50),
    };
    let key = AllowanceKey {
        game_id: 3, owner_entity_id: source.entity_id, approved_entity_id: destination.entity_id, resource_type: 1,
    };
    let resources = IResourceAllowanceDispatcher { contract_address: deployment.peers.resources };
    assert!(!execute(deployment, Command::ApproveResources(approval), 19));
    assert!(execute(deployment, Command::ApproveResources(approval), 20));
    assert_eq!(resources.resource_allowance(key), 50);
    assert!(
        execute(deployment, Command::ApproveResources(ResourceApproval { resources: amount(1, 0), ..approval }), 30),
    );
    assert_eq!(resources.resource_allowance(key), 0);
    assert!(execute(deployment, Command::ApproveResources(approval), 210));
    assert!(
        !execute(deployment, Command::ApproveResources(ResourceApproval { resources: amount(1, 7), ..approval }), 211),
    );
    assert_eq!(resources.resource_allowance(key), 50);
    assert_eq!(resources.resource_allowance(AllowanceKey { game_id: 2, ..key }), 0);
}

#[test]
#[feature("safe_dispatcher")]
fn resource_mutations_reject_players_and_the_wrong_domain() {
    let (deployment, source, _) = setup();
    let resources = IResourcesSafeDispatcher { contract_address: deployment.peers.resources };
    let commands = IResourceCommandsSafeDispatcher { contract_address: deployment.peers.resources };
    for caller in array![deployment.actor, deployment.peers.map, deployment.peers.settlement] {
        start_cheat_caller_address(deployment.peers.resources, caller);
        assert!(resources.grant_resource(source, 1, 100, 40).is_err());
        assert!(resources.spend_resource(source, 1, 100, 40).is_err());
        assert!(resources.start_production(source, 1, 2, 100, 40).is_err());
        assert!(resources.destroy_resources(source).is_err());
        assert!(
            commands
                .burn_structure_resources(
                    3,
                    deployment.actor,
                    ResourceBurn { entity_id: source.entity_id, resources: amount(1, 1) },
                    context(),
                )
                .is_err(),
        );
    }
    stop_cheat_caller_address(deployment.peers.resources);
    assert_eq!(
        IResourcesDispatcher { contract_address: deployment.peers.resources }
            .resource_balance(ResourceSlot { game_id: 3, entity_id: source.entity_id, resource_type: 1 }),
        100,
    );
}

pub fn set_fixture<T, +starknet::storage_access::Store<T>, +Drop<T>, +Copy<T>>(
    address: starknet::ContractAddress, name: felt252, keys: Span<felt252>, value: T,
) {
    let base = starknet::storage_access::storage_base_address_from_felt252(snforge_std::map_entry_address(name, keys));
    snforge_std::interact_with_state(address, || starknet::storage_access::Store::<T>::write(0, base, value).unwrap());
}

fn explorer_fixture(deployment: Deployment, id: u32, owner: u32, coord: Coord, capacity: u128) -> ResourceKey {
    set_fixture(
        deployment.peers.troops,
        selector!("explorers"),
        array![3, id.into()].span(),
        crate::troops::ExplorerTroops { owner, coord, ..Default::default() },
    );
    set_fixture(deployment.peers.troops, selector!("exists"), array![3, id.into()].span(), true);
    let key = ResourceKey { game_id: 3, entity_id: id };
    start_cheat_caller_address(deployment.peers.resources, deployment.peers.structures);
    IResourcesDispatcher { contract_address: deployment.peers.resources }.initialize_resources(key, capacity, 0, 30);
    stop_cheat_caller_address(deployment.peers.resources);
    key
}

pub fn grant(deployment: Deployment, key: ResourceKey, resource_type: u8, amount: u128) {
    start_cheat_caller_address(deployment.peers.resources, deployment.peers.structures);
    IResourcesDispatcher { contract_address: deployment.peers.resources }
        .grant_resource(key, resource_type, amount, 30);
    stop_cheat_caller_address(deployment.peers.resources);
}

#[test]
fn explorer_transfers_keep_capacity_loss_and_reject_wrong_layers_atomically() {
    let (deployment, home, _) = setup();
    let from = explorer_fixture(deployment, 70, home.entity_id, Coord { alt: true, x: 2000000, y: 2000000 }, 100);
    let to = explorer_fixture(deployment, 71, home.entity_id, Coord { alt: true, x: 2000015, y: 2000000 }, 5);
    let surface = explorer_fixture(deployment, 72, home.entity_id, Coord { alt: false, x: 2000015, y: 2000000 }, 100);
    grant(deployment, from, 1, 50);
    assert_eq!(
        ITroopsDispatcher { contract_address: deployment.peers.troops }
            .authorized_explorer(ExplorerKey { game_id: 3, explorer_id: from.entity_id }, deployment.actor)
            .owner,
        home.entity_id,
    );
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let command = crate::resources::ResourceTransfer {
        from_entity_id: from.entity_id, to_entity_id: to.entity_id, resources: amount(1, 10),
    };
    assert!(execute(deployment, Command::TransferExplorerResources(command), 40));
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: 1 }), 40,
    );
    assert_eq!(resources.resource_balance(ResourceSlot { game_id: 3, entity_id: to.entity_id, resource_type: 1 }), 5);
    let production = resources
        .resource_production(ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: 1 });
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
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: 1 }), 40,
    );
    assert_eq!(
        resources.resource_production(ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: 1 }),
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
fn structure_transfer_harvests_but_rejects_all_nine_troop_resources() {
    let (deployment, home, _) = setup();
    let explorer = explorer_fixture(deployment, 70, home.entity_id, Coord { alt: false, x: 2000001, y: 2000000 }, 100);
    let transfer = crate::resources::ResourceTransfer {
        from_entity_id: home.entity_id, to_entity_id: explorer.entity_id, resources: amount(1, 110),
    };
    assert!(execute(deployment, Command::TransferStructureResourcesToExplorer(transfer), 40));
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 1 }), 10,
    );
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: explorer.entity_id, resource_type: 1 }), 100,
    );
    for resource_type in 26_u8..35 {
        grant(deployment, home, resource_type, 100);
        assert!(
            !execute(
                deployment,
                Command::TransferStructureResourcesToExplorer(
                    crate::resources::ResourceTransfer { resources: amount(resource_type, 1), ..transfer },
                ),
                40,
            ),
        );
        assert_eq!(
            resources.resource_balance(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type }), 100,
        );
    }
}

#[test]
fn regularization_is_permissionless_excludes_production_and_keeps_overcapacity_weight() {
    let (deployment, home, _) = setup();
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let keys = array![3, home.entity_id.into()].span();
    set_fixture(
        deployment.peers.resources,
        selector!("weights"),
        keys,
        crate::resources::Weight { capacity: 1000, weight: 200 },
    );
    let command = Command::RegularizeResourceWeights(array![home.entity_id].span());
    assert!(execute(deployment, command, 40));
    assert_eq!(resources.resource_weight(home), crate::resources::Weight { capacity: 1000, weight: 100 });
    assert_eq!(
        resources
            .resource_production(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 1 })
            .last_updated_at,
        30,
    );
    let overcapacity = crate::resources::Weight { capacity: 50, weight: 200 };
    set_fixture(deployment.peers.resources, selector!("weights"), keys, overcapacity);
    assert!(execute(deployment, command, 40));
    assert_eq!(resources.resource_weight(home), overcapacity);
    start_cheat_caller_address(deployment.peers.resources, deployment.peers.season);
    crate::commands::IResourceCommandsDispatcherTrait::regularize_resource_weights(
        crate::commands::IResourceCommandsDispatcher { contract_address: deployment.peers.resources },
        3,
        authority(),
        array![home.entity_id].span(),
        ExecutionContext { timestamp: 40, ..context() },
    );
    stop_cheat_caller_address(deployment.peers.resources);
    assert!(!execute(deployment, Command::RegularizeResourceWeights(array![].span()), 40));
    assert!(!execute(deployment, Command::RegularizeResourceWeights(array![999].span()), 40));
}

fn arrival_fixture(
    deployment: Deployment, entity_id: u32, slot: u8, values: Span<ResourceAmount>,
) -> crate::arrivals::ArrivalKey {
    let key = crate::arrivals::ArrivalKey { game_id: 3, entity_id, day: 0, slot };
    set_fixture(
        deployment.peers.resources,
        selector!("arrival_bounds"),
        array![3, entity_id.into(), 0, slot.into()].span(),
        Into::<u32, u64>::into(values.len()),
    );
    for index in 0..values.len() {
        set_fixture(
            deployment.peers.resources,
            selector!("arrival_items"),
            array![3, entity_id.into(), 0, slot.into(), index.into()].span(),
            *values.at(index),
        );
    }
    key
}

#[test]
fn arrivals_offload_only_the_requested_prefix_and_delete_the_last_row() {
    let (deployment, home, _) = setup();
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
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
    let key = arrival_fixture(deployment, home.entity_id, 1, amount(2, 30));
    set_fixture(
        deployment.peers.resources,
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
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    assert!(resources.resource_arrival(key).resources.is_empty());
    assert_eq!(resources.resource_balance(ResourceSlot { game_id: 3, entity_id: home.entity_id, resource_type: 2 }), 0);
    assert_eq!(resources.resource_weight(home), crate::resources::Weight { capacity: 100, weight: 100 });
}

#[test]
fn village_arrivals_wait_for_both_season_and_creation_immunity() {
    for (village_ticks, available_at) in array![(1_u8, 120_u64), (3_u8, 180_u64)] {
        let mut rules = recorded::rules();
        rules.tick_config.delivery_tick_in_seconds = 30;
        rules.battle_config.regular_immunity_ticks = 2;
        rules.battle_config.village_immunity_ticks = village_ticks;
        let (deployment, home, _) = setup_with_rules(rules);
        let structure = IStructuresDispatcher { contract_address: deployment.peers.structures }
            .structure(home)
            .unwrap();
        set_fixture(
            deployment.peers.structures,
            selector!("structures"),
            array![3, home.entity_id.into()].span(),
            StructureRecord {
                owner: structure.owner,
                base: crate::structures::StructureBase {
                    category: crate::ownership::VILLAGE_CATEGORY, ..structure.base,
                },
                resources_packed: structure.resources_packed,
                metadata: structure.metadata,
            },
        );
        let values = amount(2, 30);
        let key = arrival_fixture(deployment, home.entity_id, 1, values);
        let command = Command::OffloadArrival(
            crate::arrivals::OffloadArrival { entity_id: home.entity_id, day: 0, slot: 1, resource_count: 1 },
        );
        let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
        assert!(!execute(deployment, command, available_at - 1));
        assert_eq!(resources.resource_arrival(key).resources, values);
        assert!(execute(deployment, command, available_at));
        assert!(resources.resource_arrival(key).resources.is_empty());
    }
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

pub fn resource_facts(deployment: Deployment, key: ResourceKey) -> Array<felt252> {
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let mut values = array![];
    resources.resource_weight(key).serialize(ref values);
    for resource_type in 1_u8..59 {
        let slot = ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type };
        resources.resource_balance(slot).serialize(ref values);
        resources.resource_production(slot).serialize(ref values);
    }
    values
}

pub fn assert_terminal_rejection(deployment: Deployment, command: Command, timestamp: u64) {
    let season = ISeasonDispatcher { contract_address: deployment.peers.season };
    let nonce = season.next_nonce(3, deployment.actor);
    let order = season.execution_head().order;
    assert!(!execute(deployment, command, timestamp));
    assert_eq!(season.next_nonce(3, deployment.actor), nonce + 1);
    assert_eq!(season.execution_head().order, order + 1);
    let result = IRecordedExecutionViewsDispatcher { contract_address: deployment.peers.season }
        .recorded_outcome(order + 1)
        .unwrap();
    assert_eq!(result.status, 2);
    assert_eq!(result.reason, 'GAMEPLAY_REJECTED');
}

#[test]
fn every_transfer_rejects_duplicates_without_changing_facts_and_consumes_the_ticket() {
    let (deployment, from, to) = setup();
    let explorer = explorer_fixture(deployment, 70, from.entity_id, Coord { alt: false, x: 2000001, y: 2000000 }, 1000);
    let other = explorer_fixture(deployment, 71, from.entity_id, Coord { alt: false, x: 2000002, y: 2000000 }, 1000);
    grant(deployment, explorer, 1, 100);
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
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
        Command::SendResources(transfer), Command::PickupResources(transfer),
        Command::TransferStructureResourcesToExplorer(
            crate::resources::ResourceTransfer { to_entity_id: explorer.entity_id, ..transfer },
        ),
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
fn sending_and_pickup_preserve_arrival_order_allowances_and_donkey_costs() {
    let (deployment, from, to) = setup();
    let precision = crate::rules::RESOURCE_PRECISION;
    grant(deployment, from, 25, 10 * precision);
    grant(deployment, to, 25, 10 * precision);
    let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
    let transfer = crate::resources::ResourceTransfer {
        from_entity_id: from.entity_id, to_entity_id: to.entity_id, resources: amount(1, 10),
    };
    assert!(execute(deployment, Command::SendResources(transfer), 40));
    // Ten surface hexes at nine seconds each: arrival remains in slot one.
    let key = ArrivalKey { game_id: 3, entity_id: to.entity_id, day: 0, slot: 1 };
    assert_eq!(resources.resource_arrival(key).resources, amount(1, 10));
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: from.entity_id, resource_type: 25 }),
        9 * precision,
    );
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: to.entity_id, resource_type: 25 }),
        10 * precision,
    );
    let approval = ResourceApproval {
        owner_entity_id: from.entity_id, approved_entity_id: to.entity_id, resources: amount(1, 15),
    };
    assert!(execute(deployment, Command::ApproveResources(approval), 40));
    assert!(execute(deployment, Command::PickupResources(transfer), 40));
    let allowance = AllowanceKey {
        game_id: 3, owner_entity_id: from.entity_id, approved_entity_id: to.entity_id, resource_type: 1,
    };
    let approvals = IResourceAllowanceDispatcher { contract_address: deployment.peers.resources };
    assert_eq!(approvals.resource_allowance(allowance), 5);
    let return_slot = ArrivalKey { slot: 2, ..key };
    assert_eq!(resources.resource_arrival(return_slot).resources, amount(1, 10));
    assert_eq!(
        resources.resource_balance(ResourceSlot { game_id: 3, entity_id: to.entity_id, resource_type: 25 }),
        9 * precision,
    );
    let before = resource_facts(deployment, from);
    assert_terminal_rejection(deployment, Command::PickupResources(transfer), 40);
    assert_eq!(resource_facts(deployment, from), before);
    assert_eq!(approvals.resource_allowance(allowance), 5);
    assert!(
        execute(
            deployment,
            Command::ApproveResources(
                ResourceApproval { resources: amount(1, 0xffffffffffffffffffffffffffffffff), ..approval },
            ),
            40,
        ),
    );
    assert!(execute(deployment, Command::PickupResources(transfer), 40));
    assert_eq!(approvals.resource_allowance(allowance), 0xffffffffffffffffffffffffffffffff);
    assert_eq!(resources.resource_arrival(return_slot).resources, amount(1, 20));
}

#[test]
fn blitz_troop_deposits_require_ownership_for_category_1() {
    troop_deposit_ownership(true, 1);
}

#[test]
fn blitz_troop_deposits_require_ownership_for_category_2() {
    troop_deposit_ownership(true, 2);
}

#[test]
fn blitz_troop_deposits_require_ownership_for_category_3() {
    troop_deposit_ownership(true, 3);
}

#[test]
fn blitz_troop_deposits_require_ownership_for_category_4() {
    troop_deposit_ownership(true, 4);
}

#[test]
fn blitz_troop_deposits_require_ownership_for_category_5() {
    troop_deposit_ownership(true, 5);
}

#[test]
fn blitz_troop_deposits_require_ownership_for_category_7() {
    troop_deposit_ownership(true, 7);
}

#[test]
fn blitz_troop_deposits_require_ownership_for_category_8() {
    troop_deposit_ownership(true, 8);
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

fn troop_deposit_ownership(blitz_mode_on: bool, category: u8) {
    let (deployment, home, target) = setup_with_rules(crate::rules::SliceRules { blitz_mode_on, ..recorded::rules() });
    let structures = IStructuresDispatcher { contract_address: deployment.peers.structures };
    let structure = structures.structure(target).unwrap();
    let explorer = explorer_fixture(deployment, 70, home.entity_id, Coord { alt: false, x: 2000009, y: 2000000 }, 1000);
    grant(deployment, explorer, 26, 100);
    grant(deployment, explorer, 1, 100);
    let coord = if category == 8 {
        Coord { alt: true, x: 1999995, y: 2000000 }
    } else {
        Coord { alt: false, x: 2000009, y: 2000000 }
    };
    set_fixture(
        deployment.peers.troops,
        selector!("explorers"),
        array![3, 70].span(),
        crate::troops::ExplorerTroops { owner: home.entity_id, coord, ..Default::default() },
    );
    for owner in array![deployment.actor, 0x998.try_into().unwrap(), 0x999.try_into().unwrap()] {
        set_fixture(
            deployment.peers.structures,
            selector!("structures"),
            array![3, target.entity_id.into()].span(),
            StructureRecord {
                owner,
                base: crate::structures::StructureBase { category, alt: coord.alt, ..structure.base },
                metadata: crate::structures::StructureMetadata { village_realm: home.entity_id, ..structure.metadata },
                resources_packed: structure.resources_packed,
            },
        );
        let transfer = crate::resources::ResourceTransfer {
            from_entity_id: 70,
            to_entity_id: target.entity_id,
            resources: array![
                ResourceAmount { resource_type: 1, amount: 1 }, ResourceAmount { resource_type: 26, amount: 1 },
            ]
                .span(),
        };
        if owner == deployment.actor {
            assert!(
                execute(deployment, Command::TransferExplorerResourcesToStructure(transfer), 40),
                "owner deposit rejected for category {}",
                category,
            );
        } else {
            let before_source = resource_facts(deployment, explorer);
            let before_target = resource_facts(deployment, target);
            assert_terminal_rejection(deployment, Command::TransferExplorerResourcesToStructure(transfer), 40);
            assert_eq!(resource_facts(deployment, explorer), before_source);
            assert_eq!(resource_facts(deployment, target), before_target);
        }
        assert!(
            execute(
                deployment,
                Command::TransferExplorerResourcesToStructure(
                    crate::resources::ResourceTransfer { resources: amount(1, 1), ..transfer },
                ),
                40,
            ),
        );
    }
}

fn village_fixture(deployment: Deployment, key: ResourceKey, owner: starknet::ContractAddress) {
    let structure = IStructuresDispatcher { contract_address: deployment.peers.structures }.structure(key).unwrap();
    set_fixture(
        deployment.peers.structures,
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        StructureRecord {
            owner,
            base: crate::structures::StructureBase { category: crate::ownership::VILLAGE_CATEGORY, ..structure.base },
            resources_packed: structure.resources_packed,
            metadata: crate::structures::StructureMetadata { village_realm: 12345, ..structure.metadata },
        },
    );
}

#[test]
fn delayed_village_troops_ignore_the_connection_and_keep_transport_ownership_rules() {
    for blitz_mode_on in array![false, true] {
        let (deployment, from, to) = setup_with_rules(crate::rules::SliceRules { blitz_mode_on, ..recorded::rules() });
        village_fixture(deployment, to, deployment.actor);
        grant(deployment, from, 26, 100);
        grant(deployment, from, 25, 10 * crate::rules::RESOURCE_PRECISION);
        let transfer = crate::resources::ResourceTransfer {
            from_entity_id: from.entity_id, to_entity_id: to.entity_id, resources: amount(26, 30),
        };
        assert!(execute(deployment, Command::SendResources(transfer), 40));
        let resources = IResourcesDispatcher { contract_address: deployment.peers.resources };
        let arrival = ArrivalKey { game_id: 3, entity_id: to.entity_id, day: 0, slot: 2 };
        assert_eq!(resources.resource_arrival(arrival).resources, amount(26, 30));
        village_fixture(deployment, to, 0x999.try_into().unwrap());
        if blitz_mode_on {
            let before = resource_facts(deployment, from);
            assert_terminal_rejection(deployment, Command::SendResources(transfer), 40);
            assert_eq!(resource_facts(deployment, from), before);
            assert_eq!(resources.resource_arrival(arrival).resources, amount(26, 30));
        } else {
            assert!(execute(deployment, Command::SendResources(transfer), 40));
            assert_eq!(resources.resource_arrival(arrival).resources, amount(26, 60));
        }
    }
}

#[test]
fn duplicate_ids_in_approvals_burns_and_weight_repair_reject_without_mutating_balances() {
    let (d, source, target) = setup();
    let before = resource_facts(d, source);
    let resources = array![
        ResourceAmount { resource_type: 1, amount: 10 }, ResourceAmount { resource_type: 1, amount: 20 },
    ]
        .span();
    for command in array![
        Command::ApproveResources(
            ResourceApproval { owner_entity_id: source.entity_id, approved_entity_id: target.entity_id, resources },
        ),
        Command::BurnStructureResources(ResourceBurn { entity_id: source.entity_id, resources }),
        Command::RegularizeResourceWeights(array![source.entity_id, source.entity_id].span()),
    ] {
        assert_terminal_rejection(d, command, 40);
        assert_eq!(resource_facts(d, source), before);
    }
    let allowance = crate::resources::IResourceAllowanceDispatcher { contract_address: d.peers.resources }
        .resource_allowance(
            AllowanceKey {
                game_id: 3, owner_entity_id: source.entity_id, approved_entity_id: target.entity_id, resource_type: 1,
            },
        );
    assert_eq!(allowance, 0);
}
