pub use world_test_support::tests::progression::*;
use super::play_fixture::FIXTURE_START;

#[test]
fn each_logistics_tier_adds_a_fifth_of_the_bar() {
    let rules = crate::balance::rules::TROOP_STAMINA_CONFIG;
    let base: u64 = rules.stamina_knight_max.into();
    for (logistics, added) in array![(0_u8, 0_u64), (1, 36), (2, 72), (3, 108), (4, 144), (5, 180)] {
        let progress = ArmyProgress { logistics, oath_slots: 1, ..Default::default() };
        assert_eq!(crate::progression::stamina_max(progress, crate::troops::TroopType::Knight, rules), base + added);
    }
}

#[test]
fn added_stamina_stops_at_the_armys_own_maximum() {
    let rules = crate::balance::rules::TROOP_STAMINA_CONFIG;
    let base: u64 = rules.stamina_knight_max.into();
    let maximum = crate::progression::stamina_max(
        ArmyProgress { logistics: 3, oath_slots: 1, ..Default::default() }, crate::troops::TroopType::Knight, rules,
    );
    assert_eq!(maximum, base + 108);
    let mut boosts: crate::troops::TroopBoosts = Default::default();
    let mut bar = crate::troops::Stamina { amount: base - 10, settled_at: 5, remainder: 0 };
    bar.add(ref boosts, maximum, rules, 25, 120, 5);
    assert_eq!(bar.amount, base + 15);
    bar.add(ref boosts, maximum, rules, 100, 120, 5);
    assert_eq!(bar.amount, maximum);
}

#[test]
fn an_armys_own_maximum_reads_its_logistics_tier_and_a_troops_without_progress() {
    let d = super::registrar::setup();
    let (game_id, home, _) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, home);
    let rules = crate::balance::rules::TROOP_STAMINA_CONFIG;
    write_progress(d, key, ArmyProgress { logistics: 3, oath_slots: 1, ..Default::default() });
    let (troops, own, other) = snforge_std::interact_with_state(
        d.games,
        || {
            let troops = crate::logic::troops::explorer(key).unwrap().troops;
            let other = crate::troops::ExplorerKey { game_id, explorer_id: 9999 };
            (
                troops,
                crate::logic::progression::own_stamina_max(key, troops, rules),
                crate::logic::progression::own_stamina_max(other, troops, rules),
            )
        },
    );
    assert_eq!(own, crate::stamina::StaminaImpl::max(troops.category, crate::troops::TroopTier::T1, rules) + 108);
    assert_eq!(other, crate::stamina::StaminaImpl::max(troops.category, troops.tier, rules));
}

#[test]
fn training_starts_only_later_armies_at_their_realms_tiers_and_full_at_their_logistics_maximum() {
    let d = super::registrar::setup();
    let (game_id, home, category) = super::registrar::expedition_home(d);
    snforge_std::start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            26,
            1000 * crate::rules::RESOURCE_PRECISION,
            FIXTURE_START + 1,
            crate::commands::resource_context(
                crate::commands::ExecutionContext {
                    timestamp: FIXTURE_START + 1, ..crate::tests::context(d.games, game_id),
                },
            ),
        );
    snforge_std::stop_cheat_caller_address(d.games);
    let untrained = deploy(d, home, category, 2, FIXTURE_START + 1);
    assert_eq!(read_progress(d, untrained), ArmyProgress { logistics: 0, oath_slots: 2, ..Default::default() });

    let learned = crate::research::learn(0, crate::research::ROW_SUPPLY_YARD, 0);
    snforge_std::interact_with_state(
        d.games, || crate::logic::research::write(home, crate::research::RealmKnowledge { learned }),
    );
    assert_eq!(read_progress(d, untrained), ArmyProgress { logistics: 0, oath_slots: 2, ..Default::default() });
    let trained = deploy(d, home, category, 2, super::registrar::day_start(d, game_id, 1) + 1);
    let progress = read_progress(d, trained);
    assert_eq!(progress.logistics, 1);
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::progression::read(untrained)).is_none());
    let troops = super::state::GameState { contract_address: d.games }.resolved_explorer(trained).unwrap().troops;
    assert_eq!(
        troops.stamina.inline().amount,
        crate::progression::stamina_max(progress, troops.category, crate::balance::rules::TROOP_STAMINA_CONFIG),
    );
    assert_eq!(troops.stamina.inline().amount, 216);
}

#[test]
fn a_scout_reveals_for_ten_stamina() {
    let discovery = world_test_support::tests::frontier_discovery::rules();
    let (d, game_id, key) = super::registrar::setup_frontier_relics();
    let mut army = super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    army.troops.category = crate::troops::TroopType::Paladin;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    place_army_at_depth(d, key, 0);
    set_bar(d, key, 10, FIXTURE_START + 10);
    let target = exploration_destination(d, key);
    let root = super::registrar::discovery_root(
        game_id,
        discovery,
        100,
        0,
        Some(world_test_support::tests::registrar::any_relic()),
        crate::discovery::Discovery::Camp,
    );
    explore(d, key, root, FIXTURE_START + 10);
    assert_eq!(bar(d, key, game_id), 0);
    let map = crate::map::IMapLogicDispatcher { contract_address: d.games };
    assert!(map.tile(crate::geometry::tile_key(game_id, target)).is_some());
}

#[test]
fn deployed_armies_keep_their_troops_oath_count_after_home_research_changes() {
    for (category, row, building) in array![
        (0_u8, crate::research::ROW_KNIGHT_OATHS, crate::research::BARRACKS),
        (1, crate::research::ROW_SCOUT_OATHS, crate::research::SCOUTS_LODGE),
        (2, crate::research::ROW_CROSSBOW_OATHS, crate::research::RANGE),
    ] {
        let d = super::registrar::setup();
        let (game_id, home, _) = super::registrar::expedition_home(d);
        snforge_std::interact_with_state(
            d.games,
            || {
                for _ in 0_u8..3 {
                    let base = crate::logic::structures::structure(home).unwrap().base;
                    crate::logic::structures::StructureState::upgrade(
                        home, base, crate::balance::rules::TROOP_LIMIT_CONFIG,
                    );
                }
            },
        );
        for resource in array![1_u8, 26, 29, 32, 35, crate::resources::LABOR, crate::resources::ESSENCE] {
            super::resource_commands::grant(d, home, resource, 1000000 * crate::rules::RESOURCE_PRECISION);
        }
        let old = deploy(d, home, category, 2, FIXTURE_START + 1);
        assert_eq!(read_progress(d, old).oath_slots, 2);
        assert!(
            super::resource_commands::execute_in_game(
                d, game_id, super::building_commands::build_toward(home, building, 2), FIXTURE_START + 1,
            ),
        );
        assert!(
            super::resource_commands::execute_in_game(
                d, game_id, super::building_commands::research(home, row, 0), FIXTURE_START + 1,
            ),
        );
        assert!(
            super::resource_commands::execute_in_game(
                d, game_id, super::frontier_economy::reinforce(old.explorer_id, 2), FIXTURE_START + 1,
            ),
        );
        let troops = super::state::GameState { contract_address: d.games }.resolved_explorer(old).unwrap().troops;
        assert_eq!(troops.count, 3 * crate::rules::RESOURCE_PRECISION);
        assert_eq!(read_progress(d, old).oath_slots, 2);
        let new = deploy(d, home, category, 2, super::registrar::day_start(d, game_id, 1) + 1);
        assert_eq!(read_progress(d, new).oath_slots, 3);
        assert_eq!(read_progress(d, new).logistics, 0);
    }
}
