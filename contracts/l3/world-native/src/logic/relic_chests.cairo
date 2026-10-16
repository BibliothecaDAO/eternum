// A relic chest's pack: stored when the chest appears, so its tile can name it, and taken when the chest opens.
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::relics::RelicChest;
use crate::resources::ResourceKey;

pub fn store(key: ResourceKey, chest: RelicChest) {
    let state = crate::state::write();
    assert!(state.relics.relic_chests.read((key.game_id, key.entity_id)).is_none(), "relic chest already stored");
    state.relics.relic_chests.write((key.game_id, key.entity_id), Some(chest));
    let mut keys = array![];
    key.serialize(ref keys);
    let mut values = array![];
    chest.serialize(ref values);
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowSet(
            crate::events::RowSet { version: 1, model: 'RelicChest', keys: keys.span(), values: values.span() },
        ),
    );
}

pub fn take(key: ResourceKey) -> RelicChest {
    let state = crate::state::write();
    let chest = state.relics.relic_chests.read((key.game_id, key.entity_id)).expect('missing relic chest');
    state.relics.relic_chests.write((key.game_id, key.entity_id), None);
    let mut keys = array![];
    key.serialize(ref keys);
    crate::logic::map::MapState::emit(
        crate::logic::map::MapState::Event::RowDeleted(
            crate::events::RowDeleted { version: 1, model: 'RelicChest', keys: keys.span() },
        ),
    );
    chest
}
