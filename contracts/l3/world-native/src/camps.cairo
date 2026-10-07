use crate::resources::ResourceAmount;

#[starknet::interface]
pub trait ICampRules<T> {
    fn camp_resources(self: @T, game_id: u32) -> Span<ResourceAmount>;
}
