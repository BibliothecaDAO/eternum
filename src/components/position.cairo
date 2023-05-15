#[derive(Component)]
struct Position {
    x: u32,
    y: u32
}

impl PositionPartialEq of PartialEq<Position> {
    #[inline(always)]
    fn eq(lhs: Position, rhs: Position) -> bool {
        lhs.x == rhs.x & lhs.y == rhs.y
    }
    #[inline(always)]
    fn ne(lhs: Position, rhs: Position) -> bool {
        !(lhs.x == rhs.x & lhs.y == rhs.y)
    }
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