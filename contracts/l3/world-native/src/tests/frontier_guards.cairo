use core::dict::{Felt252Dict, Felt252DictTrait};
use crate::expeditions::SiteKind;
use crate::registrar::{IRegistrarSafeDispatcher, IRegistrarSafeDispatcherTrait};
use crate::rules::RESOURCE_PRECISION;
use crate::troops::{TroopTier, TroopType, frontier_guard};

#[test]
fn seeded_frontier_guards_use_the_inclusive_preset_grid_and_random_categories() {
    let (_, preset) = super::preset_projection::current_definition("frontier");
    for depth_index in 0_u32..4 {
        let depth = *preset.settlement.depths.at(depth_index);
        for kind in array![SiteKind::Camp, SiteKind::Rift, SiteKind::FallenRealm] {
            let fallen = kind == SiteKind::FallenRealm;
            let (lower, upper) = if fallen {
                (depth.fallen_guard_lower, depth.fallen_guard_upper)
            } else {
                (depth.guard_lower.into(), depth.guard_upper.into())
            };
            let mut categories: Felt252Dict<u32> = Default::default();
            let mut saw_lower = false;
            let mut saw_upper = false;
            for seed in 0_u32..10000 {
                let guard = frontier_guard(kind, depth, seed.into(), preset.rules, 360);
                let count = guard.count / RESOURCE_PRECISION;
                assert_eq!(guard.count % RESOURCE_PRECISION, 0);
                assert!(count >= lower.into() && count <= upper.into(), "guard outside inclusive bounds");
                assert_eq!((count - Into::<u32, u128>::into(lower)) % depth.guard_step.into(), 0);
                saw_lower = saw_lower || count == lower.into();
                saw_upper = saw_upper || count == upper.into();
                let category: u8 = guard.category.into();
                let total = categories.get(category.into());
                categories.insert(category.into(), total + 1);
                if fallen {
                    assert_eq!(guard.category, TroopType::Knight);
                    assert_eq!(guard.tier, depth.fallen_guard_tier);
                } else {
                    assert_eq!(guard.tier, TroopTier::T1);
                }
            }
            assert!(saw_lower && saw_upper, "inclusive endpoint never drawn");
            if !fallen {
                for category in 0_u8..3 {
                    let count = categories.get(category.into());
                    assert!(count >= 3234 && count <= 3433, "guard category odds drift");
                    println!("depth {} category {} of 10000: {}", depth_index, category, count);
                }
            }
        }
    }
}

#[test]
#[feature("safe_dispatcher")]
fn frontier_registration_refuses_zero_step_off_grid_and_reversed_guard_bounds() {
    let d = super::registrar::setup();
    snforge_std::start_cheat_caller_address(d.games, super::authority());
    for invalid in 0_u8..5 {
        let (id, mut preset) = super::preset_projection::current_definition("frontier");
        let mut depths = array![];
        for row in preset.settlement.depths {
            let mut depth = *row;
            if invalid == 0 {
                depth.guard_step = 0;
            }
            if invalid == 1 {
                depth.guard_upper += 1;
            }
            if invalid == 2 {
                depth.fallen_guard_upper += 1;
            }
            if invalid == 3 {
                depth.guard_lower = depth.guard_upper + 100;
            }
            if invalid == 4 {
                depth.fallen_guard_lower = depth.fallen_guard_upper + 100;
            }
            depths.append(depth);
        }
        preset.settlement.depths = depths.span();
        assert!(IRegistrarSafeDispatcher { contract_address: d.games }.register_preset(id, preset).is_err());
    }
}
