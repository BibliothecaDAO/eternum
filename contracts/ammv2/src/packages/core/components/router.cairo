#[starknet::component]
pub mod RouterComponent {
    use ammv2::packages::core::interfaces::erc20::{IERC20MinimalDispatcher, IERC20MinimalDispatcherTrait};
    use ammv2::packages::core::interfaces::factory::{IRealmsSwapFactoryDispatcher, IRealmsSwapFactoryDispatcherTrait};
    use ammv2::packages::core::interfaces::pair::{IRealmsSwapPairDispatcher, IRealmsSwapPairDispatcherTrait};
    use ammv2::packages::core::interfaces::router::IRealmsSwapRouter;
    use ammv2::packages::core::utils::math;
    use core::num::traits::Zero;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};

    #[storage]
    pub struct Storage {
        pub factory: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {}

    #[embeddable_as(RouterImpl)]
    pub impl Router<
        TContractState, +HasComponent<TContractState>,
    > of IRealmsSwapRouter<ComponentState<TContractState>> {
        fn factory(self: @ComponentState<TContractState>) -> ContractAddress {
            self.factory.read()
        }

        fn sort_tokens(
            self: @ComponentState<TContractState>, token_a: ContractAddress, token_b: ContractAddress,
        ) -> (ContractAddress, ContractAddress) {
            math::sort_tokens(token_a, token_b)
        }

        fn quote(self: @ComponentState<TContractState>, amount_a: u256, reserve_a: u256, reserve_b: u256) -> u256 {
            math::quote(amount_a, reserve_a, reserve_b)
        }

        fn get_amount_out(
            self: @ComponentState<TContractState>, amount_in: u256, reserve_in: u256, reserve_out: u256,
        ) -> u256 {
            let fee_amount = fee_amount(self.factory.read());
            math::get_amount_out(amount_in, reserve_in, reserve_out, fee_amount)
        }

        fn get_amount_in(
            self: @ComponentState<TContractState>, amount_out: u256, reserve_in: u256, reserve_out: u256,
        ) -> u256 {
            let fee_amount = fee_amount(self.factory.read());
            math::get_amount_in(amount_out, reserve_in, reserve_out, fee_amount)
        }

        fn get_amounts_out(
            self: @ComponentState<TContractState>, amount_in: u256, path: Span<ContractAddress>,
        ) -> Array<u256> {
            get_amounts_out(self.factory.read(), amount_in, path)
        }

        fn get_amounts_in(
            self: @ComponentState<TContractState>, amount_out: u256, path: Span<ContractAddress>,
        ) -> Array<u256> {
            get_amounts_in(self.factory.read(), amount_out, path)
        }

        fn add_liquidity(
            ref self: ComponentState<TContractState>,
            token_a: ContractAddress,
            token_b: ContractAddress,
            amount_a_desired: u256,
            amount_b_desired: u256,
            amount_a_min: u256,
            amount_b_min: u256,
            to: ContractAddress,
            deadline: u64,
        ) -> (u256, u256, u256) {
            ensure_deadline(deadline);
            let (amount_a, amount_b) = add_liquidity_internal(
                self.factory.read(), token_a, token_b, amount_a_desired, amount_b_desired, amount_a_min, amount_b_min,
            );

            let pair = pair_for(self.factory.read(), token_a, token_b);
            let sender = get_caller_address();
            IERC20MinimalDispatcher { contract_address: token_a }.transferFrom(sender, pair, amount_a);
            IERC20MinimalDispatcher { contract_address: token_b }.transferFrom(sender, pair, amount_b);
            let liquidity = IRealmsSwapPairDispatcher { contract_address: pair }.mint(to);

            (amount_a, amount_b, liquidity)
        }

        fn remove_liquidity(
            ref self: ComponentState<TContractState>,
            token_a: ContractAddress,
            token_b: ContractAddress,
            liquidity: u256,
            amount_a_min: u256,
            amount_b_min: u256,
            to: ContractAddress,
            deadline: u64,
        ) -> (u256, u256) {
            ensure_deadline(deadline);

            let pair = pair_for(self.factory.read(), token_a, token_b);
            let sender = get_caller_address();
            IERC20MinimalDispatcher { contract_address: pair }.transferFrom(sender, pair, liquidity);

            let (amount0, amount1) = IRealmsSwapPairDispatcher { contract_address: pair }.burn(to);
            let (token0, _) = math::sort_tokens(token_a, token_b);
            let (amount_a, amount_b) = if token_a == token0 {
                (amount0, amount1)
            } else {
                (amount1, amount0)
            };

            assert!(amount_a >= amount_a_min, "RealmsSwap::Router::remove_liquidity::insufficient A amount");
            assert!(amount_b >= amount_b_min, "RealmsSwap::Router::remove_liquidity::insufficient B amount");

            (amount_a, amount_b)
        }

        fn swap_exact_tokens_for_tokens(
            ref self: ComponentState<TContractState>,
            amount_in: u256,
            amount_out_min: u256,
            path: Span<ContractAddress>,
            to: ContractAddress,
            deadline: u64,
        ) -> Array<u256> {
            ensure_deadline(deadline);
            let amounts = get_amounts_out(self.factory.read(), amount_in, path);
            assert!(
                *amounts.at(amounts.len() - 1) >= amount_out_min,
                "RealmsSwap::Router::swap_exact_tokens_for_tokens::insufficient output amount",
            );

            let pair = pair_for(self.factory.read(), *path.at(0), *path.at(1));
            let sender = get_caller_address();
            IERC20MinimalDispatcher { contract_address: *path.at(0) }.transferFrom(sender, pair, *amounts.at(0));
            swap_path(self.factory.read(), @amounts, path, to);

            amounts
        }

        fn swap_tokens_for_exact_tokens(
            ref self: ComponentState<TContractState>,
            amount_out: u256,
            amount_in_max: u256,
            path: Span<ContractAddress>,
            to: ContractAddress,
            deadline: u64,
        ) -> Array<u256> {
            ensure_deadline(deadline);
            let amounts = get_amounts_in(self.factory.read(), amount_out, path);
            assert!(
                *amounts.at(0) <= amount_in_max,
                "RealmsSwap::Router::swap_tokens_for_exact_tokens::excessive input amount",
            );

            let pair = pair_for(self.factory.read(), *path.at(0), *path.at(1));
            let sender = get_caller_address();
            IERC20MinimalDispatcher { contract_address: *path.at(0) }.transferFrom(sender, pair, *amounts.at(0));
            swap_path(self.factory.read(), @amounts, path, to);

            amounts
        }
    }

    #[generate_trait]
    pub impl InternalImpl<TContractState, +HasComponent<TContractState>> of InternalTrait<TContractState> {
        fn initializer(ref self: ComponentState<TContractState>, factory: ContractAddress) {
            assert!(!factory.is_zero(), "RealmsSwap::Router::constructor::factory can not be zero");
            self.factory.write(factory);
        }
    }

    fn ensure_deadline(deadline: u64) {
        assert!(get_block_timestamp() <= deadline, "RealmsSwap::Router::_ensure_deadline::expired");
    }

    fn pair_for(factory: ContractAddress, token_a: ContractAddress, token_b: ContractAddress) -> ContractAddress {
        let (token0, token1) = math::sort_tokens(token_a, token_b);
        IRealmsSwapFactoryDispatcher { contract_address: factory }.get_pair(token0, token1)
    }

    fn get_reserves(factory: ContractAddress, token_a: ContractAddress, token_b: ContractAddress) -> (u256, u256) {
        let (token0, _) = math::sort_tokens(token_a, token_b);
        let pair = pair_for(factory, token_a, token_b);
        let (reserve0, reserve1, _) = IRealmsSwapPairDispatcher { contract_address: pair }.get_reserves();
        if token_a == token0 {
            (reserve0, reserve1)
        } else {
            (reserve1, reserve0)
        }
    }

    fn fee_amount(factory: ContractAddress) -> u256 {
        IRealmsSwapFactoryDispatcher { contract_address: factory }.get_fee_amount()
    }

    fn add_liquidity_internal(
        factory: ContractAddress,
        token_a: ContractAddress,
        token_b: ContractAddress,
        amount_a_desired: u256,
        amount_b_desired: u256,
        amount_a_min: u256,
        amount_b_min: u256,
    ) -> (u256, u256) {
        let pair = IRealmsSwapFactoryDispatcher { contract_address: factory }.get_pair(token_a, token_b);
        assert!(!pair.is_zero(), "RealmsSwap::Router::_add_liquidity::pair does not exist");

        let (reserve_a, reserve_b) = get_reserves(factory, token_a, token_b);
        if reserve_a == 0 || reserve_b == 0 {
            return (amount_a_desired, amount_b_desired);
        }

        let amount_b_optimal = math::quote(amount_a_desired, reserve_a, reserve_b);
        if amount_b_optimal <= amount_b_desired {
            assert!(amount_b_optimal >= amount_b_min, "RealmsSwap::Router::_add_liquidity::insufficient B amount");
            (amount_a_desired, amount_b_optimal)
        } else {
            let amount_a_optimal = math::quote(amount_b_desired, reserve_b, reserve_a);
            assert!(amount_a_optimal <= amount_a_desired, "RealmsSwap::Router::_add_liquidity::insufficient A amount");
            assert!(amount_a_optimal >= amount_a_min, "RealmsSwap::Router::_add_liquidity::insufficient A amount");
            (amount_a_optimal, amount_b_desired)
        }
    }

    fn get_amounts_out(factory: ContractAddress, amount_in: u256, path: Span<ContractAddress>) -> Array<u256> {
        assert!(path.len() >= 2, "RealmsSwap::Router::_get_amounts_out::invalid path");
        let fee_amount = fee_amount(factory);
        let mut amounts = array![amount_in];
        let mut index = 0;
        while index < path.len() - 1 {
            let (reserve_in, reserve_out) = get_reserves(factory, *path.at(index), *path.at(index + 1));
            let amount_out = math::get_amount_out(*amounts.at(index), reserve_in, reserve_out, fee_amount);
            amounts.append(amount_out);
            index += 1;
        }
        amounts
    }

    fn get_amounts_in(factory: ContractAddress, amount_out: u256, path: Span<ContractAddress>) -> Array<u256> {
        assert!(path.len() >= 2, "RealmsSwap::Router::_get_amounts_in::invalid path");
        let fee_amount = fee_amount(factory);
        let mut amounts = array![];
        let mut index = path.len();
        let mut next_amount = amount_out;

        amounts.append(amount_out);
        while index > 1 {
            let pair_index = index - 2;
            let (reserve_in, reserve_out) = get_reserves(factory, *path.at(pair_index), *path.at(pair_index + 1));
            next_amount = math::get_amount_in(next_amount, reserve_in, reserve_out, fee_amount);
            amounts.append(next_amount);
            index -= 1;
        }

        let mut ordered = array![];
        let mut reverse_index = amounts.len();
        while reverse_index > 0 {
            reverse_index -= 1;
            ordered.append(*amounts.at(reverse_index));
        }
        ordered
    }

    fn swap_path(
        factory: ContractAddress, amounts: @Array<u256>, path: Span<ContractAddress>, final_to: ContractAddress,
    ) {
        let mut index = 0;
        while index < path.len() - 1 {
            let input = *path.at(index);
            let output = *path.at(index + 1);
            let (token0, _) = math::sort_tokens(input, output);
            let amount_out = *amounts.at(index + 1);
            let (amount0_out, amount1_out) = if input == token0 {
                (0, amount_out)
            } else {
                (amount_out, 0)
            };

            let to = if index < path.len() - 2 {
                pair_for(factory, output, *path.at(index + 2))
            } else {
                final_to
            };

            let pair = pair_for(factory, input, output);
            let data = array![];
            IRealmsSwapPairDispatcher { contract_address: pair }.swap(amount0_out, amount1_out, to, data.span());
            index += 1;
        }
    }
}
