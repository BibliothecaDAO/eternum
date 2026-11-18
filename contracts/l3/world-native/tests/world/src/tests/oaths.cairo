use snforge_std::fs::{FileTrait, read_txt};
use starknet::storage::{StorageMapReadAccess, StoragePathEntry, StoragePointerReadAccess, StoragePointerWriteAccess};
use crate::oaths::{ChooseOath, card, count, draw, held};
use crate::stamina::StaminaSourceTrait;
use crate::troops::{ExplorerRecordTrait, StaminaSource};
use super::progression::read_progress;
use super::state::{GameState, TroopObservationTrait};

#[test]
fn every_draw_has_three_colours_and_excludes_every_held_oath_even_with_four_of_one_colour() {
    assert_eq!(crate::oaths::RED | crate::oaths::BLUE | crate::oaths::GOLD, 65535);
    assert_eq!(crate::oaths::RED & crate::oaths::BLUE, 0);
    assert_eq!(crate::oaths::BLUE & crate::oaths::GOLD, 0);
    assert_eq!(crate::oaths::RED & crate::oaths::GOLD, 0);
    for pool in array![crate::oaths::RED, crate::oaths::BLUE, crate::oaths::GOLD] {
        let mut oaths = 0;
        for oath in 1_u8..17 {
            if held(pool, oath) && count(oaths) < 4 {
                oaths += crate::oaths::bit(oath);
            }
        }
        for seed in 0_u64..32 {
            let pick = draw(oaths, seed.into());
            assert!(pick != 0 && pick < 4096);
            for (colour, pool) in array![(0_u8, crate::oaths::RED), (1, crate::oaths::BLUE), (2, crate::oaths::GOLD)] {
                let oath = card(pick, colour);
                assert!(held(pool, oath));
                assert!(!held(oaths, oath));
            }
        }
    }
}

#[test]
fn a_game_that_disables_choose_oath_writes_no_pick_and_keeps_the_army_exploring() {
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        camp_bps: 1, rift_bps: 0, ruin_bps: 0, beasts_bps: 0, shrine_bps: 5000, well_bps: 0, empty_reveal_limit: 7,
    };
    let (d, game_id, key) = super::registrar::setup_frontier_relics_with_rules(Some(discovery));
    let root = super::registrar::discovery_root(game_id, discovery, 100, 0, None, crate::discovery::Discovery::Shrine);
    snforge_std::interact_with_state(
        d.games,
        || {
            let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
            crate::logic::research::write(
                home,
                crate::research::RealmKnowledge { learned: crate::research::learn(0, crate::research::ROW_SHRINE, 0) },
            );
        },
    );
    explore(d, key, root, 360);
    let offered = read_progress(d, key);
    let decline = ChooseOath {
        explorer_id: key.explorer_id, expected_pick: offered.oath_pick, oath: None, replace: None,
    };
    assert!(super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::ChooseOath(decline), 361));
    snforge_std::interact_with_state(
        d.games,
        || {
            let state = crate::state::write();
            let preset = state.registrar.presets.read(state.games.games.entry(game_id).preset_id.read());
            let rules = state.presets.entry(preset).rules;
            let mask = rules.command_mask.read();
            assert!(crate::rules::command_enabled(mask, crate::command_routes::CHOOSE_OATH.into()));
            rules.command_mask.write(mask - core::num::traits::Pow::pow(2_u128, crate::command_routes::CHOOSE_OATH));
        },
    );
    for timestamp in 362_u64..366 {
        let command = crate::commands::Command::Explore(
            crate::commands::Explore { explorer_id: key.explorer_id, direction: 0 },
        );
        assert!(
            super::play_fixture::play(
                d.games, super::play_fixture::TestAction { game_id, actor: d.actor, command }, root, timestamp,
            ),
        );
        assert_eq!(read_progress(d, key).oath_pick, 0);
    }
}

