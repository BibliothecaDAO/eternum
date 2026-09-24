use starknet::ContractAddress;

#[starknet::interface]
pub trait ILedgerOperator<T> {
    fn ledger_operator(self: @T) -> ContractAddress;
    fn set_ledger_operator(ref self: T, operator: ContractAddress);
}
