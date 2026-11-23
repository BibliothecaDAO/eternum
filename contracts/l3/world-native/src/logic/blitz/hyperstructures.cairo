use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::map::{BIOME_SCALE, BYTE_RANGE};
use crate::resources::ResourceKey;

pub fn reserve_sites(game_id: u32, players: u32) {
    let context = crate::commands::load_context(game_id, 0, starknet::get_block_timestamp());
    let center = crate::settlement_grid::map_center(context.rules.unbox().map_center_offset);
    let spacing = crate::logic::settlement::spacing();
    for site in 0..crate::settlement_grid::reservation_count(players) {
        let key = crate::geometry::tile_key(
            game_id, crate::settlement_grid::reservation_location(center, spacing, site),
        );
        if !revealed(key) {
            crate::logic::map::MapState::reveal(
                key, crate::logic::map::biome(key, crate::commands::biome_context(context)),
            );
        }
        crate::logic::map::MapState::reserve_hyperstructure(key);
    }
}

fn revealed(key: crate::map::TileKey) -> bool {
    match crate::logic::map::tile(key) {
        Some(tile) => tile.data / BIOME_SCALE % BYTE_RANGE != 0,
        None => false,
    }
}

pub fn claim_id(game_id: u32) -> ResourceKey {
    let state = crate::state::write();
    let count = state.hyperstructures.counts.read(game_id);
    let entity_id: u64 = (crate::entity_ids::MAX_HOME_NAMESPACE - count).into();
    state.hyperstructures.counts.write(game_id, count + 1);
    ResourceKey { game_id, entity_id }
}
