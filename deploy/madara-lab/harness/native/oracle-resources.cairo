use dojo::model::{ModelStorage, ModelStorageTest};
use dojo::world::WorldStorageTrait;
use snforge_std::{
    start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address,
};
use world_native::arrivals::{ArrivalKey, OffloadArrival};
use world_native::commands::Command;
use world_native::resources::{
    AllowanceKey, IResourceAllowanceDispatcher, IResourceAllowanceDispatcherTrait,
    IResourcesDispatcher, IResourcesDispatcherTrait, ResourceAmount, ResourceApproval, ResourceBurn,
    ResourceKey, ResourceTransfer,
};
use crate::constants::RESOURCE_PRECISION;
use crate::models::position::Coord;
use crate::models::resource::arrivals::ResourceArrivalImpl;
use crate::models::resource::resource::ResourceAllowance;
use crate::systems::resources::contracts::resource_systems::{
    IResourceSystemsSafeDispatcher, IResourceSystemsSafeDispatcherTrait,
};
use super::{
    PairedWorld, compare_explorer, compare_facts, compare_home, execute_outcome,
    provision_with_resources, set_native_fixture, setup,
};

fn resources(resource_type: u8, amount: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type, amount }].span()
}

fn original_resources(values: Span<ResourceAmount>) -> Span<(u8, u128)> {
    let mut result = array![];
    for value in values {
        result.append((*value.resource_type, *value.amount));
    }
    result.span()
}

#[feature("safe_dispatcher")]
fn action(
    worlds: PairedWorld,
    command: Command,
    name: felt252,
    step: u32,
    from: u32,
    to: u32,
    expected: bool,
) {
    action_at(worlds, command, name, step, from, to, expected, 1800 + 60 * step.into());
}

#[feature("safe_dispatcher")]
fn action_at(
    worlds: PairedWorld,
    command: Command,
    name: felt252,
    step: u32,
    from: u32,
    to: u32,
    expected: bool,
    timestamp: u64,
) {
    start_cheat_block_timestamp_global(timestamp);
    let (address, _) = worlds.oracle.dns(@"resource_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    let oracle = IResourceSystemsSafeDispatcher { contract_address: address };
    let outcome = match command {
        Command::ApproveResources(value) => oracle
            .approve(
                1,
                value.owner_entity_id,
                value.approved_entity_id,
                original_resources(value.resources),
            )
            .is_ok(),
        Command::BurnStructureResources(value) => oracle
            .structure_burn(1, value.entity_id, original_resources(value.resources))
            .is_ok(),
        Command::BurnExplorerResources(value) => oracle
            .troop_burn(1, value.entity_id, original_resources(value.resources))
            .is_ok(),
        Command::TransferExplorerResources(value) => oracle
            .troop_troop_adjacent_transfer(
                1, value.from_entity_id, value.to_entity_id, original_resources(value.resources),
            )
            .is_ok(),
        Command::TransferStructureResourcesToExplorer(value) => oracle
            .structure_troop_adjacent_transfer(
                1, value.from_entity_id, value.to_entity_id, original_resources(value.resources),
            )
            .is_ok(),
        Command::SendResources(value) => oracle
            .send(1, value.from_entity_id, value.to_entity_id, original_resources(value.resources))
            .is_ok(),
        Command::PickupResources(value) => oracle
            .pickup(
                1, value.to_entity_id, value.from_entity_id, original_resources(value.resources),
            )
            .is_ok(),
        Command::TransferExplorerResourcesToStructure(value) => oracle
            .troop_structure_adjacent_transfer(
                1, value.from_entity_id, value.to_entity_id, original_resources(value.resources),
            )
            .is_ok(),
        Command::OffloadArrival(value) => oracle
            .arrivals_offload(1, value.entity_id, value.day, value.slot, value.resource_count)
            .is_ok(),
        Command::RegularizeResourceWeights(values) => {
            let mut ids = array![];
            for id in values {
                ids.append(*id);
            }
            oracle.structure_regularize_weight(1, ids).is_ok()
        },
        _ => panic!("unsupported resource parity command"),
    };
    stop_cheat_caller_address(address);
    assert_eq!(outcome, expected, "oracle resource outcome");
    let (order, native) = execute_outcome(worlds, command, timestamp, 1234);
    assert_eq!(native, outcome, "native resource outcome");
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, name, timestamp, native);
    match command {
        Command::OffloadArrival(_) => {
            compare_home(worlds, step, from);
            compare_arrivals(worlds, step, from);
        },
        Command::SendResources(_) |
        Command::PickupResources(_) => {
            compare_home(worlds, step, from);
            compare_home(worlds, step, to);
            for slot in 11_u8..15 {
                compare_arrival(
                    worlds, step, ArrivalKey { game_id: 1, entity_id: to, day: 0, slot },
                );
            }
        },
        Command::TransferExplorerResourcesToStructure(value) => {
            compare_explorer(worlds, step, value.from_entity_id);
            compare_home(worlds, step, value.to_entity_id);
        },
        Command::BurnStructureResources(_) => { compare_home(worlds, step, from); },
        Command::RegularizeResourceWeights(_) => {
            compare_home(worlds, step, from);
            compare_home(worlds, step, to);
        },
        Command::BurnExplorerResources(_) => { compare_explorer(worlds, step, 71); },
        Command::TransferExplorerResources(_) => {
            compare_explorer(worlds, step, 70);
            compare_explorer(worlds, step, 71);
        },
        Command::TransferStructureResourcesToExplorer(_) => {
            compare_home(worlds, step, from);
            compare_explorer(worlds, step, 70);
        },
        _ => {},
    }
    compare_facts(
        worlds.case,
        step,
        'AgentOwner',
        array![1, 71].span(),
        world_native::ownership::IAgentOwnershipDispatcherTrait::agent_owner(
            world_native::ownership::IAgentOwnershipDispatcher {
                contract_address: worlds.peers.troops,
            },
            1,
            71,
        ),
        dojo::model::ModelStorage::<
            dojo::world::WorldStorage, crate::models::agent::AgentOwner,
        >::read_model(@worlds.oracle, (1, 71)),
    );
    let allowance: ResourceAllowance = worlds.oracle.read_model((1, from, to, 1_u8));
    let key = AllowanceKey {
        game_id: 1, owner_entity_id: from, approved_entity_id: to, resource_type: 1,
    };
    compare_facts(
        worlds.case,
        step,
        'ResourceAllowance',
        array![1, from.into(), to.into(), 1].span(),
        IResourceAllowanceDispatcher { contract_address: worlds.peers.resources }
            .resource_allowance(key),
        allowance.amount,
    );
}

