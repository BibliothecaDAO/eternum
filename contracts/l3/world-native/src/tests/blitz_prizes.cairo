use snforge_std::{
    EventSpyTrait, EventsFilterTrait, spy_events, start_cheat_block_timestamp_global, start_cheat_caller_address,
    stop_cheat_caller_address,
};
use starknet::ContractAddress;
use crate::blitz_prizes::{
    IBlitzPrizesDispatcher, IBlitzPrizesDispatcherTrait, IBlitzPrizesSafeDispatcher, IBlitzPrizesSafeDispatcherTrait,
    IPrizeSeasonSafeDispatcher, IPrizeSeasonSafeDispatcherTrait, RankPlayers,
};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::season::{ISeasonDispatcher, ISeasonDispatcherTrait};
use crate::series_chests::{SeriesRules, allocate, initial_state, tied_chests};
use crate::settlement::{SettlementMode, SettlementProgress, SettlementRules};
use super::resource_commands::{assert_terminal_rejection, set_fixture, setup_with_rules};
fn view(d: super::Deployment) -> IBlitzPrizesDispatcher {
    IBlitzPrizesDispatcher { contract_address: d.peers.prizes }
}
fn games(d: super::Deployment) -> IGameDispatcher {
    IGameDispatcher { contract_address: d.peers.season }
}
fn player(id: u32) -> ContractAddress {
    Into::<u32, felt252>::into(id).try_into().unwrap()
}
fn rules() -> SeriesRules {
    SeriesRules { num_games: 3, total_chests: 1000, cap_ratio_bps: 11000 }
}

