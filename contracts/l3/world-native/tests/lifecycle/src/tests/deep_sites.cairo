use snforge_std::{interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::play_fixture::FIXTURE_START;
use world_test_support::tests::resource_commands::{execute_in_game, set_explorer_fixture};
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::troops::{ArmySlotKey, ExplorerKey, ExplorerTroops};
use super::army_activity::{army, found, muster, player, slot_army};

fn setup(seed: felt252) -> (Deployment, u32) {
    super::aspects::setup_aspects(seed)
}

pub fn beast(d: Deployment, target: ResourceKey) -> u128 {
    interact_with_state(
        d.games,
        || crate::logic::guards::guard(
            crate::guards::GuardKey { game_id: target.game_id, structure_id: target.entity_id, slot: 0 },
        )
            .troops
            .count,
    )
}

pub fn wound_beast(d: Deployment, target: ResourceKey, troops: u128) {
    interact_with_state(
        d.games,
        || {
            let key = crate::guards::GuardKey { game_id: target.game_id, structure_id: target.entity_id, slot: 0 };
            let guard = crate::logic::guards::guard(key);
            crate::logic::guards::GuardState::save(
                key,
                crate::guards::Guard {
                    troops: crate::troops::Troops { count: troops * crate::rules::RESOURCE_PRECISION, ..guard.troops },
                    ..guard,
                },
            );
        },
    );
}

pub fn seize(d: Deployment, key: ExplorerKey, target: ResourceKey, direction: u8) {
    beside(d, key, target, direction);
    wound_beast(d, target, 0);
    applied(d, key.game_id, join(d, key, target), FIXTURE_START);
}

pub fn deployed(d: Deployment, game_id: u32, aspect: u8, count: u128) -> ExplorerKey {
    let home = found(d, game_id, aspect);
    let first = slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 });
    let second = slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 1 });
    let start = army(d, ExplorerKey { game_id, explorer_id: first }).troops.count / crate::rules::RESOURCE_PRECISION;
    assert!(count > 0 && count < 2 * start, "invalid starting-army test count");
    if count < start {
        transfer(d, game_id, first, second, start - count);
    } else if count > start {
        transfer(d, game_id, second, first, count - start);
    }
    let key = ExplorerKey { game_id, explorer_id: first };
    descend(d, key, FIXTURE_START);
    key
}

pub fn transfer(d: Deployment, game_id: u32, source: u64, target: u64, count: u128) {
    applied(
        d,
        game_id,
        Command::ManageTroops(
            crate::troop_management::ManageTroops::Transfer(
                crate::troop_management::TransferTroops {
                    source: crate::troop_management::Army::Explorer(source),
                    target: crate::troop_management::Army::Explorer(target),
                    amount: count * crate::rules::RESOURCE_PRECISION,
                },
            ),
        ),
        FIXTURE_START,
    );
}

pub fn descend(d: Deployment, key: ExplorerKey, now: u64) {
    let game_id = key.game_id;
    let home = army(d, key).owner;
    world_test_support::tests::registrar::learn_spire_lore(d, ResourceKey { game_id, entity_id: home }, now);
    let context = crate::tests::context(d.games, game_id);
    let epoch = crate::days::day_of(context.game.unbox(), context.rules.unbox().day_unit_seconds, now).index;
    for depth in 0_u8..3 {
        let spire_key = crate::spires::ExpeditionSpireKey { game_id, structure_id: home, epoch, depth };
        let found = interact_with_state(d.games, || crate::logic::spires::read(spire_key)).and_then(|row| row.location);
        if let Some(spire) = found {
            set_explorer_fixture(
                d.games, key, ExplorerTroops { coord: crate::geometry::neighbor(spire, 0), ..army(d, key) },
            );
        } else {
            let spire = crate::geometry::neighbor(army(d, key).coord, 0);
            let mut found = false;
            while !found {
                found = interact_with_state(d.games, || crate::logic::spires::discover(spire_key, spire, 0));
            }
        }
        applied(
            d,
            game_id,
            Command::EnterDepth(crate::commands::EnterDepth { explorer_id: key.explorer_id, depth: depth + 1 }),
            now,
        );
    }
}