fn setup_case(case: felt252) -> (PairedWorld, u32, u32) {
    let mut worlds = setup(case);
    let from = provision_with_resources(
        ref worlds,
        Coord { alt: false, x: 2147483626, y: 2147483626 },
        array![(1_u8, 200 * RESOURCE_PRECISION)].span(),
    );
    let to = provision_with_resources(
        ref worlds, Coord { alt: false, x: 2147483636, y: 2147483626 }, array![].span(),
    );
    (worlds, from, to)
}

#[feature("safe_dispatcher")]
pub fn approvals() {
    let (worlds, from, to) = setup_case('resources_approvals');
    let approval = ResourceApproval {
        owner_entity_id: from,
        approved_entity_id: to,
        resources: resources(1, 10 * RESOURCE_PRECISION),
    };
    action(worlds, Command::ApproveResources(approval), 'approve', 1, from, to, true);
    action(
        worlds,
        Command::ApproveResources(
            ResourceApproval { resources: resources(1, 30 * RESOURCE_PRECISION), ..approval },
        ),
        'approve',
        2,
        from,
        to,
        true,
    );
    action(
        worlds,
        Command::ApproveResources(ResourceApproval { resources: resources(1, 0), ..approval }),
        'approve',
        3,
        from,
        to,
        true,
    );
    action(
        PairedWorld { actor: worlds.opponent, ..worlds },
        Command::ApproveResources(approval),
        'approve',
        4,
        from,
        to,
        false,
    );
    action(
        worlds,
        Command::ApproveResources(ResourceApproval { approved_entity_id: from, ..approval }),
        'approve',
        5,
        from,
        to,
        false,
    );
    action(
        worlds,
        Command::ApproveResources(ResourceApproval { resources: array![].span(), ..approval }),
        'approve',
        6,
        from,
        to,
        false,
    );
}
#[feature("safe_dispatcher")]
pub fn burns() {
    let (worlds, from, to) = setup_case('resources_burns');
    let burn = ResourceBurn { entity_id: from, resources: resources(1, 10 * RESOURCE_PRECISION) };
    action(worlds, Command::BurnStructureResources(burn), 'structure_burn', 1, from, to, true);
    action(
        worlds,
        Command::BurnStructureResources(
            ResourceBurn { resources: resources(1, 1000 * RESOURCE_PRECISION), ..burn },
        ),
        'structure_burn',
        2,
        from,
        to,
        false,
    );
    action(
        PairedWorld { actor: worlds.opponent, ..worlds },
        Command::BurnStructureResources(burn),
        'structure_burn',
        3,
        from,
        to,
        false,
    );
    action(
        worlds,
        Command::BurnStructureResources(ResourceBurn { resources: array![].span(), ..burn }),
        'structure_burn',
        4,
        from,
        to,
        true,
    );
}
#[feature("safe_dispatcher")]
pub fn regularize() {
    let (worlds, from, to) = setup_case('resources_regularize');
    action(
        worlds,
        Command::RegularizeResourceWeights(array![from, to].span()),
        'structure_regularize_weight',
        1,
        from,
        to,
        true,
    );
    action(
        PairedWorld { actor: worlds.opponent, ..worlds },
        Command::RegularizeResourceWeights(array![from].span()),
        'structure_regularize_weight',
        2,
        from,
        to,
        true,
    );
    action(
        worlds,
        Command::RegularizeResourceWeights(array![].span()),
        'structure_regularize_weight',
        3,
        from,
        to,
        false,
    );
}
fn setup_transfers(case: felt252) -> (PairedWorld, u32, u32) {
    let (mut worlds, from, to) = setup_case(case);
    prepare_explorer(ref worlds, 70, from, 2147483627, 5 * RESOURCE_PRECISION * 1000);
    prepare_explorer(
        ref worlds, 71, crate::constants::DAYDREAMS_AGENT_ID, 2147483628, RESOURCE_PRECISION * 1000,
    );
    worlds
        .oracle
        .write_model_test(
            @crate::models::agent::AgentOwner {
                game_id: 1, explorer_id: 71, address: worlds.actor,
            },
        );
    set_native_fixture(
        worlds.peers.troops, selector!("agent_owners"), array![1, 71].span(), worlds.actor,
    );
    (worlds, from, to)
}
#[feature("safe_dispatcher")]
pub fn transfers() {
    let (worlds, from, to) = setup_transfers('resources_transfers');
    let transfer = ResourceTransfer {
        from_entity_id: from, to_entity_id: 70, resources: resources(1, 10 * RESOURCE_PRECISION),
    };
    action(
        worlds,
        Command::TransferStructureResourcesToExplorer(transfer),
        'structure_to_explorer',
        1,
        from,
        to,
        true,
    );
    let transfer = ResourceTransfer {
        from_entity_id: 70, to_entity_id: 71, resources: resources(1, 3 * RESOURCE_PRECISION),
    };
    action(
        worlds,
        Command::TransferExplorerResources(transfer),
        'troop_troop_adjacent_transfer',
        2,
        from,
        to,
        true,
    );
    let burn = ResourceBurn { entity_id: 71, resources: resources(1, RESOURCE_PRECISION) };
    action(
        PairedWorld { actor: worlds.opponent, ..worlds },
        Command::BurnExplorerResources(burn),
        'troop_burn',
        3,
        from,
        to,
        false,
    );
    action(worlds, Command::BurnExplorerResources(burn), 'troop_burn', 4, from, to, true);
    action(
        worlds,
        Command::TransferExplorerResources(ResourceTransfer { to_entity_id: 70, ..transfer }),
        'troop_troop_adjacent_transfer',
        5,
        from,
        to,
        false,
    );
}
#[feature("safe_dispatcher")]
pub fn troop_exclusion(case: felt252, first: u8) {
    let (worlds, from, to) = setup_transfers(case);
    for resource_type in first..first + 3 {
        let transfer = ResourceTransfer {
            from_entity_id: from, to_entity_id: 70, resources: resources(resource_type, 0),
        };
        action(
            worlds,
            Command::TransferStructureResourcesToExplorer(transfer),
            'structure_to_explorer',
            1 + (resource_type - first).into(),
            from,
            to,
            false,
        );
    }
}

