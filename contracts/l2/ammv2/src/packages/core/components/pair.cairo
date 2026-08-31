#[starknet::component]
pub mod PairComponent {
    // NOTE: RealmsSwap intentionally diverges from classic Uniswap v2 here.
    // Protocol fee minting is tuned to capture 1/3 of fee growth instead of 1/6.
    // Example: with a 1.5% total swap fee, this targets roughly 0.5% to protocol
    // and 1.0% remaining to LPs, still paid out later as LP minting.
    // see `let denominator = root_k * math::TWO + root_k_last` below
    use ammv2::packages::core::interfaces::callee::{IRealmsSwapCalleeDispatcher, IRealmsSwapCalleeDispatcherTrait};
    use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
    use ammv2::packages::core::interfaces::pair::IRealmsSwapPair;
    use ammv2::packages::core::utils::{erc20, math};
    use core::num::traits::Zero;
    use openzeppelin::security::reentrancyguard::ReentrancyGuardComponent;
    use openzeppelin::security::reentrancyguard::ReentrancyGuardComponent::InternalImpl as ReentrancyGuardInternalImpl;
    use openzeppelin::token::erc20::ERC20Component;
    use openzeppelin::token::erc20::ERC20Component::InternalImpl as ERC20InternalImpl;
    use openzeppelin::token::erc20::interface::IERC20;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address, get_contract_address};

    #[storage]
    pub struct Storage {
        pub token0: ContractAddress,
        pub token1: ContractAddress,
        pub reserve0: u256,
        pub reserve1: u256,
        pub block_timestamp_last: u64,
        pub price_0_cumulative_last: u256,
        pub price_1_cumulative_last: u256,
        pub k_last: u256,
        pub factory: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Mint: Mint,
        Burn: Burn,
        Swap: Swap,
        Sync: Sync,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Mint {
        #[key]
        pub sender: ContractAddress,
        pub amount0: u256,
        pub amount1: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Burn {
        #[key]
        pub sender: ContractAddress,
        pub amount0: u256,
        pub amount1: u256,
        #[key]
        pub to: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Swap {
        #[key]
        pub sender: ContractAddress,
        pub amount0_in: u256,
        pub amount1_in: u256,
        pub amount0_out: u256,
        pub amount1_out: u256,
        #[key]
        pub to: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Sync {
        pub reserve0: u256,
        pub reserve1: u256,
    }

    #[embeddable_as(PairImpl)]
    pub impl Pair<
        TContractState,
        +HasComponent<TContractState>,
        impl ERC20: ERC20Component::HasComponent<TContractState>,
        +ERC20Component::ERC20HooksTrait<TContractState>,
        impl ReentrancyGuard: ReentrancyGuardComponent::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of IRealmsSwapPair<ComponentState<TContractState>> {
        fn factory(self: @ComponentState<TContractState>) -> ContractAddress {
            self.factory.read()
        }

        fn token0(self: @ComponentState<TContractState>) -> ContractAddress {
            self.token0.read()
        }

        fn token1(self: @ComponentState<TContractState>) -> ContractAddress {
            self.token1.read()
        }

        fn get_reserves(self: @ComponentState<TContractState>) -> (u256, u256, u64) {
            (self.reserve0.read(), self.reserve1.read(), self.block_timestamp_last.read())
        }

        fn price_0_cumulative_last(self: @ComponentState<TContractState>) -> u256 {
            self.price_0_cumulative_last.read()
        }

        fn price_1_cumulative_last(self: @ComponentState<TContractState>) -> u256 {
            self.price_1_cumulative_last.read()
        }

        fn klast(self: @ComponentState<TContractState>) -> u256 {
            self.k_last.read()
        }

        fn mint(ref self: ComponentState<TContractState>, to: ContractAddress) -> u256 {
            let mut reentrancy_guard = get_dep_component_mut!(ref self, ReentrancyGuard);
            reentrancy_guard.start();

            let reserve0 = self.reserve0.read();
            let reserve1 = self.reserve1.read();
            let (balance0, balance1) = current_balances(@self);
            let amount0 = balance0 - reserve0;
            let amount1 = balance1 - reserve1;

            let fee_on = mint_protocol_fee(ref self, reserve0, reserve1);
            let total_supply = total_supply(@self);

            let liquidity = if total_supply == 0 {
                let sqrt_liquidity = math::sqrt(amount0 * amount1);
                assert!(
                    sqrt_liquidity > math::MINIMUM_LIQUIDITY, "RealmsSwap::Pair::mint::insufficient liquidity minted",
                );
                mint_lp(ref self, math::burn_address(), math::MINIMUM_LIQUIDITY);
                sqrt_liquidity - math::MINIMUM_LIQUIDITY
            } else {
                let liquidity0 = (amount0 * total_supply) / reserve0;
                let liquidity1 = (amount1 * total_supply) / reserve1;
                math::min(liquidity0, liquidity1)
            };

            assert!(liquidity > 0, "RealmsSwap::Pair::mint::insufficient liquidity minted");

            mint_lp(ref self, to, liquidity);
            update_reserves(ref self, balance0, balance1, reserve0, reserve1);

            if fee_on {
                self.k_last.write(balance0 * balance1);
            }

            self.emit(Mint { sender: get_caller_address(), amount0, amount1 });
            reentrancy_guard.end();

            liquidity
        }

        fn burn(ref self: ComponentState<TContractState>, to: ContractAddress) -> (u256, u256) {
            let mut reentrancy_guard = get_dep_component_mut!(ref self, ReentrancyGuard);
            reentrancy_guard.start();

            let reserve0 = self.reserve0.read();
            let reserve1 = self.reserve1.read();
            let (balance0, balance1) = current_balances(@self);
            let liquidity = lp_balance_of_self(@self);

            let fee_on = mint_protocol_fee(ref self, reserve0, reserve1);
            let total_supply = total_supply(@self);
            assert!(total_supply > 0, "RealmsSwap::Pair::burn::insufficient liquidity burned");

            let amount0 = (liquidity * balance0) / total_supply;
            let amount1 = (liquidity * balance1) / total_supply;
            assert!(amount0 > 0 && amount1 > 0, "RealmsSwap::Pair::burn::insufficient liquidity burned");

            burn_lp(ref self, get_contract_address(), liquidity);
            erc20::transfer(self.token0.read(), to, amount0);
            erc20::transfer(self.token1.read(), to, amount1);

            let (final_balance0, final_balance1) = current_balances(@self);
            update_reserves(ref self, final_balance0, final_balance1, reserve0, reserve1);

            if fee_on {
                self.k_last.write(final_balance0 * final_balance1);
            }

            self.emit(Burn { sender: get_caller_address(), amount0, amount1, to });
            reentrancy_guard.end();

            (amount0, amount1)
        }

        fn swap(
            ref self: ComponentState<TContractState>,
            amount0_out: u256,
            amount1_out: u256,
            to: ContractAddress,
            data: Span<felt252>,
        ) {
            let mut reentrancy_guard = get_dep_component_mut!(ref self, ReentrancyGuard);
            reentrancy_guard.start();

            assert!(amount0_out > 0 || amount1_out > 0, "RealmsSwap::Pair::swap::insufficient output amount");

            let reserve0 = self.reserve0.read();
            let reserve1 = self.reserve1.read();
            assert!(amount0_out < reserve0 && amount1_out < reserve1, "RealmsSwap::Pair::swap::insufficient liquidity");

            let token0 = self.token0.read();
            let token1 = self.token1.read();
            assert!(to != token0 && to != token1, "RealmsSwap::Pair::swap::invalid to");

            if amount0_out > 0 {
                erc20::transfer(token0, to, amount0_out);
            }
            if amount1_out > 0 {
                erc20::transfer(token1, to, amount1_out);
            }

            if data.len() > 0 {
                IRealmsSwapCalleeDispatcher { contract_address: to }
                    .swap_callback(get_caller_address(), amount0_out, amount1_out, data);
            }

            let (balance0, balance1) = current_balances(@self);
            let expected_balance0 = reserve0 - amount0_out;
            let expected_balance1 = reserve1 - amount1_out;
            assert!(
                balance0 > expected_balance0 || balance1 > expected_balance1,
                "RealmsSwap::Pair::swap::insufficient input amount",
            );

            let amount0_in = balance0 - expected_balance0;
            let amount1_in = balance1 - expected_balance1;
            let fee_amount = IRealmsSwapFactoryDispatcher { contract_address: self.factory.read() }.get_fee_amount();
            let fee_units = math::fee_units(fee_amount);

            let balance0_adjusted = balance0 * math::THOUSAND - amount0_in * fee_units;
            let balance1_adjusted = balance1 * math::THOUSAND - amount1_in * fee_units;
            let invariant_lhs = balance0_adjusted * balance1_adjusted;
            let invariant_rhs = reserve0 * reserve1 * math::MILLION;
            assert!(invariant_lhs >= invariant_rhs, "RealmsSwap::Pair::swap::invariant K");

            update_reserves(ref self, balance0, balance1, reserve0, reserve1);

            self.emit(Swap { sender: get_caller_address(), amount0_in, amount1_in, amount0_out, amount1_out, to });
            reentrancy_guard.end();
        }

        fn skim(ref self: ComponentState<TContractState>, to: ContractAddress) {
            let mut reentrancy_guard = get_dep_component_mut!(ref self, ReentrancyGuard);
            reentrancy_guard.start();

            let reserve0 = self.reserve0.read();
            let reserve1 = self.reserve1.read();
            let (balance0, balance1) = current_balances(@self);
            let amount0 = balance0 - reserve0;
            let amount1 = balance1 - reserve1;
            assert!(amount0 > 0 && amount1 > 0, "RealmsSwap::Pair::skim::insufficient surplus");

            erc20::transfer(self.token0.read(), to, amount0);
            erc20::transfer(self.token1.read(), to, amount1);

            reentrancy_guard.end();
        }

        fn sync(ref self: ComponentState<TContractState>) {
            let mut reentrancy_guard = get_dep_component_mut!(ref self, ReentrancyGuard);
            reentrancy_guard.start();

            let reserve0 = self.reserve0.read();
            let reserve1 = self.reserve1.read();
            let (balance0, balance1) = current_balances(@self);
            update_reserves(ref self, balance0, balance1, reserve0, reserve1);

            reentrancy_guard.end();
        }
    }

    #[generate_trait]
    pub impl InternalImpl<
        TContractState,
        +HasComponent<TContractState>,
        impl ERC20: ERC20Component::HasComponent<TContractState>,
        +ERC20Component::ERC20HooksTrait<TContractState>,
        impl ReentrancyGuard: ReentrancyGuardComponent::HasComponent<TContractState>,
        +Drop<TContractState>,
    > of InternalTrait<TContractState> {
        fn initializer(
            ref self: ComponentState<TContractState>,
            token0: ContractAddress,
            token1: ContractAddress,
            factory: ContractAddress,
        ) {
            assert!(
                !token0.is_zero() && !token1.is_zero() && !factory.is_zero(),
                "RealmsSwap::Pair::constructor::all arguments must be non zero",
            );
            self.token0.write(token0);
            self.token1.write(token1);
            self.factory.write(factory);
        }
    }

    fn current_balances<TContractState, +HasComponent<TContractState>>(
        self: @ComponentState<TContractState>,
    ) -> (u256, u256) {
        let self_address = get_contract_address();
        let balance0 = erc20::balance_of_compatible(self.token0.read(), self_address);
        let balance1 = erc20::balance_of_compatible(self.token1.read(), self_address);
        (balance0, balance1)
    }

    fn total_supply<
        TContractState,
        +HasComponent<TContractState>,
        impl ERC20: ERC20Component::HasComponent<TContractState>,
        +ERC20Component::ERC20HooksTrait<TContractState>,
        +Drop<TContractState>,
    >(
        self: @ComponentState<TContractState>,
    ) -> u256 {
        let erc20 = get_dep_component!(self, ERC20);
        erc20.total_supply()
    }

    fn lp_balance_of_self<
        TContractState,
        +HasComponent<TContractState>,
        impl ERC20: ERC20Component::HasComponent<TContractState>,
        +ERC20Component::ERC20HooksTrait<TContractState>,
        +Drop<TContractState>,
    >(
        self: @ComponentState<TContractState>,
    ) -> u256 {
        let erc20 = get_dep_component!(self, ERC20);
        erc20.balance_of(get_contract_address())
    }

    fn mint_lp<
        TContractState,
        +HasComponent<TContractState>,
        impl ERC20: ERC20Component::HasComponent<TContractState>,
        +ERC20Component::ERC20HooksTrait<TContractState>,
        +Drop<TContractState>,
    >(
        ref self: ComponentState<TContractState>, recipient: ContractAddress, amount: u256,
    ) {
        let mut erc20 = get_dep_component_mut!(ref self, ERC20);
        erc20.mint(recipient, amount);
    }

    fn burn_lp<
        TContractState,
        +HasComponent<TContractState>,
        impl ERC20: ERC20Component::HasComponent<TContractState>,
        +ERC20Component::ERC20HooksTrait<TContractState>,
        +Drop<TContractState>,
    >(
        ref self: ComponentState<TContractState>, account: ContractAddress, amount: u256,
    ) {
        let mut erc20 = get_dep_component_mut!(ref self, ERC20);
        erc20.burn(account, amount);
    }

    fn mint_protocol_fee<
        TContractState,
        +HasComponent<TContractState>,
        impl ERC20: ERC20Component::HasComponent<TContractState>,
        +ERC20Component::ERC20HooksTrait<TContractState>,
        impl ReentrancyGuard: ReentrancyGuardComponent::HasComponent<TContractState>,
        +Drop<TContractState>,
    >(
        ref self: ComponentState<TContractState>, reserve0: u256, reserve1: u256,
    ) -> bool {
        let fee_to = IRealmsSwapFactoryDispatcher { contract_address: self.factory.read() }.get_fee_to();
        let fee_on = !fee_to.is_zero();
        let k_last = self.k_last.read();

        if fee_on {
            if k_last != 0 {
                let root_k = math::sqrt(reserve0 * reserve1);
                let root_k_last = math::sqrt(k_last);
                if root_k > root_k_last {
                    let numerator = (root_k - root_k_last) * total_supply(@self);
                    // Original Uniswap v2 1/6 protocol-capture line:
                    // let denominator = root_k * math::FIVE + root_k_last;
                    // RealmsSwap changes this to roughly 1/3 of fee growth.
                    // Example: at 1.5% total swap fee, this targets roughly 0.5% protocol
                    // and 1.0% remaining for LPs, realized later via LP minting.
                    // To retune later, change the coefficient here:
                    // N = 5 => about 1/6 to protocol, N = 2 => about 1/3 to protocol.
                    let denominator = root_k * math::TWO + root_k_last;
                    let liquidity = numerator / denominator;
                    if liquidity > 0 {
                        mint_lp(ref self, fee_to, liquidity);
                    }
                }
            }
        } else if k_last != 0 {
            self.k_last.write(0);
        }

        fee_on
    }

    fn update_reserves<TContractState, +HasComponent<TContractState>>(
        ref self: ComponentState<TContractState>, balance0: u256, balance1: u256, reserve0: u256, reserve1: u256,
    ) {
        assert!(balance0.high == 0 && balance1.high == 0, "RealmsSwap::Pair::_update::overflow");

        let block_timestamp = get_block_timestamp();
        let block_timestamp_last = self.block_timestamp_last.read();

        if block_timestamp >= block_timestamp_last {
            let time_elapsed: u64 = block_timestamp - block_timestamp_last;
            if time_elapsed != 0 && reserve0 > 0 && reserve1 > 0 {
                let price_0_increment = (reserve1 / reserve0) * time_elapsed.into();
                let price_1_increment = (reserve0 / reserve1) * time_elapsed.into();

                self.price_0_cumulative_last.write(self.price_0_cumulative_last.read() + price_0_increment);
                self.price_1_cumulative_last.write(self.price_1_cumulative_last.read() + price_1_increment);
            }
        }

        self.reserve0.write(balance0);
        self.reserve1.write(balance1);
        self.block_timestamp_last.write(block_timestamp);
        self.emit(Sync { reserve0: balance0, reserve1: balance1 });
    }
}
