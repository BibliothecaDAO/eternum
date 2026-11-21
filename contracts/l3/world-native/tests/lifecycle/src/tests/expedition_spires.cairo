use snforge_std::{interact_with_state, spy_events};
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::spires::ExpeditionSpireKey;
use crate::troops::{ArmySlotKey, Coord, ExplorerKey};
use super::army_activity::{army, found, slot_army};

fn applied(d: Deployment, game_id: u32, command: Command, now: u64) {
    let mut events = spy_events();
    if !execute_in_game(d, game_id, command, now) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
    }
}

fn root_for_spire(game_id: u32) -> u256 {
    for value in 1_u64..1000 {
        let root: u256 = value.into();
        let mut remaining = root;
        let seed = crate::random::game_root(ref remaining, game_id);
        if crate::random::range(seed, 0x5350495245, 10000) < 10000 / crate::rules::SPIRE_REVEAL_LIMIT.into() {
            return root;
        }
    }
    panic!("missing first-reveal Spire draw")
}

fn explore_free_neighbor(d: Deployment, key: ExplorerKey, now: u64) {
    let origin = army(d, key).coord;
    let direction = interact_with_state(
        d.games,
        || {
            let mut direction = 0_u8;
            while direction < 6 {
                let destination = crate::geometry::neighbor(origin, direction);
                if crate::logic::map::occupancy(crate::geometry::tile_key(key.game_id, destination)).is_none() {
                    return direction;
                }
                direction += 1;
            }
            panic!("fixture army has no free neighbor");
        },
    );
    let mut events = spy_events();
    if !world_test_support::tests::play_fixture::play(
        d.games,
        world_test_support::tests::play_fixture::TestAction {
            game_id: key.game_id,
            actor: d.actor,
            command: Command::Explore(crate::commands::Explore { explorer_id: key.explorer_id, direction }),
        },
        root_for_spire(key.game_id),
        now,
    ) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
    }
}

fn follow_surface_path(d: Deployment, key: ExplorerKey, path: Span<Coord>, now: u64) {
    for destination in path {
        let origin = army(d, key).coord;
        if origin == *destination {
            continue;
        }
        let mut direction = 0_u8;
        while direction < 6 && crate::geometry::neighbor(origin, direction) != *destination {
            direction += 1;
        }
        assert!(direction < 6, "follower path must stay adjacent");
        applied(
            d,
            key.game_id,
            Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![direction].span() }),
            now,
        );
    }
}

#[test]
fn discovered_spires_take_a_real_army_through_each_layer_to_the_shared_deep() {
    let (d, game_id) = super::aspects::setup_aspects(93);
    let home = found(d, game_id, 1);
    let realm = ResourceKey { game_id, entity_id: home };
    let lore_price = interact_with_state(
        d.games,
        || {
            let mut cost = 0;
            for tier in 1..crate::research::LORE_SPIRES + 1 {
                cost += crate::logic::research::price(crate::research::ROW_LORE, tier).essence;
            }
            cost
        },
    );
    assert_eq!(lore_price, 17_500 * crate::rules::RESOURCE_PRECISION);
    let essence = interact_with_state(d.games, || crate::logic::resources::balance(realm, crate::resources::ESSENCE));
    world_test_support::tests::registrar::learn_spire_lore(
        d, realm, world_test_support::tests::play_fixture::FIXTURE_START,
    );
    assert_eq!(
        interact_with_state(d.games, || crate::logic::resources::balance(realm, crate::resources::ESSENCE)), essence,
    );
    let key = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 }),
    };
    let mut surface_path = array![army(d, key).coord];
    let mut now = world_test_support::tests::play_fixture::FIXTURE_START;
    for depth in 0_u8..3 {
        let spire_key = ExpeditionSpireKey { game_id, structure_id: home, epoch: 0, depth };
        assert!(interact_with_state(d.games, || crate::logic::spires::read(spire_key)).is_none());
        assert!(
            !execute_in_game(
                d,
                game_id,
                Command::EnterDepth(crate::commands::EnterDepth { explorer_id: key.explorer_id, depth: depth + 1 }),
                now,
            ),
        );
        for _ in 0_u8..8 {
            now += 600;
            explore_free_neighbor(d, key, now);
            if depth == 0 {
                surface_path.append(army(d, key).coord);
            }
            if interact_with_state(d.games, || crate::logic::spires::read(spire_key)).is_some() {
                break;
            }
        }
        let found = interact_with_state(d.games, || crate::logic::spires::read(spire_key)).unwrap();
        assert_eq!(found.reveals, 1);
        let portal = found.location.unwrap();
        assert!(crate::geometry::adjacent(army(d, key).coord, portal));
        assert_eq!(
            interact_with_state(d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, portal)))
                .unwrap()
                .category,
            crate::taxonomy::SPIRE_OCCUPIER,
        );
        if depth < 2 {
            assert!(
                !execute_in_game(
                    d,
                    game_id,
                    Command::EnterDepth(crate::commands::EnterDepth { explorer_id: key.explorer_id, depth: depth + 2 }),
                    now,
                ),
            );
        }
        applied(
            d,
            game_id,
            Command::EnterDepth(crate::commands::EnterDepth { explorer_id: key.explorer_id, depth: depth + 1 }),
            now,
        );
        let position = army(d, key).coord;
        if depth == 0 {
            let follower = ExplorerKey {
                game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 1 }),
            };
            follow_surface_path(d, follower, surface_path.span(), now);
            applied(
                d,
                game_id,
                Command::EnterDepth(crate::commands::EnterDepth { explorer_id: follower.explorer_id, depth: 1 }),
                now,
            );
            let arrival = army(d, follower).coord;
            let spacing = interact_with_state(d.games, || crate::logic::settlement::rules(game_id).spacing);
            assert_ne!(arrival, position);
            assert!(crate::geometry::adjacent(position, arrival));
            assert!(crate::expeditions::inside_region(position, arrival, spacing));
            assert_eq!(army(d, key).coord, position);
        }
        assert_eq!(interact_with_state(d.games, || crate::logic::expeditions::depth_at(game_id, position)), depth + 1);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep::contains(game_id, position)), depth == 2);
        assert_eq!(interact_with_state(d.games, || crate::logic::spires::read(spire_key)).unwrap(), found);
    }
}
