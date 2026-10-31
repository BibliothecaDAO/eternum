pub use snforge_std::{EventSpyTrait, EventsFilterTrait};
pub use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
pub use crate::commands::{Command, Explore};
pub use crate::geometry::{neighbor, tile_key};
pub use crate::map::IMapLogicDispatcher;
pub use crate::relics::{IRelicsDispatcher, IRelicsDispatcherTrait, OpenChest, SiteChest};
pub use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::tests::play_fixture::{TestAction, play};
pub use crate::tests::state::{GameState, MapObservationTrait, ResourceObservationTrait, TroopObservationTrait};
pub use crate::troops::{Coord, ExplorerKey};
pub use super::Deployment;
pub const HIT_ROOT: u256 = 19635;
pub const MISS_ROOT: u256 = 1126;
pub const EMPTY_ROOT: u256 = 1;
pub fn explore(d: Deployment, key: ExplorerKey, root: u256, at: u64) {
    let mut spy = snforge_std::spy_events();
    let applied = play(
        d.games,
        TestAction {
            game_id: key.game_id,
            actor: d.actor,
            command: Command::Explore(Explore { explorer_id: key.explorer_id, direction: 0 }),
        },
        root,
        at,
    );
    if !applied {
        let rejected = super::play_fixture::rejection(ref spy, d.games);
        panic!("Explore refused: {}", rejected.reason);
    }
}
pub fn open(d: Deployment, key: ExplorerKey, coord: Coord, at: u64) -> bool {
    play(
        d.games,
        TestAction {
            game_id: key.game_id,
            actor: d.actor,
            command: Command::OpenRelicChest(OpenChest { explorer_id: key.explorer_id, coord }),
        },
        987654321,
        at,
    )
}
pub fn destination(d: Deployment, key: ExplorerKey) -> Coord {
    neighbor(GameState { contract_address: d.games }.resolved_explorer(key).unwrap().coord, 0)
}
pub fn map(d: Deployment) -> IMapLogicDispatcher {
    IMapLogicDispatcher { contract_address: d.games }
}
pub fn lords(d: Deployment, game_id: u32, home: u64) -> u128 {
    IResourceOperationsDispatcher { contract_address: d.games }
        .resource_balance(ResourceSlot { game_id, entity_id: home, resource_type: crate::resources::LORDS })
}
pub fn found(d: Deployment, key: ExplorerKey, coord: Coord) -> (ResourceKey, SiteChest) {
    let occupied = map(d).occupancy(tile_key(key.game_id, coord)).unwrap();
    assert_eq!(occupied.category, crate::taxonomy::CHEST_OCCUPIER);
    assert!(!occupied.is_structure);
    let chest_key = ResourceKey { game_id: key.game_id, entity_id: occupied.entity_id };
    let chest = IRelicsDispatcher { contract_address: d.games }.site_chest(chest_key).unwrap();
    (chest_key, chest)
}

pub fn expected(d: Deployment, game_id: u32, coord: Coord, root: u256) -> SiteChest {
    snforge_std::interact_with_state(
        d.games,
        || {
            let context = crate::commands::ExecutionContext { timestamp: 360, ..super::context(d.games, game_id) };
            let mut root = root;
            let seed = crate::random::game_root(ref root, game_id);
            crate::logic::lords_budget::candidate(
                game_id, crate::logic::expeditions::depth_rules_at(game_id, coord).chest, seed, context,
            )
        },
    )
}
