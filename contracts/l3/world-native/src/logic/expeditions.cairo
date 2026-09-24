use starknet::storage::StorageMapReadAccess;
use crate::expeditions::*;
use crate::troops::Coord;

pub fn depth_rules_at(game_id: u32, coord: Coord) -> DepthRules {
    let spacing = crate::logic::settlement::rules(game_id).spacing;
    depth_rules(game_id, (coord.y / spacing % 4).try_into().unwrap())
}

pub fn depth_rules(game_id: u32, depth: u8) -> DepthRules {
    crate::state::read().depths.depth_rules.read((game_id, depth)).expect('missing depth rules')
}
