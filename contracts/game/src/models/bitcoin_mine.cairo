use crate::alias::ID;
use crate::models::config::{TickInterval, TickTrait};

/// Tracks total labor deposited across all bitcoin mines in a phase
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinPhaseLabor {
    #[key]
    pub phase_id: u64,
    pub prize_pool: u128, // SATOSHI allocated for this phase (base + rollover)
    pub total_labor: u128, // cumulative labor deposited
    pub participant_count: u32, // distinct mines that contributed
    pub claim_count: u32, // mines that have attempted claim
    pub reward_claimed: bool // has anyone won yet
}

/// Tracks a mine's labor contribution for a specific phase
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinMinePhaseLabor {
    #[key]
    pub phase_id: u64,
    #[key]
    pub mine_id: ID,
    pub labor_contributed: u128,
    pub claimed: bool // has this mine attempted claim yet
}

#[generate_trait]
pub impl BitcoinPhaseImpl of BitcoinPhaseTrait {
    /// Get phase end time (1 second before next phase starts)
    fn end_time(phase_id: u64, tick: TickInterval) -> u64 {
        tick.convert_to_estimated_timestamp(phase_id + 1) - 1
    }

    /// Check if contribution window is still open for a phase
    fn is_contribution_open(phase_id: u64, tick: TickInterval) -> bool {
        let now = starknet::get_block_timestamp();
        now < Self::end_time(phase_id, tick)
    }

    /// Check if contribution window has closed for a phase
    fn has_contribution_closed(phase_id: u64, tick: TickInterval) -> bool {
        let now = starknet::get_block_timestamp();
        now >= Self::end_time(phase_id, tick)
    }
}
