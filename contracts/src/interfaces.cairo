use starknet::ContractAddress;
use eternum::erc721::erc721::{RealmData, Position};
use eternum::alias::ID;

#[starknet::interface]
trait IERC721<TContractState> {
    fn balance_of(self: @TContractState, owner: ContractAddress) -> u256;
    fn owner_of(self: @TContractState, token_id: ID) -> ContractAddress;
    fn get_approved(self: @TContractState, token_id: ID) -> ContractAddress;
    fn is_approved_for_all(self: @TContractState, owner: ContractAddress, operator: ContractAddress);
    fn transfer_from(ref self: TContractState, from: ContractAddress, to: ContractAddress, token_id: ID);
    // TODO: safe_transfer_from
    fn approve(ref self: TContractState, approved: ContractAddress, token_id: ID);
    fn set_approval_for_all(ref self: TContractState, operator: ContractAddress, approval: bool);
    fn fetch_realm_data(self: @TContractState, realm_id: ID) -> RealmData;
    fn realm_position(self: @TContractState, realm_id: ID) -> Position;
    fn mint(ref self: TContractState, to: ContractAddress);
    fn set_realm_data(
        ref self: TContractState, realm_id: ID, realm_data: u128, realm_name: u256, realm_position: Position
    );
}