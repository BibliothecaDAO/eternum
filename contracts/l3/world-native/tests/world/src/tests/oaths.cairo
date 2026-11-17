use crate::oaths::{ChooseOath, card, count, draw, held};
use super::progression::read_progress;

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
    let root = super::registrar::discovery_root(
        game_id, discovery, 100, 0, None, crate::discovery::Discovery::Shrine,
    );
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
    assert!(super::registrar::explore_with_root(d, game_id, key.explorer_id, root, 360));
    let first = read_progress(d, key);
    assert!(first.oath_pick != 0);
    assert_eq!(first.oaths, 0);
    assert!(super::registrar::explore_with_root(d, game_id, key.explorer_id, root, 361));
    assert_eq!(read_progress(d, key).oath_pick, first.oath_pick);
    let taken = card(first.oath_pick, 0);
    let take = ChooseOath {
        explorer_id: key.explorer_id, expected_pick: first.oath_pick, oath: Some(taken), replace: None,
    };
    assert!(
        !world_test_support::tests::play_fixture::play(
            d.games,
            world_test_support::tests::play_fixture::TestAction {
                game_id, actor: 999.try_into().unwrap(), command: crate::commands::Command::ChooseOath(take),
            },
            123,
            362,
        ),
    );
    assert_eq!(read_progress(d, key), first);
    assert!(super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::ChooseOath(take), 362));
    let chosen = read_progress(d, key);
    assert_eq!(chosen.oaths, crate::oaths::bit(taken));
    assert_eq!(chosen.oath_pick, 0);
    assert!(!super::resource_commands::execute_in_game(d, game_id, crate::commands::Command::ChooseOath(take), 363));
    assert_eq!(read_progress(d, key), chosen);
    assert!(super::registrar::explore_with_root(d, game_id, key.explorer_id, root, 364));
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
    assert!(super::registrar::explore_with_root(d, game_id, key.explorer_id, root, 367));
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
}

#[test]
fn packing_preserves_all_sixteen_held_bits_and_the_offer() {
    let value = crate::progression::ArmyProgress { logistics: 5, oath_slots: 4, oaths: 65535, oath_pick: 4095 };
    assert_eq!(
        crate::progression::ArmyProgressPacking::unpack(crate::progression::ArmyProgressPacking::pack(value)), value,
    );
}
