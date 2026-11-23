use snforge_std::fs::{FileTrait, read_txt};
use snforge_std::{EventSpyTrait, EventsFilterTrait};
use crate::guards::IGuardsDispatcherTrait;
use crate::oaths::{ChooseOath, RerollOath, card, draw, held};
use crate::stamina::{StaminaSourceTrait, StaminaTrait};
use crate::troops::{ExplorerRecordTrait, StaminaSource};
use super::play_fixture::FIXTURE_START;
use super::progression::read_progress;
use super::state::{GameState, TroopObservationTrait};

#[test]
fn every_draw_offers_three_distinct_oaths_the_army_does_not_hold_and_fewer_only_when_fewer_remain() {
    let thirteen = 65535
        ^ crate::oaths::bit(crate::oaths::SKILL)
        ^ crate::oaths::bit(crate::oaths::FOX)
        ^ crate::oaths::bit(crate::oaths::RAGE);
    let five = crate::oaths::bit(crate::oaths::GIANTS)
        | crate::oaths::bit(crate::oaths::PERFECTION)
        | crate::oaths::bit(crate::oaths::FURY)
        | crate::oaths::bit(crate::oaths::SKILL)
        | crate::oaths::bit(crate::oaths::POWER);
    for oaths in array![0_u16, crate::oaths::bit(crate::oaths::POWER), five, 0x0f0f, thirteen] {
        for seed in 0_u64..64 {
            let offered = cards(draw(oaths, seed.into()));
            assert_eq!(offered.len(), 3);
            for oath in offered {
                assert!(!held(oaths, *oath));
            }
        }
    }
    let fourteen = thirteen | crate::oaths::bit(crate::oaths::RAGE);
    for seed in 0_u64..16 {
        let offered = cards(draw(fourteen, seed.into()));
        assert_eq!(offered.len(), 2);
        assert!(offered.at(0) != offered.at(1));
        for oath in offered {
            assert!(*oath == crate::oaths::SKILL || *oath == crate::oaths::FOX);
        }
    }
}

#[test]
fn the_last_drawable_oath_comes_alone_and_none_left_opens_no_pick() {
    let all_but_skill = 65535 ^ crate::oaths::bit(crate::oaths::SKILL);
    for seed in 0_u64..16 {
        assert_eq!(cards(draw(all_but_skill, seed.into())), array![crate::oaths::SKILL].span());
    }
    assert_eq!(draw(65535, 1), 0);
}

#[test]
fn a_revealed_shrine_offers_a_new_army_three_oaths_and_an_army_holding_fourteen_the_two_it_lacks() {
    let fourteen = 65535 ^ crate::oaths::bit(crate::oaths::SKILL) ^ crate::oaths::bit(crate::oaths::FOX);
    for (oaths, offered) in array![(0_u16, 3_u32), (fourteen, 2)] {
        let (d, _, key) = super::registrar::setup_frontier_relics();
        snforge_std::interact_with_state(
            d.games,
            || {
                crate::logic::research::write(
                    army_home(key),
                    crate::research::RealmKnowledge {
                        learned: world_test_support::tests::registrar::lore(crate::research::LORE_SHRINES),
                    },
                );
                let mut progress = crate::logic::progression::require(key);
                progress.oaths = oaths;
                crate::logic::progression::write(key, progress);
            },
        );
        explore_to_shrine(d, key, FIXTURE_START + 10);
        let shown = cards(read_progress(d, key).oath_pick);
        assert_eq!(shown.len(), offered);
        for oath in shown {
            assert!(!held(oaths, *oath));
        }
    }
}

fn cards(pick: u16) -> Span<u8> {
    let mut shown = array![];
    for index in 0_u8..3 {
        let oath = card(pick, index);
        let mut repeated = false;
        for earlier in shown.span() {
            if *earlier == oath {
                repeated = true;
            }
        }
        if !repeated {
            shown.append(oath);
        }
    }
    shown.span()
}

