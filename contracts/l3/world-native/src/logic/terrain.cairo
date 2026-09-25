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
    let mut ring = array![(site, biome(tile_key(game_id, site), crate::commands::biome_context(game_context)))];
    for direction in 0_u8..6 {
        let coord = crate::geometry::neighbor(site, direction);
        ring.append((coord, biome(tile_key(game_id, coord), crate::commands::biome_context(game_context))));
    }
    ring.span()
}
