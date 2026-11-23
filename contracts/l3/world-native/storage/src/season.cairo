use starknet::ContractAddress;
use starknet::storage::Map;

#[starknet::storage_node]
pub struct SeasonPointsStorage {
    pub aspect_heights: Map<(u32, u8), u32>,
    pub race_members: Map<(u32, u64), (u128, u128)>,
    pub triumph_days: Map<(u32, u8, u8), Option<u64>>,
    pub race_winners: Map<u32, Option<u8>>,
    pub player_points: Map<(u32, ContractAddress), u128>,
    pub season_points: Map<u32, u128>,
}
