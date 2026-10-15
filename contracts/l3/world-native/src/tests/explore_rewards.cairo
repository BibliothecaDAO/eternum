use snforge_std::{EventSpyTrait, EventsFilterTrait};
use crate::commands::{Command, CreateExplorer, Explore, Move, ToggleAlternate};
use crate::discovery::{Discovery, SPIRE_FIND_BPS, surface};
use crate::exploration_rewards::{ExplorationReward, ExtractedReward, pool_reward, spire_reward};
use crate::geometry::{neighbor, tile_key};
use crate::map::IMapLogicDispatcher;
use crate::resources::{ESSENCE, ResourceKey};
use crate::rules::{DISCOVER_CAMPS, DISCOVER_SPIRES, RESOURCE_PRECISION};
use crate::tests::state::{GameState, MapObservationTrait, StructureObservationTrait, TroopObservationTrait};
use crate::troops::{ExplorerKey, TroopTier, Troops};
use super::play_fixture::{TestAction, play, rejection};

// Raw roots for game 3 whose explore seed finds, and misses, a spire.
const SPIRE_ROOT: u256 = 255;
const NO_SPIRE_ROOT: u256 = 1;

fn limits() -> crate::rules::TroopLimitConfig {
    super::play_fixture::rules().troop_limit_config
}
fn army(thousands: u128, tier: TroopTier) -> Troops {
    Troops { count: thousands * 1000 * RESOURCE_PRECISION, tier, ..Default::default() }
}
fn essence_row(percent: u128) -> Span<ExplorationReward> {
    array![ExplorationReward { resource_type: ESSENCE, percent, percent_max: percent, weight: 1 }].span()
}
fn explore_seed(root: u256) -> u256 {
    let mut raw_root = root;
    crate::random::game_root(ref raw_root, 3)
}

#[test]
fn a_pool_reveal_pays_its_row_percent_of_army_strength() {
    // A 60 percent row is the Blitz pool's largest Essence find.
    let strengths = limits();
    assert_eq!((strengths.t1_tier_strength, strengths.t2_tier_strength, strengths.t3_tier_strength), (1, 3, 9));
    let tiers = array![(TroopTier::T1, 1_u128), (TroopTier::T2, 3), (TroopTier::T3, 9)];
    for (tier, strength) in tiers {
        for thousands in array![1_u128, 5, 20] {
            let reward = pool_reward(essence_row(60), army(thousands, tier), strengths, 40, 7);
            assert_eq!(reward.resource_type, ESSENCE);
            assert_eq!(reward.amount, thousands * 1000 * strength * 60 / 100 * RESOURCE_PRECISION);
        }
    }
}

#[test]
fn an_active_exploration_relic_boosts_a_pool_reveal_and_an_expired_one_does_not() {
    let mut troops = army(1, TroopTier::T1);
    troops.boosts.incr_explore_reward_percent_num = 5000;
    troops.boosts.incr_explore_reward_end_at = 100;
    assert_eq!(pool_reward(essence_row(30), troops, limits(), 99, 7).amount, 450 * RESOURCE_PRECISION);
    assert_eq!(pool_reward(essence_row(30), troops, limits(), 100, 7).amount, 300 * RESOURCE_PRECISION);
}

#[test]
fn a_spire_pays_three_times_army_strength_in_essence() {
    let reward = spire_reward(army(1, TroopTier::T1), limits(), 40);
    assert_eq!(reward.resource_type, ESSENCE);
    assert_eq!(reward.amount, 3000 * RESOURCE_PRECISION);
    assert_eq!(spire_reward(army(5, TroopTier::T3), limits(), 40).amount, 135000 * RESOURCE_PRECISION);
}

#[test]
fn a_spire_root_finds_a_spire_only_under_the_spire_rule() {
    let config = super::camps::rules(true).map_config;
    let hit = explore_seed(SPIRE_ROOT);
    let miss = explore_seed(NO_SPIRE_ROOT);
    assert_eq!(surface(config, hit, 1, 0, DISCOVER_SPIRES + DISCOVER_CAMPS), Discovery::Spire);
    assert_eq!(surface(config, miss, 1, 0, DISCOVER_SPIRES + DISCOVER_CAMPS), Discovery::Camp);
    assert_eq!(surface(config, hit, 1, 0, DISCOVER_CAMPS), Discovery::Camp);
}

#[test]
fn about_one_reveal_in_two_hundred_finds_a_spire() {
    let mut config = super::camps::rules(true).map_config;
    config.camp_win_probability = 0;
    config.camp_fail_probability = 1;
    let mut spires: u128 = 0;
    for sample in 0_u64..10000 {
        if surface(config, 0x5350495245 + sample.into(), 1, 0, DISCOVER_SPIRES) == Discovery::Spire {
            spires += 1;
        }
    }
    // The expected 50 has a standard deviation of about 7 over 10000 draws.
    assert!(spires >= SPIRE_FIND_BPS - 21 && spires <= SPIRE_FIND_BPS + 21, "spire rate outside 0.5 +/- 0.21 percent");
    println!("10000 reveals: {} spires", spires);
}

