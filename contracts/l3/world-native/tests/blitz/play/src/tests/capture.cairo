pub use world_test_support::tests::troop_management::*;
use crate::discovery::Discovery;
use super::exploration::{awarded, find_root, points, site_at};
use super::fixture::{REALM_COORD, RESTED_AT, blitz_army, blitz_army_of, rival_realm_at, step_east};
use super::registrar::explore_with_root;

const WHEAT: u8 = 35;
const KNIGHT_T3: u8 = 2;
const T3_CAP: u128 = 500;

fn owner(d: super::Deployment, key: ResourceKey) -> starknet::ContractAddress {
    IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap().owner
}

fn attack(army: u64, site: ResourceKey) -> super::Command {
    super::Command::BattleGuard(crate::commands::Battle { attacker_id: army, defender_id: site.entity_id })
}

fn storm(d: super::Deployment, army: u64, site: ResourceKey, from: u64) {
    let mut at = from;
    for _ in 0..10_u8 {
        if owner(d, site) == d.actor {
            return;
        }
        at += 3600;
        super::resource_commands::assert_executes(d, site.game_id, attack(army, site), at);
    }
    panic!("the army did not take the site in ten attacks")
}

fn rejected(d: super::Deployment, command: super::Command, game_id: u32, at: u64) -> ByteArray {
    let mut spy = snforge_std::spy_events();
    assert!(!super::resource_commands::execute_in_game(d, game_id, command, at));
    super::play_fixture::rejection(ref spy, d.games).reason
}

#[test]
fn an_army_that_beats_a_mine_guard_takes_the_mine_and_scores_capture_points() {
    let (d, home, id) = blitz_army_of(KNIGHT_T3, T3_CAP);
    grant(d, home, WHEAT, crate::balance::rules::TROOP_STAMINA_CONFIG.stamina_explore_wheat_cost.into() * T3_CAP);
    assert!(explore_with_root(d, home.game_id, id, find_root(home.game_id, Discovery::Mine, 0), RESTED_AT));
    let (mine, _) = site_at(d, home.game_id, step_east(REALM_COORD, 2));
    let mut spy = snforge_std::spy_events();
    storm(d, id, mine, RESTED_AT);
    let guard = snforge_std::interact_with_state(
        d.games,
        || crate::logic::guards::guard(GuardKey { game_id: mine.game_id, structure_id: mine.entity_id, slot: 0 }),
    );
    assert_eq!(guard.troops.count, 0);
    let earned = crate::balance::points::EXPLORE_POINTS + crate::balance::points::CAPTURE_POINTS;
    assert_eq!(points(d, home.game_id), (earned, earned));
    let awards = awarded(ref spy, d.games);
    assert_eq!(awards.len(), 1);
    let award = awards.at(0);
    assert!(*award.activity == crate::game::PointActivity::StructureCapture);
    assert!(*award.player == d.actor && *award.points == crate::balance::points::CAPTURE_POINTS);
}

#[test]
fn an_army_takes_a_rivals_unguarded_realm_without_scoring_points() {
    let (d, home, id) = blitz_army();
    let (rival, realm) = rival_realm_at(d, home, step_east(REALM_COORD, 2));
    assert_eq!(owner(d, realm), rival);
    let mut spy = snforge_std::spy_events();
    super::resource_commands::assert_executes(d, home.game_id, attack(id, realm), RESTED_AT);
    assert_eq!(owner(d, realm), d.actor);
    assert_eq!(points(d, home.game_id), (0, 0));
    assert_eq!(awarded(ref spy, d.games).len(), 0);
}

#[test]
fn an_army_cannot_attack_a_structure_its_owner_holds() {
    let (d, home, id) = blitz_army();
    assert_eq!(rejected(d, attack(id, home), home.game_id, RESTED_AT), "actor owns defender");
}
