use snforge_std::interact_with_state;
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::entry::{
    EventSpyTrait, EventsFilterTrait, IHomeGrantsSafeDispatcherTrait, ISettlementEntrySafeDispatcherTrait,
};
use world_test_support::tests::play_fixture::FIXTURE_START;
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::entry::{IResourceContextDispatcherTrait, IResourceContextLibraryDispatcher};
use crate::quests::{IQuestProgressDispatcherTrait, IQuestProgressLibraryDispatcher};
use crate::resources::{IResourceOperationsDispatcherTrait, IResourceOperationsLibraryDispatcher, ResourceKey};

fn quest_game() -> (Deployment, u32) {
    super::aspects::setup_aspects(5)
}

fn observe(d: Deployment, home: ResourceKey, kind: u8, amount: u128) {
    interact_with_state(
        d.games,
        || {
            IQuestProgressLibraryDispatcher {
                class_hash: crate::logic::release::class_of(home.game_id, crate::slots::BRIDGE),
            }
                .record_quest_progress(home, kind, amount, FIXTURE_START);
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
            Command::SettleSeason(
                crate::realms::SettleSeason {
                    selected_realm: None, order: Some(world_test_support::tests::registrar::aspect_order(1)),
                },
            ),
            FIXTURE_START,
        ),
    );
    let home = ResourceKey {
        game_id, entity_id: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)),
    };
    assert_eq!(crate::quests::daily_quest(5, 0), crate::quests::REVEALS);
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 });
    assert!(!execute_in_game(d, game_id, claim, FIXTURE_START));
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
    assert!(!execute_in_game(d, game_id, claim, FIXTURE_START));
    observe(d, home, crate::quests::REVEALS, 1);
    observe(d, home, crate::quests::REVEALS, 100);
    let (labor_before, essence_before) = interact_with_state(
        d.games,
        || (
            crate::logic::resources::balance(home, crate::resources::LABOR),
            crate::logic::resources::balance(home, crate::resources::ESSENCE),
        ),
    );
    assert!(execute_in_game(d, game_id, claim, FIXTURE_START));
    assert!(execute_in_game(d, game_id, claim, FIXTURE_START));
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
    assert!(!execute_in_game(stranger, game_id, claim, FIXTURE_START));
    assert!(
        !execute_in_game(
            d,
            game_id,
            Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 1 }),
            FIXTURE_START,
        ),
    );
}

fn held_realm() -> world_test_support::tests::entry::EntryEntitlement {
    world_test_support::tests::entry::EntryEntitlement {
        realm_id: 1, metadata_1: 0, metadata_2: 0, metadata_3: 0, pass_kind: crate::settlement::HELD_REALM_KIND,
    }
}

#[feature("safe_dispatcher")]
fn register(d: Deployment, game_id: u32, entitlement: world_test_support::tests::entry::EntryEntitlement) {
    snforge_std::start_cheat_caller_address(d.games, world_test_support::tests::authority());
    world_test_support::tests::entry::ledger(d)
        .register_entitlement(world_test_support::tests::entry::EntryKey { game_id, owner: d.actor }, entitlement)
        .unwrap();
    snforge_std::stop_cheat_caller_address(d.games);
}

#[feature("safe_dispatcher")]
fn grant_seal(d: Deployment, game_id: u32, account: starknet::ContractAddress) -> bool {
    snforge_std::start_cheat_caller_address(d.games, world_test_support::tests::authority());
    let granted = world_test_support::tests::entry::IHomeGrantsSafeDispatcher { contract_address: d.games }
        .grant_seal(game_id, account)
        .is_ok();
    snforge_std::stop_cheat_caller_address(d.games);
    granted
}

fn quest_labor(
    d: Deployment, game_id: u32, entitlement: Option<world_test_support::tests::entry::EntryEntitlement>, seal: bool,
) -> u128 {
    if let Some(entitlement) = entitlement {
        register(d, game_id, entitlement);
    }
    if seal {
        assert!(grant_seal(d, game_id, d.actor));
    }
    let held = entitlement.map(|source| source.pass_kind == crate::settlement::HELD_REALM_KIND) == Some(true);
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(
                crate::realms::SettleSeason {
                    selected_realm: None,
                    order: if held {
                        None
                    } else {
                        Some(world_test_support::tests::registrar::aspect_order(1))
                    },
                },
            ),
            FIXTURE_START,
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
            FIXTURE_START,
        ),
    );
    let (_, labor, essence) = interact_with_state(
        d.games, || crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 0)).unwrap(),
    );
    assert_eq!(essence, 1500 * crate::rules::RESOURCE_PRECISION);
    labor / crate::rules::RESOURCE_PRECISION
}

#[test]
fn a_seal_or_a_held_realm_pays_the_labor_bonus() {
    let (d, game_id) = quest_game();
    assert_eq!(quest_labor(d, game_id, None, true), 1500);
    let (d, game_id) = quest_game();
    assert_eq!(quest_labor(d, game_id, Some(held_realm()), false), 1500);
    let (d, game_id) = quest_game();
    assert_eq!(quest_labor(d, game_id, None, false), 1000);
}

