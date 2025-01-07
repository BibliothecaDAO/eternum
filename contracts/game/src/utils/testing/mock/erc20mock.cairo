// Mock ERC20 contract
use starknet::ContractAddress;
#[starknet::interface]
trait IERC20<TState> {
    fn balance_of(self: @TState, account: ContractAddress) -> u256;
    fn transfer(ref self: TState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TState, spender: ContractAddress, amount: u256) -> bool;
    fn decimals(self: @TState) -> u8;
}

#[starknet::contract]
mod MockERC20 {
    use starknet::ContractAddress;
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry, Map};
    use super::IERC20;

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        total_supply: u256,
        decimals: u8,
    }

    #[constructor]
    fn constructor(ref self: ContractState, initial_supply: u256, decimals: u8) {
        self.total_supply.write(initial_supply);
        self.decimals.write(decimals);
        self.balances.entry(starknet::get_caller_address()).write(initial_supply);
    }

    #[abi(embed_v0)]
    impl ERC20Impl of IERC20<ContractState> {
        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = starknet::get_caller_address();
            let sender_balance = self.balances.entry(sender).read();
            assert!(sender_balance >= amount, "ERC20: Insufficient balance");
            self.balances.entry(sender).write(sender_balance - amount);
            let recipient_balance = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(recipient_balance + amount);
            true
        }

        fn transfer_from(
            ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256
        ) -> bool {
            let caller = starknet::get_caller_address();
            let caller_allowance = self.allowances.entry((sender, caller)).read();
            assert!(caller_allowance >= amount, "ERC20: Insufficient allowance");
            self.allowances.entry((sender, caller)).write(caller_allowance - amount);
            let sender_balance = self.balances.entry(sender).read();
            assert!(sender_balance >= amount, "ERC20: Insufficient balance");
            self.balances.entry(sender).write(sender_balance - amount);
            let recipient_balance = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(recipient_balance + amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = starknet::get_caller_address();
            self.allowances.entry((caller, spender)).write(amount);
            true
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }
    }
}
