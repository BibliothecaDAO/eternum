pub use world_test_support::tests::frontier_economy::*;


#[test]
fn a_farm_produces_wheat_from_nothing_and_barracks_take_none_of_it() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, FARM, WEST), 40));
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    // From 40 to 90 the farm is paid for fifty seconds.
    settle(deployment, home, WHEAT, 90);
    assert_eq!(stored(deployment, home, WHEAT), 50 * rate(deployment, home, WHEAT));
    assert_eq!(rate(deployment, home, WHEAT), 2);
}

#[test]
fn troops_train_with_no_wheat_and_settle_without_touching_it() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    assert_eq!(stored(deployment, home, WHEAT), 0);
    let mut spy = snforge_std::spy_events();
    settle(deployment, home, KNIGHT, 90);
    assert_eq!(stored(deployment, home, KNIGHT), 100);
    // One touch writes the troop's balance and its production, and nothing of the family: a board realm has no weight.
    assert_eq!(spy.get_events().emitted_by(deployment.games).events.len(), 2);

    assert!(execute(deployment, build(home, FARM, WEST), 100));
    settle(deployment, home, KNIGHT, 150);
    assert_eq!(stored(deployment, home, KNIGHT), 220);
    assert_eq!(stored(deployment, home, WHEAT), 0);
    settle(deployment, home, WHEAT, 150);
    assert_eq!(stored(deployment, home, WHEAT), 100);
    assert_eq!(stored(deployment, home, KNIGHT), 220);
}

#[test]
fn raising_troops_pays_two_wheat_each_from_settled_wheat_and_fails_when_the_realm_is_short() {
    // The farm yields a quarter wheat a second, so every wheat spent here was produced, never granted.
    let (deployment, home) = frontier_realm(
        with_realm_rate(frontier_preset(), WHEAT, RESOURCE_PRECISION.try_into().unwrap() / 4),
    );
    allow_armies(deployment, home);
    grant(deployment, home, KNIGHT, 20 * RESOURCE_PRECISION);
    assert!(execute(deployment, build(home, FARM, WEST), 40));

    // Forty seconds of farming yields ten wheat: three troops cost six of it.
    assert!(execute(deployment, raise(home, 3, 0), 80));
    assert_eq!(stored(deployment, home, KNIGHT), 17 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 4 * RESOURCE_PRECISION);
    let army = *IStructureOperationsDispatcher { contract_address: deployment.games }.home_armies(home).at(0);
    assert!(execute(deployment, reinforce(army, 1), 80));
    assert_eq!(stored(deployment, home, KNIGHT), 16 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 2 * RESOURCE_PRECISION);

    let before = super::resource_commands::resource_facts(deployment, home);
    let mut rejected = snforge_std::spy_events();
    assert_terminal_rejection(deployment, raise(home, 4, 1), 80);
    assert_eq!(
        super::play_fixture::rejection(ref rejected, deployment.games).reason, "realm cannot pay to raise troops",
    );
    let mut rejected = snforge_std::spy_events();
    assert_terminal_rejection(deployment, reinforce(army, 4), 80);
    assert_eq!(
        super::play_fixture::rejection(ref rejected, deployment.games).reason, "realm cannot pay to raise troops",
    );
    assert_eq!(super::resource_commands::resource_facts(deployment, home), before);
    assert_eq!(IStructureOperationsDispatcher { contract_address: deployment.games }.home_armies(home).len(), 1);

    // Forty more seconds yield ten wheat, enough for four more troops.
    assert!(execute(deployment, raise(home, 4, 1), 120));
    assert_eq!(stored(deployment, home, KNIGHT), 12 * RESOURCE_PRECISION);
    assert_eq!(stored(deployment, home, WHEAT), 4 * RESOURCE_PRECISION);
}

#[test]
fn stores_pay_every_second_independently_of_the_armies_tick() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    // Production advances between the unchanged minute-long armies ticks.
    assert_eq!(super::play_fixture::rules().tick_config.armies_tick_in_seconds, 60);
    settle(deployment, home, KNIGHT, 59);
    assert_eq!(stored(deployment, home, KNIGHT), 38);
    settle(deployment, home, KNIGHT, 60);
    assert_eq!(stored(deployment, home, KNIGHT), 40);
    settle(deployment, home, KNIGHT, 119);
    assert_eq!(stored(deployment, home, KNIGHT), 158);
    settle(deployment, home, KNIGHT, 120);
    assert_eq!(stored(deployment, home, KNIGHT), 160);
}

