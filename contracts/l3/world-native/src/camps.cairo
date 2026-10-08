use crate::resources::ResourceAmount;

// A camp's own rules: what it starts with and the labor it produces once owned. Villages keep their own rates.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CampRules {
    pub resources: Span<ResourceAmount>,
    pub labor_rate: u64,
}

#[starknet::interface]
pub trait ICampRules<T> {
    fn camp_rules(self: @T, game_id: u32) -> CampRules;
}
