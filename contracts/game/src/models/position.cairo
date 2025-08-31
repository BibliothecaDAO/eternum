use core::fmt::{Display, Error, Formatter};
use core::num::traits::zero::Zero;
use core::option::OptionTrait;
use core::traits::{Into, TryInto};
use s1_eternum::utils::number::NumberTrait;

// todo@credence revisit zone calculation

// start col and row for eternum = 2147483647
// nb of cols = 500
const HIGHEST_COL: u32 = 2147484147;
const LOWEST_COL: u32 = 2147483647;
// nb of rows = 300
const HIGHEST_ROW: u32 = 2147483947;
const LOWEST_ROW: u32 = 2147483647;

const CENTER_ROW: u32 = 2147483646;
const CENTER_COL: u32 = CENTER_ROW;


// multiplier to convert hex distance to km
const HEX_DISTANCE_TO_KM: u128 = 1;


// https://www.redblobgames.com/grids/hexagons/#coordinates-cube

#[derive(Copy, Drop, PartialEq, Serde)]
struct Cube {
    q: i128,
    r: i128,
    s: i128,
}

#[derive(Copy, Drop, Serde, Default, IntrospectPacked)]
pub struct Travel {
    pub blocked: bool,
    pub round_trip: bool,
    pub start_coord: Coord,
    pub next_coord: Coord,
}

impl CubeZeroable of Zero<Cube> {
    fn zero() -> Cube {
        Cube { q: 0, r: 0, s: 0 }
    }
    fn is_zero(self: @Cube) -> bool {
        self.q == @0 && self.r == @0 && self.s == @0
    }

    fn is_non_zero(self: @Cube) -> bool {
        !self.is_zero()
    }
}

#[generate_trait]
impl CubeImpl of CubeTrait {
    fn subtract(self: Cube, other: Cube) -> Cube {
        Cube { q: self.q - other.q, r: self.r - other.r, s: self.s - other.s }
    }

    fn add(self: Cube, other: Cube) -> Cube {
        Cube { q: self.q + other.q, r: self.r + other.r, s: self.s + other.s }
    }

    fn abs(self: Cube) -> Cube {
        Cube { q: self.q.abs(), r: self.r.abs(), s: self.s.abs() }
    }

    fn neighbor_after_distance(self: Cube, direction: Direction, tile_distance: u32) -> Cube {
        // https://www.redblobgames.com/grids/hexagons/#neighbors-cube

        // NOTE: NorthEast and SouthEast are swapped
        //      Also, NorthWest and SouthWest
        let di: i128 = tile_distance.into();
        let cube_direction_vectors = match direction {
            Direction::East => Cube { q: di, r: 0, s: -di },
            Direction::NorthEast => Cube { q: 0, r: di, s: -di },
            Direction::NorthWest => Cube { q: -di, r: di, s: 0 },
            Direction::West => Cube { q: -di, r: 0, s: di },
            Direction::SouthWest => Cube { q: 0, r: -di, s: di },
            Direction::SouthEast => Cube { q: di, r: -di, s: 0 },
        };

        let neighbor = self.add(cube_direction_vectors);
        neighbor
    }


    fn distance(self: Cube, other: Cube) -> u128 {
        // https://www.redblobgames.com/grids/hexagons/#distances

        // calculate difference between cubes
        let cube_diff = self.subtract(other);
        let abs_cube_diff = cube_diff.abs();

        // get max(abs_cube_diff.q, abs_cube_diff.r, abs_cube_diff.s)
        let max = if abs_cube_diff.q > abs_cube_diff.r {
            if abs_cube_diff.q > abs_cube_diff.s {
                abs_cube_diff.q
            } else {
                abs_cube_diff.s
            }
        } else {
            if abs_cube_diff.r > abs_cube_diff.s {
                abs_cube_diff.r
            } else {
                abs_cube_diff.s
            }
        };

        max.try_into().unwrap()
    }

    fn scale(self: Cube, factor: i128) -> Cube {
        // https://www.redblobgames.com/grids/hexagons/#rings-single
        Cube { q: self.q * factor, r: self.r * factor, s: self.s * factor }
    }

    fn ring(self: Cube, radius: u32) -> Array<Cube> {
        // https://www.redblobgames.com/grids/hexagons/#rings-single
        assert!(radius > 0, "Eternum: Ring radius must be greater than 0");

        let mut results: Array<Cube> = array![];
        let mut zero_cube: Cube = Zero::zero();
        let mut hex = self.add(zero_cube.neighbor_after_distance(Direction::SouthWest, 1).scale(radius.into()));
        for direction in DirectionImpl::all() {
            for _ in 0..radius {
                results.append(hex);
                hex = hex.neighbor_after_distance(direction, 1);
            }
        }
        results
    }
}


