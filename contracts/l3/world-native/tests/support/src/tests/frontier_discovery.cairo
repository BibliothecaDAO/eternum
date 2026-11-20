pub use core::dict::{Felt252Dict, Felt252DictTrait};
pub use crate::discovery::{Discovery, frontier};
pub use crate::expeditions::{ExpeditionDiscoveryKey, FrontierDiscoveryRules};
pub const RELIC: crate::army_relics::ArmyRelic = crate::army_relics::ArmyRelic {
    kind: crate::army_relics::RelicKind::Blade, rank: 1,
};
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
