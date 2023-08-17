use traits::Into;
use traits::TryInto;
use option::OptionTrait;

use alexandria_math::math::pow;


#[derive(Component, PartialEq, Copy, Drop, Serde, SerdeLen)]
struct Position {
    #[key]
    entity_id: u128,
    x: u32,
    y: u32
}

// impl PositionPartialEq of PartialEq<Position> {
//     #[inline(always)]
//     fn eq(lhs: Position, rhs: Position) -> bool {
//         lhs.x == rhs.x & lhs.y == rhs.y
//     }
//     #[inline(always)]
//     fn ne(lhs: Position, rhs: Position) -> bool {
//         !(lhs.x == rhs.x & lhs.y == rhs.y)
//     }
// }
trait PositionTrait {
    fn calculate_distance(self: Position, destination: Position) -> u32;
    fn calculate_travel_time(self: Position, destination: Position, sec_per_km: u16) -> u64;
}
impl PositionImpl of PositionTrait {
    fn calculate_distance(self: Position, destination: Position) -> u32 {
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
    fn calculate_travel_time(self: Position, destination: Position, sec_per_km: u16) -> u64 {
        let distance: u32 = self.calculate_distance(destination);
        let time = distance * sec_per_km.into();
        time.into()
    }
}

#[test]
#[available_gas(30000000)]
fn test_calculate_distance() {
    let a = Position { x: 100000, y: 200000 };
    let b = Position { x: 200000, y: 1000000 };
    let distance = a.calculate_distance(b);
    assert(distance == 80, 'distance should be 1');
}

#[test]
#[available_gas(30000000)]
fn test_calculate_travel_time() {
    let a = Position { x: 100000, y: 200000 };
    let b = Position { x: 200000, y: 1000000 };
    // 720 sec per km = 5 kmh
    let time = a.calculate_travel_time(b, 720);
    assert(time == 57600, 'time should be 57600');
}

#[test]
fn test_position_equal() {
    let a = Position { x: 1, y: 2 };
    let b = Position { x: 1, y: 2 };
    assert(a == b, 'a should equal b');
}
#[test]
fn test_position_non_equal() {
    let a = Position { x: 1, y: 2 };
    let b = Position { x: 2, y: 1 };
    assert(a != b, 'a should not equal b');
}

