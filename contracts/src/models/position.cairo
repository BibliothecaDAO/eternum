use traits::Into;
use traits::TryInto;
use option::OptionTrait;
use debug::PrintTrait;

use alexandria_math::math::pow;

// highest x = 1320937 + 1800000 = 3120937
const HIGHEST_X: u32 = 3120937;
// lowest x = -1329800 + 1800000 = 470200
const LOWEST_X: u32 = 470200;
// highest y = 612800 + 1800000 = 2412800
const HIGHEST_Y: u32 = 2412800;
// lowest y = -618996 + 1800000 = 1181004
const LOWEST_Y: u32 = 1181004;

#[derive(Copy, Drop, PartialEq, Serde, Print, Introspect)]
struct Coord {
    x: u32,
    y: u32
}

#[generate_trait]
impl CoordImpl of CoordTrait {

    fn calculate_distance(self: Coord, destination: Coord) -> u32 {
        // d = √((x2-x1)² + (y2-y1)²)
        let x: u128 = if self.x > destination.x {
            pow((self.x - destination.x).into(), 2)
        } else {
            pow((destination.x - self.x).into(), 2)
        };
        let y: u128 = if self.y > destination.y {
            pow((self.y - destination.y).into(), 2)
        } else {
            pow((destination.y - self.y).into(), 2)
        };

        // we store coords in x * 10000 to get precise distance
        let distance = u128_sqrt(x + y) / 10000;

        distance.try_into().unwrap()
    }


    fn calculate_travel_time(self: Coord, destination: Coord, sec_per_km: u16) -> u64 {
        let distance: u32 = self.calculate_distance(destination);
        let time = distance * sec_per_km.into();
        time.into()
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

impl PositionIntoCoord of Into<Position, Coord> {
    fn into(self: Position) -> Coord {
        return Coord {
            x: self.x,
            y: self.y
        };
    }
}


#[derive(Model, PartialEq, Copy, Drop, Serde)]
struct Position {
    #[key]
    entity_id: u128,
    x: u32,
    y: u32
}

#[generate_trait]
impl PositionImpl of PositionTrait {
    fn calculate_distance(self: Position, destination: Position) -> u32 {
       CoordImpl::calculate_distance(self.into(), destination.into())
    }
    fn calculate_travel_time(self: Position, destination: Position, sec_per_km: u16) -> u64 {
        CoordImpl::calculate_travel_time(self.into(), destination.into(), sec_per_km)
    }
    // world is divided into 10 timezones
    fn get_zone(self: Position) -> u32 {
        // use highest and lowest x to divide map into 10 timezones
        1 + (self.x - LOWEST_X) * 10 / (HIGHEST_X - LOWEST_X)
    }
}

#[cfg(test)]
mod tests {
    use super::{Position, PositionTrait};

    #[test]
    #[available_gas(30000000)]
    fn test_calculate_distance() {
        let a = Position { entity_id: 0, x: 100000, y: 200000 };
        let b = Position { entity_id: 0, x: 200000, y: 1000000 };
        let distance = a.calculate_distance(b);
        assert(distance == 80, 'distance should be 1');
    }

    #[test]
    #[available_gas(30000000)]
    fn test_calculate_travel_time() {
        let a = Position { entity_id: 0, x: 100000, y: 200000 };
        let b = Position { entity_id: 0, x: 200000, y: 1000000 };
        // 720 sec per km = 5 kmh
        let time = a.calculate_travel_time(b, 720);
        assert(time == 57600, 'time should be 57600');
    }

    #[test]
    fn test_position_equal() {
        let a = Position { entity_id: 0, x: 1, y: 2 };
        let b = Position { entity_id: 0, x: 1, y: 2 };
        assert(a == b, 'a should equal b');
    }
    #[test]
    fn test_position_non_equal() {
        let a = Position { entity_id: 0, x: 1, y: 2 };
        let b = Position { entity_id: 0, x: 2, y: 1 };
        assert(a != b, 'a should not equal b');
    }

    #[test]
    fn test_get_zone() { 
        let a = Position { entity_id: 0, x: 1333333, y: 200000 };
        let zone = a.get_zone();
        assert(zone == 4, 'zone should be 4');
    }
}