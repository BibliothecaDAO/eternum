#[starknet::component]
pub mod MarketState {
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::{RowDeleted, RowSet};
    use crate::market::{BankRules, LiquidityKey, Market, MarketKey};

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
        RowDeleted: RowDeleted,
    }
    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn configure(ref self: ComponentState<TContractState>, game_id: u32, rules: BankRules) {
            assert!(!self.data.market.bank_rules_configured.read(game_id), "bank rules already configured");
            assert!(
                rules.lp_fee_num < rules.lp_fee_denom
                    && rules.owner_fee_num <= rules.owner_fee_denom
                    && rules.owner_fee_denom != 0,
                "invalid bank fee ratio",
            );
            self.data.market.bank_rules_configured.write(game_id, true);
            self.data.market.bank_rules.write(game_id, rules);
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1, model: 'BankRules', keys: array![game_id.into()].span(), values: values.span(),
                    },
                );
        }
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> BankRules {
            assert!(self.data.market.bank_rules_configured.read(game_id), "missing bank rules");
            self.data.market.bank_rules.read(game_id)
        }
        fn market(self: @ComponentState<TContractState>, key: MarketKey) -> Market {
            self.data.market.markets.read((key.game_id, key.resource_type))
        }
        fn write_market(ref self: ComponentState<TContractState>, key: MarketKey, market: Market) {
            self.data.market.markets.write((key.game_id, key.resource_type), market);
            let mut values = array![];
            market.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'Market',
                        keys: array![key.game_id.into(), key.resource_type.into()].span(),
                        values: values.span(),
                    },
                );
        }
        fn shares(self: @ComponentState<TContractState>, key: LiquidityKey) -> u128 {
            self.data.market.liquidity.read((key.game_id, key.owner, key.resource_type))
        }
        fn write_shares(ref self: ComponentState<TContractState>, key: LiquidityKey, shares: u128) {
            self.data.market.liquidity.write((key.game_id, key.owner, key.resource_type), shares);
            let mut keys = array![];
            key.serialize(ref keys);
            if shares == 0 {
                self.emit(RowDeleted { version: 1, model: 'Liquidity', keys: keys.span() });
            } else {
                self
                    .emit(
                        RowSet {
                            version: 1, model: 'Liquidity', keys: keys.span(), values: array![shares.into()].span(),
                        },
                    );
            }
        }
        fn name_bank(ref self: ComponentState<TContractState>, key: crate::resources::ResourceKey, name: felt252) {
            self.data.market.bank_names.write((key.game_id, key.entity_id), name);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'BankName',
                        keys: array![key.game_id.into(), key.entity_id.into()].span(),
                        values: array![name].span(),
                    },
                );
        }
    }
}
