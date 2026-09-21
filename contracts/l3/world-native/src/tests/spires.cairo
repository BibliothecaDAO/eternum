use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::geometry::{neighbor, spire_neighbor, tile_key};
use crate::map::{IMapDispatcher, IMapDispatcherTrait};
use crate::spires::{
    ISpiresDispatcher, ISpiresDispatcherTrait, ISpiresSafeDispatcher, ISpiresSafeDispatcherTrait, SpireLayout, location,
};
use crate::troops::Coord;
use super::{Deployment, authority, setup};

fn deployment() -> Deployment {
    let d = setup(true);
    stop_cheat_caller_address(d.peers.season);
    d
}

fn layout(count: u16) -> SpireLayout {
    SpireLayout { count, base_distance: 15, layer_distance: 2, max_layer: 4 }
}
fn spires(d: Deployment) -> ISpiresDispatcher {
    ISpiresDispatcher { contract_address: d.peers.map }
}
fn map(d: Deployment) -> IMapDispatcher {
    IMapDispatcher { contract_address: d.peers.map }
}
fn center(d: Deployment, game_id: u32) -> Coord {
    let rules = IGameDispatcher { contract_address: d.peers.season }.rules(game_id);
    Coord { alt: false, x: 2147483646 - rules.map_center_offset, y: 2147483646 - rules.map_center_offset }
}
fn initialize(d: Deployment, game_id: u32, config: SpireLayout) {
    start_cheat_caller_address(d.peers.map, authority());
    spires(d).initialize_spires(game_id, config);
    stop_cheat_caller_address(d.peers.map);
}

#[test]
fn lattice_retains_center_then_point_side_order_and_hex_geometry() {
    let center = Coord { alt: false, x: 100, y: 100 };
    let expected = array![(100, 100), (130, 100), (115, 70), (85, 70), (70, 100), (85, 130), (115, 130), (160, 100)];
    for index in 0..expected.len() {
        let (x, y) = *expected.at(index);
        assert_eq!(location(center, layout(19), index), Coord { alt: false, x, y });
    }
    assert_eq!(location(center, layout(19), 13), Coord { alt: false, x: 145, y: 70 });
    let mut seen = array![];
    for index in 0_u32..19 {
        let coord = location(center, layout(19), index);
        for previous in seen.span() {
            assert!(*previous != coord, "duplicate spire position");
        }
        seen.append(coord);
        assert_eq!((coord.x + (coord.y % 2)) % 15, 10);
    }
}

