use snforge_std::{EventSpyTrait, EventsFilterTrait, start_cheat_caller_address, stop_cheat_caller_address};
use crate::commands::Command;
use crate::game::{
    GameStatus, IGameDispatcher, IGameDispatcherTrait, ISeasonLifecycleDispatcher, ISeasonLifecycleDispatcherTrait,
    ISeasonLifecycleSafeDispatcher, ISeasonLifecycleSafeDispatcherTrait,
};
use crate::hyperstructures::{
    IHyperstructuresDispatcher, IHyperstructuresDispatcherTrait, IHyperstructuresSafeDispatcher,
    IHyperstructuresSafeDispatcherTrait,
};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at, setup_with_rules};

fn configure(deployment: super::Deployment, points: u128) {
    start_cheat_caller_address(deployment.peers.season, super::authority());
    ISeasonLifecycleDispatcher { contract_address: deployment.peers.season }.configure_season_win(3, points);
    stop_cheat_caller_address(deployment.peers.season);
}
fn games(deployment: super::Deployment) -> IGameDispatcher {
    IGameDispatcher { contract_address: deployment.peers.season }
}
fn hypers(deployment: super::Deployment) -> IHyperstructuresDispatcher {
    IHyperstructuresDispatcher { contract_address: deployment.peers.economy }
}

