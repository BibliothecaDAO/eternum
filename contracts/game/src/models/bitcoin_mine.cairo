use crate::alias::ID;

/// Tracks total work produced across all bitcoin mines in the current phase
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinPhaseWork {
    #[key]
    pub phase_id: u64,
    pub total_work: u128,
    pub lottery_executed: bool,
}

/// Tracks a single bitcoin mine's state
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinMineState {
    #[key]
    pub mine_id: ID,
    pub production_level: u8, // 0=stopped, 1-5=very_low to very_high
    pub work_accumulated: u128, // Total work produced by this mine
    pub work_last_claimed_phase: u64, // Last phase when work was claimed
    pub satoshis_won: u128 // Total satoshis won by this mine
}

/// Tracks a mine's work contribution for a specific phase
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct BitcoinMinePhaseWork {
    #[key]
    pub phase_id: u64,
    #[key]
    pub mine_id: ID,
    pub work_contributed: u128,
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

/// Production level enum for clearer code
#[derive(Copy, Drop, Serde, PartialEq)]
pub enum ProductionLevel {
    Stopped, // 0
    VeryLow, // 1 - 1 labor/sec = 1 work/sec
    Low, // 2 - 2 labor/sec = 2 work/sec
    Medium, // 3 - 3 labor/sec = 3 work/sec
    High, // 4 - 4 labor/sec = 4 work/sec
    VeryHigh // 5 - 5 labor/sec = 5 work/sec
}

pub impl ProductionLevelIntoU8 of Into<ProductionLevel, u8> {
    fn into(self: ProductionLevel) -> u8 {
        match self {
            ProductionLevel::Stopped => 0,
            ProductionLevel::VeryLow => 1,
            ProductionLevel::Low => 2,
            ProductionLevel::Medium => 3,
            ProductionLevel::High => 4,
            ProductionLevel::VeryHigh => 5,
        }
    }
}

pub impl U8IntoProductionLevel of Into<u8, ProductionLevel> {
    fn into(self: u8) -> ProductionLevel {
        if self == 0 {
            ProductionLevel::Stopped
        } else if self == 1 {
            ProductionLevel::VeryLow
        } else if self == 2 {
            ProductionLevel::Low
        } else if self == 3 {
            ProductionLevel::Medium
        } else if self == 4 {
            ProductionLevel::High
        } else {
            ProductionLevel::VeryHigh
        }
    }
}
