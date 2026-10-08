use starknet::storage::Map;

#[starknet::storage_node]
pub struct ProductionStateStorage<TProductionBonus> {
    pub bonuses: Map<(u32, u32), TProductionBonus>,
}
