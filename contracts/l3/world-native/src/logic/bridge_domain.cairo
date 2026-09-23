#[starknet::contract]
pub mod BridgeLogic {
    #[cfg(test)]
    use starknet::ContractAddress;
    use crate::logic::bridge::BridgeState;
    use crate::logic::release::ReleaseState;
    use crate::logic::withdrawals::WithdrawalState;
    component!(path: ReleaseState, storage: release, event: ReleaseEvent);
    component!(path: WithdrawalState, storage: withdrawals, event: WithdrawalEvent);
    component!(path: BridgeState, storage: bridge, event: BridgeEvent);
    impl LifeInternal = ReleaseState::InternalImpl<ContractState>;
    impl WithdrawalInternal = WithdrawalState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Bridge = BridgeState::BridgeImpl<ContractState>;
    #[abi(embed_v0)]
    impl BankWithdrawal = BridgeState::BankWithdrawalImpl<ContractState>;
    #[storage]
    #[allow(starknet::colliding_storage_paths)]
    struct Storage {
        #[substorage(v0)]
        release: ReleaseState::Storage,
        #[substorage(v0)]
        withdrawals: WithdrawalState::Storage,
        #[substorage(v0)]
        bridge: BridgeState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        ReleaseEvent: ReleaseState::Event,
        WithdrawalEvent: WithdrawalState::Event,
        BridgeEvent: BridgeState::Event,
    }
    #[abi(embed_v0)]
    impl Withdrawals of crate::withdrawals::IWithdrawals<ContractState> {
        fn configure_withdrawals(
            ref self: ContractState,
            game_id: u32,
            rules: crate::withdrawals::WithdrawalRules,
            tokens: Span<crate::withdrawals::ResourceToken>,
        ) {
            crate::logic::release::assert_authority();
            crate::logic::game::game(game_id);
            self.withdrawals.configure(game_id, rules, tokens);
        }
        #[cfg(test)]
        fn withdrawal_rules(self: @ContractState, game_id: u32) -> crate::withdrawals::WithdrawalRules {
            self.withdrawals.rules(game_id)
        }
        #[cfg(test)]
        fn resource_token(self: @ContractState, key: crate::market::MarketKey) -> ContractAddress {
            self.withdrawals.token(key)
        }
    }
}
