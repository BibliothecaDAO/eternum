use starknet::storage::Map;

#[starknet::storage_node]
pub struct RelicStateStorage<TLordsWithdrawal> {
    pub lords_withdrawals: Map<felt252, Option<TLordsWithdrawal>>,
    pub army_relics: Map<(u32, u64), u32>,
    pub army_relic_effects: Map<(u32, u64, u8), Option<(u8, u64)>>,
    pub ruin_relics: Map<(u32, u64), u8>,
    pub ruin_caches: Map<(u32, u64), u128>,
}
