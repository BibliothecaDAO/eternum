pub use world_test_support::tests::army_merge::*;
const NOW: u64 = super::play_fixture::FIXTURE_START;

#[test]
fn full_merges_keep_the_chosen_target_even_with_less_progression() {
    for (source_logistics, target_logistics, source_slots, target_slots, reverse) in array![
        (5_u8, 0_u8, 4_u8, 1_u8, false), (5, 0, 4, 1, true), (0, 1, 1, 4, false), (0, 0, 1, 4, true),
    ] {
        let d = setup();
        let (game_id, home, _) = expedition_home(d);
        let (first, second) = expedition_armies(d, home);
        let (source, target, loser_slot, winner_slot) = if reverse {
            (second, first, 1, 0)
        } else {
            (first, second, 0, 1)
        };
        write_progress(
            d, source, ArmyProgress { logistics: source_logistics, oath_slots: source_slots, oaths: 1, oath_pick: 0 },
        );
        write_progress(
            d, target, ArmyProgress { logistics: target_logistics, oath_slots: target_slots, oaths: 8, oath_pick: 0 },
        );
        let (winner, loser) = (target, source);
        let state = GameState { contract_address: d.games };
        let before = state.explorer(winner).unwrap();
        let moved = state.explorer(source).unwrap().troops.count;
        let kept = progress(d, winner).unwrap();
        timers(d, source, 7, 390);
        timers(d, target, 80, 400);
        let merge = transfer(source, target, moved / RESOURCE_PRECISION);
        assert!(execute_in_game(d, game_id, merge, NOW));
        let after = state.explorer(winner).unwrap();
        assert_eq!(after.owner, before.owner);
        assert_eq!(after.coord, before.coord);
        assert_eq!(after.troops.stamina, StaminaSource::Slot(winner_slot));
        assert_eq!(after.troops.count, before.troops.count + moved);
        assert_eq!(after.troops.battle_cooldown_end, 400);
        assert_eq!(progress(d, winner), Some(kept));
        assert_eq!(progress(d, winner).unwrap().oath_slots, target_slots);
        assert!(progress(d, loser).is_none());
        assert!(state.explorer(loser).is_none());
        assert_eq!(slot_at_home(d, winner, home.entity_id, winner_slot).stamina.amount, 7);
        assert_eq!(slot_at_home(d, loser, home.entity_id, loser_slot).explorer_id, 0);
        assert_eq!(slot_at_home(d, loser, home.entity_id, loser_slot).stamina.amount, 7);
        // Replaying a completed merge cannot mint troops or resurrect the losing army.
        assert!(!execute_in_game(d, game_id, merge, NOW));
        assert_eq!(state.explorer(winner).unwrap(), after);
    }
}


#[test]
fn partial_transfers_keep_both_progress_bundles_and_slots() {
    let d = setup();
    let (game_id, home, _) = expedition_home(d);
    let (source, target) = expedition_armies(d, home);
    let veteran = ArmyProgress { logistics: 3, oath_slots: 4, oaths: 1, oath_pick: 0 };
    write_progress(d, source, veteran);
    timers(d, source, 0, 390);
    timers(d, target, 100, 400);
    let state = GameState { contract_address: d.games };
    let (source_count, target_count) = (count(d, source), count(d, target));
    assert!(execute_in_game(d, game_id, transfer(source, target, 1), NOW));
    assert_eq!(count(d, source), source_count - RESOURCE_PRECISION);
    assert_eq!(count(d, target), target_count + RESOURCE_PRECISION);
    assert_eq!(progress(d, source), Some(veteran));
    assert_eq!(progress(d, target), Some(Default::default()));
    assert_eq!(progress(d, source).unwrap().oath_slots, 4);
    assert_eq!(progress(d, target).unwrap().oath_slots, 2);
    assert_eq!(slot_at_home(d, source, home.entity_id, 0).explorer_id, source.explorer_id);
    assert_eq!(slot_at_home(d, target, home.entity_id, 1).explorer_id, target.explorer_id);
    assert_eq!(slot_at_home(d, source, home.entity_id, 0).stamina.amount, 0);
    assert_eq!(slot_at_home(d, target, home.entity_id, 1).stamina.amount, 0);
    assert_eq!(state.explorer(target).unwrap().troops.battle_cooldown_end, 400);
}

