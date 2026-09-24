use crate::resources::ResourceAmount;

pub const CAMP_CATEGORY: u8 = 7;
pub const CAMP_OCCUPIER: u8 = 37;

#[starknet::interface]
pub trait ICampRules<T> {
    fn camp_resources(self: @T, game_id: u32) -> Span<ResourceAmount>;
}
