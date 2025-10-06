use starknet::ContractAddress;
#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayersRankTrial {
    #[key]
    pub trial_id: u128,
    pub owner: ContractAddress,
    pub last_rank: u16,
    pub last_player_points: u128,
    pub total_player_points: u128,
    pub total_player_count_committed: u16,
    pub total_player_count_revealed: u16,
    pub total_prize_amount: u128,
    pub total_prize_amount_calculated: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayersRankFinal {
    #[key]
    pub world_id: u128,
    pub trial_id: u128,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerRank {
    #[key]
    pub trial_id: u128,
    #[key]
    pub player: ContractAddress,
    pub rank: u16,
    pub paid: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct RankPrize {
    #[key]
    pub trial_id: u128,
    #[key]
    pub rank: u16,
    pub total_players_same_rank_count: u16,
    pub total_prize_amount: u128,
}