fn prepare_explorer(ref worlds: PairedWorld, id: u32, owner: u32, x: u32, capacity: u128) {
    let coord = Coord { alt: false, x, y: 2147483626 };
    worlds
        .oracle
        .write_model_test(
            @crate::models::troop::ExplorerTroops {
                game_id: 1,
                explorer_id: id,
                owner,
                coord,
                troops: super::convert::<
                    world_native::troops::Troops, crate::models::troop::Troops,
                >(Default::default()),
            },
        );
    crate::models::resource::resource::ResourceImpl::initialize(ref worlds.oracle, 1, id);
    crate::models::resource::resource::ResourceImpl::write_weight(
        ref worlds.oracle, 1, id, crate::models::weight::Weight { capacity, weight: 0 },
    );
    set_native_fixture(
        worlds.peers.troops,
        selector!("explorers"),
        array![1, id.into()].span(),
        world_native::troops::ExplorerTroops {
            owner,
            coord: world_native::troops::Coord { alt: false, x, y: coord.y },
            troops: Default::default(),
        },
    );
    set_native_fixture(worlds.peers.troops, selector!("exists"), array![1, id.into()].span(), true);
    start_cheat_caller_address(worlds.peers.resources, worlds.peers.structures);
    IResourcesDispatcher { contract_address: worlds.peers.resources }
        .initialize_resources(ResourceKey { game_id: 1, entity_id: id }, capacity);
    stop_cheat_caller_address(worlds.peers.resources);
}

