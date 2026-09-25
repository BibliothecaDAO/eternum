use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait};

#[test]
fn settlement_terrain_keeps_map_biomes_and_daily_home_rings() {
    let d = super::registrar::setup();
    let (game_id, preset, _) = super::registrar::expedition_home(d);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let game = IGameDispatcher { contract_address: d.games }.game(game_id);
    for timestamp in array![350_u64, 450, 550] {
        let site = crate::expeditions::site(
            game.start_main_at, preset.rules.epoch_seconds, preset.settlement.spacing, 1, timestamp, 0,
        );
        let ring = map.expedition_home_ring(game_id, 1, timestamp);
        assert_eq!(ring.len(), 7);
        let (center, _) = *ring.at(0);
        assert_eq!(center, site);
        let context = crate::commands::BiomeContext {
            climate: preset.rules.biome_climate_config,
            epoch_seconds: preset.rules.epoch_seconds,
            start_main_at: game.start_main_at,
        };
        for index in 0_u32..7 {
            let (coord, biome) = *ring.at(index);
            if index != 0 {
                assert_eq!(coord, crate::geometry::neighbor(site, (index - 1).try_into().unwrap()));
            }
            let climate = crate::expeditions::climate(
                context.climate, coord, context.start_main_at, context.epoch_seconds, preset.settlement.spacing,
            );
            let expected: u8 = crate::biome::get_biome_with_climate(coord.alt, coord.x.into(), coord.y.into(), climate)
                .into();
            assert_eq!(biome, expected);
            assert_eq!(map.biome(crate::geometry::tile_key(game_id, coord), context), expected);
        }
        let ordinary = crate::commands::BiomeContext { epoch_seconds: 0, ..context };
        for alt in array![false, true] {
            let coord = crate::troops::Coord { alt, ..site };
            let expected: u8 = crate::biome::get_biome_with_climate(
                alt, coord.x.into(), coord.y.into(), ordinary.climate,
            )
                .into();
            assert_eq!(map.biome(crate::geometry::tile_key(game_id, coord), ordinary), expected);
        }
    }
}
