use starknet::storage::Map;

#[starknet::storage_node]
pub struct GameStateStorage<TGameRegistry, TSliceRules> {
    pub games: Map<u32, TGameRegistry>,
    pub rules: Map<u32, TSliceRules>,
    pub next_entity: Map<u32, u32>,
}
