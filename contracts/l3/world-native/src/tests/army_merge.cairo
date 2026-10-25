use crate::progression::ArmyProgress;
use crate::rules::RESOURCE_PRECISION;
use crate::tests::state::{GameState, TroopObservationTrait};
use crate::troops::{ArmySlotKey, ExplorerKey, StaminaSource};
use super::registrar::{day_start, expedition_armies, expedition_home, setup, transfer};
use super::resource_commands::execute_in_game;

fn progress(d: super::Deployment, key: ExplorerKey) -> Option<ArmyProgress> {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::read(key))
}
fn write_progress(d: super::Deployment, key: ExplorerKey, value: ArmyProgress) {
    snforge_std::interact_with_state(d.games, || crate::logic::progression::write(key, value));
}
fn slot(d: super::Deployment, key: ExplorerKey, index: u8) -> crate::troops::ArmySlot {
    slot_at_home(d, key, 1, index)
}
fn slot_at_home(d: super::Deployment, key: ExplorerKey, home: u64, index: u8) -> crate::troops::ArmySlot {
    snforge_std::interact_with_state(
        d.games,
        || crate::logic::army_slot_storage::read(
            ArmySlotKey { game_id: key.game_id, structure_id: home, epoch: 0, slot: index },
        )
            .unwrap(),
    )
}
fn timers(d: super::Deployment, key: ExplorerKey, amount: u64, cooldown: u32) {
    let mut army = GameState { contract_address: d.games }.resolved_explorer(key).unwrap();
    army.troops.stamina = crate::troops::Stamina { amount, settled_at: 360, remainder: 0 }.into();
    army.troops.battle_cooldown_end = cooldown;
    super::resource_commands::set_explorer_fixture(d.games, key, army);
}

#[test]
fn full_merges_keep_the_chosen_target_even_with_less_progression() {
    for (source_xp, target_xp, reverse) in array![
        (500_u32, 0_u32, false), (500, 0, true), (0, 1, false), (0, 0, false),
    ] {
        let d = setup();
        let (game_id, _, category) = expedition_home(d);
        let (first, second) = expedition_armies(d, game_id, category);
        let (source, target, loser_slot, winner_slot) = if reverse {
            (second, first, 1, 0)
        } else {
            (first, second, 0, 1)
        };
        let veteran = ArmyProgress { battle: 2, scouting: 2, scouting_kinds: 3, ..crate::progression::initial() };
        write_progress(d, source, ArmyProgress { xp: source_xp, ..veteran });
        write_progress(d, target, ArmyProgress { xp: target_xp, ..veteran });
        let (winner, loser) = (target, source);
        let state = GameState { contract_address: d.games };
        let before = state.explorer(winner).unwrap();
        let kept = progress(d, winner).unwrap();
        timers(d, source, 7, 390);
        timers(d, target, 80, 400);
        assert!(execute_in_game(d, game_id, transfer(source, target, 3), 360));
        let after = state.explorer(winner).unwrap();
        assert_eq!(after.owner, before.owner);
        assert_eq!(after.coord, before.coord);
        assert_eq!(after.troops.stamina, StaminaSource::Slot(winner_slot));
        assert_eq!(after.troops.count, 6 * RESOURCE_PRECISION);
        assert_eq!(after.troops.battle_cooldown_end, 400);
        assert_eq!(progress(d, winner), Some(kept));
        assert!(progress(d, loser).is_none());
        assert!(state.explorer(loser).is_none());
        assert_eq!(slot(d, winner, winner_slot).stamina.amount, 7);
        assert_eq!(slot(d, loser, loser_slot).explorer_id, 0);
        assert_eq!(slot(d, loser, loser_slot).stamina.amount, 7);
        // Replaying a completed merge cannot mint troops or resurrect the losing army.
        assert!(!execute_in_game(d, game_id, transfer(source, target, 3), 360));
        assert_eq!(state.explorer(winner).unwrap(), after);
    }
}

#[test]
fn spent_and_trained_tiers_do_not_override_the_chosen_target() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (source, target) = expedition_armies(d, game_id, category);
    let trained = ArmyProgress { xp: 2, homecoming: 2, ..crate::progression::initial() };
    write_progress(d, source, trained);
    write_progress(d, target, ArmyProgress { xp: 99, ..crate::progression::initial() });
    assert!(execute_in_game(d, game_id, transfer(source, target, 3), 360));
    assert!(progress(d, source).is_none());
    assert_eq!(progress(d, target), Some(ArmyProgress { xp: 99, ..crate::progression::initial() }));
}

#[test]
fn partial_transfers_keep_both_progress_bundles_and_slots() {
    let d = setup();
    let (game_id, _, category) = expedition_home(d);
    let (source, target) = expedition_armies(d, game_id, category);
    let veteran = ArmyProgress { xp: 900, ..crate::progression::initial() };
    write_progress(d, source, veteran);
    timers(d, source, 0, 390);
    timers(d, target, 100, 400);
    assert!(execute_in_game(d, game_id, transfer(source, target, 1), 360));
    let state = GameState { contract_address: d.games };
    assert_eq!(state.explorer(source).unwrap().troops.count, 2 * RESOURCE_PRECISION);
    assert_eq!(state.explorer(target).unwrap().troops.count, 4 * RESOURCE_PRECISION);
    assert_eq!(progress(d, source), Some(veteran));
    assert_eq!(progress(d, target), Some(crate::progression::initial()));
    assert_eq!(slot(d, source, 0).explorer_id, source.explorer_id);
    assert_eq!(slot(d, target, 1).explorer_id, target.explorer_id);
    assert_eq!(slot(d, source, 0).stamina.amount, 0);
    assert_eq!(slot(d, target, 1).stamina.amount, 0);
    assert_eq!(state.explorer(target).unwrap().troops.battle_cooldown_end, 400);
}

