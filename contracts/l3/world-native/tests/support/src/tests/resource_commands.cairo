pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::arrivals::{ArrivalKey, has_arrived};
pub use crate::commands::{Command, ExecutionContext};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::resources::{
    IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceAmount, ResourceBurn, ResourceKey,
    ResourceRule, ResourceSlot,
};
pub use crate::settlement::{
    ISettlementCreationDispatcher, ISettlementCreationDispatcherTrait, RealmCreation, SettlementCreation,
};
pub use crate::structures::{IStructureOperationsDispatcher, StructureRecord};
pub use crate::tests::state::{GameState, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait};
pub use crate::troops::{Coord, ExplorerKey};
pub use super::{Deployment, context, play_fixture};
pub fn setup() -> (Deployment, ResourceKey, ResourceKey) {
    setup_with_rules(play_fixture::rules())
}
pub fn fixture_preset(rules: crate::rules::SliceRules) -> crate::presets::PresetDefinition {
    let mut preset = play_fixture::fixture_preset(rules);
    let mut resources = array![];
    for resource_type in 1_u8..59 {
        resources
            .append(
                ResourceRule {
                    resource_type, unit_weight: if resource_type == 58 {
                        0
                    } else {
                        1
                    }, realm_rate: 2, village_rate: 1,
                },
            );
    }
    preset.resources.resources = resources.span();
    preset
}
pub fn setup_with_rules(rules: crate::rules::SliceRules) -> (Deployment, ResourceKey, ResourceKey) {
    setup_with_preset(fixture_preset(rules))
}
pub fn setup_with_preset(preset: crate::presets::PresetDefinition) -> (Deployment, ResourceKey, ResourceKey) {
    let deployment = super::setup_with_domains(true, "StructuresLogic", "TroopsLogic");
    setup_in_deployment(deployment, preset)
}
pub fn setup_in_deployment(
    deployment: Deployment, preset: crate::presets::PresetDefinition,
) -> (Deployment, ResourceKey, ResourceKey) {
    let games = IGameDispatcher { contract_address: deployment.games };
    play_fixture::seed_game_with_preset(
        deployment.games,
        3,
        crate::game::GameRegistry {
            dev_mode_on: false,
            start_settling_at: 10,
            start_main_at: 20,
            end_at: 200,
            end_grace_seconds: 10,
            ..games.game(1),
        },
        preset,
    );
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    start_cheat_caller_address(deployment.games, deployment.games);
    let creation = ISettlementCreationDispatcher { contract_address: deployment.games };
    let mut ids = array![];
    for offset in array![0_u32, 10] {
        let owner = if offset != 0 && preset.settlement.mode != crate::settlement::SettlementMode::Triple {
            super::authority()
        } else {
            deployment.actor
        };
        ids
            .append(
                creation
                    .create_settlement(
                        3,
                        owner,
                        Coord { alt: false, x: 2000000 + offset, y: 2000000 },
                        SettlementCreation::Realm(
                            RealmCreation {
                                realm_id: 1,
                                traits: crate::realms::RealmTraits { wonder: 0, order: 0, resources: array![].span() },
                                troops: crate::settlement::StartingTroops::None,
                                activate_economy: false,
                            },
                        ),
                        crate::commands::action_context(
                            ExecutionContext { timestamp: 30, ..context(deployment.games, 3) },
                        ),
                    ),
            );
    }
    let second_id = *ids.at(1);
    snforge_std::interact_with_state(
        deployment.games,
        || {
            crate::logic::structures::StructureState::transfer_owner(
                ResourceKey { game_id: 3, entity_id: second_id }, deployment.actor,
            );
        },
    );
    stop_cheat_caller_address(deployment.games);
    let source = ResourceKey { game_id: 3, entity_id: *ids.at(0) };
    start_cheat_caller_address(deployment.games, deployment.games);
    resources
        .grant_resource(
            source,
            1,
            100,
            30,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: 30, ..crate::tests::context(deployment.games, (source).game_id),
                },
            ),
        );
    resources
        .start_production(
            source,
            1,
            2,
            100,
            30,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: 30, ..crate::tests::context(deployment.games, (source).game_id),
                },
            ),
        );
    stop_cheat_caller_address(deployment.games);
    (deployment, source, ResourceKey { game_id: 3, entity_id: *ids.at(1) })
}
pub fn execute(deployment: Deployment, command: Command, timestamp: u64) -> bool {
    execute_in_game(deployment, 3, command, timestamp)
}
pub fn execute_in_game(deployment: Deployment, game_id: u32, command: Command, timestamp: u64) -> bool {
    play_fixture::play(
        deployment.games, play_fixture::TestAction { game_id, actor: deployment.actor, command }, 987654321, timestamp,
    )
}
pub fn amount(resource_type: u8, amount: u128) -> Span<ResourceAmount> {
    array![ResourceAmount { resource_type, amount }].span()
}
pub fn set_fixture<T, +starknet::storage_access::Store<T>, +Drop<T>, +Copy<T>>(
    address: starknet::ContractAddress, node: felt252, name: felt252, keys: Span<felt252>, value: T,
) {
    let base = starknet::storage_access::storage_base_address_from_felt252(
        snforge_std::map_entry_address(core::pedersen::pedersen(node, name), keys),
    );
    snforge_std::interact_with_state(address, || starknet::storage_access::Store::<T>::write(0, base, value).unwrap());
}
pub fn set_explorer_fixture(
    address: starknet::ContractAddress, key: crate::troops::ExplorerKey, explorer: crate::troops::ExplorerTroops,
) {
    snforge_std::interact_with_state(
        address,
        || {
            let position = ResourceKey { game_id: key.game_id, entity_id: key.explorer_id };
            let exists = crate::logic::troops::explorer(key).is_some();
            crate::logic::map::MapState::relocate_fixture(
                position, explorer.coord, crate::troops::troop_occupier(explorer.troops), false,
            );
            let record = crate::troops::ExplorerRecordTrait::into_record(explorer);
            if exists {
                crate::logic::troops::TroopState::save(key, record);
            } else {
                crate::logic::troops::TroopState::create(key, record);
            }
        },
    );
}
pub fn explorer_fixture(deployment: Deployment, id: u64, owner: u64, coord: Coord, capacity: u128) -> ResourceKey {
    // These transfer fixtures need several armies at one home without exercising recruitment limits.
    let home = IStructureOperationsDispatcher { contract_address: deployment.games }
        .structure(ResourceKey { game_id: 3, entity_id: owner })
        .unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![3, owner.into()].span(),
        StructureRecord {
            owner: home.owner,
            base: crate::structures::StructureBase { troop_max_explorer_count: 8, ..home.base },
            resources_packed: home.resources_packed,
            metadata: home.metadata,
        },
    );
    crate::tests::resource_commands::set_explorer_fixture(
        deployment.games,
        crate::troops::ExplorerKey { game_id: 3, explorer_id: id },
        crate::troops::ExplorerTroops { owner, coord, ..Default::default() },
    );
    let key = ResourceKey { game_id: 3, entity_id: id };
    start_cheat_caller_address(deployment.games, deployment.games);
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .initialize_resources(
            key,
            capacity,
            0,
            30,
            crate::commands::action_context(
                crate::commands::ExecutionContext {
                    timestamp: 30, ..crate::tests::context(deployment.games, (key).game_id),
                },
            ),
        );
    stop_cheat_caller_address(deployment.games);
    key
}
pub fn grant(deployment: Deployment, key: ResourceKey, resource_type: u8, amount: u128) {
    start_cheat_caller_address(deployment.games, deployment.games);
    IResourceOperationsDispatcher { contract_address: deployment.games }
        .grant_resource(
            key,
            resource_type,
            amount,
            30,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: 30, ..crate::tests::context(deployment.games, (key).game_id),
                },
            ),
        );
    stop_cheat_caller_address(deployment.games);
}
pub fn arrival_fixture(
    deployment: Deployment, entity_id: u64, slot: u8, values: Span<ResourceAmount>,
) -> crate::arrivals::ArrivalKey {
    let key = crate::arrivals::ArrivalKey { game_id: 3, entity_id, day: 0, slot };
    set_fixture(
        deployment.games,
        selector!("arrivals"),
        selector!("arrival_bounds"),
        array![3, entity_id.into(), 0, slot.into()].span(),
        Into::<u32, u64>::into(values.len()),
    );
    for index in 0..values.len() {
        set_fixture(
            deployment.games,
            selector!("arrivals"),
            selector!("arrival_items"),
            array![3, entity_id.into(), 0, slot.into(), index.into()].span(),
            *values.at(index),
        );
    }
    key
}
pub fn resource_facts(deployment: Deployment, key: ResourceKey) -> Array<felt252> {
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let mut values = array![];
    resources.resource_weight(key).serialize(ref values);
    for resource_type in 1_u8..59 {
        let slot = ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type };
        resources.resource_balance(slot).serialize(ref values);
        resources.resource_production(slot).serialize(ref values);
    }
    values
}

