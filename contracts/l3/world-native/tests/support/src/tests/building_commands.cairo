pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::buildings::{BuildingKey, ChangeBuilding, CreateBuilding};
pub use crate::commands::Command;
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::structures::IStructureOperationsDispatcher;
pub use crate::tests::state::{ResourceObservationTrait, StructureObservationTrait};
pub use crate::troops::Coord;
pub use super::resource_commands::{assert_terminal_rejection, execute, resource_facts, set_fixture, setup};
pub fn building_world() -> (super::Deployment, ResourceKey) {
    let (deployment, home, _) = setup();
    (deployment, home)
}
pub fn create(home: ResourceKey, category: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding { structure_id: home.entity_id, directions: array![0_u8].span(), category, use_simple: true },
    )
}
pub fn east(home: ResourceKey) -> BuildingKey {
    BuildingKey { game_id: home.game_id, structure_id: home.entity_id, inner_col: 11, inner_row: 10 }
}
pub fn change(home: ResourceKey) -> ChangeBuilding {
    ChangeBuilding { structure_id: home.entity_id, coord: Coord { alt: false, x: 11, y: 10 } }
}
pub fn replay_buildings(record: bool) {
    let (d, home) = research_world();
    let entities = array![home.entity_id].span();
    let tiles = array![].span();
    let mut frames = array![super::spatial_replay::initial(d.games, 3, entities, tiles)];
    let mut spy = snforge_std::spy_events();
    let start = super::play_fixture::FIXTURE_START;
    for (command, timestamp) in array![
        (create(home, 37), start + 40), (Command::DestroyBuilding(change(home)), start + 130),
    ] {
        assert!(execute(d, command, timestamp));
        super::state::assert_spatial_indexes(d.games, 3, entities, tiles);
        frames.append(super::spatial_replay::capture(d.games, 3, entities, tiles, ref spy));
    }
    super::spatial_replay::compare("buildings", frames, record);
}
pub fn research_world() -> (super::Deployment, ResourceKey) {
    let (d, home) = building_world();
    for _ in 0_u8..3 {
        level_up(d, home, super::play_fixture::FIXTURE_START);
    }
    super::resource_commands::grant(d, home, crate::resources::LABOR, 10000000 * crate::rules::RESOURCE_PRECISION);
    super::resource_commands::grant(d, home, crate::resources::ESSENCE, 10000000 * crate::rules::RESOURCE_PRECISION);
    (d, home)
}
pub fn research(home: ResourceKey, row: u8) -> Command {
    Command::Research(crate::research::Research { structure_id: home.entity_id, row })
}
pub fn build_toward(home: ResourceKey, category: u8, direction: u8) -> Command {
    Command::CreateBuilding(
        CreateBuilding {
            structure_id: home.entity_id, directions: array![direction].span(), category, use_simple: true,
        },
    )
}
pub fn learned(d: super::Deployment, home: ResourceKey) -> u64 {
    snforge_std::interact_with_state(d.games, || crate::logic::research::require(home)).learned
}
pub fn rate(d: super::Deployment, home: ResourceKey, resource_type: u8) -> u64 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_production(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type })
        .production_rate
}
pub fn balance(d: super::Deployment, home: ResourceKey, resource_type: u8) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id: home.game_id, entity_id: home.entity_id, resource_type })
}
pub fn realm_level(d: super::Deployment, home: ResourceKey) -> u8 {
    IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap().base.level
}
pub fn level_up(d: super::Deployment, home: ResourceKey, timestamp: u64) {
    let level = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap().base.level;
    for cost in crate::logic::upgrades::recipe(level + 1).costs {
        super::resource_commands::grant(d, home, *cost.resource_type, *cost.amount);
    }
    assert!(super::resource_commands::execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), timestamp));
}
