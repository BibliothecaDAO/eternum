use crate::alias::ID;

/// Tracks total labor deposited across all bitcoin mines in a phase
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinPhaseLabor {
    #[key]
    pub phase_id: u64,
    pub phase_end_time: u64, // timestamp when contribution window closes (0 = uninitialized)
    pub prize_pool: u128, // SATOSHI allocated for this phase (base + rollover)
    pub prize_origin_phase: u64, // phase where prize originated (for rollover tracking)
    pub total_labor: u128, // cumulative labor deposited
    pub participant_count: u32, // distinct mines that contributed
    pub claim_count: u32, // mines that have attempted claim
    pub reward_claimed: bool // has anyone won yet
}

/// Tracks a single bitcoin mine's state
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinMineState {
    #[key]
    pub mine_id: ID,
    pub labor_deposited: u128, // Total labor deposited by this mine (all time)
    pub last_contributed_phase: u64, // Last phase this mine contributed to
    pub prizes_won: u128 // Total SATOSHI prizes won by this mine
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

/// Global bitcoin mine registry for phase processing
#[derive(Drop, Serde)]
#[dojo::model]
pub struct BitcoinMineRegistry {
    #[key]
    pub world_id: ID,
    pub active_mine_ids: Array<ID>,
    pub current_phase: u64,
    pub phase_start_timestamp: u64,
}
