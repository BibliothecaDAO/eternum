use snforge_std::{interact_with_state, start_cheat_caller_address, stop_cheat_caller_address};
use world_test_support::tests::Deployment;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::{IResourceOperationsDispatcher, IResourceOperationsDispatcherTrait, ResourceKey};
use crate::rules::RESOURCE_PRECISION;

fn setup() -> (Deployment, ResourceKey) {
    let (d, game_id) = super::aspects::setup_aspects(42);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            360,
        ),
    );
    let home = interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    (d, ResourceKey { game_id, entity_id: home })
}

// Fixture stock isolates the purchase; every town transition uses the player's command route.
fn fund(d: Deployment, home: ResourceKey, resource: u8, amount: u128, now: u64) {
    start_cheat_caller_address(d.games, d.games);
    IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            resource,
            amount * RESOURCE_PRECISION,
            now,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: now, ..world_test_support::tests::context(d.games, home.game_id),
                },
            ),
        );
    stop_cheat_caller_address(d.games);
}

fn balance(d: Deployment, home: ResourceKey, resource: u8) -> u128 {
    interact_with_state(d.games, || crate::logic::resources::balance(home, resource))
}

fn build(home: ResourceKey, category: u8, direction: u8) -> Command {
    Command::CreateBuilding(
        crate::buildings::CreateBuilding {
            structure_id: home.entity_id,
            directions: array![direction].span(),
            category,
            use_simple: true,
            scouting_kind: 0,
        },
    )
}

fn assert_stores(d: Deployment, home: ResourceKey, labor: u128, wheat: u128, troops: u128) {
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::resources::store_limit(home, crate::resources::LABOR), Some(labor * RESOURCE_PRECISION),
            );
            assert_eq!(
                crate::logic::resources::store_limit(home, crate::resources::WHEAT), Some(wheat * RESOURCE_PRECISION),
            );
            assert_eq!(crate::logic::resources::store_limit(home, 26), Some(troops * RESOURCE_PRECISION));
            assert!(crate::logic::resources::store_limit(home, crate::resources::ESSENCE).is_none());
        },
    );
}

#[test]
fn town_levels_charge_the_frozen_prices_and_change_only_future_castle_output() {
    let (d, home) = setup();
    let caps = array![5000_u128, 15000, 50000, 100000];
    let wheat = array![6000_u128, 18000, 40000, 80000];
    let troops = array![6000_u128, 18000, 50000, 120000];
    let prices = array![2500_u128, 15000, 50000];
    let rate = interact_with_state(
        d.games, || crate::logic::resources::production(home, crate::resources::LABOR).production_rate,
    );
    assert_eq!(rate, 27777778);
    for level in 0_u32..4 {
        assert_stores(d, home, *caps.at(level), *wheat.at(level), *troops.at(level));
        interact_with_state(
            d.games,
            || {
                let base = crate::logic::structures::record(home).base;
                assert_eq!(base.level, level.try_into().unwrap());
                assert_eq!(base.troop_max_explorer_count, (level + 3).try_into().unwrap());
            },
        );
        if level < 3 {
            let now = 360 + Into::<u32, u64>::into(level) * 3600;
            fund(d, home, crate::resources::LABOR, 100000, now);
            assert!(execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), now));
            assert_eq!(
                balance(d, home, crate::resources::LABOR), (*caps.at(level) - *prices.at(level)) * RESOURCE_PRECISION,
            );
        }
    }
    assert!(!execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), 7560));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::resources::production(home, crate::resources::LABOR).production_rate, rate * 8);
        },
    );
}

