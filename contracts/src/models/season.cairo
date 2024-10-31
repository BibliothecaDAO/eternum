use dojo::world::WorldStorage;
use dojo::model::ModelStorage;
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
