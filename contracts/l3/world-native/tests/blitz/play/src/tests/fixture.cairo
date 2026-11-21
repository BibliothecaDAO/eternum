use super::play_fixture::{FIXTURE_START, caller, create_game, fixture_params};
use super::resource_commands::set_fixture;

pub fn blitz_game() -> (super::Deployment, u32) {
    let deployment = super::setup_family(false, "StructuresLogic", "TroopsLogic", "GamesTest", crate::game::BLITZ);
    let params = crate::registrar::CreateGameParams { family: crate::game::BLITZ, ..fixture_params('blitz') };
    let game_id = create_game(deployment.games, params);
    caller(deployment.games, deployment.actor, FIXTURE_START);
    (deployment, game_id)
}

pub const WOOD: u8 = 3;
const STORE_CAPACITY: u128 = 1000000 * crate::rules::RESOURCE_PRECISION * 1000;

pub fn blitz_realm() -> (super::Deployment, crate::resources::ResourceKey) {
    let (deployment, game_id) = blitz_game();
    let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
    let realm = crate::structures::StructureRecord {
        owner: deployment.actor,
        base: crate::structures::StructureBase {
            troop_max_guard_count: 0,
            troop_max_explorer_count: 0,
            created_at: 0,
            category: crate::taxonomy::REALM_CATEGORY,
            level: 0,
            starting_troops_granted: false,
        },
        resources_packed: WOOD.into(),
        metadata: crate::structures::StructureMetadata {
            realm_id: 1, order: 0, has_wonder: false, village_realm: 0, mine_kind: 0, deepest_depth: 0,
        },
    };
    super::structure_rules::save(deployment, home, realm);
    let owner = array![home.game_id.into(), home.entity_id.into()].span();
    let store = crate::resources::Weight { capacity: STORE_CAPACITY, weight: 0 };
    set_fixture(deployment.games, selector!("resources"), selector!("weights"), owner, store);
    set_fixture(deployment.games, selector!("resources"), selector!("resource_exists"), owner, true);
    (deployment, home)
}
