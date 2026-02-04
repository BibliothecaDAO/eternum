use crate::alias::ID;

/// Tracks total labor deposited across all bitcoin mines in a phase
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinPhaseLabor {
    #[key]
    pub phase_id: u64,
    pub phase_end_time: u64, // timestamp when contribution window closes (0 = uninitialized)
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