#[test]
fn town_storeroom_is_one_city_plot_doubles_only_stores_and_refunds_half_on_demolition() {
    let (d, home) = setup();
    fund(d, home, crate::resources::LABOR, 100000, 360);
    assert!(!execute_in_game(d, home.game_id, build(home, crate::research::STOREHOUSE, 0), 360));
    assert!(execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), 360));
    fund(d, home, crate::resources::LABOR, 100000, 360);
    // An hour at the old cap must not become an hour of extra room when the Storeroom appears.
    assert!(execute_in_game(d, home.game_id, build(home, crate::research::STOREHOUSE, 0), 3960));
    assert_eq!(balance(d, home, crate::resources::LABOR), 5000 * RESOURCE_PRECISION);
    assert_stores(d, home, 30000, 36000, 18000);
    assert!(!execute_in_game(d, home.game_id, build(home, crate::research::STOREHOUSE, 1), 3960));
    let coord = crate::geometry::neighbor(crate::troops::Coord { alt: false, x: 10, y: 10 }, 0);
    let change = crate::buildings::ChangeBuilding { structure_id: home.entity_id, coord };
    assert!(execute_in_game(d, home.game_id, Command::DestroyBuilding(change), 7560));
    assert_stores(d, home, 15000, 18000, 18000);
    assert_eq!(balance(d, home, crate::resources::LABOR), 10000 * RESOURCE_PRECISION + 55555556 * 3600);
    assert!(!execute_in_game(d, home.game_id, Command::DestroyBuilding(change), 7560));
    assert!(execute_in_game(d, home.game_id, build(home, crate::research::STOREHOUSE, 0), 7560));
    assert_stores(d, home, 30000, 36000, 18000);
}

#[test]
fn town_lore_requires_well_then_shrine_then_one_spire_at_exact_prices() {
    let (d, home) = setup();
    fund(d, home, crate::resources::ESSENCE, 17500, 360);
    let research = |row| Command::Research(crate::research::Research { structure_id: home.entity_id, row, choice: 0 });
    assert!(!execute_in_game(d, home.game_id, research(crate::research::ROW_SHRINE), 360));
    assert!(!execute_in_game(d, home.game_id, research(crate::research::ROW_DEPTH), 360));
    assert_eq!(balance(d, home, crate::resources::ESSENCE), 17500 * RESOURCE_PRECISION);
    for (row, remaining) in array![
        (crate::research::ROW_WELL, 15000_u128), (crate::research::ROW_SHRINE, 10000), (crate::research::ROW_DEPTH, 0),
    ] {
        assert!(execute_in_game(d, home.game_id, research(row), 360));
        assert_eq!(balance(d, home, crate::resources::ESSENCE), remaining * RESOURCE_PRECISION);
        assert_eq!(balance(d, home, crate::resources::LABOR), 2000 * RESOURCE_PRECISION);
        assert!(!execute_in_game(d, home.game_id, research(row), 360));
        interact_with_state(
            d.games, || assert_eq!(crate::research::tier(crate::logic::research::learned(home), row), 1),
        );
    }
}

#[test]
fn town_upgrade_settles_the_old_castle_rate_and_keeps_workshop_output_separate() {
    let (d, home) = setup();
    assert!(execute_in_game(d, home.game_id, build(home, crate::research::WORKSHOP, 0), 360));
    assert_eq!(balance(d, home, crate::resources::LABOR), 1000 * RESOURCE_PRECISION);
    assert!(!execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), 360));
    assert!(execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), 18360));
    assert_eq!(balance(d, home, crate::resources::LABOR), 12000);
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::resources::production(home, crate::resources::LABOR).production_rate, 111111112);
        },
    );
}

#[test]
fn town_store_research_cannot_charge_for_a_removed_storage_effect() {
    let (d, home) = setup();
    assert!(execute_in_game(d, home.game_id, build(home, crate::research::FARM, 0), 360));
    assert!(execute_in_game(d, home.game_id, build(home, crate::research::WORKSHOP, 1), 360));
    fund(d, home, crate::resources::LABOR, 100000, 360);
    fund(d, home, crate::resources::ESSENCE, 100000, 360);
    for row in array![crate::research::ROW_FARM, crate::research::ROW_WORKSHOP] {
        assert!(
            !execute_in_game(
                d,
                home.game_id,
                Command::Research(
                    crate::research::Research {
                        structure_id: home.entity_id, row, choice: crate::research::CHOICE_STORE,
                    },
                ),
                360,
            ),
        );
    }
    assert_eq!(balance(d, home, crate::resources::ESSENCE), 100000 * RESOURCE_PRECISION);
    assert_eq!(balance(d, home, crate::resources::LABOR), 5000 * RESOURCE_PRECISION);
}
