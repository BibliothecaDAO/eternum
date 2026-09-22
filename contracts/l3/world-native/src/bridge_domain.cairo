#[starknet::contract]
pub mod BridgeDomain {
    use starknet::ContractAddress;
    use crate::bridge::BridgeState;
    use crate::game::{IGameDispatcher, IGameDispatcherTrait};
    use crate::lifecycle::Lifecycle;
    use crate::withdrawals::WithdrawalState;
    component!(path: Lifecycle, storage: lifecycle, event: LifecycleEvent);
    component!(path: WithdrawalState, storage: withdrawals, event: WithdrawalEvent);
    component!(path: BridgeState, storage: bridge, event: BridgeEvent);
    #[abi(embed_v0)]
    impl Domain = Lifecycle::DomainImpl<ContractState>;
    impl LifeInternal = Lifecycle::InternalImpl<ContractState>;
    impl WithdrawalInternal = WithdrawalState::InternalImpl<ContractState>;
    #[abi(embed_v0)]
    impl Bridge = BridgeState::BridgeImpl<ContractState>;
    #[abi(embed_v0)]
    impl BankWithdrawal = BridgeState::BankWithdrawalImpl<ContractState>;
    #[storage]
    struct Storage {
        #[substorage(v0)]
        lifecycle: Lifecycle::Storage,
        #[substorage(v0)]
        withdrawals: WithdrawalState::Storage,
        #[substorage(v0)]
        bridge: BridgeState::Storage,
    }
    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        LifecycleEvent: Lifecycle::Event,
        WithdrawalEvent: WithdrawalState::Event,
        BridgeEvent: BridgeState::Event,
    }
    #[constructor]
    fn constructor(ref self: ContractState, authority: ContractAddress) {
        self.lifecycle.initialize(authority);
    }
    #[abi(embed_v0)]
    impl Withdrawals of crate::withdrawals::IWithdrawals<ContractState> {
        fn configure_withdrawals(
            ref self: ContractState,
            game_id: u32,
            rules: crate::withdrawals::WithdrawalRules,
            tokens: Span<crate::withdrawals::ResourceToken>,
        ) {
            self.lifecycle.assert_configurator();
            IGameDispatcher { contract_address: self.lifecycle.require_active().registry }.game(game_id);
            self.withdrawals.configure(game_id, rules, tokens);
        }
        fn withdrawal_rules(self: @ContractState, game_id: u32) -> crate::withdrawals::WithdrawalRules {
            self.withdrawals.rules(game_id)
        }
        fn resource_token(self: @ContractState, key: crate::market::MarketKey) -> ContractAddress {
            self.withdrawals.token(key)
        }
    }
}
