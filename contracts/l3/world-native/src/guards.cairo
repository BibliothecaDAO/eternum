use crate::troops::Troops;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct GuardKey {
    pub game_id: u32,
    pub structure_id: u32,
    pub slot: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub struct Guard {
    pub troops: Troops,
    pub destroyed_tick: u32,
}
#[starknet::interface]
pub trait IGuardCombat<T> {
    fn battle_guard(
        ref self: T,
        game_id: u32,
        actor: starknet::ContractAddress,
        command: crate::commands::Battle,
        context: crate::commands::ExecutionContext,
    );
}
#[starknet::interface]
pub trait IStructureCapture<T> {
    fn capture_structure(ref self: T, key: crate::resources::ResourceKey, capturing_home: u32, timestamp: u64);
}
#[starknet::interface]
pub trait IGuards<T> {
    fn guard(self: @T, key: GuardKey) -> Guard;
    fn initialize_structure_guards(ref self: T, key: crate::resources::ResourceKey, seed: u256, timestamp: u64);
    fn add_starting_guard(
        ref self: T,
        key: crate::resources::ResourceKey,
        category: crate::troops::TroopType,
        amount: u128,
        timestamp: u64,
    );
}

#[starknet::component]
pub mod GuardState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use crate::resources::ResourceKey;
    use super::{Guard, GuardKey};
    #[storage]
    pub struct Storage {
        pub guards: Map<(u32, u32, u8), Guard>,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn guard(self: @ComponentState<TContractState>, key: GuardKey) -> Guard {
            assert!(key.slot < 4, "invalid guard slot");
            self.guards.read((key.game_id, key.structure_id, key.slot))
        }
        fn save(ref self: ComponentState<TContractState>, key: GuardKey, guard: Guard) {
            if self.guard(key) == guard {
                return;
            }
            self.guards.write((key.game_id, key.structure_id, key.slot), guard);
            let mut keys = array![];
            key.serialize(ref keys);
            let mut values = array![];
            guard.serialize(ref values);
            if guard == Default::default() {
                self.emit(RowDeleted { version: 1, model: 'Guard', keys: keys.span() });
            } else {
                self.emit(RowSet { version: 1, model: 'Guard', keys: keys.span(), values: values.span() });
            }
        }
        fn reset(ref self: ComponentState<TContractState>, key: ResourceKey) {
            for slot in 0_u8..4 {
                self.save(GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot }, Default::default());
            }
        }
        // Delta is slot zero; the outermost functional guard is attacked first.
        fn next(self: @ComponentState<TContractState>, key: ResourceKey, maximum: u8) -> Option<GuardKey> {
            assert!(maximum > 0 && maximum <= 4, "invalid guard slot limit");
            let mut slot = maximum;
            while slot != 0 {
                slot -= 1;
                let guard_key = GuardKey { game_id: key.game_id, structure_id: key.entity_id, slot };
                if self.guard(guard_key).troops.count != 0 {
                    return Some(guard_key);
                }
            }
            None
        }
    }
}
