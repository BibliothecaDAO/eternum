use snforge_std::interact_with_state;
use starknet::storage::{StorageMapReadAccess, StoragePointerReadAccess};
use world_test_support::tests::Deployment;
use world_test_support::tests::play_fixture::{TestAction, play};
use world_test_support::tests::resource_commands::execute_in_game;
use crate::commands::Command;
use crate::resources::ResourceKey;
use crate::rules::RESOURCE_PRECISION;

fn definition() -> crate::presets::PresetDefinition {
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
    preset
        .economy
        .banes =
            Some(
                crate::banes::BaneRules {
                    chance_step: 20,
                    quorum_percent: 25,
                    beast_percent: 150,
                    stamina_percent: 50,
                    production_percent: 50,
                    quest_counts: array![1, 2, 3, 4, 2, 4, 6, 8, 1, 2, 3, 4].span(),
                },
            );
    preset.rules.battle_config.regular_immunity_ticks = 0;
    preset.rules.battle_config.cooldown_seconds = 0;
    let mut depths = array![];
    for depth in preset.settlement.depths {
        depths
            .append(
                crate::expeditions::DepthRules {
                    beast_weak_lower: 1,
                    beast_weak_upper: 1,
                    beast_strong_lower: 2,
                    beast_strong_upper: 2,
                    guard_step: 1,
                    ..*depth,
                },
            );
    }
    preset.settlement.depths = depths.span();
    let command = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: 1, day: 0 });
    let encoded = world_test_support::tests::play_fixture::encode(command);
    let index: u32 = (*encoded.at(0)).try_into().unwrap();
    let mut bit = 1_u128;
    for _ in 0..index {
        bit *= 2;
    }
    preset.rules.command_mask = preset.rules.command_mask | bit;
    preset
}

fn setup() -> (Deployment, u32) {
    super::aspects::setup_aspect_preset(5, definition())
}

fn found(d: Deployment, game_id: u32, timestamp: u64) -> ResourceKey {
    assert!(
        execute_in_game(
            d,
            game_id,
            Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(1) }),
            timestamp,
        ),
    );
    ResourceKey {
        game_id, entity_id: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, d.actor)),
    }
}

fn root_for(game_id: u32, day: u64, chance: u16, kind: u8) -> u256 {
    for value in 0_u32..10000 {
        let root: u256 = value.into();
        if crate::logic::bane_calendar::draw(game_id, day, root, chance) == kind {
            return root;
        }
    }
    panic!("no fixture root for world bane")
}

fn rename(home: ResourceKey) -> Command {
    Command::SetEntityName(crate::names::SetEntityName { entity_id: home.entity_id, name: 'bane proof' })
}

fn claim(d: Deployment, home: ResourceKey, day: u64, timestamp: u64) -> bool {
    execute_in_game(
        d,
        home.game_id,
        Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day }),
        timestamp,
    )
}

fn train(d: Deployment, home: ResourceKey, timestamp: u64) {
    assert!(
        execute_in_game(
            d,
            home.game_id,
            world_test_support::tests::building_commands::create(home, crate::research::BARRACKS),
            timestamp,
        ),
    );
}

