use snforge_std::{EventSpyTrait, EventsFilterTrait, interact_with_state, spy_events};
use starknet::storage::StorageMapReadAccess;
use world_test_support::tests::Deployment;
use world_test_support::tests::play_fixture::FIXTURE_START;
use world_test_support::tests::registrar::{discovery_root, explore_with_root};
use world_test_support::tests::resource_commands::{execute_in_game, grant};
use crate::commands::Command;
use crate::discovery::Discovery;
use crate::resources::ResourceKey;
use crate::troops::{ArmySlotKey, ExplorerKey};
use super::army_activity::{army, found, slot_army};

fn setup(kind: u8) -> (Deployment, ExplorerKey, crate::expeditions::FrontierDiscoveryRules) {
    let mut seed = 1_u64;
    while crate::quests::daily_quest(seed.into(), 0) != kind {
        seed += 1;
        assert!(seed < 1000, "missing quest seed");
    }
    let (d, game_id) = super::aspects::setup_aspects(seed.into());
    let home = found(d, game_id, 1);
    grant(
        d, ResourceKey { game_id, entity_id: home }, crate::resources::WHEAT, 10000 * crate::rules::RESOURCE_PRECISION,
    );
    let key = ExplorerKey {
        game_id, explorer_id: slot_army(d, ArmySlotKey { game_id, structure_id: home, epoch: 0, slot: 0 }),
    };
    let discovery = interact_with_state(
        d.games,
        || crate::logic::discovery::lore_rules(
            crate::logic::research::require(ResourceKey { game_id, entity_id: home }).learned,
        ),
    );
    (d, key, discovery)
}

fn apply(d: Deployment, game_id: u32, command: Command) {
    let mut events = spy_events();
    if !execute_in_game(d, game_id, command, FIXTURE_START) {
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
    let root = discovery_root(key.game_id, rules, 100, 0, Some(far_eye()), expected);
    let mut events = spy_events();
    if !explore_with_root(d, key.game_id, key.explorer_id, root, FIXTURE_START) {
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
            FIXTURE_START,
        ),
    );
    assert_eq!(progress(d, home), 0);
    let root = discovery_root(
        key.game_id,
        crate::expeditions::FrontierDiscoveryRules { shrine_bps: 0, ..rules },
        100,
        0,
        Some(far_eye()),
        Discovery::None,
    );
    assert!(explore_with_root(d, key.game_id, key.explorer_id, root, FIXTURE_START));
    assert_eq!(progress(d, home), 1);
    apply(d, key.game_id, Command::Explore(crate::commands::Explore { explorer_id: key.explorer_id, direction: 3 }));
    assert_eq!(progress(d, home), 1);
}

