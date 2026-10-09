use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct EntryAdministrationStorage {
    pub operator: ContractAddress,
    pub labor_grants: Map<(u32, u32, u64), Option<(ContractAddress, u64, u128)>>,
    pub labor_claim_counts: Map<(u32, ContractAddress, u64), u32>,
}
