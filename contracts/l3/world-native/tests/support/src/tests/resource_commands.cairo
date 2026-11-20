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
    setup_in_deployment(super::setup_with_domains(true, "StructuresLogic", "TroopsLogic"))
}
pub fn setup_in_deployment(deployment: Deployment) -> (Deployment, ResourceKey, ResourceKey) {
    let game_id = play_fixture::create_game(deployment.games, play_fixture::fixture_params('resources'));
    assert!(game_id == 3, "the resource game follows the two fixture games");
    let (neighbour, _) = super::deploy_player(3, super::GUARDIAN);
    let source = play_fixture::settled_home(deployment, game_id, deployment.actor, 1, play_fixture::FIXTURE_START);
    let target = play_fixture::settled_home(deployment, game_id, neighbour, 2, play_fixture::FIXTURE_START);
    (deployment, source, target)
}
pub fn execute(deployment: Deployment, command: Command, timestamp: u64) -> bool {
    execute_in_game(deployment, 3, command, timestamp)
}
pub fn execute_in_game(deployment: Deployment, game_id: u32, command: Command, timestamp: u64) -> bool {
    play_fixture::play(
        deployment.games, play_fixture::TestAction { game_id, actor: deployment.actor, command }, 987654321, timestamp,
    )
}
pub fn assert_executes(deployment: Deployment, game_id: u32, command: Command, timestamp: u64) {
    let mut events = snforge_std::spy_events();
    if !execute_in_game(deployment, game_id, command, timestamp) {
        panic!("{}", play_fixture::rejection(ref events, deployment.games).reason);
    }
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
pub fn size_army(deployment: Deployment, key: ExplorerKey, troops: u128) {
    let mut army = GameState { contract_address: deployment.games }.resolved_explorer(key).unwrap();
    army.troops.count = troops * crate::rules::RESOURCE_PRECISION;
    set_explorer_fixture(deployment.games, key, army);
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
    IResourceOperationsDispatcher { contract_address: deployment.games }.initialize_resources(key, capacity);
    stop_cheat_caller_address(deployment.games);
    key
}
pub fn fund_troops(deployment: Deployment, key: ResourceKey, troop: u8, troops: u128) {
    stock(deployment, key, troop, troops);
    let recipe = crate::production::IProductionRulesDispatcherTrait::production_recipe(
        crate::production::IProductionRulesDispatcher { contract_address: deployment.games },
        crate::production::RecipeKey { game_id: key.game_id, resource_type: troop },
    );
    for input in recipe.simple_inputs {
        stock(deployment, key, *input.resource_type, *input.amount * troops / recipe.simple_output.into());
    }
}
pub fn stock(deployment: Deployment, key: ResourceKey, resource_type: u8, amount: u128) {
    let held = IResourceOperationsDispatcher { contract_address: deployment.games }
        .resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type });
    set_fixture(
        deployment.games,
        selector!("resources"),
        selector!("balances"),
        array![key.game_id.into(), key.entity_id.into(), resource_type.into()].span(),
        held + amount,
    );
}
pub fn grant(deployment: Deployment, key: ResourceKey, resource_type: u8, amount: u128) {
    let resources = IResourceOperationsDispatcher { contract_address: deployment.games };
    let timestamp = resources
        .resource_production(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type })
        .last_settled_at
        .into();
    start_cheat_caller_address(deployment.games, deployment.games);
    resources
        .grant_resource(
            key,
            resource_type,
            amount,
            timestamp,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp, ..crate::tests::context(deployment.games, key.game_id) },
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
