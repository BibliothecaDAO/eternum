use crate::rules::{RESOURCE_PRECISION, SliceRules};
use crate::taxonomy::{BANK_CATEGORY, BITCOIN_MINE_CATEGORY, CAMP_CATEGORY, HYPERSTRUCTURE_CATEGORY, MINE_CATEGORY};
use crate::troops::{TroopTier, TroopType, discovery_guards};

#[test]
fn blitz_light_and_heavy_guards_reach_both_inclusive_endpoints_in_every_slot() {
    let (_, preset) = super::preset_projection::current_definition("blitz");
    let limits = preset.rules.troop_limit_config;
    assert_eq!((limits.light_guard_lower_bound, limits.light_guard_upper_bound), (999, 1499));
    assert_eq!((limits.heavy_guard_lower_bound, limits.heavy_guard_upper_bound), (1499, 1999));
    for category in array![CAMP_CATEGORY, MINE_CATEGORY] {
        assert_endpoints(preset.rules, category, 1, TroopTier::T1, 999, 1499, 370, 623);
    }
    for category in array![HYPERSTRUCTURE_CATEGORY, BANK_CATEGORY] {
        assert_endpoints(preset.rules, category, 3, TroopTier::T2, 1499, 1999, 370, 623);
    }
    assert_endpoints(preset.rules, BITCOIN_MINE_CATEGORY, 4, TroopTier::T2, 1499, 1999, 370, 623);
}

#[test]
fn eternum_preserves_its_existing_inclusive_eight_hundred_to_fourteen_ninety_nine_draw() {
    let (_, preset) = super::preset_projection::current_definition("eternum");
    let limits = preset.rules.troop_limit_config;
    assert_eq!((limits.light_guard_lower_bound, limits.light_guard_upper_bound), (800, 1499));
    assert_eq!((limits.heavy_guard_lower_bound, limits.heavy_guard_upper_bound), (800, 1499));
    for category in array![CAMP_CATEGORY, MINE_CATEGORY] {
        assert_endpoints(preset.rules, category, 1, TroopTier::T1, 800, 1499, 171, 136);
    }
    for category in array![HYPERSTRUCTURE_CATEGORY, BANK_CATEGORY] {
        assert_endpoints(preset.rules, category, 3, TroopTier::T2, 800, 1499, 171, 136);
    }
    assert_endpoints(preset.rules, BITCOIN_MINE_CATEGORY, 4, TroopTier::T2, 800, 1499, 171, 136);
}

fn assert_endpoints(
    rules: SliceRules,
    category: u8,
    slots: u8,
    tier: TroopTier,
    lower: u128,
    upper: u128,
    lower_seed: u256,
    upper_seed: u256,
) {
    for slot in 0_u8..slots {
        let offset: u256 = if slots == 3 {
            slot.into()
        } else {
            0
        };
        for (seed, expected) in array![(lower_seed - offset, lower), (upper_seed - offset, upper)] {
            let guards = discovery_guards(category, seed, rules, 360);
            assert_eq!(guards.len(), slots.into());
            assert_eq!(*guards.at(slot.into()).count, expected * RESOURCE_PRECISION);
            for index in 0_u32..guards.len() {
                let guard = *guards.at(index);
                if slots != 1 {
                    let troop = match index {
                        1 => TroopType::Knight,
                        2 => TroopType::Crossbowman,
                        _ => TroopType::Paladin,
                    };
                    assert_eq!(guard.category, troop);
                }
                assert_eq!(guard.tier, tier);
                assert_eq!(guard.count % RESOURCE_PRECISION, 0);
                assert!(guard.count >= lower * RESOURCE_PRECISION && guard.count <= upper * RESOURCE_PRECISION);
            }
        }
    }
}

#[test]
fn single_value_guard_ranges_include_the_largest_u16() {
    let (_, mut preset) = super::preset_projection::current_definition("blitz");
    preset.rules.troop_limit_config.light_guard_lower_bound = 10;
    preset.rules.troop_limit_config.light_guard_upper_bound = 10;
    preset.rules.troop_limit_config.heavy_guard_lower_bound = 65535;
    preset.rules.troop_limit_config.heavy_guard_upper_bound = 65535;
    assert_endpoints(preset.rules, CAMP_CATEGORY, 1, TroopTier::T1, 10, 10, 5, 5);
    assert_endpoints(preset.rules, HYPERSTRUCTURE_CATEGORY, 3, TroopTier::T2, 65535, 65535, 5, 5);
}

#[test]
fn light_guard_types_are_seeded_independently_of_their_counts() {
    let (_, preset) = super::preset_projection::current_definition("blitz");
    let vectors = array![
        (0_u256, TroopType::Crossbowman, 1090_u128), (1, TroopType::Knight, 1400), (3, TroopType::Paladin, 1241),
        (370, TroopType::Crossbowman, 999), (623, TroopType::Paladin, 1499),
    ];
    let mut fixed_count_rules = preset.rules;
    fixed_count_rules.troop_limit_config.light_guard_lower_bound = 7;
    fixed_count_rules.troop_limit_config.light_guard_upper_bound = 7;
    for category in array![CAMP_CATEGORY, MINE_CATEGORY] {
        for (seed, troop, count) in vectors.span() {
            let guards = discovery_guards(category, *seed, preset.rules, 360);
            assert_eq!(guards.len(), 1);
            let guard = *guards.at(0);
            assert_eq!(guard.category, *troop);
            assert_eq!(guard.tier, TroopTier::T1);
            assert_eq!(guard.count, *count * RESOURCE_PRECISION);
            assert_eq!(discovery_guards(category, *seed, preset.rules, 360), guards);
            let fixed = *discovery_guards(category, *seed, fixed_count_rules, 360).at(0);
            assert_eq!(fixed.count, 7 * RESOURCE_PRECISION);
            assert_eq!(fixed.category, *troop);
        }
    }
}

#[test]
fn light_guards_draw_all_three_troop_types_evenly() {
    let (_, preset) = super::preset_projection::current_definition("blitz");
    for category in array![CAMP_CATEGORY, MINE_CATEGORY] {
        let mut knights = 0_u32;
        let mut paladins = 0_u32;
        let mut crossbowmen = 0_u32;
        for seed in 0_u32..3000 {
            let guards = discovery_guards(category, seed.into(), preset.rules, 360);
            assert_eq!(guards.len(), 1);
            match *guards.at(0).category {
                TroopType::Knight => knights += 1,
                TroopType::Paladin => paladins += 1,
                TroopType::Crossbowman => crossbowmen += 1,
            }
        }
        // Each type expects 1,000 of 3,000 draws; a 100-draw margin is about 3.9 standard deviations.
        for count in array![knights, paladins, crossbowmen] {
            assert!(count >= 900 && count <= 1100, "light guard type odds drift");
        }
    }
}

#[test]
fn eternum_uses_the_same_light_guard_type_draw() {
    let (_, preset) = super::preset_projection::current_definition("eternum");
    for category in array![CAMP_CATEGORY, MINE_CATEGORY] {
        for (seed, troop) in array![(0_u256, TroopType::Crossbowman), (1, TroopType::Knight), (3, TroopType::Paladin)] {
            let guard = *discovery_guards(category, seed, preset.rules, 360).at(0);
            assert_eq!(guard.category, troop);
            assert_eq!(guard.tier, TroopTier::T1);
        }
    }
}
