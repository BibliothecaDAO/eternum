pub use world_test_support::tests::frontier_combat_vectors::*;


#[test]
fn frontier_combat_matches_two_hundred_shared_exchanges() {
    check_vectors(false);
}

// Run explicitly on the box; the recording script merges these contract results into the shared input file.
#[test]
#[ignore]
fn record_frontier_combat_exchanges() {
    check_vectors(true);
}
