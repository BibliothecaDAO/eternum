use starknet::ContractAddress;
use crate::commands::ExecutionContext;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SetAddressName {
    pub owned_structure_id: u32,
    pub name: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct AddressName {
    pub name: felt252,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SetEntityName {
    pub entity_id: u32,
    pub name: felt252,
}

#[starknet::interface]
pub trait INames<T> {
    #[cfg(test)]
    fn entity_name(self: @T, key: crate::resources::ResourceKey) -> AddressName;
    fn set_entity_name(
        ref self: T, game_id: u32, actor: ContractAddress, command: SetEntityName, context: ExecutionContext,
    );
    #[cfg(test)]
    fn address_name(self: @T, address: ContractAddress) -> AddressName;
    fn set_address_name(
        ref self: T, game_id: u32, actor: ContractAddress, command: SetAddressName, context: ExecutionContext,
    );
}
