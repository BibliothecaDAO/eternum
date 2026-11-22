use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::game::{PointActivity, PointsAwarded};

pub fn award(game_id: u32, player: ContractAddress, activity: PointActivity, points: u128) {
    let player_points = crate::state::read().season.player_points.read((game_id, player)) + points;
    let season_points = crate::state::read().season.season_points.read(game_id) + points;
    crate::state::write().season.player_points.write((game_id, player), player_points);
    crate::state::write().season.season_points.write(game_id, season_points);
    let event = PointsAwarded { version: 1, game_id, player, activity, points, player_points, season_points };
    let mut keys = array![selector!("PointsAwarded")];
    let mut data = array![];
    starknet::Event::append_keys_and_data(@event, ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}
