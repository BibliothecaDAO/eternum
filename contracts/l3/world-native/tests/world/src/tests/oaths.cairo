use crate::oaths::{ChooseOath, card, count, draw, held};
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
    explore(d, key, root, 361);
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

fn explore(d: super::Deployment, key: crate::troops::ExplorerKey, root: u256, timestamp: u64) {
    for command in array![
        crate::commands::Command::Explore(crate::commands::Explore { explorer_id: key.explorer_id, direction: 0 }),
        crate::commands::Command::Move(
            crate::commands::Move { explorer_id: key.explorer_id, directions: array![0].span() },
        ),
    ] {
        let mut spy = snforge_std::spy_events();
        if !super::play_fixture::play(
            d.games, super::play_fixture::TestAction { game_id: key.game_id, actor: d.actor, command }, root, timestamp,
        ) {
            let rejected = super::play_fixture::rejection(ref spy, d.games);
            panic!("shrine route rejected: {}", rejected.reason);
        }
    }
}
