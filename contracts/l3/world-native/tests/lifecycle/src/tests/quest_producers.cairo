use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
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
    setup_progression(kind, None)
}

fn setup_progression(
    kind: u8, progression: Option<crate::progression::ArmyProgressionRules>,
) -> (Deployment, ExplorerKey, crate::expeditions::FrontierDiscoveryRules) {
    let (_, mut preset) = world_test_support::tests::preset_projection::current_definition("frontier");
    if progression.is_some() {
        preset.economy.progression = progression;
    }
    preset.economy.labor = None;
    preset
        .economy
        .quests =
            Some(
                crate::quests::QuestRules {
                    base_counts: array![100, 100, 100, 100, 100, 100, 100].span(),
                    labor: 1000,
                    essence: 1500,
                    bonus_percent: 150,
                },
            );
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        beasts_bps: 1000,
        camp_bps: 1000,
        rift_bps: 1000,
        ruin_bps: 1000,
        shrine_bps: 1000,
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
                    ruin_guard_lower: 3,
                    ruin_guard_upper: 3,
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
    let root = discovery_root(key.game_id, rules, 0, Some(far_eye()), expected);
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
        0,
        Some(far_eye()),
        Discovery::None,
    );
    assert!(explore_with_root(d, key.game_id, key.explorer_id, root, 360));
    assert_eq!(progress(d, home), 1);
    apply(d, key.game_id, Command::Explore(crate::commands::Explore { explorer_id: key.explorer_id, direction: 3 }));
    assert_eq!(progress(d, home), 1);
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
fn a_shrine_counts_the_point_when_collected_and_not_when_discovered() {
    let (d, key, rules) = setup(crate::quests::VETERANS);
    let home = home(d, key);
    let price = interact_with_state(
        d.games, || crate::logic::research::price(key.game_id, crate::research::ROW_SHRINE, 1),
    );
    grant(d, home, crate::resources::ESSENCE, price.essence);
    apply(
        d,
        key.game_id,
        Command::Research(
            crate::research::Research { structure_id: home.entity_id, row: crate::research::ROW_SHRINE, choice: 0 },
        ),
    );
    let site = discover(d, key, rules, Discovery::Shrine);
    assert_eq!(progress(d, home), 0);
    let coord = interact_with_state(d.games, || crate::logic::map::entity_coord(site).unwrap());
    let collect = Command::InteractSite(crate::relics::InteractSite { explorer_id: key.explorer_id, coord });
    apply(d, key.game_id, collect);
    assert_eq!(progress(d, home), 1);
    assert!(!execute_in_game(d, key.game_id, collect, 360));
    assert_eq!(progress(d, home), 1);
}

fn far_eye() -> crate::army_relics::ArmyRelic {
    crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::FarEye, rank: 1 }
}

fn discover_far_eye(d: Deployment, key: ExplorerKey, rules: crate::expeditions::FrontierDiscoveryRules) -> ResourceKey {
    let odds = interact_with_state(d.games, || crate::logic::expeditions::depth_rules(key.game_id, 0).chest);
    for candidate in 0_u32..10000 {
        let mut root: u256 = candidate.into();
        let seed = crate::random::game_root(ref root, key.game_id);
        if crate::army_relics::draw(odds, seed) != far_eye() {
            continue;
        }
        if crate::discovery::frontier(rules, 0, 0, 0, 0, Some(far_eye()), seed) != Discovery::Ruin(far_eye()) {
            continue;
        }
        let destination = crate::geometry::neighbor(army(d, key).coord, 0);
        assert!(explore_with_root(d, key.game_id, key.explorer_id, candidate.into(), 360));
        let occupied = interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(key.game_id, destination)).unwrap(),
        );
        return ResourceKey { game_id: key.game_id, entity_id: occupied.entity_id };
    }
    panic!("no Far Eye discovery root");
}