#[test]
fn different_logistics_caps_and_exhausted_slots_never_refill_a_merge() {
    for (winner_logistics, loser_logistics, tired) in array![
        (1_u8, 5_u8, false), (5, 1, false), (5, 4, false), (5, 1, true),
    ] {
        let d = setup();
        let (game_id, home, _) = expedition_home(d);
        let (source, target) = expedition_armies(d, home);
        let stamina = crate::balance::rules::TROOP_STAMINA_CONFIG;
        let winning = ArmyProgress { logistics: winner_logistics, oath_slots: 1, ..Default::default() };
        let losing = ArmyProgress { logistics: loser_logistics, oath_slots: 1, ..Default::default() };
        write_progress(d, target, winning);
        write_progress(d, source, losing);
        let state = GameState { contract_address: d.games };
        let kind = state.explorer(source).unwrap().troops.category;
        let maximum = crate::progression::stamina_max(winning, kind, stamina);
        let other_max = crate::progression::stamina_max(losing, kind, stamina);
        timers(d, target, maximum, 0);
        timers(d, source, if tired {
            0
        } else {
            other_max
        }, 0);
        assert!(execute_in_game(d, game_id, transfer(source, target, count(d, source) / RESOURCE_PRECISION), NOW));
        assert_eq!(
            slot_at_home(d, target, home.entity_id, 1).stamina.amount,
            if tired {
                0
            } else {
                core::cmp::min(maximum, other_max)
            },
        );
        assert_eq!(slot_at_home(d, source, home.entity_id, 0).stamina.amount, if tired {
            0
        } else {
            other_max
        });
        assert_eq!(slot_at_home(d, source, home.entity_id, 0).explorer_id, 0);
    }
}

#[test]
fn a_full_merge_over_the_survivor_cap_is_atomic_and_expired_armies_cannot_merge() {
    let d = setup();
    let (game_id, home, _) = expedition_home(d);
    let (source, target) = expedition_armies(d, home);
    write_progress(d, source, ArmyProgress { logistics: 5, oath_slots: 1, ..Default::default() });
    let state = GameState { contract_address: d.games };
    // The source belongs to a higher-level home; its cap must not replace the chosen target cap.
    // Recreate the fixture's source at that home, with its own daily slot and home index.
    let other_home = 999;
    snforge_std::interact_with_state(
        d.games,
        || {
            starknet::storage::StorageMapWriteAccess::write(
                crate::state::write().settlements.home_aspects,
                (game_id, other_home),
                crate::logic::aspects::home_aspect(home),
            );
            let home = crate::logic::structures::record(home);
            crate::logic::structures::StructureState::create(
                crate::resources::ResourceKey { game_id, entity_id: other_home },
                crate::structures::StructureRecord {
                    base: crate::structures::StructureBase { level: 1, ..home.base }, ..home,
                },
            );
            let mut army = crate::logic::troops::explorer(source).unwrap();
            let bar = crate::logic::army_slot_storage::resolve(source, army, None).troops.stamina;
            crate::logic::army_slot_storage::release(source, army);
            crate::logic::troops::TroopState::destroy(source);
            army.owner = other_home;
            let StaminaSource::Inline(stamina) = bar else {
                panic!("expected resolved bar");
            };
            army
                .troops
                .stamina =
                    crate::logic::army_slot_storage::allocate(source, other_home, 0, 4, 0, stamina, stamina.amount);
            crate::logic::troops::TroopState::create(source, crate::troops::ExplorerRecordTrait::into_record(army));
        },
    );
    let mut full = state.resolved_explorer(source).unwrap();
    let limits = crate::balance::rules::TROOP_LIMIT_CONFIG;
    let limit: u128 = crate::troops::max_army_size(limits, 0, full.troops.tier).into();
    let other_limit: u128 = crate::troops::max_army_size(limits, 1, full.troops.tier).into();
    let reinforcement = count(d, target) / RESOURCE_PRECISION;
    assert!(limit + reinforcement <= other_limit);
    full.troops.count = limit * RESOURCE_PRECISION;
    super::resource_commands::set_explorer_fixture(d.games, source, full);
    let resources = crate::resources::ResourceKey { game_id, entity_id: source.explorer_id };
    let weight = snforge_std::interact_with_state(d.games, || crate::logic::resources::weight(resources));
    super::resource_commands::set_fixture(
        d.games,
        selector!("resources"),
        selector!("weights"),
        array![game_id.into(), source.explorer_id.into()].span(),
        crate::resources::Weight { capacity: weight.capacity / 3 * limit, ..weight },
    );
    let before_source = state.explorer(source).unwrap();
    let before_target = state.explorer(target).unwrap();
    let source_slot = slot_at_home(d, source, other_home, 0);
    let target_slot = slot_at_home(d, target, home.entity_id, 1);
    assert!(!execute_in_game(d, game_id, transfer(source, target, limit), NOW));
    assert_eq!(state.explorer(source).unwrap(), before_source);
    assert_eq!(state.explorer(target).unwrap(), before_target);
    assert_eq!(slot_at_home(d, source, other_home, 0), source_slot);
    assert_eq!(slot_at_home(d, target, home.entity_id, 1), target_slot);
    assert!(!execute_in_game(d, game_id, transfer(source, target, 1), day_start(d, game_id, 1)));
    assert_eq!(state.explorer(source).unwrap(), before_source);
    assert_eq!(state.explorer(target).unwrap(), before_target);
    assert_eq!(progress(d, source).unwrap().logistics, 5);
    // Reversing the chosen direction makes the same total fit the higher-cap home.
    assert!(execute_in_game(d, game_id, transfer(target, source, reinforcement), NOW));
    assert!(state.explorer(target).is_none());
    let survivor = state.explorer(source).unwrap();
    assert_eq!(survivor.owner, other_home);
    assert_eq!(survivor.troops.count, (limit + reinforcement) * RESOURCE_PRECISION);
}

