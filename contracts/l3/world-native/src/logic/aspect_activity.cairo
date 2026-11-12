use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use crate::resources::ResourceKey;

pub fn record_first_allocation(home: ResourceKey, day: u64, allowance: u8) {
    if crate::logic::aspects::rules(home.game_id).is_none() {
        return;
    }
    let state = crate::state::write();
    for slot in 0..allowance {
        if crate::logic::army_slot_storage::read(
            crate::troops::ArmySlotKey { game_id: home.game_id, structure_id: home.entity_id, epoch: day, slot },
        )
            .is_some() {
            return;
        }
    }
    let aspect = crate::logic::aspects::home_aspect(home);
    let key = (home.game_id, aspect, day);
    let members = state.troops.aspect_activity.read(key) + 1;
    state.troops.aspect_activity.write(key, members);
    crate::logic::troops::TroopState::emit(
        crate::logic::troops::TroopState::Event::RowSet(
            crate::events::RowSet {
                version: 1,
                model: 'AspectActivity',
                keys: array![home.game_id.into(), aspect.into(), day.into()].span(),
                values: array![members.into()].span(),
            },
        ),
    );
}
