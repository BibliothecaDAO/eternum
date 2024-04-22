use debug::PrintTrait;

use eternum::utils::number::{NumberTrait, i128Div};
use option::OptionTrait;
use traits::Into;
use traits::TryInto;

// todo@credence revisit zone calculation

// start col and row for eternum = 2147483647
// nb of cols = 500
const HIGHEST_COL: u128 = 2147484147;
const LOWEST_COL: u128 = 2147483647;
// nb of rows = 300
const HIGHEST_ROW: u128 = 2147483947;
const LOWEST_ROW: u128 = 2147483647;


// multiplier to convert hex distance to km
const HEX_DISTANCE_TO_KM: u128 = 1;


// https://www.redblobgames.com/grids/hexagons/#coordinates-cube

#[derive(Copy, Drop, PartialEq, Serde)]
struct Cube {
    q: i128,
    r: i128,
    s: i128
}

impl CubeZeroable of Zeroable<Cube> {
    fn zero() -> Cube {
        Cube { q: 0, r: 0, s: 0 }
    }
    #[inline(always)]
    fn is_zero(self: Cube) -> bool {
        self.q == 0 && self.r == 0 && self.s == 0
    }

    #[inline(always)]
    fn is_non_zero(self: Cube) -> bool {
        !self.is_zero()
    }
}

#[generate_trait]
impl CubeImpl of CubeTrait {
    fn subtract(self: Cube, other: Cube) -> Cube {
        Cube { q: self.q - other.q, r: self.r - other.r, s: self.s - other.s }
    }

    fn abs(self: Cube) -> Cube {
        Cube { q: self.q.abs(), r: self.r.abs(), s: self.s.abs() }
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

        max.try_into().unwrap() * HEX_DISTANCE_TO_KM
    }

    fn travel_time(self: Cube, other: Cube, sec_per_km: u16) -> u64 {
        let distance = self.distance(other);
        let time = distance * sec_per_km.into();
        time.try_into().unwrap()
    }
}

#[derive(Drop, Copy, Serde)]
enum Direction {
    East: (),
    NorthEast: (),
    NorthWest: (),
    West: (),
    SouthWest: (),
    SouthEast: (),
}

#[derive(Copy, Drop, PartialEq, Serde, Print, Introspect, Debug)]
struct Coord {
    x: u128,
    y: u128
}

#[generate_trait]
impl CoordImpl of CoordTrait {
    fn neighbor(self: Coord, direction: Direction) -> Coord {
        // https://www.redblobgames.com/grids/hexagons/#neighbors-offset

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
}


impl CoordZeroable of Zeroable<Coord> {
    fn zero() -> Coord {
        Coord { x: 0, y: 0 }
    }
    #[inline(always)]
    fn is_zero(self: Coord) -> bool {
        self.x == 0 && self.y == 0
    }

    #[inline(always)]
    fn is_non_zero(self: Coord) -> bool {
        !self.is_zero()
    }
}


impl CoordIntoCube of Into<Coord, Cube> {
    fn into(self: Coord) -> Cube {
        // https://www.redblobgames.com/grids/hexagons/#conversions-offset
        // convert odd-r to cube coordinates
        let col: i128 = self.x.try_into().unwrap();
        let row: i128 = self.y.try_into().unwrap();
        let q = col - ((row - (self.y % 2).try_into().unwrap()) / 2);
        // (self.y % 2) and not (col % 2) because col is i128 
        // and modulo for negative numbers is different if it
        // was col, it would be (col & 1) where `&` is bitwise AND
        let r = row;
        let s = -q - r;
        Cube { q, r, s }
    }
}

trait TravelTrait<T> {
    fn calculate_distance(self: T, destination: T) -> u128;
    fn calculate_travel_time(self: T, destination: T, sec_per_km: u16) -> u64;
}

impl TravelImpl<T, +Into<T, Cube>, +Copy<T>, +Drop<T>> of TravelTrait<T> {
    fn calculate_distance(self: T, destination: T) -> u128 {
        CubeImpl::distance(self.into(), destination.into())
    }

    fn calculate_travel_time(self: T, destination: T, sec_per_km: u16) -> u64 {
        CubeImpl::travel_time(self.into(), destination.into(), sec_per_km)
    }
}


#[derive(Model, PartialEq, Copy, Drop, Serde, PrintTrait, Default)]
struct Position {
    #[key]
    entity_id: u128,
    x: u128,
    y: u128,
}


impl PositionIntoCoord of Into<Position, Coord> {
    fn into(self: Position) -> Coord {
        Coord { x: self.x, y: self.y }
    }
}


impl PositionIntoCube of Into<Position, Cube> {
    fn into(self: Position) -> Cube {
        Into::<Coord, Cube>::into(Into::<Position, Coord>::into(self))
    }
}


#[generate_trait]
impl PositionImpl of PositionTrait {
    // world is divided into 10 timezones
    fn get_zone(self: Position) -> u128 {
        // use highest and lowest x to divide map into 10 timezones
        1 + (self.x - LOWEST_COL) * 10 / (HIGHEST_COL - LOWEST_COL)
    }
    fn assert_same_location(self: Position, other: Coord) {
        assert(self.x == other.x && self.y == other.y, 'Coord: not same');
    }
    fn assert_not_same_location(self: Position, other: Coord) {
        assert(self.x != other.x || self.y != other.y, 'Coord: same');
    }
}

#[cfg(test)]
mod tests {
    use debug::PrintTrait;
    use super::{Position, PositionTrait, Cube, CubeTrait, NumberTrait, TravelTrait};
    use traits::Into;
    use traits::TryInto;

