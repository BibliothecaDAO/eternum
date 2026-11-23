use starknet::storage::StorageMapReadAccess;
use crate::guards::{Guard, GuardKey};

pub fn guard(key: GuardKey) -> Guard {
    let state = crate::state::read();
    assert!(key.slot < 4, "invalid guard slot");
    state.guards.guards.read((key.game_id, key.structure_id, key.slot))
}

pub mod GuardState {
    use starknet::Event as EventTrait;
    use starknet::storage::StorageMapWriteAccess;
    use crate::events::{RowDeleted, RowSet};
    use crate::guards::{Guard, GuardKey};
    use crate::resources::ResourceKey;

    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }

    pub fn save(key: GuardKey, guard: Guard) {
        let state = crate::state::write();
        if crate::logic::guards::guard(key) == guard {
            return;
        }
        state.guards.guards.write((key.game_id, key.structure_id, key.slot), guard);
        let mut keys = array![];
        key.serialize(ref keys);
        let mut values = array![];
        guard.serialize(ref values);
        if guard == Default::default() {
            emit(Event::RowDeleted(RowDeleted { version: 1, model: 'Guard', keys: keys.span() }));
        } else {
            emit(Event::RowSet(RowSet { version: 1, model: 'Guard', keys: keys.span(), values: values.span() }));
        }
    }
    pub fn reset(key: ResourceKey) {
        for slot in 0_u8..4 {
            save(GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot }, Default::default());
        }
    }
    // Attack the highest occupied functional slot first; Delta is slot zero.
    pub fn next(key: ResourceKey, maximum: u8) -> Option<GuardKey> {
        assert!(maximum <= 4, "invalid guard slot limit");
        let mut counts = array![];
        for slot in 0..maximum {
            counts
                .append(
                    crate::logic::guards::guard(GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot })
                        .troops
                        .count,
                );
        }
        next_slot(counts.span()).map(|slot| GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot })
    }

    pub fn next_slot(counts: Span<u128>) -> Option<u8> {
        assert!(counts.len() <= 4, "invalid guard slot limit");
        let mut slot = counts.len();
        while slot != 0 {
            slot -= 1;
            if *counts.at(slot) != 0 {
                return Some(slot.try_into().unwrap());
            }
        }
        None
    }

    pub fn emit(event: Event) {
        let mut keys = array![selector!("GuardEvent")];
        let mut data = array![];
        event.append_keys_and_data(ref keys, ref data);
        starknet::syscalls::emit_event_syscall(keys.span(), data.span()).unwrap();
    }
}