#[test]
fn shrine_reveal_opens_a_persistent_pick_then_the_real_command_takes_replaces_and_declines() {
    let (d, game_id, key) = super::registrar::setup_frontier_relics();
    snforge_std::interact_with_state(
        d.games,
        || {
            let home = army_home(key);
            crate::logic::research::write(
                home,
                crate::research::RealmKnowledge {
                    learned: world_test_support::tests::registrar::lore(crate::research::LORE_SHRINES),
                },
            );
        },
    );
    explore_to_shrine(d, key, FIXTURE_START + 10);
    let first = read_progress(d, key);
    assert!(first.oath_pick != 0);
    assert_eq!(first.oaths, 0);
    assert_army_commands_refused(d, key, first.oath_pick, FIXTURE_START + 11);
    assert_eq!(read_progress(d, key).oath_pick, first.oath_pick);
    let taken = card(first.oath_pick, 0);
    let take = ChooseOath {
        explorer_id: key.explorer_id, expected_pick: first.oath_pick, oath: Some(taken), replace: None,
    };
    let other = super::bind_authority(d);
    let mut refused = snforge_std::spy_events();
    assert!(
        !super::resource_commands::execute_in_game(
            other, game_id, crate::commands::Command::ChooseOath(take), FIXTURE_START + 12,
        ),
    );
    assert_eq!(super::play_fixture::rejection(ref refused, d.games).reason, "actor does not own structure");
    assert_eq!(read_progress(d, key), first);
    assert!(
        super::resource_commands::execute_in_game(
            d, game_id, crate::commands::Command::ChooseOath(take), FIXTURE_START + 12,
        ),
    );
    let chosen = read_progress(d, key);
    assert_eq!(chosen.oaths, crate::oaths::bit(taken));
    assert_eq!(chosen.oath_pick, 0);
    assert!(
        !super::resource_commands::execute_in_game(
            d, game_id, crate::commands::Command::ChooseOath(take), FIXTURE_START + 13,
        ),
    );
    assert_eq!(read_progress(d, key), chosen);
    explore_to_shrine(d, key, FIXTURE_START + 13);
    let filling = read_progress(d, key);
    let filled = card(filling.oath_pick, 0);
    let fill = ChooseOath { expected_pick: filling.oath_pick, oath: Some(filled), ..take };
    assert!(
        super::resource_commands::execute_in_game(
            d, game_id, crate::commands::Command::ChooseOath(fill), FIXTURE_START + 13,
        ),
    );
    assert_eq!(read_progress(d, key).oaths, crate::oaths::bit(taken) | crate::oaths::bit(filled));
    explore_to_shrine(d, key, FIXTURE_START + 14);
    let second = read_progress(d, key);
    let replacement = card(second.oath_pick, 1);
    let replace = ChooseOath { expected_pick: second.oath_pick, oath: Some(replacement), ..take };
    assert!(
        !super::resource_commands::execute_in_game(
            d, game_id, crate::commands::Command::ChooseOath(replace), FIXTURE_START + 15,
        ),
    );
    assert_eq!(read_progress(d, key), second);
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::ChooseOath(ChooseOath { replace: Some(taken), ..replace }),
            FIXTURE_START + 16,
        ),
    );
    assert_eq!(read_progress(d, key).oaths, crate::oaths::bit(filled) | crate::oaths::bit(replacement));
    explore_to_shrine(d, key, FIXTURE_START + 17);
    let third = read_progress(d, key);
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::ChooseOath(ChooseOath { expected_pick: third.oath_pick, oath: None, ..take }),
            FIXTURE_START + 18,
        ),
    );
    assert_eq!(read_progress(d, key).oaths, crate::oaths::bit(filled) | crate::oaths::bit(replacement));
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
    let stamina = snforge_std::interact_with_state(
        d.games,
        || {
            let rules = crate::commands::load_context(game_id, 0, FIXTURE_START + 19).rules.unbox();
            let refill = crate::troops::StaminaRefill {
                timestamp: FIXTURE_START + 19,
                stamina_config: rules.troop_stamina_config,
                armies_tick_in_seconds: rules.tick_config.armies_tick_in_seconds,
            };
            crate::logic::army_slot_storage::resolve(key, crate::logic::troops::explorer(key).unwrap(), Some(refill))
                .troops
                .stamina
                .inline()
        },
    );
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            crate::commands::Command::ManageTroops(
                crate::troop_management::ManageTroops::RemoveExplorer(key.explorer_id),
            ),
            FIXTURE_START + 19,
        ),
    );
    assert!(troops.explorer(key).is_none());
    assert!(snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key)).is_none());
    assert_eq!(read_slot().explorer_id, 0);
    assert_eq!(read_slot().stamina, stamina);
    let home = crate::resources::ResourceKey { game_id, entity_id: army.owner };
    super::resource_commands::grant(
        d, home, crate::troops::troop_resource(army.troops.category, 0), crate::rules::RESOURCE_PRECISION,
    );
    assert!(
        super::resource_commands::execute_in_game(
            d,
            game_id,
            super::registrar::muster_command(home, army.troops.category.into(), 0, slot),
            FIXTURE_START + 19,
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
    assert!(super::resource_commands::execute_in_game(d, key.game_id, decline, FIXTURE_START + 10));
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
fn packing_preserves_all_sixteen_held_bits_and_the_offer_with_its_rerolled_cards() {
    for oath_pick in array![4095_u16, crate::oaths::REROLLED * 2 - 1, crate::oaths::REROLLED + 2107] {
        let value = crate::progression::ArmyProgress { logistics: 5, oath_slots: 5, oaths: 65535, oath_pick };
        assert_eq!(
            crate::progression::ArmyProgressPacking::unpack(crate::progression::ArmyProgressPacking::pack(value)),
            value,
        );
    }
    let before = crate::progression::ArmyProgress { logistics: 3, oath_slots: 2, oaths: 9, oath_pick: 2107 };
    assert_eq!(crate::progression::ArmyProgressPacking::pack(before), 9 + 2 * 65536 + 2107 * 524288 + 3 * 2147483648);
}

#[test]
fn a_revealed_well_refills_forty_percent_of_the_bar_eighty_with_reflection_and_never_past_the_maximum() {
    assert_eq!(crate::oaths::well_stamina(0, 180), 72);
    assert_eq!(crate::oaths::well_stamina(crate::oaths::bit(crate::oaths::REFLECTION), 180), 144);
    assert_eq!(crate::oaths::well_stamina(crate::oaths::bit(crate::oaths::GIANTS), 333), 133);
    let discovery = crate::expeditions::FrontierDiscoveryRules {
        shrine_bps: 0, ..crate::balance::expeditions::FRONTIER_DISCOVERY,
    };
    for (reflection, left) in array![(false, 10_u64), (true, 10), (true, 100)] {
        let (d, game_id, key) = super::registrar::setup_frontier_relics();
        let root = super::registrar::discovery_root(
            game_id,
            discovery,
            100,
            0,
            Some(world_test_support::tests::registrar::any_relic()),
            crate::discovery::Discovery::Well,
        );
        let (maximum, oaths) = snforge_std::interact_with_state(
            d.games,
            || {
                crate::logic::research::write(
                    army_home(key),
                    crate::research::RealmKnowledge {
                        learned: world_test_support::tests::registrar::lore(crate::research::LORE_WELLS),
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
                let rules = crate::commands::load_context(game_id, 0, FIXTURE_START + 10).rules.unbox();
                let maximum = crate::progression::stamina_max(
                    progress, army.troops.category, rules.troop_stamina_config,
                );
                let mut bar = army.troops.stamina.inline();
                bar.amount = crate::troops::explore_stamina_cost(army.troops.category, rules, progress.oaths).into()
                    + left;
                bar.settled_at = (FIXTURE_START + 10).try_into().unwrap();
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
            d.games, super::play_fixture::TestAction { game_id, actor: d.actor, command }, root, FIXTURE_START + 10,
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

fn explore_to_shrine(d: super::Deployment, key: crate::troops::ExplorerKey, timestamp: u64) {
    let root = shrine_root(d, key);
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
        Command::ApplyRelic(crate::relics::ApplyRelic { entity_id: key.explorer_id, relic_id: 1, slot: 0 }),
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
    let (d, game_id, key) = super::registrar::setup_frontier_relics();
    for full in array![false, true] {
        let mut values = fields.span();
        while !values.is_empty() {
            let (deficit, gain): (u64, u64) = Serde::deserialize(ref values).unwrap();
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
                    let rules = crate::commands::load_context(game_id, 0, FIXTURE_START + 10).rules.unbox();
                    let maximum = crate::progression::stamina_max(
                        progress, army.troops.category, rules.troop_stamina_config,
                    );
                    let mut bar = army.troops.stamina.inline();
                    bar.amount = maximum - deficit;
                    bar.settled_at = (FIXTURE_START + 10).try_into().unwrap();
                    bar.remainder = 0;
                    army.troops.stamina = StaminaSource::Inline(bar);
                    crate::logic::army_slot_storage::persist(key, original.into_record(), army.troops);
                    (bar.amount, maximum, progress.oath_pick)
                },
            );
            let command = crate::commands::Command::ChooseOath(
                ChooseOath { explorer_id: key.explorer_id, expected_pick: pick, oath: None, replace: None },
            );
            assert!(super::resource_commands::execute_in_game(d, game_id, command, FIXTURE_START + 10));
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
            assert!(!super::resource_commands::execute_in_game(d, game_id, command, FIXTURE_START + 10));
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

#[test]
fn a_new_army_holds_two_oaths_before_any_research_and_refuses_a_third_without_a_swap() {
    let (d, game_id, key) = super::registrar::setup_frontier_relics();
    assert_eq!(read_progress(d, key).oath_slots, 2);
    let offer: u16 = Into::<u8, u16>::into(crate::oaths::POWER - 1)
        + Into::<u8, u16>::into(crate::oaths::FOX - 1) * 16
        + Into::<u8, u16>::into(crate::oaths::RAGE - 1) * 256;
    for oath in array![crate::oaths::POWER, crate::oaths::FOX] {
        open_pick(d, key, offer);
        let take = ChooseOath { explorer_id: key.explorer_id, expected_pick: offer, oath: Some(oath), replace: None };
        assert!(
            super::resource_commands::execute_in_game(
                d, game_id, crate::commands::Command::ChooseOath(take), FIXTURE_START + 10,
            ),
        );
    }
    assert_eq!(
        read_progress(d, key).oaths, crate::oaths::bit(crate::oaths::POWER) | crate::oaths::bit(crate::oaths::FOX),
    );
    open_pick(d, key, offer);
    let third = ChooseOath {
        explorer_id: key.explorer_id, expected_pick: offer, oath: Some(crate::oaths::RAGE), replace: None,
    };
    assert!(
        !super::resource_commands::execute_in_game(
            d, game_id, crate::commands::Command::ChooseOath(third), FIXTURE_START + 11,
        ),
    );
    let swap = ChooseOath { replace: Some(crate::oaths::POWER), ..third };
    assert!(
        super::resource_commands::execute_in_game(
            d, game_id, crate::commands::Command::ChooseOath(swap), FIXTURE_START + 12,
        ),
    );
    assert_eq!(
        read_progress(d, key).oaths, crate::oaths::bit(crate::oaths::FOX) | crate::oaths::bit(crate::oaths::RAGE),
    );
}

#[test]
fn a_reroll_costs_its_fragments_and_redraws_one_card_of_a_pick_once_from_the_oaths_neither_held_nor_shown() {
    let (d, game_id, key) = super::registrar::setup_frontier_relics();
    let offer: u16 = Into::<u8, u16>::into(crate::oaths::POWER - 1)
        + Into::<u8, u16>::into(crate::oaths::FOX - 1) * 16
        + Into::<u8, u16>::into(crate::oaths::SKILL - 1) * 256;
    let price: u128 = crate::fragments::OATH_REROLL_FRAGMENTS.into();
    open_pick(d, key, offer);
    earn_fragments(d, game_id, price - 1);
    assert!(!reroll_card(d, key, offer, 1, FIXTURE_START + 10));
    assert_eq!(read_progress(d, key).oath_pick, offer);
    earn_fragments(d, game_id, price + 1);
    assert!(reroll_card(d, key, offer, 1, FIXTURE_START + 10));
    let rerolled = read_progress(d, key).oath_pick;
    let redrawn = card(rerolled, 1);
    assert_eq!(card(rerolled, 0), crate::oaths::POWER);
    assert_eq!(card(rerolled, 2), crate::oaths::SKILL);
    assert!(redrawn != crate::oaths::POWER && redrawn != crate::oaths::FOX && redrawn != crate::oaths::SKILL);
    assert_eq!(rerolled / crate::oaths::REROLLED, 1);
    assert_eq!(fragments(d, game_id), price);
    assert!(!reroll_card(d, key, rerolled, 1, FIXTURE_START + 11));
    assert!(!reroll_card(d, key, rerolled, 0, FIXTURE_START + 11));
    assert!(!reroll_card(d, key, offer, 0, FIXTURE_START + 11));
    assert_eq!(fragments(d, game_id), price);
    let take = ChooseOath { explorer_id: key.explorer_id, expected_pick: rerolled, oath: Some(redrawn), replace: None };
    assert!(
        super::resource_commands::execute_in_game(
            d, game_id, crate::commands::Command::ChooseOath(take), FIXTURE_START + 12,
        ),
    );
    assert_eq!(read_progress(d, key).oaths, crate::oaths::bit(redrawn));
    assert_eq!(read_progress(d, key).oath_pick, 0);
    let shown = crate::oaths::bit(crate::oaths::POWER)
        | crate::oaths::bit(crate::oaths::FOX)
        | crate::oaths::bit(crate::oaths::SKILL);
    hold_oaths(d, key, 65535 ^ shown);
    open_pick(d, key, offer);
    assert!(!reroll_card(d, key, offer, 2, FIXTURE_START + 13));
    hold_oaths(d, key, 0);
    super::progression::place_army_at_depth(d, key, 3);
    assert!(!reroll_card(d, key, offer, 2, FIXTURE_START + 14));
    assert_eq!(fragments(d, game_id), price);
    assert_eq!(read_progress(d, key).oath_pick, offer);
}

fn reroll_card(d: super::Deployment, key: crate::troops::ExplorerKey, pick: u16, index: u8, timestamp: u64) -> bool {
    let reroll = RerollOath { explorer_id: key.explorer_id, expected_pick: pick, index };
    super::resource_commands::execute_in_game(d, key.game_id, crate::commands::Command::RerollOath(reroll), timestamp)
}

fn earn_fragments(d: super::Deployment, game_id: u32, amount: u128) {
    snforge_std::interact_with_state(d.games, || crate::logic::fragments::add(game_id, d.actor, amount));
}

fn fragments(d: super::Deployment, game_id: u32) -> u128 {
    snforge_std::interact_with_state(d.games, || crate::logic::fragments::balance(game_id, d.actor))
}

fn hold_oaths(d: super::Deployment, key: crate::troops::ExplorerKey, oaths: u16) {
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut progress = crate::logic::progression::require(key);
            progress.oaths = oaths;
            crate::logic::progression::write(key, progress);
        },
    );
}

fn open_pick(d: super::Deployment, key: crate::troops::ExplorerKey, pick: u16) {
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut progress = crate::logic::progression::require(key);
            progress.oath_pick = pick;
            crate::logic::progression::write(key, progress);
        },
    );
}

#[test]
fn prizes_match_the_client_vectors_with_and_without_their_oaths() {
    let data = read_txt(@FileTrait::new("../fixtures/oath-prizes.txt"));
    assert_eq!(data.len(), 72);
    let mut fields = data.span();
    while !fields.is_empty() {
        let (oaths, base, limit, amount, reveal, site): (u16, u8, u8, u128, u128, u128) = Serde::deserialize(ref fields)
            .unwrap();
        assert_eq!(crate::oaths::empty_reveal_limit(oaths, base), limit);
        assert_eq!(crate::oaths::reveal_pay(oaths, amount), reveal);
        assert_eq!(crate::oaths::site_pay(oaths, amount, false), site);
    }
}

#[test]
fn fight_rules_match_the_client_vectors_with_and_without_their_oaths() {
    let data = read_txt(@FileTrait::new("../fixtures/oath-fight.txt"));
    assert_eq!(data.len(), 140);
    let mut fields = data.span();
    while !fields.is_empty() {
        let (oaths, bar, skill, cost, refund): (u16, u64, u128, u16, u64) = Serde::deserialize(ref fields).unwrap();
        let (before, after, clean, amount, pay): (u128, u128, bool, u128, u128) = Serde::deserialize(ref fields)
            .unwrap();
        assert_eq!(crate::oaths::skill_multiplier(oaths, bar).mag, skill);
        assert_eq!(crate::oaths::fury_refund(oaths, cost), refund);
        assert_eq!(crate::oaths::clean_win(before, after), clean);
        assert_eq!(crate::oaths::site_pay(oaths, amount, clean), pay);
    }
}

#[test]
fn detection_finds_a_camp_brilliance_raises_its_reveal_pay_and_rage_and_perfection_its_clear_pay() {
    let discovery = world_test_support::tests::frontier_discovery::rules();
    let detection = crate::oaths::bit(crate::oaths::DETECTION);
    let brilliance = crate::oaths::bit(crate::oaths::BRILLIANCE);
    let rage = crate::oaths::bit(crate::oaths::RAGE);
    let precision = crate::rules::RESOURCE_PRECISION;
    let perfection = detection | crate::oaths::bit(crate::oaths::PERFECTION);
    let army_troops = 2000 * precision;
    let reveal_base = army_troops * crate::logic::expeditions::depth_rules(0).reveal_percent.into() / 100;
    for (oaths, found, reveal_percent, clear_percent) in array![
        (detection, true, 100_u128, 100_u128), (0, false, 100, 0), (detection | brilliance | rage, true, 125, 125),
        (perfection, true, 100, 150),
    ] {
        let (d, game_id, key) = super::registrar::setup_frontier_relics();
        let mut army = super::registrar::strong_frontier_army(d, game_id, key);
        army.troops.count = army_troops;
        super::resource_commands::set_explorer_fixture(d.games, key, army);
        snforge_std::interact_with_state(
            d.games,
            || {
                let mut progress = crate::logic::progression::require(key);
                progress.oaths = oaths;
                crate::logic::progression::write(key, progress);
            },
        );
        let root = only_detection_finds(game_id, discovery);
        after_detection_empty_reveals(d, key, army.coord);
        let mut spy = snforge_std::spy_events();
        assert!(super::registrar::explore_with_root(d, game_id, key.explorer_id, root, FIXTURE_START + 10));
        assert_eq!(reveal_paid(ref spy, d.games), reveal_base * reveal_percent / 100);
        let tile = crate::geometry::tile_key(game_id, crate::geometry::neighbor(army.coord, 0));
        let occupied = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(tile));
        assert_eq!(occupied.map(|site| site.category) == Some(crate::taxonomy::CAMP_OCCUPIER), found);
        if !found {
            continue;
        }
        let site = crate::resources::ResourceKey { game_id, entity_id: occupied.unwrap().entity_id };
        let guard = snforge_std::interact_with_state(
            d.games, || crate::logic::expeditions::expedition_site(site).unwrap().initial_guard_count,
        );
        super::registrar::strong_frontier_army(d, game_id, key);
        let command = crate::commands::Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: site.entity_id, relic_slot: None },
        );
        assert!(super::resource_commands::execute_in_game(d, game_id, command, FIXTURE_START + 11));
        let receipt = snforge_std::interact_with_state(
            d.games, || crate::logic::expeditions::expedition_site(site).unwrap().clear.unwrap(),
        );
        assert_eq!(
            receipt.reward,
            Some(
                crate::resources::ResourceAmount {
                    resource_type: crate::resources::LABOR, amount: guard / 2 * clear_percent / 100,
                },
            ),
        );
    }
}

#[test]
fn detection_leaves_the_spire_chance_of_a_reveal_unchanged() {
    for oaths in array![0_u16, crate::oaths::bit(crate::oaths::DETECTION)] {
        let (d, game_id, key) = super::registrar::setup_frontier_relics();
        let army = super::registrar::strong_frontier_army(d, game_id, key);
        let home = snforge_std::interact_with_state(
            d.games,
            || {
                let mut progress = crate::logic::progression::require(key);
                progress.oaths = oaths;
                crate::logic::progression::write(key, progress);
                army_home(key)
            },
        );
        world_test_support::tests::registrar::learn_spire_lore(d, home, FIXTURE_START);
        let root = root_with_spire_draw_from(game_id, 10000 / crate::rules::SPIRE_REVEAL_LIMIT.into());
        assert!(super::registrar::explore_with_root(d, game_id, key.explorer_id, root, FIXTURE_START + 10));
        let spire = snforge_std::interact_with_state(
            d.games,
            || crate::logic::spires::read(
                crate::spires::ExpeditionSpireKey {
                    game_id,
                    structure_id: home.entity_id,
                    epoch: crate::expeditions::region_day(army.coord, crate::logic::settlement::spacing()),
                    depth: crate::logic::expeditions::depth_at(game_id, army.coord),
                },
            ),
        );
        assert_eq!(spire, Some(crate::spires::ExpeditionSpire { reveals: 1, location: None }));
    }
}

fn root_with_spire_draw_from(game_id: u32, lowest: u128) -> u256 {
    for sample in 0_u64..10000 {
        let raw_root: u256 = sample.into();
        let mut root = raw_root;
        let seed = crate::random::game_root(ref root, game_id);
        let draw = crate::random::range(seed, 0x5350495245, 10000);
        if draw >= lowest && draw < lowest * 12 / 10 {
            return raw_root;
        }
    }
    panic!("no root with that spire draw")
}

#[test]
fn the_twins_add_a_share_of_the_adjacent_own_army_damage_and_a_one_troop_twin_adds_nothing() {
    let discovery = world_test_support::tests::frontier_discovery::rules();
    let detection = crate::oaths::bit(crate::oaths::DETECTION);
    let twins = detection | crate::oaths::bit(crate::oaths::TWINS);
    let precision = crate::rules::RESOURCE_PRECISION;
    let mut left: Array<u128> = array![];
    for (oaths, twin_troops) in array![(detection, 300_u128), (twins, 300), (twins, 1)] {
        let (d, game_id, key) = super::registrar::setup_frontier_relics();
        let mut army = super::registrar::strong_frontier_army(d, game_id, key);
        army.troops.count = 300 * precision;
        army
            .troops
            .stamina =
                crate::troops::Stamina {
                    amount: 100, settled_at: (FIXTURE_START + 10).try_into().unwrap(), remainder: 0,
                }
            .into();
        super::resource_commands::set_explorer_fixture(d.games, key, army);
        snforge_std::interact_with_state(
            d.games,
            || {
                let mut progress = crate::logic::progression::require(key);
                progress.oaths = oaths;
                crate::logic::progression::write(key, progress);
            },
        );
        after_detection_empty_reveals(d, key, army.coord);
        assert!(
            super::registrar::explore_with_root(
                d, game_id, key.explorer_id, only_detection_finds(game_id, discovery), FIXTURE_START + 10,
            ),
        );
        let camp_tile = crate::geometry::tile_key(game_id, crate::geometry::neighbor(army.coord, 0));
        let camp = snforge_std::interact_with_state(d.games, || crate::logic::map::occupancy(camp_tile))
            .unwrap()
            .entity_id;
        let guard = crate::guards::Guard {
            troops: crate::troops::Troops { count: 1000 * precision, ..army.troops }, destroyed_tick: 0,
        };
        snforge_std::interact_with_state(
            d.games,
            || crate::logic::guards::GuardState::save(
                crate::guards::GuardKey { game_id, structure_id: camp, slot: 0 }, guard,
            ),
        );
        let home = snforge_std::interact_with_state(d.games, || army_home(key));
        let (_, twin_key) = super::registrar::expedition_armies(d, home);
        let twin = crate::troops::ExplorerTroops {
            coord: crate::geometry::neighbor(army.coord, 3),
            troops: crate::troops::Troops { count: twin_troops * precision, ..army.troops },
            ..army,
        };
        super::resource_commands::set_explorer_fixture(d.games, twin_key, twin);
        let battle = crate::commands::Battle { attacker_id: key.explorer_id, defender_id: camp, relic_slot: None };
        assert!(
            super::resource_commands::execute_in_game(
                d, game_id, crate::commands::Command::BattleGuard(battle), FIXTURE_START + 11,
            ),
        );
        let guards = crate::guards::IGuardsDispatcher { contract_address: d.games };
        let mut standing = 0;
        for slot in 0_u8..4 {
            standing += guards.guard(crate::guards::GuardKey { game_id, structure_id: camp, slot }).troops.count;
        }
        left.append(standing);
    }
    assert!(*left[0] != 0);
    assert!(*left[1] < *left[0]);
    assert_eq!(*left[2], *left[0]);
}

fn shrine_root(d: super::Deployment, key: crate::troops::ExplorerKey) -> u256 {
    let owner = super::state::GameState { contract_address: d.games }.resolved_explorer(key).unwrap().owner;
    let home = crate::resources::ResourceKey { game_id: key.game_id, entity_id: owner };
    let rules = snforge_std::interact_with_state(
        d.games, || crate::logic::discovery::lore_rules(crate::logic::research::require(home).learned),
    );
    super::registrar::discovery_root(
        key.game_id,
        rules,
        100,
        0,
        Some(world_test_support::tests::registrar::any_relic()),
        crate::discovery::Discovery::Shrine,
    )
}

fn only_detection_finds(game_id: u32, rules: crate::expeditions::FrontierDiscoveryRules) -> u256 {
    let empty = crate::oaths::DETECTION_EMPTY_REVEAL_LIMIT;
    let detected = crate::expeditions::FrontierDiscoveryRules {
        empty_reveal_limit: crate::oaths::empty_reveal_limit(
            crate::oaths::bit(crate::oaths::DETECTION), rules.empty_reveal_limit,
        ),
        ..rules,
    };
    for sample in 0_u64..10000 {
        let raw_root: u256 = sample.into();
        let mut root = raw_root;
        let seed = crate::random::game_root(ref root, game_id);
        let relic = Some(world_test_support::tests::registrar::any_relic());
        if crate::discovery::frontier(detected, 100, empty, relic, seed) == crate::discovery::Discovery::Camp
            && crate::discovery::frontier(rules, 100, empty, relic, seed) == crate::discovery::Discovery::None {
            return raw_root;
        }
    }
    panic!("no root that only Detection's shorter run turns into a camp")
}

fn after_detection_empty_reveals(d: super::Deployment, key: crate::troops::ExplorerKey, coord: crate::troops::Coord) {
    snforge_std::interact_with_state(
        d.games,
        || crate::logic::expeditions::write_discovery(
            crate::expeditions::ExpeditionDiscoveryKey {
                game_id: key.game_id,
                structure_id: army_home(key).entity_id,
                epoch: crate::expeditions::region_day(
                    crate::geometry::neighbor(coord, 0), crate::logic::settlement::spacing(),
                ),
            },
            crate::expeditions::ExpeditionDiscovery {
                empty_reveals: crate::oaths::DETECTION_EMPTY_REVEAL_LIMIT, ruin_cleared: false,
            },
        ),
    );
}

fn reveal_paid(ref spy: snforge_std::EventSpy, games: starknet::ContractAddress) -> u128 {
    for (_, event) in spy.get_events().emitted_by(games).events {
        let keys = event.keys.span();
        for prefix in 0..keys.len() {
            if *keys.at(prefix) != selector!("StoryEvent") {
                continue;
            }
            let mut fields = keys.slice(prefix + 1, keys.len() - prefix - 1);
            let mut data = event.data.span();
            let story: crate::ownership::StoryEvent = starknet::Event::deserialize(ref fields, ref data).unwrap();
            if let crate::ownership::Story::ExplorationReward(paid) = story.story {
                return paid.amount;
            }
        }
    }
    panic!("no reveal payment")
}

#[test]
fn stamina_oaths_match_the_client_vectors() {
    let data = read_txt(@FileTrait::new("../fixtures/oath-stamina.txt"));
    assert_eq!(data.len(), 112);
    let config = crate::rules::TroopStaminaConfig {
        stamina_gain_per_tick: 1, ..crate::balance::rules::TROOP_STAMINA_CONFIG,
    };
    let mut fields = data.span();
    while !fields.is_empty() {
        let (
            oaths, attack_base, attack, explore_base, explore, bonus, regen, hour,
        ): (u16, u16, u16, u16, u16, u64, u32, u64) =
            Serde::deserialize(
            ref fields,
        )
            .unwrap();
        assert_eq!(crate::oaths::attack_stamina(oaths, attack_base), attack);
        assert_eq!(crate::oaths::explore_stamina(oaths, explore_base), explore);
        assert_eq!(crate::oaths::stamina_bonus(oaths), bonus);
        assert_eq!(crate::oaths::regen_bps(oaths), regen);
        let mut bar = crate::troops::Stamina { amount: 0, settled_at: 1000, remainder: 0 };
        let mut boosts: crate::troops::TroopBoosts = Default::default();
        bar.refill_to_max(ref boosts, 1000, config, 120, 4600, regen);
        assert_eq!(bar.amount, hour);
    }
}

#[test]
fn taking_titans_adds_sixty_stamina_now_on_a_bar_sixty_higher() {
    let (d, game_id, key) = super::registrar::setup_frontier_relics();
    let mut seed = 0_u64;
    while card(draw(0, seed.into()), 1) != crate::oaths::TITANS {
        seed += 1;
    }
    let pick = draw(0, seed.into());
    let maximum = set_stamina(d, key, 0, Some(pick), Option::None);
    let command = crate::commands::Command::ChooseOath(
        ChooseOath {
            explorer_id: key.explorer_id, expected_pick: pick, oath: Some(crate::oaths::TITANS), replace: None,
        },
    );
    assert!(super::resource_commands::execute_in_game(d, game_id, command, FIXTURE_START + 10));
    assert_eq!(stamina_of(d, key), maximum + 60);
    assert_eq!(read_progress(d, key).oaths, crate::oaths::bit(crate::oaths::TITANS));
}

#[test]
fn anger_lets_an_army_with_twenty_stamina_attack_where_the_base_cost_refuses_it() {
    for anger in array![false, true] {
        let (d, game_id, key) = super::registrar::setup_frontier_relics();
        let army = super::registrar::strong_frontier_army(d, game_id, key);
        let oaths = if anger {
            crate::oaths::bit(crate::oaths::ANGER)
        } else {
            0
        };
        set_stamina(d, key, oaths, Option::None, Some(20));
        let camp = place_camp(d, game_id, crate::geometry::neighbor(army.coord, 0));
        let command = crate::commands::Command::BattleGuard(
            crate::commands::Battle { attacker_id: key.explorer_id, defender_id: camp, relic_slot: None },
        );
        assert_eq!(super::resource_commands::execute_in_game(d, game_id, command, FIXTURE_START + 10), anger);
    }
}

#[test]
fn the_fox_lets_a_scout_reveal_for_eight_stamina_where_ten_is_the_cost() {
    for fox in array![false, true] {
        let (d, game_id, key) = super::registrar::setup_frontier_relics();
        let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
        army.troops.category = crate::troops::TroopType::Paladin;
        super::resource_commands::set_explorer_fixture(d.games, key, army);
        let oaths = if fox {
            crate::oaths::bit(crate::oaths::FOX)
        } else {
            0
        };
        set_stamina(d, key, oaths, Option::None, Some(8));
        assert_eq!(super::registrar::explore_with_root(d, game_id, key.explorer_id, 0, FIXTURE_START + 10), fox);
        if fox {
            assert_eq!(stamina_of(d, key), 0);
        }
    }
}

#[test]
fn enlightenment_regains_forty_stamina_an_hour_where_the_army_regains_thirty() {
    for (oaths, regained) in array![(0, 30_u64), (crate::oaths::bit(crate::oaths::ENLIGHTENMENT), 40)] {
        let (d, game_id, key) = super::registrar::setup_frontier_relics();
        set_stamina(d, key, oaths, Option::None, Some(0));
        let amount = snforge_std::interact_with_state(
            d.games,
            || {
                let rules = crate::commands::load_context(game_id, 0, FIXTURE_START + 10).rules.unbox();
                let refill = crate::troops::StaminaRefill {
                    timestamp: FIXTURE_START + 10 + 3600,
                    stamina_config: rules.troop_stamina_config,
                    armies_tick_in_seconds: rules.tick_config.armies_tick_in_seconds,
                };
                crate::logic::army_slot_storage::resolve(
                    key, crate::logic::troops::explorer(key).unwrap(), Some(refill),
                )
                    .troops
                    .stamina
                    .inline()
                    .amount
            },
        );
        assert_eq!(amount, regained);
    }
}

fn set_stamina(
    d: super::Deployment, key: crate::troops::ExplorerKey, oaths: u16, pick: Option<u16>, amount: Option<u64>,
) -> u64 {
    snforge_std::interact_with_state(
        d.games,
        || {
            let mut progress = crate::logic::progression::require(key);
            progress.oaths = oaths;
            progress.oath_pick = pick.unwrap_or(0);
            crate::logic::progression::write(key, progress);
            let original = crate::logic::troops::explorer(key).unwrap();
            let mut army = crate::logic::army_slot_storage::resolve(key, original, None);
            let rules = crate::commands::load_context(key.game_id, 0, FIXTURE_START + 10).rules.unbox();
            let maximum = crate::progression::stamina_max(progress, army.troops.category, rules.troop_stamina_config);
            let mut bar = army.troops.stamina.inline();
            bar.amount = amount.unwrap_or(maximum);
            bar.settled_at = (FIXTURE_START + 10).try_into().unwrap();
            bar.remainder = 0;
            army.troops.stamina = StaminaSource::Inline(bar);
            crate::logic::army_slot_storage::persist(key, original.into_record(), army.troops);
            maximum
        },
    )
}

fn stamina_of(d: super::Deployment, key: crate::troops::ExplorerKey) -> u64 {
    snforge_std::interact_with_state(
        d.games,
        || {
            crate::logic::army_slot_storage::resolve(key, crate::logic::troops::explorer(key).unwrap(), None)
                .troops
                .stamina
                .inline()
                .amount
        },
    )
}

fn place_camp(d: super::Deployment, game_id: u32, coord: crate::troops::Coord) -> u64 {
    let context = crate::commands::ExecutionContext {
        timestamp: FIXTURE_START + 10, ..crate::tests::context(d.games, game_id),
    };
    snforge_std::start_cheat_caller_address(d.games, d.games);
    let site = crate::structures::IStructureOperationsDispatcherTrait::create_discovery(
        crate::structures::IStructureOperationsDispatcher { contract_address: d.games },
        game_id,
        1,
        coord,
        crate::discovery::Discovery::Camp,
        123,
        FIXTURE_START + 10,
        crate::commands::action_context(context),
    );
    snforge_std::stop_cheat_caller_address(d.games);
    site
}

fn army_home(key: crate::troops::ExplorerKey) -> crate::resources::ResourceKey {
    crate::resources::ResourceKey {
        game_id: key.game_id, entity_id: crate::logic::troops::explorer(key).unwrap().owner,
    }
}
