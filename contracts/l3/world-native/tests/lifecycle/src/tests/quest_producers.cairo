use snforge_std::{interact_with_state, spy_events};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::Deployment;
use world_test_support::tests::registrar::{discovery_root, explore_with_root};
use world_test_support::tests::resource_commands::{execute_in_game, grant};
use crate::commands::Command;
use crate::discovery::Discovery;
use crate::resources::ResourceKey;
use crate::troops::{ArmySlotKey, ExplorerKey};
use super::army_activity::{army, found, slot_army};

fn setup(kind: u8) -> (Deployment, ExplorerKey, crate::expeditions::FrontierDiscoveryRules) {
    setup_target(kind, 100)
}

fn setup_target(kind: u8, target: u32) -> (Deployment, ExplorerKey, crate::expeditions::FrontierDiscoveryRules) {
    let (_, mut preset) = world_test_support::tests::preset_projection::current_definition("frontier-check");
    preset.economy.labor = None;
    preset
        .economy
        .quests =
            Some(
                crate::quests::QuestRules {
                    base_counts: array![target, target, target, target, target, target, target].span(),
                    labor: 1000,
                    essence: 1500,
                    bonus_percent: 150,
                },
            );
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 800,
        camp_bps: 800,
        rift_bps: 800,
        ruin_bps: 800,
        shrine_bps: 800,
        well_bps: 0,
        empty_reveal_limit: 7,
    };
    preset.economy.discovery = Some(discovery);
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: 1, day: 0 });
    let encoded = world_test_support::tests::play_fixture::encode(claim);
    let index: u32 = (*encoded.at(0)).try_into().unwrap();
    let mut claim_bit = 1_u128;
    for _ in 0..index {
        claim_bit *= 2;
    }
    preset.rules.command_mask = preset.rules.command_mask | claim_bit;
    preset.rules.mode_rules = preset.rules.mode_rules | crate::rules::DISCOVER_SPIRES;
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
                    site_guard_lower: 3,
                    site_guard_upper: 3,
                    guard_step: 1,
                    ..*depth,
                },
            );
    }
    preset.settlement.depths = depths.span();
    let mut seed = 1_u64;
    while crate::quests::daily_quest(seed.into(), 0) != kind {
        seed += 1;
        assert!(seed < 1000, "missing quest seed");
    }
    let (d, game_id) = super::aspects::setup_aspect_preset(seed.into(), preset);
    let home = found(d, game_id, 1);
    grant(
        d, ResourceKey { game_id, entity_id: home }, crate::resources::WHEAT, 10000 * crate::rules::RESOURCE_PRECISION,
    );
    let key = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 }),
    };
    (d, key, discovery)
}

fn apply(d: Deployment, game_id: u32, command: Command) {
    let mut events = spy_events();
    if !execute_in_game(d, game_id, command, 360) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
    }
}

fn progress(d: Deployment, home: ResourceKey) -> u128 {
    interact_with_state(d.games, || crate::logic::quests::read(home, 0).progress)
}

fn home(d: Deployment, key: ExplorerKey) -> ResourceKey {
    ResourceKey { game_id: key.game_id, entity_id: army(d, key).owner }
}

fn discover(
    d: Deployment, key: ExplorerKey, rules: crate::expeditions::FrontierDiscoveryRules, expected: Discovery,
) -> ResourceKey {
    let destination = crate::geometry::neighbor(army(d, key).coord, 0);
    let root = discovery_root(key.game_id, rules, 100, 0, Some(ruin_relic()), expected);
    let mut events = spy_events();
    if !explore_with_root(d, key.game_id, key.explorer_id, root, 360) {
        panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
    }
    let occupied = interact_with_state(
        d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(key.game_id, destination)).unwrap(),
    );
    ResourceKey { game_id: key.game_id, entity_id: occupied.entity_id }
}

#[test]
fn reveals_count_new_tiles_and_neither_refused_nor_repeated_moves() {
    let (d, key, rules) = setup(crate::quests::REVEALS);
    let home = home(d, key);
    assert_eq!(progress(d, home), 0);
    assert!(
        !execute_in_game(
            d,
            key.game_id,
            Command::Explore(crate::commands::Explore { explorer_id: key.explorer_id, direction: 6 }),
            360,
        ),
    );
    assert_eq!(progress(d, home), 0);
    let root = discovery_root(
        key.game_id,
        crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, ..rules },
        100,
        0,
        Some(ruin_relic()),
        Discovery::None,
    );
    assert!(explore_with_root(d, key.game_id, key.explorer_id, root, 360));
    assert_eq!(progress(d, home), 1);
    apply(d, key.game_id, Command::Explore(crate::commands::Explore { explorer_id: key.explorer_id, direction: 3 }));
    assert_eq!(progress(d, home), 1);
}

