pub use world_test_support::tests::progression::*;

#[test]
fn logistics_tiers_set_the_maximum_stamina_by_the_ruled_table() {
    let (_, frontier) = super::preset_projection::current_definition("frontier-check");
    let rules = frontier.rules.troop_stamina_config;
    for (logistics, maximum) in array![(0_u8, 120_u64), (1, 140), (2, 165), (3, 195), (4, 230), (5, 270)] {
        let progress = ArmyProgress { logistics, oath_slots: 1 };
        assert_eq!(crate::progression::stamina_max(progress, crate::troops::TroopType::Knight, rules), maximum);
    }
}

#[test]
fn added_stamina_stops_at_the_armys_own_maximum() {
    let (_, frontier) = super::preset_projection::current_definition("frontier-check");
    let rules = frontier.rules.troop_stamina_config;
    let maximum = crate::progression::stamina_max(
        ArmyProgress { logistics: 3, oath_slots: 1 }, crate::troops::TroopType::Knight, rules,
    );
    assert_eq!(maximum, 195);
    let mut boosts: crate::troops::TroopBoosts = Default::default();
    // Past the troop's base of 120, up to the army's own 195, and never beyond it.
    let mut bar = crate::troops::Stamina { amount: 110, settled_at: 5, remainder: 0 };
    bar.add(ref boosts, maximum, rules, 25, 120, 5);
    assert_eq!(bar.amount, 135);
    bar.add(ref boosts, maximum, rules, 100, 120, 5);
    assert_eq!(bar.amount, 195);
}

#[test]
fn an_armys_own_maximum_reads_its_logistics_tier_and_a_troops_without_progress() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let (key, _) = super::registrar::expedition_armies(d, game_id, category);
    let rules = preset.rules.troop_stamina_config;
    write_progress(d, key, ArmyProgress { logistics: 3, oath_slots: 1 });
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
    assert_eq!(own, crate::stamina::StaminaImpl::max(troops.category, crate::troops::TroopTier::T1, rules) + 75);
    assert_eq!(other, crate::stamina::StaminaImpl::max(troops.category, troops.tier, rules));
}

#[test]
fn training_starts_only_later_armies_at_their_realms_tiers_and_full_at_their_logistics_maximum() {
    let d = super::registrar::setup();
    let (game_id, preset, category) = super::registrar::expedition_home(d);
    let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
    snforge_std::start_cheat_caller_address(d.games, d.games);
    crate::resources::IResourceOperationsDispatcher { contract_address: d.games }
        .grant_resource(
            home,
            26,
            1000 * crate::rules::RESOURCE_PRECISION,
            351,
            crate::commands::resource_context(
                crate::commands::ExecutionContext { timestamp: 351, ..crate::tests::context(d.games, game_id) },
            ),
        );
    snforge_std::stop_cheat_caller_address(d.games);
    let untrained = deploy(d, game_id, category, 0);
    assert_eq!(read_progress(d, untrained), ArmyProgress { logistics: 0, oath_slots: 1 });

    let learned = crate::research::learn(0, crate::research::ROW_SUPPLY_YARD, 0);
    snforge_std::interact_with_state(
        d.games, || crate::logic::research::write(home, crate::research::RealmKnowledge { learned }),
    );
    let trained = deploy(d, game_id, category, 1);
    let progress = read_progress(d, trained);
    assert_eq!(progress.logistics, 1);
    // Training changes no army already deployed.
    assert_eq!(read_progress(d, untrained), ArmyProgress { logistics: 0, oath_slots: 1 });
    let troops = super::state::GameState { contract_address: d.games }.resolved_explorer(trained).unwrap().troops;
    assert_eq!(
        troops.stamina.inline().amount,
        crate::progression::stamina_max(progress, troops.category, preset.rules.troop_stamina_config),
    );
    assert_eq!(
        troops.stamina.inline().amount,
        crate::stamina::StaminaImpl::max(
            troops.category, crate::troops::TroopTier::T1, preset.rules.troop_stamina_config,
        )
            + crate::rules::logistics_stamina(1).into(),
    );
}

#[test]
fn a_scout_reveals_for_ten_stamina() {
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        camp_bps: 5000, rift_bps: 0, ruin_bps: 0, beasts_bps: 0, shrine_bps: 0, well_bps: 0, empty_reveal_limit: 7,
    };
    let (d, game_id, key) = super::registrar::setup_frontier_relics_with_rules(Some(discovery));
    let mut army = super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    army.troops.category = crate::troops::TroopType::Paladin;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
    place_army_at_depth(d, key, 0);
    set_bar(d, key, 10, 360);
    let target = exploration_destination(d, key);
    let root = super::registrar::discovery_root(game_id, discovery, 100, 0, None, crate::discovery::Discovery::Camp);
    explore(d, key, root, 360);
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
        let (game_id, preset, _) = super::registrar::expedition_home(d);
        let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
        snforge_std::interact_with_state(d.games, || {
            for _ in 0_u8..3 {
                let base = crate::logic::structures::structure(home).unwrap().base;
                crate::logic::structures::StructureState::upgrade(home, base, preset.rules.troop_limit_config);
            }
        });
        for resource in array![1_u8, 26, 29, 32, 35, crate::resources::LABOR, crate::resources::ESSENCE] {
            super::resource_commands::grant(d, home, resource, 1000000 * crate::rules::RESOURCE_PRECISION);
        }
        let old = deploy(d, game_id, category, 0);
        assert_eq!(read_progress(d, old).oath_slots, 1);
        assert!(super::resource_commands::execute_in_game(d, game_id, super::building_commands::build_toward(home, building, 2), 351));
        assert!(super::resource_commands::execute_in_game(d, game_id, super::building_commands::research(home, row, 0), 351));
        let new = deploy(d, game_id, category, 1);
        assert_eq!(read_progress(d, new).oath_slots, 2);
        assert_eq!(read_progress(d, old).oath_slots, 1);
        assert_eq!(read_progress(d, new).logistics, 0);
    }
}
