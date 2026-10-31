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
        (380_u128, 420_u128, 430_u128, 470_u128), (760, 840, 860, 940), (1520, 1680, 1720, 1880),
        (3040, 3360, 3440, 3760),
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
        (0_u32, 8_u32, 380_u128), (0, 20, 430), (0, 25, 470), (0, 34, 420), (1, 21, 760), (1, 80, 860), (1, 102, 840),
        (1, 1052, 940), (2, 15, 1680), (2, 191, 1720), (2, 247, 1520), (2, 477, 1880), (3, 216, 3760), (3, 218, 3040),
        (3, 535, 3360), (3, 825, 3440),
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
    // Surface, then Ethereal I-III; every band stays below a 1.25x spread.
    assert_eq!(bounds, array![(2700, 3300), (4900, 6100), (9800, 12200), (19600, 24400)]);
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