fn compare_arrivals(worlds: PairedWorld, step: u32, entity_id: u32) {
    for slot in array![1_u8, 12] {
        compare_arrival(worlds, step, ArrivalKey { game_id: 1, entity_id, day: 0, slot });
    }
}
fn compare_arrival(mut worlds: PairedWorld, step: u32, key: ArrivalKey) {
    compare_facts(
        worlds.case,
        step,
        'ResourceArrival',
        array![key.game_id.into(), key.entity_id.into(), key.day.into(), key.slot.into()].span(),
        IResourcesDispatcher { contract_address: worlds.peers.resources }.resource_arrival(key),
        crate::native_facts::OracleResourceArrival {
            resources: ResourceArrivalImpl::read_slot(
                ref worlds.oracle, key.game_id, key.entity_id, key.day, key.slot,
            ),
        },
    );
}
fn prepare_arrival(
    ref worlds: PairedWorld, entity_id: u32, slot: u8, values: Span<ResourceAmount>,
) {
    ResourceArrivalImpl::write_slot(
        ref worlds.oracle, 1, entity_id, 0, slot, original_resources(values),
    );
    let mut total = ResourceArrivalImpl::read_day_total(ref worlds.oracle, 1, entity_id, 0);
    for value in values {
        total += *value.amount;
    }
    ResourceArrivalImpl::write_day_total(ref worlds.oracle, 1, entity_id, 0, total);
    set_native_fixture(
        worlds.peers.resources,
        selector!("arrival_bounds"),
        array![1, entity_id.into(), 0, slot.into()].span(),
        Into::<u32, u64>::into(values.len()),
    );
    for index in 0..values.len() {
        set_native_fixture(
            worlds.peers.resources,
            selector!("arrival_items"),
            array![1, entity_id.into(), 0, slot.into(), index.into()].span(),
            *values.at(index),
        );
    }
}
fn setup_arrivals(case: felt252) -> (PairedWorld, u32, u32) {
    let (mut worlds, from, to) = setup_case(case);
    prepare_arrival(
        ref worlds,
        from,
        1,
        array![
            ResourceAmount { resource_type: 2, amount: 10 * RESOURCE_PRECISION },
            ResourceAmount { resource_type: 3, amount: 20 * RESOURCE_PRECISION },
        ]
            .span(),
    );
    (worlds, from, to)
}
#[feature("safe_dispatcher")]
pub fn offload() {
    let (worlds, from, to) = setup_arrivals('resources_offload');
    let offload = OffloadArrival { entity_id: from, day: 0, slot: 1, resource_count: 1 };
    action(worlds, Command::OffloadArrival(offload), 'arrivals_offload', 1, from, to, true);
    action(
        worlds,
        Command::OffloadArrival(OffloadArrival { resource_count: 255, ..offload }),
        'arrivals_offload',
        2,
        from,
        to,
        true,
    );
    action(worlds, Command::OffloadArrival(offload), 'arrivals_offload', 3, from, to, true);
}
#[feature("safe_dispatcher")]
pub fn offload_rejections() {
    let (mut worlds, from, to) = setup_arrivals('resources_offload_rejections');
    prepare_arrival(ref worlds, from, 12, resources(2, RESOURCE_PRECISION));
    let offload = OffloadArrival { entity_id: from, day: 0, slot: 1, resource_count: 1 };
    action(
        PairedWorld { actor: worlds.opponent, ..worlds },
        Command::OffloadArrival(offload),
        'arrivals_offload',
        1,
        from,
        to,
        false,
    );
    action(
        worlds,
        Command::OffloadArrival(OffloadArrival { resource_count: 0, ..offload }),
        'arrivals_offload',
        2,
        from,
        to,
        false,
    );
    action(
        worlds,
        Command::OffloadArrival(OffloadArrival { slot: 12, ..offload }),
        'arrivals_offload',
        3,
        from,
        to,
        false,
    );
}
#[feature("safe_dispatcher")]
pub fn offload_capacity() {
    let (mut worlds, from, to) = setup_arrivals('resources_offload_capacity');
    crate::models::resource::resource::ResourceImpl::write_weight(
        ref worlds.oracle, 1, from, crate::models::weight::Weight { capacity: 100, weight: 100 },
    );
    set_native_fixture(
        worlds.peers.resources,
        selector!("weights"),
        array![1, from.into()].span(),
        world_native::resources::Weight { capacity: 100, weight: 100 },
    );
    let offload = OffloadArrival { entity_id: from, day: 0, slot: 1, resource_count: 255 };
    action(worlds, Command::OffloadArrival(offload), 'arrivals_offload', 1, from, to, true);
}

