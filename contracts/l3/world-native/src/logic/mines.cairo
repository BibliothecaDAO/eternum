use crate::mines::*;

pub fn kind(key: MineKindKey) -> MineKindConfig {
    let kinds = crate::balance::resources::MINE_KINDS.span();
    assert!(key.kind != 0 && key.kind.into() <= kinds.len(), "unknown mine kind");
    *kinds.at(key.kind.into() - 1)
}
#[starknet::component]
pub mod MineState {
    use crate::events::RowSet;
    use crate::mines::{MineKindConfig, MineKindKey, MineWeight};

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
        fn pool(self: @ComponentState<TContractState>) -> Span<MineWeight> {
            crate::balance::resources::SURFACE_MINES.span()
        }
    }
}
