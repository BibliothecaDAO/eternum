use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::progression::ArmyProgress;
use crate::troops::ExplorerKey;


#[inline(never)]
pub fn read(key: ExplorerKey) -> Option<ArmyProgress> {
    crate::state::read().troops.progress.read((key.game_id, key.explorer_id))
}

#[inline(never)]
pub fn require(key: ExplorerKey) -> ArmyProgress {
    read(key).expect('missing army progress')
}

#[cfg(not(feature: "blitz"))]
#[inline(never)]
pub fn held_oaths(key: ExplorerKey, context: crate::commands::ExecutionContext) -> u16 {
    require(key).oaths
}

#[cfg(feature: "blitz")]
pub fn held_oaths(_key: ExplorerKey, _context: crate::commands::ExecutionContext) -> u16 {
    0
}

pub fn create(key: ExplorerKey, learned: u64, category: crate::troops::TroopType) -> ArmyProgress {
    assert!(read(key).is_none(), "army progress already exists");
    let progress = crate::progression::trained(learned, category);
    write(key, progress);
    progress
}

#[inline(never)]
pub fn write(key: ExplorerKey, progress: ArmyProgress) {
    crate::state::write().troops.progress.write((key.game_id, key.explorer_id), Some(progress));
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    progress.serialize(ref values);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'ArmyProgress', keys: keys.span(), values: values.span() },
        ),
    );
}

pub fn destroy(key: ExplorerKey) {
    require(key);
    crate::state::write().troops.progress.write((key.game_id, key.explorer_id), None);
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'ArmyProgress', keys: keys.span() },
        ),
    );
}

/// An army's own maximum stamina: its Logistics tier's for an expedition army, its troop's for any other.
pub fn own_stamina_max(
    key: ExplorerKey, troops: crate::troops::Troops, rules: crate::rules::TroopStaminaConfig,
) -> u64 {
    match read(key) {
        Some(progress) => crate::progression::stamina_max(progress, troops.category, rules),
        None => crate::stamina::StaminaImpl::max(troops.category, troops.tier, rules),
    }
}
