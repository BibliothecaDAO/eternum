use starknet::storage::Map;

#[starknet::storage_node]
pub struct BaneStateStorage {
    pub progress: Map<(u32, u8, u64), (u32, u64)>,
    pub first_team_day: Map<u32, Option<u64>>,
    pub bonus_grants: Map<(u32, u64, u64), Option<(u128, u128)>>,
}
