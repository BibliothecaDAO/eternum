use dojo::world::{IWorldDispatcher, IWorldDispatcherTrait};
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
    fn end_season(world: IWorldDispatcher) {
        let mut season: Season = get!(world, WORLD_CONFIG_ID, Season);
        season.is_over = true;
        set!(world, (season));
    }

    fn assert_season_is_not_over(world: IWorldDispatcher) {
        let season = get!(world, WORLD_CONFIG_ID, Season);
        assert!(season.is_over == false, "Season is over");
    }
}