fn complete(d: Deployment, home: ResourceKey, day: u64, timestamp: u64) -> u128 {
    let slot = crate::troops::ArmySlotKey { game_id: home.game_id, structure_id: home.entity_id, epoch: day, slot: 0 };
    let existing = interact_with_state(d.games, || crate::logic::army_slot_storage::read(slot));
    if existing.is_none() {
        assert!(execute_in_game(d, home.game_id, super::army_activity::muster(home.entity_id, 0, 0, 10), timestamp));
    }
    let explorer_id = super::army_activity::slot_army(d, slot);
    let (kind, already_complete, rules) = interact_with_state(
        d.games,
        || (
            crate::logic::banes::quest_kind(home, day),
            crate::logic::quests::read(home, day).completed_level != 0,
            crate::logic::preset_record::for_game(home.game_id).discovery_rules.read().unwrap(),
        ),
    );
    let fight = !already_complete && kind != crate::quests::LIGHTS;
    let discovery = if fight {
        crate::discovery::Discovery::Beasts
    } else {
        crate::discovery::Discovery::None
    };
    let root = world_test_support::tests::registrar::discovery_root(
        home.game_id,
        crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, well_bps: 0, ..rules },
        0,
        Some(crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::FarEye, rank: 1 }),
        discovery,
    );
    let reveals: u32 = if !already_complete && kind == crate::quests::LIGHTS {
        2
    } else {
        1
    };
    let key = crate::troops::ExplorerKey { game_id: home.game_id, explorer_id };
    let destination = crate::geometry::neighbor(super::army_activity::army(d, key).coord, 0);
    for _ in 0..reveals {
        assert!(world_test_support::tests::registrar::explore_with_root(d, home.game_id, explorer_id, root, timestamp));
    }
    let mut labor_reward = 0;
    if fight {
        let site = interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(home.game_id, destination)).unwrap(),
        );
        assert!(
            execute_in_game(
                d,
                home.game_id,
                Command::BattleGuard(
                    crate::commands::Battle { attacker_id: explorer_id, defender_id: site.entity_id, relic_slot: None },
                ),
                timestamp,
            ),
        );
        labor_reward =
            interact_with_state(
                d.games,
                || {
                    crate::logic::expeditions::expedition_site(
                        ResourceKey { game_id: home.game_id, entity_id: site.entity_id },
                    )
                        .unwrap()
                        .clear
                        .unwrap()
                        .reward
                        .unwrap()
                        .amount
                },
            );
    }
    assert_eq!(interact_with_state(d.games, || crate::logic::quests::read(home, day).completed_level), 1);
    labor_reward
}

#[test]
fn a_rejected_action_records_the_world_roll_and_a_different_root_cannot_replace_it() {
    let (d, game_id) = setup();
    let home = found(d, game_id, 360);
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 0)), Some(0));
            assert_eq!(crate::state::read().banes.next_chance.read(game_id), 20);
        },
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    let ash = root_for(game_id, 1, 20, crate::banes::ASH_FALL);
    let normal = root_for(game_id, 1, 20, 0);
    assert!(
        !play(
            d.games,
            TestAction {
                game_id,
                actor: d.actor,
                command: Command::SetEntityName(crate::names::SetEntityName { entity_id: 999999, name: 'refused' }),
            },
            ash,
            tomorrow,
        ),
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 1)), Some(crate::banes::ASH_FALL));
            assert_eq!(crate::state::read().banes.next_chance.read(game_id), 0);
        },
    );
    assert!(play(d.games, TestAction { game_id, actor: d.actor, command: rename(home) }, normal, tomorrow + 1));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::kind(game_id, 1), Some(crate::banes::ASH_FALL));
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::CULL);
        },
    );
    let next = world_test_support::tests::registrar::day_start(d, game_id, 2);
    assert!(play(d.games, TestAction { game_id, actor: d.actor, command: rename(home) }, ash, next));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 2)), Some(0));
            assert_eq!(crate::state::read().banes.next_chance.read(game_id), 20);
        },
    );
}