#[test]
fn each_rations_pick_takes_a_quarter_wheat_off_every_troop_deployed() {
    let (deployment, home) = frontier_realm(frontier_preset());
    allow_armies(deployment, home);
    grant(deployment, home, KNIGHT, 20 * RESOURCE_PRECISION);
    grant(deployment, home, WHEAT, 20 * RESOURCE_PRECISION);
    // Drill then Rations: 1.75 wheat a troop.
    learn_barracks(deployment, home, array![crate::research::CHOICE_DRILL, crate::research::CHOICE_RATIONS].span());
    assert!(execute(deployment, raise(home, 4, 0), 40));
    assert_eq!(stored(deployment, home, WHEAT), 13 * RESOURCE_PRECISION);
    // Rations twice: 1.5 wheat a troop.
    learn_barracks(deployment, home, array![crate::research::CHOICE_RATIONS, crate::research::CHOICE_RATIONS].span());
    assert!(execute(deployment, raise(home, 4, 1), 40));
    assert_eq!(stored(deployment, home, WHEAT), 7 * RESOURCE_PRECISION);
}

#[test]
fn wheat_labor_and_troops_each_fill_to_their_own_limit_and_essence_has_none() {
    let (deployment, home) = frontier_realm(frontier_preset());
    let limit = castle_limit(0);
    assert_eq!(resources(deployment).resource_weight(home).capacity, core::num::traits::Bounded::<u128>::MAX);
    grant(deployment, home, WHEAT, 2 * limit);
    assert_eq!(stored(deployment, home, WHEAT), limit);
    // A full granary leaves every other store its whole room.
    grant(deployment, home, crate::resources::LABOR, 2 * limit);
    assert_eq!(stored(deployment, home, crate::resources::LABOR), limit);
    grant(deployment, home, KNIGHT, 2 * limit);
    assert_eq!(stored(deployment, home, KNIGHT), limit);
    grant(deployment, home, crate::resources::ESSENCE, 2 * limit);
    assert_eq!(stored(deployment, home, crate::resources::ESSENCE), 2 * limit);
}

#[test]
fn a_payout_pays_what_fits_and_never_blocks() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, FARM, WEST), 40));
    let limit = castle_limit(0);
    store_exactly(deployment, home, crate::resources::LABOR, limit - 10);
    // Half the farm's hundred labor comes back, and only ten of it fits.
    assert!(execute(deployment, demolish(home, WEST), 50));
    assert_eq!(stored(deployment, home, crate::resources::LABOR), limit);

    start_cheat_caller_address(deployment.games, deployment.games);
    let granted = resources(deployment)
        .grant_resource(
            home,
            crate::resources::LABOR,
            50,
            50,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
    assert_eq!(granted, 0);
}

#[test]
#[feature("safe_dispatcher")]
fn production_past_a_limit_is_gone_and_later_spending_sees_what_was_kept() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    let limit = castle_limit(0);
    store_exactly(deployment, home, KNIGHT, limit - 30);
    // Sixty seconds train 120 troops; the store has room for 30 and the rest is gone.
    settle(deployment, home, KNIGHT, 100);
    assert_eq!(stored(deployment, home, KNIGHT), limit);

    start_cheat_caller_address(deployment.games, deployment.games);
    let refused = IResourceOperationsSafeDispatcher { contract_address: deployment.games }
        .spend_resource(
            home,
            KNIGHT,
            limit + 1,
            100,
            crate::commands::resource_context(super::context(deployment.games, home.game_id)),
        );
    stop_cheat_caller_address(deployment.games);
    assert!(refused.is_err());
    spend(deployment, home, KNIGHT, 200, 100);
    // The next 25 seconds train 50, which all fit.
    settle(deployment, home, KNIGHT, 125);
    assert_eq!(stored(deployment, home, KNIGHT), limit - 150);
}

