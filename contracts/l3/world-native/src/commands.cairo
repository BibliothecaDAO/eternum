#[cfg(test)]
use core::poseidon::poseidon_hash_span;
use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateExplorer {
    pub structure_id: u32,
    pub category: u8,
    pub tier: u8,
    pub amount: u128,
    pub direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Explore {
    pub explorer_id: u32,
    pub direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Battle {
    pub attacker_id: u32,
    pub defender_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Move {
    pub explorer_id: u32,
    pub directions: Span<u8>,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ToggleAlternate {
    pub explorer_id: u32,
    pub spire_direction: u8,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct EnterDepth {
    pub explorer_id: u32,
    pub depth: u8,
}

#[derive(Drop, starknet::Event)]
pub struct BatchProgress {
    #[key]
    pub game_id: u32,
    pub actor: ContractAddress,
    pub nonce: u64,
    pub remaining: u64,
}
#[cfg(test)]
pub use crate::command_routes::Command;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExecutionContext {
    pub raw_root: u256,
    pub timestamp: u64,
}

// Cairo Serde encodes the variant index followed by its typed fields.
#[cfg(test)]
pub fn command_commitment(command: Command) -> felt252 {
    let mut fields = array!['ETERNUM_COMMAND', 1];
    command.serialize(ref fields);
    poseidon_hash_span(fields.span())
}

pub const MAX_COMMAND_ITEMS: u32 = 64;

pub fn route_command(
    mut arguments: Span<felt252>,
) -> Result<(u32, crate::command_routes::CommandRoute, Span<felt252>), felt252> {
    if arguments.len() > 256 {
        return Err('INVALID_COMMAND');
    }
    let index: u32 = (*arguments.pop_front().ok_or('INVALID_COMMAND')?).try_into().ok_or('INVALID_COMMAND')?;
    let routes = crate::command_routes::COMMAND_ROUTES.span();
    let route = **routes.get(index).ok_or('INVALID_COMMAND')?;
    if let Some(offset) = route.items_offset {
        let items: u32 = (**arguments.get(offset).ok_or('INVALID_COMMAND')?).try_into().ok_or('INVALID_COMMAND')?;
        if items > MAX_COMMAND_ITEMS {
            return Err('INVALID_COMMAND');
        }
    }
    Ok((index, route, arguments))
}

#[inline(never)]
pub fn assert_unique_entity_ids(ids: Span<u32>) {
    let mut seen: core::dict::Felt252Dict<u128> = Default::default();
    for id in ids {
        let key = (*id).into();
        assert!(seen.get(key) == 0, "duplicate entity id");
        seen.insert(key, 1);
    }
}

#[starknet::interface]
pub trait ITroopCommands<T> {
    fn create_explorer(
        ref self: T, game_id: u32, actor: ContractAddress, command: CreateExplorer, context: ExecutionContext,
    );
    fn explore(ref self: T, game_id: u32, actor: ContractAddress, command: Explore, context: ExecutionContext);
}

#[starknet::interface]
pub trait IResourceCommands<T> {
    fn send_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
    fn transfer_explorer_resources_to_structure(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
    fn offload_arrival(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::arrivals::OffloadArrival,
        context: ExecutionContext,
    );
    fn burn_structure_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceBurn,
        context: ExecutionContext,
    );
    fn transfer_explorer_resources(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
    fn transfer_structure_resources_to_explorer(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: crate::resources::ResourceTransfer,
        context: ExecutionContext,
    );
}

#[starknet::interface]
pub trait ITravelCommands<T> {
    fn enter_depth(ref self: T, game_id: u32, actor: ContractAddress, command: EnterDepth, context: ExecutionContext);
    fn move_explorer(ref self: T, game_id: u32, actor: ContractAddress, command: Move, context: ExecutionContext);
    fn toggle_alternate(
        ref self: T, game_id: u32, actor: ContractAddress, command: ToggleAlternate, context: ExecutionContext,
    );
}

pub fn assert_context_time(timestamp: u64) {
    assert!(
        eternum_randomness_protocol::entrypoint::timestamp_in_bounds(timestamp, starknet::get_block_timestamp()),
        "execution timestamp is in the future",
    );
}
