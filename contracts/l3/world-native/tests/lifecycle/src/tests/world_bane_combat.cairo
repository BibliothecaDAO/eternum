use snforge_std::{interact_with_state, spy_events};
use starknet::storage::StoragePointerReadAccess;
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::{execute_in_game, grant};
use crate::commands::{Battle, Command, CreateExplorer};
use crate::resources::ResourceKey;
use crate::rules::RESOURCE_PRECISION;
use crate::troops::{ExplorerKey, TroopTier, TroopType};

#[test]
fn cull_counts_actual_guard_losses_in_a_partial_fight() {
    let (d, home, army, mut now) = prepare_bane_army(12, crate::quests::CULL, 1500);
    let target = discover_guarded_camp(d, home, ref now);
    let initial = interact_with_state(d.games, || guard_count(target));
    now += 1200;
    assert!(execute_in_game(d, home.game_id, attack(army, target), now));
    interact_with_state(
        d.games,
        || {
            let remaining = guard_count(target);
            assert!(remaining > 0 && remaining < initial);
            assert!(crate::logic::troops::explorer(army).unwrap().troops.count > 0);
            let progress = crate::logic::quests::read(home, 1);
            assert_eq!(progress.progress, initial - remaining);
            assert_eq!(progress.completed_level, 0);
            assert!(crate::logic::expeditions::expedition_site(target).unwrap().clear.is_none());
            assert_eq!(crate::logic::banes::progress(home.game_id, 1, 1).completed, 0);
        },
    );
}

#[test]
fn cull_keeps_the_guard_losses_when_the_attacker_dies_and_rejects_replay() {
    let (d, home, army, mut now) = prepare_bane_army(12, crate::quests::CULL, 10);
    let target = discover_guarded_camp(d, home, ref now);
    let initial = interact_with_state(d.games, || guard_count(target));
    now += 1200;
    assert!(execute_in_game(d, home.game_id, attack(army, target), now));
    let credited = interact_with_state(
        d.games,
        || {
            let remaining = guard_count(target);
            assert!(remaining > 0 && remaining < initial);
            assert!(crate::logic::troops::explorer(army).is_none());
            assert!(crate::logic::troops::home_armies(home).is_empty());
            let progress = crate::logic::quests::read(home, 1);
            assert_eq!(progress.progress, initial - remaining);
            assert_eq!(progress.completed_level, 0);
            assert!(crate::logic::expeditions::expedition_site(target).unwrap().clear.is_none());
            progress.progress
        },
    );
    assert!(!execute_in_game(d, home.game_id, attack(army, target), now + 1200));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::quests::read(home, 1).progress, credited);
            assert_eq!(guard_count(target), initial - credited);
            assert_eq!(crate::logic::banes::progress(home.game_id, 1, 1).completed, 0);
        },
    );
}

#[test]
fn stand_counts_the_guarded_site_once_on_clear_and_not_on_partial_hits() {
    let (d, home, army, mut now) = prepare_bane_army(4, crate::quests::STAND, 3000);
    let target = discover_guarded_camp(d, home, ref now);
    interact_with_state(
        d.games,
        || {
            let count = guard_count(target);
            // The unchanged Surface camp bounds are 1,200–1,400; Blood Moon adds 50%.
            assert!(count >= 1800 * RESOURCE_PRECISION && count <= 2100 * RESOURCE_PRECISION);
        },
    );
    let mut cleared = false;
    let mut partial_hits = 0_u8;
    for _ in 0_u8..15 {
        now += 1200;
        assert!(execute_in_game(d, home.game_id, attack(army, target), now));
        cleared =
            interact_with_state(
                d.games,
                || {
                    let site = crate::logic::expeditions::expedition_site(target).unwrap();
                    let progress = crate::logic::quests::read(home, 1);
                    assert_eq!(progress.completed_level, 0);
                    match site.clear {
                        Some(receipt) => {
                            assert_eq!(receipt.home_id, home.entity_id);
                            assert_eq!(receipt.explorer_id, army.explorer_id);
                            assert_eq!(progress.progress, 1);
                            true
                        },
                        None => {
                            assert!(guard_count(target) > 0);
                            assert_eq!(progress.progress, 0);
                            false
                        },
                    }
                },
            );
        if cleared {
            break;
        }
        partial_hits += 1;
    }
    assert!(partial_hits > 0);
    assert!(cleared);
    assert!(!execute_in_game(d, home.game_id, attack(army, target), now + 1200));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::quests::read(home, 1).progress, 1);
            assert_eq!(crate::logic::banes::progress(home.game_id, 1, 1).completed, 0);
        },
    );
}

