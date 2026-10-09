use starknet::storage::Map;
use starknet::ContractAddress;

#[starknet::storage_node]
pub struct GameStateStorage<TGameRegistry, TGameOverrides> {
    pub games: Map<u32, TGameRegistry>,
    pub overrides: Map<u32, TGameOverrides>,
    pub next_entity: Map<u32, u32>,
    pub home_entities: Map<(u32, u32), u32>,
    pub home_reservations: Map<(u32, ContractAddress), u64>,
}
