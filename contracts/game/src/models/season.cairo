use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use s1_eternum::{alias::ID};


#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Leaderboard {
    #[key]
    pub config_id: ID,
    pub registration_end_timestamp: u64,
    pub total_points: u128,
    pub total_price_pool: Option<u256>,
    pub distribution_started: bool,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct LeaderboardRegistered {
    #[key]
    pub address: starknet::ContractAddress,
    pub registered: bool,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct LeaderboardRegisterContribution {
    #[key]
    pub address: starknet::ContractAddress,
    #[key]
    pub hyperstructure_entity_id: ID,
    pub registered: bool,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct LeaderboardRegisterShare {
    #[key]
    pub address: starknet::ContractAddress,
    #[key]
    pub hyperstructure_entity_id: ID,
    #[key]
    pub epoch: u16,
    pub registered: bool,
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct LeaderboardRewardClaimed {
    #[key]
    pub address: starknet::ContractAddress,
    pub claimed: bool,
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct LeaderboardEntry {
    #[key]
    pub address: starknet::ContractAddress,
    pub points: u128,
}

#[generate_trait]
pub impl LeaderboardEntryImpl of LeaderboardEntryTrait {
    fn get(ref world: WorldStorage, address: starknet::ContractAddress) -> LeaderboardEntry {
        let entry: LeaderboardEntry = world.read_model(address);
        entry
    }

    fn register(ref self: Leaderboard, ref world: WorldStorage, address: starknet::ContractAddress, points: u128) {
        let mut leaderboard_registered: LeaderboardRegistered = world.read_model(address);
        if !leaderboard_registered.registered {
            leaderboard_registered.registered = true;
            world.write_model(@leaderboard_registered);
        }

        // update leaderboard entry points
        let mut leaderboard_entry: LeaderboardEntry = world.read_model(address);
        leaderboard_entry.points += points;
        world.write_model(@leaderboard_entry);

        // update leaderboard total points
        self.total_points += points;
        world.write_model(@self);
    }
}
