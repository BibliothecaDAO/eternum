use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::geometry::{neighbor, spire_neighbor, tile_key};
use crate::map::IMapLogicDispatcher;
use crate::registrar::IRegistrarSafeDispatcherTrait;
use crate::spires::{
    ISpiresDispatcher, ISpiresDispatcherTrait, ISpiresSafeDispatcher, ISpiresSafeDispatcherTrait, SpireLayout, location,
};
use crate::tests::state::MapObservationTrait;
use crate::troops::Coord;
use super::{Deployment, authority, setup};

fn deployment() -> Deployment {
    let d = setup(true);
    d
}

fn layout(count: u16) -> SpireLayout {
    SpireLayout { count, base_distance: 15, layer_distance: 2, max_layer: 4 }
}
fn spires(d: Deployment) -> ISpiresDispatcher {
    ISpiresDispatcher { contract_address: d.games }
}
fn map(d: Deployment) -> IMapLogicDispatcher {
    IMapLogicDispatcher { contract_address: d.games }
}
fn center(d: Deployment, game_id: u32) -> Coord {
    let rules = IGameDispatcher { contract_address: d.games }.rules(game_id);
    Coord { alt: false, x: 2147483646 - rules.map_center_offset, y: 2147483646 - rules.map_center_offset }
}
fn seed_layout(d: Deployment, game_id: u32, config: SpireLayout) {
    let games = IGameDispatcher { contract_address: d.games };
    let mut preset = super::recorded::fixture_preset(games.rules(game_id));
    preset.settlement.spires = Some(config);
    super::recorded::seed_game_with_preset(d.games, game_id, games.game(game_id), preset);
}
fn initialize(d: Deployment, game_id: u32) {
    start_cheat_caller_address(d.games, authority());
    spires(d).initialize_spires(game_id);
    stop_cheat_caller_address(d.games);
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
    let games = IGameDispatcher { contract_address: d.games };
    super::recorded::seed_game(
        d.games, 3, crate::game::GameRegistry { dev_mode_on: false, ..games.game(1) }, games.rules(1),
    );
    seed_layout(d, 3, layout(7));
    let first_layout = spires(d).spire_layout(1);
    initialize(d, 3);
    assert_eq!(spires(d).spire_layout(3), Some(layout(7)));
    assert_eq!(spires(d).spire_layout(1), first_layout);
    for index in 0_u32..7 {
        let coord = location(center(d, 3), layout(7), index);
        for alt in array![false, true] {
            let coord = Coord { alt, ..coord };
            let tile = map(d).tile(tile_key(3, coord)).unwrap();
            assert_eq!((tile.data / 512) % 0x100000000, (index + 1).into());
            assert_eq!((tile.data / 2) % 256, 35);
            assert_eq!(tile.data % 2, 1);
            super::state::assert_spatial_indexes(
                d.games, 3, array![(index + 1).try_into().unwrap()].span(), array![coord].span(),
            );
            for direction in 0_u8..6 {
                let access = map(d).tile(tile_key(3, spire_neighbor(coord, direction))).unwrap();
                assert!(access.data / 0x20000000000 % 256 != 0);
                assert_eq!(access.data % 0x20000000000, 0);
            }
        }
    }
    assert_eq!(
        crate::game::IPointsDispatcherTrait::season_points(
            crate::game::IPointsDispatcher { contract_address: d.games }, 3,
        ),
        0,
    );
    assert!(map(d).tile(tile_key(1, center(d, 1))).is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn initialization_rejects_invalid_layouts_blitz_and_repeats() {
    let d = deployment();
    seed_layout(d, 1, layout(1));
    let safe = ISpiresSafeDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    assert!(safe.initialize_spires(999).is_err());
    for invalid in array![
        layout(0), layout(20), SpireLayout { base_distance: 0, ..layout(7) },
        SpireLayout { layer_distance: 0, ..layout(7) }, SpireLayout { base_distance: 1, ..layout(7) },
        SpireLayout { max_layer: 1, ..layout(7) },
    ] {
        let games = IGameDispatcher { contract_address: d.games };
        let mut preset = super::recorded::fixture_preset(games.rules(1));
        preset.settlement.spires = Some(invalid);
        assert!(
            crate::registrar::IRegistrarSafeDispatcher { contract_address: d.games }
                .register_preset(20000, preset)
                .is_err(),
        );
        assert_eq!(spires(d).spire_layout(1), Some(layout(1)));
        assert!(map(d).tile(tile_key(1, center(d, 1))).is_none());
    }
    let games = IGameDispatcher { contract_address: d.games };
    super::recorded::seed_game(
        d.games,
        3,
        games.game(1),
        crate::rules::SliceRules {
            mode_rules: super::recorded::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::recorded::BLITZ_COMMAND_MASK,
            ..games.rules(1),
        },
    );
    start_cheat_caller_address(d.games, authority());
    assert!(safe.initialize_spires(3).is_err());
    safe.initialize_spires(1).unwrap();
    assert!(safe.initialize_spires(1).is_err());
    assert_eq!(spires(d).spire_layout(1), Some(layout(1)));
}

#[test]
fn center_only_layout_needs_no_lattice_spacing_and_preserves_revealed_access() {
    let d = deployment();
    seed_layout(d, 1, SpireLayout { count: 1, base_distance: 0, layer_distance: 0, max_layer: 0 });
    let coord = center(d, 1);
    let access = tile_key(1, spire_neighbor(Coord { alt: true, ..coord }, 0));
    start_cheat_caller_address(d.games, d.games);
    map(d).reveal(access, 17);
    initialize(d, 1);
    assert_eq!(map(d).tile(access).unwrap().data / 0x20000000000 % 256, 17);
    assert!(map(d).tile(tile_key(1, neighbor(Coord { alt: true, ..coord }, 0))).is_none());
}

#[test]
#[feature("safe_dispatcher")]
fn an_occupied_alternate_center_rejects_before_revealing_the_surface() {
    let d = deployment();
    seed_layout(d, 1, layout(1));
    let coord = center(d, 1);
    start_cheat_caller_address(d.games, d.games);
    map(d).occupy(tile_key(1, Coord { alt: true, ..coord }), 99, 15, false);
    start_cheat_caller_address(d.games, authority());
    assert!(ISpiresSafeDispatcher { contract_address: d.games }.initialize_spires(1).is_err());
    assert!(map(d).tile(tile_key(1, coord)).is_none());
    assert_eq!(spires(d).spire_layout(1), Some(layout(1)));
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

#[test]
#[feature("safe_dispatcher")]
fn internal_spire_initialization_accepts_a_game_with_a_different_creator() {
    let d = deployment();
    seed_layout(d, 1, layout(1));
    let games = IGameDispatcher { contract_address: d.games };
    let game = crate::game::GameRegistry { creator: d.actor, ..games.game(1) };
    super::resource_commands::set_fixture(d.games, selector!("games"), selector!("games"), array![1].span(), game);
    assert!(d.actor != authority());
    let safe = ISpiresSafeDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    safe.initialize_spires(1).unwrap();
    assert!(map(d).tile(tile_key(1, center(d, 1))).is_some());
}
