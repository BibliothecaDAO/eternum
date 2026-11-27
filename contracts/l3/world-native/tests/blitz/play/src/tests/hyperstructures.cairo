use starknet::storage::StorageMapReadAccess;
pub use world_test_support::tests::troop_management::*;
use crate::map::TileOccupancy;
use crate::troops::Coord;
use super::fixture::{EAST, REALM_COORD, RESTED_AT, blitz_game, found_realm, record_roster};
use super::play_fixture::{FIXTURE_START, TestAction, play};
use super::resource_commands::{assert_executes, execute_in_game};

const NOW: u64 = FIXTURE_START + 40;

fn seated_pair() -> (super::Deployment, u32) {
    let (d, game_id) = blitz_game();
    let (rival, _) = super::deploy_player(3, super::GUARDIAN);
    record_roster(d, game_id, array![d.actor, rival].span());
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    (d, game_id)
}

fn site(d: super::Deployment, game_id: u32, index: u32) -> Coord {
    crate::settlement_grid::reservation_location(
        super::map_center(d.games, game_id), crate::logic::settlement::spacing(), index,
    )
}

fn occupier(d: super::Deployment, game_id: u32, coord: Coord) -> Option<TileOccupancy> {
    snforge_std::interact_with_state(
        d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)),
    )
}

fn raise(coord: Coord) -> super::Command {
    super::Command::RaiseHyperstructure(coord)
}

#[test]
fn a_two_player_roster_reserves_seven_hyperstructure_sites() {
    let (d, game_id) = seated_pair();
    for index in 0..7_u32 {
        let reservation = occupier(d, game_id, site(d, game_id, index)).unwrap();
        assert_eq!(reservation.category, crate::taxonomy::RESERVED_HYPERSTRUCTURE_OCCUPIER);
    }
    let beyond = occupier(d, game_id, site(d, game_id, 7));
    assert!(
        beyond.is_none() || beyond.unwrap().category != crate::taxonomy::RESERVED_HYPERSTRUCTURE_OCCUPIER,
        "a two player roster reserves seven sites",
    );
}

#[test]
fn a_reserved_site_raises_an_unowned_hyperstructure_behind_three_heavy_guards() {
    let (d, game_id) = seated_pair();
    let coord = site(d, game_id, 0);
    assert_executes(d, game_id, raise(coord), NOW);
    let key = ResourceKey { game_id, entity_id: crate::entity_ids::MAX_HOME_NAMESPACE.into() };
    let hyperstructure = IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap();
    assert_eq!(hyperstructure.base.category, crate::taxonomy::HYPERSTRUCTURE_CATEGORY);
    assert!(hyperstructure.owner == 0.try_into().unwrap(), "a raised hyperstructure has no owner");
    assert_eq!(
        occupier(d, game_id, coord),
        Some(
            TileOccupancy {
                entity_id: key.entity_id, category: crate::taxonomy::HYPERSTRUCTURE_OCCUPIER, is_structure: true,
            },
        ),
    );
    let guards = IGuardsDispatcher { contract_address: d.games };
    let expected = array![TroopType::Paladin, TroopType::Knight, TroopType::Crossbowman];
    for slot in 0..3_u8 {
        let guard = guards.guard(GuardKey { game_id, structure_id: key.entity_id, slot });
        assert_eq!(guard.troops.category, *expected.at(slot.into()));
        assert_eq!(guard.troops.tier, TroopTier::T2);
        assert!(guard.troops.count >= 1499 * RESOURCE_PRECISION, "a hyperstructure guard is heavy");
    }
    assert_eq!(guards.guard(GuardKey { game_id, structure_id: key.entity_id, slot: 3 }).troops.count, 0);
}

#[test]
fn a_site_raises_one_hyperstructure() {
    let (d, game_id) = seated_pair();
    let coord = site(d, game_id, 0);
    assert_executes(d, game_id, raise(coord), NOW);
    assert!(!execute_in_game(d, game_id, raise(coord), NOW));
}

#[test]
fn a_tile_without_a_reservation_raises_nothing() {
    let (d, game_id) = seated_pair();
    assert!(!execute_in_game(d, game_id, raise(REALM_COORD), NOW));
}

const WEST: u8 = 3;
const HELD: u64 = 1000;

fn player_points(d: super::Deployment, game_id: u32, player: starknet::ContractAddress) -> u128 {
    snforge_std::interact_with_state(d.games, || crate::state::read().season.player_points.read((game_id, player)))
}

fn attack(army: u64, target: ResourceKey) -> super::Command {
    super::Command::BattleGuard(crate::commands::Battle { attacker_id: army, defender_id: target.entity_id })
}

fn west_of(coord: Coord, steps: u32) -> Coord {
    let mut at = coord;
    for _ in 0..steps {
        at = crate::geometry::neighbor(at, WEST);
    }
    at
}

fn east_of(coord: Coord, steps: u32) -> Coord {
    super::fixture::step_east(coord, steps)
}

