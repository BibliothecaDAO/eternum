use starknet::storage::Map;

#[starknet::storage_node]
pub struct UpgradeStateStorage<TUpgradeLimits, TResourceAmount> {
    pub limits: Map<u32, Option<TUpgradeLimits>>,
    pub cost_counts: Map<(u32, u8), u32>,
    pub upgrade_costs: Map<(u32, u8, u32), TResourceAmount>,
}
