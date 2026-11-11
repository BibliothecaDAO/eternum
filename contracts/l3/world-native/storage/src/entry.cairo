use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct EntryAdministrationStorage {
    pub deposit_sources: Map<u32, Option<(felt252, ContractAddress, felt252, u64)>>,
    pub spend_lords: Map<(u32, ContractAddress), (u128, u128, u128)>,
    pub principal_withdrawals: Map<(u32, ContractAddress), Option<u128>>,
    pub deposit_receipts: Map<(u32, u64), Option<(felt252, ContractAddress, u128, bool)>>,
    pub operator: ContractAddress,
    pub prize_pool: Map<u32, u128>,
    pub prize_issued: Map<u32, u128>,
    pub prize_count: Map<u32, Option<u16>>,
    pub prize_winners: Map<(u32, u16), ContractAddress>,
    pub prize_awarded: Map<(u32, u16), bool>,
    pub home_labor_grants: Map<(u32, u64, u64), Option<(ContractAddress, u128, u128)>>,
}