#[test]
fn quorum_ends_the_effect_once_and_collection_pays_the_second_reward_once() {
    let mut preset = definition();
    let mut resources = array![];
    for rule in preset.resources.resources {
        resources
            .append(
                crate::resources::ResourceRule {
                    realm_rate: if *rule.resource_type == crate::resources::LABOR {
                        0
                    } else {
                        *rule.realm_rate
                    },
                    ..*rule,
                },
            );
    }
    preset.resources.resources = resources.span();
    let (d, game_id) = super::aspects::setup_aspect_preset(5, preset);
    let mut members = array![];
    let mut homes = array![];
    for index in 0_u32..5 {
        let (actor, account_class) = world_test_support::tests::deploy_player(
            9000 + index.into(), world_test_support::tests::GUARDIAN,
        );
        let member = Deployment { actor, account_class, ..d };
        members.append(member);
        let home = found(member, game_id, 360);
        train(member, home, 360);
        homes.append(home);
    }
    let first = *members.at(0);
    let home = *homes.at(0);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: first.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::ASH_FALL),
            tomorrow,
        ),
    );
    assert_eq!(interact_with_state(d.games, || crate::logic::banes::required(game_id, 1, 1)), 2);
    let first_clear_reward = complete(first, home, 1, tomorrow + 60);
    assert!(claim(first, home, 1, tomorrow + 60));
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::banes::progress(game_id, 1, 1), crate::banes::BaneProgress { completed: 1, ended_at: 0 },
            );
            assert!(crate::state::read().banes.bonus_grants.read((game_id, home.entity_id, 1)).is_none());
        },
    );
    complete(*members.at(1), *homes.at(1), 1, tomorrow + 120);
    complete(*members.at(1), *homes.at(1), 1, tomorrow + 121);
    interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::banes::progress(game_id, 1, 1),
                crate::banes::BaneProgress { completed: 2, ended_at: tomorrow + 120 },
            );
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::CULL);
            let effects = crate::logic::banes::read_effects(home, tomorrow, tomorrow + 180);
            assert_eq!(
                effects.windows,
                array![crate::banes::BaneWindow { kind: crate::banes::ASH_FALL, start: tomorrow, end: tomorrow + 120 }]
                    .span(),
            );
        },
    );
    assert!(claim(first, home, 1, tomorrow + 180));
    assert!(claim(first, home, 1, tomorrow + 181));
    let third = *members.at(2);
    let third_home = *homes.at(2);
    assert!(!claim(third, third_home, 1, tomorrow + 180));
    let third_clear_reward = complete(third, third_home, 1, tomorrow + 181);
    assert!(claim(third, third_home, 1, tomorrow + 182));
    for (target, clear_reward) in array![(home, first_clear_reward), (third_home, third_clear_reward)] {
        interact_with_state(
            d.games,
            || {
                assert_eq!(
                    crate::state::read().banes.bonus_grants.read((game_id, target.entity_id, 1)),
                    Some((1000 * RESOURCE_PRECISION, 1500 * RESOURCE_PRECISION)),
                );
                assert_eq!(
                    crate::logic::resources::balance(target, crate::resources::LABOR),
                    3600 * RESOURCE_PRECISION + clear_reward,
                );
                assert_eq!(
                    crate::logic::resources::balance(target, crate::resources::ESSENCE), 3000 * RESOURCE_PRECISION,
                );
            },
        );
    }
}

#[test]
fn real_production_splits_at_the_bane_start_and_quorum_end_and_army_stores_still_work() {
    let (d, game_id) = setup();
    let home = found(d, game_id, 360);
    assert!(
        execute_in_game(
            d, game_id, world_test_support::tests::building_commands::create(home, crate::research::WORKSHOP), 360,
        ),
    );
    let rate: u128 = interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::resources::balance(home, crate::resources::LABOR), 0);
            crate::logic::resources::production(home, crate::resources::LABOR).production_rate
        },
    )
        .into();
    assert!(rate > 0);
    train(d, home, 6360);
    interact_with_state(
        d.games,
        || {
            let armies = crate::logic::troops::home_armies(home);
            let army = ResourceKey { game_id, entity_id: *armies.at(0) };
            let classes = crate::logic::release::classes(game_id);
            let context = crate::entry::IResourceContextDispatcherTrait::resource_context(
                crate::entry::IResourceContextLibraryDispatcher { class_hash: classes.bridge.read() }, game_id,
            );
            let credited = crate::resources::IResourceOperationsDispatcherTrait::grant_resource(
                crate::resources::IResourceOperationsLibraryDispatcher { class_hash: classes.resources.read() },
                army,
                crate::resources::ESSENCE,
                RESOURCE_PRECISION,
                360,
                context,
            );
            assert_eq!(credited, RESOURCE_PRECISION);
            assert_eq!(crate::logic::resources::balance(army, crate::resources::ESSENCE), RESOURCE_PRECISION);
        },
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::ASH_FALL),
            tomorrow,
        ),
    );
    let clear_reward = complete(d, home, 1, tomorrow + 600);
    let now = tomorrow + 1000;
    assert!(
        execute_in_game(
            d, game_id, world_test_support::tests::building_commands::create(home, crate::research::FARM), now,
        ),
    );
    let ordinary_seconds: u128 = (tomorrow - 360 + 400).into();
    let expected = rate * ordinary_seconds + rate * 600 / 2 - 800 * RESOURCE_PRECISION + clear_reward;
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::resources::balance(home, crate::resources::LABOR), expected);
            assert_eq!(
                crate::logic::resources::production(home, crate::resources::LABOR).last_settled_at,
                now.try_into().unwrap(),
            );
        },
    );
}

fn deep_definition() -> crate::presets::PresetDefinition {
    let mut preset = definition();
    preset
        .economy
        .deep =
            Some(
                crate::deep::DeepRules {
                    foundation: crate::troops::Coord { alt: false, x: 10, y: 25 },
                    quarry: crate::troops::Coord { alt: false, x: 25, y: 25 },
                    altar: crate::troops::Coord { alt: false, x: 40, y: 25 },
                    beast_count: RESOURCE_PRECISION,
                    loss_per_tick: RESOURCE_PRECISION,
                    quarry_per_tick: RESOURCE_PRECISION,
                    altar_per_tick: 5,
                    altar_threshold: 10,
                },
            );
    preset
}

