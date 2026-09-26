use starknet::storage::Map;

#[starknet::storage_node]
pub struct ProductionStateStorage<TProductionBonus> {
    pub realm_support: Map<(u32, u32, u64), u8>,
    pub bonuses: Map<(u32, u32), TProductionBonus>,
}
