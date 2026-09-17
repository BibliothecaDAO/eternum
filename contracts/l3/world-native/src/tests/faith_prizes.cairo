use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use crate::commands::Command;
use crate::faith::{
    ClaimPlayer, IFaithSettlementSafeDispatcher, IFaithSettlementSafeDispatcherTrait, PlayerFaithKey, Pledge,
};
use crate::faith_prizes::{
    IFaithPrizesDispatcher, IFaithPrizesDispatcherTrait, IFaithPrizesSafeDispatcher, IFaithPrizesSafeDispatcherTrait,
    IPrizeTokenDispatcher, IPrizeTokenDispatcherTrait,
};
use crate::game::{IGameDispatcher, IGameDispatcherTrait};
use crate::resources::ResourceKey;
use super::fixtures::{ITokenFixtureDispatcher, ITokenFixtureDispatcherTrait};
use super::resource_commands::{assert_terminal_rejection, execute, execute_recorded_at};

fn setup() -> (super::Deployment, ResourceKey, ResourceKey, ContractAddress) {
    let (deployment, wonder, realm) = super::faith::setup();
    let (token, _) = super::deploy("BankTokenFixture", @array![deployment.peers.prizes.into()]);
    ITokenFixtureDispatcher { contract_address: token }.seed(deployment.actor, 100000);
    start_cheat_caller_address(deployment.peers.prizes, super::authority());
    view(deployment).configure_faith_reward_token(3, token);
    stop_cheat_caller_address(deployment.peers.prizes);
    (deployment, wonder, realm, token)
}
fn view(deployment: super::Deployment) -> IFaithPrizesDispatcher {
    IFaithPrizesDispatcher { contract_address: deployment.peers.prizes }
}
fn pledge(structure: ResourceKey, wonder: ResourceKey) -> Command {
    Command::PledgeFaith(Pledge { structure_id: structure.entity_id, wonder_id: wonder.entity_id })
}
fn claim(player: ContractAddress, wonder: ResourceKey) -> Command {
    Command::ClaimFaithPrize(ClaimPlayer { player, wonder_id: wonder.entity_id })
}
fn claimed(deployment: super::Deployment, player: ContractAddress, wonder: ResourceKey) -> bool {
    view(deployment).faith_prize_claimed(PlayerFaithKey { game_id: 3, player, wonder_id: wonder.entity_id })
}
fn balance(token: ContractAddress, player: ContractAddress) -> u256 {
    IPrizeTokenDispatcher { contract_address: token }.balance_of(player)
}