#[test]
fn shrine_reveal_opens_a_persistent_pick_then_the_real_command_takes_replaces_and_declines() {
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        camp_bps: 1, rift_bps: 0, ruin_bps: 0, beasts_bps: 0, shrine_bps: 5000, well_bps: 0, empty_reveal_limit: 7,
    };
    let (d, game_id, key) = super::registrar::setup_frontier_relics_with_rules(Some(discovery));
    let root = super::registrar::discovery_root(game_id, discovery, 100, 0, None, crate::discovery::Discovery::Shrine);
    snforge_std::interact_with_state(
        d.games,
        || {
            let home = crate::resources::ResourceKey { game_id, entity_id: 1 };
            crate::logic::research::write(
                home,
                crate::research::RealmKnowledge { learned: crate::research::learn(0, crate::research::ROW_SHRINE, 0) },
            );
        },
    );
    explore(d, key, root, 360);
    let first = read_progress(d, key);
    assert!(first.oath_pick != 0);
    assert_eq!(first.oaths, 0);
    assert_army_commands_refused(d, key, first.oath_pick, 361);
    assert_eq!(read_progress(d, key).oath_pick, first.oath_pick);
    let taken = card(first.oath_pick, 0);
    let take = ChooseOath {
        explorer_id: key.explorer_id, expected_pick: first.oath_pick, oath: Some(taken), replace: None,
    };
    let other = super::bind_authority(d);
    let mut refused = snforge_std::spy_events();
    assert!(
        !super::resource_commands::execute_in_game(other, game_id, crate::commands::Command::ChooseOath(take), 362),
    );
    assert_eq!(super::play_fixture::rejection(ref refused, d.games).reason, "actor does not own structure");
    assert_eq!(read_progress(d, key), first);
    assert!(super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::ChooseOath(take), 362));
    let chosen = read_progress(d, key);
    assert_eq!(chosen.oaths, crate::oaths::bit(taken));
    assert_eq!(chosen.oath_pick, 0);
    assert!(!super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::ChooseOath(take), 363));
    assert_eq!(read_progress(d, key), chosen);
    explore(d, key, root, 364);
    let second = read_progress(d, key);
    let replacement = card(second.oath_pick, 1);
    let replace = ChooseOath { expected_pick: second.oath_pick, oath: Some(replacement), ..take };
    assert!(!super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::ChooseOath(replace), 365));
    assert_eq!(read_progress(d, key), second);
    assert!(
        super::resource_commands::execute_in_game(
            d, game_id, crate::commands::Command::ChooseOath(ChooseOath { replace: Some(taken), ..replace }), 366,
        ),
    );
    assert_eq!(read_progress(d, key).oaths, crate::oaths::bit(replacement));
    explore(d, key, root, 367);
    let third = read_progress(d, key);
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::ChooseOath(ChooseOath { expected_pick: third.oath_pick, oath: None, ..take }),
            368,
        ),
    );
    assert_eq!(read_progress(d, key).oaths, crate::oaths::bit(replacement));
    assert_eq!(read_progress(d, key).oath_pick, 0);
    let troops = GameState { contract_address: d.games };
    let army = troops.explorer(key).unwrap();
    let crate::troops::StaminaSource::Slot(slot) = army.troops.stamina else {
        panic!("expected expedition slot");
    };
    let slot_key = crate::troops::ArmySlotKey { game_id, structure_id: army.owner, epoch: 0, slot };
    let read_slot = || snforge_std::interact_with_state(
        d.games, || crate::logic::army_slot_storage::read(slot_key).unwrap(),
    );
    let stamina = crate::troops::Stamina { settled_at: 369, ..read_slot().stamina };
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::ManageTroops(
                crate::troop_management::ManageTroops::RemoveExplorer(key.explorer_id),
            ),
            369,
        ),
    );
    assert!(troops.explorer(key).is_none());
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key)).is_none());
    assert_eq!(read_slot().explorer_id, 0);
    assert_eq!(read_slot().stamina, stamina);
    assert!(
        super::resource_commands::execute_in_game(
            d, game_id, super::registrar::muster_slot_command(army.troops.category.into(), 0, slot), 370,
        ),
    );
    let remustered = read_slot();
    assert!(remustered.explorer_id != 0 && remustered.explorer_id != key.explorer_id);
    assert_eq!(remustered.stamina, stamina);
    let fresh = read_progress(d, crate::troops::ExplorerKey { explorer_id: remustered.explorer_id, ..key });
    assert_eq!(fresh.oaths, 0);
    assert_eq!(fresh.oath_pick, 0);
}

