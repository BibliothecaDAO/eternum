pub use world_test_support::tests::artificer::*;

#[test]
fn crafting_spends_precise_research_and_grants_the_seeded_relic_in_both_modes() {
    for blitz in array![false, true] {
        let (d, home) = setup(blitz);
        assert!(execute(d, Command::CraftRelic(home.entity_id), 30));
        assert_eq!(balance(d, home, RESEARCH), 10 * RESOURCE_PRECISION);
        assert_eq!(balance(d, home, 43), RESOURCE_PRECISION);
        for id in 39_u8..57 {
            if id != 43 {
                assert_eq!(balance(d, home, id), 0);
            }
        }
    }
}
#[test]
fn villages_craft_with_the_same_cost_and_have_no_connected_realm_requirement() {
    let (d, home) = setup(false);
    structure(d, home, d.actor, 5);
    assert!(execute(d, Command::CraftRelic(home.entity_id), 30));
    assert_eq!(balance(d, home, 43), RESOURCE_PRECISION);
    assert_eq!(balance(d, home, RESEARCH), 10 * RESOURCE_PRECISION);
}
#[test]
fn crafting_uses_the_supplied_root_without_the_gameplay_clock() {
    let (d, home) = setup(true);
    assert!(execute(d, Command::CraftRelic(home.entity_id), 30));
    assert_eq!(balance(d, home, 43), RESOURCE_PRECISION);
    assert_eq!(balance(d, home, RESEARCH), 10 * RESOURCE_PRECISION);
}
#[test]
fn rejected_crafting_preserves_balances() {
    let (d, home) = setup(false);
    let command = Command::CraftRelic(home.entity_id);
    assert_terminal_rejection(d, command, 19);
    structure(d, home, 987.try_into().unwrap(), 1);
    assert_terminal_rejection(d, command, 30);
    structure(d, home, d.actor, 4);
    assert_terminal_rejection(d, command, 30);
    structure(d, home, d.actor, 1);
    assert_eq!(balance(d, home, RESEARCH), 20 * RESOURCE_PRECISION);
    assert!(execute(d, command, 30));
    assert!(execute(d, command, 30));
    assert_terminal_rejection(d, command, 30);
    assert_eq!(balance(d, home, RESEARCH), 0);
    assert_eq!(balance(d, home, 43), 2 * RESOURCE_PRECISION);
    assert_terminal_rejection(d, command, 200);
}
#[test]
#[feature("safe_dispatcher")]
fn crafting_configuration_is_authorized_immutable_and_game_scoped() {
    let (d, _) = setup(false);
    let registrar = crate::registrar::IRegistrarSafeDispatcher { contract_address: d.games };
    let mut preset = super::resource_commands::fixture_preset(super::play_fixture::rules());
    preset.economy.research_cost = 5;
    start_cheat_caller_address(d.games, d.actor);
    assert!(registrar.register_preset(20000, preset).is_err());
    start_cheat_caller_address(d.games, super::authority());
    let games = crate::game::IGameDispatcher { contract_address: d.games };
    assert!(registrar.register_preset(games.game(3).preset_id, preset).is_err());
    stop_cheat_caller_address(d.games);
    super::play_fixture::seed_game_with_preset(d.games, 4, games.game(3), preset);
    assert_eq!(view(d).artificer_cost(4), 5);
    assert_eq!(view(d).artificer_cost(3), 10 * RESOURCE_PRECISION);
    assert!(IArtificerSafeDispatcher { contract_address: d.games }.artificer_cost(999).is_err());
}