#[test]
fn a_real_clear_completes_the_daily_hunt_and_two_claims_pay_once() {
    let (d, key, rules) = setup(crate::quests::HUNT);
    let home = home(d, key);
    let claim = Command::ClaimDailyQuest(crate::quests::ClaimDailyQuest { home: home.entity_id, day: 0 });
    assert!(!execute_in_game(d, key.game_id, claim, FIXTURE_START));
    let site = discover(d, key, rules, Discovery::Beasts);
    apply(
        d,
        key.game_id,
        Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site.entity_id, relic_slot: None },
        ),
    );
    let hunts = interact_with_state(d.games, || crate::logic::banes::target(crate::quests::HUNT, 1));
    let labor = crate::balance::quests::LABOR_AMOUNT * crate::rules::RESOURCE_PRECISION;
    let essence = crate::balance::quests::ESSENCE_AMOUNT * crate::rules::RESOURCE_PRECISION;
    let (labor_before, essence_before) = interact_with_state(
        d.games,
        || {
            assert_eq!(
                crate::logic::quests::read(home, 0),
                crate::quests::QuestProgress { progress: hunts, completed_level: 1 },
            );
            (
                crate::logic::resources::balance(home, crate::resources::LABOR),
                crate::logic::resources::balance(home, crate::resources::ESSENCE),
            )
        },
    );
    for _ in 0_u8..2 {
        assert!(execute_in_game(d, key.game_id, claim, FIXTURE_START));
        interact_with_state(
            d.games,
            || {
                assert_eq!(crate::logic::resources::balance(home, crate::resources::LABOR), labor_before + labor);
                assert_eq!(crate::logic::resources::balance(home, crate::resources::ESSENCE), essence_before + essence);
                assert_eq!(
                    crate::state::read().entry.home_labor_grants.read((key.game_id, home.entity_id, 0)),
                    Some((d.actor, labor, essence)),
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
        world_test_support::tests::registrar::strong_frontier_army(d, key.game_id, key);
        let clear = Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site.entity_id, relic_slot: None },
        );
        apply(d, key.game_id, clear);
        assert_eq!(progress(d, home), 1);
        let _ = execute_in_game(d, key.game_id, clear, FIXTURE_START);
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
    let (d, key, _) = setup(crate::quests::VETERANS);
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
    let rules = interact_with_state(
        d.games, || crate::logic::discovery::lore_rules(crate::logic::research::require(home).learned),
    );
    let root = discovery_root(key.game_id, rules, 100, 0, Some(far_eye()), Discovery::Shrine);
    let pass = crate::oaths::ChooseOath {
        explorer_id: key.explorer_id, expected_pick: shrine_pick(d, key, root), oath: None, replace: None,
    };
    apply(d, key.game_id, Command::ChooseOath(pass));
    assert_eq!(progress(d, home), 0);
    let pick = shrine_pick(d, key, root);
    let take = crate::oaths::ChooseOath { expected_pick: pick, oath: Some(crate::oaths::card(pick, 0)), ..pass };
    apply(d, key.game_id, Command::ChooseOath(take));
    assert_eq!(progress(d, home), 1);
    assert!(!execute_in_game(d, key.game_id, Command::ChooseOath(take), FIXTURE_START));
    assert_eq!(progress(d, home), 1);
}

fn shrine_pick(d: Deployment, key: ExplorerKey, root: u256) -> u16 {
    for _ in 0_u8..2 {
        let mut events = spy_events();
        if !explore_with_root(d, key.game_id, key.explorer_id, root, FIXTURE_START) {
            panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
        }
        let pick = interact_with_state(d.games, || crate::logic::progression::require(key).oath_pick);
        if pick != 0 {
            return pick;
        }
    }
    panic!("no shrine pick")
}

fn far_eye() -> crate::army_relics::ArmyRelic {
    crate::army_relics::ArmyRelic { kind: crate::army_relics::RelicKind::FarEye, rank: 1 }
}

fn discover_far_eye(d: Deployment, key: ExplorerKey, rules: crate::expeditions::FrontierDiscoveryRules) -> ResourceKey {
    let odds = interact_with_state(d.games, || crate::logic::expeditions::depth_rules(0).chest);
    for candidate in 0_u32..10000 {
        let mut root: u256 = candidate.into();
        let seed = crate::random::game_root(ref root, key.game_id);
        if crate::army_relics::draw(odds, seed) != far_eye() {
            continue;
        }
        if crate::discovery::frontier(rules, 100, 0, Some(far_eye()), seed) != Discovery::Ruin(far_eye()) {
            continue;
        }
        let destination = crate::geometry::neighbor(army(d, key).coord, 0);
        assert!(explore_with_root(d, key.game_id, key.explorer_id, candidate.into(), FIXTURE_START));
        let occupied = interact_with_state(
            d.games, || crate::logic::map::occupancy(crate::geometry::tile_key(key.game_id, destination)).unwrap(),
        );
        return ResourceKey { game_id: key.game_id, entity_id: occupied.entity_id };
    }
    panic!("no Far Eye discovery root");
}

#[test]
fn far_eye_discovers_and_pays_for_each_new_tile_only_once() {
    for kind in array![crate::quests::RELICS, crate::quests::REVEALS] {
        let (d, key, rules) = setup(kind);
        let home = home(d, key);
        let reserve = slot_army(
            d, ArmySlotKey { game_id: key.game_id, structure_id: home.entity_id, epoch: 0, slot: 1 },
        );
        apply(
            d,
            key.game_id,
            Command::ManageTroops(
                crate::troop_management::ManageTroops::Transfer(
                    crate::troop_management::TransferTroops {
                        source: crate::troop_management::Army::Explorer(reserve),
                        target: crate::troop_management::Army::Explorer(key.explorer_id),
                        amount: army(d, ExplorerKey { explorer_id: reserve, ..key }).troops.count,
                    },
                ),
            ),
        );
        let site = discover_far_eye(d, key, rules);
        assert_eq!(progress(d, home), 1);
        apply(
            d,
            key.game_id,
            Command::BattleGuard(
                crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site.entity_id, relic_slot: None },
            ),
        );
        let spires = kind == crate::quests::REVEALS;
        if spires {
            world_test_support::tests::registrar::learn_spire_lore(d, home, FIXTURE_START);
        }
        let before = far_eye_totals(d, home);
        let troops = army(d, key).troops.count;
        let mut events = spy_events();
        let activate = Command::ApplyRelic(
            crate::relics::ApplyRelic {
                entity_id: key.explorer_id,
                relic_id: crate::army_relics::encode(far_eye()),
                recipient: crate::relics::Recipient::ArmySlot(0),
            },
        );
        if !world_test_support::tests::play_fixture::play(
            d.games,
            world_test_support::tests::play_fixture::TestAction {
                game_id: key.game_id, actor: d.actor, command: activate,
            },
            far_eye_root(key.game_id, rules, spires),
            FIXTURE_START,
        ) {
            panic!("{}", world_test_support::tests::play_fixture::rejection(ref events, d.games).reason);
        }
        let mut payments = 0_u128;
        let mut ruins = 0_u128;
        for (_, event) in events.get_events().emitted_by(d.games).events {
            if event.keys.span() == array![selector!("ArmyRelicEvent"), selector!("RowSet"), 1, 'RuinRelic'].span() {
                ruins += 1;
            }
            let keys = event.keys.span();
            for prefix in 0..keys.len() {
                if *keys.at(prefix) != selector!("StoryEvent") {
                    continue;
                }
                let mut fields = keys.slice(prefix + 1, keys.len() - prefix - 1);
                let mut data = event.data.span();
                let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref fields, ref data).unwrap();
                if let crate::ownership::Story::ExplorationReward(paid) = story.story {
                    assert_eq!(paid.explorer_id, key.explorer_id);
                    assert_eq!(paid.receiver, home.entity_id);
                    assert_eq!(paid.amount, troops / 10);
                    assert!(
                        paid.resource_type == crate::resources::LABOR
                            || paid.resource_type == crate::resources::ESSENCE,
                    );
                    payments += 1;
                }
            }
        }
        assert_eq!(payments, 6);
        let after = far_eye_totals(d, home);
        assert_eq!(after - before, 6 * (troops / 10));
        if spires {
            let spire = interact_with_state(
                d.games,
                || crate::logic::spires::read(
                    crate::spires::ExpeditionSpireKey {
                        game_id: key.game_id, structure_id: home.entity_id, epoch: 0, depth: 0,
                    },
                )
                    .unwrap(),
            );
            assert_eq!(spire.reveals, 1);
            assert!(spire.location.is_some());
        } else {
            assert!(ruins >= 1);
        }
        let counted = 1 + if spires {
            payments
        } else {
            ruins
        };
        let expected = core::cmp::min(counted, interact_with_state(d.games, || crate::logic::banes::target(kind, 1)));
        assert_eq!(progress(d, home), expected);
        assert!(!execute_in_game(d, key.game_id, activate, FIXTURE_START));
        assert_eq!(progress(d, home), expected);
        assert_eq!(far_eye_totals(d, home), after);
    }
}

fn far_eye_totals(d: Deployment, home: ResourceKey) -> u128 {
    interact_with_state(
        d.games,
        || crate::logic::resources::balance(home, crate::resources::LABOR)
            + crate::logic::resources::balance(home, crate::resources::ESSENCE),
    )
}

fn far_eye_root(game_id: u32, rules: crate::expeditions::FrontierDiscoveryRules, spires: bool) -> u256 {
    for sample in 0_u64..10000 {
        let raw: u256 = sample.into();
        let mut root = raw;
        let seed = crate::random::game_root(ref root, game_id);
        if spires {
            if crate::random::range(seed, 0x5350495245, 10000) < 1000 {
                return raw;
            }
        } else if crate::discovery::frontier(rules, 100, 0, Some(far_eye()), seed) == Discovery::Ruin(far_eye()) {
            return raw;
        }
    }
    panic!("missing Far Eye discovery root")
}
