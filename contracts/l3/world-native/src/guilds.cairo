use starknet::ContractAddress;
use crate::commands::ExecutionContext;
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct Guild {
    pub public: bool,
    pub name: felt252,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CreateGuild {
    pub owned_structure_id: u32,
    pub public: bool,
    pub name: felt252,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct JoinGuild {
    pub owned_structure_id: u32,
    pub guild_id: ContractAddress,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WhitelistKey {
    pub game_id: u32,
    pub guild_id: ContractAddress,
    pub player: ContractAddress,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct SetWhitelist {
    pub player: ContractAddress,
    pub owned_structure_id: u32,
    pub allowed: bool,
}
#[starknet::interface]
pub trait IGuilds<T> {
    fn guild_member(self: @T, game_id: u32, actor: ContractAddress) -> ContractAddress;
    fn guild(self: @T, game_id: u32, guild_id: ContractAddress) -> Option<Guild>;
    fn guild_whitelisted(self: @T, key: WhitelistKey) -> bool;
    fn create_guild(ref self: T, game_id: u32, actor: ContractAddress, command: CreateGuild, context: ExecutionContext);
    fn join_guild(ref self: T, game_id: u32, actor: ContractAddress, command: JoinGuild, context: ExecutionContext);
    fn leave_guild(ref self: T, game_id: u32, actor: ContractAddress, context: ExecutionContext);
    fn set_guild_whitelist(
        ref self: T, game_id: u32, actor: ContractAddress, command: SetWhitelist, context: ExecutionContext,
    );
    fn remove_guild_member(
        ref self: T, game_id: u32, actor: ContractAddress, member: ContractAddress, context: ExecutionContext,
    );
}
