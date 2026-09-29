use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct BitcoinStateStorage<TPhase, TContribution, TMineFunding> {
    pub phases: Map<(u32, u64), TPhase>,
    pub contributions: Map<(u32, u64, ContractAddress), TContribution>,
    pub contributor_indices: Map<(u32, u64, ContractAddress), u32>,
    pub labor_prefixes: Map<(u32, u64, u64), u128>,
    pub contributors: Map<(u32, u64, u32), ContractAddress>,
    pub mines: Map<(u32, u32), TMineFunding>,
    pub claimed: Map<(u32, u64, u32), bool>,
}
