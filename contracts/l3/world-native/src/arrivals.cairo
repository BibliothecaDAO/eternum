use crate::resources::ResourceAmount;

pub const SLOTS_PER_DAY: u8 = 48;
const INDEX_SCALE: u64 = 0x100000000;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ArrivalKey {
    pub game_id: u32,
    pub entity_id: u32,
    pub day: u64,
    pub slot: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Arrival {
    pub resources: Span<ResourceAmount>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct OffloadArrival {
    pub entity_id: u32,
    pub day: u64,
    pub slot: u8,
    pub resource_count: u8,
}

pub fn has_arrived(key: ArrivalKey, interval: u64, timestamp: u64) -> bool {
    assert!(key.slot > 0 && key.slot <= SLOTS_PER_DAY, "invalid arrival slot");
    let tick = timestamp / interval;
    let previous = tick - 1;
    let day = previous / SLOTS_PER_DAY.into();
    let slot: u8 = (previous % SLOTS_PER_DAY.into() + 1).try_into().unwrap();
    key.day < day || (key.day == day && key.slot <= slot)
}

pub fn arrival_key(game_id: u32, entity_id: u32, interval: u64, timestamp: u64, travel_time: u64) -> ArrivalKey {
    let tick = (timestamp + travel_time) / interval;
    ArrivalKey {
        game_id,
        entity_id,
        day: tick / SLOTS_PER_DAY.into(),
        slot: (tick % SLOTS_PER_DAY.into() + 1).try_into().unwrap(),
    }
}

#[starknet::component]
pub mod ArrivalState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use crate::resources::ResourceAmount;
    use super::{Arrival, ArrivalKey, INDEX_SCALE, SLOTS_PER_DAY};

    #[storage]
    pub struct Storage {
        #[flat]
        pub data: games_storage::arrivals::ArrivalStateStorage<ResourceAmount>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn enqueue(ref self: ComponentState<TContractState>, key: ArrivalKey, values: Span<ResourceAmount>) {
            let storage_key = (key.game_id, key.entity_id, key.day, key.slot);
            let bounds = self.data.arrival_bounds.read(storage_key);
            let start: u32 = (bounds / INDEX_SCALE).try_into().unwrap();
            let mut count: u32 = (bounds % INDEX_SCALE).try_into().unwrap();
            let mut changed = false;
            for value in values {
                if *value.amount == 0 {
                    continue;
                }
                let mut index = start;
                while index < start + count {
                    let stored = self.data.arrival_items.read((key.game_id, key.entity_id, key.day, key.slot, index));
                    if stored.resource_type == *value.resource_type {
                        break;
                    }
                    index += 1;
                }
                let item = if index == start + count {
                    count += 1;
                    *value
                } else {
                    let stored = self.data.arrival_items.read((key.game_id, key.entity_id, key.day, key.slot, index));
                    ResourceAmount { amount: stored.amount + *value.amount, ..stored }
                };
                self.data.arrival_items.write((key.game_id, key.entity_id, key.day, key.slot, index), item);
                changed = true;
            }
            if changed {
                let updated = Into::<u32, u64>::into(start) * INDEX_SCALE + count.into();
                if updated != bounds {
                    self.data.arrival_bounds.write(storage_key, updated);
                }
                let mut keys = array![];
                key.serialize(ref keys);
                let mut values = array![];
                self.read(key).serialize(ref values);
                self.emit(RowSet { version: 1, model: 'ResourceArrival', keys: keys.span(), values: values.span() });
            }
        }
        fn read(self: @ComponentState<TContractState>, key: ArrivalKey) -> Arrival {
            assert!(key.slot > 0 && key.slot <= SLOTS_PER_DAY, "invalid arrival slot");
            let bounds = self.data.arrival_bounds.read((key.game_id, key.entity_id, key.day, key.slot));
            let start: u32 = (bounds / INDEX_SCALE).try_into().unwrap();
            let count: u32 = (bounds % INDEX_SCALE).try_into().unwrap();
            let mut resources = array![];
            for index in start..start + count {
                resources.append(self.data.arrival_items.read((key.game_id, key.entity_id, key.day, key.slot, index)));
            }
            Arrival { resources: resources.span() }
        }
        fn remove_prefix(ref self: ComponentState<TContractState>, key: ArrivalKey, count: u32) {
            if count == 0 {
                return;
            }
            let storage_key = (key.game_id, key.entity_id, key.day, key.slot);
            let bounds = self.data.arrival_bounds.read(storage_key);
            let start: u32 = (bounds / INDEX_SCALE).try_into().unwrap();
            let length: u32 = (bounds % INDEX_SCALE).try_into().unwrap();
            assert!(count <= length, "arrival prefix exceeds slot");
            let remaining = length - count;
            let bounds = if remaining == 0 {
                0
            } else {
                (start + count).into() * INDEX_SCALE + remaining.into()
            };
            self.data.arrival_bounds.write(storage_key, bounds);
            let mut keys = array![];
            key.serialize(ref keys);
            if remaining == 0 {
                self.emit(RowDeleted { version: 1, model: 'ResourceArrival', keys: keys.span() });
            } else {
                let mut values = array![];
                self.read(key).serialize(ref values);
                self.emit(RowSet { version: 1, model: 'ResourceArrival', keys: keys.span(), values: values.span() });
            }
        }
    }
}