pub fn applied(d: Deployment, game_id: u32, command: Command, now: u64) {
    let mut events = spy_events();
    if !execute_in_game(d, game_id, command, now) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
    }
}

fn refused(d: Deployment, game_id: u32, command: Command, now: u64, reason: ByteArray) {
    let mut events = spy_events();
    assert!(!execute_in_game(d, game_id, command, now));
    assert_eq!(world_test_support::tests::play_fixture::rejection(ref events, d.games).reason, reason);
}

pub fn site(d: Deployment, game_id: u32, kind: u8) -> ResourceKey {
    interact_with_state(
        d.games,
        || {
            let mut found = None;
            for index in 0..crate::rules::DEEP_RING_SITES {
                let key = ResourceKey { game_id, entity_id: crate::logic::deep_sites::site_id(game_id, index) };
                if crate::logic::deep_sites::site(key).unwrap().kind == kind {
                    found = Some(key);
                }
            }
            found.expect('no Deep site of that kind')
        },
    )
}

fn ring_site(d: Deployment, game_id: u32, ring: u8, kind: u8) -> ResourceKey {
    interact_with_state(
        d.games,
        || {
            let mut found = None;
            for place in 0..crate::rules::DEEP_RING_SITES {
                let index = ring * crate::rules::DEEP_RING_SITES + place;
                let key = ResourceKey { game_id, entity_id: crate::logic::deep_sites::site_id(game_id, index) };
                if crate::logic::deep_sites::site(key).unwrap().kind == kind {
                    found = Some(key);
                }
            }
            found.expect('no Deep site of that kind')
        },
    )
}

fn walk(key: ExplorerKey, directions: Span<u8>) -> Command {
    Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions })
}

pub fn gate(d: Deployment, game_id: u32, aspect: u8) -> crate::troops::Coord {
    interact_with_state(
        d.games,
        || {
            let distance = crate::logic::deep_sites::rules().gate_distance;
            crate::deep::gate(distance, aspect, crate::logic::settlement::rules(game_id).spacing)
        },
    )
}

pub fn beside(d: Deployment, key: ExplorerKey, target: ResourceKey, direction: u8) {
    let coord = interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap());
    set_explorer_fixture(
        d.games, key, ExplorerTroops { coord: crate::geometry::neighbor(coord, direction), ..army(d, key) },
    );
}

pub fn fight(key: ExplorerKey, target: ResourceKey) -> Command {
    Command::BattleGuard(
        crate::commands::Battle { attacker_id: key.explorer_id, defender_id: target.entity_id, relic_slot: None },
    )
}

pub fn join(d: Deployment, key: ExplorerKey, target: ResourceKey) -> Command {
    Command::InteractSite(
        crate::relics::InteractSite {
            explorer_id: key.explorer_id,
            coord: interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap()),
        },
    )
}

pub fn held(d: Deployment, key: ExplorerKey) -> Option<crate::deep::DeepGuard> {
    interact_with_state(d.games, || crate::state::read().deep.guards.read((key.game_id, key.explorer_id)))
}

#[test]
fn the_release_deep_gates_and_sites_fit_the_map_apart_from_each_other() {
    crate::deep::assert_layout_fits();
}

#[test]
fn every_deep_site_is_an_unowned_structure_with_four_guard_slots_and_its_defender_in_the_first() {
    let (d, game_id) = setup(97);
    let sites = interact_with_state(d.games, || crate::logic::deep_sites::site_count());
    for index in 0..sites {
        let site = ResourceKey {
            game_id, entity_id: interact_with_state(d.games, || crate::logic::deep_sites::site_id(game_id, index)),
        };
        let structure = interact_with_state(d.games, || crate::logic::structures::structure(site)).unwrap();
        assert_eq!(structure.owner, 0.try_into().unwrap());
        assert_eq!(structure.base.category, crate::taxonomy::DEEP_SITE_CATEGORY);
        assert_eq!(structure.base.troop_max_guard_count, crate::rules::DEEP_GUARD_SLOTS);
        let coord = interact_with_state(d.games, || crate::logic::map::entity_coord(site)).unwrap();
        let tile = interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(game_id, coord)),
        )
            .unwrap();
        assert!(
            tile.is_structure
                && tile.category == crate::taxonomy::DEEP_SITE_OCCUPIER
                && tile.entity_id == site.entity_id,
        );
        assert!(beast(d, site) != 0);
    }
}

