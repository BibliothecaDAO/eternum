use snforge_std::interact_with_state;
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::entry::ISettlementEntrySafeDispatcherTrait;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::entry::{IResourceContextDispatcherTrait, IResourceContextLibraryDispatcher};
use crate::quests::{IQuestProgressDispatcherTrait, IQuestProgressLibraryDispatcher};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};

fn quest_game() -> (Deployment, u32) {
    let (_, mut preset) = world_test_support::tests::preset_projection::current_definition("frontier");
    preset.economy.labor = None;
    preset
        .economy
        .quests =
            Some(
                crate::quests::QuestRules {
                    base_counts: array![1, 1, 1, 1, 1, 2, 15].span(), labor: 1000, essence: 1500, bonus_percent: 150,
                },
            );
    let command = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: 1, day: 0 });
    let encoded = world_test_support::tests::play_fixture::encode(command);
    let index: u32 = (*encoded.at(0)).try_into().unwrap();
    let mut bit = 1_u128;
    for _ in 0..index {
        bit *= 2;
    }
    preset.rules.command_mask = preset.rules.command_mask | bit;
    super::aspects::setup_aspect_preset(5, preset)
}

fn observe(d: Deployment, home: ResourceKey, kind: u8, amount: u128) {
    interact_with_state(
        d.games,
        || {
            IQuestProgressLibraryDispatcher { class_hash: crate::logic::release::classes(home.game_id).bridge.read() }
                .record_quest_progress(home, kind, amount, 360);
        },
    );
}

#[test]
fn progress_observations_freeze_completion_and_the_player_collects_only_once() {
    let (d, game_id) = quest_game();
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            360,
        ),
    );
    let home = ResourceKey {
        game_id, entity_id: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)),
    };
    assert_eq!(crate::quests::daily_quest(5, 0), crate::quests::REVEALS);
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 });
    assert!(!execute_in_game(d, game_id, claim, 360));
    observe(d, home, crate::quests::HUNT, 99);
    observe(d, home, crate::quests::REVEALS, 14);
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::quests::read(home, 0), crate::quests::QuestProgress { progress: 14, completed_level: 0 },
            );
        },
    );
    assert!(!execute_in_game(d, game_id, claim, 360));
    observe(d, home, crate::quests::REVEALS, 1);
    observe(d, home, crate::quests::REVEALS, 100);
    let (labor_before, essence_before) = interact_with_state(
        d.games,
        || (
            crate::logic::resources::balance(home, crate::resources::LABOR),
            crate::logic::resources::balance(home, crate::resources::ESSENCE),
        ),
    );
    assert!(execute_in_game(d, game_id, claim, 360));
    assert!(execute_in_game(d, game_id, claim, 360));
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::quests::read(home, 0), crate::quests::QuestProgress { progress: 15, completed_level: 1 },
            );
            assert_eq!(
                crate::logic::resources::balance(home, crate::resources::LABOR),
                labor_before + 1000 * crate::rules::RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::logic::resources::balance(home, crate::resources::ESSENCE),
                essence_before + 1500 * crate::rules::RESOURCE_PRECISION,
            );
            assert_eq!(
                crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 0)),
                Some((d.actor, 1000 * crate::rules::RESOURCE_PRECISION, 1500 * crate::rules::RESOURCE_PRECISION)),
            );
        },
    );
    let (actor, account_class) = world_test_support::tests::deploy_player(777, world_test_support::tests::GUARDIAN);
    let stranger = Deployment { actor, account_class, ..d };
    assert!(!execute_in_game(stranger, game_id, claim, 360));
    assert!(
        !execute_in_game(
            d, game_id, Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 1 }), 360,
        ),
    );
}

#[test]
fn producers_are_no_ops_for_games_without_quest_rules() {
    let (d, game_id) = super::aspects::setup_aspects(5);
    let home = ResourceKey { game_id, entity_id: 999 };
    observe(d, home, crate::quests::REVEALS, 15);
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::quests::read(home, 0), crate::quests::QuestProgress { progress: 0, completed_level: 0 },
            );
            assert!(crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 0)).is_none());
        },
    );
}

#[test]
#[feature("safe_dispatcher")]
fn held_and_campaign_homes_collect_the_labor_bonus_without_extra_essence() {
    for held in array![true, false] {
        let (d, game_id) = quest_game();
        let entitlement = world_test_support::tests::entry::EntryEntitlement {
            realm_id: if held {
                1
            } else {
                0
            },
            metadata_1: if held {
                0
            } else {
                'devcon-2026'
            },
            metadata_2: if held {
                0
            } else {
                crate::settlement::CAMPAIGN_NORMAL.into()
            },
            metadata_3: 0,
            pass_kind: if held {
                crate::settlement::HELD_REALM_KIND
            } else {
                crate::settlement::CAMPAIGN_KIND
            },
        };
        snforge_std::start_cheat_caller_address(d.games, world_test_support::tests::authority());
        world_test_support::tests::entry::ledger(d)
            .register_entitlement(world_test_support::tests::entry::EntryKey { game_id, owner: d.actor }, entitlement)
            .unwrap();
        snforge_std::stop_cheat_caller_address(d.games);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::SettleSeason(
                    crate::realms::SettleSeason { selected_realm: None, aspect: if held {
                        None
                    } else {
                        Some(1)
                    } },
                ),
                360,
            ),
        );
        let home = ResourceKey {
            game_id, entity_id: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)),
        };
        observe(d, home, crate::quests::REVEALS, 15);
        assert!(
            execute_in_game(
                d,
                game_id,
                Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 }),
                360,
            ),
        );
        interact_with_state(
            d.games,
            || {
                assert_eq!(
                    crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 0)),
                    Some((d.actor, 1500 * crate::rules::RESOURCE_PRECISION, 1500 * crate::rules::RESOURCE_PRECISION)),
                );
            },
        );
    }
}

