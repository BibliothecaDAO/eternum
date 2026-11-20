use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::combat::ArmyCombat;
use crate::troops::ExplorerKey;

pub fn read(key: ExplorerKey) -> Option<ArmyCombat> {
    crate::state::read().troops.combat.read((key.game_id, key.explorer_id))
}

pub fn create(key: ExplorerKey) {
    assert!(read(key).is_none(), "army combat already exists");
    write(key, ArmyCombat { last_target: 0 });
}

pub fn record_target(key: ExplorerKey, target: u64) {
    assert!(target != 0, "missing combat target");
    let mut combat = read(key).expect('missing army combat');
    if combat.last_target != target {
        combat.last_target = target;
        write(key, combat);
    }
}

fn write(key: ExplorerKey, combat: ArmyCombat) {
    crate::state::write().troops.combat.write((key.game_id, key.explorer_id), Some(combat));
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    combat.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'ArmyCombat', keys: keys.span(), values: values.span() },
        ),
    );
}

pub fn remove(key: ExplorerKey) {
    if read(key).is_none() {
        return;
    }
    crate::state::write().troops.combat.write((key.game_id, key.explorer_id), None);
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'ArmyCombat', keys: keys.span() },
        ),
    );
}
