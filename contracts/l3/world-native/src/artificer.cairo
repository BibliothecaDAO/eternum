use starknet::ContractAddress;
pub const RESEARCH: u8 = 57;
#[starknet::interface]
pub trait IArtificer<T> {
    fn configure_artificer(ref self: T, game_id: u32, research_cost: u128);
    fn artificer_cost(self: @T, game_id: u32) -> u128;
    fn craft_relic(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        structure_id: u32,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> ((), crate::ownership::StoryCursor);
}
