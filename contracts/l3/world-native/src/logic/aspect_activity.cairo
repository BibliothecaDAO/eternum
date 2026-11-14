use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::resources::ResourceKey;
use crate::troops::ArmySlotKey;

pub fn record_first_allocation(home: ResourceKey, day: u64, allowance: u8) {
    if crate::logic::aspects::rules(home.game_id).is_none() {
        return;
    }
    for slot in 0..allowance {
        if crate::logic::army_slot_storage::read(
            ArmySlotKey { game_id: home.game_id, structure_id: home.entity_id, epoch: day, slot },
        ).is_some() {
            return;
        }
    }
    let aspect = crate::logic::aspects::home_aspect(home);
    let state = crate::state::write();
    let key = (home.game_id, aspect, day);
    let active = state.troops.aspect_activity.read(key) + 1;
    state.troops.aspect_activity.write(key, active);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet {
                version: 1,
                model: 'AspectActivity',
                keys: array![home.game_id.into(), aspect.into(), day.into()].span(),
                values: array![active.into()].span(),
            },
        ),
    );
}
