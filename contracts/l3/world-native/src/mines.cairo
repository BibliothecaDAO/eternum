#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MineKindKey {
    pub game_id: u32,
    pub kind: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MinePoolKey {
    pub game_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct MineKindConfig {
    pub resource_type: u8,
    pub building_category: u8,
    pub production_rate: u64,
    pub cap_min: u128,
    pub cap_steps: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MineKindEntry {
    pub kind: u8,
    pub config: MineKindConfig,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct MineWeight {
    pub kind: u8,
    pub weight: u32,
}

#[starknet::interface]
pub trait IMineRules<T> {
    fn configure_mines(ref self: T, game_id: u32, kinds: Span<MineKindEntry>, surface: Span<MineWeight>);
    fn mine_kind(self: @T, key: MineKindKey) -> MineKindConfig;
    fn mine_pool(self: @T, key: MinePoolKey) -> Span<MineWeight>;
    fn mine_draw(self: @T, key: MinePoolKey, seed: u256) -> (u8, MineKindConfig, u128);
}

pub fn select_kind(weights: Span<MineWeight>, seed: u256) -> u8 {
    let mut total = 0_u128;
    for entry in weights {
        total += Into::<u32, u128>::into(*entry.weight);
    }
    assert!(total != 0, "mine discovery pool is empty");
    let mut roll = crate::random::range(seed, 'MINE_KIND', total);
    for entry in weights {
        let weight: u128 = (*entry.weight).into();
        if roll < weight {
            return *entry.kind;
        }
        roll -= weight;
    }
    panic!("invalid mine pool");
}

pub fn cap(config: MineKindConfig, seed: u256) -> u128 {
    config.cap_min * (1 + crate::random::range(seed, 124, config.cap_steps.into()))
}

#[starknet::component]
pub mod MineState {
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use super::{MineKindConfig, MineKindEntry, MineKindKey, MinePoolKey, MineWeight};

    #[storage]
    pub struct Storage {
        pub mine_configured: Map<u32, bool>,
        pub mine_kinds: Map<(u32, u8), MineKindConfig>,
        pub mine_pool_count: Map<u32, u8>,
        pub mine_weights: Map<(u32, u8), MineWeight>,
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
            assert!(!self.mine_configured.read(game_id), "immutable mine configuration");
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
                self.mine_kinds.write((game_id, *entry.kind), config);
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
            self.mine_configured.write(game_id, true);
        }
        fn kind(self: @ComponentState<TContractState>, key: MineKindKey) -> MineKindConfig {
            assert!(self.mine_configured.read(key.game_id), "missing mine configuration");
            let config = self.mine_kinds.read((key.game_id, key.kind));
            assert!(config.production_rate != 0, "unknown mine kind");
            config
        }
        fn pool(self: @ComponentState<TContractState>, key: MinePoolKey) -> Span<MineWeight> {
            assert!(self.mine_configured.read(key.game_id), "missing mine configuration");
            let mut weights = array![];
            for index in 0..self.mine_pool_count.read(key.game_id) {
                weights.append(self.mine_weights.read((key.game_id, index)));
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
                assert!(self.mine_kinds.read((key.game_id, entry.kind)).production_rate != 0, "unknown pooled mine");
                self.mine_weights.write((key.game_id, index), entry);
            }
            self.mine_pool_count.write(key.game_id, count);
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
