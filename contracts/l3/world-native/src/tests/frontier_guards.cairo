use core::dict::{Felt252Dict, Felt252DictTrait};
use crate::taxonomy::{RIFT_CATEGORY, RUIN_CATEGORY, STRAGGLERS_CATEGORY};
use crate::registrar::{IRegistrarSafeDispatcher, IRegistrarSafeDispatcherTrait};
use crate::rules::RESOURCE_PRECISION;
use crate::troops::{TroopTier, TroopType, frontier_guard};

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
            let mut categories: Felt252Dict<u32> = Default::default();
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
                let troop: u8 = guard.category.into();
                let total = categories.get(troop.into());
                categories.insert(troop.into(), total + 1);
                // One troop type: every guard is T1 and its strength is its count.
                assert_eq!(guard.tier, TroopTier::T1);
                assert_eq!(guard.category, TroopType::Knight);
            }
            assert!(saw_lower && saw_upper, "inclusive endpoint never drawn");

        }
    }
}

#[test]
fn stragglers_are_a_third_of_the_camp_draw() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    for depth in preset.settlement.depths {
        for seed in 0_u32..2000 {
            let camp = frontier_guard(crate::taxonomy::CAMP_CATEGORY, *depth, seed.into(), preset.rules, 360);
            let stragglers = frontier_guard(STRAGGLERS_CATEGORY, *depth, seed.into(), preset.rules, 360);
            assert_eq!(stragglers.tier, TroopTier::T1);
            assert_eq!(stragglers.count, camp.count / RESOURCE_PRECISION / 3 * RESOURCE_PRECISION);
        }
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
fn frontier_registration_refuses_zero_step_off_grid_and_reversed_guard_bounds() {
    let d = super::registrar::setup();
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..6 {
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
            depths.append(depth);
        }
        preset.settlement.depths = depths.span();
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(id, preset).is_err());
    }
}

#[test]
fn only_stragglers_draw_among_the_three_troop_categories() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    let depth = *preset.settlement.depths.at(0);
    let mut categories: Felt252Dict<u32> = Default::default();
    for seed in 0_u32..10000 {
        let guard = frontier_guard(STRAGGLERS_CATEGORY, depth, seed.into(), preset.rules, 360);
        let troop: u8 = guard.category.into();
        categories.insert(troop.into(), categories.get(troop.into()) + 1);
    }
    for troop in 0_u8..3 {
        let count = categories.get(troop.into());
        assert!(count >= 3234 && count <= 3433, "straggler category odds drift");
    }
}
