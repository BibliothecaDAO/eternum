use crate::geometry::checked_neighbor_at_distance;
use crate::settlement::SettlementMode;
use crate::troops::Coord;

#[derive(Copy, Drop)]
struct Distances {
    base: u32,
    step: u32,
    mirror_first: u32,
    mirror_second: u32,
}

fn distances(profile: u8) -> Distances {
    match profile {
        1 => Distances { base: 6, step: 12, mirror_first: 9, mirror_second: 3 },
        0 | 2 => Distances { base: 8, step: 15, mirror_first: 11, mirror_second: 4 },
        _ => panic!("unknown settlement profile"),
    }
}

pub fn target_pool_size(registered: u16, limit: u16, mode: SettlementMode) -> u16 {
    if registered >= limit {
        return 0;
    }
    let remaining = limit - registered;
    let window = if mode == SettlementMode::Duel {
        remaining
    } else if registered < 3 {
        6
    } else if registered < 15 {
        9
    } else {
        12
    };
    core::cmp::min(window, remaining)
}

// A candidate's ordinal replaces the mutable side/ring/point cursor and stored coordinates.
pub fn settlement_location(center: Coord, mode: SettlementMode, profile: u8, candidate: u32) -> Span<Coord> {
    if mode == SettlementMode::Duel {
        return duel_location(center, candidate);
    }
    let distances = distances(profile);
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
        let b = neighbor_at_distance(a, start, 3);
        let c = neighbor_at_distance(b, triangle, 3);
        let middle = neighbor_at_distance(neighbor_at_distance(a, start, 2), triangle, 1);
        select_location(mode, a, b, c, middle)
    } else {
        let anchor = neighbor_at_distance(first, triangle, distances.step * (2 * ring - point));
        let a = neighbor_at_distance(
            neighbor_at_distance(anchor, start, distances.mirror_first), triangle, distances.mirror_second,
        );
        let b = neighbor_at_distance(a, triangle, 3);
        let c = neighbor_at_distance(b, start, 3);
        let middle = neighbor_at_distance(neighbor_at_distance(a, triangle, 2), start, 1);
        select_location(mode, a, b, c, middle)
    }
}

fn select_location(mode: SettlementMode, a: Coord, b: Coord, c: Coord, middle: Coord) -> Span<Coord> {
    if mode == SettlementMode::Single {
        array![middle].span()
    } else {
        array![a, b, c].span()
    }
}

fn duel_location(center: Coord, candidate: u32) -> Span<Coord> {
    assert!(candidate < 2, "two players already settled");
    let (outward, lower, upper) = if candidate == 0 {
        (3, 4, 2)
    } else {
        (0, 5, 1)
    };
    let anchor = neighbor_at_distance(center, outward, 4);
    array![
        neighbor_at_distance(center, outward, 8), neighbor_at_distance(anchor, lower, 2),
        neighbor_at_distance(anchor, upper, 2),
    ]
        .span()
}

pub fn reservation_count(limit: u16, mode: SettlementMode) -> u32 {
    if mode == SettlementMode::Duel {
        return 3;
    }
    let mut ring = 0_u32;
    while limit.into() >= 6 * ring * ring + 1 {
        ring += 1;
    }
    1 + 3 * ring * (ring + 1)
}

pub fn reservation_location(center: Coord, mode: SettlementMode, profile: u8, candidate: u32) -> Coord {
    if candidate == 0 {
        return center;
    }
    if mode == SettlementMode::Duel {
        assert!(candidate < 3, "all duel reservations placed");
        let direction = if candidate == 1 {
            1
        } else {
            5
        };
        return neighbor_at_distance(neighbor_at_distance(center, direction, 6), 3, 3);
    }
    let step = distances(profile).step;
    let mut point = candidate - 1;
    let mut ring = 1;
    while point >= 6 * ring {
        point -= 6 * ring;
        ring += 1;
    }
    let (outward, tangent) = *array![(0_u8, 2_u8), (5, 1), (4, 0), (3, 5), (2, 4), (1, 3)].at(point / ring);
    neighbor_at_distance(neighbor_at_distance(center, outward, step * ring), tangent, step * (point % ring))
}

fn neighbor_at_distance(coord: Coord, direction: u8, distance: u32) -> Coord {
    checked_neighbor_at_distance(coord, direction, distance).expect('settlement geometry exhausted')
}