#[test]
fn the_offer_entry_grants_on_the_surface_and_preserves_progress_in_the_deep() {
    let (d, _, key) = super::registrar::setup_frontier_relics();
    let offers = crate::oaths::IOathsLibraryDispatcher { class_hash: super::declare_logic("RelicsLogic") };
    let surface_coord = snforge_std::interact_with_state(
        d.games, || crate::logic::troops::explorer(key).unwrap().coord,
    );
    snforge_std::interact_with_state(
        d.games, || crate::oaths::IOathsDispatcherTrait::offer_oaths(offers, key, surface_coord, 1),
    );
    let surface = read_progress(d, key);
    assert_eq!(surface.oath_pick, draw(0, 1));
    assert!(surface.oath_pick != 0);
    let decline = crate::commands::Command::ChooseOath(
        ChooseOath { explorer_id: key.explorer_id, expected_pick: surface.oath_pick, oath: None, replace: None },
    );
    assert!(super::resource_commands::execute_in_game(d, key.game_id, decline, 360));
    let before = read_progress(d, key);
    super::progression::place_army_at_depth(d, key, 3);
    let deep_coord = snforge_std::interact_with_state(d.games, || crate::logic::troops::explorer(key).unwrap().coord);
    snforge_std::interact_with_state(
        d.games, || crate::oaths::IOathsDispatcherTrait::offer_oaths(offers, key, deep_coord, 2),
    );
    assert_eq!(read_progress(d, key), before);
    assert_eq!(before.oath_pick, 0);
}

#[test]
fn packing_preserves_all_sixteen_held_bits_and_the_offer() {
    let value = crate::progression::ArmyProgress { logistics: 5, oath_slots: 4, oaths: 65535, oath_pick: 4095 };
    assert_eq!(
        crate::progression::ArmyProgressPacking::unpack(crate::progression::ArmyProgressPacking::pack(value)), value,
    );
}

#[test]
fn a_revealed_well_refills_forty_percent_of_the_bar_eighty_with_reflection_and_never_past_the_maximum() {
    let fields = read_txt(@FileTrait::new("../fixtures/oath-well-stamina.txt"));
    assert_eq!(fields.len(), 24);
    let mut values = fields.span();
    while !values.is_empty() {
        let (held, maximum, gain): (u16, u64, u64) = Serde::deserialize(ref values).unwrap();
        assert_eq!(crate::oaths::well_stamina(held, maximum), gain);
    }
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        camp_bps: 1, rift_bps: 0, ruin_bps: 0, beasts_bps: 0, shrine_bps: 0, well_bps: 5000, empty_reveal_limit: 7,
    };
    for (reflection, left) in array![(false, 10_u64), (true, 10), (true, 100)] {
        let (d, game_id, key) = super::registrar::setup_frontier_relics_with_rules(Some(discovery));
        let root = super::registrar::discovery_root(
            game_id, discovery, 100, 0, None, crate::discovery::Discovery::Well,
        );
        let (maximum, oaths) = snforge_std::interact_with_state(
            d.games,
            || {
                crate::logic::research::write(
                    crate::resources::ResourceKey { game_id, entity_id: 1 },
                    crate::research::RealmKnowledge {
                        learned: crate::research::learn(0, crate::research::ROW_WELL, 0),
                    },
                );
                let mut progress = crate::logic::progression::require(key);
                progress.oaths = if reflection {
                    crate::oaths::bit(crate::oaths::REFLECTION)
                } else {
                    0
                };
                crate::logic::progression::write(key, progress);
                let original = crate::logic::troops::explorer(key).unwrap();
                let mut army = crate::logic::army_slot_storage::resolve(key, original, None);
                let rules = crate::commands::load_context(game_id, 0, 360).rules.unbox();
                let maximum = crate::progression::stamina_max(
                    progress, army.troops.category, rules.troop_stamina_config,
                );
                let mut bar = army.troops.stamina.inline();
                bar.amount = crate::troops::explore_stamina_cost(army.troops.category, rules).into() + left;
                bar.settled_at = 360;
                bar.remainder = 0;
                army.troops.stamina = StaminaSource::Inline(bar);
                crate::logic::army_slot_storage::persist(key, original.into_record(), army.troops);
                (maximum, progress.oaths)
            },
        );
        let command = crate::commands::Command::Explore(
            crate::commands::Explore { explorer_id: key.explorer_id, direction: 0 },
        );
        let mut spy = snforge_std::spy_events();
        if !super::play_fixture::play(
            d.games, super::play_fixture::TestAction { game_id, actor: d.actor, command }, root, 360,
        ) {
            panic!("well route rejected: {}", super::play_fixture::rejection(ref spy, d.games).reason);
        }
        let after = snforge_std::interact_with_state(
            d.games,
            || {
                crate::logic::army_slot_storage::resolve(key, crate::logic::troops::explorer(key).unwrap(), None)
                    .troops
                    .stamina
                    .inline()
            },
        );
        let expected = core::cmp::min(left + crate::oaths::well_stamina(oaths, maximum), maximum);
        assert_eq!(after.amount, expected);
        assert_eq!(after.amount == maximum, reflection && left == 100);
    }
}