fn prepare_bane_army(seed: felt252, kind: u8, troops: u128) -> (Deployment, ResourceKey, ExplorerKey, u64) {
    let (_, mut preset) = world_test_support::tests::preset_projection::current_definition("season-one");
    // Select camps through the public preset; combat, guards, quests and banes retain Season 1 rules.
    preset
        .economy
        .discovery =
            Some(
                crate::expeditions::FrontierDiscoveryRules {
                    camp_bps: 5000,
                    beasts_bps: 0,
                    rift_bps: 0,
                    ruin_bps: 0,
                    shrine_bps: 0,
                    well_bps: 0,
                    empty_reveal_limit: 1,
                },
            );
    let (d, game_id) = super::aspects::setup_aspect_preset(seed, preset);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            360,
        ),
    );
    let (home, next) = interact_with_state(
        d.games,
        || {
            let home = ResourceKey { game_id, entity_id: crate::entity_ids::home_for_actor(game_id, d.actor) };
            let game = crate::logic::game::game(game_id);
            let unit = crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read();
            assert_eq!(crate::logic::banes::required(game_id, 1, 1), 1);
            assert_eq!(crate::logic::banes::quest_kind(home, 1), kind);
            (home, crate::days::day_of(game, unit, 360).end)
        },
    );
    grant(d, home, crate::troops::stock_resource(TroopType::Knight, TroopTier::T1), troops * RESOURCE_PRECISION);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::CreateExplorer(
                CreateExplorer {
                    structure_id: home.entity_id,
                    category: TroopType::Knight.into(),
                    tier: 0,
                    amount: troops * RESOURCE_PRECISION,
                    direction: 0,
                    slot: 0,
                },
            ),
            next,
        ),
    );
    grant(d, home, crate::resources::WHEAT, 6000 * RESOURCE_PRECISION);
    let army = interact_with_state(
        d.games,
        || {
            let armies = crate::logic::troops::home_armies(home);
            assert_eq!(armies.len(), 1);
            assert!(crate::logic::resources::balance(home, crate::resources::WHEAT) > 0);
            assert_eq!(crate::logic::quests::read(home, 1).progress, 0);
            ExplorerKey { game_id, explorer_id: *armies.at(0) }
        },
    );
    (d, home, army, next)
}

fn discover_guarded_camp(d: Deployment, home: ResourceKey, ref now: u64) -> ResourceKey {
    for _ in 0_u8..10 {
        let target = interact_with_state(d.games, || adjacent_camp(home));
        if let Some(target) = target {
            return target;
        }
        let action = interact_with_state(d.games, || super::quests::next_reveal_action(home, 0));
        now += 1200;
        let mut spy = spy_events();
        assert!(
            execute_in_game(d, home.game_id, action, now),
            "{}",
            super::play_fixture::rejection(ref spy, d.games).reason,
        );
    }
    panic!("no guarded camp discovered");
}

fn adjacent_camp(home: ResourceKey) -> Option<ResourceKey> {
    let id = *crate::logic::troops::home_armies(home).at(0);
    let army = crate::logic::troops::explorer(ExplorerKey { game_id: home.game_id, explorer_id: id }).unwrap();
    for direction in 0_u8..6 {
        let tile = crate::geometry::tile_key(home.game_id, crate::geometry::neighbor(army.coord, direction));
        if let Some(occupant) = crate::logic::map::occupancy(tile) {
            let target = ResourceKey { game_id: home.game_id, entity_id: occupant.entity_id };
            if let Some(site) = crate::logic::expeditions::expedition_site(target) {
                if site.clear.is_none() && guard_count(target) > 0 {
                    assert_eq!(site.category, crate::taxonomy::CAMP_CATEGORY);
                    return Some(target);
                }
            }
        }
    }
    None
}

fn guard_count(target: ResourceKey) -> u128 {
    crate::logic::guards::guard(
        crate::guards::GuardKey { game_id: target.game_id, structure_id: target.entity_id, slot: 0 },
    )
        .troops
        .count
}

fn attack(army: ExplorerKey, target: ResourceKey) -> Command {
    Command::BattleGuard(Battle { attacker_id: army.explorer_id, defender_id: target.entity_id })
}
