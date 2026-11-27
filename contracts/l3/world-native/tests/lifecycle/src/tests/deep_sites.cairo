use snforge_std::{interact_with_state, spy_events};
use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::play_fixture::FIXTURE_START;
use world_test_support::tests::resource_commands::{execute_in_game, set_explorer_fixture};
use crate::combat_actions::{IBattlesDispatcherTrait, IBattlesLibraryDispatcher};
use crate::commands::Command;
use crate::guards::GuardKey;
use crate::resources::ResourceKey;
use crate::troop_management::{Army, ManageTroops, TransferTroops};
use crate::troops::{ArmySlotKey, ExplorerKey, ExplorerTroops};
use super::army_activity::{army, found, player, slot_army};

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

pub fn claim(d: Deployment, key: ExplorerKey, target: ResourceKey, direction: u8) {
    beside(d, key, target, direction);
    wound_beast(d, target, 0);
    applied(d, key.game_id, fight(key, target), FIXTURE_START);
}

pub fn seize(d: Deployment, key: ExplorerKey, target: ResourceKey, direction: u8) -> GuardKey {
    if holding(d, target) == 0 {
        claim(d, key, target, direction);
    } else {
        beside(d, key, target, direction);
    }
    let mut free = slot(target, 0);
    while holder(d, free) != 0 {
        free = slot(target, free.slot + 1);
    }
    let troops = army(d, key).troops.count / crate::rules::RESOURCE_PRECISION * crate::rules::RESOURCE_PRECISION;
    applied(d, key.game_id, garrison(key, free, troops), FIXTURE_START);
    free
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
    Command::BattleGuard(crate::commands::Battle { attacker_id: key.explorer_id, defender_id: target.entity_id })
}

pub fn slot(target: ResourceKey, slot: u8) -> GuardKey {
    GuardKey { game_id: target.game_id, structure_id: target.entity_id, slot }
}

fn guard_slot(key: GuardKey) -> Army {
    Army::Guard(crate::troop_management::GuardSlot { structure_id: key.structure_id, slot: key.slot })
}

pub fn garrison(key: ExplorerKey, target: GuardKey, amount: u128) -> Command {
    Command::ManageTroops(
        ManageTroops::Transfer(
            TransferTroops { source: Army::Explorer(key.explorer_id), target: guard_slot(target), amount },
        ),
    )
}

pub fn withdraw(source: GuardKey, key: ExplorerKey, amount: u128) -> Command {
    Command::ManageTroops(
        ManageTroops::Transfer(
            TransferTroops { source: guard_slot(source), target: Army::Explorer(key.explorer_id), amount },
        ),
    )
}

pub fn holder(d: Deployment, key: GuardKey) -> u64 {
    interact_with_state(d.games, || crate::logic::deep_garrisons::home(key))
}

pub fn garrisoned(d: Deployment, key: GuardKey) -> u128 {
    interact_with_state(d.games, || crate::logic::guards::guard(key).troops.count)
}

pub fn holding(d: Deployment, target: ResourceKey) -> u8 {
    interact_with_state(d.games, || crate::logic::deep_sites::site(target).unwrap().aspect)
}

pub fn owner_of(d: Deployment, entity_id: u64, game_id: u32) -> starknet::ContractAddress {
    interact_with_state(d.games, || crate::logic::structures::owner(ResourceKey { game_id, entity_id }))
}

fn assert_cleared(d: Deployment, target: ResourceKey) {
    for index in 0..crate::rules::DEEP_GUARD_SLOTS {
        assert_eq!(holder(d, slot(target, index)), 0);
        let guard = interact_with_state(d.games, || crate::logic::guards::guard(slot(target, index)));
        assert_eq!((guard.troops.count, guard.destroyed_tick), (0, 0));
    }
}

