use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::combat::ArmyCombat;
use crate::troops::{ExplorerKey, TroopType};

pub fn read(key: ExplorerKey) -> Option<ArmyCombat> {
    crate::state::read().troops.combat.read((key.game_id, key.explorer_id))
}

pub fn create(key: ExplorerKey, home: u64, category: TroopType) {
    assert!(read(key).is_none(), "army combat already exists");
    let learned = crate::logic::research::learned(crate::resources::ResourceKey { game_id: key.game_id, entity_id: home });
    let charge = if category == TroopType::Knight {
        crate::research::tier(learned, crate::research::ROW_BARRACKS)
    } else {
        0
    };
    write(key, ArmyCombat { charge, last_target: 0 });
}

/// A new target opens a fight. Repeated attacks on that entity do not charge again.
pub fn opening_charge(key: ExplorerKey, target: u64) -> u8 {
    assert!(target != 0, "missing combat target");
    let mut combat = read(key).expect('missing army combat');
    if combat.last_target == target {
        return 0;
    }
    combat.last_target = target;
    write(key, combat);
    combat.charge * crate::rules::CHARGE_PERCENT_PER_TIER
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