fn setup(scores: Span<u128>, series: bool) -> super::Deployment {
    let mut config = super::recorded::rules();
    config.blitz_mode_on = true;
    let (d, _, _) = setup_with_rules(config);
    let d = super::bind_authority(d);
    set_fixture(
        d.peers.settlement,
        selector!("progress"),
        array![3].span(),
        SettlementProgress {
            registered: scores.len().try_into().unwrap(), realm_count: scores.len().try_into().unwrap(),
        },
    );
    set_fixture(
        d.peers.settlement,
        selector!("settlement_rules"),
        array![3].span(),
        Some(
            SettlementRules {
                registration_start: 0,
                registration_limit: 96,
                mode: SettlementMode::Single,
                reward_profile: 1,
                cosmetic_limit: 0,
                cosmetic_collection: player(0),
                cosmetic_timelock: player(0),
            },
        ),
    );
    let mut total = 0_u128;
    for index in 0..scores.len() {
        let account = player(100 + index);
        super::fixtures::IRegistryFixtureDispatcherTrait::add_binding(
            super::fixtures::IRegistryFixtureDispatcher {
                contract_address: ISeasonDispatcher { contract_address: d.peers.season }.authentication().registry,
            },
            account,
            account,
        );
        set_fixture(d.peers.settlement, selector!("entered_players"), array![3, account.into()].span(), true);
        set_fixture(d.peers.season, selector!("player_points"), array![3, account.into()].span(), *scores.at(index));
        total += *scores.at(index);
    }
    set_fixture(d.peers.season, selector!("season_points"), array![3].span(), total);
    if series {
        let mut game = games(d).game(3);
        game.series_id = 'series';
        game.game_number_in_series = 1;
        set_fixture(d.peers.season, selector!("games"), array![3].span(), game);
        start_cheat_caller_address(d.peers.prizes, super::authority());
        view(d).configure_series_chests('series', rules());
    }
    start_cheat_block_timestamp_global(5000);
    start_cheat_caller_address(d.peers.prizes, d.peers.season);
    d
}
#[feature("safe_dispatcher")]
fn rank(d: super::Deployment, ids: Span<u32>, committed: u16, trial_id: u128) -> Result<(), Array<felt252>> {
    let mut players = array![];
    for id in ids {
        players.append(player(*id));
    }
    let season = ISeasonDispatcher { contract_address: d.peers.season };
    let nonce = season.next_nonce(3, d.actor);
    let order = season.execution_head().order;
    let passed = super::resource_commands::execute_recorded_at(
        d,
        crate::commands::Command::RankPlayers(RankPlayers { trial_id, committed, players: players.span() }),
        200,
        5000,
    );
    assert_eq!(season.next_nonce(3, d.actor), nonce + 1);
    assert_eq!(season.execution_head().order, order + 1);
    if passed {
        Ok(())
    } else {
        Err(array![])
    }
}
#[test]
#[feature("safe_dispatcher")]
fn batched_ranking_uses_competition_ties_and_equal_chests_and_finalizes_once() {
    let d = setup(array![600000000, 600000000, 400000000].span(), true);
    assert!(rank(d, array![100].span(), 3, 1).is_ok());
    assert_eq!(games(d).game(3).final_trial_id, 0);
    assert_eq!(view(d).ranking_trial(3).processed, 1);
    assert!(rank(d, array![101, 102].span(), 3, 1).is_ok());
    assert_eq!(games(d).game(3).final_trial_id, 1);
    let first = view(d).player_rank(3, player(100)).unwrap();
    let second = view(d).player_rank(3, player(101)).unwrap();
    assert_eq!(first, second);
    assert_eq!(first.rank, 1);
    assert!(!first.elite);
    assert_eq!(view(d).player_rank(3, player(102)).unwrap().rank, 3);
    assert_eq!(view(d).ranked_players(3, 1), array![player(100), player(101)].span());
    let chests = view(d).game_chests(3).unwrap();
    assert!(chests.allocated > 0 && chests.distributed <= chests.allocated);
    assert_eq!(chests.distributed, first.chests * 2 + view(d).player_rank(3, player(102)).unwrap().chests);
    assert!(rank(d, array![100].span(), 3, 1).is_err());
    let safe = IBlitzPrizesSafeDispatcher { contract_address: d.peers.prizes };
    assert!(safe.reset_ranking(3, super::authority(), super::context()).is_err());
    view(d).allocate_game_chests(3, player(999), crate::commands::ExecutionContext { timestamp: 5000, raw_root: 0 });
    assert_eq!(view(d).game_chests(3).unwrap(), chests);
}
#[test]
#[feature("safe_dispatcher")]
fn invalid_rosters_sort_order_duplicates_and_trial_switches_leave_the_batch_unchanged() {
    let d = setup(array![100, 80, 20].span(), false);
    for id in array![0, 1000] {
        assert!(rank(d, array![100].span(), 3, id).is_err());
    }
    assert!(rank(d, array![].span(), 3, 1).is_err());
    assert!(rank(d, array![100].span(), 2, 1).is_err());
    assert!(rank(d, array![100, 999].span(), 3, 1).is_err());
    assert!(view(d).player_rank(3, player(100)).is_none());
    assert!(rank(d, array![101, 100].span(), 3, 1).is_err());
    assert!(rank(d, array![100, 100].span(), 3, 1).is_err());
    assert_eq!(view(d).ranking_trial(3).processed, 0);
    assert!(rank(d, array![100].span(), 3, 1).is_ok());
    assert!(rank(d, array![101].span(), 3, 2).is_err());
    assert!(rank(d, array![100].span(), 3, 1).is_err());
    assert_eq!(view(d).ranking_trial(3).processed, 1);
    assert!(rank(d, array![101, 102, 999].span(), 3, 1).is_err());
}
#[test]
#[feature("safe_dispatcher")]
fn a_partial_trial_can_be_reset_then_the_complete_roster_ranked() {
    let d = setup(array![100, 80, 20].span(), false);
    assert!(rank(d, array![100, 101].span(), 3, 1).is_ok());
    view(d).reset_ranking(3, super::authority(), super::context());
    assert!(view(d).player_rank(3, player(100)).is_none());
    assert!(view(d).player_rank(3, player(101)).is_none());
    assert_eq!(view(d).ranking_trial(3).trial_id, 0);
    assert!(rank(d, array![100, 101, 102].span(), 3, 2).is_ok());
    assert_eq!(games(d).game(3).final_trial_id, 2);
    assert!(view(d).player_rank(3, player(100)).unwrap().elite);
    assert!(!view(d).player_rank(3, player(101)).unwrap().elite);
    assert_eq!(view(d).game_chests(3).unwrap().allocated, 0);
}
#[test]
#[feature("safe_dispatcher")]
fn a_missing_points_balance_prevents_finalization_and_rolls_back_the_last_batch() {
    let d = setup(array![100, 80].span(), false);
    set_fixture(d.peers.season, selector!("season_points"), array![3].span(), 181_u128);
    assert!(rank(d, array![100].span(), 2, 1).is_ok());
    assert!(rank(d, array![101].span(), 2, 1).is_err());
    assert!(view(d).player_rank(3, player(101)).is_none());
    assert_eq!(view(d).ranking_trial(3).processed, 1);
    assert_eq!(games(d).game(3).final_trial_id, 0);
}
#[test]
#[feature("safe_dispatcher")]
fn ranking_requires_authenticated_authority_and_a_closed_game() {
    let d = setup(array![100].span(), false);
    let safe = IBlitzPrizesSafeDispatcher { contract_address: d.peers.prizes };
    let command = RankPlayers { trial_id: 1, committed: 1, players: array![player(100)].span() };
    assert!(safe.rank_players(3, player(999), command, super::context()).is_err());
    assert!(safe.rank_players(3, super::authority(), command, super::context()).is_err());
    stop_cheat_caller_address(d.peers.prizes);
    assert!(
        safe
            .rank_players(
                3, super::authority(), command, crate::commands::ExecutionContext { timestamp: 200, raw_root: 0 },
            )
            .is_err(),
    );
    let season = IPrizeSeasonSafeDispatcher { contract_address: d.peers.season };
    assert!(season.finalize_ranking(3, 1).is_err());
    assert!(season.checkpoint_prize_points(3, 200).is_err());
    assert_terminal_rejection(d, crate::commands::Command::RankPlayers(RankPlayers { trial_id: 0, ..command }), 200);
    assert_eq!(view(d).ranking_trial(3).processed, 0);
}
#[test]
#[feature("safe_dispatcher")]
fn series_allocation_is_ordered_immutable_and_skips_games_with_fewer_than_two_players() {
    let d = setup(array![100].span(), true);
    view(d).allocate_game_chests(3, player(999), super::context());
    assert_eq!(view(d).game_chests(3).unwrap().allocated, 0);
    let state = view(d).series_chest_state('series');
    assert_eq!(state.game_index, 1);
    assert_eq!(state.soft_supply, 1000);
    assert_eq!(state.recent_count, 0);
    view(d).allocate_game_chests(3, player(999), super::context());
    assert_eq!(view(d).series_chest_state('series'), state);
    let safe = IBlitzPrizesSafeDispatcher { contract_address: d.peers.prizes };
    assert!(safe.configure_series_chests('other', rules()).is_err());
    start_cheat_caller_address(d.peers.prizes, super::authority());
    assert!(safe.configure_series_chests('series', rules()).is_err());
    assert!(safe.configure_series_chests('bad', SeriesRules { cap_ratio_bps: 9999, ..rules() }).is_err());
    assert!(safe.configure_series_chests('bad', SeriesRules { num_games: 0, ..rules() }).is_err());
    assert!(safe.configure_series_chests('bad', SeriesRules { total_chests: 65536, ..rules() }).is_err());
}
#[test]
#[feature("safe_dispatcher")]
fn an_out_of_order_series_game_cannot_finalize_or_consume_chests() {
    let d = setup(array![100, 50].span(), true);
    let mut game = games(d).game(3);
    game.game_number_in_series = 2;
    set_fixture(d.peers.season, selector!("games"), array![3].span(), game);
    assert!(rank(d, array![100, 101].span(), 2, 1).is_err());
    assert_eq!(view(d).ranking_trial(3).processed, 0);
    assert_eq!(view(d).series_chest_state('series').game_index, 0);
    assert!(view(d).game_chests(3).is_none());
}
#[test]
fn tied_awards_reserve_the_whole_group_and_zero_points_receive_nothing() {
    let mut remaining = 11;
    assert_eq!(tied_chests(500000000, 1000000000, 11, 2, ref remaining), 5);
    assert_eq!(remaining, 0);
    let mut remaining = 20;
    assert_eq!(tied_chests(600000000, 1000000000, 20, 1, ref remaining), 13);
    assert_eq!(tied_chests(400000000, 1000000000, 20, 1, ref remaining), 7);
    let mut remaining = 10;
    assert_eq!(tied_chests(0, 0, 10, 2, ref remaining), 0);
    assert_eq!(remaining, 10);
}
#[test]
fn chest_forecast_keeps_rolling_windows_and_never_exceeds_series_cap() {
    let config = SeriesRules { num_games: 10, total_chests: 1000, cap_ratio_bps: 11000 };
    let mut state = initial_state(config);
    let mut total = 0_u32;
    let expected = array![100_u16, 100, 53, 199, 375, 8, 230, 35, 0, 0];
    let mut index = 0;
    for players in array![24_u16, 24, 12, 48, 96, 2, 60, 24, 24, 96] {
        let award = allocate(ref state, config, players);
        assert_eq!(award, *expected.at(index));
        index += 1;
        total += award.into();
        assert!(state.recent_count <= 3 && state.anchor_count <= 2);
        assert!(Into::<u32, u128>::into(total) + state.soft_supply + state.overspend_remaining == 1100);
    }
    assert_eq!(state.game_index, 10);
    assert_eq!(allocate(ref state, config, 96), 0);
    assert!(total <= 1100);
}