fn altar(d: Deployment, game_id: u32, source: u8, boundary: u64) {
    interact_with_state(
        d.games,
        || {
            crate::deep::IDeepBanesDispatcherTrait::credit_altar(
                crate::deep::IDeepBanesLibraryDispatcher {
                    class_hash: crate::logic::release::classes(game_id).bridge.read(),
                },
                game_id,
                source,
                boundary,
            );
        },
    );
}

fn blocked(d: Deployment, game_id: u32, aspect: u8, timestamp: u64) -> bool {
    interact_with_state(
        d.games,
        || {
            crate::deep::IDeepBanesDispatcherTrait::height_blocked(
                crate::deep::IDeepBanesLibraryDispatcher {
                    class_hash: crate::logic::release::classes(game_id).bridge.read(),
                },
                game_id,
                aspect,
                timestamp,
            )
        },
    )
}

#[test]
fn altar_reserves_distinct_rivals_and_a_completed_team_quest_restores_height_without_a_bonus() {
    let (d, game_id) = super::aspects::setup_aspect_preset(5, deep_definition());
    let mut members = array![];
    let mut homes = array![];
    for aspect in 1_u8..5 {
        let (actor, account_class) = world_test_support::tests::deploy_player(
            9500 + Into::<u8, felt252>::into(aspect), world_test_support::tests::GUARDIAN,
        );
        let member = Deployment { actor, account_class, ..d };
        assert!(
            execute_in_game(
                member,
                game_id,
                Command::SettleSeason(crate::realms::SettleSeason { selected_realm: None, aspect: Some(aspect) }),
                360,
            ),
        );
        homes
            .append(
                ResourceKey {
                    game_id,
                    entity_id: interact_with_state(d.games, || crate::entity_ids::home_for_actor(game_id, actor)),
                },
            );
        train(member, *homes.at((aspect - 1).into()), 360);
        members.append(member);
    }
    altar(d, game_id, 1, 480);
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.altar_bars.read((game_id, 1)), 5);
            assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 1 }).is_none());
        },
    );
    for boundary in array![600_u64, 720, 840, 960, 1080, 1200, 1320] {
        altar(d, game_id, 1, boundary);
    }
    let first_quest = interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.altar_bars.read((game_id, 1)), 10);
            assert_eq!(crate::state::read().banes.first_team_day.read(game_id), Some(0));
            assert!(crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 1, day: 1 }).is_none());
            for aspect in 2_u8..5 {
                let bane = crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect, day: 1 })
                    .unwrap();
                assert_eq!(bane.source, 1);
                assert_eq!(bane.issued_day, 0);
            }
            crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 1 }).unwrap().quest
        },
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    let member = *members.at(1);
    let home = *homes.at(1);
    assert!(play(d.games, TestAction { game_id, actor: member.actor, command: rename(home) }, 1, tomorrow));
    assert!(blocked(d, game_id, 2, tomorrow));
    complete(member, home, 1, tomorrow + 60);
    assert!(blocked(d, game_id, 2, tomorrow + 59));
    assert!(!blocked(d, game_id, 2, tomorrow + 60));
    assert!(claim(member, home, 1, tomorrow + 60));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::kind(game_id, 1), None);
            assert_eq!(crate::logic::banes::quest_kind(home, 1), first_quest);
            assert!(crate::state::read().banes.bonus_grants.read((game_id, home.entity_id, 1)).is_none());
            assert_eq!(
                crate::state::read().entry.home_labor_grants.read((game_id, home.entity_id, 1)),
                Some((member.actor, 1000 * RESOURCE_PRECISION, 1500 * RESOURCE_PRECISION)),
            );
        },
    );
    altar(d, game_id, 1, tomorrow + 120);
    interact_with_state(
        d.games,
        || {
            let next = crate::logic::deep_banes::bane(crate::deep::TeamBaneKey { game_id, aspect: 2, day: 2 }).unwrap();
            assert_ne!(next.quest, first_quest);
            assert_eq!(crate::state::read().banes.altar_bars.read((game_id, 1)), 0);
        },
    );
}

