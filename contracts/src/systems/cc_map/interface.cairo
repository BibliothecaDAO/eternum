// ---------------------------------------- interface -------------------------------------
#[starknet::interface]
trait CCInterface<TContractState> {
    fn mint(ref self: TContractState);
    fn generate(self: @TContractState, token_id: u256);
    fn svg(self: @TContractState, token_id: u256);
}

// #[starknet::interface]
// trait IERC721Enumerable<TContractState> {
//     fn total_supply(self: @TContractState) -> u256;
//     fn token_by_index(self: @TContractState, index: u256) -> u256;
//     fn token_of_owner_by_index(self: @TContractState, owner: ContractAddress, index: u256) -> u256;
// }

// #[starknet::interface]
// trait IERC721Metadata<TState> {
//     fn name(self: @TState) -> felt252;
//     fn symbol(self: @TState) -> felt252;
//     fn token_uri(self: @TState, token_id: u256) -> Array<felt252>;
// }

// #[starknet::interface]
// trait IERC721<TState> {
//     fn balance_of(self: @TState, account: ContractAddress) -> u256;
//     fn owner_of(self: @TState, token_id: u256) -> ContractAddress;
//     fn transfer_from(ref self: TState, from: ContractAddress, to: ContractAddress, token_id: u256);
//     fn safe_transfer_from(
//         ref self: TState,
//         from: ContractAddress,
//         to: ContractAddress,
//         token_id: u256,
//         data: Span<felt252>
//     );
//     fn approve(ref self: TState, to: ContractAddress, token_id: u256);
//     fn set_approval_for_all(ref self: TState, operator: ContractAddress, approved: bool);
//     fn get_approved(self: @TState, token_id: u256) -> ContractAddress;
//     fn is_approved_for_all(
//         self: @TState, owner: ContractAddress, operator: ContractAddress
//     ) -> bool;
// }