#[test]
fn different_logistics_caps_and_exhausted_slots_never_refill_a_merge() {
    for (winner_logistics, loser_logistics, tired) in array![
        (1_u8, 5_u8, false), (5, 1, false), (5, 4, false), (5, 1, true),
    ] {
        let d = setup();
        let (game_id, preset, category) = expedition_home(d);
        let (source, target) = expedition_armies(d, game_id, category);
        let winning = ArmyProgress { xp: 5000, logistics: winner_logistics, ..crate::progression::initial() };
        let losing = ArmyProgress { logistics: loser_logistics, ..crate::progression::initial() };
        write_progress(d, target, winning);
        write_progress(d, source, losing);
        let state = GameState { contract_address: d.games };
        let kind = state.explorer(source).unwrap().troops.category;
        let maximum = crate::progression::stamina_max(winning, kind, preset.rules.troop_stamina_config);
        let other_max = crate::progression::stamina_max(losing, kind, preset.rules.troop_stamina_config);
        timers(d, target, maximum, 0);
        timers(d, source, if tired {
            0
        } else {
            other_max
        }, 0);
        assert!(execute_in_game(d, game_id, transfer(source, target, 3), 360));
        assert_eq!(slot(d, target, 1).stamina.amount, if tired {
            0
        } else {
            core::cmp::min(maximum, other_max)
        });
        assert_eq!(slot(d, source, 0).stamina.amount, if tired {
            0
        } else {
            other_max
        });
        assert_eq!(slot(d, source, 0).explorer_id, 0);
    }
}

#[test]
fn a_full_merge_over_the_survivor_cap_is_atomic_and_expired_armies_cannot_merge() {
    let d = setup();
    let (game_id, preset, category) = expedition_home(d);
    let (source, target) = expedition_armies(d, game_id, category);
    write_progress(d, source, ArmyProgress { xp: 500, ..crate::progression::initial() });
    let state = GameState { contract_address: d.games };
    // The source belongs to a higher-level home; its cap must not replace the chosen target cap.
    // Recreate the fixture's source at that home, with its own daily slot and home index.
    let other_home = 999;
    snforge_std::interact_with_state(
        d.games,
        || {
            let home = crate::logic::structures::record(crate::resources::ResourceKey { game_id, entity_id: 1 });
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
                .stamina = crate::logic::army_slot_storage::allocate(source, other_home, 0, 4, stamina, stamina.amount);
            crate::logic::troops::TroopState::create(source, crate::troops::ExplorerRecordTrait::into_record(army));
        },
    );
    let mut full = state.resolved_explorer(source).unwrap();
    let limit: u128 = crate::troops::max_army_size(preset.rules.troop_limit_config, 0, full.troops.tier).into();
    let other_limit: u128 = crate::troops::max_army_size(preset.rules.troop_limit_config, 1, full.troops.tier).into();
    assert!(limit + 3 <= other_limit);
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
    let target_slot = slot(d, target, 1);
    assert!(!execute_in_game(d, game_id, transfer(source, target, limit), 360));
    assert_eq!(state.explorer(source).unwrap(), before_source);
    assert_eq!(state.explorer(target).unwrap(), before_target);
    assert_eq!(slot_at_home(d, source, other_home, 0), source_slot);
    assert_eq!(slot(d, target, 1), target_slot);
    assert!(!execute_in_game(d, game_id, transfer(source, target, 1), day_start(d, game_id, 1)));
    assert_eq!(state.explorer(source).unwrap(), before_source);
    assert_eq!(state.explorer(target).unwrap(), before_target);
    assert_eq!(progress(d, source).unwrap().xp, 500);
    // Reversing the chosen direction makes the same total fit the higher-cap home.
    assert!(execute_in_game(d, game_id, transfer(target, source, 3), 360));
    assert!(state.explorer(target).is_none());
    let survivor = state.explorer(source).unwrap();
    assert_eq!(survivor.owner, other_home);
    assert_eq!(survivor.troops.count, (limit + 3) * RESOURCE_PRECISION);
}

#[test]
fn a_loaded_loser_cannot_be_destroyed_in_either_merge_direction() {
    for reverse in array![true, false] {
        let d = setup();
        let (game_id, _, category) = expedition_home(d);
        let (source, target) = expedition_armies(d, game_id, category);
        let (winner, loser) = if reverse {
            (source, target)
        } else {
            (target, source)
        };
        write_progress(d, winner, ArmyProgress { xp: 500, ..crate::progression::initial() });
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
        assert!(!execute_in_game(d, game_id, transfer(loser, winner, 3), 360));
        assert_eq!(state.explorer(source).unwrap(), before_source);
        assert_eq!(state.explorer(target).unwrap(), before_target);
        assert_eq!(progress(d, winner).unwrap().xp, 500);
        assert!(progress(d, loser).is_some());
    }
}

