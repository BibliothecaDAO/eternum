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
    pub grant_elite_nft: bool,
}

#[generate_trait]
pub impl RankPrizeImpl of RankPrizeTrait {

    // Elite Invite NFTs
    fn check_grant_elite_nft(ref self: RankPrize, current_player_count: u16, total_player_count: u16) {
        if total_player_count <= 132 {
            // having it implemented this way means it could originally be set to true for a rank,
            // only to be changed to false if the number of players with that rank exceed the threshold
            //
            // e.g if the total player count is 100, threshold is 50
            // if current player count is 50, and the next player has the same rank,
            // nobody with that rank receives the NFT so supply doesn't exceed the limit
            let threshold = total_player_count / 2;
            self.grant_elite_nft = current_player_count <= threshold;
        } else {
            // note that in this case, if multiple players have the same rank 
            // that crosses the 66 limit, only the first 66 players receive the NFT
            //. so it is possible for some players with the same rank to receive the NFT
            // while others do not. this leaves a bit of room for rank submitter to decide
            // who gets the NFT in such cases 
            self.grant_elite_nft =  current_player_count <= 66;
        }
    }
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct RankList {
    #[key]
    pub trial_id: u128,
    #[key]
    pub rank: u16,
    #[key]
    pub index: u16,
    pub player: ContractAddress,
}