pub const NUM_DIRECTIONS: u8 = 6;

#[derive(Drop, Copy, Serde, Introspect, PartialEq, Default, DojoStore)]
pub enum Direction {
    #[default]
    East,
    NorthEast,
    NorthWest,
    West,
    SouthWest,
    SouthEast,
}

#[generate_trait]
pub impl DirectionImpl of DirectionTrait {
    fn all() -> Array<Direction> {
        array![
            Direction::East, Direction::NorthEast, Direction::NorthWest, Direction::West, Direction::SouthWest,
            Direction::SouthEast,
        ]
    }
}

pub impl DirectionDisplay of Display<Direction> {
    fn fmt(self: @Direction, ref f: Formatter) -> Result<(), Error> {
        let str: ByteArray = format!("Direction: ");
        f.buffer.append(@str);

        match self {
            Direction::East => { f.buffer.append(@"East") },
            Direction::NorthEast => { f.buffer.append(@"NorthEast") },
            Direction::NorthWest => { f.buffer.append(@"NorthWest") },
            Direction::West => { f.buffer.append(@"West") },
            Direction::SouthWest => { f.buffer.append(@"SouthWest") },
            Direction::SouthEast => { f.buffer.append(@"SouthEast") },
        }
        Result::Ok(())
    }
}


#[derive(Copy, Drop, PartialEq, Serde, Introspect, Debug, Default, DojoStore)]
pub struct Coord {
    pub x: u32,
    pub y: u32,
}


pub impl CoordDisplay of Display<Coord> {
    fn fmt(self: @Coord, ref f: Formatter) -> Result<(), Error> {
        let str: ByteArray = format!("Coord (x:{}, y:{}) ", self.x, self.y);
        f.buffer.append(@str);

        Result::Ok(())
    }
}

#[generate_trait]
pub impl CoordImpl of CoordTrait {
    fn center() -> Coord {
        Coord { x: CENTER_COL, y: CENTER_ROW }
    }
    fn neighbor(self: Coord, direction: Direction) -> Coord {
        // https://www.redblobgames.com/grids/hexagons/#neighbors-offset
        // NOTE: NorthEast and SouthEast are swapped
        //      Also, NorthWest and SouthWest
        if self.y & 1 == 0 {
            // where self.y (row) is even
            match direction {
                Direction::East(()) => Coord { x: self.x + 1, y: self.y },
                Direction::NorthEast(()) => Coord { x: self.x + 1, y: self.y + 1 },
                Direction::NorthWest(()) => Coord { x: self.x, y: self.y + 1 },
                Direction::West(()) => Coord { x: self.x - 1, y: self.y },
                Direction::SouthWest(()) => Coord { x: self.x, y: self.y - 1 },
                Direction::SouthEast(()) => Coord { x: self.x + 1, y: self.y - 1 },
            }
        } else {
            // where self.y (row) is odd
            match direction {
                Direction::East(()) => Coord { x: self.x + 1, y: self.y },
                Direction::NorthEast(()) => Coord { x: self.x, y: self.y + 1 },
                Direction::NorthWest(()) => Coord { x: self.x - 1, y: self.y + 1 },
                Direction::West(()) => Coord { x: self.x - 1, y: self.y },
                Direction::SouthWest(()) => Coord { x: self.x - 1, y: self.y - 1 },
                Direction::SouthEast(()) => Coord { x: self.x, y: self.y - 1 },
            }
        }
    }

    fn neighbor_after_distance(self: Coord, direction: Direction, tile_distance: u32) -> Coord {
        let cube: Cube = self.into();
        let neighbor = cube.neighbor_after_distance(direction, tile_distance);
        neighbor.into()
    }

    fn ring(self: Coord, radius: u32) -> Array<Coord> {
        let cube: Cube = self.into();
        let cube_ring: Array<Cube> = cube.ring(radius.into());
        let mut coord_ring: Array<Coord> = array![];
        for cube in cube_ring {
            coord_ring.append(cube.into());
        }
        coord_ring
    }
}


pub impl CoordZeroable of Zero<Coord> {
    fn zero() -> Coord {
        Coord { x: 0, y: 0 }
    }

    fn is_zero(self: @Coord) -> bool {
        self.x == @0 && self.y == @0
    }

    fn is_non_zero(self: @Coord) -> bool {
        !self.is_zero()
    }
}


