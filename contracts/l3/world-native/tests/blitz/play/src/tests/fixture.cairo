use super::play_fixture::{FIXTURE_START, caller, create_game, fixture_params};

pub fn blitz_game() -> (super::Deployment, u32) {
    let deployment = super::setup_family(false, "StructuresLogic", "TroopsLogic", "GamesTest", crate::game::BLITZ);
    let params = crate::registrar::CreateGameParams { family: crate::game::BLITZ, ..fixture_params('blitz') };
    let game_id = create_game(deployment.games, params);
    caller(deployment.games, deployment.actor, FIXTURE_START);
    (deployment, game_id)
}
