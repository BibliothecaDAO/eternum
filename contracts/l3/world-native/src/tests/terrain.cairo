use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state};
use starknet::storage::StorageMapWriteAccess;
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::guards::{GuardKey, IGuardsDispatcher, IGuardsDispatcherTrait};
use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait};
use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
use crate::structures::IStructureOperationsDispatcher;
use crate::tests::registrar::muster_command;
use crate::tests::resource_commands::execute_in_game;
use crate::tests::state::{
    GameState, MapObservationTrait, ResourceObservationTrait, StructureObservationTrait, TroopObservationTrait,
};

#[test]
fn settlement_terrain_keeps_map_biomes_and_daily_home_rings() {
    let d = super::registrar::setup();
    let (game_id, preset, _) = super::registrar::expedition_home(d);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let game = IGameDispatcher { contract_address: d.games }.game(game_id);
    for day in 0_u64..3 {
        let timestamp = super::registrar::day_start(d, game_id, day) + 50;
        let site = crate::expeditions::site(preset.settlement.spacing, 1, day, 0);
        let ring = map.expedition_home_ring(game_id, 1, timestamp);
        assert_eq!(ring.len(), 7);
        let (center, _) = *ring.at(0);
        assert_eq!(center, site);
        let context = crate::commands::BiomeContext {
            climate: preset.rules.biome_climate_config,
            day_unit_seconds: preset.rules.day_unit_seconds,
            start_main_at: game.start_main_at,
        };
        for index in 0_u32..7 {
            let (coord, biome) = *ring.at(index);
            if index != 0 {
                assert_eq!(coord, crate::geometry::neighbor(site, (index - 1).try_into().unwrap()));
            }
            let climate = crate::expeditions::climate(
                context.climate, coord, context.start_main_at, context.day_unit_seconds, preset.settlement.spacing,
            );
            let expected: u8 = crate::biome::get_biome_with_climate(coord.alt, coord.x.into(), coord.y.into(), climate)
                .into();
            assert_eq!(biome, expected);
            assert_eq!(map.biome(crate::geometry::tile_key(game_id, coord), context), expected);
        }
        // The same coordinates under an ordinary climate: the terrain derivation itself, since the map answers a
        // revealed tile with the biome its own game stored.
        let ordinary = crate::commands::BiomeContext { day_unit_seconds: 0, ..context };
        for alt in array![false, true] {
            let coord = crate::troops::Coord { alt, ..site };
            let expected: u8 = crate::biome::get_biome_with_climate(
                alt, coord.x.into(), coord.y.into(), ordinary.climate,
            )
                .into();
            let key = crate::geometry::tile_key(game_id, coord);
            assert_eq!(interact_with_state(d.games, || crate::logic::terrain::biome(key, ordinary)), expected);
        }
    }
}

#[test]
fn a_revealed_tile_answers_its_stored_biome_and_an_unrevealed_one_derives_it() {
    let d = super::registrar::setup();
    let (game_id, preset, _) = super::registrar::expedition_home(d);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let game = IGameDispatcher { contract_address: d.games }.game(game_id);
    let context = crate::commands::BiomeContext {
        climate: preset.rules.biome_climate_config,
        day_unit_seconds: preset.rules.day_unit_seconds,
        start_main_at: game.start_main_at,
    };
    let coord = crate::troops::Coord { alt: false, x: 3000, y: 3000 };
    let key = crate::geometry::tile_key(game_id, coord);
    let climate = crate::expeditions::climate(
        context.climate, coord, context.start_main_at, context.day_unit_seconds, preset.settlement.spacing,
    );
    let derived: u8 = crate::biome::get_biome_with_climate(coord.alt, coord.x.into(), coord.y.into(), climate).into();
    assert_eq!(map.biome(key, context), derived);
    let stored = if derived == 1 {
        2_u8
    } else {
        1_u8
    };
    interact_with_state(d.games, || crate::logic::map::MapState::reveal(key, stored));
    assert_eq!(map.biome(key, context), stored);
}