fn setup_transport(case: felt252) -> (PairedWorld, u32, u32) {
    let mut worlds = setup(case);
    let from = provision_with_resources(
        ref worlds,
        Coord { alt: false, x: 2147483626, y: 2147483626 },
        array![(1_u8, 200 * RESOURCE_PRECISION), (25, 100 * RESOURCE_PRECISION)].span(),
    );
    let to = provision_with_resources(
        ref worlds,
        Coord { alt: false, x: 2147483636, y: 2147483626 },
        array![(25_u8, 100 * RESOURCE_PRECISION)].span(),
    );
    (worlds, from, to)
}
#[feature("safe_dispatcher")]
pub fn sending() {
    let (worlds, from, to) = setup_transport('resources_send');
    let transfer = ResourceTransfer {
        from_entity_id: from, to_entity_id: to, resources: resources(1, 10 * RESOURCE_PRECISION),
    };
    action(worlds, Command::SendResources(transfer), 'send', 1, from, to, true);
    action_at(worlds, Command::SendResources(transfer), 'send', 2, from, to, true, 1860);
    action(
        worlds,
        Command::SendResources(ResourceTransfer { resources: resources(1, 0), ..transfer }),
        'send',
        3,
        from,
        to,
        true,
    );
    action(
        worlds,
        Command::SendResources(
            ResourceTransfer { resources: resources(1, 999 * RESOURCE_PRECISION), ..transfer },
        ),
        'send',
        4,
        from,
        to,
        false,
    );
}
#[feature("safe_dispatcher")]
pub fn pickup(unlimited: bool) {
    let (worlds, from, to) = setup_transport(
        if unlimited {
            'resources_pickup_unlimited'
        } else {
            'resources_pickup'
        },
    );
    let amount = if unlimited {
        0xffffffffffffffffffffffffffffffff
    } else {
        15 * RESOURCE_PRECISION
    };
    action(
        worlds,
        Command::ApproveResources(
            ResourceApproval {
                owner_entity_id: from, approved_entity_id: to, resources: resources(1, amount),
            },
        ),
        'approve',
        1,
        from,
        to,
        true,
    );
    let transfer = ResourceTransfer {
        from_entity_id: from, to_entity_id: to, resources: resources(1, 10 * RESOURCE_PRECISION),
    };
    action(worlds, Command::PickupResources(transfer), 'pickup', 2, from, to, true);
    action(worlds, Command::PickupResources(transfer), 'pickup', 3, from, to, unlimited);
}

