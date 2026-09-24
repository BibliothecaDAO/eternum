use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct RelicStateStorage<TRelicRule, TChestRules, TChestReward> {
    pub relic_rules: Map<(u32, u8), TRelicRule>,
    pub relic_configured: Map<u32, bool>,
    pub chest_rules: Map<u32, Option<TChestRules>>,
    pub chest_pity: Map<(u32, ContractAddress, u8), u16>,
    pub chest_tokens: Map<(u32, ContractAddress, u64), u16>,
    pub chest_rewards: Map<(u32, u64, u32), Option<TChestReward>>,
    pub artificer_costs: Map<u32, Option<u128>>,
}