#[test]
fn home_ring_materializes_once_each_day_and_all_six_deployments_work() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let game = IGameDispatcher { contract_address: d.games }.game(game_id);
    let home = ResourceKey { game_id, entity_id: 1 };
    let structures = IStructureOperationsDispatcher { contract_address: d.games };
    let state = GameState { contract_address: d.games };
    let context = crate::commands::BiomeContext {
        climate: preset.rules.biome_climate_config,
        day_unit_seconds: preset.rules.day_unit_seconds,
        start_main_at: game.start_main_at,
    };
    let mut serialized = array![1_felt252, 21];
    for day in 0_u64..3 {
        let timestamp = super::registrar::day_start(d, game_id, day) + 50;
        let ring = map.expedition_home_ring(game_id, 1, timestamp);
        let (center, _) = *ring.at(0);
        let mut spy = snforge_std::spy_events();
        let resources = IResourceOperationsDispatcher { contract_address: d.games };
        let before = ring_reward_balances(resources, game_id);
        interact_with_state(
            d.games,
            || {
                crate::logic::terrain::raise_expedition_home(crate::geometry::tile_key(game_id, center), context);
            },
        );
        assert_eq!(before, ring_reward_balances(resources, game_id));
        for (_, event) in spy.get_events().emitted_by(d.games).events {
            assert_eq!(*event.keys.at(0), selector!("RowSet"));
            assert_eq!(*event.keys.at(2), 'TileOpt');
        }
        // The complete ring exists before this day's first gameplay command, matching the public view.
        for (coord, biome) in ring {
            let key = crate::geometry::tile_key(game_id, *coord);
            let stored = map.tile(key).unwrap().data - crate::map::coordinate_bits(key);
            assert_eq!(
                stored, Into::<u8, u128>::into(*biome) * crate::map::BIOME_SCALE + crate::map::REWARD_EXTRACTED_FLAG,
            );
            serialized
                .append_span(
                    array![timestamp.into(), (*coord.x).into(), (*coord.y).into(), (*biome).into(), stored.into()]
                        .span(),
                );
        }
        let mut repeated = snforge_std::spy_events();
        interact_with_state(
            d.games,
            || {
                crate::logic::terrain::raise_expedition_home(crate::geometry::tile_key(game_id, center), context);
            },
        );
        assert_eq!(repeated.get_events().emitted_by(d.games).events.len(), 0);
        for direction in 0_u8..6 {
            let action_at = timestamp + 1 + Into::<u8, u64>::into(direction) * 2;
            assert!(execute_in_game(d, game_id, muster_command(category, direction), action_at));
            let id = *structures.home_armies(home).at(0);
            let explorer = state.resolved_explorer(crate::troops::ExplorerKey { game_id, explorer_id: id }).unwrap();
            assert_eq!(explorer.coord, crate::geometry::neighbor(center, direction));
            assert!(
                execute_in_game(
                    d,
                    game_id,
                    crate::commands::Command::ManageTroops(crate::troop_management::ManageTroops::RemoveExplorer(id)),
                    action_at + 1,
                ),
            );
        }
    }
    assert_eq!(serialized, read_txt(@FileTrait::new("tests/fixtures/frontier-home-ring-v1.txt")));
}

#[test]
fn deploy_refuses_a_missing_neighbour_after_the_ring_is_materialized() {
    let d = super::registrar::setup();
    let (game_id, _, category) = super::registrar::expedition_home(d);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let ring = map.expedition_home_ring(game_id, 1, 350);
    let (coord, _) = *ring.at(1);
    let key = crate::geometry::tile_key(game_id, coord);
    interact_with_state(
        d.games, || {
            let state = crate::state::write();
            state.map.tiles.write((game_id, false, coord.x, coord.y), 0);
        },
    );
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    let troops = ResourceSlot {
        game_id,
        entity_id: 1,
        resource_type: crate::troops::troop_resource(
            IGuardsDispatcher { contract_address: d.games }
                .guard(GuardKey { game_id, structure_id: 1, slot: 0 })
                .troops
                .category,
            0,
        ),
    };
    let before = resources.resource_balance(troops);
    assert!(!execute_in_game(d, game_id, muster_command(category, 0), 351));
    assert_eq!(resources.resource_balance(troops), before);
    assert!(map.tile(key).is_none());
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }
            .home_armies(ResourceKey { game_id, entity_id: 1 })
            .len(),
        0,
    );
}

fn ring_reward_balances(state: IResourceOperationsDispatcher, game_id: u32) -> Array<u128> {
    let mut balances = array![];
    for resource_type in array![crate::resources::LABOR, crate::resources::ESSENCE] {
        balances.append(state.resource_balance(ResourceSlot { game_id, entity_id: 1, resource_type }));
    }
    balances
}

/// Each given tile and its six neighbours, on its own layer: a revealed tile stores exactly the biome the terrain
/// derives for it, and the map's lookup answers that derived biome whether the tile is revealed or not. Returns how
/// many revealed tiles were compared, so a caller can refuse a vacuous check.
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

