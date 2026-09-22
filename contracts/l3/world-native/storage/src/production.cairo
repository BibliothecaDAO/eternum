use starknet::storage::Map;

#[starknet::storage_node]
pub struct ProductionStateStorage<TRecipeTerms, TResourceAmount, TProductionBonus> {
    pub configured: Map<u32, bool>,
    pub terms: Map<(u32, u8), TRecipeTerms>,
    pub inputs: Map<(u32, u8, bool, u8), TResourceAmount>,
    pub bonuses: Map<(u32, u32), TProductionBonus>,
}
