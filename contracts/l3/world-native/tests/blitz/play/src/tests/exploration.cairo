use snforge_std::interact_with_state;
use starknet::storage::StorageMapReadAccess;
pub use world_test_support::tests::troop_management::*;
use crate::discovery::Discovery;
use crate::troops::Coord;
use super::fixture::{ARMY_UNITS, REALM_COORD, RESTED_AT, blitz_army, step_east};
use super::registrar::explore_with_root;

const WHEAT: u8 = 35;
const DONKEY: u8 = 25;
const MINED: u8 = 38;

fn explore_wheat() -> u128 {
    crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_explore_wheat_cost.into() * ARMY_UNITS
}

pub fn find_root(game_id: u32, expected: Discovery, from: u64) -> u256 {
    for sample in from..10000 {
        let raw_root: u256 = sample.into();
        let mut root = raw_root;
        let seed = crate::random::game_root(ref root, game_id);
        if crate::logic::blitz::discovery::surface(
            crate::balance::rules::MAP_CONFIG, crate::balance::rules::SWITCHES.mode_rules, seed,
        ) == expected {
            return raw_root;
        }
    }
    panic!("no matching Blitz discovery root in bounded fixture search")
}

fn donkey_root(game_id: u32, troops: crate::troops::Troops) -> u256 {
    let mut from = 0;
    loop {
        let raw_root = find_root(game_id, Discovery::None, from);
        let mut root = raw_root;
        let _ = crate::random::game_root(ref root, game_id);
        let reward_seed = crate::random::game_root(ref root, game_id);
        let reward = crate::exploration_rewards::pool_reward(
            crate::balance::exploration::EXPLORATION_REWARDS.span(),
            troops,
            crate::balance::rules::TROOP_LIMIT_CONFIG,
            crate::balance::exploration::EXPLORATION_STRENGTH_CAP,
            RESTED_AT,
            reward_seed,
        );
        if reward.resource_type == DONKEY {
            break raw_root;
        }
        from = raw_root.try_into().unwrap() + 1;
    }
}

fn balance(d: super::Deployment, key: ResourceKey, resource_type: u8) -> u128 {
    resource(d).resource_balance(ResourceSlot { game_id: key.game_id, entity_id: key.entity_id, resource_type })
}

fn army(d: super::Deployment, home: ResourceKey, id: u64) -> ExplorerTroops {
    GameState { contract_address: d.games }.explorer(ExplorerKey { game_id: home.game_id, explorer_id: id }).unwrap()
}

fn map(d: super::Deployment) -> IMapLogicDispatcher {
    IMapLogicDispatcher { contract_address: d.games }
}

fn revealed(d: super::Deployment, game_id: u32, coord: Coord) -> bool {
    map(d)
        .tile(crate::geometry::tile_key(game_id, coord))
        .map(|tile| tile.data / crate::map::BIOME_SCALE % crate::map::BYTE_RANGE != 0)
        .unwrap_or(false)
}

pub fn site_at(d: super::Deployment, game_id: u32, coord: Coord) -> (ResourceKey, crate::structures::Structure) {
    let occupied = map(d).occupancy(crate::geometry::tile_key(game_id, coord)).expect('no site on the tile');
    assert!(occupied.is_structure);
    let key = ResourceKey { game_id, entity_id: occupied.entity_id };
    (key, IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap())
}

fn assert_light_guard(d: super::Deployment, site: ResourceKey) {
    let guard = interact_with_state(
        d.games,
        || crate::logic::guards::guard(GuardKey { game_id: site.game_id, structure_id: site.entity_id, slot: 0 }),
    );
    let limits = crate::balance::rules::TROOP_LIMIT_CONFIG;
    assert_eq!(guard.troops.tier, TroopTier::T1);
    assert!(guard.troops.count >= Into::<u16, u128>::into(limits.light_guard_lower_bound) * RESOURCE_PRECISION);
    assert!(guard.troops.count <= Into::<u16, u128>::into(limits.light_guard_upper_bound) * RESOURCE_PRECISION);
}

pub fn points(d: super::Deployment, game_id: u32) -> (u128, u128) {
    interact_with_state(
        d.games,
        || {
            let season = crate::state::read().season;
            (season.player_points.read((game_id, d.actor)), season.season_points.read(game_id))
        },
    )
}

pub fn awarded(ref spy: snforge_std::EventSpy, games: starknet::ContractAddress) -> Array<crate::game::PointsAwarded> {
    let mut awards = array![];
    for (_, event) in spy.get_events().emitted_by(games).events.span() {
        if *event.keys.at(0) == selector!("PointsAwarded") {
            let mut keys = event.keys.span().slice(1, event.keys.len() - 1);
            let mut data = event.data.span();
            awards.append(starknet::Event::deserialize(ref keys, ref data).unwrap());
        }
    }
    awards
}

