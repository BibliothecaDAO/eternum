pub use world_test_support::tests::relics::*;

#[test]
fn pinned_draw_vectors_keep_the_crafting_weights_and_direction_retry_order() {
    assert_eq!(crate::relics::draw_relic(rules(), 12345), 39);
    assert_eq!(
        crate::relics::chest_destination(Coord { alt: false, x: 2000200, y: 2000200 }, 321, 12),
        Coord { alt: false, x: 2000199, y: 2000186 },
    );
}

#[test]
fn every_pack_and_its_lucky_roll_is_reachable_by_seed() {
    let cases = array![
        (4_u256, RelicPack::War, false, array![41_u8, 43, 39]), (1, RelicPack::War, true, array![42, 44, 40]),
        (2, RelicPack::Explore, false, array![45, 47, 39]), (30, RelicPack::Explore, true, array![46, 48, 40]),
        (3, RelicPack::Produce, false, array![51, 53, 55]), (16, RelicPack::Produce, true, array![52, 54, 56]),
        (10, RelicPack::Fortress, false, array![49, 43, 55]), (12, RelicPack::Fortress, true, array![50, 44, 56]),
    ];
    for (seed, pack, lucky, relics) in cases {
        let chest = crate::relics::draw_chest(seed);
        assert_eq!(chest, RelicChest { pack, lucky });
        assert_eq!(crate::relics::pack_relics(chest), relics.span());
    }
}

#[test]
fn packs_follow_their_odds_and_one_chest_in_five_is_lucky() {
    let (mut war, mut explore, mut produce, mut fortress, mut lucky) = (0_u32, 0_u32, 0_u32, 0_u32, 0_u32);
    for sample in 0_u64..10000 {
        let chest = crate::relics::draw_chest(0x5041434b + sample.into());
        match chest.pack {
            RelicPack::War => war += 1,
            RelicPack::Explore => explore += 1,
            RelicPack::Produce => produce += 1,
            RelicPack::Fortress => fortress += 1,
        }
        if chest.lucky {
            lucky += 1;
        }
    }
    // Each count sits within three standard deviations (at most 46) of its expectation.
    assert!(war >= 2860 && war <= 3140 && explore >= 2860 && explore <= 3140, "War or Explore off 30 percent");
    assert!(produce >= 2370 && produce <= 2630 && fortress >= 1390 && fortress <= 1610, "Produce or Fortress off");
    assert!(lucky >= 1880 && lucky <= 2120, "lucky chests off 20 percent");
    println!("10000 chests: War {} Explore {} Produce {} Fortress {} lucky {}", war, explore, produce, fortress, lucky);
}

