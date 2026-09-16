use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
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
    assert_eq!(game.status, GameStatus::Ended);
    assert_eq!(games(deployment).player_points(3, deployment.actor), before + 50000);
    assert_eq!(hypers(deployment).hyperstructure_shares(hyper).start_at, 100);
    assert_terminal_rejection(deployment, Command::CloseSeason, 101);
    assert!(execute(deployment, Command::CheckpointHyperstructures(array![hyper.entity_id].span()), 500));
    assert_eq!(games(deployment).player_points(3, deployment.actor), before + 50000);
}

#[test]
fn an_insufficient_score_rolls_back_checkpoints_and_a_later_ticket_can_close() {
    let (deployment, hyper, home, _) = super::hyperstructures::setup();
    super::hyperstructures::complete(deployment, hyper, home);
    let before = games(deployment).player_points(3, deployment.actor);
    configure(deployment, before + 50000);
    assert_terminal_rejection(deployment, Command::CloseSeason, 99);
    assert_eq!(games(deployment).player_points(3, deployment.actor), before);
    assert_eq!(hypers(deployment).hyperstructure_shares(hyper).start_at, 50);
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
    assert_eq!(games(delayed).game(3).status, games(immediate).game(3).status);
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
            super::hyperstructures::complete(deployment, second, home);
        }
    }
    let before = games(deployment).player_points(3, deployment.actor);
    configure(deployment, before + 100000);
    assert!(execute(deployment, Command::CloseSeason, 100));
    assert_eq!(games(deployment).player_points(3, deployment.actor), before + 100000);
    assert_eq!(hypers(deployment).hyperstructure_shares(first).start_at, 100);
    assert_eq!(hypers(deployment).hyperstructure_shares(second).start_at, 100);
}
