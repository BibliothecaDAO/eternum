use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::troops::ExplorerKey;

pub fn require(key: ExplorerKey) -> u64 {
    crate::state::read().troops.army_days.read((key.game_id, key.explorer_id)).expect('missing army day')
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
