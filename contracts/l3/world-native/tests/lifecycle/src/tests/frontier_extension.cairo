use snforge_std::{start_cheat_block_timestamp, start_cheat_chain_id};
use starknet::storage::{StorageMapWriteAccess, StoragePathEntry, StoragePointerWriteAccess};
use world_test_support::tests::releases::*;
use crate::approved_frontier_extension as approved;

fn setup() -> super::Deployment {
    let d = super::registrar::setup();
    let registrar = IRegistrarDispatcher { contract_address: d.games };
    let releases = IReleasesDispatcher { contract_address: d.games };
    start_cheat_caller_address(d.games, authority());
    let (_, preset) = super::preset_projection::current_definition("frontier");
    registrar.register_preset(approved::PRESET_ID, preset);
    let params = CreateGameParams {
        name: approved::NAME,
        preset_id: approved::PRESET_ID,
        start_settling_at: approved::START,
        start_main_at: approved::START,
        duration_seconds: approved::OLD_END - approved::START,
        end_grace_seconds: 0,
        seed: approved::SEED,
        ..super::registrar::params(false),
    };
    assert_eq!(registrar.create_game(params), approved::GAME_ID);
    assert_eq!(registrar.create_game(CreateGameParams { name: 'unrelated', ..params }), 2);
    super::registrar::publish_test_pool(d, 1, approved::POOL_LORDS, approved::START + 1);
    start_cheat_caller_address(d.games, authority());
    let release = releases.release(1);
    releases.register_release(2, release);
    releases.register_release(3, release);
    for id in 1..3 {
        releases.apply_release(id, 2);
        releases.apply_release(id, 3);
    }
    releases.register_release(4, Release { migration: declare_logic("ReleaseMigration"), ..release });
    start_cheat_chain_id(d.games, approved::CHAIN_ID);
    start_cheat_block_timestamp(d.games, approved::OLD_END - 3600);
    d
}

fn budget(d: super::Deployment) -> crate::relics::LordsBudget {
    interact_with_state(d.games, || crate::logic::lords_budget::budget(1).unwrap())
}
fn store_budget(d: super::Deployment, value: crate::relics::LordsBudget) {
    interact_with_state(d.games, || crate::state::write().relics.rollover_budget.write(1, Some(value)));
}
fn game(d: super::Deployment) -> crate::game::GameRegistry {
    IGameDispatcher { contract_address: d.games }.game(1)
}

#[test]
fn approved_extension_changes_only_end_emits_row_and_retries_without_events() {
    let d = setup();
    let games = IGameDispatcher { contract_address: d.games };
    let releases = IReleasesDispatcher { contract_address: d.games };
    let before = game(d);
    let other = games.game(2);
    let before_budget = budget(d);
    let before_rules = games.rules(1);
    let mut events = spy_events();
    releases.apply_release(1, 4);
    assert_eq!(game(d), crate::game::GameRegistry { end_at: approved::END, ..before });
    assert_eq!(budget(d), before_budget);
    assert_eq!(games.rules(1), before_rules);
    assert_eq!(games.game(2), other);
    let emitted = events.get_events().emitted_by(d.games);
    assert_eq!(emitted.events.len(), 2);
    let (_, row) = emitted.events.at(1);
    assert_eq!(row.keys.span(), array![selector!("GameEvent"), selector!("RowSet"), 1, 'GameRegistry'].span());
    let mut values = array![];
    game(d).serialize(ref values);
    let mut expected = array![1, 1, values.len().into()];
    expected.append_span(values.span());
    assert_eq!(row.data.span(), expected.span());
    let mut repeated = spy_events();
    releases.apply_release(1, 4);
    assert!(repeated.get_events().emitted_by(d.games).events.is_empty());
    assert_eq!(releases.game_release(1), 4);
    assert_eq!(crate::game::status_at(game(d), approved::OLD_END), crate::game::GameStatus::Live);
    assert_eq!(crate::game::status_at(game(d), approved::END - 1), crate::game::GameStatus::Live);
    assert_eq!(crate::game::status_at(game(d), approved::END), crate::game::GameStatus::Ended);
    let final_day = crate::days::day_of(game(d), approved::DAY_UNIT, approved::END - 1);
    assert_eq!(final_day.index, 14);
    assert_eq!(final_day.end, approved::END);
    crate::relics::assert_claim_window(
        game(d), super::lords_budget::rules(), approved::END + approved::CLAIM_WINDOW.into() - 3601,
    );
    assert!(
        !super::resource_commands::execute_in_game(d, 1, crate::commands::Command::MarkGameSettled, approved::OLD_END),
    );
    assert!(super::resource_commands::execute_in_game(d, 1, crate::commands::Command::MarkGameSettled, approved::END));
    assert!(game(d).settled);
}

