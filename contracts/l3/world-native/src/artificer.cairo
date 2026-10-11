use starknet::ContractAddress;
pub const RESEARCH: u8 = 57;
#[starknet::interface]
pub trait IArtificer<T> {
    fn artificer_cost(self: @T, game_id: u32) -> u128;
    fn craft_relic(
        ref self: T, game_id: u32, actor: ContractAddress, structure_id: u64, context: crate::commands::ActionContext,
    );
}