#[test]
fn a_level_up_settles_production_under_the_old_limits_before_raising_them() {
    let (deployment, home) = frontier_realm(level_up_once(frontier_preset()));
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    store_exactly(deployment, home, KNIGHT, castle_limit(0) - 30);
    // Sixty seconds trained 120 troops against room for 30: the castle's rise cannot rescue the other 90.
    assert!(execute(deployment, Command::LevelUp(home.entity_id), 100));
    settle(deployment, home, KNIGHT, 100);
    assert_eq!(stored(deployment, home, KNIGHT), castle_limit(0));
    settle(deployment, home, KNIGHT, 130);
    assert_eq!(stored(deployment, home, KNIGHT), castle_limit(0) + 60);
    assert!(castle_limit(1) > castle_limit(0) + 60);
}

#[test]
fn a_changed_rate_applies_only_after_production_settles_at_the_old_one() {
    let (deployment, home) = frontier_realm(frontier_preset());
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    let one = rate(deployment, home, KNIGHT);
    assert!(execute(deployment, build(home, BARRACKS, WEST), 100));
    let two = rate(deployment, home, KNIGHT);
    assert!(two > one);
    // Each rate change settles all elapsed seconds at the previous rate.
    settle(deployment, home, KNIGHT, 130);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * one + 30 * two);

    assert!(execute(deployment, demolish(home, WEST), 150));
    assert_eq!(rate(deployment, home, KNIGHT), one);
    settle(deployment, home, KNIGHT, 190);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * one + 50 * two + 40 * one);
}

#[test]
fn outside_a_board_troops_are_still_produced_only_from_the_wheat_their_recipe_burns() {
    let (_, blitz) = super::preset_projection::current_definition("blitz");
    let mut preset = super::resource_commands::fixture_preset(
        crate::rules::SliceRules {
            mode_rules: super::play_fixture::BLITZ_RULES,
            entry_rule: crate::rules::ENTRY_ROSTER,
            command_mask: super::play_fixture::BLITZ_COMMAND_MASK,
            ..super::play_fixture::rules(),
        },
    );
    preset.structures.buildings = super::building_commands::rules();
    preset.resources.production = blitz.resources.production;
    let (deployment, home, _) = super::resource_commands::setup_with_preset(preset);
    let mut knight = None;
    for config in blitz.resources.production {
        if *config.resource_type == KNIGHT {
            knight = Some(*config.recipe);
        }
    }
    let knight = knight.unwrap();
    let mut wheat_per_cycle = 0;
    for input in knight.complex_inputs {
        grant(deployment, home, *input.resource_type, *input.amount);
        if *input.resource_type == WHEAT {
            wheat_per_cycle = *input.amount;
        }
    }
    assert!(wheat_per_cycle != 0);

    // A barracks with wheat in store trains nothing until the recipe is paid.
    assert!(execute(deployment, build(home, BARRACKS, EAST), 40));
    settle(deployment, home, KNIGHT, 100);
    assert_eq!(stored(deployment, home, KNIGHT), 0);
    assert_eq!(stored(deployment, home, WHEAT), wheat_per_cycle);

    let refill = RefillProduction {
        structure_id: home.entity_id, resource_types: array![KNIGHT].span(), amounts: array![1].span(),
    };
    assert!(execute(deployment, Command::BurnResourceForResourceProduction(refill), 100));
    assert_eq!(stored(deployment, home, WHEAT), 0);
    settle(deployment, home, KNIGHT, 160);
    assert_eq!(stored(deployment, home, KNIGHT), 60 * rate(deployment, home, KNIGHT));
    assert_terminal_rejection(deployment, Command::BurnResourceForResourceProduction(refill), 110);
}

#[test]
fn outside_a_board_raising_troops_pays_no_recipe() {
    let (deployment, home, _) = super::resource_commands::setup();
    allow_armies(deployment, home);
    grant(deployment, home, KNIGHT, 5 * RESOURCE_PRECISION);
    grant(deployment, home, 2, 100);
    // This realm's knights do have a recipe: it prices refills, not armies.
    let recipe = *super::production::recipes().at(KNIGHT.into() - 1).recipe;
    assert_eq!(*recipe.simple_inputs.at(0).resource_type, 2);
    assert!(execute(deployment, raise(home, 5, 0), 80));
    assert_eq!(stored(deployment, home, KNIGHT), 0);
    assert_eq!(stored(deployment, home, 2), 100);
}