fn troops(count: u128) -> u128 {
    count * crate::rules::RESOURCE_PRECISION
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
fn a_later_ring_refuses_moves_and_attacks_until_enough_realms_entered_today() {
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
    refused(d, game_id, fight(first, target), FIXTURE_START, "Deep ring closed");
    deployed(player(d, 8801), game_id, 2, 10);
    wound_beast(d, target, 0);
    applied(d, game_id, fight(first, target), FIXTURE_START);
    assert_eq!(holding(d, target), 1);
}

#[test]
fn beating_the_beast_claims_the_site_for_the_attackers_player_and_aspect_and_the_army_stays_beside_it() {
    let (d, game_id) = setup(82);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let attacker = deployed(d, game_id, 1, 1500);
    let home = army(d, attacker).owner;
    beside(d, attacker, target, 0);
    let field = army(d, attacker).coord;
    wound_beast(d, target, 10);
    assert_eq!(owner_of(d, target.entity_id, game_id), 0.try_into().unwrap());
    applied(d, game_id, fight(attacker, target), FIXTURE_START);
    assert_eq!(owner_of(d, target.entity_id, game_id), owner_of(d, home, game_id));
    assert_eq!(holding(d, target), 1);
    assert_cleared(d, target);
    assert_eq!(army(d, attacker).coord, field);
    assert!(army(d, attacker).troops.count > 0);
}

#[test]
fn two_allies_garrison_a_claimed_site_and_a_rival_takes_it_slot_by_slot() {
    let (d, game_id) = setup(83);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let owner = player(d, 8300);
    let first = deployed(owner, game_id, 1, 1000);
    let ally = player(d, 8301);
    let second = deployed(ally, game_id, 1, 1000);
    let (first_home, second_home) = (army(d, first).owner, army(d, second).owner);
    beside(d, second, target, 1);
    refused(ally, game_id, garrison(second, slot(target, 3), troops(100)), FIXTURE_START, "site is not claimed");
    claim(owner, first, target, 0);
    refused(ally, game_id, fight(second, target), FIXTURE_START, "your Aspect holds this site");
    applied(owner, game_id, garrison(first, slot(target, 3), troops(400)), FIXTURE_START);
    applied(ally, game_id, garrison(second, slot(target, 2), troops(300)), FIXTURE_START);
    refused(
        ally, game_id, garrison(second, slot(target, 3), troops(100)), FIXTURE_START, "slot belongs to another player",
    );
    refused(
        owner,
        game_id,
        garrison(first, slot(target, 1), troops(100)),
        FIXTURE_START,
        "you already garrison this troop type here",
    );
    assert_eq!((holder(d, slot(target, 3)), garrisoned(d, slot(target, 3))), (first_home, troops(400)));
    assert_eq!((holder(d, slot(target, 2)), garrisoned(d, slot(target, 2))), (second_home, troops(300)));
    assert_eq!((army(d, first).troops.count, army(d, second).troops.count), (troops(600), troops(700)));
    let rival = player(d, 8302);
    let attacker = deployed(rival, game_id, 2, 1500);
    beside(d, attacker, target, 2);
    refused(
        rival,
        game_id,
        garrison(attacker, slot(target, 1), troops(100)),
        FIXTURE_START,
        "only the owner and his Aspect garrison this site",
    );
    applied(rival, game_id, fight(attacker, target), FIXTURE_START);
    assert_eq!((holder(d, slot(target, 3)), garrisoned(d, slot(target, 3))), (0, 0));
    assert_eq!((holder(d, slot(target, 2)), garrisoned(d, slot(target, 2))), (second_home, troops(300)));
    assert_eq!(owner_of(d, target.entity_id, game_id), owner_of(d, first_home, game_id));
    applied(owner, game_id, garrison(first, slot(target, 3), troops(100)), FIXTURE_START);
    assert_eq!(garrisoned(d, slot(target, 3)), troops(100));
    applied(owner, game_id, withdraw(slot(target, 3), first, troops(100)), FIXTURE_START);
    applied(rival, game_id, fight(attacker, target), FIXTURE_START);
    assert_eq!(owner_of(d, target.entity_id, game_id), owner_of(d, army(d, attacker).owner, game_id));
    assert_eq!(holding(d, target), 2);
    assert_cleared(d, target);
}

#[test]
#[should_panic(expected: "command disabled")]
fn frontier_disables_guard_attack_on_a_deep_garrison() {
    let (d, game_id) = setup(831);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let owner = player(d, 8310);
    let first = deployed(owner, game_id, 1, 1000);
    claim(owner, first, target, 0);
    applied(owner, game_id, garrison(first, slot(target, 3), troops(400)), FIXTURE_START);
    let rival = player(d, 8311);
    let attacker = deployed(rival, game_id, 2, 1000);
    beside(d, attacker, target, 2);
    let guard = crate::troop_management::GuardSlot { structure_id: target.entity_id, slot: 3 };
    let attack = crate::combat_actions::GuardAttack { guard, explorer_id: attacker.explorer_id };
    execute_in_game(owner, game_id, Command::GuardAttack(attack), FIXTURE_START);
}

#[test]
#[should_panic(expected: "Deep garrisons only defend their site")]
fn a_deep_garrison_cannot_launch_a_guard_attack() {
    let (d, game_id) = setup(832);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let owner = player(d, 8320);
    let first = deployed(owner, game_id, 1, 1000);
    claim(owner, first, target, 0);
    applied(owner, game_id, garrison(first, slot(target, 3), troops(400)), FIXTURE_START);
    let rival = player(d, 8321);
    let attacker = deployed(rival, game_id, 2, 1000);
    beside(d, attacker, target, 2);
    let guard = crate::troop_management::GuardSlot { structure_id: target.entity_id, slot: 3 };
    let attack = crate::combat_actions::GuardAttack { guard, explorer_id: attacker.explorer_id };
    let context = crate::commands::action_context(crate::tests::context(d.games, game_id));
    interact_with_state(
        d.games,
        || {
            let class_hash = crate::logic::release::class_of(game_id, crate::slots::COMBAT);
            IBattlesLibraryDispatcher { class_hash }.guard_attack(game_id, owner.actor, attack, context);
        },
    );
}

#[test]
fn a_player_holds_a_second_slot_with_another_troop_type_but_never_mixes_types_in_one() {
    let (d, game_id) = setup(84);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let key = deployed(d, game_id, 1, 1000);
    let home = army(d, key).owner;
    claim(d, key, target, 0);
    applied(d, game_id, garrison(key, slot(target, 3), troops(400)), FIXTURE_START);
    let knights = army(d, key);
    set_explorer_fixture(
        d.games,
        key,
        ExplorerTroops {
            troops: crate::troops::Troops { category: crate::troops::TroopType::Crossbowman, ..knights.troops },
            ..knights,
        },
    );
    refused(d, game_id, garrison(key, slot(target, 3), troops(100)), FIXTURE_START, "slot holds another troop type");
    applied(d, game_id, garrison(key, slot(target, 2), troops(400)), FIXTURE_START);
    assert_eq!((holder(d, slot(target, 3)), holder(d, slot(target, 2))), (home, home));
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let boundary = (FIXTURE_START / interval + 1) * interval;
    applied(d, game_id, Command::SetEntityName(crate::names::SetEntityName { entity_id: home, name: 'two' }), boundary);
    let rules = crate::logic::deep_sites::rules();
    assert_eq!(garrisoned(d, slot(target, 3)), troops(400) - rules.loss_per_tick);
    assert_eq!(garrisoned(d, slot(target, 2)), troops(400) - rules.loss_per_tick);
    let pay = interact_with_state(d.games, || super::deep_ticks::held_pay(game_id, crate::rules::DEEP_FOUNDATION, 1));
    let paid: u128 = Into::<u32, u128>::into(pay) * crate::rules::RESOURCE_PRECISION;
    assert_eq!(
        interact_with_state(d.games, || crate::logic::race::member(ResourceKey { game_id, entity_id: home }).glory),
        paid,
    );
}

#[test]
fn only_the_owner_garrisons_an_ethereal_mine_even_beside_his_allies() {
    let (d, game_id) = setup(90);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    let owner = player(d, 9000);
    let first = deployed(owner, game_id, 1, 1000);
    let ally = player(d, 9001);
    let second = deployed(ally, game_id, 1, 1000);
    claim(owner, first, target, 0);
    beside(d, second, target, 1);
    refused(
        ally,
        game_id,
        garrison(second, slot(target, 3), troops(100)),
        FIXTURE_START,
        "only the owner garrisons this site",
    );
    applied(owner, game_id, garrison(first, slot(target, 3), troops(100)), FIXTURE_START);
    assert_eq!(holder(d, slot(target, 3)), army(d, first).owner);
}

#[test]
fn an_owner_withdraws_to_his_own_army_and_an_emptied_slot_is_free_again() {
    let (d, game_id) = setup(85);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let owner = player(d, 8500);
    let first = deployed(owner, game_id, 1, 1000);
    let ally = player(d, 8501);
    let second = deployed(ally, game_id, 1, 1000);
    claim(owner, first, target, 0);
    beside(d, second, target, 1);
    applied(owner, game_id, garrison(first, slot(target, 3), troops(400)), FIXTURE_START);
    refused(
        ally, game_id, withdraw(slot(target, 3), second, troops(100)), FIXTURE_START, "slot belongs to another player",
    );
    applied(owner, game_id, withdraw(slot(target, 3), first, troops(100)), FIXTURE_START);
    assert_eq!((garrisoned(d, slot(target, 3)), army(d, first).troops.count), (troops(300), troops(700)));
    applied(owner, game_id, withdraw(slot(target, 3), first, troops(300)), FIXTURE_START);
    assert_eq!((holder(d, slot(target, 3)), garrisoned(d, slot(target, 3))), (0, 0));
    assert_eq!(army(d, first).troops.count, troops(1000));
    applied(ally, game_id, garrison(second, slot(target, 3), troops(200)), FIXTURE_START);
    assert_eq!(holder(d, slot(target, 3)), army(d, second).owner);
}

#[test]
fn a_site_is_garrisoned_only_by_transfer_from_an_army_beside_it() {
    let (d, game_id) = setup(86);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let key = deployed(d, game_id, 1, 1000);
    claim(d, key, target, 0);
    applied(d, game_id, garrison(key, slot(target, 3), troops(100)), FIXTURE_START);
    let guard = crate::troop_management::GuardSlot { structure_id: target.entity_id, slot: 1 };
    let recruit = crate::troop_management::RecruitGuard {
        guard, category: crate::troops::TroopType::Knight, tier: crate::troops::TroopTier::T1, amount: troops(100),
    };
    let reason: ByteArray = "a Deep site is garrisoned by Transfer";
    refused(d, game_id, Command::ManageTroops(ManageTroops::RecruitGuard(recruit)), FIXTURE_START, reason.clone());
    refused(
        d,
        game_id,
        Command::ManageTroops(
            ManageTroops::RemoveGuard(crate::troop_management::GuardSlot { structure_id: target.entity_id, slot: 3 }),
        ),
        FIXTURE_START,
        reason,
    );
    let beside_coord = army(d, key).coord;
    set_explorer_fixture(
        d.games, key, ExplorerTroops { coord: crate::geometry::neighbor(beside_coord, 0), ..army(d, key) },
    );
    refused(d, game_id, garrison(key, slot(target, 2), troops(100)), FIXTURE_START, "armies are not adjacent");
}

#[test]
fn a_garrison_slot_is_capped_by_its_army_owners_realm_level() {
    let (d, game_id) = setup(87);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let key = deployed(d, game_id, 1, 1000);
    let home = ResourceKey { game_id, entity_id: army(d, key).owner };
    claim(d, key, target, 0);
    let level = world_test_support::tests::building_commands::realm_level(d, home);
    let rules = crate::tests::context(d.games, game_id).rules.unbox().troop_limit_config;
    let cap: u128 = crate::troops::max_army_size(rules, level, crate::troops::TroopTier::T1).into();
    let raised: u128 = crate::troops::max_army_size(rules, level + 1, crate::troops::TroopTier::T1).into();
    let large = army(d, key);
    set_explorer_fixture(
        d.games,
        key,
        ExplorerTroops { troops: crate::troops::Troops { count: troops(raised), ..large.troops }, ..large },
    );
    interact_with_state(
        d.games,
        || {
            let weights = crate::state::write().resources.weights;
            let weight = weights.read((game_id, key.explorer_id));
            weights
                .write(
                    (game_id, key.explorer_id),
                    crate::resources::Weight { capacity: weight.capacity * raised, ..weight },
                );
        },
    );
    refused(d, game_id, garrison(key, slot(target, 3), troops(cap + 1)), FIXTURE_START, "army size limit");
    world_test_support::tests::building_commands::level_up(d, home, FIXTURE_START);
    applied(d, game_id, garrison(key, slot(target, 3), troops(cap + 1)), FIXTURE_START);
    assert_eq!(garrisoned(d, slot(target, 3)), troops(cap + 1));
}

#[test]
fn beating_a_garrison_counts_its_size_for_the_cull_and_the_cleared_site_for_the_stand() {
    for (bane, expected) in array![(crate::banes::BLOOD_MOON, 1_u128), (crate::banes::ASH_FALL, 100)] {
        let (d, game_id) = setup(870 + bane.into());
        let target = site(d, game_id, crate::rules::DEEP_MINE);
        let holder_player = player(d, 8701);
        let guard = deployed(holder_player, game_id, 1, 100);
        let held = seize(holder_player, guard, target, 0);
        let rival = player(d, 8702);
        let attacker = deployed(rival, game_id, 2, 1500);
        beside(d, attacker, target, 1);
        let home = ResourceKey { game_id, entity_id: army(d, attacker).owner };
        interact_with_state(d.games, || crate::state::write().banes.world_days.write((game_id, 0), Some(bane)));
        assert_eq!(interact_with_state(d.games, || crate::logic::quests::read(home, 0).progress), 0);
        applied(rival, game_id, fight(attacker, target), FIXTURE_START);
        assert_eq!(holder(d, held), 0);
        assert_eq!(holding(d, target), 2);
        assert_eq!(interact_with_state(d.games, || crate::logic::quests::read(home, 0).progress), expected);
    }
}

#[test]
fn a_garrison_loses_the_rule_amount_each_tick_and_an_emptied_slot_is_released() {
    let (d, game_id) = setup(88);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    let key = deployed(d, game_id, 1, 1000);
    let home = army(d, key).owner;
    let held = seize(d, key, target, 0);
    let rules = crate::logic::deep_sites::rules();
    let interval = crate::tests::context(d.games, game_id).rules.unbox().tick_config.armies_tick_in_seconds;
    let touch = Command::SetEntityName(crate::names::SetEntityName { entity_id: home, name: 'tick' });
    let later = (FIXTURE_START / interval + 3) * interval;
    applied(d, game_id, touch, later);
    assert_eq!(garrisoned(d, held), troops(1000) - 3 * rules.loss_per_tick);
    assert_eq!(holder(d, held), home);
    let ticks: u64 = (troops(1000) / rules.loss_per_tick).try_into().unwrap();
    let drained = (FIXTURE_START / interval + ticks) * interval;
    applied(d, game_id, touch, drained);
    assert_eq!((holder(d, held), garrisoned(d, held)), (0, 0));
    assert_eq!(holding(d, target), 1);
}

#[test]
fn the_day_turn_ends_every_hold_loses_the_garrisons_and_restores_every_beast() {
    let (d, game_id) = setup(89);
    let target = site(d, game_id, crate::rules::DEEP_FOUNDATION);
    let first = deployed(d, game_id, 1, 1000);
    let home = army(d, first).owner;
    let held = seize(d, first, target, 0);
    let ally = player(d, 8901);
    let second = deployed(ally, game_id, 1, 1000);
    let ally_home = army(d, second).owner;
    let allied = seize(ally, second, target, 1);
    assert_eq!((holder(d, held), holder(d, allied)), (home, ally_home));
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    applied(
        d, game_id, Command::SetEntityName(crate::names::SetEntityName { entity_id: home, name: 'turn' }), tomorrow,
    );
    for kind in 0..crate::rules::DEEP_KIND_COUNT {
        let current = site(d, game_id, kind);
        assert_eq!(interact_with_state(d.games, || crate::logic::deep_sites::site(current).unwrap().day), 1);
        assert_eq!(beast(d, current), crate::logic::deep_sites::beast(kind).count);
        assert_eq!(holding(d, current), 0);
        assert_eq!(owner_of(d, current.entity_id, game_id), 0.try_into().unwrap());
        for index in 0..crate::rules::DEEP_GUARD_SLOTS {
            assert_eq!(holder(d, slot(current, index)), 0);
            if index != 0 {
                assert_eq!(garrisoned(d, slot(current, index)), 0);
            }
        }
    }
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
        assert_eq!(holding(d, target), 0);
    }
}

