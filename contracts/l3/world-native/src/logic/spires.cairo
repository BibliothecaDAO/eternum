use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::spires::{ExpeditionSpire, ExpeditionSpireKey};
use crate::troops::Coord;

pub fn discover_on_reveal(key: ExpeditionSpireKey, coord: Coord, learned: u64, mode_rules: u32, seed: u256) -> bool {
    if key.depth >= 3
        || mode_rules & crate::rules::DISCOVER_SPIRES == 0
        || crate::research::tier(learned, crate::research::ROW_DEPTH) == 0 {
        return false;
    }
    if !discover(key, coord, seed) {
        return false;
    }
    crate::logic::map::MapState::occupy(
        crate::geometry::tile_key(key.game_id, coord),
        crate::entity_ids::allocate_home(key.game_id, key.structure_id),
        crate::taxonomy::SPIRE_OCCUPIER,
        false,
    );
    crate::logic::expeditions::record_discovery(
        crate::expeditions::ExpeditionDiscoveryKey {
            game_id: key.game_id, structure_id: key.structure_id, epoch: key.epoch,
        },
        crate::discovery::Discovery::Spire,
    );
    true
}

pub fn read(key: ExpeditionSpireKey) -> Option<ExpeditionSpire> {
    crate::state::read()
        .map_rules
        .expedition_spires
        .read((key.game_id, key.structure_id, key.epoch, key.depth))
        .map(
            |row| {
                let (reveals, location) = row;
                ExpeditionSpire {
                    reveals, location: location.map(|point| {
                        let (x, y) = point;
                        Coord { alt: false, x, y }
                    }),
                }
            },
        )
}

pub fn discover(key: ExpeditionSpireKey, coord: Coord, seed: u256) -> bool {
    assert!(key.depth < 3 && !coord.alt, "spires require an upper layer");
    let previous = read(key).unwrap_or(ExpeditionSpire { reveals: 0, location: None });
    if previous.location.is_some() {
        return false;
    }
    let next = crate::spires::discover(previous, coord, seed);
    write(key, next);
    next.location.is_some()
}

fn write(key: ExpeditionSpireKey, next: ExpeditionSpire) {
    crate::state::write()
        .map_rules
        .expedition_spires
        .write(
            (key.game_id, key.structure_id, key.epoch, key.depth),
            Some((next.reveals, next.location.map(|point| (point.x, point.y)))),
        );
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    next.serialize(ref values);
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'ExpeditionSpire', keys: keys.span(), values: values.span() },
        ),
    );
}

pub fn descent_origin(key: ExpeditionSpireKey, army: Coord, target_depth: u8) -> Coord {
    assert!(key.depth < 3 && target_depth == key.depth + 1, "spire leads one layer down");
    let spire = read(key).and_then(|row| row.location).expect('spire has not been found');
    assert!(army == spire || crate::geometry::adjacent(army, spire), "army must be at its realm's spire");
    spire
}

pub fn nearest_free_arrival(game_id: u32, origin: Coord, spacing: u32) -> Coord {
    if crate::logic::map::occupancy(crate::geometry::tile_key(game_id, origin)).is_none() {
        return origin;
    }
    for radius in 1..spacing {
        for direction in 0_u8..6 {
            for step in 0..radius {
                let Some(point) = crate::geometry::checked_neighbor_at_distance(origin, direction, radius)
                    .and_then(
                        |corner| crate::geometry::checked_neighbor_at_distance(corner, (direction + 2) % 6, step),
                    ) else {
                    continue;
                };
                if crate::expeditions::inside_region(origin, point, spacing)
                    && crate::logic::map::occupancy(crate::geometry::tile_key(game_id, point)).is_none() {
                    return point;
                }
            }
        }
    }
    panic!("destination layer is full")
}
