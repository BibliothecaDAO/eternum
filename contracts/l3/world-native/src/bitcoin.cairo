use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct PhaseKey {
    pub game_id: u32,
    pub phase: u64,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ContributionKey {
    pub game_id: u32,
    pub phase: u64,
    pub player: ContractAddress,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub enum PhaseStatus {
    #[default]
    Open,
    Closed,
    Bound,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub struct Phase {
    pub total_labor: u128,
    pub contributors: u32,
    pub state: PhaseStatus,
    pub root: u256,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ContributeLabor {
    pub structure_id: u32,
    pub amount: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub struct MineFunding {
    pub eligible_from: u64,
    pub next_phase: u64,
    pub unsplit_carry: u128,
    pub winner_carry: u128,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq, Default, starknet::Store)]
pub struct Contribution {
    pub labor: u128,
    pub structure_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ClaimKey {
    pub game_id: u32,
    pub phase: u64,
    pub mine_id: u32,
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct ClaimPhase {
    pub phase: u64,
    pub mine_ids: Span<u32>,
}

#[starknet::interface]
pub trait IBitcoinFunding<T> {
    fn register_bitcoin_structure(
        ref self: T,
        key: crate::resources::ResourceKey,
        category: u8,
        timestamp: u64,
        game_context: crate::commands::ActionContext,
    );
    fn bitcoin_mine_captured(
        ref self: T, key: crate::resources::ResourceKey, timestamp: u64, game_context: crate::commands::ActionContext,
    );
}

#[starknet::interface]
pub trait IBitcoinViews<T> {
    #[cfg(test)]
    fn bitcoin_mine(self: @T, key: crate::resources::ResourceKey) -> MineFunding;
    #[cfg(test)]
    fn bitcoin_claimed(self: @T, key: ClaimKey) -> bool;
    #[cfg(test)]
    fn bitcoin_phase(self: @T, key: PhaseKey) -> Phase;
    #[cfg(test)]
    fn bitcoin_contribution(self: @T, key: ContributionKey) -> Contribution;
    #[cfg(test)]
    fn bitcoin_contributor(self: @T, key: PhaseKey, index: u32) -> ContractAddress;
}

#[starknet::interface]
pub trait IBitcoinCommands<T> {
    fn claim_bitcoin_phase(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: ClaimPhase,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    ) -> (u64, crate::ownership::StoryCursor);
    fn contribute_bitcoin_labor(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        command: ContributeLabor,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    );
    fn close_bitcoin_phase(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        phase: u64,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    );
    fn bind_bitcoin_phase(
        ref self: T,
        game_id: u32,
        actor: ContractAddress,
        phase: u64,
        context: crate::commands::ActionContext,
        story_cursor: crate::ownership::StoryCursor,
    );
}

pub fn phase_end(phase: u64, interval: u64) -> u64 {
    assert!(phase != 0 && interval != 0, "invalid Bitcoin phase");
    (phase + 1) * interval - 1
}

#[derive(Copy, Drop, Serde, Debug, PartialEq)]
pub struct BitcoinAwardStory {
    pub phase: u64,
    pub mine_id: u32,
    pub winner: ContractAddress,
    pub owner: ContractAddress,
    pub winner_destination: u32,
    pub owner_destination: u32,
    pub winner_paid: u128,
    pub owner_paid: u128,
}

pub fn split_prize(prize: u128, owner_cut_bps: u16) -> (u128, u128) {
    assert!(owner_cut_bps <= 10000, "invalid Bitcoin owner cut");
    let cut: u128 = (Into::<u128, u256>::into(prize) * owner_cut_bps.into() / 10000).try_into().unwrap();
    (prize - cut, cut)
}
