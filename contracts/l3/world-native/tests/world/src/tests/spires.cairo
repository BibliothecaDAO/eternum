pub use world_test_support::tests::spires::*;


#[test]
fn audit_regression_neighbors_are_adjacent_on_both_layers_and_row_parities() {
    for alt in array![false, true] {
        for y in array![2000000_u32, 2000001] {
            let origin = Coord { alt, x: 2000000, y };
            for direction in 0_u8..6 {
                let next = neighbor(origin, direction);
                assert!(crate::geometry::adjacent(origin, next));
                assert_eq!(neighbor(next, (direction + 3) % 6), origin);
                assert_eq!(next, crate::geometry::neighbor_at_distance(origin, direction, 1));
            }
        }
    }
}