#[test]
fn distinct_homes_enter_one_deep_and_move_on_its_fixed_terrain() {
    let (d, game_id) = setup(81);
    let first = deployed(d, game_id, 1, 10);
    let second = deployed(player(d, 8101), game_id, 2, 10);
    let third = deployed(player(d, 8102), game_id, 1, 10);
    let a = army(d, first).coord;
    let b = army(d, second).coord;
    assert_eq!(a, gate(d, game_id, 1));
    assert_eq!(b, gate(d, game_id, 2));
    assert!(crate::geometry::adjacent(army(d, third).coord, a));
    interact_with_state(d.games, || assert_eq!(crate::state::read().deep.realms_entered.read((game_id, 0)), 3));
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let target = site(d, game_id, kind);
        assert!(target.entity_id != 0);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(target).unwrap().day), 0);
        let guard = interact_with_state(
            d.games,
            || crate::logic::guards::guard(
                crate::guards::GuardKey { game_id, structure_id: target.entity_id, slot: 0 },
            ),
        );
        assert_eq!(
            guard.troops.category,
            if kind == crate::rules::DEEP_ALTAR || kind == crate::rules::DEEP_CORE {
                crate::troops::TroopType::Crossbowman
            } else {
                crate::troops::TroopType::Knight
            },
        );
    }
    let mut direction = 3_u8;
    while crate::geometry::neighbor(a, direction) == army(d, third).coord {
        direction += 1;
    }
    applied(
        d,
        game_id,
        Command::Move(crate::commands::Move { explorer_id: first.explorer_id, directions: array![direction].span() }),
        FIXTURE_START,
    );
    assert_eq!(army(d, first).coord, crate::geometry::neighbor(a, direction));
    assert_eq!(army(d, first).troops.count, 10 * crate::rules::RESOURCE_PRECISION);
}

#[test]
fn an_army_walks_through_another_army_in_the_deep_but_cannot_stop_on_it() {
    let (d, game_id) = setup(85);
    let first = deployed(d, game_id, 1, 10);
    let second = deployed(player(d, 8501), game_id, 1, 10);
    let start = army(d, first).coord;
    let blocker = army(d, second).coord;
    let mut direction = 0_u8;
    while crate::geometry::neighbor(start, direction) != blocker {
        direction += 1;
    }
    refused(d, game_id, walk(first, array![direction].span()), FIXTURE_START, "movement tile occupied");
    applied(d, game_id, walk(first, array![direction, direction].span()), FIXTURE_START);
    assert_eq!(army(d, first).coord, crate::geometry::neighbor(blocker, direction));
    assert_eq!(army(d, second).coord, blocker);
}

