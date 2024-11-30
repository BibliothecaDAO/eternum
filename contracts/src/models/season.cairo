use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use eternum::{alias::ID, constants::WORLD_CONFIG_ID};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Season {
    #[key]
    config_id: ID,
    is_over: bool
}

#[generate_trait]
pub impl SeasonImpl of SeasonTrait {
    fn end_season(ref world: WorldStorage) {
        // world.read_model(
        let mut season: Season = world.read_model(WORLD_CONFIG_ID);
        season.is_over = true;
        world.write_model(@season);
    }

    fn assert_season_is_not_over(world: WorldStorage) {
        let season: Season = world.read_model(WORLD_CONFIG_ID);
        assert!(season.is_over == false, "Season is over");
    }
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct Leaderboard {
    #[key]
    config_id: ID,
    registration_end_timestamp: u64,
    total_points: u128,
    total_price_pool: Option<u256>,
    distribution_started: bool
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct LeaderboardRegistered {
    #[key]
    address: starknet::ContractAddress,
    registered: bool
}

#[derive(Introspect, Copy, Drop, Serde)]
#[dojo::model]
pub struct LeaderboardRewardClaimed {
    #[key]
    address: starknet::ContractAddress,
    claimed: bool
}

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct LeaderboardEntry {
    #[key]
    address: starknet::ContractAddress,
    points: u128
}

#[generate_trait]
pub impl LeaderboardEntryCustomImpl of LeaderboardEntryCustomTrait {
    fn get(ref world: WorldStorage, address: starknet::ContractAddress) -> LeaderboardEntry {
        let entry: LeaderboardEntry = world.read_model(address);
        entry
    }

    fn append(ref self: Leaderboard, ref world: WorldStorage, address: starknet::ContractAddress, points: u128) {
        // allow single registration per address to prevent `self.total_points` inflation
        let mut leaderboard_registered: LeaderboardRegistered = world.read_model(address);
        assert!(leaderboard_registered.registered == false, "Address already registered points");

        leaderboard_registered.registered = true;
        world.write_model(@leaderboard_registered);

        let mut leaderboard_entry = LeaderboardEntry { address, points };
        world.write_model(@leaderboard_entry);
        self.total_points += points;
        world.write_model(@self);
    }
}