#[test]
fn prizes_settle_all_wonders_and_pay_each_players_share_once() {
    let (deployment, wonder, realm, token) = setup();
    let other: ContractAddress = 987.try_into().unwrap();
    assert!(execute(deployment, Command::FundFaithPrizes(95000), 10));
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert!(execute(deployment, pledge(realm, wonder), 50));
    assert!(
        execute(
            deployment,
            Command::TransferStructureOwnership(
                crate::ownership::TransferOwnership { entity_id: realm.entity_id, new_owner: other },
            ),
            60,
        ),
    );
    assert!(execute(deployment, Command::DistributeFaithPrizes, 200));
    assert!(execute(deployment, claim(other, wonder), 201));
    assert_eq!(balance(token, other), 9800);
    assert!(execute(deployment, claim(deployment.actor, wonder), 201));
    assert_eq!(balance(token, deployment.actor), 90200);
    assert_eq!(balance(token, deployment.peers.prizes), 0);
    assert!(claimed(deployment, other, wonder));
    assert_terminal_rejection(deployment, claim(other, wonder), 202);
    assert_eq!(balance(token, other), 9800);
}
#[test]
fn tied_wonders_split_equally_and_rounding_dust_remains_in_the_pool_contract() {
    let (deployment, first, second, token) = setup();
    super::faith::set_wonder(deployment, second, true);
    assert!(execute(deployment, Command::FundFaithPrizes(1001), 30));
    assert!(execute(deployment, pledge(first, first), 40));
    assert!(execute(deployment, pledge(second, second), 40));
    assert!(execute(deployment, Command::DistributeFaithPrizes, 200));
    for wonder in array![first, second] {
        assert!(execute(deployment, claim(deployment.actor, wonder), 201));
    }
    assert_eq!(balance(token, deployment.peers.prizes), 1);
    assert_eq!(balance(token, deployment.actor), 99999);
}
#[test]
fn failed_or_short_funding_rolls_back_token_balances_and_reserved_prizes() {
    let (deployment, _, _, token) = setup();
    let fixture = ITokenFixtureDispatcher { contract_address: token };
    fixture.set_failure(true);
    assert_terminal_rejection(deployment, Command::FundFaithPrizes(1000), 30);
    fixture.set_failure(false);
    fixture.set_transfer_fee(1);
    assert_terminal_rejection(deployment, Command::FundFaithPrizes(1000), 30);
    assert_eq!(view(deployment).faith_prize_pool(3).funded, 0);
    assert_eq!(balance(token, deployment.actor), 100000);
    assert_eq!(balance(token, deployment.peers.prizes), 0);
    fixture.set_transfer_fee(0);
    assert!(execute(deployment, Command::FundFaithPrizes(1000), 30));
    assert_eq!(view(deployment).faith_prize_pool(3).funded, 1000);
}
#[test]
fn failed_prize_transfers_leave_the_claim_available_for_the_next_ticket() {
    let (deployment, wonder, _, token) = setup();
    assert!(execute(deployment, Command::FundFaithPrizes(1000), 30));
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert!(execute(deployment, Command::DistributeFaithPrizes, 200));
    let fixture = ITokenFixtureDispatcher { contract_address: token };
    fixture.set_failure(true);
    assert_terminal_rejection(deployment, claim(deployment.actor, wonder), 201);
    assert!(!claimed(deployment, deployment.actor, wonder));
    assert_eq!(balance(token, deployment.peers.prizes), 1000);
    fixture.set_failure(false);
    assert!(execute(deployment, claim(deployment.actor, wonder), 202));
    assert_eq!(balance(token, deployment.actor), 100000);
}
#[test]
fn distribution_freezes_once_and_zero_point_players_cannot_take_another_players_prize() {
    let (deployment, wonder, realm, token) = setup();
    assert_terminal_rejection(deployment, Command::FundFaithPrizes(0), 30);
    assert!(execute(deployment, Command::FundFaithPrizes(1000), 30));
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert_terminal_rejection(deployment, Command::DistributeFaithPrizes, 199);
    assert_terminal_rejection(deployment, claim(deployment.actor, wonder), 199);
    assert_terminal_rejection(deployment, claim(deployment.actor, wonder), 200);
    assert!(execute(deployment, Command::DistributeFaithPrizes, 200));
    assert_terminal_rejection(deployment, Command::DistributeFaithPrizes, 201);
    assert_terminal_rejection(deployment, Command::FundFaithPrizes(1000), 201);
    assert_terminal_rejection(deployment, claim(deployment.actor, realm), 201);
    let other = 987.try_into().unwrap();
    assert!(execute(deployment, claim(other, wonder), 201));
    assert!(!claimed(deployment, other, wonder));
    assert_eq!(balance(token, other), 0);
    assert_eq!(balance(token, deployment.peers.prizes), 1000);
}
#[test]
fn a_game_without_scoring_wonders_finishes_distribution_without_awards() {
    let (deployment, wonder, _, token) = setup();
    assert!(execute(deployment, Command::FundFaithPrizes(1000), 30));
    assert!(execute(deployment, Command::DistributeFaithPrizes, 200));
    assert!(view(deployment).faith_prize_pool(3).distributed);
    assert_terminal_rejection(deployment, claim(deployment.actor, wonder), 201);
    assert_eq!(balance(token, deployment.peers.prizes), 1000);
}
#[test]
fn delayed_pre_end_funding_executes_at_its_recorded_time_then_settles_normally() {
    let (deployment, wonder, _, token) = setup();
    assert!(execute_recorded_at(deployment, Command::FundFaithPrizes(1000), 30, 5000));
    assert!(execute_recorded_at(deployment, pledge(wonder, wonder), 40, 5000));
    assert!(execute_recorded_at(deployment, Command::DistributeFaithPrizes, 200, 5000));
    assert!(execute_recorded_at(deployment, claim(deployment.actor, wonder), 201, 5000));
    assert_eq!(balance(token, deployment.actor), 100000);
}
#[test]
#[feature("safe_dispatcher")]
fn prize_configuration_and_settlement_reject_foreign_callers_and_keep_games_separate() {
    let (deployment, wonder, _, token) = setup();
    let safe = IFaithPrizesSafeDispatcher { contract_address: deployment.peers.prizes };
    assert!(safe.configure_faith_reward_token(2, token).is_err());
    assert!(safe.fund_faith_prizes(3, deployment.actor, 1000, super::context()).is_err());
    let settlement = IFaithSettlementSafeDispatcher { contract_address: deployment.peers.structures };
    assert!(settlement.settle_faith_wonders(3, 200).is_err());
    assert!(settlement.settle_player_faith(3, deployment.actor, wonder.entity_id, 200).is_err());
    start_cheat_caller_address(deployment.peers.prizes, super::authority());
    assert!(safe.configure_faith_reward_token(3, token).is_err());
    assert!(safe.configure_faith_reward_token(999, token).is_err());
    assert!(safe.configure_faith_reward_token(2, token).is_ok());
    stop_cheat_caller_address(deployment.peers.prizes);
    assert!(execute(deployment, Command::FundFaithPrizes(1000), 30));
    assert_eq!(view(deployment).faith_prize_pool(2).funded, 0);
    assert!(!view(deployment).faith_prize_pool(2).distributed);
}

