pub use crate::rules::{RESOURCE_PRECISION, SliceRules};
pub use crate::taxonomy::{BANK_CATEGORY, BITCOIN_MINE_CATEGORY, CAMP_CATEGORY, HYPERSTRUCTURE_CATEGORY, MINE_CATEGORY};
pub use crate::troops::{TroopTier, TroopType, discovery_guards};
pub fn assert_endpoints(
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
