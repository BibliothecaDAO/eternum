use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use eternum::{alias::ID, constants::WORLD_CONFIG_ID};

#[derive(IntrospectPacked, Copy, Drop, Serde)]
#[dojo::model]
pub struct Season {
    #[key]
    config_id: ID,
    start_at: u64,
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


    fn assert_has_started(world: WorldStorage) {
        let season: Season = world.read_model(WORLD_CONFIG_ID);
        let now = starknet::get_block_timestamp();
        assert!(
            season.start_at <= now,
            "Season starts in {} hours {} minutes, {} seconds",
            (season.start_at - now) / 60 / 60,
            ((season.start_at - now) / 60) % 60,
            (season.start_at - now) % 60
        );
    }


    fn assert_season_is_not_over(world: WorldStorage) {
        let season: Season = world.read_model(WORLD_CONFIG_ID);
        assert!(season.is_over == false, "Season is over");
    }
}
