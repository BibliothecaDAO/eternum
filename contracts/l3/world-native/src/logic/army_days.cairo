use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::troops::ExplorerKey;

#[cfg(not(feature: "blitz"))]
#[inline(always)]
pub fn today(game: crate::game::GameRegistry, timestamp: u64) -> u64 {
    crate::days::day_of(game, crate::balance::rules::SWITCHES.day_unit_seconds, timestamp).index
}

#[cfg(feature: "blitz")]
pub fn today(_game: crate::game::GameRegistry, _timestamp: u64) -> u64 {
    0
}

#[cfg(not(feature: "blitz"))]
pub fn require(key: ExplorerKey) -> u64 {
    crate::state::read().troops.army_days.read((key.game_id, key.explorer_id)).expect('missing army day')
}

#[cfg(feature: "blitz")]
pub fn require(_key: ExplorerKey) -> u64 {
    0
}

pub fn create(key: ExplorerKey, day: u64) {
    let state = crate::state::write();
    assert!(state.troops.army_days.read((key.game_id, key.explorer_id)).is_none(), "army day already assigned");
    state.troops.army_days.write((key.game_id, key.explorer_id), Some(day));
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet {
                version: 1, model: 'ArmyDay', keys: keys.span(), values: array![day.into()].span(),
            },
        ),
    );
}

pub fn remove(key: ExplorerKey) {
    let state = crate::state::write();
    if state.troops.army_days.read((key.game_id, key.explorer_id)).is_none() {
        return;
    }
    state.troops.army_days.write((key.game_id, key.explorer_id), None);
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'ArmyDay', keys: keys.span() },
        ),
    );
}