fn unguarded_hyperstructure() -> (super::Deployment, u32, starknet::ContractAddress, ResourceKey, Coord) {
    let (d, game_id) = blitz_game();
    let (rival, _) = super::deploy_player(3, super::GUARDIAN);
    record_roster(d, game_id, array![d.actor, rival].span());
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    assert_executes(d, game_id, super::Command::SeatBlitzRoster(()), NOW);
    let coord = site(d, game_id, 0);
    assert_executes(d, game_id, raise(coord), NOW);
    let key = ResourceKey { game_id, entity_id: crate::entity_ids::MAX_HOME_NAMESPACE.into() };
    snforge_std::interact_with_state(d.games, || crate::logic::guards::GuardState::reset(key));
    (d, game_id, rival, key, coord)
}

fn army_beside(
    d: super::Deployment, game_id: u32, owner: starknet::ContractAddress, realm_id: u64, realm: Coord, toward: u8,
) -> u64 {
    let home = ResourceKey { game_id, entity_id: realm_id };
    found_realm(d, home, owner, realm);
    super::fixture::raise(d, owner, home, TroopType::Knight, 0, 100, toward)
}

#[test]
fn an_army_takes_a_raised_hyperstructure_and_scores_the_hyperstructure_claim() {
    let (d, game_id, _, key, coord) = unguarded_hyperstructure();
    let army = army_beside(d, game_id, d.actor, 100, west_of(coord, 2), EAST);
    let before = player_points(d, game_id, d.actor);
    assert_executes(d, game_id, attack(army, key), RESTED_AT);
    assert!(IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap().owner == d.actor);
    assert_eq!(player_points(d, game_id, d.actor) - before, crate::balance::points::HYPERSTRUCTURE_CAPTURE_POINTS);
}

#[test]
fn a_rival_capture_pays_the_holder_for_each_second_held_per_neighbouring_realm() {
    let (d, game_id, rival, key, coord) = unguarded_hyperstructure();
    let mine = army_beside(d, game_id, d.actor, 100, west_of(coord, 2), EAST);
    let theirs = army_beside(d, game_id, rival, 101, east_of(coord, 2), WEST);
    let realms = two_more_watching_realms(d, key, coord, rival);
    assert_executes(d, game_id, attack(mine, key), RESTED_AT);
    let held = player_points(d, game_id, d.actor);
    assert!(
        play(d.games, TestAction { game_id, actor: rival, command: attack(theirs, key) }, 987654321, RESTED_AT + HELD),
    );
    assert!(IStructureOperationsDispatcher { contract_address: d.games }.structure(key).unwrap().owner == rival);
    assert_eq!(
        player_points(d, game_id, d.actor) - held,
        HELD.into() * crate::balance::points::HOLD_POINTS_PER_SECOND * realms,
    );
}

#[test]
fn settling_the_game_pays_the_holder_up_to_the_end_and_settles_it() {
    let (d, game_id, rival, key, coord) = unguarded_hyperstructure();
    let mine = army_beside(d, game_id, d.actor, 100, west_of(coord, 2), EAST);
    let realms = two_more_watching_realms(d, key, coord, rival);
    assert_executes(d, game_id, attack(mine, key), RESTED_AT);
    let held = player_points(d, game_id, d.actor);
    let end_at = game(d, game_id).end_at;
    assert!(!execute_in_game(d, game_id, super::Command::MarkGameSettled(()), end_at - 1));
    assert_executes(d, game_id, super::Command::MarkGameSettled(()), end_at + 600);
    assert_eq!(
        player_points(d, game_id, d.actor) - held,
        (end_at - RESTED_AT).into() * crate::balance::points::HOLD_POINTS_PER_SECOND * realms,
    );
    assert!(game(d, game_id).settled, "a settled Blitz game is marked settled");
}

#[test]
fn the_settled_holder_ranks_first_in_the_game_result() {
    let (d, game_id, rival, key, coord) = unguarded_hyperstructure();
    let mine = army_beside(d, game_id, d.actor, 100, west_of(coord, 2), EAST);
    assert_executes(d, game_id, attack(mine, key), RESTED_AT);
    super::results::settle(d, game_id);
    let players = array![
        crate::logic::blitz::results::RankedPlayer { wallet: d.actor, rank: 1 },
        crate::logic::blitz::results::RankedPlayer { wallet: rival, rank: 2 },
    ]
        .span();
    assert_eq!(
        super::results::result(d, game_id),
        crate::logic::blitz::results::BlitzResult {
            players, complete: true, commitment: super::results::commitment(d, game_id, players),
        },
    );
}

fn game(d: super::Deployment, game_id: u32) -> crate::game::GameRegistry {
    snforge_std::interact_with_state(d.games, || crate::logic::game::game(game_id))
}

fn two_more_watching_realms(
    d: super::Deployment, key: ResourceKey, coord: Coord, owner: starknet::ContractAddress,
) -> u128 {
    let before = snforge_std::interact_with_state(d.games, || crate::logic::blitz::hyperstructures::multiplier(key));
    let mut placed = 0_u128;
    let mut id = 200_u64;
    for point in crate::logic::blitz::hyperstructures::watch_points(coord) {
        if placed < 2 && occupier(d, key.game_id, *point).is_none() {
            found_realm(d, ResourceKey { game_id: key.game_id, entity_id: id }, owner, *point);
            placed += 1;
            id += 1;
        }
    }
    assert_eq!(placed, 2);
    before + placed
}
