use crate::geometry::tile_key;
use crate::map::TileKey;
use crate::troops::Coord;

pub fn biome(key: TileKey, game_context: crate::commands::BiomeContext) -> u8 {
    let climate = if game_context.epoch_seconds == 0 {
        game_context.climate
    } else {
        let spacing = crate::logic::settlement::rules(key.game_id).spacing;
        crate::expeditions::climate(
            game_context.climate,
            crate::troops::Coord { alt: key.alt, x: key.col, y: key.row },
            game_context.start_main_at,
            game_context.epoch_seconds,
            spacing,
        )
    };
    crate::biome::get_biome_with_climate(key.alt, key.col.into(), key.row.into(), climate).into()
}

pub fn expedition_home_ring(game_id: u32, realm_id: u16, timestamp: u64) -> Span<(Coord, u8)> {
    let game_context = crate::commands::load_context(
        game_id, crate::commands::ActionContext { raw_root: 0, timestamp: timestamp },
    );

    let rules = game_context.rules.unbox();
    assert!(rules.epoch_seconds != 0, "game has no expeditions");
    let site = crate::expeditions::site(
        game_context.game.unbox().start_main_at,
        rules.epoch_seconds,
        crate::logic::settlement::rules(game_id).spacing,
        realm_id,
        timestamp,
        0,
    );
    home_ring(game_id, site, crate::commands::biome_context(game_context))
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
    let spacing = crate::logic::settlement::rules(key.game_id).spacing;
    let coord = Coord { alt: key.alt, x: key.col, y: key.row };
    assert!(context.epoch_seconds != 0 && crate::expeditions::is_home_ring(coord, spacing), "not a home ring");
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
