// #[contract] is here only so that this file compiles as it should
#[contract]
mod TodoRemoveEventually {}

use starknet::ContractAddress;
// TODO: import alias eventually
// use super::alias::ID;
type ID = felt252;

#[abi]
trait IERC721 {

    fn balance_of(owner: ContractAddress) -> u256;
    fn owner_of(token_id: ID) -> ContractAddress;
    fn get_approved(token_id: u256) -> ContractAddress;
    fn is_approved_for_all(owner: ContractAddress, operator: ContractAddress);    

    fn transfer_from(from: ContractAddress, to: ContractAddress, token_id: ID);
    // TODO: safe_transfer_from
    fn approve(approved: ContractAddress, token_id: ID);
    fn set_approval_for_all(operator: ContractAddress, approval: bool);
}

#[abi]
trait IRealmsMeta {
    // TODO: adapt this once the NFT bridge is ready to match the interface
    fn get_cities(realm_id: ID);
    fn get_harbors(realm_id: ID);
}