#[test]
fn issuing_a_team_bane_keeps_todays_world_quest_and_stops_future_rolls() {
    let (d, game_id) = super::aspects::setup_aspect_preset(5, deep_definition());
    let home = found(d, game_id, 360);
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::ASH_FALL),
            tomorrow,
        ),
    );
    altar(d, game_id, 1, tomorrow + 120);
    altar(d, game_id, 1, tomorrow + 240);
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::kind(game_id, 1), Some(crate::banes::ASH_FALL));
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::CULL);
            assert_eq!(
                crate::logic::banes::read_effects(home, tomorrow, tomorrow + 300).windows,
                array![crate::banes::BaneWindow { kind: crate::banes::ASH_FALL, start: tomorrow, end: tomorrow + 300 }]
                    .span(),
            );
        },
    );
    let next = world_test_support::tests::registrar::day_start(d, game_id, 2);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 2, 100, crate::banes::ASH_FALL),
            next,
        ),
    );
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 2)), Some(0));
            assert_eq!(crate::logic::banes::kind(game_id, 2), None);
        },
    );
}

#[test]
fn mist_tide_counts_each_real_reveal_once_and_keeps_the_rolled_day() {
    let (d, game_id) = setup();
    let home = found(d, game_id, 360);
    assert!(
        execute_in_game(
            d, game_id, world_test_support::tests::building_commands::create(home, crate::research::BARRACKS), 360,
        ),
    );
    let tomorrow = world_test_support::tests::registrar::day_start(d, game_id, 1);
    assert!(
        play(
            d.games,
            TestAction { game_id, actor: d.actor, command: rename(home) },
            root_for(game_id, 1, 20, crate::banes::MIST_TIDE),
            tomorrow,
        ),
    );
    assert!(execute_in_game(d, game_id, super::army_activity::muster(home.entity_id, 0, 0, 10), tomorrow));
    let explorer_id = super::army_activity::slot_army(
        d, crate::troops::ArmySlotKey { game_id, structure_id: home.entity_id, epoch: 1, slot: 0 },
    );
    let rules = interact_with_state(
        d.games, || {
            crate::logic::preset_record::for_game(game_id).discovery_rules.read().unwrap()
        },
    );
    let root = world_test_support::tests::registrar::discovery_root(
        game_id,
        crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, well_bps: 0, ..rules },
        0,
        Some(crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::FarEye, rank: 1 }),
        crate::discovery::Discovery::None,
    );
    assert!(world_test_support::tests::registrar::explore_with_root(d, game_id, explorer_id, root, tomorrow));
    interact_with_state(
        d.games,
        || {
            assert_eq!(crate::logic::banes::quest_kind(home, 1), crate::quests::LIGHTS);
            assert_eq!(
                crate::logic::quests::read(home, 1), crate::quests::QuestProgress { progress: 1, completed_level: 0 },
            );
            assert_eq!(crate::state::read().banes.world_days.read((game_id, 1)), Some(crate::banes::MIST_TIDE));
        },
    );
    assert!(
        execute_in_game(d, game_id, Command::Explore(crate::commands::Explore { explorer_id, direction: 3 }), tomorrow),
    );
    assert_eq!(interact_with_state(d.games, || crate::logic::quests::read(home, 1).progress), 1);
}

#[test]
fn missed_world_rolls_stop_at_the_fiftieth_day_and_never_roll_past_the_season() {
    let mut preset = definition();
    preset.rules.day_unit_seconds = 1440;
    let (d, game_id) = super::aspects::setup_aspect_preset(5, preset);
    let home = found(d, game_id, 360);
    let end = interact_with_state(d.games, || crate::logic::game::game(game_id).end_at);
    assert!(execute_in_game(d, game_id, rename(home), end - 1));
    interact_with_state(
        d.games,
        || {
            let state = crate::state::read();
            for day in 0_u64..50 {
                assert!(state.banes.world_days.read((game_id, day)).is_some());
            }
            assert!(state.banes.world_days.read((game_id, 50)).is_none());
            assert_eq!(state.banes.next_roll_at.read(game_id), end);
        },
    );
    assert!(!execute_in_game(d, game_id, rename(home), end));
    interact_with_state(
        d.games,
        || {
            assert!(crate::state::read().banes.world_days.read((game_id, 50)).is_none());
            assert_eq!(crate::state::read().banes.next_roll_at.read(game_id), end);
        },
    );
}
