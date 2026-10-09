use starknet::storage::Map;

#[starknet::storage_node]
pub struct RelicStateStorage<TLordsBudget, TLordsWithdrawal> {
    pub lords_budget: Map<u32, Option<TLordsBudget>>,
    pub lords_withdrawals: Map<(u32, felt252), Option<TLordsWithdrawal>>,
}
