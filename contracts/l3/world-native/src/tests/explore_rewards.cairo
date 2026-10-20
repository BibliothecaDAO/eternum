use snforge_std::{EventSpyTrait, EventsFilterTrait};
use crate::commands::{Command, CreateExplorer, Explore, Move, ToggleAlternate};
use crate::discovery::{Discovery, SPIRE_FIND_BPS, surface};
use crate::exploration_rewards::{ExplorationReward, ExtractedReward, pool_reward, spire_reward};
use crate::geometry::{neighbor, tile_key};
use crate::map::IMapLogicDispatcher;
use crate::resources::{ESSENCE, LABOR, ResourceKey};
use crate::rules::{DISCOVER_CAMPS, DISCOVER_SPIRES, RESOURCE_PRECISION};
use crate::tests::state::{GameState, MapObservationTrait, StructureObservationTrait, TroopObservationTrait};
use crate::troops::{ExplorerKey, TroopTier, Troops};
use super::play_fixture::{TestAction, play, rejection};

const DONKEY: u8 = 25;
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
fn a_spire_pays_a_thousand_essence_with_only_an_active_exploration_relic_bonus() {
    let reward = spire_reward(Default::default(), 40);
    assert_eq!(reward.resource_type, ESSENCE);
    assert_eq!(reward.amount, 1000 * RESOURCE_PRECISION);
    let boosts = crate::troops::TroopBoosts {
        incr_explore_reward_percent_num: 5000, incr_explore_reward_end_at: 100, ..Default::default(),
    };
    assert_eq!(spire_reward(boosts, 99).amount, 1500 * RESOURCE_PRECISION);
    assert_eq!(spire_reward(boosts, 100).amount, 1000 * RESOURCE_PRECISION);
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
/// The stories one action told.
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
/// The spire grants told by one action's stories.
fn spire_stories(ref spy: snforge_std::EventSpy, d: super::Deployment) -> Array<ExtractedReward> {
    let mut grants = array![];
    for story in stories(ref spy, d) {
        if let crate::ownership::Story::SpireDiscovered(grant) = story {
            grants.append(grant);
        }
    }
    grants
}
/// The reveal rewards told by one action's stories.
fn reveal_stories(ref spy: snforge_std::EventSpy, d: super::Deployment) -> Array<ExtractedReward> {
    let mut rewards = array![];
    for story in stories(ref spy, d) {
        if let crate::ownership::Story::ExplorationReward(reward) = story {
            rewards.append(reward);
        }
    }
    rewards
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
        amount: 1000 * RESOURCE_PRECISION,
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

/// The reward strength cap the current Blitz preset registers.
fn blitz_reward_cap() -> u16 {
    let (_, blitz) = super::preset_projection::current_definition("blitz");
    blitz.rules.troop_limit_config.explore_reward_strength_cap
}
/// The current Blitz preset's exploration pool.
fn blitz_rows() -> Span<ExplorationReward> {
    let (_, blitz) = super::preset_projection::current_definition("blitz");
    blitz.exploration
}

#[test]
fn each_blitz_row_pays_its_percent_of_strength_up_to_three_thousand() {
    // (resource, percent, draw weight) of the current Blitz pool, in its order.
    let table = array![
        (ESSENCE, 5_u128, 3500_u128), (ESSENCE, 10, 2500), (ESSENCE, 20, 1500), (LABOR, 10, 1500), (LABOR, 20, 500),
        (DONKEY, 10, 500),
    ];
    let rows = blitz_rows();
    assert_eq!(rows.len(), table.len());
    let mut limits = limits();
    limits.explore_reward_strength_cap = blitz_reward_cap();
    // 100, 500, 1k, 3k and 20k T1 and 334 T3 (strength 3,006), and what each row pays them in whole units.
    let armies = array![
        (100_u128, TroopTier::T1), (500, TroopTier::T1), (1000, TroopTier::T1), (3000, TroopTier::T1),
        (20000, TroopTier::T1), (334, TroopTier::T3),
    ];
    let paid = array![
        array![5_u128, 10, 20, 10, 20, 10], array![25, 50, 100, 50, 100, 50], array![50, 100, 200, 100, 200, 100],
        array![150, 300, 600, 300, 600, 300], array![150, 300, 600, 300, 600, 300],
        array![150, 300, 600, 300, 600, 300],
    ];
    for index in 0..table.len() {
        let (resource_type, percent, weight) = *table.at(index);
        let row = *rows.at(index);
        assert_eq!(
            (row.resource_type, row.percent, row.percent_max, row.weight), (resource_type, percent, percent, weight),
        );
        for army in 0..armies.len() {
            let (count, tier) = *armies.at(army);
            let troops = Troops { count: count * RESOURCE_PRECISION, tier, ..Default::default() };
            let reward = pool_reward(array![row].span(), troops, limits, 40, 7);
            assert_eq!(reward.resource_type, resource_type);
            assert_eq!(reward.amount, *paid.at(army).at(index) * RESOURCE_PRECISION);
        }
    }
}

/// A Blitz realm and its one army of `count` troops at `tier`, raised through the real command, under the Blitz
/// preset's reward cap. The fixture realm is a Settlement, so its deployment cap is raised for one army to hold 20k T1,
/// and its store to hold them; its explored tiles find nothing, so the army steps onto them and is paid there, on the
/// Blitz pool's largest Essence row.
fn blitz_army_of(count: u128, tier: u8) -> (super::Deployment, ResourceKey, ExplorerKey) {
    let mut rules = super::camps::rules(true);
    rules.map_config.camp_win_probability = 0;
    rules.map_config.camp_fail_probability = 1;
    rules.troop_limit_config.explore_reward_strength_cap = blitz_reward_cap();
    rules.troop_limit_config.settlement_deployment_cap = 40_000;
    rules.troop_limit_config.t1_tier_modifier = 50;
    rules.structure_capacity_config.realm_capacity = 1_000_000_000_000_000;
    let mut preset = super::resource_commands::fixture_preset(rules);
    preset.structures.board = None;
    preset.exploration = array![*blitz_rows().at(2)].span();
    let (d, home, _) = super::resource_commands::setup_with_preset(preset);
    super::resource_commands::grant(d, home, 26 + tier, count * RESOURCE_PRECISION);
    for food in array![35_u8, 36] {
        super::resource_commands::grant(d, home, food, 100_000 * RESOURCE_PRECISION);
    }
    let raise = CreateExplorer {
        structure_id: home.entity_id, category: 0, tier, amount: count * RESOURCE_PRECISION, direction: 0,
    };
    assert!(super::resource_commands::execute(d, Command::CreateExplorer(raise), 80));
    let structures = crate::structures::IStructureOperationsDispatcher { contract_address: d.games };
    (d, home, ExplorerKey { game_id: 3, explorer_id: *structures.home_armies(home).at(0) })
}

#[test]
fn a_blitz_explore_pays_on_at_most_three_thousand_strength() {
    assert_eq!(blitz_reward_cap(), 3000);
    // (troops, tier, Essence on the 20 percent row). 334 T3 is strength 3,006. Uncapped this would be 20, 100, 200,
    // 600, 4,000 and 601.2.
    let cases = array![
        (100_u128, 0_u8, 20_u128), (500, 0, 100), (1_000, 0, 200), (3_000, 0, 600), (20_000, 0, 600), (334, 2, 600),
    ];
    for (count, tier, essence) in cases {
        let (d, home, explorer) = blitz_army_of(count, tier);
        let origin = GameState { contract_address: d.games }.explorer(explorer).unwrap().coord;
        let mut spy = snforge_std::spy_events();
        assert!(explore(d, explorer, NO_SPIRE_ROOT));
        let paid = ExtractedReward {
            explorer_id: explorer.explorer_id,
            receiver: home.entity_id,
            coord: neighbor(origin, 0),
            resource_type: ESSENCE,
            amount: essence * RESOURCE_PRECISION,
        };
        assert_eq!(reveal_stories(ref spy, d), array![paid]);
    }
}

#[test]
fn a_blitz_spire_pays_a_thousand_for_one_t1_or_a_t3_army_above_the_reveal_cap() {
    assert_eq!(blitz_reward_cap(), 3000);
    for (count, tier) in array![(1_u128, 0_u8), (334, 2)] {
        let (d, home, explorer) = blitz_army_of(count, tier);
        let origin = GameState { contract_address: d.games }.explorer(explorer).unwrap().coord;
        let mut spy = snforge_std::spy_events();
        assert!(explore(d, explorer, SPIRE_ROOT));
        assert_eq!(
            spire_stories(ref spy, d),
            array![
                ExtractedReward {
                    explorer_id: explorer.explorer_id,
                    receiver: home.entity_id,
                    coord: neighbor(origin, 0),
                    resource_type: ESSENCE,
                    amount: 1000 * RESOURCE_PRECISION,
                },
            ],
        );
    }
}

#[test]
fn an_applied_exploration_relic_boosts_the_flat_spire_jackpot() {
    let (d, home, explorer) = blitz_army_of(1, 0);
    super::resource_commands::grant(d, home, ESSENCE, 1000 * RESOURCE_PRECISION);
    super::resource_commands::grant(
        d, ResourceKey { game_id: 3, entity_id: explorer.explorer_id }, 47, RESOURCE_PRECISION,
    );
    assert!(
        super::resource_commands::execute(
            d,
            Command::ApplyRelic(
                crate::relics::ApplyRelic {
                    entity_id: explorer.explorer_id, relic_id: 47, recipient: crate::relics::Recipient::Explorer,
                },
            ),
            130,
        ),
    );
    let army = GameState { contract_address: d.games }.explorer(explorer).unwrap();
    assert_eq!(army.troops.boosts.incr_explore_reward_percent_num, 10000);
    assert!(army.troops.boosts.incr_explore_reward_end_at > 140);
    let mut spy = snforge_std::spy_events();
    assert!(explore(d, explorer, SPIRE_ROOT));
    assert_eq!(
        spire_stories(ref spy, d),
        array![
            ExtractedReward {
                explorer_id: explorer.explorer_id,
                receiver: home.entity_id,
                coord: neighbor(army.coord, 0),
                resource_type: ESSENCE,
                amount: 2000 * RESOURCE_PRECISION,
            },
        ],
    );
}
