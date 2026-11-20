pub use snforge_std::{EventSpyTrait, EventsFilterTrait};
pub use crate::commands::{Command, CreateExplorer, Explore, Move, ToggleAlternate};
pub use crate::discovery::{Discovery, SPIRE_FIND_BPS, surface};
pub use crate::exploration_rewards::{ExtractedReward, spire_reward};
pub use crate::geometry::{neighbor, tile_key};
pub use crate::map::IMapLogicDispatcher;
pub use crate::resources::{ESSENCE, LABOR, ResourceKey};
pub use crate::rules::{DISCOVER_CAMPS, RESOURCE_PRECISION};
pub use crate::tests::state::{GameState, MapObservationTrait, StructureObservationTrait, TroopObservationTrait};
pub use crate::troops::{ExplorerKey, TroopTier, Troops};
pub use super::play_fixture::{TestAction, play, rejection};
pub // Raw roots for game 3 whose explore seed finds, and misses, a spire.
const SPIRE_ROOT: u256 = 255;
pub const NO_SPIRE_ROOT: u256 = 1;
pub fn explore_seed(root: u256) -> u256 {
    let mut raw_root = root;
    crate::random::game_root(ref raw_root, 3)
}
pub fn blitz_army() -> (super::Deployment, ResourceKey, ExplorerKey) {
    let (d, home) = super::camps::setup(true);
    for resource in array![26_u8, 35, 36] {
        super::resource_commands::grant(d, home, resource, 100 * RESOURCE_PRECISION);
    }
    let raise = CreateExplorer {
        slot: 0, structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
    };
    assert!(super::resource_commands::execute(d, Command::CreateExplorer(raise), 80));
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: d.games };
    (d, home, ExplorerKey { game_id: 3, explorer_id: *structures.home_armies(home).at(0) })
}
pub fn explore(d: super::Deployment, explorer: ExplorerKey, root: u256) -> bool {
    let command = Command::Explore(Explore { explorer_id: explorer.explorer_id, direction: 0 });
    play(d.games, TestAction { game_id: 3, actor: d.actor, command }, root, 140)
}
pub /// The stories one action told.
 fn stories(ref spy: snforge_std::EventSpy, d: super::Deployment) -> Array<crate::ownership::Story> {
    let mut told = array![];
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) != selector!("StoryEvent") {
            continue;
        }
        let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
        let mut data = event.data.span();
        let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
        told.append(story.story);
    }
    told
}
pub /// The spire grants told by one action's stories.
 fn spire_stories(ref spy: snforge_std::EventSpy, d: super::Deployment) -> Array<ExtractedReward> {
    let mut grants = array![];
    for story in stories(ref spy, d) {
        if let crate::ownership::Story::SpireDiscovered(grant) = story {
            grants.append(grant);
        }
    }
    grants
}
pub /// The reveal rewards told by one action's stories.
 fn reveal_stories(ref spy: snforge_std::EventSpy, d: super::Deployment) -> Array<ExtractedReward> {
    let mut rewards = array![];
    for story in stories(ref spy, d) {
        if let crate::ownership::Story::ExplorationReward(reward) = story {
            rewards.append(reward);
        }
    }
    rewards
}
pub fn rejected_reason(d: super::Deployment, command: Command) -> ByteArray {
    let mut spy = snforge_std::spy_events();
    assert!(!play(d.games, TestAction { game_id: 3, actor: d.actor, command }, NO_SPIRE_ROOT, 150));
    rejection(ref spy, d.games).reason
}
pub /// The reward strength cap the current Blitz preset registers.
 fn blitz_reward_cap() -> u16 {
    let (_, blitz) = super::preset_projection::current_definition("blitz");
    blitz.rules.troop_limit_config.explore_reward_strength_cap
}
pub fn blitz_army_of(count: u128, tier: u8) -> (super::Deployment, ResourceKey, ExplorerKey) {
    let mut rules = super::camps::rules(true);
    rules.map_config.camp_win_probability = 0;
    rules.map_config.camp_fail_probability = 1;
    rules.troop_limit_config.explore_reward_strength_cap = blitz_reward_cap();
    rules.troop_limit_config.settlement_deployment_cap = 40_000;
    rules.troop_limit_config.t1_tier_modifier = 50;
    rules.structure_capacity_config.realm_capacity = 1_000_000_000_000_000;
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.structures.board = None;
    let (d, home, _) = super::resource_commands::setup_with_preset(preset);
    super::resource_commands::grant(d, home, 26 + tier, count * RESOURCE_PRECISION);
    for food in array![35_u8, 36] {
        super::resource_commands::grant(d, home, food, 100_000 * RESOURCE_PRECISION);
    }
    let raise = CreateExplorer {
        slot: 0, structure_id: home.entity_id, category: 0, tier, amount: count * RESOURCE_PRECISION, direction: 0,
    };
    assert!(super::resource_commands::execute(d, Command::CreateExplorer(raise), 80));
    for food in array![35_u8, 36] {
        super::resource_commands::grant(d, home, food, 100_000 * RESOURCE_PRECISION);
    }
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: d.games };
    (d, home, ExplorerKey { game_id: 3, explorer_id: *structures.home_armies(home).at(0) })
}
