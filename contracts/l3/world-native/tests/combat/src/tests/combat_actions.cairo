pub use world_test_support::tests::combat_actions::*;
const NOW: u64 = super::play_fixture::FIXTURE_START;

#[test]
fn a_surviving_explorer_loots_the_defeated_army_before_its_resources_are_deleted() {
    let (d, home, target, attacker, defender) = setup();
    into_deep(d, home, target, attacker, defender);
    grant(d, ResourceKey { game_id: 3, entity_id: defender }, 2, 90);
    let attacker_before = troop(d, attacker).unwrap();
    let defender_before = troop(d, defender).unwrap();
    let mut spy = spy_events();
    assert!(
        execute(
            d,
            Command::Battle(
                AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: resources(70) },
            ),
            NOW,
        ),
    );
    assert!(troop(d, defender).is_none());
    super::state::assert_spatial_indexes(
        d.games,
        3,
        array![home.entity_id, target.entity_id, attacker, defender].span(),
        array![attacker_before.coord, defender_before.coord].span(),
    );
    assert!(troop(d, attacker).unwrap().troops.count != 0);
    assert_eq!(balance(d, attacker, 2), 70);
    let mut expected = array![];
    home.entity_id.serialize(ref expected);
    defender_before.coord.serialize(ref expected);
    resources(70).serialize(ref expected);
    crate::combat_actions::battle_side(d.actor, attacker_before.troops.count, troop(d, attacker).unwrap().troops)
        .serialize(ref expected);
    crate::combat_actions::battle_side(
        999.try_into().unwrap(), defender_before.troops.count, Troops { count: 0, ..defender_before.troops },
    )
        .serialize(ref expected);
    NOW.serialize(ref expected);
    let mut found = false;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("BattleEvent") {
            assert_eq!(event.data.span(), expected.span());
            found = true;
        }
    }
    assert!(found, "missing immutable battle outcome");
    assert!(
        !IResourceOperationsDispatcher { contract_address: d.games }
            .has_resource(ResourceKey { game_id: 3, entity_id: defender }),
    );
}

#[test]
fn a_won_battle_moves_exactly_the_requested_loot_of_each_resource_onto_the_attackers_balance() {
    let (d, home, target, attacker, defender) = setup();
    into_deep(d, home, target, attacker, defender);
    grant(d, ResourceKey { game_id: 3, entity_id: attacker }, 2, 5);
    grant(d, ResourceKey { game_id: 3, entity_id: defender }, 2, 90);
    grant(d, ResourceKey { game_id: 3, entity_id: defender }, 3, 40);
    let loot = array![ResourceAmount { resource_type: 2, amount: 70 }, ResourceAmount { resource_type: 3, amount: 40 }]
        .span();
    assert!(
        execute(
            d,
            Command::Battle(AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: loot }),
            NOW,
        ),
    );
    assert!(troop(d, defender).is_none());
    assert_eq!(balance(d, attacker, 2), 75);
    assert_eq!(balance(d, attacker, 3), 40);
    assert!(
        !IResourceOperationsDispatcher { contract_address: d.games }
            .has_resource(ResourceKey { game_id: 3, entity_id: defender }),
    );
}

#[test]
fn failed_loot_and_duplicate_resources_roll_back_combat() {
    let (d, home, target, attacker, defender) = setup();
    into_deep(d, home, target, attacker, defender);
    grant(d, ResourceKey { game_id: 3, entity_id: defender }, 2, 90);
    let before_attacker = troop(d, attacker);
    let before_defender = troop(d, defender);
    for amounts in array![
        resources(91),
        array![ResourceAmount { resource_type: 2, amount: 10 }, ResourceAmount { resource_type: 2, amount: 20 }].span(),
    ] {
        assert_terminal_rejection(
            d,
            Command::Battle(AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: amounts }),
            NOW,
        );
        assert_eq!(troop(d, attacker), before_attacker);
        assert_eq!(troop(d, defender), before_defender);
        assert_eq!(balance(d, defender, 2), 90);
    }
}

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
fn a_deep_battle_records_exact_damage_and_zero_rolls() {
    let (d, home, target, attacker, defender) = setup();
    into_deep(d, home, target, attacker, defender);
    let tile = crate::geometry::tile_key(3, troop(d, defender).unwrap().coord);
    let biome: crate::biome::Biome = IMapLogicDispatcher { contract_address: d.games }
        .biome(
            tile,
            crate::commands::biome_context(
                crate::commands::ExecutionContext { timestamp: NOW, ..crate::tests::context(d.games, 3) },
            ),
        )
        .into();
    let before_attacker = resolved(d, attacker).unwrap();
    let before_defender = resolved(d, defender).unwrap();
    let game = crate::game::IGameDispatcher { contract_address: d.games };
    let rules = crate::game::IGameDispatcherTrait::rules(game, 3);
    let mut expected_attacker = before_attacker.troops;
    let mut expected_defender = before_defender.troops;
    expected_attacker
        .attack_with_context(
            ref expected_defender,
            crate::combat::CombatContext {
                timestamp: NOW,
                attacker_biome: biome,
                defender_biome: biome,
                attacker_is_structure_guard: false,
                defender_is_structure_guard: false,
                attacker_oaths: 0,
                defender_oaths: 0,
                attacker_twin_damage: 0,
            },
            rules.troop_stamina_config,
            rules.troop_damage_config,
            rules.tick_config.armies_tick_in_seconds,
            5,
        );
    let mut spy = spy_events();
    assert!(
        execute(
            d,
            Command::Battle(
                AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: array![].span() },
            ),
            NOW,
        ),
    );
    assert_eq!(resolved(d, attacker).unwrap().troops, expected_attacker);
    assert_eq!(expected_defender.count, 0);
    assert!(resolved(d, defender).is_none());
    let mut expected = array![];
    before_attacker.owner.serialize(ref expected);
    before_defender.coord.serialize(ref expected);
    let empty: Span<ResourceAmount> = array![].span();
    empty.serialize(ref expected);
    crate::combat_actions::battle_side(d.actor, before_attacker.troops.count, expected_attacker)
        .serialize(ref expected);
    crate::combat_actions::battle_side(999.try_into().unwrap(), before_defender.troops.count, expected_defender)
        .serialize(ref expected);
    NOW.serialize(ref expected);
    let mut found = false;
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("BattleEvent") {
            assert_eq!(event.data.span(), expected.span());
            found = true;
        }
    }
    assert!(found);
}