    #[test]
    fn test_position_into_cube_0_0() {
        let pos = Position { entity_id: 0, x: 0, y: 0 };

        let cube: Cube = pos.into();
        assert(cube.q == 0, 'incorrect cube.q');
        assert(cube.r == 0, 'incorrect cube.r');
        assert(cube.s == 0, 'incorrect cube.s');
    }

    #[test]
    fn test_position_into_cube_1_2() {
        let pos = Position { entity_id: 0, x: 1, y: 2 };

        let cube: Cube = pos.into();
        assert(cube.q == 0, 'incorrect cube.q');
        assert(cube.r == 2, 'incorrect cube.r');
        assert(cube.s == -2, 'incorrect cube.s');
    }


    #[test]
    fn test_position_into_cube_2_1() {
        let pos = Position { entity_id: 0, x: 2, y: 1 };

        let cube: Cube = pos.into();
        assert(cube.q == 2, 'incorrect cube.q');
        assert(cube.r == 1, 'incorrect cube.r');
        assert(cube.s == -3, 'incorrect cube.s');
    }


    #[test]
    fn test_position_into_cube_2_2() {
        let pos = Position { entity_id: 0, x: 2, y: 2 };

        let cube: Cube = pos.into();
        assert(cube.q == 1, 'incorrect cube.q');
        assert(cube.r == 2, 'incorrect cube.r');
        assert(cube.s == -3, 'incorrect cube.s');
    }


    #[test]
    #[available_gas(30000000)]
    fn test_calculate_distance() {
        let start = Position { entity_id: 0, x: 2, y: 1 };
        let end = Position { entity_id: 0, x: 1, y: 3 };
        let distance = start.calculate_distance(end);

        assert(distance == 2, 'wrong distance');
    }


    #[test]
    #[available_gas(30000000)]
    fn test_calculate_distance_large_values() {
        let start = Position { entity_id: 0, x: 432788918, y: 999990130 };
        let end = Position { entity_id: 0, x: 81839812, y: 318939024 };
        let distance = start.calculate_distance(end);

        assert(distance == 691474659, 'wrong distance');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_calculate_travel_time() {
        let start = Position { entity_id: 0, x: 432788918, y: 999990130 };
        let end = Position { entity_id: 0, x: 81839812, y: 318939024 };

        // 720 sec per km = 5 kmh
        let time = start.calculate_travel_time(end, 720);
        assert(time == 497861754480, 'time should be 57600');
    }


    // #[test]
    // fn test_get_zone() { 
    //     let a = Position { entity_id: 0, x: 1333333, y: 200000 };
    //     let zone = a.get_zone();
    //     assert(zone == 4, 'zone should be 4');
    // }

    mod coord {
        use super::super::{Coord, CoordTrait, Direction};


        fn odd_row_coord() -> Coord {
            Coord { x: 7, y: 7 }
        }

        fn even_row_coord() -> Coord {
            Coord { x: 7, y: 6 }
        }


        //- Even row 

        #[test]
        fn test_neighbor_even_row_east() {
            let start = even_row_coord();

            assert_eq!(start.neighbor(Direction::East), Coord { x: start.x + 1, y: start.y });
        }

        #[test]
        fn test_neighbor_even_row_north_east() {
            let start = even_row_coord();

            assert_eq!(
                start.neighbor(Direction::NorthEast), Coord { x: start.x + 1, y: start.y + 1 }
            );
        }

        #[test]
        fn test_neighbor_even_row_north_west() {
            let start = even_row_coord();

            assert_eq!(start.neighbor(Direction::NorthWest), Coord { x: start.x, y: start.y + 1 });
        }

        #[test]
        fn test_neighbor_even_row_west() {
            let start = even_row_coord();

            assert_eq!(start.neighbor(Direction::West), Coord { x: start.x - 1, y: start.y });
        }


        #[test]
        fn test_neighbor_even_row_south_west() {
            let start = even_row_coord();

            assert_eq!(start.neighbor(Direction::SouthWest), Coord { x: start.x, y: start.y - 1 });
        }


        #[test]
        fn test_neighbor_even_row_south_east() {
            let start = even_row_coord();

            assert_eq!(
                start.neighbor(Direction::SouthEast), Coord { x: start.x + 1, y: start.y - 1 }
            );
        }


        //- Odd row 

        #[test]
        fn test_neighbor_odd_row_east() {
            let start = odd_row_coord();

            assert_eq!(start.neighbor(Direction::East), Coord { x: start.x + 1, y: start.y });
        }

        #[test]
        fn test_neighbor_odd_row_north_east() {
            let start = odd_row_coord();

            assert_eq!(start.neighbor(Direction::NorthEast), Coord { x: start.x, y: start.y + 1 });
        }

        #[test]
        fn test_neighbor_odd_row_north_west() {
            let start = odd_row_coord();

            assert_eq!(
                start.neighbor(Direction::NorthWest), Coord { x: start.x - 1, y: start.y + 1 }
            );
        }

        #[test]
        fn test_neighbor_odd_row_west() {
            let start = odd_row_coord();

            assert_eq!(start.neighbor(Direction::West), Coord { x: start.x - 1, y: start.y });
        }


        #[test]
        fn test_neighbor_odd_row_south_west() {
            let start = odd_row_coord();

            assert_eq!(
                start.neighbor(Direction::SouthWest), Coord { x: start.x - 1, y: start.y - 1 }
            );
        }


        #[test]
        fn test_neighbor_odd_row_south_east() {
            let start = odd_row_coord();

            assert_eq!(start.neighbor(Direction::SouthEast), Coord { x: start.x, y: start.y - 1 });
        }
    }
}

