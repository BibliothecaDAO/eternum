pub use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::commands::{Command, CreateExplorer, Explore};
pub use crate::discovery::Discovery;
pub use crate::game::IGameDispatcherTrait;
pub use crate::geometry::{neighbor, tile_key};
pub use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
pub use crate::map::IMapLogicDispatcher;
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceAmount, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait};
pub use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
pub use crate::troops::{Coord, ExplorerKey, TroopTier, TroopType};
pub use super::resource_commands::{execute, grant};
pub fn setup() -> (super::Deployment, ResourceKey) {
    let (d, home, _) = super::resource_commands::setup();
    (d, home)
}
pub fn coord() -> Coord {
    Coord { alt: false, x: 2000100, y: 2000100 }
}
pub fn create(d: super::Deployment, home: ResourceKey, coord: Coord) -> ResourceKey {
    let timestamp = super::play_fixture::FIXTURE_START;
    start_cheat_block_timestamp_global(timestamp);
    start_cheat_caller_address(d.games, d.games);
    let id = IStructureOperationsDispatcher { contract_address: d.games }
        .create_discovery(
            home.game_id,
            home.entity_id,
            coord,
            Discovery::Camp,
            101,
            timestamp,
            crate::commands::action_context(
                crate::commands::ExecutionContext { timestamp, ..crate::tests::context(d.games, home.game_id) },
            ),
        );
    stop_cheat_caller_address(d.games);
    ResourceKey { game_id: home.game_id, entity_id: id }
}