#[test]
fn close_settles_all_completed_shares_before_testing_the_victory_threshold() {
    let (deployment, hyper, home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(deployment, hyper, home);
    let before = games(deployment).player_points(3, deployment.actor);
    configure(deployment, before + 50000);
    assert!(execute(deployment, Command::CloseSeason, 100));
    let game = games(deployment).game(3);
    assert_eq!(game.end_at, 100);
    assert_eq!(crate::game::status_at(game, 100), GameStatus::Ended);
    assert_eq!(games(deployment).player_points(3, deployment.actor), before + 50000);
    assert_eq!(hypers(deployment).hyperstructure_shares(hyper).start_at, 100);
    assert_terminal_rejection(deployment, Command::CloseSeason, 101);
    super::hyperstructures::checkpoint(deployment, 500);
    assert_eq!(games(deployment).player_points(3, deployment.actor), before + 50000);
}

#[test]
fn an_insufficient_score_keeps_checkpoints_and_a_later_attempt_can_close() {
    let (deployment, hyper, home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(deployment, hyper, home);
    let before = games(deployment).player_points(3, deployment.actor);
    configure(deployment, before + 50000);
    assert!(execute(deployment, Command::CloseSeason, 99));
    assert_eq!(games(deployment).player_points(3, deployment.actor), before + 49000);
    assert_eq!(hypers(deployment).hyperstructure_shares(hyper).start_at, 99);
    assert_eq!(games(deployment).game(3).end_at, 200);
    assert!(execute(deployment, Command::CloseSeason, 100));
}

#[test]
fn outage_recovery_closes_at_recorded_time_with_the_same_points_as_immediate_execution() {
    let (immediate, first, home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(immediate, first, home);
    configure(immediate, 1);
    assert!(execute(immediate, Command::CloseSeason, 100));
    let (delayed, second, home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(delayed, second, home);
    configure(delayed, 1);
    assert!(execute_recorded_at(delayed, Command::CloseSeason, 100, 10000));
    assert_eq!(games(delayed).game(3).end_at, games(immediate).game(3).end_at);
    assert_eq!(
        crate::game::status_at(games(delayed).game(3), 100), crate::game::status_at(games(immediate).game(3), 100),
    );
    assert_eq!(games(delayed).player_points(3, delayed.actor), games(immediate).player_points(3, immediate.actor));
    assert_eq!(
        hypers(delayed).hyperstructure_shares(second).start_at, hypers(immediate).hyperstructure_shares(first).start_at,
    );
}

#[test]
fn zero_or_missing_threshold_never_ends_the_season() {
    let (deployment, _, _) = setup_with_rules(super::recorded::rules());
    assert_terminal_rejection(deployment, Command::CloseSeason, 40);
    configure(deployment, 0);
    assert_terminal_rejection(deployment, Command::CloseSeason, 40);
    assert_eq!(games(deployment).game(3).end_at, 200);
}

#[test]
fn season_close_requires_started_eternum_and_timed_games_stop_at_their_clock() {
    let (eternum, _, _) = setup_with_rules(super::recorded::rules());
    configure(eternum, 1);
    assert_terminal_rejection(eternum, Command::CloseSeason, 19);
    assert_terminal_rejection(eternum, Command::CloseSeason, 200);
    let rules = crate::rules::SliceRules { blitz_mode_on: true, ..super::recorded::rules() };
    let (blitz, home, _) = setup_with_rules(rules);
    configure(blitz, 1);
    assert_terminal_rejection(blitz, Command::CloseSeason, 100);
    assert!(execute(blitz, Command::ClaimProduction(home.entity_id), 199));
    assert_terminal_rejection(blitz, Command::ClaimProduction(home.entity_id), 200);
}

#[test]
#[feature("safe_dispatcher")]
fn season_configuration_and_closure_reject_foreign_callers_and_keep_games_separate() {
    let (deployment, _, _) = setup_with_rules(super::recorded::rules());
    let season = ISeasonLifecycleSafeDispatcher { contract_address: deployment.peers.season };
    assert!(season.configure_season_win(3, 1).is_err());
    assert!(season.close_season(3, deployment.actor, super::context()).is_err());
    assert!(
        IHyperstructuresSafeDispatcher { contract_address: deployment.peers.economy }
            .settle_completed_hyperstructures(3, 30)
            .is_err(),
    );
    start_cheat_caller_address(deployment.peers.season, super::authority());
    assert!(season.configure_season_win(3, 1).is_ok());
    assert!(season.configure_season_win(3, 2).is_err());
    assert!(season.configure_season_win(999, 1).is_err());
    assert_eq!(season.season_win_threshold(3).unwrap(), 1);
    assert!(season.season_win_threshold(2).is_err());
}

#[test]
fn closing_includes_every_completed_hyperstructure_and_skips_foundations() {
    let (deployment, first, home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(deployment, first, home);
    snforge_std::start_cheat_block_timestamp_global(50);
    let mut second = first;
    for offset in array![200_u32, 300] {
        start_cheat_caller_address(deployment.peers.structures, deployment.peers.troops);
        let id = crate::structures::IStructuresDispatcherTrait::create_discovery(
            crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures },
            3,
            crate::troops::Coord { alt: false, x: 2000000 + offset, y: 2000000 },
            crate::discovery::Discovery::Hyperstructure,
            101,
            50,
        );
        stop_cheat_caller_address(deployment.peers.structures);
        if offset == 200 {
            second = crate::resources::ResourceKey { game_id: 3, entity_id: id };
            super::hyperstructures::owner(deployment, second, deployment.actor);
            super::resource_commands::grant(deployment, second, 24, 5 * crate::rules::RESOURCE_PRECISION);
            assert!(execute(deployment, Command::InitializeHyperstructure(second.entity_id), 50));
            assert!(
                execute(
                    deployment,
                    super::hyperstructures::contribute(
                        second,
                        home,
                        array![super::hyperstructures::amount(2, 10), super::hyperstructures::amount(3, 20)].span(),
                    ),
                    50,
                ),
            );
        }
    }
    let before = games(deployment).player_points(3, deployment.actor);
    configure(deployment, before + 100000);
    assert!(execute(deployment, Command::CloseSeason, 100));
    assert_eq!(games(deployment).player_points(3, deployment.actor), before + 100000);
    assert_eq!(hypers(deployment).hyperstructure_shares(first).start_at, 100);
    assert_eq!(hypers(deployment).hyperstructure_shares(second).start_at, 100);
}

#[test]
fn point_history_keeps_each_awards_activity_and_amount_without_a_second_balance() {
    let (deployment, _, _) = setup_with_rules(super::recorded::rules());
    let mut spy = snforge_std::spy_events();
    start_cheat_caller_address(deployment.peers.season, deployment.peers.troops);
    games(deployment).register_exploration(3, deployment.actor);
    start_cheat_caller_address(deployment.peers.season, deployment.peers.economy);
    games(deployment).register_relic_points(3, deployment.actor);
    games(deployment).register_hyperstructure_points(3, deployment.actor, 123);
    start_cheat_caller_address(deployment.peers.season, deployment.peers.structures);
    games(deployment).register_capture(3, deployment.actor, 2);
    games(deployment).register_capture(3, deployment.actor, 5);
    stop_cheat_caller_address(deployment.peers.season);
    let mut awarded = 0;
    let mut activities = 0_u8;
    for (_, event) in spy.get_events().emitted_by(deployment.peers.season).events.span() {
        if event.keys.len() == 5 && *event.keys.at(1) == selector!("PointsAwarded") {
            assert_eq!(*event.keys.at(2), 1);
            assert_eq!(*event.keys.at(3), 3);
            assert_eq!(*event.keys.at(4), deployment.actor.into());
            let amount: u128 = (*event.data.at(1)).try_into().unwrap();
            awarded += amount;
            let variant: u8 = (*event.data.at(0)).try_into().unwrap();
            activities = activities | match variant {
                0 => 1,
                1 => 2,
                2 => 4,
                3 => 8,
                4 => 16,
                _ => panic!("unknown activity"),
            };
        }
    }
    assert_eq!(activities, 31);
    assert_eq!(awarded, games(deployment).player_points(3, deployment.actor));
    assert_eq!(awarded, games(deployment).season_points(3));
}

fn nine_completed_hyperstructures() -> (super::Deployment, Array<crate::resources::ResourceKey>) {
    let (d, hyper, home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(d, hyper, home);
    let mut keys = array![hyper];
    for offset in 1_u32..9 {
        start_cheat_caller_address(d.peers.structures, d.peers.troops);
        let id = crate::structures::IStructuresDispatcherTrait::create_discovery(
            crate::structures::IStructuresDispatcher { contract_address: d.peers.structures },
            3,
            crate::troops::Coord { alt: false, x: 2000200 + offset * 10, y: 2000000 },
            crate::discovery::Discovery::Hyperstructure,
            101,
            50,
        );
        stop_cheat_caller_address(d.peers.structures);
        let key = crate::resources::ResourceKey { game_id: 3, entity_id: id };
        super::hyperstructures::owner(d, key, d.actor);
        let storage_key = array![3, id.into()].span();
        super::resource_commands::set_fixture(
            d.peers.economy,
            selector!("hyper_states"),
            storage_key,
            crate::hyperstructures::Hyperstructure {
                stage: crate::hyperstructures::Stage::Complete,
                access: crate::hyperstructures::ConstructionAccess::Public,
                seed: 101,
            },
        );
        super::resource_commands::set_fixture(d.peers.economy, selector!("hyper_share_count"), storage_key, 1_u32);
        super::resource_commands::set_fixture(d.peers.economy, selector!("hyper_share_start"), storage_key, 50_u64);
        super::resource_commands::set_fixture(d.peers.economy, selector!("hyper_multiplier"), storage_key, 1_u8);
        super::resource_commands::set_fixture(
            d.peers.economy,
            selector!("hyper_shares"),
            array![3, id.into(), 0].span(),
            crate::hyperstructures::Share { player: d.actor, bps: 10000 },
        );
        keys.append(key);
    }
    (d, keys)
}

#[test]
fn close_batches_keep_one_cutoff_and_check_the_threshold_after_the_last_batch() {
    let (d, keys) = nine_completed_hyperstructures();
    let before = games(d).player_points(3, d.actor);
    configure(d, before + 450000);
    assert!(execute(d, Command::CloseSeason, 100));
    assert_eq!(games(d).game(3).end_at, 200);
    assert_eq!(games(d).player_points(3, d.actor), before + 400000);
    assert_eq!(hypers(d).hyperstructure_shares(*keys.at(8)).start_at, 50);
    assert!(execute(d, Command::CloseSeason, 110));
    assert_eq!(games(d).game(3).end_at, 110);
    assert_eq!(games(d).player_points(3, d.actor), before + 450000);
    assert_eq!(hypers(d).hyperstructure_shares(*keys.at(8)).start_at, 100);
}

#[test]
fn a_share_change_past_the_attempt_cutoff_is_not_checkpointed_backwards() {
    let (d, keys) = nine_completed_hyperstructures();
    let before = games(d).player_points(3, d.actor);
    configure(d, before + 460000);
    assert!(execute(d, Command::CloseSeason, 100));
    assert!(
        execute(
            d,
            Command::AllocateHyperstructureShares(
                crate::hyperstructures::AllocateShares {
                    hyperstructure_id: *keys.at(8).entity_id,
                    shareholders: array![crate::hyperstructures::Share { player: d.actor, bps: 10000 }].span(),
                },
            ),
            110,
        ),
    );
    assert_eq!(hypers(d).hyperstructure_shares(*keys.at(8)).start_at, 110);
    assert_eq!(games(d).player_points(3, d.actor), before + 460000);
    assert!(execute(d, Command::CloseSeason, 120));
    assert_eq!(games(d).game(3).end_at, 120);
    assert_eq!(hypers(d).hyperstructure_shares(*keys.at(8)).start_at, 110);
    assert_eq!(games(d).player_points(3, d.actor), before + 460000);
}

#[test]
fn another_player_can_finish_an_attempt_and_is_checked_for_the_win() {
    let (d, _) = nine_completed_hyperstructures();
    let other = super::bind_authority(d);
    configure(d, 1);
    assert!(execute(d, Command::CloseSeason, 100));
    assert!(execute(other, Command::CloseSeason, 110));
    assert_eq!(games(d).game(3).end_at, 200);
    assert_eq!(games(d).player_points(3, other.actor), 0);
    // The unsuccessful attempt ended: this call starts a new cutoff at 120.
    assert!(execute(d, Command::CloseSeason, 120));
    assert!(execute(d, Command::CloseSeason, 130));
    assert_eq!(games(d).game(3).end_at, 130);
}

#[test]
fn ended_game_checkpoints_are_bounded_and_stop_at_the_game_end() {
    let (d, keys) = nine_completed_hyperstructures();
    let before = games(d).player_points(3, d.actor);
    snforge_std::start_cheat_block_timestamp_global(1000);
    assert!(!final_checkpoint(d));
    assert_eq!(games(d).player_points(3, d.actor), before + 8 * 150000);
    assert_eq!(hypers(d).hyperstructure_shares(*keys.at(8)).start_at, 50);
    assert!(final_checkpoint(d));
    assert_eq!(games(d).player_points(3, d.actor), before + 9 * 150000);
    assert_eq!(hypers(d).hyperstructure_shares(*keys.at(8)).start_at, 200);
    assert!(final_checkpoint(d));
    assert_eq!(games(d).player_points(3, d.actor), before + 9 * 150000);
}

fn final_checkpoint(d: super::Deployment) -> bool {
    snforge_std::cheat_caller_address(d.peers.season, d.peers.prizes, snforge_std::CheatSpan::TargetCalls(1));
    crate::blitz_prizes::IPrizeSeasonDispatcherTrait::checkpoint_prize_points(
        crate::blitz_prizes::IPrizeSeasonDispatcher { contract_address: d.peers.season }, 3, 1000,
    )
}

#[test]
fn game_finalization_waits_for_the_last_hyperstructure_checkpoint_batch() {
    let (deployment, keys) = nine_completed_hyperstructures();
    let deployment = super::bind_authority(deployment);
    let game = games(deployment).game(3);
    let timestamp = game.end_at + game.end_grace_seconds.into() + 1;
    assert!(execute(deployment, Command::MarkGameSettled, timestamp));
    assert!(!games(deployment).game(3).settled);
    assert_eq!(hypers(deployment).hyperstructure_shares(*keys.at(7)).start_at, game.end_at);
    assert_eq!(hypers(deployment).hyperstructure_shares(*keys.at(8)).start_at, 50);
    assert!(execute(deployment, Command::MarkGameSettled, timestamp + 1));
    assert!(games(deployment).game(3).settled);
    assert_eq!(hypers(deployment).hyperstructure_shares(*keys.at(8)).start_at, game.end_at);
}

#[test]
fn checkpoint_member_event_uses_the_declared_short_string_identity() {
    let (deployment, hyper, home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(deployment, hyper, home);
    configure(deployment, 1);
    let mut events = snforge_std::spy_events();
    assert!(execute(deployment, Command::CloseSeason, 100));
    let mut found = false;
    for (_, event) in events.get_events().emitted_by(deployment.peers.economy).events.span() {
        if event.keys.len() == 5
            && *event.keys.at(1) == selector!("RowMemberSet")
            && *event.keys.at(3) == 'HyperstructureShares' {
            assert_eq!(*event.keys.at(4), 'start_at');
            assert_eq!(event.data.span(), array![2, 3, hyper.entity_id.into(), 1, 100].span());
            found = true;
        }
    }
    assert!(found);
}
