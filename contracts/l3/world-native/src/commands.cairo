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
pub enum Command {
    CreateExplorer: CreateExplorer,
    Explore: Explore,
    ClaimProduction: u32,
    Battle: Battle,
    Move: Move,
    ToggleAlternate: ToggleAlternate,
    TransferStructureOwnership: crate::ownership::TransferOwnership,
    TransferAgentOwnership: crate::ownership::TransferOwnership,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ExecutionContext {
    pub raw_root: u256,
    pub timestamp: u64,
}

// Cairo Serde encodes the variant index followed by its typed fields.
pub fn command_commitment(command: Command) -> felt252 {
    let mut fields = array!['ETERNUM_COMMAND', 1];
    command.serialize(ref fields);
    poseidon_hash_span(fields.span())
}

pub fn decode_command(arguments: Span<felt252>, commitment: felt252) -> Result<Command, Array<felt252>> {
    let mut fields = arguments;
    let command: Command = Serde::deserialize(ref fields).ok_or(array!['malformed command'])?;
    if !fields.is_empty() {
        return Err(array!['trailing command arguments']);
    }
    if command_commitment(command) != commitment {
        return Err(array!['command commitment mismatch']);
    }
    Ok(command)
}

#[starknet::interface]
pub trait ITroopCommands<T> {
    fn create_explorer(
        ref self: T, game_id: u32, actor: ContractAddress, command: CreateExplorer, context: ExecutionContext,
    );
    fn explore(ref self: T, game_id: u32, actor: ContractAddress, command: Explore, context: ExecutionContext);
    fn battle(ref self: T, game_id: u32, actor: ContractAddress, command: Battle, context: ExecutionContext);
}

#[starknet::interface]
pub trait IResourceCommands<T> {
    fn claim_production(
        ref self: T, game_id: u32, actor: ContractAddress, structure_id: u32, context: ExecutionContext,
    );
}

#[starknet::interface]
pub trait ITravelCommands<T> {
    fn move_explorer(ref self: T, game_id: u32, actor: ContractAddress, command: Move, context: ExecutionContext);
    fn toggle_alternate(
        ref self: T, game_id: u32, actor: ContractAddress, command: ToggleAlternate, context: ExecutionContext,
    );
}

pub fn assert_context_time(timestamp: u64) {
    assert!(
        eternum_randomness_protocol::entrypoint::timestamp_in_bounds(timestamp, starknet::get_block_timestamp()),
        "execution timestamp outside skew",
    );
}
