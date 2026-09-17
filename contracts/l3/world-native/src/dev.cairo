use starknet::ContractAddress;
use crate::commands::ExecutionContext;
use crate::resources::ResourceAmount;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct MintResources {
    pub entity_id: u32,
    pub resources: Span<ResourceAmount>,
}

#[starknet::interface]
pub trait IDevelopment<T> {
    fn mint_resources(
        ref self: T, game_id: u32, actor: ContractAddress, command: MintResources, context: ExecutionContext,
    );
}