#[test]
#[feature("safe_dispatcher")]
fn only_the_ledger_operator_grants_one_seal_an_account_while_the_game_runs() {
    let (d, game_id) = quest_game();
    let grants = world_test_support::tests::entry::IHomeGrantsSafeDispatcher { contract_address: d.games };
    snforge_std::start_cheat_caller_address(d.games, d.actor);
    assert!(grants.grant_seal(game_id, d.actor).is_err());
    snforge_std::stop_cheat_caller_address(d.games);
    assert!(!grant_seal(d, game_id, 0.try_into().unwrap()));
    assert!(!grant_seal(d, game_id + 1, d.actor));
    snforge_std::start_cheat_block_timestamp(d.games, FIXTURE_START + 40);
    let mut spy = snforge_std::spy_events();
    assert!(grant_seal(d, game_id, d.actor));
    snforge_std::start_cheat_block_timestamp(d.games, FIXTURE_START + 100);
    assert!(grant_seal(d, game_id, d.actor));
    let mut rows = array![];
    for (_, event) in spy.get_events().emitted_by(d.games).events {
        if *event.keys.at(event.keys.len() - 1) == 'Seal' {
            rows.append(event.data.span());
        }
    }
    assert_eq!(
        rows.span(), array![array![2, game_id.into(), d.actor.into(), 1, (FIXTURE_START + 40).into()].span()].span(),
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().entry.seals.read((game_id, d.actor)), Some(FIXTURE_START + 40));
        },
    );
    let game = crate::game::IGameDispatcherTrait::game(
        crate::game::IGameDispatcher { contract_address: d.games }, game_id,
    );
    snforge_std::start_cheat_block_timestamp(d.games, game.end_at);
    let (stranger, _) = world_test_support::tests::deploy_player(777, world_test_support::tests::GUARDIAN);
    assert!(!grant_seal(d, game_id, stranger));
}

fn fund(d: Deployment, home: ResourceKey, resource_type: u8, amount: u128) {
    interact_with_state(
        d.games,
        || {
            let context = IResourceContextLibraryDispatcher {
                class_hash: crate::logic::release::class_of(home.game_id, crate::slots::BRIDGE),
            }
                .resource_context(home.game_id);
            IResourceOperationsLibraryDispatcher {
                class_hash: crate::logic::release::class_of(home.game_id, crate::slots::RESOURCES),
            }
                .grant_resource(home, resource_type, amount, FIXTURE_START, context);
        },
    );
}

fn found(d: Deployment, game_id: u32) -> ResourceKey {
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(
                crate::realms::SettleSeason {
                    selected_realm: None, order: Some(world_test_support::tests::registrar::aspect_order(1)),
                },
            ),
            FIXTURE_START,
        ),
    );
    ResourceKey {
        game_id, entity_id: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)),
    }
}

fn upgrade(d: Deployment, home: ResourceKey, level: u8) {
    let costs = interact_with_state(d.games, || crate::logic::upgrades::recipe(level).costs);
    for cost in costs {
        fund(d, home, *cost.resource_type, *cost.amount);
    }
    assert!(execute_in_game(d, home.game_id, Command::LevelUp(home.entity_id), FIXTURE_START));
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
            d,
            game_id,
            Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 }),
            FIXTURE_START,
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
    assert!(execute_in_game(d, game_id, claim, FIXTURE_START));
    assert!(execute_in_game(d, game_id, claim, FIXTURE_START));
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
fn a_late_seal_attaches_the_bonus_without_bypassing_any_quest() {
    let (d, game_id) = quest_game();
    let home = found(d, game_id);
    let tomorrow = interact_with_state(
        d.games,
        || crate::days::day_of(
            crate::logic::game::game(game_id), crate::balance::rules::SWITCHES.day_unit_seconds, FIXTURE_START,
        )
            .end,
    );
    snforge_std::start_cheat_block_timestamp(d.games, tomorrow);
    assert!(grant_seal(d, game_id, d.actor));
    assert!(grant_seal(d, game_id, d.actor));
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

fn held_quest_fragments(wonder: u32) -> u128 {
    let (d, game_id) = quest_game();
    world_test_support::tests::resource_commands::set_fixture(
        d.games, selector!("realms"), selector!("traits"), array![1].span(), wonder * 0x4000000 + 1,
    );
    assert_eq!(quest_labor(d, game_id, Some(held_realm()), false), 1500);
    let home = interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor));
    assert!(
        execute_in_game(
            d, game_id, Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home, day: 0 }), FIXTURE_START,
        ),
    );
    interact_with_state(d.games, || crate::state::read().entry.fragments.read((game_id, d.actor)))
}

#[test]
fn a_held_wonder_pays_ten_fragments_for_a_quest_once_and_a_realm_without_one_pays_none() {
    assert_eq!(held_quest_fragments(2), crate::fragments::WONDER_QUEST_FRAGMENTS.into());
    assert_eq!(held_quest_fragments(1), 0);
}
