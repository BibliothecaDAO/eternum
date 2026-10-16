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
                let troop = if slots == 1 {
                    TroopType::Crossbowman
                } else {
                    match index {
                        1 => TroopType::Knight,
                        2 => TroopType::Crossbowman,
                        _ => TroopType::Paladin,
                    }
                };
                assert_eq!(guard.category, troop);
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
