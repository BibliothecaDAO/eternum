#[starknet::component]
pub mod WithdrawalState {
    use starknet::ContractAddress;
    use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
    use crate::events::RowSet;
    use crate::withdrawals::WithdrawalRules;

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
        fn rules(self: @ComponentState<TContractState>, game_id: u32) -> WithdrawalRules {
            let preset = crate::logic::preset_record::for_game(game_id);
            let terms = preset.withdrawal_terms.read();
            assert!(terms.retention_count != 0, "missing withdrawal rules");
            let mut retention = array![];
            for index in 0..terms.retention_count {
                retention.append(preset.withdrawal_retention.read(index));
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
            let token = crate::logic::preset_record::for_game(key.game_id).withdrawal_tokens.read(key.resource_type);
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
            let preset = crate::logic::preset_record::for_game(game_id);
            let count = preset.withdrawal_terms.read().retention_count;
            assert!(count != 0, "missing withdrawal rules");
            let rate = preset.withdrawal_retention.read(core::cmp::min(completed, count - 1));
            let percent: u256 = if crate::resources::is_troop_resource(resource_type) {
                rate.troop_percent.into()
            } else {
                rate.resource_percent.into()
            };
            amount - amount * (100 - percent) / 100
        }
    }
}
