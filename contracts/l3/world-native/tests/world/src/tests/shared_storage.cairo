pub use world_test_support::tests::shared_storage::*;


#[test]
fn shared_storage_reads_the_same_game_tile_across_classes() {
    let layout = declare("TileLayoutFixture").unwrap().contract_class();
    let (contract_address, _) = layout.deploy(@array![]).unwrap();
    let fixture = ITileLayoutDispatcher { contract_address };
    let map_class = *declare("GamesTest").unwrap().contract_class().class_hash;
    let key = TileKey { game_id: 7, alt: true, col: 123, row: 456 };
    let value = 11 * crate::map::BIOME_SCALE + crate::map::REWARD_EXTRACTED_FLAG;

    fixture.write(key, value);

    assert_eq!(fixture.read(key), value);
    assert_eq!(
        fixture.read_with_class(map_class, key), Some(TileOpt { data: value + crate::map::coordinate_bits(key) }),
    );
    assert_eq!(fixture.read_with_class(map_class, TileKey { game_id: 8, ..key }), None);
}
