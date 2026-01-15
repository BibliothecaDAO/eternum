use crate::utils::math::div_round;
use crate::alias::ID;


#[derive(Drop, Serde, DojoStore, Introspect)]
pub struct RecentRing {
    pub data: Array<u128>,
    pub sum: u128,
}

#[generate_trait]
pub impl RecentRingImpl of RecentRingTrait {
    fn new() -> RecentRing {
        RecentRing{ data: array![], sum: 0_u128 }
    }

    fn push(ref self: RecentRing, value: u128, cap: u32) {
        let len: u32 = self.data.len();

        if len < cap {
            // Array is not yet full, append the new value
            self.data.append(value);
            self.sum = self.sum + value;
        } else {
            // Array is full, remove oldest (first element) and append new
            let removed = *self.data[0];
            self.sum = self.sum - removed + value;
            // Rebuild array: shift left and append new value
            let mut new_data = array![];
            let mut i: u32 = 1;
            while i < cap {
                new_data.append(*self.data[i.into()]);
                i += 1;
            };
            new_data.append(value);
            self.data = new_data;
        }
    }

    fn window_len(self: @RecentRing) -> u32 { self.data.len() }
}


#[derive(Drop, Serde, DojoStore, Introspect)]
pub struct AnchorRing {
    pub data: Array<u128>,
    pub sum: u128,
}

#[generate_trait]
pub impl AnchorRingImpl of AnchorRingTrait {
    fn new() -> AnchorRing {
        AnchorRing{ data: array![], sum: 0_u128 }
    }

    fn push_with_cap(ref self: AnchorRing, value: u128, cap: u32) {
        // cap must be within 1..=32
        let len: u32 = self.data.len();

        if len < cap {
            // Array is not yet full, append the new value
            self.data.append(value);
            self.sum = self.sum + value;
        } else {
            // Array is full, remove oldest (first element) and append new
            let removed = *self.data[0];
            self.sum = self.sum - removed + value;
            // Rebuild array: shift left and append new value
            let mut new_data = array![];
            let mut i: u32 = 1;
            while i < cap {
                new_data.append(*self.data[i.into()]);
                i += 1;
            };
            new_data.append(value);
            self.data = new_data;
        }
    }

    fn avg_or(self: @AnchorRing, default: u128) -> u128 {
        let count: u128 = self.data.len().into();
        if count == 0_u128 { default } else { div_round(*self.sum, count) }
    }
}


// Primary controller state. Derives Store so it can be nested in a game's storage.
// All configuration constants are defined at module level and used directly.
#[derive(Introspect, Drop, Serde)]
#[dojo::model]
pub struct SeriesChestRewardState {
    #[key]
    pub world_id: ID,

    // Runtime state
    pub game_index: u32,
    pub ema_players_scaled: u128, // players * BPS

    // Rolling windows
    pub recent: RecentRing,
    pub anchor: AnchorRing,

    // Last per-player rate (bps)
    pub has_last_rate: bool,
    pub last_rate_bps: u128,

    // Supplies (current state only)
    pub soft_supply: u128,
    pub overspend_remaining: u128,
}


#[derive(Introspect, Drop, Serde)]
#[dojo::model]
pub struct GameChestReward {
    #[key]
    pub world_id: ID,
    // max possible 
    pub allocated_chests: u16,
    // amount distributed
    pub distributed_chests: u16 // <= allocated_chests
}