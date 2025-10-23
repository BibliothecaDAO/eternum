/// Interface for interacting with the season functionality within the game.
/// This trait provides functions to manage the game's seasons, including
/// closing the current season and claiming season prizes.
#[starknet::interface]
pub trait ISeasonSystems<T> {
    /// Closes the current game season and assigns the caller as the winner.
    ///
    /// This function can only be called when the following conditions are met:
    /// - The season has started and is not yet over
    /// - The calling player has accumulated enough registered points to end the game
    ///   (based on the 'points_for_win' threshold defined in victory_points_win_config)
    ///
    /// # Effects:
    /// - Marks the season as ended
    /// - Records the caller as the winner by emitting a SeasonEnded event
    /// - Grants the 'Warlord' achievement to the winner
    ///
    /// # Errors:
    /// - Fails if the season has not started or is already over
    /// - Fails if the player does not have enough points to end the game
    fn season_close(ref self: T);
}

#[dojo::contract]
pub mod season_systems {
    use dojo::event::EventStorage;
    use dojo::model::ModelStorage;
    use dojo::world::WorldStorage;
    use crate::constants::DEFAULT_NS;
    use crate::models::config::{SeasonConfigImpl, VictoryPointsWinConfig, WorldConfigUtilImpl};
    use crate::models::hyperstructure::PlayerRegisteredPoints;
    use crate::utils::achievements::index::{AchievementTrait, Tasks};


    #[derive(Copy, Drop, Serde)]
    #[dojo::event(historical: false)]
    struct SeasonEnded {
        #[key]
        winner_address: starknet::ContractAddress,
        timestamp: u64,
    }


    #[abi(embed_v0)]
    pub impl SeasonSystemsImpl of super::ISeasonSystems<ContractState> {
        fn season_close(ref self: ContractState) {
            let mut world: WorldStorage = self.world(DEFAULT_NS());
            SeasonConfigImpl::get(world).assert_started_and_not_over();

            // ensure season game mode is on
            let blitz_mode_on: bool = WorldConfigUtilImpl::get_member(world, selector!("blitz_mode_on"));
            assert!(blitz_mode_on == false, "Eternum: Not Season Game Mode");

            // ensure the the caller's points are enough to end the game
            let player_address = starknet::get_caller_address();
            let player_points: PlayerRegisteredPoints = world.read_model(player_address);
            let victory_points_win_config: VictoryPointsWinConfig = WorldConfigUtilImpl::get_member(
                world, selector!("victory_points_win_config"),
            );
            assert!(victory_points_win_config.points_for_win > 0, "Eternum: Points for win must be greater than 0");
            assert!(
                player_points.registered_points >= victory_points_win_config.points_for_win,
                "Eternum: Not enough points to end the game",
            );

            // end the season
            SeasonConfigImpl::end_season(ref world);

            // emit season end event
            let now = starknet::get_block_timestamp();
            world.emit_event(@SeasonEnded { winner_address: player_address, timestamp: now });

            // grant win season achievement
            AchievementTrait::progress(
                world, player_address.into(), Tasks::WIN_GAME, 1, starknet::get_block_timestamp(),
            );
        }
    }
}