#[test]
fn a_later_ring_refuses_moves_joins_and_attacks_until_enough_realms_entered_today() {
    let (d, game_id) = setup(880);
    let first = deployed(d, game_id, 1, 10);
    let needed = crate::logic::deep_sites::ring(1).realms;
    interact_with_state(d.games, || crate::state::write().deep.realms_entered.write((game_id, 0), needed - 1));
    let target = ring_site(d, game_id, 1, crate::rules::DEEP_FOUNDATION);
    beside(d, first, target, 0);
    refused(d, game_id, walk(first, array![3].span()), FIXTURE_START, "movement tile occupied");
    refused(d, game_id, walk(first, array![3, 3].span()), FIXTURE_START, "movement tile occupied");
    let across = interact_with_state(
        d.games, || crate::geometry::neighbor(crate::logic::map::entity_coord(target).unwrap(), 3),
    );
    applied(d, game_id, walk(first, array![4, 3, 2].span()), FIXTURE_START);
    assert_eq!(army(d, first).coord, across);
    beside(d, first, target, 0);
    refused(d, game_id, join(d, first, target), FIXTURE_START, "Deep ring closed");
    refused(d, game_id, fight(first, target), FIXTURE_START, "Deep ring closed");
    deployed(player(d, 8801), game_id, 2, 10);
    wound_beast(d, target, 0);
    applied(d, game_id, fight(first, target), FIXTURE_START);
    assert_eq!(held(d, first), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
}

#[test]
fn four_allies_guard_one_site_and_a_rival_fights_exactly_one_slot_per_attack() {
    let (d, game_id) = setup(82);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let mut guards = array![];
    for slot in 0_u8..crate::rules::DEEP_GUARD_SLOTS {
        let member = player(d, 8200 + slot.into());
        let key = deployed(member, game_id, 1, 10);
        beside(d, key, target, slot);
        if slot == 0 {
            refused(member, game_id, join(d, key, target), FIXTURE_START, "Deep beast still guards site");
            wound_beast(d, target, 0);
        }
        applied(member, game_id, join(d, key, target), FIXTURE_START);
        assert_eq!(held(d, key), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot }));
        let field = crate::geometry::tile_key(
            game_id,
            crate::geometry::neighbor(
                interact_with_state(d.games, || crate::logic::map::entity_coord(target).unwrap()), slot,
            ),
        );
        assert!(interact_with_state(d.games, || crate::logic::map::occupancy(field)).is_none());
        refused(
            member,
            game_id,
            Command::Move(crate::commands::Move { explorer_id: key.explorer_id, directions: array![0].span() }),
            FIXTURE_START,
            "army is guarding a Deep site",
        );
        guards.append(key);
    }
    let fifth = player(d, 8204);
    let waiting = deployed(fifth, game_id, 1, 10);
    beside(d, waiting, target, 4);
    refused(fifth, game_id, join(d, waiting, target), FIXTURE_START, "Deep site has four guards");
    refused(fifth, game_id, fight(waiting, target), FIXTURE_START, "cannot attack an allied army");
    let rival = player(d, 8205);
    let attacker = deployed(rival, game_id, 2, 1000);
    beside(d, attacker, target, 5);
    refused(rival, game_id, join(d, attacker, target), FIXTURE_START, "Deep site belongs to another Aspect");
    for remaining in 0_u8..crate::rules::DEEP_GUARD_SLOTS {
        let slot = crate::rules::DEEP_GUARD_SLOTS - 1 - remaining;
        let before = army(d, *guards.at(0));
        applied(rival, game_id, fight(attacker, target), FIXTURE_START);
        assert!(held(d, *guards.at(slot.into())).is_none());
        for lower in 0..slot {
            assert_eq!(held(d, *guards.at(lower.into())).unwrap().slot, lower);
        }
        if slot != 0 {
            assert_eq!(army(d, *guards.at(0)), before);
            assert!(held(d, attacker).is_none());
        }
    }
    assert_eq!(held(d, attacker), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    assert!(army(d, attacker).troops.count > 0);
}

#[test]
fn a_rival_fights_the_guard_that_came_in_last_even_after_a_lower_slot_emptied() {
    let (d, game_id) = setup(86);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    wound_beast(d, target, 0);
    let mut guards = array![];
    for (salt, count) in array![(8600_felt252, 1000_u128), (8601, 10), (8602, 1000)] {
        let member = player(d, salt);
        let key = deployed(member, game_id, 1, count);
        beside(d, key, target, guards.len().try_into().unwrap());
        applied(member, game_id, join(d, key, target), FIXTURE_START);
        guards.append(key);
    }
    let (first, short, third) = (*guards.at(0), *guards.at(1), *guards.at(2));
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let now = FIXTURE_START + interval;
    let late = player(d, 8603);
    let last = deployed(late, game_id, 1, 1000);
    beside(d, last, target, 3);
    applied(late, game_id, join(d, last, target), now);
    assert!(held(d, short).is_none());
    assert_eq!(held(d, first), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    assert_eq!(held(d, third), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 1 }));
    assert_eq!(held(d, last), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 2 }));
    let rival = player(d, 8604);
    let attacker = deployed(rival, game_id, 2, 1500);
    beside(d, attacker, target, 4);
    let (first_before, third_before, last_before) = (army(d, first), army(d, third), army(d, last));
    applied(rival, game_id, fight(attacker, target), now);
    assert_eq!(army(d, first), first_before);
    assert_eq!(army(d, third), third_before);
    let hit = interact_with_state(d.games, || crate::logic::troops::explorer(last));
    assert!(hit.is_none() || hit.unwrap().troops.count < last_before.troops.count);
}

