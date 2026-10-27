use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct EntryAdministrationStorage {
    pub operator: ContractAddress,
    pub prize_pool: Map<u32, u128>,
    pub prize_issued: Map<u32, u128>,
    pub prize_count: Map<u32, Option<u16>>,
    pub prize_winners: Map<(u32, u16), ContractAddress>,
    pub prize_awarded: Map<(u32, u16), bool>,
    pub labor_grants: Map<(u32, u64), Option<(u32, ContractAddress, u64, u128)>>,
    pub labor_claim_counts: Map<(ContractAddress, u64), u32>,
}
