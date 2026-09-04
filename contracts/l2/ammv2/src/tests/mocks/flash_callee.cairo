#[starknet::interface]
pub trait IMockFlashCallee<TState> {
    fn set_repayment(
        ref self: TState,
        token0: starknet::ContractAddress,
        token1: starknet::ContractAddress,
        repay0: u256,
        repay1: u256,
    );

    fn get_last_call(self: @TState) -> (starknet::ContractAddress, u256, u256);
}

#[starknet::contract]
pub mod MockFlashCallee {
    use ammv2::packages::core::interfaces::callee::IRealmsSwapCallee;
    use ammv2::packages::core::interfaces::erc20::{IERC20MinimalDispatcher, IERC20MinimalDispatcherTrait};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    struct Storage {
        token0: ContractAddress,
        token1: ContractAddress,
        repay0: u256,
        repay1: u256,
        last_sender: ContractAddress,
        last_amount0_out: u256,
        last_amount1_out: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {}

    #[abi(embed_v0)]
    impl RealmsSwapCalleeImpl of IRealmsSwapCallee<ContractState> {
        fn swap_callback(
            ref self: ContractState, sender: ContractAddress, amount0_out: u256, amount1_out: u256, data: Span<felt252>,
        ) {
            self.last_sender.write(sender);
            self.last_amount0_out.write(amount0_out);
            self.last_amount1_out.write(amount1_out);

            let pair = get_caller_address();
            let token0 = self.token0.read();
            let token1 = self.token1.read();
            let repay0 = self.repay0.read();
            let repay1 = self.repay1.read();

            if repay0 > 0 {
                IERC20MinimalDispatcher { contract_address: token0 }.transfer(pair, repay0);
            }
            if repay1 > 0 {
                IERC20MinimalDispatcher { contract_address: token1 }.transfer(pair, repay1);
            }

            let _ = data;
        }
    }

    #[abi(embed_v0)]
    impl MockFlashCalleeImpl of super::IMockFlashCallee<ContractState> {
        fn set_repayment(
            ref self: ContractState, token0: ContractAddress, token1: ContractAddress, repay0: u256, repay1: u256,
        ) {
            self.token0.write(token0);
            self.token1.write(token1);
            self.repay0.write(repay0);
            self.repay1.write(repay1);
        }

        fn get_last_call(self: @ContractState) -> (ContractAddress, u256, u256) {
            (self.last_sender.read(), self.last_amount0_out.read(), self.last_amount1_out.read())
        }
    }
}