#[test]
fn sub_token_rewards_remain_unclaimed_without_spending_another_games_funds() {
    let (deployment, wonder, realm, token) = setup();
    let other: ContractAddress = 987.try_into().unwrap();
    let games = IGameDispatcher { contract_address: deployment.peers.season };
    start_cheat_caller_address(deployment.peers.season, super::authority());
    games.create_game(4, games.game(3), games.rules(3));
    stop_cheat_caller_address(deployment.peers.season);
    start_cheat_caller_address(deployment.peers.prizes, super::authority());
    view(deployment).configure_faith_reward_token(4, token);
    start_cheat_caller_address(deployment.peers.prizes, deployment.peers.season);
    start_cheat_block_timestamp_global(100);
    view(deployment).fund_faith_prizes(4, deployment.actor, 600, super::context());
    stop_cheat_caller_address(deployment.peers.prizes);
    assert!(execute(deployment, Command::FundFaithPrizes(1), 30));
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert!(execute(deployment, pledge(realm, wonder), 199));
    assert!(
        execute(
            deployment,
            Command::TransferStructureOwnership(
                crate::ownership::TransferOwnership { entity_id: realm.entity_id, new_owner: other },
            ),
            199,
        ),
    );
    assert!(execute(deployment, Command::DistributeFaithPrizes, 200));
    assert!(execute(deployment, claim(other, wonder), 201));
    assert!(!claimed(deployment, other, wonder));
    assert_eq!(balance(token, other), 0);
    assert_eq!(balance(token, deployment.peers.prizes), 601);
    assert_eq!(view(deployment).faith_prize_pool(4).funded, 600);
    assert!(!view(deployment).faith_prize_pool(4).distributed);
}
#[test]
fn paying_one_games_winner_keeps_another_games_funding_reserved() {
    let (deployment, wonder, _, token) = setup();
    let games = IGameDispatcher { contract_address: deployment.peers.season };
    start_cheat_caller_address(deployment.peers.season, super::authority());
    games.create_game(4, games.game(3), games.rules(3));
    stop_cheat_caller_address(deployment.peers.season);
    start_cheat_caller_address(deployment.peers.prizes, super::authority());
    view(deployment).configure_faith_reward_token(4, token);
    start_cheat_caller_address(deployment.peers.prizes, deployment.peers.season);
    start_cheat_block_timestamp_global(100);
    view(deployment).fund_faith_prizes(4, deployment.actor, 600, super::context());
    stop_cheat_caller_address(deployment.peers.prizes);
    assert!(execute(deployment, Command::FundFaithPrizes(1000), 30));
    assert!(execute(deployment, pledge(wonder, wonder), 40));
    assert!(execute(deployment, Command::DistributeFaithPrizes, 200));
    assert!(execute(deployment, claim(deployment.actor, wonder), 201));
    assert_eq!(balance(token, deployment.peers.prizes), 600);
    assert_eq!(view(deployment).faith_prize_pool(4).funded, 600);
    assert!(!view(deployment).faith_prize_pool(4).distributed);
}

#[test]
fn faith_distribution_checkpoints_bounded_batches_before_any_claim() {
    let (deployment, first, _, token) = setup();
    let structures = crate::structures::IStructuresDispatcher { contract_address: deployment.peers.structures };
    let template = crate::structures::IStructuresDispatcherTrait::structure(structures, first).unwrap();
    assert!(execute(deployment, Command::FundFaithPrizes(9000), 30));
    let mut wonders = array![];
    for id in 100_u32..109 {
        let key = ResourceKey { game_id: 3, entity_id: id };
        super::resource_commands::set_fixture(
            deployment.peers.structures,
            selector!("structures"),
            array![3, id.into()].span(),
            crate::structures::StructureRecord {
                owner: template.owner,
                base: template.base,
                resources_packed: template.resources_packed,
                metadata: template.metadata,
            },
        );
        assert!(execute(deployment, pledge(key, key), 40));
        wonders.append(key);
    }
    assert!(execute(deployment, Command::DistributeFaithPrizes, 200));
    assert!(!view(deployment).faith_prize_pool(3).distributed);
    assert_terminal_rejection(deployment, claim(deployment.actor, *wonders.at(0)), 201);
    let faith = crate::faith::IFaithOwnershipViewsDispatcher { contract_address: deployment.peers.structures };
    assert_eq!(
        crate::faith::IFaithOwnershipViewsDispatcherTrait::wonder_faith(faith, *wonders.at(7)).claimed_points, 80000,
    );
    assert_eq!(
        crate::faith::IFaithOwnershipViewsDispatcherTrait::wonder_faith(faith, *wonders.at(8)).claimed_points, 0,
    );
    assert!(execute(deployment, Command::DistributeFaithPrizes, 300));
    assert!(view(deployment).faith_prize_pool(3).distributed);
    assert_eq!(
        crate::faith::IFaithOwnershipViewsDispatcherTrait::wonder_faith(faith, *wonders.at(8)).claimed_points, 80000,
    );
    assert!(execute(deployment, claim(deployment.actor, *wonders.at(8)), 301));
    assert_eq!(balance(token, deployment.peers.prizes), 8000);
}