#[test]
fn zero_point_players_share_the_last_rank_without_receiving_chests() {
    let d = setup(array![1000000000, 0, 0].span(), true);
    assert!(rank(d, array![100, 101, 102].span(), 3, 1).is_ok());
    let second = view(d).player_rank(3, player(101)).unwrap();
    assert_eq!(second.rank, 2);
    assert_eq!(second.chests, 0);
    assert_eq!(view(d).player_rank(3, player(102)).unwrap(), second);
}
#[test]
fn the_first_ranking_batch_settles_all_share_points_through_recorded_game_end() {
    let (d, hyper, home, _) = super::hyperstructures::setup_mode(true);
    super::hyperstructures::settlement(d, SettlementMode::Duel, 1);
    super::hyperstructures::complete(d, hyper, home);
    let recipient = d.actor;
    let before = games(d).player_points(3, recipient);
    let d = super::bind_authority(d);
    set_fixture(
        d.peers.settlement,
        selector!("progress"),
        array![3].span(),
        SettlementProgress { registered: 1, realm_count: 1 },
    );
    set_fixture(d.peers.settlement, selector!("entered_players"), array![3, recipient.into()].span(), true);
    assert!(
        super::resource_commands::execute_recorded_at(
            d,
            crate::commands::Command::RankPlayers(
                RankPlayers { trial_id: 1, committed: 1, players: array![recipient].span() },
            ),
            200,
            5000,
        ),
    );
    assert_eq!(games(d).player_points(3, recipient), before + 300000);
    assert_eq!(view(d).ranking_trial(3).total_points, before + 300000);
    assert_eq!(games(d).game(3).final_trial_id, 1);
}
#[test]
fn constant_attendance_retains_the_original_rate_and_series_budget() {
    let config = SeriesRules { num_games: 10, total_chests: 1000, cap_ratio_bps: 11000 };
    let mut state = initial_state(config);
    for _ in 0_u32..10 {
        assert_eq!(allocate(ref state, config, 24), 100);
    }
    assert_eq!(state.soft_supply, 0);
    assert_eq!(state.overspend_remaining, 100);
}