#[test]
fn relics_counts_the_discovered_ruin_once_and_far_eye_counts_its_actual_new_tiles() {
    for kind in array![crate::quests::RELICS, crate::quests::REVEALS] {
        let (d, key, rules) = setup(kind);
        let home = home(d, key);
        let site = discover_far_eye(d, key, rules);
        assert_eq!(progress(d, home), 1);
        apply(
            d,
            key.game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site.entity_id, relic_slot: None },
            ),
        );
        assert_eq!(progress(d, home), 1);
        let mut events = spy_events();
        let activate = Command::ApplyRelic(
            crate::relics::ApplyRelic {
                entity_id: key.explorer_id,
                relic_id: crate::army_relics::encode(far_eye()),
                recipient: crate::relics::Recipient::ArmySlot(0),
            },
        );
        apply(d, key.game_id, activate);
        let mut revealed = 0_u128;
        for (_, event) in events.get_events().emitted_by(d.games).events {
            if event.keys.span() == array![selector!("MapEvent"), selector!("RowSet"), 1, 'TileOpt'].span() {
                revealed += 1;
            }
        }
        assert!(revealed > 0 && revealed <= 6);
        let expected = if kind == crate::quests::REVEALS {
            1 + revealed
        } else {
            1
        };
        assert_eq!(progress(d, home), expected);
        assert!(!execute_in_game(d, key.game_id, activate, 360));
        assert_eq!(progress(d, home), expected);
    }
}

#[test]
fn reveal_xp_counts_every_point_crossed_across_ranks_and_cycles_once() {
    let (d, key, rules) = setup_progression(
        crate::quests::VETERANS,
        Some(
            crate::progression::ArmyProgressionRules {
                reveal_xp: 7,
                reveal_xp_per_depth: 0,
                common_xp: 1,
                uncommon_xp: 2,
                rare_xp: 3,
                epic_xp: 4,
                legendary_xp: 5,
            },
        ),
    );
    let home = home(d, key);
    let root = discovery_root(
        key.game_id,
        crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, ..rules },
        0,
        Some(far_eye()),
        Discovery::None,
    );
    assert!(explore_with_root(d, key.game_id, key.explorer_id, root, 360));
    let earned = interact_with_state(d.games, || crate::logic::progression::require(key));
    assert_eq!(earned.xp, 7);
    assert_eq!(
        (earned.common_points, earned.uncommon_points, earned.rare_points, earned.epic_points, earned.legendary_points),
        (2, 2, 1, 1, 1),
    );
    assert_eq!(progress(d, home), 7);
    apply(d, key.game_id, Command::Explore(crate::commands::Explore { explorer_id: key.explorer_id, direction: 3 }));
    assert_eq!(progress(d, home), 7);
}

#[test]
fn earned_reveal_points_complete_the_real_quest_and_its_claim_pays_only_once() {
    let (d, key, rules) = setup_progression(
        crate::quests::VETERANS,
        Some(
            crate::progression::ArmyProgressionRules {
                reveal_xp: 100,
                reveal_xp_per_depth: 0,
                common_xp: 1,
                uncommon_xp: 2,
                rare_xp: 3,
                epic_xp: 4,
                legendary_xp: 5,
            },
        ),
    );
    let home = home(d, key);
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 });
    assert!(!execute_in_game(d, key.game_id, claim, 360));
    let root = discovery_root(
        key.game_id,
        crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, ..rules },
        0,
        Some(far_eye()),
        Discovery::None,
    );
    assert!(explore_with_root(d, key.game_id, key.explorer_id, root, 360));
    let (labor, essence) = interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::quests::read(home, 0), crate::quests::QuestProgress { progress: 100, completed_level: 1 },
            );
            (
                crate::logic::resources::balance(home, crate::resources::LABOR),
                crate::logic::resources::balance(home, crate::resources::ESSENCE),
            )
        },
    );
    for _ in 0_u8..2 {
        apply(d, key.game_id, claim);
        interact_with_state(
            d.games,
            || {
                assert_eq!(
                    crate::logic::resources::balance(home, crate::resources::LABOR),
                    labor + 1000 * crate::rules::RESOURCE_PRECISION,
                );
                assert_eq!(
                    crate::logic::resources::balance(home, crate::resources::ESSENCE),
                    essence + 1500 * crate::rules::RESOURCE_PRECISION,
                );
                assert_eq!(
                    crate::state::read().entry.home_labor_grants.read((key.game_id, home.entity_id, 0)),
                    Some((d.actor, 1000 * crate::rules::RESOURCE_PRECISION, 1500 * crate::rules::RESOURCE_PRECISION)),
                );
            },
        );
    }
}
