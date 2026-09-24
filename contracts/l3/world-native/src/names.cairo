use starknet::ContractAddress;
use crate::commands::ExecutionContext;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct EntityName {
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
    fn entity_name(self: @T, key: crate::resources::ResourceKey) -> EntityName;
    fn set_entity_name(
        ref self: T, game_id: u32, actor: ContractAddress, command: SetEntityName, context: ExecutionContext,
    );
}