#[feature("safe_dispatcher")]
pub fn duplicate_rejection() {
    let (mut worlds, from, to) = setup_transport('resources_duplicates');
    compare_home(worlds, 0, from);
    compare_home(worlds, 0, to);
    let store = IResourcesDispatcher { contract_address: worlds.peers.resources };
    let source = ResourceKey { game_id: 1, entity_id: from };
    let destination = ResourceKey { game_id: 1, entity_id: to };
    let before_source = super::resource_snapshot(store, source);
    let before_destination = super::resource_snapshot(store, destination);
    let arrival = ArrivalKey { game_id: 1, entity_id: to, day: 0, slot: 11 };
    let before_arrival = store.resource_arrival(arrival);
    let command = ResourceTransfer {
        from_entity_id: from,
        to_entity_id: to,
        resources: array![
            ResourceAmount { resource_type: 1, amount: 10 },
            ResourceAmount { resource_type: 1, amount: 20 },
        ]
            .span(),
    };
    start_cheat_block_timestamp_global(1860);
    let (address, _) = worlds.oracle.dns(@"resource_systems").unwrap();
    start_cheat_caller_address(address, worlds.actor);
    assert!(
        IResourceSystemsSafeDispatcher { contract_address: address }
            .send(1, from, to, original_resources(command.resources))
            .is_ok(),
    );
    stop_cheat_caller_address(address);
    assert_eq!(
        crate::models::resource::resource::ResourceImpl::read_balance(
            ref worlds.oracle, 1, from, 1,
        ),
        200 * RESOURCE_PRECISION - 30,
    );
    let queued = ResourceArrivalImpl::read_slot(ref worlds.oracle, 1, to, 0, 11);
    assert_eq!(
        queued, array![(1_u8, 20_u128), (1, 20)].span(), "pinned duplicate accumulator changed",
    );
    let season = world_native::season::ISeasonDispatcher { contract_address: worlds.peers.season };
    let nonce = world_native::season::ISeasonDispatcherTrait::next_nonce(season, 1, worlds.actor);
    let (order, succeeded) = execute_outcome(worlds, Command::SendResources(command), 1860, 1234);
    assert!(!succeeded, "duplicate transfer accepted");
    assert_eq!(
        world_native::season::ISeasonDispatcherTrait::next_nonce(season, 1, worlds.actor),
        nonce + 1,
    );
    assert_eq!(world_native::season::ISeasonDispatcherTrait::execution_head(season).order, order);
    let result =
        eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcherTrait::get_result(
        eternum_randomness_protocol::entrypoint::IRecordedExecutionViewsDispatcher {
            contract_address: worlds.peers.season,
        },
        order,
    );
    assert_eq!(result.status, 2);
    assert_eq!(result.result, 'GAMEPLAY_REJECTED');
    assert_eq!(super::resource_snapshot(store, source), before_source);
    assert_eq!(super::resource_snapshot(store, destination), before_destination);
    assert_eq!(store.resource_arrival(arrival), before_arrival);
    println!("FACT_ACTION {} {} {} {} {}", worlds.case, order, 'send', 1860, succeeded);
    println!(
        "RULED_OUTCOME {} {} {} {} {}",
        worlds.case,
        order,
        'duplicate-transfer-resources',
        true,
        false,
    );
}

fn reinforcement_snapshot(
    store: IResourcesDispatcher, key: ResourceKey, receiving: bool,
) -> Array<felt252> {
    let amount = 3 * RESOURCE_PRECISION;
    let grams = amount * store.resource_rule(1, 26).unit_weight;
    let mut expected = array![];
    let mut weight = store.resource_weight(key);
    weight.weight = if receiving {
        weight.weight + grams
    } else {
        weight.weight - grams
    };
    weight.serialize(ref expected);
    for resource_type in 1_u8..59 {
        let slot = world_native::resources::ResourceSlot {
            game_id: 1, entity_id: key.entity_id, resource_type,
        };
        let mut balance = store.resource_balance(slot);
        if resource_type == 26 {
            balance = if receiving {
                balance + amount
            } else {
                balance - amount
            };
        }
        balance.serialize(ref expected);
        if resource_type < 39 || resource_type > 56 {
            store.resource_production(slot).serialize(ref expected);
        }
    }
    expected
}

