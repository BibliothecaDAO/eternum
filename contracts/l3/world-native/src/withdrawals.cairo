use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Retention {
    pub troop_percent: u8,
    pub resource_percent: u8,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WithdrawalRules {
    pub paused: bool,
    pub bank_fee_bps: u16,
    pub velords_fee_bps: u16,
    pub season_fee_bps: u16,
    pub client_fee_bps: u16,
    pub velords_recipient: ContractAddress,
    pub season_recipient: ContractAddress,
    pub retention: Span<Retention>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct WithdrawalTerms {
    pub paused: bool,
    pub bank_fee_bps: u16,
    pub velords_fee_bps: u16,
    pub season_fee_bps: u16,
    pub client_fee_bps: u16,
    pub velords_recipient: ContractAddress,
    pub season_recipient: ContractAddress,
    pub retention_count: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ResourceToken {
    pub resource_type: u8,
    pub token: ContractAddress,
}
#[starknet::interface]
pub trait IWithdrawals<T> {
    fn configure_withdrawals(ref self: T, game_id: u32, rules: WithdrawalRules, tokens: Span<ResourceToken>);
    fn withdrawal_rules(self: @T, game_id: u32) -> WithdrawalRules;
    fn resource_token(self: @T, key: crate::market::MarketKey) -> ContractAddress;
}
#[starknet::interface]
pub trait IResourceToken<T> {
    fn decimals(self: @T) -> u8;
    fn balance_of(self: @T, account: ContractAddress) -> u256;
    fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
    fn mint(ref self: T, recipient: ContractAddress, amount: u256);
}
fn token_scale(token: ContractAddress) -> u256 {
    let decimals = IResourceTokenDispatcher { contract_address: token }.decimals();
    let mut scale: u256 = 1;
    for _ in 0_u8..decimals {
        scale *= 10;
    }
    scale
}
pub fn token_amount(token: ContractAddress, amount: u128) -> u256 {
    amount.into() * token_scale(token) / crate::rules::RESOURCE_PRECISION.into()
}
pub fn resource_amount(token: ContractAddress, amount: u256) -> u128 {
    (amount * crate::rules::RESOURCE_PRECISION.into() / token_scale(token)).try_into().unwrap()
}
pub fn transfer_or_mint(token: ContractAddress, recipient: ContractAddress, amount: u256) {
    let token = IResourceTokenDispatcher { contract_address: token };
    if token.balance_of(starknet::get_contract_address()) < amount {
        token.mint(recipient, amount);
    } else {
        assert!(token.transfer(recipient, amount), "resource token transfer failed");
    }
}
#[starknet::component]
pub mod WithdrawalState {
    use starknet::ContractAddress;
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess};
    use crate::events::RowSet;
    use super::{ResourceToken, Retention, WithdrawalRules, WithdrawalTerms};
    #[storage]
    pub struct Storage {
        pub terms: Map<u32, WithdrawalTerms>,
        pub retention: Map<(u32, u32), Retention>,
        pub tokens: Map<(u32, u8), ContractAddress>,
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
            assert!(self.terms.read(game_id).retention_count == 0, "withdrawal rules already configured");
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
                self.retention.write((game_id, index), retention);
            }
            self
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
                    self.tokens.read((game_id, *token.resource_type)) == 0.try_into().unwrap(),
                    "duplicate resource token",
                );
                self.tokens.write((game_id, *token.resource_type), *token.token);
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
            let terms = self.terms.read(game_id);
            assert!(terms.retention_count != 0, "missing withdrawal rules");
            let mut retention = array![];
            for index in 0..terms.retention_count {
                retention.append(self.retention.read((game_id, index)));
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
            let token = self.tokens.read((key.game_id, key.resource_type));
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
            let count = self.terms.read(game_id).retention_count;
            assert!(count != 0, "missing withdrawal rules");
            let rate = self.retention.read((game_id, core::cmp::min(completed, count - 1)));
            let percent: u256 = if crate::resources::is_troop_resource(resource_type) {
                rate.troop_percent.into()
            } else {
                rate.resource_percent.into()
            };
            amount - amount * (100 - percent) / 100
        }
    }
}
