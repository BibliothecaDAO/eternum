pub use core::dict::{Felt252Dict, Felt252DictTrait};
pub use crate::discovery::{Discovery, frontier};
pub use crate::expeditions::{ExpeditionDiscoveryKey, FrontierDiscoveryRules};
pub use crate::relics::SiteChest;
pub const CHEST: SiteChest = SiteChest { tier: 1, amount: 100, reservation_day: 0 };
pub fn rules() -> FrontierDiscoveryRules {
    FrontierDiscoveryRules { shrine_bps: 0, well_bps: 0, ..super::preset_projection::frontier_discovery_rules() }
}
pub fn bucket(result: Discovery) -> felt252 {
    match result {
        Discovery::Beasts => 0,
        Discovery::Camp => 1,
        Discovery::Rift => 2,
        Discovery::Ruin(_) => 3,
        Discovery::Shrine => 4,
        Discovery::Well => 5,
        _ => 6,
    }
}
pub fn within(actual: u32, target: u32, tolerance: u32) -> bool {
    actual + tolerance >= target && actual <= target + tolerance
}
