use starknet::storage::Map;

#[starknet::storage_node]
pub struct ProductionStateStorage<TProductionBonus> {
    pub bonuses: Map<(u32, u64), TProductionBonus>,
}
