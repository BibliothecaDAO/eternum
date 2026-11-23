pub use world_test_support::tests::frontier_guards::*;


#[test]
fn seeded_site_guards_keep_their_family_mark_on_the_inclusive_preset_grid() {
    let rules = release_rules();
    let camps = array![(1170_u32, 1430_u32), (2340, 2860), (4680, 5720)];
    let rifts = array![(1350_u32, 1650_u32), (2700, 3300), (5400, 6600)];
    for depth_index in 0_u32..3 {
        let depth = crate::logic::expeditions::depth_rules(depth_index.try_into().unwrap());
        for category in array![crate::taxonomy::CAMP_CATEGORY, RIFT_CATEGORY] {
            let (lower, upper) = if category == RIFT_CATEGORY {
                *rifts.at(depth_index)
            } else {
                *camps.at(depth_index)
            };
            let mut saw_lower = false;
            let mut saw_upper = false;
            for seed in 0_u32..10000 {
                let guard = frontier_guard(category, depth, seed.into(), rules, 360);
                let count = guard.count / RESOURCE_PRECISION;
                assert_eq!(guard.count % RESOURCE_PRECISION, 0);
                assert!(count >= lower.into() && count <= upper.into(), "guard outside inclusive bounds");
                assert_eq!((count - Into::<u32, u128>::into(lower)) % depth.guard_step.into(), 0);
                saw_lower = saw_lower || count == lower.into();
                saw_upper = saw_upper || count == upper.into();
                assert_eq!(guard.tier, TroopTier::T1);
                assert_eq!(
                    guard.category, if category == RIFT_CATEGORY {
                        TroopType::Crossbowman
                    } else {
                        TroopType::Knight
                    },
                );
            }
            assert!(saw_lower && saw_upper, "inclusive endpoint never drawn");
        }
    }
}

#[test]
fn beasts_draw_two_depth_scaled_ranges_below_every_other_site_guard() {
    let rules = release_rules();
    let expected = array![(315_u128, 385_u128, 405_u128, 495_u128), (630, 770, 810, 990), (1260, 1540, 1620, 1980)];
    let mut previous_stronger = 0;
    for depth_index in 0_u32..3 {
        let depth = crate::logic::expeditions::depth_rules(depth_index.try_into().unwrap());
        let (weak_lower, weak_upper, strong_lower, strong_upper) = *expected.at(depth_index);
        assert!(weak_lower > previous_stronger && strong_lower > weak_upper);
        assert!(strong_upper < depth.site_guard_lower.into());
        assert_eq!((depth.beast_weak_lower.into(), depth.beast_weak_upper.into()), (weak_lower, weak_upper));
        assert_eq!((depth.beast_strong_lower.into(), depth.beast_strong_upper.into()), (strong_lower, strong_upper));
        let mut weak_draws = 0_u32;
        let mut strong_draws = 0_u32;
        let mut weak_min = weak_upper;
        let mut weak_max = weak_lower;
        let mut strong_min = strong_upper;
        let mut strong_max = strong_lower;
        for seed in 0_u32..2000 {
            let guard = frontier_guard(BEASTS_CATEGORY, depth, seed.into(), rules, 360);
            assert_eq!(
                guard.category,
                if guard.count / RESOURCE_PRECISION <= weak_upper {
                    TroopType::Knight
                } else {
                    TroopType::Crossbowman
                },
            );
            assert_eq!(guard.tier, TroopTier::T1);
            assert_eq!(guard.count % RESOURCE_PRECISION, 0);
            let count = guard.count / RESOURCE_PRECISION;
            if count <= weak_upper {
                assert!(count >= weak_lower);
                weak_draws += 1;
                weak_min = core::cmp::min(weak_min, count);
                weak_max = core::cmp::max(weak_max, count);
            } else {
                assert!(count >= strong_lower && count <= strong_upper);
                strong_draws += 1;
                strong_min = core::cmp::min(strong_min, count);
                strong_max = core::cmp::max(strong_max, count);
            }
        }
        assert!(weak_draws >= 600 && weak_draws <= 733, "weak beast odds drift");
        assert!(strong_draws >= 1267 && strong_draws <= 1400, "stronger beast odds drift");
        assert!(weak_min < weak_max && strong_min < strong_max, "beast count did not vary");
        if depth_index < 2 {
            assert_eq!((weak_min, weak_max), (weak_lower, weak_upper));
            assert_eq!((strong_min, strong_max), (strong_lower, strong_upper));
        }
        previous_stronger = strong_upper;
    }
}

#[test]
fn ruin_guards_follow_their_relics_place_on_the_layer_doubled_each_layer_down() {
    let rules = release_rules();
    for (depth, rank, base) in array![
        (0_u8, 1_u8, 1000_u128), (0, 2, 1500), (0, 3, 2500), (1, 2, 2000), (1, 3, 3000), (1, 4, 5000), (2, 3, 4000),
        (2, 4, 6000), (2, 5, 10000),
    ] {
        let lower = base - base / 10;
        let upper = base + base / 10;
        let mut saw_lower = false;
        let mut saw_upper = false;
        for seed in 0_u32..1000 {
            let guard = crate::troops::ruin_guard(
                crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::Blade, rank },
                depth,
                seed.into(),
                rules,
                360,
            );
            let count = guard.count / RESOURCE_PRECISION;
            assert!(count >= lower && count <= upper);
            assert_eq!((count - lower) % 50, 0);
            assert_eq!(guard.category, TroopType::Knight);
            assert_eq!(guard.tier, TroopTier::T1);
            saw_lower = saw_lower || count == lower;
            saw_upper = saw_upper || count == upper;
        }
        assert!(saw_lower && saw_upper);
    }
}

#[test]
#[should_panic(expected: "relic outside its layer")]
fn a_ruin_refuses_a_relic_below_its_layer() {
    crate::army_relics::ruin_strength(1, 1);
}

#[test]
#[should_panic(expected: "relic outside its layer")]
fn a_ruin_refuses_a_relic_above_its_layer() {
    crate::army_relics::ruin_strength(4, 0);
}

fn release_rules() -> crate::rules::SliceRules {
    crate::game::IGameDispatcherTrait::rules(
        crate::game::IGameDispatcher { contract_address: super::setup(true).games }, 1,
    )
}