#[test]
fn production_initialization_places_the_same_spire_identity_on_both_layers_without_rewards() {
    let d = deployment();
    let games = IGameDispatcher { contract_address: d.peers.season };
    start_cheat_caller_address(d.peers.season, authority());
    games.create_game(3, crate::game::GameRegistry { dev_mode_on: false, ..games.game(1) }, games.rules(1));
    stop_cheat_caller_address(d.peers.season);
    initialize(d, 3, layout(7));
    assert_eq!(spires(d).spire_layout(3), Some(layout(7)));
    assert!(spires(d).spire_layout(1).is_none());
    for index in 0_u32..7 {
        let coord = location(center(d, 3), layout(7), index);
        for alt in array![false, true] {
            let coord = Coord { alt, ..coord };
            let tile = map(d).tile(tile_key(3, coord)).unwrap();
            assert_eq!((tile.data / 512) % 0x100000000, (index + 1).into());
            assert_eq!((tile.data / 2) % 256, 35);
            assert_eq!(tile.data % 2, 1);
            for direction in 0_u8..6 {
                let access = map(d).tile(tile_key(3, spire_neighbor(coord, direction))).unwrap();
                assert!(access.data / 0x20000000000 % 256 != 0);
                assert_eq!(access.data % 0x20000000000, 0);
            }
        }
    }
    assert_eq!(games.season_points(3), 0);
    assert!(map(d).tile(tile_key(1, center(d, 1))).is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn initialization_rejects_invalid_layouts_foreign_callers_blitz_and_repeats() {
    let d = deployment();
    let safe = ISpiresSafeDispatcher { contract_address: d.peers.map };
    assert!(safe.initialize_spires(1, layout(1)).is_err());
    start_cheat_caller_address(d.peers.map, authority());
    assert!(safe.initialize_spires(999, layout(1)).is_err());
    for invalid in array![
        layout(0), layout(20), SpireLayout { base_distance: 0, ..layout(7) },
        SpireLayout { layer_distance: 0, ..layout(7) }, SpireLayout { base_distance: 1, ..layout(7) },
        SpireLayout { max_layer: 1, ..layout(7) },
    ] {
        assert!(safe.initialize_spires(1, invalid).is_err());
        assert!(spires(d).spire_layout(1).is_none());
        assert!(map(d).tile(tile_key(1, center(d, 1))).is_none());
    }
    let games = IGameDispatcher { contract_address: d.peers.season };
    start_cheat_caller_address(d.peers.season, authority());
    games
        .create_game(
            3,
            games.game(1),
            crate::rules::SliceRules {
                mode_id: 1, command_mask: 0xffffffffffffffffffffffffffffffff_u128, ..games.rules(1),
            },
        );
    stop_cheat_caller_address(d.peers.season);
    assert!(safe.initialize_spires(3, layout(1)).is_err());
    safe.initialize_spires(1, layout(1)).unwrap();
    assert!(safe.initialize_spires(1, layout(7)).is_err());
    assert_eq!(spires(d).spire_layout(1), Some(layout(1)));
}

#[test]
fn center_only_layout_needs_no_lattice_spacing_and_preserves_revealed_access() {
    let d = deployment();
    let coord = center(d, 1);
    let access = tile_key(1, spire_neighbor(Coord { alt: true, ..coord }, 0));
    start_cheat_caller_address(d.peers.map, d.peers.troops);
    map(d).reveal(access, 17);
    initialize(d, 1, SpireLayout { count: 1, base_distance: 0, layer_distance: 0, max_layer: 0 });
    assert_eq!(map(d).tile(access).unwrap().data / 0x20000000000 % 256, 17);
    assert!(map(d).tile(tile_key(1, neighbor(Coord { alt: true, ..coord }, 0))).is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn an_occupied_alternate_center_rejects_before_revealing_the_surface() {
    let d = deployment();
    let coord = center(d, 1);
    start_cheat_caller_address(d.peers.map, d.peers.troops);
    map(d).occupy(tile_key(1, Coord { alt: true, ..coord }), 99, 15, false);
    start_cheat_caller_address(d.peers.map, authority());
    assert!(ISpiresSafeDispatcher { contract_address: d.peers.map }.initialize_spires(1, layout(1)).is_err());
    assert!(map(d).tile(tile_key(1, coord)).is_none());
    assert!(spires(d).spire_layout(1).is_none());
    let occupied = map(d).tile(tile_key(1, Coord { alt: true, ..coord })).unwrap();
    assert_eq!((occupied.data / 512) % 0x100000000, 99);
}

#[test]
fn eternum_preset_spires_follow_the_pinned_east_southwest_ring_order() {
    let center = Coord { alt: false, x: 2000000, y: 2000000 };
    let preset = SpireLayout { count: 6, base_distance: 10, layer_distance: 6, max_layer: 6 };
    // Pinned start directions: E, SE, SW, W, NW; the center consumes ordinal zero.
    let expected = array![
        (2000000, 2000000), (2000060, 2000000), (2000030, 1999940), (1999970, 1999940), (1999940, 2000000),
        (1999970, 2000060),
    ];
    for index in 0..expected.len() {
        let (x, y) = *expected.at(index);
        assert_eq!(location(center, preset, index), Coord { alt: false, x, y });
    }
}