pub impl CubeIntoCoord of Into<Cube, Coord> {
    // function cube_to_evenr(hex):
    //     var col = hex.q + (hex.r + (hex.r&1)) / 2
    //     var row = hex.r
    //     return OffsetCoord(col, row)
    fn into(self: Cube) -> Coord {
        // https://www.redblobgames.com/grids/hexagons/#conversions-offset
        // convert cube to even-r coordinates
        let col: i128 = self.q + ((self.r + (self.r % 2)) / 2);
        let row: i128 = self.r;
        Coord { x: col.try_into().unwrap(), y: row.try_into().unwrap() }
    }
}

pub impl CoordIntoCube of Into<Coord, Cube> {
    // function evenr_to_cube(hex):
    //     var q = hex.col - (hex.row + (hex.row&1)) / 2
    //     var r = hex.row
    //     return Cube(q, r, -q-r)
    fn into(self: Coord) -> Cube {
        // https://www.redblobgames.com/grids/hexagons/#conversions-offset
        // convert even-r to cube coordinates
        let col: i128 = self.x.try_into().unwrap();
        let row: i128 = self.y.try_into().unwrap();
        let q = col - ((row + (self.y % 2).try_into().unwrap()) / 2);
        // (self.y % 2) and not (col % 2) because col is i128
        // and modulo for negative numbers is different if it
        // was col, it would be (col & 1) where `&` is bitwise AND
        let r = row;
        let s = -q - r;
        Cube { q, r, s }
    }
}


pub trait TravelTrait<T> {
    fn is_adjacent(self: T, destination: T) -> bool;
    fn tile_distance(self: T, destination: T) -> u128;
    fn km_distance(self: T, destination: T) -> u128;
    fn km_travel_time(self: T, destination: T, sec_per_km: u16) -> u64;
}

pub impl TravelImpl<T, +Into<T, Cube>, +Copy<T>, +Drop<T>> of TravelTrait<T> {
    fn is_adjacent(self: T, destination: T) -> bool {
        // todo: test
        let tile_distance = Self::tile_distance(self, destination);
        tile_distance == 1
    }

    fn tile_distance(self: T, destination: T) -> u128 {
        CubeImpl::distance(self.into(), destination.into())
    }

    fn km_distance(self: T, destination: T) -> u128 {
        CubeImpl::distance(self.into(), destination.into()) * HEX_DISTANCE_TO_KM
    }

    fn km_travel_time(self: T, destination: T, sec_per_km: u16) -> u64 {
        let distance = self.km_distance(destination);
        let time = distance * sec_per_km.into();
        time.try_into().unwrap()
    }
}
// #[cfg(test)]
// mod tests {
//     use debug::PrintTrait;
//     use s1_eternum::alias::ID;
//     use super::{Cube, CubeTrait, NumberTrait, Position, PositionTrait, TravelTrait};
//     use traits::Into;
//     use traits::TryInto;

//     #[test]
//     fn position_test_position_into_cube_0_0() {
//         let pos = Position { entity_id: 0, x: 0, y: 0 };

//         let cube: Cube = pos.into();
//         assert(cube.q == 0, 'incorrect cube.q');
//         assert(cube.r == 0, 'incorrect cube.r');
//         assert(cube.s == 0, 'incorrect cube.s');
//     }

//     #[test]
//     fn position_test_position_into_cube_1_2() {
//         let pos = Position { entity_id: 0, x: 1, y: 2 };

//         let cube: Cube = pos.into();
//         assert(cube.q == 0, 'incorrect cube.q');
//         assert(cube.r == 2, 'incorrect cube.r');
//         assert(cube.s == -2, 'incorrect cube.s');
//     }

//     #[test]
//     fn position_test_position_into_cube_2_1() {
//         let pos = Position { entity_id: 0, x: 2, y: 1 };

//         let cube: Cube = pos.into();
//         assert(cube.q == 2, 'incorrect cube.q');
//         assert(cube.r == 1, 'incorrect cube.r');
//         assert(cube.s == -3, 'incorrect cube.s');
//     }

//     #[test]
//     fn position_test_position_into_cube_2_2() {
//         let pos = Position { entity_id: 0, x: 2, y: 2 };

//         let cube: Cube = pos.into();
//         assert(cube.q == 1, 'incorrect cube.q');
//         assert(cube.r == 2, 'incorrect cube.r');
//         assert(cube.s == -3, 'incorrect cube.s');
//     }