#[test]
fn a_real_reveal_completes_the_daily_quest_and_two_claims_pay_once() {
    let (d, key, rules) = setup_target(crate::quests::REVEALS, 1);
    let home = home(d, key);
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 });
    assert!(!execute_in_game(d, key.game_id, claim, 360));
    let root = discovery_root(
        key.game_id,
        crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, ..rules },
        100,
        0,
        Some(ruin_relic()),
        Discovery::None,
    );
    assert!(explore_with_root(d, key.game_id, key.explorer_id, root, 360));
    let (labor_before, essence_before) = interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::quests::read(home, 0), crate::quests::QuestProgress { progress: 1, completed_level: 1 },
            );
            (
                crate::logic::resources::balance(home, crate::resources::LABOR),
                crate::logic::resources::balance(home, crate::resources::ESSENCE),
            )
        },
    );
    for _ in 0_u8..2 {
        assert!(execute_in_game(d, key.game_id, claim, 360));
        interact_with_state(
            d.games,
            || {
                assert_eq!(
                    crate::logic::resources::balance(home, crate::resources::LABOR),
                    labor_before + 1000 * crate::rules::RESOURCE_PRECISION,
                );
                assert_eq!(
                    crate::logic::resources::balance(home, crate::resources::ESSENCE),
                    essence_before + 1500 * crate::rules::RESOURCE_PRECISION,
                );
                assert_eq!(
                    crate::state::read().entry.home_labor_grants.read((key.game_id, home.entity_id, 0)),
                    Some((d.actor, 1000 * crate::rules::RESOURCE_PRECISION, 1500 * crate::rules::RESOURCE_PRECISION)),
                );
            },
        );
    }
}

#[test]
fn hunt_camp_and_rift_progress_arrives_only_after_the_guard_is_cleared() {
    for (kind, expected) in array![
        (crate::quests::HUNT, Discovery::Beasts), (crate::quests::CAMPS, Discovery::Camp),
        (crate::quests::RIFTS, Discovery::Rift),
    ] {
        let (d, key, rules) = setup(kind);
        let home = home(d, key);
        let site = discover(d, key, rules, expected);
        assert_eq!(progress(d, home), 0);
        let clear = Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site.entity_id, relic_slot: None },
        );
        apply(d, key.game_id, clear);
        assert_eq!(progress(d, home), 1);
        let _ = execute_in_game(d, key.game_id, clear, 360);
        assert_eq!(progress(d, home), 1);
    }
}

#[test]
fn finds_counts_a_discovery_before_its_clear_and_never_counts_the_clear_twice() {
    let (d, key, rules) = setup(crate::quests::FINDS);
    let home = home(d, key);
    let site = discover(d, key, rules, Discovery::Beasts);
    assert_eq!(progress(d, home), 1);
    apply(
        d,
        key.game_id,
        Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site.entity_id, relic_slot: None },
        ),
    );
    assert_eq!(progress(d, home), 1);
}


#[test]
fn veterans_counts_each_oath_taken_and_neither_a_pass_nor_a_refused_repeat() {
    let (d, key, rules) = setup(crate::quests::VETERANS);
    let home = home(d, key);
    interact_with_state(
        d.games,
        || crate::logic::research::write(
            home,
            crate::research::RealmKnowledge {
                learned: world_test_support::tests::registrar::lore(crate::research::LORE_SHRINES),
            },
        ),
    );
    let root = discovery_root(key.game_id, rules, 100, 0, Some(ruin_relic()), Discovery::Shrine);
    let pass = crate::oaths::ChooseOath {
        explorer_id: key.explorer_id, expected_pick: shrine_pick(d, key, root), oath: None, replace: None,
    };
    apply(d, key.game_id, Command::ChooseOath(pass));
    assert_eq!(progress(d, home), 0);
    let pick = shrine_pick(d, key, root);
    let take = crate::oaths::ChooseOath { expected_pick: pick, oath: Some(crate::oaths::card(pick, 0)), ..pass };
    apply(d, key.game_id, Command::ChooseOath(take));
    assert_eq!(progress(d, home), 1);
    assert!(!execute_in_game(d, key.game_id, Command::ChooseOath(take), 360));
    assert_eq!(progress(d, home), 1);
}

fn shrine_pick(d: Deployment, key: ExplorerKey, root: u256) -> u16 {
    for _ in 0_u8..2 {
        let mut events = spy_events();
        if !explore_with_root(d, key.game_id, key.explorer_id, root, 360) {
            panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
        }
        let pick = interact_with_state(d.games, || crate::logic::progression::require(key).oath_pick);
        if pick != 0 {
            return pick;
        }
    }
    panic!("no shrine pick")
}

fn ruin_relic() -> crate::army_relics::ArmyRelic {
    crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::Blade, rank: 1 }
}
