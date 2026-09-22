use starknet::storage::Map;

#[starknet::storage_node]
pub struct RegistrarStateStorage<TRosterPlayer> {
    pub presets: Map<u32, felt252>,
    pub next_game: u32,
    pub launch_ids: Map<felt252, u32>,
    pub launch_commitments: Map<felt252, felt252>,
    pub roster_sizes: Map<u32, u32>,
    pub roster_players: Map<(u32, u32), TRosterPlayer>,
}