#[feature("safe_dispatcher")]
pub fn village_reinforcement(blitz: bool) {
    let case = if blitz {
        'resources_village_blitz'
    } else {
        'resources_village_eternum'
    };
    let mut worlds = super::setup_timed_world(case, blitz, true, 0, 0, 999999);
    let from = provision_with_resources(
        ref worlds, Coord { alt: false, x: 2147483626, y: 2147483626 }, array![].span(),
    );
    let to = provision_with_resources(
        ref worlds, Coord { alt: false, x: 2147483636, y: 2147483626 }, array![].span(),
    );
    let mut village: crate::models::structure::Structure = worlds.oracle.read_model((1, to));
    village.owner = worlds.opponent;
    village.base.category = world_native::ownership::VILLAGE_CATEGORY;
    village.metadata.village_realm = to;
    worlds.oracle.write_model_test(@village);
    let structures = world_native::structures::IStructuresDispatcher {
        contract_address: worlds.peers.structures,
    };
    let native = world_native::structures::IStructuresDispatcherTrait::structure(
        structures, ResourceKey { game_id: 1, entity_id: to },
    )
        .unwrap();
    set_native_fixture(
        worlds.peers.structures,
        selector!("structures"),
        array![1, to.into()].span(),
        world_native::structures::StructureRecord {
            owner: worlds.opponent,
            base: world_native::structures::StructureBase {
                category: world_native::ownership::VILLAGE_CATEGORY, ..native.base,
            },
            metadata: world_native::structures::StructureMetadata {
                village_realm: to, ..native.metadata,
            },
            troop_guards: native.troop_guards,
            resources_packed: native.resources_packed,
        },
    );
    prepare_explorer(ref worlds, 70, from, 2147483635, 1000000 * RESOURCE_PRECISION);
    let store = IResourcesDispatcher { contract_address: worlds.peers.resources };
    let source = ResourceKey { game_id: 1, entity_id: 70 };
    let destination = ResourceKey { game_id: 1, entity_id: to };
    start_cheat_caller_address(worlds.peers.resources, worlds.peers.structures);
    store.grant_resource(source, 26, 10 * RESOURCE_PRECISION, 1800);
    stop_cheat_caller_address(worlds.peers.resources);
    let mut weight = crate::models::resource::resource::ResourceImpl::read_weight(
        ref worlds.oracle, 1, 70,
    );
    let grams = store.resource_rule(1, 26).unit_weight;
    let mut resource = crate::models::resource::resource::SingleResourceStoreImpl::retrieve(
        ref worlds.oracle, 1, 70, 26, ref weight, grams, false,
    );
    crate::models::resource::resource::SingleResourceImpl::add(
        ref resource, 10 * RESOURCE_PRECISION, ref weight, grams,
    );
    crate::models::resource::resource::SingleResourceStoreImpl::store(
        ref resource, ref worlds.oracle,
    );
    crate::models::resource::resource::ResourceImpl::write_weight(ref worlds.oracle, 1, 70, weight);
    compare_home(worlds, 0, from);
    compare_home(worlds, 0, to);
    compare_explorer(worlds, 0, 70);
    let command = ResourceTransfer {
        from_entity_id: 70, to_entity_id: to, resources: resources(26, 3 * RESOURCE_PRECISION),
    };
    if blitz {
        action(
            worlds,
            Command::TransferExplorerResourcesToStructure(command),
            'troop_to_structure',
            1,
            from,
            to,
            true,
        );
    } else {
        let expected_source = reinforcement_snapshot(store, source, false);
        let expected_destination = reinforcement_snapshot(store, destination, true);
        start_cheat_block_timestamp_global(1860);
        let (address, _) = worlds.oracle.dns(@"resource_systems").unwrap();
        start_cheat_caller_address(address, worlds.actor);
        assert!(
            IResourceSystemsSafeDispatcher { contract_address: address }
                .troop_structure_adjacent_transfer(1, 70, to, original_resources(command.resources))
                .is_err(),
        );
        stop_cheat_caller_address(address);
        let (order, succeeded) = execute_outcome(
            worlds, Command::TransferExplorerResourcesToStructure(command), 1860, 1234,
        );
        assert!(succeeded, "allied village reinforcement rejected");
        assert_eq!(super::resource_snapshot(store, source), expected_source);
        assert_eq!(super::resource_snapshot(store, destination), expected_destination);
        println!(
            "FACT_ACTION {} {} {} {} {}", worlds.case, order, 'troop_to_structure', 1860, succeeded,
        );
        println!(
            "RULED_OUTCOME {} {} {} {} {}",
            worlds.case,
            order,
            'village-reinforcement',
            false,
            true,
        );
    }
}
