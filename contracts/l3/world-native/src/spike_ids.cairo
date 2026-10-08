//! Throwaway entity allocator for the node-first measurement. Never merge.
use core::pedersen::pedersen;
use starknet::{ContractAddress, get_caller_address};
use starknet::StorageAddress;
use starknet::syscalls::{storage_read_syscall, storage_write_syscall};

fn slot(tag: felt252, game: u32, actor: ContractAddress) -> StorageAddress {
    let value: u256 = pedersen(pedersen(tag, game.into()), actor.into()).into();
    let normalized: felt252 = (value % 0x7ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff00)
        .try_into().unwrap();
    normalized.try_into().unwrap()
}

pub fn configure(game: u32, actor: ContractAddress, home: u32) {
    assert!(home < 65536, "spike home block overflow");
    storage_write_syscall(0, slot(selector!("spike_id_home"), game, actor), home.into()).unwrap();
}

pub fn local_id(game: u32) -> Option<u32> {
    let actor = get_caller_address();
    let home: u32 = storage_read_syscall(0, slot(selector!("spike_id_home"), game, actor))
        .unwrap().try_into().unwrap();
    if home == 0 { return None; }
    let key = slot(selector!("spike_id_count"), game, actor);
    let count: u32 = storage_read_syscall(0, key).unwrap().try_into().unwrap();
    assert!(count < 65535, "spike home id block exhausted");
    let next = count + 1;
    storage_write_syscall(0, key, next.into()).unwrap();
    Some(home * 65536 + next)
}

pub fn record(game: u32, id: u32) {
    storage_write_syscall(0, slot(selector!("spike_id_last"), game, get_caller_address()), id.into()).unwrap();
}

pub fn last(game: u32, actor: ContractAddress) -> u32 {
    storage_read_syscall(0, slot(selector!("spike_id_last"), game, actor)).unwrap().try_into().unwrap()
}

// Reservation happens before a settle wave; each account's seat is immutable during it.
pub fn settlement_seat(game: u32, actor: ContractAddress) -> Option<u16> {
    let value: u16 = storage_read_syscall(0, slot(selector!("spike_settle_seat"), game, actor)).unwrap().try_into().unwrap();
    if value == 0 { None } else { Some(value) }
}
pub fn bind_settlement_seat(game: u32, actor: ContractAddress, realm: u16) {
    assert!(settlement_seat(game, actor).is_none(), "seat already bound");
    storage_write_syscall(0, slot(selector!("spike_settle_seat"), game, actor), realm.into()).unwrap();
    configure(game, actor, realm.into());
}
pub fn action_root(actor: ContractAddress) -> u256 {
    core::poseidon::poseidon_hash_span(array![123456789, actor.into()].span()).into()
}
#[starknet::interface]
pub trait ISpikeSeats<T> {
    fn assign_spike_seats(ref self: T, game: u32, actors: Span<ContractAddress>);
    fn seal_spike_seats(ref self: T, game: u32);
}
