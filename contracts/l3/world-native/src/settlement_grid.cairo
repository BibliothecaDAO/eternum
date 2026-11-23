use crate::geometry::checked_neighbor_at_distance;
use crate::troops::Coord;

/// The tile settlement, reservation and discovery layouts are measured from.
pub fn map_center(map_center_offset: u32) -> Coord {
    let center = 2147483646 - map_center_offset;
    Coord { alt: false, x: center, y: center }
}

#[derive(Copy, Drop)]
struct Distances {
    base: u32,
    step: u32,
    mirror_first: u32,
    mirror_second: u32,
}

pub fn validate_spacing(spacing: u32) {
    assert!(spacing >= 2 && spacing % 2 == 0, "invalid settlement spacing");
}

fn distances(spacing: u32) -> Distances {
    validate_spacing(spacing);
    Distances { base: spacing, step: spacing * 3 / 2 + 3, mirror_first: spacing + 3, mirror_second: spacing / 2 }
}

// A candidate's ordinal replaces the mutable side/ring/point cursor and stored coordinates.
pub fn settlement_location(center: Coord, spacing: u32, candidate: u32) -> Coord {
    let distances = distances(spacing);
    let side = candidate % 6;
    let mut point = candidate / 6;
    let mut ring = 1;
    while point >= 2 * ring {
        point -= 2 * ring;
        ring += 1;
    }
    point += 1;
    let (start, triangle) = *array![(1_u8, 3_u8), (3, 5), (5, 1), (2, 4), (4, 0), (0, 2)].at(side);
    let first = neighbor_at_distance(neighbor_at_distance(center, start, distances.base), triangle, distances.base / 2);
    let first = neighbor_at_distance(first, start, distances.step * (ring - 1));
    if point <= ring {
        let a = neighbor_at_distance(first, triangle, distances.step * (point - 1));
        neighbor_at_distance(neighbor_at_distance(a, start, 2), triangle, 1)
    } else {
        let anchor = neighbor_at_distance(first, triangle, distances.step * (2 * ring - point));
        let a = neighbor_at_distance(
            neighbor_at_distance(anchor, start, distances.mirror_first), triangle, distances.mirror_second,
        );
        neighbor_at_distance(neighbor_at_distance(a, triangle, 2), start, 1)
    }
}

#[derive(Copy, Drop)]
struct Corner {
    coord: Coord,
    first: u8,
    second: u8,
}

fn corner(center: Coord, spacing: u32, candidate: u32) -> Corner {
    let distances = distances(spacing);
    let side = candidate % 6;
    let mut point = candidate / 6;
    let mut ring = 1;
    while point >= 2 * ring {
        point -= 2 * ring;
        ring += 1;
    }
    point += 1;
    let (start, triangle) = *array![(1_u8, 3_u8), (3, 5), (5, 1), (2, 4), (4, 0), (0, 2)].at(side);
    let first = neighbor_at_distance(neighbor_at_distance(center, start, distances.base), triangle, distances.base / 2);
    let first = neighbor_at_distance(first, start, distances.step * (ring - 1));
    if point <= ring {
        Corner {
            coord: neighbor_at_distance(first, triangle, distances.step * (point - 1)), first: start, second: triangle,
        }
    } else {
        let anchor = neighbor_at_distance(first, triangle, distances.step * (2 * ring - point));
        let coord = neighbor_at_distance(
            neighbor_at_distance(anchor, start, distances.mirror_first), triangle, distances.mirror_second,
        );
        Corner { coord, first: triangle, second: start }
    }
}

pub fn triple_settlement_locations(center: Coord, spacing: u32, candidate: u32) -> Span<Coord> {
    let corner = corner(center, spacing, candidate);
    let second = neighbor_at_distance(corner.coord, corner.first, 3);
    array![corner.coord, second, neighbor_at_distance(second, corner.second, 3)].span()
}

fn neighbor_at_distance(coord: Coord, direction: u8, distance: u32) -> Coord {
    checked_neighbor_at_distance(coord, direction, distance).expect('settlement geometry exhausted')
}
