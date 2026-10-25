use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct EntryAdministrationStorage {
    pub operator: ContractAddress,
    pub home_labor_grants: Map<(u32, u64, u64), Option<(ContractAddress, u128)>>,
}
