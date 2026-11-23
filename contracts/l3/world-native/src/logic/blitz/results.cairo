use starknet::ContractAddress;
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use crate::ownership::{Story, StoryEvent};

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct RankedPlayer {
    pub wallet: ContractAddress,
    pub rank: u16,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BlitzResult {
    pub players: Span<RankedPlayer>,
    pub complete: bool,
    pub commitment: felt252,
}

pub fn result(game_id: u32) -> BlitzResult {
    if !crate::logic::game::game(game_id).settled {
        return BlitzResult { players: array![].span(), complete: false, commitment: 0 };
    }
    let players = ranked(game_id);
    BlitzResult { players, complete: true, commitment: commitment(game_id, players) }
}

pub fn announce(game_id: u32, timestamp: u64) {
    let event = StoryEvent {
        version: 2,
        game_id,
        owner: Some(crate::state::read().launcher.read()),
        entity_id: None,
        tx_hash: starknet::get_tx_info().unbox().transaction_hash,
        story: Story::BlitzFinalized(result(game_id).commitment),
        timestamp,
    };
    let mut keys = array![selector!("StoryEvent")];
    let mut data = array![];
    starknet::Event::append_keys_and_data(@event, ref keys, ref data);
    starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
}

fn ranked(game_id: u32) -> Span<RankedPlayer> {
    let state = crate::state::read();
    let mut wallets = array![];
    let mut points = array![];
    for index in 0..crate::logic::blitz::roster::size(game_id) {
        let wallet = state.roster.players.read((game_id, index));
        wallets.append(wallet);
        points.append(state.season.player_points.read((game_id, wallet)));
    }
    let mut placed: core::dict::Felt252Dict<felt252> = Default::default();
    let mut ranks: core::dict::Felt252Dict<u16> = Default::default();
    for player in 0..wallets.len() {
        let mut rank: u16 = 1;
        let mut place: u32 = 0;
        for other in 0..wallets.len() {
            if *points[other] > *points[player] {
                rank += 1;
                place += 1;
            } else if *points[other] == *points[player] && *wallets[other] < *wallets[player] {
                place += 1;
            }
        }
        placed.insert(place.into(), (*wallets[player]).into());
        ranks.insert(place.into(), rank);
    }
    let mut players = array![];
    for place in 0..wallets.len() {
        players
            .append(
                RankedPlayer { wallet: placed.get(place.into()).try_into().unwrap(), rank: ranks.get(place.into()) },
            );
    }
    players.span()
}

fn commitment(game_id: u32, players: Span<RankedPlayer>) -> felt252 {
    result_commitment(starknet::get_tx_info().unbox().chain_id, game_id, players)
}

pub fn result_commitment(shard: felt252, game_id: u32, players: Span<RankedPlayer>) -> felt252 {
    let mut values = array!['ETERNUM_BLITZ_RESULT', 3, shard, game_id.into(), players.len().into()];
    for player in players {
        values.append((*player.wallet).into());
        values.append((*player.rank).into());
    }
    core::poseidon::poseidon_hash_span(values.span())
}
