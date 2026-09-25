use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct RelicStateStorage<TChestReward> {
    pub lords_committed: Map<u32, Option<u128>>,
    pub chest_pity: Map<(u32, ContractAddress, u8), u16>,
    pub chest_tokens: Map<(u32, ContractAddress, u64), u16>,
    pub chest_rewards: Map<(u32, u64, u32), Option<TChestReward>>,
}
