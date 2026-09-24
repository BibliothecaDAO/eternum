use starknet::storage::StorageMapReadAccess;
use crate::mines::*;

pub fn kind(key: MineKindKey) -> MineKindConfig {
    let config = crate::logic::preset_record::for_game(key.game_id).mine_kinds.read(key.kind);
    assert!(config.production_rate != 0, "unknown mine kind");
    config
}
#[starknet::component]
pub mod MineState {
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use crate::events::RowSet;
    use crate::mines::{MineKindConfig, MineKindKey, MinePoolKey, MineWeight};

    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    pub struct Storage {
        #[flat]
        pub data: crate::state::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RowSet: RowSet,
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn kind(self: @ComponentState<TContractState>, key: MineKindKey) -> MineKindConfig {
            crate::logic::mines::kind(key)
        }
        fn pool(self: @ComponentState<TContractState>, key: MinePoolKey) -> Span<MineWeight> {
            let preset = crate::logic::preset_record::for_game(key.game_id);
            let mut weights = array![];
            for index in 0..preset.mine_pool_count.read() {
                weights.append(preset.mine_weights.read(index));
            }
            weights.span()
        }
    }
}