#[test]
fn real_prize_recipient_with_missing_operator() {
    assert_prize_recipient(false, false);
}
#[test]
fn real_prize_recipient_with_configured_operator() {
    assert_prize_recipient(false, true);
}
#[test]
fn dev_prize_recipient_with_missing_operator() {
    assert_prize_recipient(true, false);
}
#[test]
fn dev_prize_recipient_with_configured_operator() {
    assert_prize_recipient(true, true);
}
fn assert_prize_recipient(dev: bool, has_operator: bool) {
    let d = setup(array![100].span(), false);
    set_fixture(d.peers.season, selector!("player_points"), array![3, 100].span(), 0_u128);
    set_fixture(d.peers.season, selector!("player_points"), array![3, d.actor.into()].span(), 100_u128);
    set_fixture(d.peers.settlement, selector!("entered_players"), array![3, d.actor.into()].span(), true);
    set_fixture(
        d.peers.season,
        selector!("games"),
        array![3].span(),
        crate::game::GameRegistry { dev_mode_on: dev, ..games(d).game(3) },
    );
    super::entry::set_operator(d, player(if has_operator {
        456
    } else {
        0
    }));
    let mut spy = spy_events();
    assert!(rank(d, array![0x111_u32].span(), 1, 1).is_ok());
    let events = spy.get_events().emitted_by(d.peers.prizes);
    let mut found = false;
    for (_, event) in events.events.span() {
        if event.keys.len() > 1 && *event.keys.at(1) == selector!("StoryEvent") {
            let mut data = event.data.span();
            let story: crate::ownership::Story = Serde::deserialize(ref data).unwrap();
            if let crate::ownership::Story::PrizeResult(result) = story {
                assert_eq!(result.player, d.actor);
                assert_eq!(result.owner, if dev {
                    d.actor
                } else {
                    player(0x444)
                });
                found = true;
            }
        }
    }
    assert!(found, "missing prize result");
}