fn blitz_army() -> (super::Deployment, ResourceKey, ExplorerKey) {
    let (d, home) = super::camps::setup(true);
    for resource in array![26_u8, 35, 36] {
        super::resource_commands::grant(d, home, resource, 100 * RESOURCE_PRECISION);
    }
    let raise = CreateExplorer {
        structure_id: home.entity_id, category: 0, tier: 0, amount: RESOURCE_PRECISION, direction: 0,
    };
    assert!(super::resource_commands::execute(d, Command::CreateExplorer(raise), 80));
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: d.games };
    (d, home, ExplorerKey { game_id: 3, explorer_id: *structures.home_armies(home).at(0) })
}
fn explore(d: super::Deployment, explorer: ExplorerKey, root: u256) -> bool {
    let command = Command::Explore(Explore { explorer_id: explorer.explorer_id, direction: 0 });
    play(d.games, TestAction { game_id: 3, actor: d.actor, command }, root, 140)
}
/// The spire grants told by one action's stories.
fn spire_stories(ref spy: snforge_std::EventSpy, d: super::Deployment) -> Array<ExtractedReward> {
    let mut grants = array![];
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) != selector!("StoryEvent") {
            continue;
        }
        let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
        let mut data = event.data.span();
        let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref keys, ref data).unwrap();
        if let crate::ownership::Story::SpireDiscovered(grant) = story.story {
            grants.append(grant);
        }
    }
    grants
}
fn rejected_reason(d: super::Deployment, command: Command) -> ByteArray {
    let mut spy = snforge_std::spy_events();
    assert!(!play(d.games, TestAction { game_id: 3, actor: d.actor, command }, NO_SPIRE_ROOT, 150));
    rejection(ref spy, d.games).reason
}

#[test]
fn a_blitz_explore_on_a_spire_root_raises_a_dormant_spire_and_pays_its_finder_once() {
    let (d, home, explorer) = blitz_army();
    let troops = GameState { contract_address: d.games };
    let origin = troops.explorer(explorer).unwrap().coord;
    let mut spy = snforge_std::spy_events();
    assert!(explore(d, explorer, SPIRE_ROOT));
    let spire = neighbor(origin, 0);
    let occupancy = IMapLogicDispatcher { contract_address: d.games }.occupancy(tile_key(3, spire)).unwrap();
    assert_eq!(occupancy.category, crate::taxonomy::DORMANT_SPIRE_OCCUPIER);
    assert!(!occupancy.is_structure);
    assert_eq!(troops.explorer(explorer).unwrap().coord, origin);
    let grant = ExtractedReward {
        explorer_id: explorer.explorer_id,
        receiver: home.entity_id,
        coord: spire,
        resource_type: ESSENCE,
        amount: 3 * RESOURCE_PRECISION,
    };
    assert_eq!(spire_stories(ref spy, d), array![grant]);
}

#[test]
fn a_blitz_explore_on_another_root_finds_no_spire() {
    let (d, _, explorer) = blitz_army();
    let origin = GameState { contract_address: d.games }.explorer(explorer).unwrap().coord;
    let mut spy = snforge_std::spy_events();
    assert!(explore(d, explorer, NO_SPIRE_ROOT));
    let found = IMapLogicDispatcher { contract_address: d.games }.occupancy(tile_key(3, neighbor(origin, 0))).unwrap();
    assert_eq!(found.category, crate::taxonomy::CAMP_OCCUPIER);
    assert_eq!(spire_stories(ref spy, d), array![]);
}

#[test]
fn a_dormant_spire_opens_no_portal_and_lets_no_army_onto_its_tile() {
    let (d, _, explorer) = blitz_army();
    assert!(explore(d, explorer, SPIRE_ROOT));
    let id = explorer.explorer_id;
    let mut spy = snforge_std::spy_events();
    assert_eq!(
        rejected_reason(d, Command::ToggleAlternate(ToggleAlternate { explorer_id: id, spire_direction: 0 })),
        "explorer must be adjacent to spire",
    );
    assert_eq!(
        rejected_reason(d, Command::Move(Move { explorer_id: id, directions: array![0].span() })),
        "movement tile occupied",
    );
    assert_eq!(rejected_reason(d, Command::Explore(Explore { explorer_id: id, direction: 0 })), "destination occupied");
    assert_eq!(spire_stories(ref spy, d), array![]);
}
