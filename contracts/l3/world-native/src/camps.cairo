use crate::resources::ResourceAmount;

// A camp's own rules: what it starts with and the labor it produces once owned. Villages keep their own rates.
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct CampRules {
    pub resources: Span<ResourceAmount>,
    pub labor_rate: u64,
}