#[test]
fn large_tie_groups_are_awarded_in_bounded_batches_without_changing_equal_shares() {
    let mut scores = array![];
    let mut ids = array![];
    for index in 0_u32..17 {
        scores.append(600000000_u128);
        ids.append(100 + index);
    }
    let d = setup(scores.span(), true);
    assert!(rank(d, ids.span(), 17, 1).is_ok());
    assert_eq!(games(d).game(3).final_trial_id, 0);
    let reward = view(d).game_chests(3).unwrap().allocated / 17;
    for index in 0_u32..8 {
        assert_eq!(view(d).player_rank(3, player(100 + index)).unwrap().chests, reward);
    }
    assert_eq!(view(d).player_rank(3, player(108)).unwrap().chests, 0);
    assert_eq!(view(d).game_chests(3).unwrap().distributed, reward * 8);
    assert!(rank(d, array![].span(), 17, 1).is_ok());
    assert_eq!(games(d).game(3).final_trial_id, 0);
    assert_eq!(view(d).game_chests(3).unwrap().distributed, reward * 16);
    assert!(rank(d, array![].span(), 17, 1).is_ok());
    assert_eq!(games(d).game(3).final_trial_id, 1);
    assert_eq!(view(d).game_chests(3).unwrap().distributed, reward * 17);
    for index in 0_u32..17 {
        let row = view(d).player_rank(3, player(100 + index)).unwrap();
        assert_eq!(row.rank, 1);
        assert_eq!(row.chests, reward);
        assert!(!row.elite);
    }
}

#[test]
fn ranking_reset_deletes_at_most_one_batch_and_blocks_ranking_until_complete() {
    let mut scores = array![];
    let mut ids = array![];
    for index in 0_u32..18 {
        scores.append(100_u128);
        if index < 17 {
            ids.append(100 + index);
        }
    }
    let d = setup(scores.span(), false);
    assert!(rank(d, ids.span(), 18, 1).is_ok());
    view(d).reset_ranking(3, super::authority(), super::context());
    assert_eq!(view(d).ranking_trial(3).processed, 9);
    assert!(view(d).player_rank(3, player(108)).is_some());
    assert!(view(d).player_rank(3, player(109)).is_none());
    assert!(rank(d, array![117].span(), 18, 1).is_err());
    view(d).reset_ranking(3, super::authority(), super::context());
    assert_eq!(view(d).ranking_trial(3).processed, 1);
    view(d).reset_ranking(3, super::authority(), super::context());
    assert_eq!(view(d).ranking_trial(3).trial_id, 0);
    for index in 0_u32..17 {
        assert!(view(d).player_rank(3, player(100 + index)).is_none());
    }
    assert!(rank(d, array![100].span(), 18, 2).is_ok());
}
