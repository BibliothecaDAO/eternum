pub use world_test_support::tests::troop_management::*;
use crate::map::TileOccupancy;
use crate::troops::Coord;
use super::fixture::{REALM_COORD, blitz_game, record_roster};
use super::play_fixture::FIXTURE_START;
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