fn explore(d: super::Deployment, key: crate::troops::ExplorerKey, root: u256, timestamp: u64) {
    for _ in 0_u8..2 {
        let command = crate::commands::Command::Explore(
            crate::commands::Explore { explorer_id: key.explorer_id, direction: 0 },
        );
        let mut spy = snforge_std::spy_events();
        if !super::play_fixture::play(
            d.games, super::play_fixture::TestAction { game_id: key.game_id, actor: d.actor, command }, root, timestamp,
        ) {
            let rejected = super::play_fixture::rejection(ref spy, d.games);
            panic!("shrine route rejected: {}", rejected.reason);
        }
        if read_progress(d, key).oath_pick != 0 {
            return;
        }
    }
    panic!("no shrine pick");
}

#[test]
fn deep_loss_matches_the_client_vectors_with_and_without_vitriol() {
    let data = read_txt(@FileTrait::new("../fixtures/oath-deep-loss.txt"));
    let mut fields = data.span();
    while !fields.is_empty() {
        let (oaths, base, troops, ticks, expected_loss, expected_troops): (u16, u128, u128, u64, u128, u128) =
            Serde::deserialize(
            ref fields,
        )
            .unwrap();
        let loss = crate::oaths::deep_loss_per_tick(oaths, base);
        assert_eq!(loss, expected_loss);
        assert_eq!(crate::deep::troops_after_ticks(troops, 10, 10 + ticks, loss), expected_troops);
    }
}

