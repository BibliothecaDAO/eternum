use starknet::storage::Map;

#[starknet::storage_node]
pub struct RelicStateStorage<TLordsBudget, TLordsWithdrawal, TRelicChest> {
    pub rollover_budget: Map<u32, Option<TLordsBudget>>,
    pub lords_withdrawals: Map<felt252, Option<TLordsWithdrawal>>,
    pub relic_chests: Map<(u32, u64), Option<TRelicChest>>,
}
