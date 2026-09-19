use crate::map::TileKey;
use crate::troops::Coord;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub enum Direction {
    East,
    NorthEast,
    NorthWest,
    West,
    SouthWest,
    SouthEast,
}

pub impl DirectionTryInto of TryInto<u8, Direction> {
    fn try_into(self: u8) -> Option<Direction> {
        match self {
            0 => Some(Direction::East),
            1 => Some(Direction::NorthEast),
            2 => Some(Direction::NorthWest),
            3 => Some(Direction::West),
            4 => Some(Direction::SouthWest),
            5 => Some(Direction::SouthEast),
            _ => None,
        }
    }
}

pub fn tile_key(game_id: u32, coord: Coord) -> TileKey {
    TileKey { game_id, alt: coord.alt, col: coord.x, row: coord.y }
}

pub fn neighbor(coord: Coord, direction: u8) -> Coord {
    let stride: u32 = if coord.alt {
        15
    } else {
        1
    };
    let east = if coord.y % 2 == 0 {
        stride
    } else {
        0
    };
    let west = stride - east;
    match direction {
        0 => Coord { x: coord.x + stride, ..coord },
        1 => Coord { x: coord.x + east, y: coord.y + stride, ..coord },
        2 => Coord { x: coord.x - west, y: coord.y + stride, ..coord },
        3 => Coord { x: coord.x - stride, ..coord },
        4 => Coord { x: coord.x - west, y: coord.y - stride, ..coord },
        5 => Coord { x: coord.x + east, y: coord.y - stride, ..coord },
        _ => panic!("invalid direction"),
    }
}

pub fn spire_neighbor(coord: Coord, direction: u8) -> Coord {
    let adjacent = neighbor(Coord { alt: false, ..coord }, direction);
    Coord { alt: coord.alt, ..adjacent }
}

pub fn neighbor_at_distance(coord: Coord, direction: u8, distance: u32) -> Coord {
    checked_neighbor_at_distance(coord, direction, distance).expect('coordinate outside map')
}

pub fn checked_neighbor_at_distance(coord: Coord, direction: u8, distance: u32) -> Option<Coord> {
    let distance: i128 = distance.into() * if coord.alt {
        15
    } else {
        1
    };
    let row: i128 = coord.y.into();
    let column: i128 = coord.x.into() - (row + row % 2) / 2;
    let (column, row) = match direction {
        0 => (column + distance, row),
        1 => (column, row + distance),
        2 => (column - distance, row + distance),
        3 => (column - distance, row),
        4 => (column, row - distance),
        5 => (column + distance, row - distance),
        _ => panic!("invalid direction"),
    };
    Some(Coord { alt: coord.alt, x: (column + (row + row % 2) / 2).try_into()?, y: row.try_into()? })
}

pub fn adjacent(left: Coord, right: Coord) -> bool {
    left.alt == right.alt && distance(left, right) == if left.alt {
        15
    } else {
        1
    }
}

pub fn distance(left: Coord, right: Coord) -> u128 {
    let left_row: i128 = left.y.into();
    let right_row: i128 = right.y.into();
    let left_q: i128 = left.x.into() - (left_row + (left.y % 2).into()) / 2;
    let right_q: i128 = right.x.into() - (right_row + (right.y % 2).into()) / 2;
    let dq = left_q - right_q;
    let dr = left_row - right_row;
    core::cmp::max(core::cmp::max(abs(dq), abs(dr)), abs(dq + dr)).try_into().unwrap()
}

fn abs(value: i128) -> i128 {
    if value < 0 {
        -value
    } else {
        value
    }
}
