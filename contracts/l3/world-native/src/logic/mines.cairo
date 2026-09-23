use starknet::storage::StorageMapReadAccess;
use crate::mines::*;

pub fn kind(key: MineKindKey) -> MineKindConfig {
    assert!(crate::state::read().mines.mine_configured.read(key.game_id), "missing mine configuration");
    let config = crate::state::read().mines.mine_kinds.read((key.game_id, key.kind));
    assert!(config.production_rate != 0, "unknown mine kind");
    config
}
#[starknet::component]
pub mod MineState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::mines::{MineKindConfig, MineKindEntry, MineKindKey, MinePoolKey, MineWeight};

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
        fn configure(
            ref self: ComponentState<TContractState>,
            game_id: u32,
            kinds: Span<MineKindEntry>,
            surface: Span<MineWeight>,
        ) {
            assert!(!self.data.mines.mine_configured.read(game_id), "immutable mine configuration");
            assert!(!kinds.is_empty() && kinds.len() <= 255, "invalid mine kind count");
            let mut previous = 0_u8;
            for entry in kinds {
                assert!(*entry.kind > previous, "mine kinds must be ordered");
                previous = *entry.kind;
                let config = *entry.config;
                assert!(config.production_rate != 0, "zero mine production rate");
                assert!(config.cap_min != 0 && config.cap_steps != 0, "invalid mine cap bounds");
                assert!(
                    crate::buildings::produced_resource(config.building_category) == config.resource_type,
                    "mine building and resource differ",
                );
                assert!(config.resource_type != 0, "mine must produce a resource");
                let _ = config.cap_min * Into::<u32, u128>::into(config.cap_steps);
                self.data.mines.mine_kinds.write((game_id, *entry.kind), config);
                let mut values = array![];
                config.serialize(ref values);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'MineKindConfig',
                            keys: array![game_id.into(), (*entry.kind).into()].span(),
                            values: values.span(),
                        },
                    );
            }
            self.write_pool(MinePoolKey { game_id }, surface);
            self.data.mines.mine_configured.write(game_id, true);
        }
        fn kind(self: @ComponentState<TContractState>, key: MineKindKey) -> MineKindConfig {
            crate::logic::mines::kind(key)
        }
        fn pool(self: @ComponentState<TContractState>, key: MinePoolKey) -> Span<MineWeight> {
            assert!(self.data.mines.mine_configured.read(key.game_id), "missing mine configuration");
            let mut weights = array![];
            for index in 0..self.data.mines.mine_pool_count.read(key.game_id) {
                weights.append(self.data.mines.mine_weights.read((key.game_id, index)));
            }
            weights.span()
        }
        fn write_pool(ref self: ComponentState<TContractState>, key: MinePoolKey, weights: Span<MineWeight>) {
            let count: u8 = weights.len().try_into().expect('too many mine weights');
            let mut previous = 0_u8;
            for index in 0..count {
                let entry = *weights.at(index.into());
                assert!(entry.kind > previous, "mine weights must be ordered");
                previous = entry.kind;
                assert!(entry.weight != 0, "zero mine weight");
                assert!(
                    self.data.mines.mine_kinds.read((key.game_id, entry.kind)).production_rate != 0,
                    "unknown pooled mine",
                );
                self.data.mines.mine_weights.write((key.game_id, index), entry);
            }
            self.data.mines.mine_pool_count.write(key.game_id, count);
            let mut values = array![];
            weights.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'MinePool', keys: array![key.game_id.into()].span(), values: values.span(),
                    },
                );
        }
    }
}