fn fund(d: Deployment, home: ResourceKey, resource_type: u8, amount: u128) {
    interact_with_state(
        d.games,
        || {
            let classes = crate::logic::release::classes(home.game_id);
            let context = IResourceContextLibraryDispatcher { class_hash: classes.bridge.read() }
                .resource_context(home.game_id);
            IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() }
                .grant_resource(home, resource_type, amount, 360, context);
        },
    );
}

fn found(d: Deployment, game_id: u32) -> ResourceKey {
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            360,
        ),
    );
    ResourceKey {
        game_id, entity_id: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)),
    }
}

fn upgrade(d: Deployment, home: ResourceKey, level: u8) {
    let costs = interact_with_state(d.games, || crate::logic::upgrades::recipe(home.game_id, level).costs);
    for cost in costs {
        fund(d, home, *cost.resource_type, *cost.amount);
    }
    assert!(execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), 360));
    interact_with_state(d.games, || {
        assert_eq!(crate::logic::structures::record(home).base.level, level);
    });
}

#[test]
fn a_level_up_resizes_unfinished_progress_but_not_a_completed_reward() {
    let (d, game_id) = quest_game();
    let home = found(d, game_id);
    observe(d, home, crate::quests::REVEALS, 14);
    upgrade(d, home, 1);
    observe(d, home, crate::quests::REVEALS, 1);
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::quests::read(home, 0), crate::quests::QuestProgress { progress: 15, completed_level: 0 },
            );
        },
    );
    observe(d, home, crate::quests::REVEALS, 15);
    upgrade(d, home, 2);
    assert!(
        execute_in_game(
            d, game_id, Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 }), 360,
        ),
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::quests::read(home, 0), crate::quests::QuestProgress { progress: 30, completed_level: 2 },
            );
            assert_eq!(
                crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 0)),
                Some((d.actor, 2000 * crate::rules::RESOURCE_PRECISION, 3000 * crate::rules::RESOURCE_PRECISION)),
            );
        },
    );
}

#[test]
fn a_full_labor_store_still_collects_essence_and_records_the_actual_grant_once() {
    let (d, game_id) = quest_game();
    let home = found(d, game_id);
    fund(d, home, crate::resources::LABOR, 1000000 * crate::rules::RESOURCE_PRECISION);
    observe(d, home, crate::quests::REVEALS, 15);
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 });
    assert!(execute_in_game(d, game_id, claim, 360));
    assert!(execute_in_game(d, game_id, claim, 360));
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 0)),
                Some((d.actor, 0, 1500 * crate::rules::RESOURCE_PRECISION)),
            );
        },
    );
}

#[test]
#[feature("safe_dispatcher")]
fn late_campaign_recovery_attaches_the_bonus_without_bypassing_any_quest() {
    let (d, game_id) = quest_game();
    let home = found(d, game_id);
    let tomorrow = interact_with_state(
        d.games,
        || crate::days::day_of(
            crate::logic::game::game(game_id),
            crate::logic::preset_record::for_game(game_id).rules.day_unit_seconds.read(),
            360,
        )
            .end,
    );
    let entitlement = world_test_support::tests::entry::EntryEntitlement {
        realm_id: 0,
        metadata_1: 'devcon-2026',
        metadata_2: crate::settlement::CAMPAIGN_NORMAL.into(),
        metadata_3: 'devcon-recovery',
        pass_kind: crate::settlement::CAMPAIGN_KIND,
    };
    snforge_std::start_cheat_block_timestamp(d.games, tomorrow);
    snforge_std::start_cheat_caller_address(d.games, world_test_support::tests::authority());
    for _ in 0_u32..2 {
        world_test_support::tests::entry::ledger(d)
            .register_entitlement(world_test_support::tests::entry::EntryKey { game_id, owner: d.actor }, entitlement)
            .unwrap();
    }
    snforge_std::stop_cheat_caller_address(d.games);
    interact_with_state(
        d.games,
        || {
            assert!(crate::logic::quests::labor_bonus(home, d.actor));
            assert!(crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 0)).is_none());
            assert!(crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 1)).is_none());
        },
    );
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 1 }),
            tomorrow,
        ),
    );
}