#[test]
fn tile_presence_follows_terrain_or_occupancy_on_both_layers() {
    let d = super::registrar::setup();
    for alt in array![false, true] {
        interact_with_state(
            d.games,
            || {
                let key = crate::map::TileKey { game_id: 7, alt, col: 120, row: 130 };
                assert_eq!(crate::logic::map::tile(key), None);
                crate::logic::map::MapState::occupy(key, 99, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false);
                assert_eq!(
                    crate::logic::map::tile(key), Some(crate::map::TileOpt { data: crate::map::coordinate_bits(key) }),
                );
                crate::logic::map::MapState::vacate(key, 99);
                assert_eq!(crate::logic::map::tile(key), None);
                crate::logic::map::MapState::reveal(key, 11);
                let revealed = crate::map::TileOpt {
                    data: crate::map::coordinate_bits(key) + 11 * crate::map::BIOME_SCALE,
                };
                assert_eq!(crate::logic::map::tile(key), Some(revealed));
                crate::logic::map::MapState::reserve_hyperstructure(key);
                crate::logic::map::MapState::release_hyperstructure(key);
                assert_eq!(crate::logic::map::tile(key), Some(revealed));
                assert_eq!(crate::logic::map::occupancy(key), None);
                crate::logic::map::MapState::mark_reward_extracted(key);
                assert_eq!(
                    crate::logic::map::tile(key),
                    Some(crate::map::TileOpt { data: revealed.data + crate::map::REWARD_EXTRACTED_FLAG }),
                );
            },
        );
    }
}

#[test]
#[should_panic(expected: "tile already revealed")]
fn revealing_a_stored_tile_twice_is_refused() {
    let d = super::registrar::setup();
    interact_with_state(
        d.games,
        || {
            let key = crate::map::TileKey { game_id: 7, alt: false, col: 120, row: 130 };
            crate::logic::map::MapState::reveal(key, 11);
            crate::logic::map::MapState::reveal(key, 12);
        },
    );
}

#[test]
fn reverse_positions_preserve_origin_full_coordinates_and_clear_on_vacate() {
    let d = super::registrar::setup();
    interact_with_state(
        d.games,
        || {
            let entity = ResourceKey { game_id: 7, entity_id: 99 };
            assert_eq!(crate::logic::map::entity_coord(entity), None);
            for alt in array![false, true] {
                for x in array![0_u32, 1, 0xffffffff] {
                    for y in array![0_u32, 1, 0xffffffff] {
                        let coord = crate::troops::Coord { alt, x, y };
                        let key = crate::geometry::tile_key(entity.game_id, coord);
                        crate::logic::map::MapState::occupy(
                            key, entity.entity_id, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false,
                        );
                        assert_eq!(crate::logic::map::entity_coord(entity), Some(coord));
                        crate::logic::map::MapState::vacate(key, entity.entity_id);
                        assert_eq!(crate::logic::map::entity_coord(entity), None);
                        assert_eq!(crate::logic::map::occupancy(key), None);
                    }
                }
            }
            let surface = crate::troops::Coord { alt: false, x: 0, y: 0 };
            let alternate = crate::troops::Coord { alt: true, x: 0xffffffff, y: 0xffffffff };
            crate::logic::map::MapState::occupy(
                crate::geometry::tile_key(entity.game_id, surface),
                entity.entity_id,
                crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER,
                false,
            );
            crate::logic::map::MapState::relocate_fixture(
                entity, alternate, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false,
            );
            assert_eq!(crate::logic::map::entity_coord(entity), Some(alternate));
            assert_eq!(crate::logic::map::occupancy(crate::geometry::tile_key(entity.game_id, surface)), None);
        },
    );
}

#[test]
fn tile_only_occupants_and_reservations_have_no_reverse_position() {
    let d = super::registrar::setup();
    interact_with_state(
        d.games,
        || {
            let key = crate::map::TileKey { game_id: 7, alt: false, col: 120, row: 130 };
            for category in array![crate::taxonomy::CHEST_OCCUPIER, crate::taxonomy::SPIRE_OCCUPIER] {
                crate::logic::map::MapState::occupy(key, 99, category, false);
                assert_eq!(crate::logic::map::entity_coord(ResourceKey { game_id: 7, entity_id: 99 }), None);
                assert!(crate::logic::map::occupancy(key).is_some());
                crate::logic::map::MapState::vacate(key, 99);
            }
            crate::logic::map::MapState::reveal(key, 11);
            crate::logic::map::MapState::reserve_hyperstructure(key);
            assert_eq!(crate::logic::map::entity_coord(ResourceKey { game_id: 7, entity_id: 0 }), None);
            crate::logic::map::MapState::release_hyperstructure(key);
            assert_eq!(crate::logic::map::occupancy(key), None);
        },
    );
}

#[test]
#[should_panic(expected: "entity already placed")]
fn an_entity_at_the_origin_cannot_be_placed_twice() {
    let d = super::registrar::setup();
    interact_with_state(
        d.games,
        || {
            let origin = crate::map::TileKey { game_id: 7, alt: false, col: 0, row: 0 };
            crate::logic::map::MapState::occupy(origin, 99, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false);
            crate::logic::map::MapState::occupy(
                crate::map::TileKey { col: 1, ..origin }, 99, crate::taxonomy::EXPLORER_KNIGHT_T1_OCCUPIER, false,
            );
        },
    );
}
