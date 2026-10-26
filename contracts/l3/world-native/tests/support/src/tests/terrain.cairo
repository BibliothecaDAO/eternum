pub use snforge_std::fs::{FileTrait, read_txt};
pub use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state};
pub use starknet::storage::StorageMapWriteAccess;
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
pub use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait};
pub use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
pub use crate::structures::IStructureOperationsDispatcher;
pub use crate::tests::registrar::muster_command;
pub use crate::tests::resource_commands::execute_in_game;
pub use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};
pub fn ring_reward_balances(state: IResourceOperationsDispatcher, game_id: u32) -> Array<u128> {
    let mut balances = array![];
    for resource_type in array![crate::resources::LABOR, crate::resources::ESSENCE] {
        balances.append(state.resource_balance(ResourceSlot { game_id, entity_id: 1, resource_type }));
    }
    balances
}
pub fn assert_biomes_match_terrain(d: super::Deployment, game_id: u32, coords: Span<crate::troops::Coord>) -> u32 {
    let map = IMapLogicDispatcher { contract_address: d.games };
    let context = crate::commands::biome_context(crate::tests::context(d.games, game_id));
    let mut revealed = 0;
    for coord in coords {
        let mut tiles = array![*coord];
        for direction in 0_u8..6 {
            tiles.append(crate::geometry::neighbor(*coord, direction));
        }
        for tile in tiles {
            let key = crate::geometry::tile_key(game_id, tile);
            let derived = interact_with_state(d.games, || crate::logic::terrain::biome(key, context));
            let stored: u128 = map
                .tile(key)
                .map(|tile| tile.data / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE)
                .unwrap_or(0);
            if stored != 0 {
                assert_eq!(stored, derived.into());
                revealed += 1;
            }
            assert_eq!(map.biome(key, context), derived);
        }
    }
    revealed
}
