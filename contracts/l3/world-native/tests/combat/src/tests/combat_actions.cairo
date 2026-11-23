pub use world_test_support::tests::combat_actions::*;
const NOW: u64 = super::play_fixture::FIXTURE_START;

#[test]
fn combat_outcomes_ignore_random_roots_in_the_deep() {
    let (d, home, target, attacker, defender) = setup();
    into_deep(d, home, target, attacker, defender);
    let attacker = resolved(d, attacker).unwrap();
    let defender = resolved(d, defender).unwrap();
    let mut previous = None;
    for raw_root in array![123_u256, 987654321_u256] {
        let context = snforge_std::interact_with_state(
            d.games,
            || {
                let execution = crate::commands::load_context(3, raw_root, NOW);
                crate::logic::combat::combat_context(3, attacker, defender, execution)
            },
        );
        let mut alpha = attacker.troops;
        let mut bravo = defender.troops;
        let rules = crate::game::IGameDispatcherTrait::rules(
            crate::game::IGameDispatcher { contract_address: d.games }, 3,
        );
        alpha
            .attack_with_context(
                ref bravo,
                context,
                rules.troop_stamina_config,
                rules.troop_damage_config,
                rules.tick_config.armies_tick_in_seconds,
                0,
            );
        let outcome = (alpha.count, bravo.count);
        assert!(outcome != (attacker.troops.count, defender.troops.count));
        if let Some(expected) = previous {
            assert_eq!(outcome, expected);
        }
        previous = Some(outcome);
    }
}

#[test]
fn a_site_clear_ignores_guards_outside_the_slot_limit() {
    let (d, _, _, attacker, _) = setup();
    let site = camp(d, attacker);
    limit_guards(d, site, 1);
    set_guard(d, site, 0, 1);
    set_guard(d, site, 3, 100000);
    assert!(
        execute(
            d,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: attacker, defender_id: site.entity_id, relic_slot: None },
            ),
            NOW,
        ),
    );
    assert!(IStructureOperationsDispatcher { contract_address: d.games }.structure(site).is_none());
    assert!(troop(d, attacker).unwrap().troops.count != 0);
}

#[test]
fn an_army_that_did_not_beat_a_sites_guard_cannot_claim_it() {
    let (d, _, _, attacker, _) = setup();
    let site = camp(d, attacker);
    let before = troop(d, attacker);
    assert_terminal_rejection(
        d,
        Command::BattleGuard(
            crate::commands::Battle { attacker_id: attacker, defender_id: site.entity_id, relic_slot: None },
        ),
        NOW,
    );
    assert_eq!(troop(d, attacker), before);
    assert!(IStructureOperationsDispatcher { contract_address: d.games }.structure(site).is_some());
}

#[test]
fn guard_targeting_preserves_highest_occupied_functional_slot_first() {
    let (d, _, _, attacker, _) = setup();
    let site = camp(d, attacker);
    limit_guards(d, site, 4);
    set_guard(d, site, 0, 1000);
    set_guard(d, site, 2, 1);
    let delta = guard(d, site, 0);
    assert!(
        execute(
            d,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: attacker, defender_id: site.entity_id, relic_slot: None },
            ),
            NOW,
        ),
    );
    assert_eq!(guard(d, site, 0), delta);
    assert_eq!(guard(d, site, 2).troops.count, 0);
    assert!(IStructureOperationsDispatcher { contract_address: d.games }.structure(site).is_some());
}

#[test]
fn season_one_refuses_an_owned_target_without_spending() {
    assert!(crate::balance::rules::SWITCHES.mode_rules & crate::rules::UNOWNED_TARGETS != 0);
    let (d, _, target, attacker, _) = setup();
    let command = Command::BattleGuard(
        crate::commands::Battle { attacker_id: attacker, defender_id: target.entity_id, relic_slot: None },
    );
    let before = troop(d, attacker);
    assert_terminal_rejection(d, command, NOW);
    assert_eq!(troop(d, attacker), before);
    assert_eq!(
        IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap().owner,
        999.try_into().unwrap(),
    );
}

#[test]
fn season_one_turns_off_army_battles_so_an_army_in_the_open_cannot_be_attacked() {
    let (d, home, target, attacker, defender) = setup_with_counts((1000, 1000));
    into_deep(d, home, target, attacker, defender);
    let (before_attacker, before_defender) = (troop(d, attacker), troop(d, defender));
    let mut events = snforge_std::spy_events();
    assert!(
        !execute(
            d,
            Command::Battle(
                AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: array![].span() },
            ),
            NOW,
        ),
    );
    assert_eq!(super::play_fixture::rejection(ref events, d.games).reason, "command disabled");
    assert_eq!(troop(d, attacker), before_attacker);
    assert_eq!(troop(d, defender), before_defender);
}

#[test]
fn a_last_hit_that_kills_both_sides_clears_the_site_for_nobody() {
    let (d, _, _, attacker, _) = setup_with_counts((1, 1));
    let site = camp(d, attacker);
    limit_guards(d, site, 1);
    set_guard(d, site, 0, 1);
    assert!(
        execute(
            d,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: attacker, defender_id: site.entity_id, relic_slot: None },
            ),
            NOW,
        ),
    );
    assert!(troop(d, attacker).is_none());
    assert!(IStructureOperationsDispatcher { contract_address: d.games }.structure(site).is_none());
    let clear = snforge_std::interact_with_state(
        d.games, || crate::logic::expeditions::expedition_site(site).unwrap().clear.unwrap(),
    );
    assert_eq!(clear, crate::expeditions::SiteClear { explorer_id: 0, home_id: 0, reward: None });
}

#[test]
fn season_one_allows_back_to_back_attacks_without_a_cooldown() {
    assert_eq!(crate::balance::rules::BATTLE_CONFIG.cooldown_seconds, 0);
    let (d, _, _, attacker, _) = setup_with_counts((1000, 1));
    let site = camp(d, attacker);
    set_guard(d, site, 0, 1000);
    let attack = Command::BattleGuard(
        crate::commands::Battle { attacker_id: attacker, defender_id: site.entity_id, relic_slot: None },
    );
    super::resource_commands::assert_executes(d, 3, attack, NOW);
    assert!(troop(d, attacker).is_some() && guard(d, site, 0).troops.count != 0);
    assert_eq!(troop(d, attacker).unwrap().troops.battle_cooldown_end, NOW.try_into().unwrap());
    assert!(execute(d, attack, NOW), "second attack failed");
}

fn camp(d: super::Deployment, attacker: u64) -> ResourceKey {
    let army = troop(d, attacker).unwrap();
    let context = crate::commands::ExecutionContext { timestamp: NOW, ..crate::tests::context(d.games, 3) };
    start_cheat_caller_address(d.games, d.games);
    let site = crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
        IStructureOperationsDispatcher { contract_address: d.games },
        3,
        army.owner,
        crate::geometry::neighbor(army.coord, 0),
        crate::discovery::Discovery::Camp,
        0,
        NOW,
        crate::commands::action_context(context),
    );
    stop_cheat_caller_address(d.games);
    let site = ResourceKey { game_id: 3, entity_id: site };
    for slot in 0_u8..4 {
        set_guard(d, site, slot, 0);
    }
    site
}

fn resolved(d: super::Deployment, id: u64) -> Option<ExplorerTroops> {
    GameState { contract_address: d.games }.resolved_explorer(ExplorerKey { game_id: 3, explorer_id: id })
}