//     #[test]
//     #[available_gas(30000000)]
//     fn position_test_calculate_distance() {
//         let start = Position { entity_id: 0, x: 2, y: 1 };
//         let end = Position { entity_id: 0, x: 1, y: 3 };
//         let distance = start.calculate_distance(end);

//         assert(distance == 2, 'wrong distance');
//     }

//     #[test]
//     #[available_gas(30000000)]
//     fn position_test_calculate_distance_large_values() {
//         let start = Position { entity_id: 0, x: 432788918, y: 999990130 };
//         let end = Position { entity_id: 0, x: 81839812, y: 318939024 };
//         let distance = start.calculate_distance(end);

//         assert(distance == 691474659, 'wrong distance');
//     }

//     #[test]
//     #[available_gas(30000000)]
//     fn position_test_calculate_travel_time() {
//         let start = Position { entity_id: 0, x: 432788918, y: 999990130 };
//         let end = Position { entity_id: 0, x: 81839812, y: 318939024 };

//         // 720 sec per km = 5 kmh
//         let time = start.calculate_travel_time(end, 720);
//         assert(time == 497861754480, 'time should be 57600');
//     }

//     // #[test]
//     // fn position_test_get_zone() {
//     //     let a = Position { entity_id: 0, x: 1333333, y: 200000 };
//     //     let zone = a.get_zone();
//     //     assert(zone == 4, 'zone should be 4');
//     // }

//     mod coord {
//         use super::super::{Coord, CoordTrait, Direction};

//         fn odd_row_coord() -> Coord {
//             Coord { x: 7, y: 7 }
//         }

//         fn even_row_coord() -> Coord {
//             Coord { x: 7, y: 6 }
//         }

//         //- Even row

//         #[test]
//         fn position_test_neighbor_even_row_east() {
//             let start = even_row_coord();

//             assert_eq!(start.neighbor(Direction::East), Coord { x: start.x + 1, y: start.y });
//         }

//         #[test]
//         fn position_test_neighbor_even_row_north_east() {
//             let start = even_row_coord();

//             assert_eq!(start.neighbor(Direction::NorthEast), Coord { x: start.x + 1, y: start.y + 1 });
//         }

//         #[test]
//         fn position_test_neighbor_even_row_north_west() {
//             let start = even_row_coord();

//             assert_eq!(start.neighbor(Direction::NorthWest), Coord { x: start.x, y: start.y + 1 });
//         }

//         #[test]
//         fn position_test_neighbor_even_row_west() {
//             let start = even_row_coord();

//             assert_eq!(start.neighbor(Direction::West), Coord { x: start.x - 1, y: start.y });
//         }

//         #[test]
//         fn position_test_neighbor_even_row_south_west() {
//             let start = even_row_coord();

//             assert_eq!(start.neighbor(Direction::SouthWest), Coord { x: start.x, y: start.y - 1 });
//         }

//         #[test]
//         fn position_test_neighbor_even_row_south_east() {
//             let start = even_row_coord();

//             assert_eq!(start.neighbor(Direction::SouthEast), Coord { x: start.x + 1, y: start.y - 1 });
//         }

//         //- Odd row

//         #[test]
//         fn position_test_neighbor_odd_row_east() {
//             let start = odd_row_coord();

//             assert_eq!(start.neighbor(Direction::East), Coord { x: start.x + 1, y: start.y });
//         }

//         #[test]
//         fn position_test_neighbor_odd_row_north_east() {
//             let start = odd_row_coord();

//             assert_eq!(start.neighbor(Direction::NorthEast), Coord { x: start.x, y: start.y + 1 });
//         }

//         #[test]
//         fn position_test_neighbor_odd_row_north_west() {
//             let start = odd_row_coord();

//             assert_eq!(start.neighbor(Direction::NorthWest), Coord { x: start.x - 1, y: start.y + 1 });
//         }

//         #[test]
//         fn position_test_neighbor_odd_row_west() {
//             let start = odd_row_coord();

//             assert_eq!(start.neighbor(Direction::West), Coord { x: start.x - 1, y: start.y });
//         }

//         #[test]
//         fn position_test_neighbor_odd_row_south_west() {
//             let start = odd_row_coord();

//             assert_eq!(start.neighbor(Direction::SouthWest), Coord { x: start.x - 1, y: start.y - 1 });
//         }

//         #[test]
//         fn position_test_neighbor_odd_row_south_east() {
//             let start = odd_row_coord();

//             assert_eq!(start.neighbor(Direction::SouthEast), Coord { x: start.x, y: start.y - 1 });
//         }
//     }
// }


