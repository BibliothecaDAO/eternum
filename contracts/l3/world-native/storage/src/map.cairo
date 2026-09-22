use starknet::storage::Map;

#[starknet::storage_node]
pub struct MapStateStorage {
    pub tiles: Map<(u32, bool, u32, u32), u128>,
    pub exists: Map<(u32, bool, u32, u32), bool>,
}

#[starknet::storage_node]
pub struct MapDomainStorage<TSpireLayout, TExplorationReward> {
    pub spire_layouts: Map<u32, Option<TSpireLayout>>,
    pub exploration_rewards: Map<(u32, u32), TExplorationReward>,
    pub exploration_reward_count: Map<u32, u32>,
    pub last_relic_discovery: Map<u32, u64>,
}
