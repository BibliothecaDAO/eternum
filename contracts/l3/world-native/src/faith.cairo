use starknet::ContractAddress;
#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct WonderFaith {
    pub last_recorded_owner: ContractAddress,
    pub claimed_points: u128,
    pub claim_per_sec: u32,
    pub claim_last_at: u64,
    pub owner_claim_per_sec: u32,
    pub num_structures_pledged: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct FaithfulStructure {
    pub wonder_id: u32,
    pub faithful_since: u64,
    pub fp_to_wonder_owner_per_sec: u16,
    pub fp_to_struct_owner_per_sec: u16,
    pub last_recorded_owner: ContractAddress,
}

#[derive(Copy, Drop, Default, Serde, Debug, PartialEq, starknet::Store)]
pub struct PlayerFaithPoints {
    pub points_claimed: u128,
    pub points_per_sec_as_owner: u32,
    pub points_per_sec_as_pledger: u32,
    pub last_updated_at: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct WonderFaithWinners {
    pub high_score: u128,
    pub wonder_ids: Span<u32>,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PlayerFaithKey {
    pub game_id: u32,
    pub player: ContractAddress,
    pub wonder_id: u32,
}

#[starknet::interface]
pub trait IFaithOwnershipViews<T> {
    #[cfg(test)]
    fn wonder_faith(self: @T, key: crate::resources::ResourceKey) -> WonderFaith;
    #[cfg(test)]
    fn faithful_structure(self: @T, key: crate::resources::ResourceKey) -> FaithfulStructure;
    #[cfg(test)]
    fn player_faith_points(self: @T, key: PlayerFaithKey) -> PlayerFaithPoints;
    #[cfg(test)]
    fn wonder_faith_winners(self: @T, game_id: u32) -> WonderFaithWinners;
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, starknet::Store)]
pub struct FaithRules {
    pub wonder_rate: u16,
    pub realm_rate: u16,
    pub village_rate: u16,
    pub owner_share_bps: u16,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct Pledge {
    pub structure_id: u32,
    pub wonder_id: u32,
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ClaimPlayer {
    pub player: ContractAddress,
    pub wonder_id: u32,
}
#[starknet::interface]
pub trait IFaith<T> {
    fn configure_faith(ref self: T, game_id: u32, rules: FaithRules);
    fn faith_rules(self: @T, game_id: u32) -> FaithRules;
    fn pledge_faith(
        ref self: T, game_id: u32, actor: ContractAddress, command: Pledge, context: crate::commands::ActionContext,
    );
    fn remove_faith(
        ref self: T, game_id: u32, actor: ContractAddress, structure_id: u32, context: crate::commands::ActionContext,
    );
    fn update_wonder_ownership(
        ref self: T, game_id: u32, actor: ContractAddress, wonder_id: u32, context: crate::commands::ActionContext,
    );
    fn update_faithful_ownership(
        ref self: T, game_id: u32, actor: ContractAddress, structure_id: u32, context: crate::commands::ActionContext,
    );
    fn claim_wonder_points(
        ref self: T, game_id: u32, actor: ContractAddress, wonder_id: u32, context: crate::commands::ActionContext,
    );
    fn claim_player_faith_points(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: ClaimPlayer,
        context: crate::commands::ActionContext,
    );
}
#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PledgeStory {
    pub structure_id: u32,
    pub wonder_id: u32,
    pub owner_rate: u16,
    pub pledger_rate: u16,
}

#[starknet::interface]
pub trait IFaithOwnership<T> {
    fn transfer_faith_ownership(
        ref self: T,
        key: crate::resources::ResourceKey,
        owner: ContractAddress,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
}
