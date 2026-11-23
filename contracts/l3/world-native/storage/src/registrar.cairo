use starknet::storage::Map;

#[starknet::storage_node]
pub struct RegistrarStateStorage {
    pub next_game: u32,
    pub launch_ids: Map<felt252, u32>,
    pub launch_commitments: Map<felt252, felt252>,
}
