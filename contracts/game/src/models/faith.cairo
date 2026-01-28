use starknet::ContractAddress;
use crate::alias::ID;

/// Tracks the faith state for a wonder
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct WonderFaith {
    #[key]
    pub wonder_id: ID,
    pub claimed_points: u128,
    pub claim_per_sec: u16,
    pub claim_last_at: u64,
    pub num_structures_pledged: u32,
    pub last_recorded_owner: ContractAddress,
}

/// Tracks a structure's faith allegiance
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct FaithfulStructure {
    #[key]
    pub structure_id: ID,
    pub wonder_id: ID,
    pub faithful_since: u64,
    pub fp_to_wonder_owner_per_sec: u16,
    pub fp_to_struct_owner_per_sec: u16,
}