fn assert_army_commands_refused(d: super::Deployment, key: crate::troops::ExplorerKey, pick: u16, timestamp: u64) {
    use crate::commands::{Battle, Command, EnterDepth, Explore, Move};
    use crate::troop_management::{Army, ManageTroops, RecruitExplorer, TransferTroops};
    let state = GameState { contract_address: d.games };
    let before = state.explorer(key).unwrap();
    for command in array![
        Command::Explore(Explore { explorer_id: key.explorer_id, direction: 0 }),
        Command::Move(Move { explorer_id: key.explorer_id, directions: array![0].span() }),
        Command::BattleGuard(Battle { attacker_id: key.explorer_id, defender_id: 1, relic_slot: None }),
        Command::EnterDepth(EnterDepth { explorer_id: key.explorer_id, depth: 1 }),
        Command::InteractSite(crate::relics::InteractSite { explorer_id: key.explorer_id, coord: before.coord }),
        Command::ApplyRelic(
            crate::relics::ApplyRelic {
                entity_id: key.explorer_id, relic_id: 1, recipient: crate::relics::Recipient::ArmySlot(0),
            },
        ),
        Command::ManageTroops(ManageTroops::RemoveExplorer(key.explorer_id)),
        Command::ManageTroops(
            ManageTroops::RecruitExplorer(
                RecruitExplorer { explorer_id: key.explorer_id, amount: 1, supply_post: None },
            ),
        ),
        Command::ManageTroops(
            ManageTroops::Transfer(
                TransferTroops { source: Army::Explorer(key.explorer_id), target: Army::Explorer(999), amount: 1 },
            ),
        ),
        Command::ManageTroops(
            ManageTroops::Transfer(
                TransferTroops { source: Army::Explorer(999), target: Army::Explorer(key.explorer_id), amount: 1 },
            ),
        ),
        Command::SetEntityName(crate::names::SetEntityName { entity_id: key.explorer_id, name: 'waiting' }),
    ] {
        let mut spy = snforge_std::spy_events();
        assert!(!super::resource_commands::execute_in_game(d, key.game_id, command, timestamp));
        assert_eq!(super::play_fixture::rejection(ref spy, d.games).reason, "ANSWER_OATH_FIRST");
        assert_eq!(read_progress(d, key).oath_pick, pick);
        assert_eq!(state.explorer(key).unwrap(), before);
    }
}

#[test]
fn passing_matches_client_vectors_and_cannot_be_replayed_with_empty_or_full_slots() {
    let fields = read_txt(@FileTrait::new("../fixtures/oath-pass-stamina.txt"));
    assert_eq!(fields.len(), 8);
    for full in array![false, true] {
        let mut values = fields.span();
        while !values.is_empty() {
            let (deficit, gain): (u64, u64) = Serde::deserialize(ref values).unwrap();
            let (d, game_id, key) = super::registrar::setup_frontier_relics();
            let (before, maximum, pick) = snforge_std::interact_with_state(
                d.games,
                || {
                    let mut progress = crate::logic::progression::require(key);
                    progress.oaths = if full {
                        crate::oaths::bit(crate::oaths::GIANTS)
                    } else {
                        0
                    };
                    progress.oath_pick = draw(progress.oaths, 1);
                    crate::logic::progression::write(key, progress);
                    let original = crate::logic::troops::explorer(key).unwrap();
                    let mut army = crate::logic::army_slot_storage::resolve(key, original, None);
                    let rules = crate::commands::load_context(game_id, 0, 360).rules.unbox();
                    let maximum = crate::progression::stamina_max(
                        progress, army.troops.category, rules.troop_stamina_config,
                    );
                    let mut bar = army.troops.stamina.inline();
                    bar.amount = maximum - deficit;
                    bar.settled_at = 360;
                    bar.remainder = 0;
                    army.troops.stamina = StaminaSource::Inline(bar);
                    crate::logic::army_slot_storage::persist(key, original.into_record(), army.troops);
                    (bar.amount, maximum, progress.oath_pick)
                },
            );
            let command = crate::commands::Command::ChooseOath(
                ChooseOath { explorer_id: key.explorer_id, expected_pick: pick, oath: None, replace: None },
            );
            assert!(super::resource_commands::execute_in_game(d, game_id, command, 360));
            let after = snforge_std::interact_with_state(
                d.games,
                || {
                    crate::logic::army_slot_storage::resolve(key, crate::logic::troops::explorer(key).unwrap(), None)
                        .troops
                        .stamina
                        .inline()
                },
            );
            assert_eq!(after.amount, before + gain);
            assert!(after.amount <= maximum);
            assert_eq!(read_progress(d, key).oath_pick, 0);
            assert_eq!(read_progress(d, key).oaths, if full {
                crate::oaths::bit(crate::oaths::GIANTS)
            } else {
                0
            });
            assert!(!super::resource_commands::execute_in_game(d, game_id, command, 360));
            assert_eq!(
                snforge_std::interact_with_state(
                    d.games,
                    || {
                        crate::logic::army_slot_storage::resolve(
                            key, crate::logic::troops::explorer(key).unwrap(), None,
                        )
                            .troops
                            .stamina
                            .inline()
                    },
                ),
                after,
            );
        }
    }
}
