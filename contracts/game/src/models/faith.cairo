use starknet::ContractAddress;
use crate::alias::ID;


/// Tracks the faith prize won by a wonder
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct WonderFaithPrize {
    #[key]
    pub wonder_id: ID,
    pub amount_won: u128,
}

/// Tracks a player's claimed faith prize for a wonder
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerFaithPrizeClaimed {
    #[key]
    pub player: ContractAddress,
    #[key]
    pub wonder_id: ID,
    pub claimed: bool,
}

/// Tracks the faith state for a wonder
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct WonderFaith {
    #[key]
    pub wonder_id: ID,
    pub last_recorded_owner: ContractAddress,
    pub claimed_points: u128,
    pub claim_per_sec: u16,
    pub claim_last_at: u64,
    pub owner_claim_per_sec: u16,
    pub num_structures_pledged: u32,
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
    pub last_recorded_owner: ContractAddress,
}

/// Player's accumulated faith points per wonder
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerFaithPoints {
    #[key]
    pub player: ContractAddress,
    #[key]
    pub wonder_id: ID,
    pub points_claimed: u128,
    pub points_per_sec_as_owner: u16,
    pub points_per_sec_as_pledger: u16,
    pub last_updated_at: u64,
}

/// Faith leaderboard winners - stores high score and all tied winners
#[derive(Drop, Serde)]
#[dojo::model]
pub struct WonderFaithWinners {
    #[key]
    pub world_id: ID,
    pub high_score: u128,
    pub wonder_ids: Array<ID>,
}

/// Blacklist entry for a wonder
#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct WonderFaithBlacklist {
    #[key]
    pub wonder_id: ID,
    #[key]
    pub blocked_id: felt252,
    pub is_blocked: bool,
}