#[test]
fn guard_attacks_reject_slots_outside_the_structures_limit() {
    let (d, home, _, _, defender) = setup();
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(home).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, home.entity_id.into()].span(),
        StructureRecord {
            owner: original.owner,
            base: crate::structures::StructureBase { troop_max_guard_count: 1, ..original.base },
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    move_fixture(d, defender, 2000001);
    set_guard(d, home, 1, 100);
    let before = troop(d, defender);
    assert_terminal_rejection(
        d,
        Command::GuardAttack(
            GuardAttack {
                guard: crate::troop_management::GuardSlot { structure_id: home.entity_id, slot: 1 },
                explorer_id: defender,
            },
        ),
        NOW,
    );
    assert_eq!(troop(d, defender), before);
    assert_eq!(guard(d, home, 1).troops.count, 100 * RESOURCE_PRECISION);
}

#[test]
fn mutual_destruction_does_not_recreate_resource_rows_for_loot() {
    let (d, home, target, attacker, defender) = setup();
    into_deep(d, home, target, attacker, defender);
    let mut explorer = troop(d, attacker).unwrap();
    explorer.troops.count = RESOURCE_PRECISION;
    crate::tests::resource_commands::set_explorer_fixture(
        d.games, crate::troops::ExplorerKey { game_id: 3, explorer_id: attacker }, explorer,
    );
    grant(d, ResourceKey { game_id: 3, entity_id: defender }, 2, 90);
    let mut spy = spy_events();
    assert!(
        execute(
            d,
            Command::Battle(
                AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: resources(90) },
            ),
            NOW,
        ),
    );
    let resources = IResourceOperationsDispatcher { contract_address: d.games };
    for id in array![attacker, defender] {
        assert!(troop(d, id).is_none());
        assert!(!resources.has_resource(ResourceKey { game_id: 3, entity_id: id }));
    }
    for (_, event) in spy.get_events().emitted_by(d.games).events.span() {
        if *event.keys.at(0) == selector!("RowSet") && *event.keys.at(2) == 'ResourceBalance' {
            assert_eq!(*event.data.at(event.data.len() - 1), 0, "loot revived a resource balance");
        }
    }
}

#[test]
fn a_site_clear_ignores_guards_outside_the_slot_limit() {
    let (d, _, _, attacker, _) = setup();
    let site = camp(d, attacker);
    limit_guards(d, site, 1);
    set_guard(d, site, 3, 100000);
    let before = troop(d, attacker).unwrap().troops.count;
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
    assert_eq!(troop(d, attacker).unwrap().troops.count, before);
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
fn season_one_allows_back_to_back_attacks_without_a_cooldown() {
    assert_eq!(crate::balance::rules::BATTLE_CONFIG.cooldown_seconds, 0);
    let (d, home, target, attacker, defender) = setup_with_counts((1000, 1000));
    into_deep(d, home, target, attacker, defender);
    let attack = Command::Battle(
        AttackExplorer { attacker_id: attacker, defender_id: defender, steal_resources: array![].span() },
    );
    super::resource_commands::assert_executes(d, 3, attack, NOW);
    assert!(troop(d, attacker).is_some() && troop(d, defender).is_some());
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