#[test]
fn public_attacks_apply_held_oaths_to_the_army_against_the_beast() {
    let values = snforge_std::fs::read_txt(@snforge_std::fs::FileTrait::new("../fixtures/oath-damage.txt"));
    let mut fields = values.span();
    let (d, game_id) = setup(871);
    let target = site(d, game_id, crate::rules::DEEP_MINE);
    wound_beast(d, target, 1000);
    let rival = player(d, 8701);
    let attacker = deployed(rival, game_id, 2, 1000);
    beside(d, attacker, target, 1);
    for exchange in 0_u8..2 {
        let (a, _, ao, _, ag, bg): (crate::troops::TroopType, crate::troops::TroopType, u16, u16, bool, bool) =
            Serde::deserialize(
            ref fields,
        )
            .unwrap();
        let (before_a, _, after_a, after_b): (u128, u128, u128, u128) = Serde::deserialize(ref fields).unwrap();
        assert!(!ag && !bg);
        if exchange == 0 {
            prepare_oath_combatant(d, attacker, a, ao, before_a);
        }
        assert_eq!(army(d, attacker).troops.count, before_a * crate::rules::RESOURCE_PRECISION);
        applied(rival, game_id, fight(attacker, target), FIXTURE_START);
        assert_eq!(army(d, attacker).troops.count, after_a * crate::rules::RESOURCE_PRECISION);
        assert_eq!(beast(d, target), after_b * crate::rules::RESOURCE_PRECISION);
        assert_eq!(holding(d, target), 0);
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
