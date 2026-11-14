use starknet::storage::Map;

#[starknet::storage_node]
pub struct BaneStorage {
    pub world_days: Map<(u32, u64), Option<u8>>,
    pub next_roll_at: Map<u32, u64>,
    pub next_chance: Map<u32, u16>,
    pub first_team_day: Map<u32, Option<u64>>,
    pub progress: Map<(u32, u8, u64), (u32, u64)>,
    pub bonus_grants: Map<(u32, u64, u64), Option<(u128, u128)>>,
    pub altar_bars: Map<(u32, u8), u32>,
    pub team_banes: Map<(u32, u8, u64), Option<(u8, u64, u8)>>,
    pub latest_bane_day: Map<(u32, u8), Option<u64>>,
}
