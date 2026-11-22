use starknet::storage::{StoragePathEntry, StoragePointerReadAccess};
use crate::geometry::tile_key;
use crate::map::TileKey;
use crate::troops::Coord;

#[cfg(feature: "blitz")]
pub fn biome(key: TileKey, game_context: crate::commands::BiomeContext) -> u8 {
    crate::biome::get_biome_with_climate(key.alt, key.col.into(), key.row.into(), game_context.climate).into()
}

#[cfg(not(feature: "blitz"))]
pub fn biome(key: TileKey, game_context: crate::commands::BiomeContext) -> u8 {
    let climate = crate::expeditions::climate(
        game_context.climate,
        crate::troops::Coord { alt: key.alt, x: key.col, y: key.row },
        game_context.start_main_at,
        crate::balance::rules::SWITCHES.day_unit_seconds,
        crate::logic::settlement::spacing(),
    );
    crate::biome::get_biome_with_climate(key.alt, key.col.into(), key.row.into(), climate).into()
}

// A view outside any play: it reads the facts a ring is drawn from, not the whole rule set.
pub fn expedition_home_ring(game_id: u32, region_id: u32, timestamp: u64) -> Span<(Coord, u8)> {
    let game = crate::logic::game::game(game_id);
    let today = crate::days::day_of(game, crate::balance::rules::SWITCHES.day_unit_seconds, timestamp).index;
    let site = crate::expeditions::site(crate::logic::settlement::spacing(), region_id, today, 0);
    let climate = crate::state::read().games.overrides.entry(game_id).biome_climate.read();
    home_ring(game_id, site, crate::commands::BiomeContext { climate, start_main_at: game.start_main_at })
}

fn home_ring(game_id: u32, site: Coord, context: crate::commands::BiomeContext) -> Span<(Coord, u8)> {
    let mut ring = array![(site, biome(tile_key(game_id, site), context))];
    for direction in 0_u8..6 {
        let coord = crate::geometry::neighbor(site, direction);
        ring.append((coord, biome(tile_key(game_id, coord), context)));
    }
    ring.span()
}

pub fn raise_expedition_home(key: TileKey, context: crate::commands::BiomeContext) {
    use crate::map::{BIOME_SCALE, BYTE_RANGE, REWARD_EXTRACTED_FLAG};
    let spacing = crate::logic::settlement::spacing();
    let coord = Coord { alt: key.alt, x: key.col, y: key.row };
    assert!(crate::expeditions::is_home_ring(coord, spacing), "not a home ring");
    let center = crate::expeditions::home_ring_center(coord, spacing);
    let center_key = tile_key(key.game_id, center);
    if ring_materialized(center_key) {
        return;
    }
    for (coord, biome) in home_ring(key.game_id, center, context) {
        let tile = tile_key(key.game_id, *coord);
        let data = crate::logic::map::tile(tile).map(|tile| tile.data).unwrap_or(0);
        if data / BIOME_SCALE % BYTE_RANGE == 0 {
            crate::logic::map::MapState::reveal(tile, *biome);
        }
        if *coord != center && data / REWARD_EXTRACTED_FLAG % 2 == 0 {
            crate::logic::map::MapState::mark_reward_extracted(tile);
        }
    }
    mark_ring_materialized(center_key);
}

// A realm centre never pays a reveal reward and each day has a new centre. Its consumed bit records that all seven
// tiles were materialized together, without another daily counter. Once set, raising must never repair missing tiles.
fn ring_materialized(center: TileKey) -> bool {
    crate::logic::map::tile(center).map(|tile| tile.data / crate::map::REWARD_EXTRACTED_FLAG % 2 != 0).unwrap_or(false)
}

fn mark_ring_materialized(center: TileKey) {
    crate::logic::map::MapState::mark_reward_extracted(center);
}
