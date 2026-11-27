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
fn surface_rival_army_battle_applies_first_strike_by_mark() {
    let (d, home, target, attacker, defender) = setup_with_counts((1000, 1000));
    set_aspect(d, target, rival_aspect_of(d, home));
    set_troop_category(d, attacker, crate::troops::TroopType::Crossbowman);
    set_troop_category(d, defender, crate::troops::TroopType::Knight);
    let expected = expected_exchange(d, attacker, defender, false);
    assert!(execute(d, battle_command(attacker, defender), NOW));
    let (after_attacker, after_defender) = (
        troop(d, attacker).unwrap().troops.count, troop(d, defender).unwrap().troops.count,
    );
    assert_eq!((after_attacker, after_defender), expected);
    assert!(after_attacker > after_defender);
}

#[test]
fn deep_rival_army_battle_skips_guard_protection_and_applies_first_strike() {
    let (d, home, target, attacker, defender) = setup_with_counts((1000, 1000));
    into_deep(d, home, target, attacker, defender);
    set_troop_category(d, attacker, crate::troops::TroopType::Crossbowman);
    set_troop_category(d, defender, crate::troops::TroopType::Knight);
    let expected_field = expected_exchange(d, attacker, defender, false);
    let (_, guarded_defender) = expected_exchange(d, attacker, defender, true);
    assert!(execute(d, battle_command(attacker, defender), NOW));
    let (after_attacker, after_defender) = (
        troop(d, attacker).unwrap().troops.count, troop(d, defender).unwrap().troops.count,
    );
    assert_eq!((after_attacker, after_defender), expected_field);
    assert!(after_defender < guarded_defender);
    assert!(after_attacker > after_defender);
}

#[test]
fn allied_armies_of_the_same_aspect_cannot_fight_on_surface_or_in_the_deep() {
    let (d, home, target, attacker, defender) = setup_with_counts((1000, 1000));
    let own = home_aspect_of(d, home);
    set_aspect(d, target, own);
    let (before_attacker, before_defender) = (troop(d, attacker), troop(d, defender));
    assert_terminal_rejection(d, battle_command(attacker, defender), NOW);
    assert_eq!(troop(d, attacker), before_attacker);
    assert_eq!(troop(d, defender), before_defender);

    let (d, home, target, attacker, defender) = setup_with_counts((1000, 1000));
    into_deep(d, home, target, attacker, defender);
    set_aspect(d, target, home_aspect_of(d, home));
    let (before_attacker, before_defender) = (troop(d, attacker), troop(d, defender));
    assert_terminal_rejection(d, battle_command(attacker, defender), NOW);
    assert_eq!(troop(d, attacker), before_attacker);
    assert_eq!(troop(d, defender), before_defender);
}

#[test]
fn an_army_cannot_attack_an_army_from_its_own_account() {
    let (d, home, target, attacker, defender) = setup_with_counts((1000, 1000));
    set_aspect(d, target, rival_aspect_of(d, home));
    let original = IStructureOperationsDispatcher { contract_address: d.games }.structure(target).unwrap();
    set_fixture(
        d.games,
        selector!("structures"),
        selector!("structures"),
        array![3, target.entity_id.into()].span(),
        StructureRecord {
            owner: d.actor,
            base: original.base,
            resources_packed: original.resources_packed,
            metadata: original.metadata,
        },
    );
    let (before_attacker, before_defender) = (troop(d, attacker), troop(d, defender));
    assert_terminal_rejection(d, battle_command(attacker, defender), NOW);
    assert_eq!(troop(d, attacker), before_attacker);
    assert_eq!(troop(d, defender), before_defender);
}

#[test]
fn an_army_cannot_attack_another_army_out_of_range() {
    let (d, home, target, attacker, defender) = setup_with_counts((1000, 1000));
    set_aspect(d, target, rival_aspect_of(d, home));
    move_fixture(d, defender, 2000006);
    let (before_attacker, before_defender) = (troop(d, attacker), troop(d, defender));
    assert_terminal_rejection(d, battle_command(attacker, defender), NOW);
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

fn battle_command(attacker_id: u64, defender_id: u64) -> Command {
    Command::Battle(AttackExplorer { attacker_id, defender_id, steal_resources: array![].span() })
}

fn home_aspect_of(d: super::Deployment, home: ResourceKey) -> u8 {
    snforge_std::interact_with_state(d.games, || crate::logic::aspects::home_aspect(home))
}

fn rival_aspect_of(d: super::Deployment, home: ResourceKey) -> u8 {
    snforge_std::interact_with_state(
        d.games,
        || {
            let own = crate::logic::aspects::home_aspect(home);
            let packed = crate::logic::aspects::rules();
            let mut order = 1;
            while crate::aspects::order_aspect(packed, order) == own {
                order += 1;
            }
            crate::aspects::order_aspect(packed, order)
        },
    )
}

fn set_aspect(d: super::Deployment, home: ResourceKey, aspect: u8) {
    snforge_std::interact_with_state(
        d.games,
        || starknet::storage::StorageMapWriteAccess::write(
            crate::state::write().settlements.home_aspects, (home.game_id, home.entity_id), aspect,
        ),
    );
}

fn set_troop_category(d: super::Deployment, id: u64, category: crate::troops::TroopType) {
    let mut explorer = troop(d, id).unwrap();
    explorer.troops = Troops { category, ..explorer.troops };
    super::resource_commands::set_explorer_fixture(d.games, ExplorerKey { game_id: 3, explorer_id: id }, explorer);
}

fn expected_exchange(
    d: super::Deployment, attacker_id: u64, defender_id: u64, defender_is_guard: bool,
) -> (u128, u128) {
    let attacker = resolved(d, attacker_id).unwrap();
    let defender = resolved(d, defender_id).unwrap();
    let context = snforge_std::interact_with_state(
        d.games,
        || {
            let execution = crate::commands::load_context(3, 123_u256, NOW);
            let base = crate::logic::combat::combat_context(3, attacker, defender, execution);
            crate::combat::CombatContext { defender_is_structure_guard: defender_is_guard, ..base }
        },
    );
    let rules = crate::game::IGameDispatcherTrait::rules(crate::game::IGameDispatcher { contract_address: d.games }, 3);
    let mut alpha = attacker.troops;
    let mut bravo = defender.troops;
    alpha
        .attack_with_context(
            ref bravo,
            context,
            rules.troop_stamina_config,
            rules.troop_damage_config,
            rules.tick_config.armies_tick_in_seconds,
            rules.battle_config.cooldown_seconds,
        );
    (alpha.count, bravo.count)
}
