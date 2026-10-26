pub use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
pub use crate::game::{IGameDispatcher, IGameDispatcherTrait};
pub use crate::map::{IMapLogicDispatcher, IMapLogicDispatcherTrait};
pub use crate::mines::{
    IMineRulesDispatcher, IMineRulesDispatcherTrait, IMineRulesSafeDispatcher, IMineRulesSafeDispatcherTrait,
    MineKindConfig, MineKindEntry, MineKindKey, MinePoolKey, MineWeight, cap, select_kind,
};
pub use crate::registrar::IRegistrarSafeDispatcherTrait;
pub use crate::resources::{IResourceOperationsDispatcher, ResourceKey, ResourceSlot};
pub use crate::rules::RESOURCE_PRECISION;
pub use crate::structures::{IStructureOperationsDispatcher, IStructureOperationsDispatcherTrait};
pub use crate::tests::state::{MapObservationTrait, ResourceObservationTrait, StructureObservationTrait};
pub use crate::troops::{Coord, TroopTier, TroopType};
pub fn kinds() -> Span<MineKindEntry> {
    array![
        MineKindEntry {
            kind: 1,
            config: MineKindConfig {
                resource_type: 38,
                building_category: 39,
                production_rate: 2500000000,
                cap_min: 36000 * RESOURCE_PRECISION,
                cap_steps: 1,
            },
        },
        MineKindEntry {
            kind: 2,
            config: MineKindConfig {
                resource_type: 24,
                building_category: 26,
                production_rate: 1500000000,
                cap_min: 300000 * RESOURCE_PRECISION,
                cap_steps: 10,
            },
        },
    ]
        .span()
}
pub fn surface() -> Span<MineWeight> {
    array![MineWeight { kind: 1, weight: 1 }, MineWeight { kind: 2, weight: 1 }].span()
}
