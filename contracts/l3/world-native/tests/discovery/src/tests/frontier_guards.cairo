pub use world_test_support::tests::frontier_guards::*;


#[test]
fn seeded_beasts_are_knights_on_the_inclusive_preset_grid() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    for depth_index in 0_u32..4 {
        let depth = *preset.settlement.depths.at(depth_index);
        for category in array![crate::taxonomy::CAMP_CATEGORY, RIFT_CATEGORY, RUIN_CATEGORY] {
            let ruin = category == RUIN_CATEGORY;
            let (lower, upper) = if ruin {
                (depth.ruin_guard_lower, depth.ruin_guard_upper)
            } else {
                (depth.site_guard_lower.into(), depth.site_guard_upper.into())
            };
            let mut saw_lower = false;
            let mut saw_upper = false;
            for seed in 0_u32..10000 {
                let guard = frontier_guard(category, depth, seed.into(), preset.rules, 360);
                let count = guard.count / RESOURCE_PRECISION;
                assert_eq!(guard.count % RESOURCE_PRECISION, 0);
                assert!(count >= lower.into() && count <= upper.into(), "guard outside inclusive bounds");
                assert_eq!((count - Into::<u32, u128>::into(lower)) % depth.guard_step.into(), 0);
                saw_lower = saw_lower || count == lower.into();
                saw_upper = saw_upper || count == upper.into();
                // One troop type: every guard is T1 and its strength is its count.
                assert_eq!(guard.tier, TroopTier::T1);
                assert_eq!(guard.category, TroopType::Knight);
            }
            assert!(saw_lower && saw_upper, "inclusive endpoint never drawn");
        }
    }
}

#[test]
fn beasts_draw_two_depth_scaled_ranges_below_every_other_site_guard() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let expected = array![
        (300_u128, 350_u128, 450_u128, 550_u128), (900, 1050, 1350, 1650), (2400, 2800, 3600, 4400),
        (6000, 7000, 9000, 11000),
    ];
    let mut previous_stronger = 0;
    for depth_index in 0_u32..4 {
        let depth = *preset.settlement.depths.at(depth_index);
        let (weak_lower, weak_upper, strong_lower, strong_upper) = *expected.at(depth_index);
        assert!(weak_lower > previous_stronger && strong_lower > weak_upper);
        assert!(strong_upper < depth.site_guard_lower.into());
        assert!(strong_upper < depth.ruin_guard_lower.into());
        assert_eq!((depth.beast_weak_lower.into(), depth.beast_weak_upper.into()), (weak_lower, weak_upper));
        assert_eq!((depth.beast_strong_lower.into(), depth.beast_strong_upper.into()), (strong_lower, strong_upper));
        let mut weak_draws = 0_u32;
        let mut strong_draws = 0_u32;
        let mut weak_min = weak_upper;
        let mut weak_max = weak_lower;
        let mut strong_min = strong_upper;
        let mut strong_max = strong_lower;
        for seed in 0_u32..2000 {
            let guard = frontier_guard(BEASTS_CATEGORY, depth, seed.into(), preset.rules, 360);
            assert_eq!(guard.category, TroopType::Knight);
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
        assert!(weak_draws >= 900 && weak_draws <= 1100, "weak beast odds drift");
        assert!(strong_draws >= 900 && strong_draws <= 1100, "stronger beast odds drift");
        assert!(weak_min < weak_max && strong_min < strong_max, "beast count did not vary");
        previous_stronger = strong_upper;
    }
}

#[test]
fn beast_ranges_include_both_endpoints_at_every_depth() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    for (depth, seed, count) in array![
        (0_u32, 18_u32, 300_u128), (0_u32, 114_u32, 550_u128), (0_u32, 142_u32, 450_u128), (0_u32, 173_u32, 350_u128),
        (1_u32, 63_u32, 900_u128), (1_u32, 125_u32, 1050_u128), (1_u32, 542_u32, 1350_u128),
        (1_u32, 1006_u32, 1650_u128), (2_u32, 314_u32, 2400_u128), (2_u32, 723_u32, 2800_u128),
        (2_u32, 798_u32, 3600_u128), (2_u32, 1267_u32, 4400_u128), (3_u32, 1230_u32, 7000_u128),
        (3_u32, 3288_u32, 11000_u128), (3_u32, 5293_u32, 9000_u128), (3_u32, 7262_u32, 6000_u128),
    ] {
        let guard = frontier_guard(
            BEASTS_CATEGORY, *preset.settlement.depths.at(depth), seed.into(), preset.rules, 360,
        );
        assert_eq!(guard.count, count * RESOURCE_PRECISION);
    }
}

#[test]
fn ruin_beasts_are_sized_by_layer_in_one_troop_type() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let mut bounds = array![];
    for depth in preset.settlement.depths {
        bounds.append((*depth.ruin_guard_lower, *depth.ruin_guard_upper));
    }
    // Land, then Ethereal I-III; Ethereal III is grown 1.3x for legendary Battle.
    assert_eq!(bounds, array![(2000, 4000), (6000, 10500), (18000, 22500), (52500, 76000)]);
}

#[test]
#[feature("safe_dispatcher")]
fn frontier_registration_refuses_invalid_site_and_beast_guard_ranges() {
    let d = super::registrar::setup();
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..12 {
        let (id, mut preset) = super::preset_projection::current_definition("frontier");
        if invalid == 5 {
            preset.rules.troop_limit_config.t1_tier_strength = 2;
        }
        let mut depths = array![];
        for row in preset.settlement.depths {
            let mut depth = *row;
            if invalid == 0 {
                depth.guard_step = 0;
            }
            if invalid == 1 {
                depth.site_guard_upper += 1;
            }
            if invalid == 2 {
                depth.ruin_guard_upper += 1;
            }
            if invalid == 3 {
                depth.site_guard_lower = depth.site_guard_upper + 100;
            }
            if invalid == 4 {
                depth.ruin_guard_lower = depth.ruin_guard_upper + 100;
            }
            if invalid == 6 {
                depth.beast_weak_lower = 0;
            }
            if invalid == 7 {
                depth.beast_weak_lower = depth.beast_weak_upper + 1;
            }
            if invalid == 8 {
                depth.beast_strong_lower = depth.beast_strong_upper + 1;
            }
            if invalid == 9 {
                depth.beast_weak_upper = depth.beast_strong_lower;
            }
            if invalid == 10 {
                depth.beast_strong_upper = depth.site_guard_lower;
            }
            if invalid == 11 {
                depth.ruin_guard_lower = 100;
            }
            depths.append(depth);
        }
        preset.settlement.depths = depths.span();
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(id, preset).is_err());
    }
}