#[test]
fn unrelated_chain_and_game_keep_their_original_end() {
    let d = setup();
    let games = IGameDispatcher { contract_address: d.games };
    let releases = IReleasesDispatcher { contract_address: d.games };
    let before = game(d);
    let other = games.game(2);
    releases.apply_release(2, 4);
    assert_eq!(games.game(2), other);
    start_cheat_chain_id(d.games, 'DEV');
    releases.apply_release(1, 4);
    assert_eq!(game(d), before);
}

#[test_case(0)]
#[test_case(1)]
#[test_case(2)]
#[test_case(3)]
#[test_case(4)]
#[test_case(5)]
#[test_case(6)]
#[test_case(7)]
#[test_case(8)]
#[test_case(9)]
#[test_case(10)]
#[test_case(11)]
#[test_case(12)]
#[test_case(13)]
#[test_case(14)]
#[test_case(15)]
#[test_case(16)]
#[test_case(17)]
#[test_case(18)]
#[feature("safe_dispatcher")]
fn extension_refuses_wrong_identity_lifecycle_authority_and_insolvent_unlock(case: u8) {
    let d = setup();
    let games = IGameDispatcher { contract_address: d.games };
    let mut changed = game(d);
    match case {
        0 => changed.seed += 1,
        1 => changed.name = 'different',
        2 => changed.start_main_at += 120,
        3 => changed.end_at += 120,
        4 => changed.settled = true,
        5 => changed.ready = false,
        6 => start_cheat_block_timestamp(d.games, approved::OLD_END),
        7 => start_cheat_block_timestamp(d.games, approved::START - 1),
        8 => store_budget(d, crate::relics::LordsBudget { pool_left: 0, ..budget(d) }),
        10 => changed.preset_id = 2,
        11 => changed.start_settling_at -= 120,
        12 => changed.dev_mode_on = true,
        13 => changed.end_grace_seconds = 120,
        14 => store_budget(d, crate::relics::LordsBudget { pool: 1, pool_left: 1, ..budget(d) }),
        15 => interact_with_state(d.games, || crate::state::write().relics.rollover_budget.write(1, None)),
        16 => store_budget(d, crate::relics::LordsBudget { pool_left: approved::POOL_LORDS + 1, ..budget(d) }),
        17 => interact_with_state(
            d.games,
            || {
                let commitment = crate::state::read().registrar.presets.read(approved::PRESET_ID);
                crate::state::write().presets.entry(commitment).rules.day_unit_seconds.write(3600);
            },
        ),
        18 => interact_with_state(
            d.games,
            || {
                let commitment = crate::state::read().registrar.presets.read(approved::PRESET_ID);
                crate::state::write()
                    .presets
                    .entry(commitment)
                    .rollover_chest_rules
                    .write(
                        Some(
                            crate::relics::ChestRules {
                                claim_window_seconds: 3600, ..crate::logic::lords_budget::chest_rules(1),
                            },
                        ),
                    );
            },
        ),
        _ => {},
    }
    games.write_game(1, changed);
    if case == 9 {
        start_cheat_caller_address(d.games, d.actor);
    }
    let before = game(d);
    let before_budget = interact_with_state(d.games, || crate::logic::lords_budget::budget(1));
    let safe = IReleasesSafeDispatcher { contract_address: d.games };
    assert!(safe.apply_release(1, 4).is_err());
    assert_eq!(IReleasesDispatcher { contract_address: d.games }.game_release(1), 3);
    assert_eq!(game(d), before);
    assert_eq!(interact_with_state(d.games, || crate::logic::lords_budget::budget(1)), before_budget);
}

#[test_case(false)]
#[test_case(true)]
#[feature("safe_dispatcher")]
fn extension_keeps_current_chest_holds_but_excludes_expired_holds(expired: bool) {
    let d = setup();
    let today = crate::days::day_of(game(d), approved::DAY_UNIT, approved::OLD_END - 3600);
    let value = crate::relics::LordsBudget {
        day: if expired {
            today.index - 1
        } else {
            today.index
        }, open: approved::POOL_LORDS, ..budget(d),
    };
    store_budget(d, value);
    let result = IReleasesSafeDispatcher { contract_address: d.games }.apply_release(1, 4);
    assert_eq!(result.is_ok(), expired);
    assert_eq!(game(d).end_at, if expired {
        approved::END
    } else {
        approved::OLD_END
    });
    assert_eq!(budget(d), value);
}