#[test]
fn beating_a_players_guard_counts_its_size_for_the_cull_and_the_cleared_site_for_the_stand() {
    for (bane, expected) in array![(crate::banes::BLOOD_MOON, 1_u128), (crate::banes::ASH_FALL, 100)] {
        let (d, game_id) = setup(870 + bane.into());
        let target = site(d, game_id, crate::rules::DEEP_MINE);
        let holder = player(d, 8701);
        let guard = deployed(holder, game_id, 1, 100);
        seize(holder, guard, target, 0);
        let rival = player(d, 8702);
        let attacker = deployed(rival, game_id, 2, 1500);
        beside(d, attacker, target, 1);
        let home = ResourceKey { game_id, entity_id: army(d, attacker).owner };
        interact_with_state(d.games, || crate::state::write().banes.world_days.write((game_id, 0), Some(bane)));
        assert_eq!(interact_with_state(d.games, || crate::logic::quests::read(home, 0).progress), 0);
        applied(rival, game_id, fight(attacker, target), FIXTURE_START);
        assert!(interact_with_state(d.games, || crate::logic::troops::explorer(guard)).is_none());
        assert_eq!(held(d, attacker), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
        assert_eq!(interact_with_state(d.games, || crate::logic::quests::read(home, 0).progress), expected);
    }
}

#[test]
fn exhausted_guards_release_slots_before_a_new_holder_joins() {
    let (d, game_id) = setup(83);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    let first = deployed(d, game_id, 1, 10);
    seize(d, first, target, 0);
    let rival = player(d, 8301);
    let next = deployed(rival, game_id, 2, 1000);
    beside(d, next, target, 1);
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let now = FIXTURE_START + 3 * interval;
    applied(rival, game_id, join(d, next, target), now);
    assert!(held(d, first).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(first)).is_none());
    assert_eq!(held(d, next), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
    let expected = crate::deep::troops_after_ticks(
        1000 * crate::rules::RESOURCE_PRECISION,
        FIXTURE_START / interval,
        now / interval,
        crate::logic::deep_sites::rules().loss_per_tick,
    );
    assert_eq!(army(d, next).troops.count, expected);
}

#[test]
fn one_player_cannot_fill_two_slots_and_day_rollover_restores_every_beast() {
    let (d, game_id) = setup(84);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let first = deployed(d, game_id, 1, 10);
    let home = army(d, first).owner;
    seize(d, first, target, 0);
    applied(
        d,
        game_id,
        world_test_support::tests::building_commands::create(
            ResourceKey { game_id, entity_id: home }, crate::research::BARRACKS,
        ),
        FIXTURE_START,
    );
    let second = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 1 }),
    };
    descend(d, second, FIXTURE_START);
    beside(d, second, target, 1);
    refused(d, game_id, join(d, second, target), FIXTURE_START, "player already guards site");
    assert!(held(d, second).is_none());

    let context = crate::tests::context(d.games, game_id);
    let tomorrow = crate::days::day_at_index(context.game.unbox(), context.rules.unbox().day_unit_seconds, 0).end;
    applied(d, game_id, muster(home, 0, 0, 100), tomorrow);
    let fresh = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 1, slot: 0 }),
    };
    descend(d, fresh, tomorrow);
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let current = site(d, game_id, kind);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(current).unwrap().day), 1);
        assert_eq!(beast(d, current), crate::logic::deep_sites::beast(kind).count);
    }
    beside(d, fresh, target, 0);
    wound_beast(d, target, 0);
    applied(d, game_id, join(d, fresh, target), tomorrow);
    assert!(held(d, first).is_none());
    assert!(held(d, second).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(first)).is_none());
    assert!(interact_with_state(d.games, || crate::logic::troops::explorer(second)).is_none());
    assert_eq!(held(d, fresh), Some(crate::deep::DeepGuard { site_id: target.entity_id, slot: 0 }));
}

