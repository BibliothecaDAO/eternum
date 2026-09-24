use starknet::storage::Map;

#[starknet::storage_node]
pub struct GameStateStorage<TGameRegistry, TGameOverrides> {
    pub games: Map<u32, TGameRegistry>,
    pub overrides: Map<u32, TGameOverrides>,
    pub next_entity: Map<u32, u32>,
}