#[test]
fn an_army_steps_onto_the_tile_it_reveals_and_scores_exploration_points() {
    let (d, home, id) = blitz_army();
    grant(d, home, WHEAT, 2 * explore_wheat());
    let first = find_root(home.game_id, Discovery::None, 0);
    let second = find_root(home.game_id, Discovery::None, first.try_into().unwrap() + 1);
    let mut spy = snforge_std::spy_events();
    assert!(explore_with_root(d, home.game_id, id, first, RESTED_AT));
    assert!(explore_with_root(d, home.game_id, id, second, RESTED_AT));
    assert_eq!(army(d, home, id).coord, step_east(REALM_COORD, 3));
    assert!(revealed(d, home.game_id, step_east(REALM_COORD, 3)));
    assert_eq!(balance(d, home, WHEAT), 0);
    let earned = crate::balance::points::EXPLORE_POINTS;
    assert_eq!(points(d, home.game_id), (2 * earned, 2 * earned));
    let awards = awarded(ref spy, d.games);
    assert_eq!(awards.len(), 2);
    let last = awards.at(1);
    assert!(*last.player == d.actor && *last.points == earned && *last.player_points == 2 * earned);
    assert!(*last.activity == crate::game::PointActivity::Exploration);
}

#[test]
fn a_reveal_pays_its_army_home_from_the_exploration_pool() {
    let (d, home, id) = blitz_army();
    grant(d, home, WHEAT, explore_wheat());
    let root = donkey_root(home.game_id, army(d, home, id).troops);
    let before = balance(d, home, DONKEY);
    assert!(explore_with_root(d, home.game_id, id, root, RESTED_AT));
    let limits = crate::balance::rules::TROOP_LIMIT_CONFIG;
    let strength = core::cmp::min(
        ARMY_UNITS * limits.t1_tier_strength.into(), crate::balance::exploration::EXPLORATION_STRENGTH_CAP.into(),
    );
    assert_eq!(balance(d, home, DONKEY) - before, strength * RESOURCE_PRECISION / 10);
}

#[test]
fn an_army_that_finds_a_mine_stays_beside_a_guarded_mine_that_produces() {
    let (d, home, id) = blitz_army();
    grant(d, home, WHEAT, explore_wheat());
    let before = balance(d, home, DONKEY);
    assert!(explore_with_root(d, home.game_id, id, find_root(home.game_id, Discovery::Mine, 0), RESTED_AT));
    assert_eq!(army(d, home, id).coord, step_east(REALM_COORD, 1));
    let (mine, structure) = site_at(d, home.game_id, step_east(REALM_COORD, 2));
    assert_eq!(structure.base.category, crate::taxonomy::MINE_CATEGORY);
    assert_eq!(structure.metadata.mine_kind, 1);
    assert_light_guard(d, mine);
    let kind = *crate::balance::resources::MINE_KINDS.span().at(0);
    assert_eq!(
        resource(d)
            .resource_production(
                ResourceSlot { game_id: home.game_id, entity_id: mine.entity_id, resource_type: MINED },
            )
            .production_rate,
        kind.production_rate,
    );
    assert!(!revealed(d, home.game_id, step_east(REALM_COORD, 3)));
    assert_eq!(balance(d, home, DONKEY), before);
    assert_eq!(
        points(d, home.game_id), (crate::balance::points::EXPLORE_POINTS, crate::balance::points::EXPLORE_POINTS),
    );
}

#[test]
fn an_army_that_finds_a_camp_reveals_its_surroundings_and_the_camp_holds_its_stores() {
    let (d, home, id) = blitz_army();
    grant(d, home, WHEAT, explore_wheat());
    assert!(explore_with_root(d, home.game_id, id, find_root(home.game_id, Discovery::Camp, 0), RESTED_AT));
    assert_eq!(army(d, home, id).coord, step_east(REALM_COORD, 1));
    let (camp, structure) = site_at(d, home.game_id, step_east(REALM_COORD, 2));
    assert_eq!(structure.base.category, crate::taxonomy::CAMP_CATEGORY);
    assert_light_guard(d, camp);
    for grant in crate::balance::structures::CAMP_GRANTS.span() {
        assert_eq!(balance(d, camp, *grant.resource_type), *grant.amount);
    }
    assert_eq!(
        resource(d)
            .resource_production(
                ResourceSlot {
                    game_id: home.game_id, entity_id: camp.entity_id, resource_type: crate::resources::LABOR,
                },
            )
            .production_rate,
        crate::balance::structures::CAMP_LABOR_RATE,
    );
    assert!(revealed(d, home.game_id, step_east(REALM_COORD, 3)));
}
