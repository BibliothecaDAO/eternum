#[starknet::component]
pub mod WithdrawalState {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use crate::withdrawals::{ResourceToken, WithdrawalRules, WithdrawalTerms};

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
            ref self: ComponentState<TContractState>, game_id: u32, rules: WithdrawalRules, tokens: Span<ResourceToken>,
        ) {
            assert!(
                self.data.withdrawals.terms.read(game_id).retention_count == 0, "withdrawal rules already configured",
            );
            assert!(!rules.retention.is_empty(), "missing withdrawal retention table");
            assert!(
                rules.velords_recipient != 0.try_into().unwrap() && rules.season_recipient != 0.try_into().unwrap(),
                "missing withdrawal fee recipient",
            );
            let fees: u32 = rules.bank_fee_bps.into()
                + rules.velords_fee_bps.into()
                + rules.season_fee_bps.into()
                + rules.client_fee_bps.into();
            assert!(fees <= 10000, "withdrawal fees exceed amount");
            for index in 0..rules.retention.len() {
                let retention = *rules.retention.at(index);
                assert!(
                    retention.troop_percent <= 100 && retention.resource_percent <= 100, "invalid withdrawal retention",
                );
                self.data.withdrawals.retention.write((game_id, index), retention);
            }
            self
                .data
                .withdrawals
                .terms
                .write(
                    game_id,
                    WithdrawalTerms {
                        paused: rules.paused,
                        bank_fee_bps: rules.bank_fee_bps,
                        velords_fee_bps: rules.velords_fee_bps,
                        season_fee_bps: rules.season_fee_bps,
                        client_fee_bps: rules.client_fee_bps,
                        velords_recipient: rules.velords_recipient,
                        season_recipient: rules.season_recipient,
                        retention_count: rules.retention.len(),
                    },
                );
            let mut values = array![];
            rules.serialize(ref values);
            self
                .emit(
                    RowSet {
                        version: 1,
                        model: 'WithdrawalRules',
                        keys: array![game_id.into()].span(),
                        values: values.span(),
                    },
                );
            for token in tokens {
                assert!(
                    *token.resource_type > 0 && *token.resource_type <= 58 && *token.token != 0.try_into().unwrap(),
                    "invalid resource token",
                );
                assert!(
                    self.data.withdrawals.tokens.read((game_id, *token.resource_type)) == 0.try_into().unwrap(),
                    "duplicate resource token",
                );
                self.data.withdrawals.tokens.write((game_id, *token.resource_type), *token.token);
                self
                    .emit(
                        RowSet {
                            version: 1,
                            model: 'ResourceToken',
                            keys: array![game_id.into(), (*token.resource_type).into()].span(),
                            values: array![(*token.token).into()].span(),
                        },
                    );
            }
        }
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> WithdrawalRules {
            let terms = self.data.withdrawals.terms.read(game_id);
            assert!(terms.retention_count != 0, "missing withdrawal rules");
            let mut retention = array![];
            for index in 0..terms.retention_count {
                retention.append(self.data.withdrawals.retention.read((game_id, index)));
            }
            WithdrawalRules {
                paused: terms.paused,
                bank_fee_bps: terms.bank_fee_bps,
                velords_fee_bps: terms.velords_fee_bps,
                season_fee_bps: terms.season_fee_bps,
                client_fee_bps: terms.client_fee_bps,
                velords_recipient: terms.velords_recipient,
                season_recipient: terms.season_recipient,
                retention: retention.span(),
            }
        }
        fn token(self: @ComponentState<TContractState>, key: crate::market::MarketKey) -> ContractAddress {
            let token = self.data.withdrawals.tokens.read((key.game_id, key.resource_type));
            assert!(token != 0.try_into().unwrap(), "resource is not whitelisted");
            token
        }
        fn retained_amount(
            self: @ComponentState<TContractState>, game_id: u32, resource_type: u8, amount: u128, completed: u32,
        ) -> u128 {
            self.retained_tokens(game_id, resource_type, amount.into(), completed).try_into().unwrap()
        }
        fn retained_tokens(
            self: @ComponentState<TContractState>, game_id: u32, resource_type: u8, amount: u256, completed: u32,
        ) -> u256 {
            if resource_type == crate::resources::LORDS {
                return amount;
            }
            let count = self.data.withdrawals.terms.read(game_id).retention_count;
            assert!(count != 0, "missing withdrawal rules");
            let rate = self.data.withdrawals.retention.read((game_id, core::cmp::min(completed, count - 1)));
            let percent: u256 = if crate::resources::is_troop_resource(resource_type) {
                rate.troop_percent.into()
            } else {
                rate.resource_percent.into()
            };
            amount - amount * (100 - percent) / 100
        }
    }
}
