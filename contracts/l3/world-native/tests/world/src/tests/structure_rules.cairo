pub use world_test_support::tests::structure_rules::*;


#[test]
fn level_up_rejects_unowned_missing_wrong_category_unfunded_and_maximum_structures() {
    let (d, home, _) = super::resource_commands::setup();
    let at = super::play_fixture::FIXTURE_START + 60;
    let original = record(d, home);
    assert_terminal_rejection(d, Command::LevelUp(999), at);
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), at);
    assert_eq!(record(d, home), original);
    for cost in crate::logic::upgrades::recipe(1).costs {
        grant(d, home, *cost.resource_type, *cost.amount);
    }
    save(d, home, StructureRecord { owner: 999.try_into().unwrap(), ..original });
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), at);
    save(
        d,
        home,
        StructureRecord { base: crate::structures::StructureBase { category: 4, ..original.base }, ..original },
    );
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), at);
    save(d, home, original);
    let map = IMapLogicDispatcher { contract_address: d.games };
    let location = crate::geometry::tile_key(
        3, IStructureOperationsDispatcher { contract_address: d.games }.position(home).unwrap(),
    );
    let tile = map.tile(location).unwrap();
    let storage_key = array![3, location.alt.into(), location.col.into(), location.row.into()].span();
    let occupancy = crate::map::occupancy_bits(map.occupancy(location).unwrap());
    set_fixture(d.games, selector!("map"), selector!("occupancy"), storage_key, occupancy + 512);
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), at);
    assert_eq!(record(d, home), original);
    assert_eq!(map.tile(location).unwrap().data, tile.data);
    set_fixture(d.games, selector!("map"), selector!("occupancy"), storage_key, occupancy);
    assert!(execute(d, Command::LevelUp(home.entity_id), at));
    assert_eq!(record(d, home).base.level, 1);
    assert_eq!(map.tile(location).unwrap().data, tile.data);
    let highest = crate::balance::structures::REALM_UPGRADE_MAX;
    let levelled = record(d, home);
    save(
        d,
        home,
        StructureRecord { base: crate::structures::StructureBase { level: highest, ..levelled.base }, ..levelled },
    );
    let mut rejection_spy = snforge_std::spy_events();
    assert_terminal_rejection(d, Command::LevelUp(home.entity_id), at);
    assert_eq!(record(d, home).base.level, highest);
    let outcome = super::play_fixture::rejection(ref rejection_spy, d.games);
    assert_eq!(outcome.status_class, 'GAMEPLAY_REJECTED');
    // This nested library assertion is longer than a felt short string.
    assert_eq!(outcome.reason, "structure is already at max level");
}