#[test]
fn a_loaded_loser_cannot_be_destroyed_in_either_merge_direction() {
    for reverse in array![true, false] {
        let d = setup();
        let (game_id, home, _) = expedition_home(d);
        let (source, target) = expedition_armies(d, home);
        let (winner, loser) = if reverse {
            (source, target)
        } else {
            (target, source)
        };
        write_progress(d, winner, ArmyProgress { logistics: 5, oath_slots: 1, ..Default::default() });
        let key = crate::resources::ResourceKey { game_id, entity_id: loser.explorer_id };
        let weight = snforge_std::interact_with_state(d.games, || crate::logic::resources::weight(key));
        super::resource_commands::set_fixture(
            d.games,
            selector!("resources"),
            selector!("weights"),
            array![game_id.into(), loser.explorer_id.into()].span(),
            crate::resources::Weight { weight: 1, ..weight },
        );
        let state = GameState { contract_address: d.games };
        let before_source = state.explorer(source).unwrap();
        let before_target = state.explorer(target).unwrap();
        assert!(!execute_in_game(d, game_id, transfer(loser, winner, count(d, loser) / RESOURCE_PRECISION), NOW));
        assert_eq!(state.explorer(source).unwrap(), before_source);
        assert_eq!(state.explorer(target).unwrap(), before_target);
        assert_eq!(progress(d, winner).unwrap().logistics, 5);
        assert!(progress(d, loser).is_some());
    }
}

#[test]
fn waiting_picks_on_either_army_refuse_full_and_partial_transfers_without_losing_a_pick() {
    for pending_source in array![true, false] {
        for whole in array![false, true] {
            let d = setup();
            let (game_id, home, _) = expedition_home(d);
            let (source, target) = expedition_armies(d, home);
            let key = if pending_source {
                source
            } else {
                target
            };
            let waiting = ArmyProgress { oath_pick: crate::oaths::draw(0, 1), ..Default::default() };
            let amount = if whole {
                count(d, source) / RESOURCE_PRECISION
            } else {
                1
            };
            write_progress(d, key, waiting);
            let state = GameState { contract_address: d.games };
            let before = (state.explorer(source), state.explorer(target));
            let mut spy = snforge_std::spy_events();
            assert!(!execute_in_game(d, game_id, transfer(source, target, amount), NOW));
            assert_eq!(super::play_fixture::rejection(ref spy, d.games).reason, "ANSWER_OATH_FIRST");
            assert_eq!((state.explorer(source), state.explorer(target)), before);
            assert_eq!(progress(d, key), Some(waiting));
        }
    }
}

fn count(d: super::Deployment, key: ExplorerKey) -> u128 {
    GameState { contract_address: d.games }.explorer(key).unwrap().troops.count
}