#[feature("safe_dispatcher")]
pub fn assert_terminal_rejection(deployment: Deployment, command: Command, timestamp: u64) {
    let action = play_fixture::TestAction { game_id: 3, actor: deployment.actor, command };
    let encoded = play_fixture::encode(command);
    let Ok((index, _, _)) = crate::commands::validated_command(encoded) else {
        play_fixture::assert_preflight_rejection(deployment.games, action, timestamp);
        return;
    };
    let rules = snforge_std::interact_with_state(deployment.games, || crate::logic::game::rules(3));
    if !crate::rules::command_enabled(rules.command_mask, index.into()) {
        play_fixture::assert_preflight_rejection(deployment.games, action, timestamp);
        return;
    }
    let mut spy = snforge_std::spy_events();
    assert!(!execute(deployment, command, timestamp));
    let rejected = play_fixture::rejection(ref spy, deployment.games);
    assert_eq!(rejected.version, 1);
    assert_eq!(rejected.game_id, 3);
    assert_eq!(rejected.actor, deployment.actor);
    assert!(rejected.reason.len() != 0);
}
pub fn troop_deposit_ownership(blitz_mode_on: bool, category: u8) {
    let (deployment, home, target) = setup_with_rules(
        crate::rules::SliceRules {
            mode_rules: if blitz_mode_on {
                super::play_fixture::BLITZ_RULES
            } else {
                super::play_fixture::ETERNUM_RULES
            },
            command_mask: if blitz_mode_on {
                super::play_fixture::BLITZ_COMMAND_MASK
            } else {
                super::play_fixture::ETERNUM_COMMAND_MASK
            },
            entry_rule: if blitz_mode_on {
                crate::rules::ENTRY_ROSTER
            } else {
                crate::rules::ENTRY_ENTITLEMENT
            },
            ..play_fixture::rules(),
        },
    );
    let structures = IStructureOperationsDispatcher { contract_address: deployment.games };
    let structure = structures.structure(target).unwrap();
    let explorer = explorer_fixture(deployment, 70, home.entity_id, Coord { alt: false, x: 2000009, y: 2000000 }, 1000);
    grant(deployment, explorer, 26, 100);
    grant(deployment, explorer, 1, 100);
    let coord = if category == crate::taxonomy::BITCOIN_MINE_CATEGORY {
        Coord { alt: true, x: 1999995, y: 2000000 }
    } else {
        Coord { alt: false, x: 2000009, y: 2000000 }
    };
    crate::tests::resource_commands::set_explorer_fixture(
        deployment.games,
        crate::troops::ExplorerKey { game_id: 3, explorer_id: 70 },
        crate::troops::ExplorerTroops { owner: home.entity_id, coord, ..Default::default() },
    );
    let target_position = structures.position(target).unwrap();
    snforge_std::interact_with_state(
        deployment.games,
        || crate::logic::map::MapState::relocate_fixture(
            target, Coord { alt: coord.alt, ..target_position }, category, true,
        ),
    );
    for owner in array![deployment.actor, 0x998.try_into().unwrap(), 0x999.try_into().unwrap()] {
        set_fixture(
            deployment.games,
            selector!("structures"),
            selector!("structures"),
            array![3, target.entity_id.into()].span(),
            StructureRecord {
                owner,
                base: crate::structures::StructureBase { category, ..structure.base },
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
pub fn village_fixture(deployment: Deployment, key: ResourceKey, owner: starknet::ContractAddress) {
    let structure = IStructureOperationsDispatcher { contract_address: deployment.games }.structure(key).unwrap();
    set_fixture(
        deployment.games,
        selector!("structures"),
        selector!("structures"),
        array![key.game_id.into(), key.entity_id.into()].span(),
        StructureRecord {
            owner,
            base: crate::structures::StructureBase { category: crate::taxonomy::VILLAGE_CATEGORY, ..structure.base },
            resources_packed: structure.resources_packed,
            metadata: crate::structures::StructureMetadata { village_realm: 12345, ..structure.metadata },
        },
    );
}