#[test]
fn deep_beast_marks_control_public_attacks_without_knight_slot_protection() {
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let (d, game_id) = setup(860 + kind.into());
        let attacker = deployed(d, game_id, 1, 1500);
        let target = site(d, game_id, kind);
        beside(d, attacker, target, 0);
        wound_beast(d, target, 1000);
        applied(d, game_id, fight(attacker, target), FIXTURE_START);
        let guard = interact_with_state(
            d.games,
            || crate::logic::guards::guard(
                crate::guards::GuardKey { game_id, structure_id: target.entity_id, slot: 0 },
            ),
        );
        let (left, enemy) = if kind == crate::rules::DEEP_ALTAR || kind == crate::rules::DEEP_CORE {
            (1186_u128, 504_u128)
        } else {
            (1082, 373)
        };
        assert_eq!(army(d, attacker).troops.count, left * crate::rules::RESOURCE_PRECISION);
        assert_eq!(guard.troops.count, enemy * crate::rules::RESOURCE_PRECISION);
        assert_eq!(held(d, attacker), None);
    }
}

#[test]
fn public_attacks_apply_held_oaths_to_the_army_and_the_rival_guard() {
    let values = snforge_std::fs::read_txt(@snforge_std::fs::FileTrait::new("../fixtures/oath-damage.txt"));
    let mut fields = values.span();
    for guarding in array![false, true] {
        let (d, game_id) = setup(if guarding {
            870
        } else {
            871
        });
        let target = site(d, game_id, crate::rules::DEEP_MINE);
        let defender = if guarding {
            let guard = deployed(d, game_id, 1, 1000);
            seize(d, guard, target, 0);
            Some(guard)
        } else {
            wound_beast(d, target, 1000);
            None
        };
        let rival = player(d, 8701);
        let attacker = deployed(rival, game_id, 2, 1000);
        beside(d, attacker, target, 1);
        for exchange in 0_u8..2 {
            let (a, b, ao, bo, ag, bg): (crate::troops::TroopType, crate::troops::TroopType, u16, u16, bool, bool) =
                Serde::deserialize(
                ref fields,
            )
                .unwrap();
            let (before_a, before_b, after_a, after_b): (u128, u128, u128, u128) = Serde::deserialize(ref fields)
                .unwrap();
            assert!(!ag && bg == guarding);
            if exchange == 0 {
                prepare_oath_combatant(d, attacker, a, ao, before_a);
                if let Some(key) = defender {
                    prepare_oath_combatant(d, key, b, bo, before_b);
                }
            }
            assert_eq!(army(d, attacker).troops.count, before_a * crate::rules::RESOURCE_PRECISION);
            applied(rival, game_id, fight(attacker, target), FIXTURE_START);
            assert_eq!(army(d, attacker).troops.count, after_a * crate::rules::RESOURCE_PRECISION);
            let defender_count = match defender {
                Some(key) => army(d, key).troops.count,
                None => beast(d, target),
            };
            assert_eq!(defender_count, after_b * crate::rules::RESOURCE_PRECISION);
            assert_eq!(held(d, attacker), None);
        }
    }
}

fn prepare_oath_combatant(
    d: Deployment, key: ExplorerKey, category: crate::troops::TroopType, oaths: u16, count: u128,
) {
    let mut row = army(d, key);
    row.troops.count = count * crate::rules::RESOURCE_PRECISION;
    row.troops.category = category;
    row.troops.battle_cooldown_end = 0;
    let record = crate::troops::ExplorerRecordTrait::into_record(row);
    interact_with_state(
        d.games,
        || {
            let progress = crate::logic::progression::read(key).unwrap();
            crate::logic::progression::write(
                key, crate::progression::ArmyProgress { oaths, oath_slots: 4, ..progress },
            );
            crate::logic::troops::TroopState::save(key, record);
        },
    );
}
