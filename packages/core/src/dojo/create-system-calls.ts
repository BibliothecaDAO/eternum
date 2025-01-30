import type { EternumProvider } from "../provider";
import * as SystemProps from "../types";

export type SystemCallAuthHandler = {
  onNoAccount?: () => void;
  onError?: (error: Error) => void;
};

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls({
  provider,
  authHandler,
}: {
  provider: EternumProvider;
  authHandler?: SystemCallAuthHandler;
}) {
  const withAuth = <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    return (async (...args: Parameters<T>) => {
      try {
        const props = args[0] as SystemProps.SystemSigner;

        // Check for signer specifically
        if (!props?.signer || props?.signer.address === "0x0") {
          authHandler?.onNoAccount?.();
          throw new Error("No account connected");
        }

        return await fn(...args);
      } catch (error) {
        authHandler?.onError?.(error as Error);
        throw error;
      }
    }) as T;
  };

  const uuid = async () => {
    return await provider.uuid();
  };

  const create_order = async (props: SystemProps.CreateOrderProps) => {
    await provider.create_order(props);
  };

  const accept_order = async (props: SystemProps.AcceptOrderProps) => {
    await provider.accept_order(props);
  };

  const accept_partial_order = async (props: SystemProps.AcceptPartialOrderProps) => {
    await provider.accept_partial_order(props);
  };

  const cancel_order = async (props: SystemProps.CancelOrderProps) => {
    await provider.cancel_order(props);
  };

  const mint_test_realm = async (props: SystemProps.MintTestRealmProps) => {
    await provider.mint_test_realm(props);
  };

  const mint_season_passes = async (props: SystemProps.MintSeasonPassesProps) => {
    await provider.mint_season_passes(props);
  };

  const attach_lords = async (props: SystemProps.AttachLordsProps) => {
    await provider.attach_lords(props);
  };

  const detach_lords = async (props: SystemProps.DetachLordsProps) => {
    await provider.detach_lords(props);
  };

  const mint_test_lords = async (props: SystemProps.MintTestLordsProps) => {
    await provider.mint_test_lords(props);
  };

  const bridge_resources_into_realm = async (props: SystemProps.BridgeResourcesIntoRealmProps) => {
    return await provider.bridge_resources_into_realm(props);
  };

  const bridge_start_withdraw_from_realm = async (props: SystemProps.BridgeStartWithdrawFromRealmProps) => {
    return await provider.bridge_start_withdraw_from_realm(props);
  };

  const bridge_finish_withdraw_from_realm = async (props: SystemProps.BridgeFinishWithdrawFromRealmProps) => {
    return await provider.bridge_finish_withdraw_from_realm(props);
  };

  const upgrade_realm = async (props: SystemProps.UpgradeRealmProps) => {
    await provider.upgrade_realm(props);
  };

  const create_multiple_realms = async (props: SystemProps.CreateMultipleRealmsProps) => {
    await provider.create_multiple_realms(props);
  };

  const send_resources = async (props: SystemProps.SendResourcesProps) => {
    await provider.send_resources(props);
  };

  const send_resources_multiple = async (props: SystemProps.SendResourcesMultipleProps) => {
    await provider.send_resources_multiple(props);
  };

  const pickup_resources = async (props: SystemProps.PickupResourcesProps) => {
    await provider.pickup_resources(props);
  };

  const transfer_resources = async (props: SystemProps.TransferResourcesProps) => {
    await provider.transfer_resources(props);
  };

  const travel_hex = async (props: SystemProps.TravelHexProps) => {
    await provider.travel_hex(props);
  };

  const set_address_name = async (props: SystemProps.SetAddressNameProps) => {
    await provider.set_address_name(props);
  };

  const set_entity_name = async (props: SystemProps.SetEntityNameProps) => {
    await provider.set_entity_name(props);
  };

  const explore = async (props: SystemProps.ExploreProps) => {
    await provider.explore(props);
  };

  const create_building = async (props: SystemProps.CreateBuildingProps) => {
    await provider.create_building(props);
  };

  const destroy_building = async (props: SystemProps.DestroyBuildingProps) => {
    await provider.destroy_building(props);
  };

  const pause_production = async (props: SystemProps.PauseProductionProps) => {
    await provider.pause_production(props);
  };

  const resume_production = async (props: SystemProps.ResumeProductionProps) => {
    await provider.resume_production(props);
  };

  const create_bank = async (props: SystemProps.CreateBankProps) => {
    await provider.create_bank(props);
  };

  const open_account = async (props: SystemProps.OpenAccountProps) => {
    await provider.open_account(props);
  };

  const change_bank_owner_fee = async (props: SystemProps.ChangeBankOwnerFeeProps) => {
    await provider.change_bank_owner_fee(props);
  };

  const buy_resources = async (props: SystemProps.BuyResourcesProps) => {
    await provider.buy_resources(props);
  };

  const sell_resources = async (props: SystemProps.SellResourcesProps) => {
    await provider.sell_resources(props);
  };

  const add_liquidity = async (props: SystemProps.AddLiquidityProps) => {
    await provider.add_liquidity(props);
  };

  const remove_liquidity = async (props: SystemProps.RemoveLiquidityProps) => {
    await provider.remove_liquidity(props);
  };

  const create_army = async (props: SystemProps.ArmyCreateProps) => {
    await provider.create_army(props);
  };

  const delete_army = async (props: SystemProps.ArmyDeleteProps) => {
    await provider.delete_army(props);
  };

  const army_buy_troops = async (props: SystemProps.ArmyBuyTroopsProps) => {
    await provider.army_buy_troops(props);
  };

  const army_merge_troops = async (props: SystemProps.ArmyMergeTroopsProps) => {
    await provider.army_merge_troops(props);
  };

  const claim_quest = async (props: SystemProps.ClaimQuestProps) => {
    await provider.claim_quest(props);
  };

  const mint_resources = async (props: SystemProps.MintResourcesProps) => {
    await provider.mint_resources(props);
  };

  const create_hyperstructure = async (props: SystemProps.CreateHyperstructureProps) => {
    await provider.create_hyperstructure(props);
  };

  const contribute_to_construction = async (props: SystemProps.ContributeToConstructionProps) => {
    await provider.contribute_to_construction(props);
  };

  const set_access = async (props: SystemProps.SetAccessProps) => {
    await provider.set_access(props);
  };

  const end_game = async (props: SystemProps.EndGameProps) => {
    await provider.end_game(props);
  };

  const register_to_leaderboard = async (props: SystemProps.RegisterToLeaderboardProps) => {
    await provider.register_to_leaderboard(props);
  };

  const claim_leaderboard_rewards = async (props: SystemProps.ClaimLeaderboardRewardsProps) => {
    await provider.claim_leaderboard_rewards(props);
  };

  const set_co_owners = async (props: SystemProps.SetCoOwnersProps) => {
    await provider.set_co_owners(props);
  };

  const get_points = async (props: SystemProps.GetPointsProps) => {
    return await provider.get_points(props);
  };

  const create_guild = async (props: SystemProps.CreateGuildProps) => {
    await provider.create_guild(props);
  };

  const join_guild = async (props: SystemProps.JoinGuildProps) => {
    await provider.join_guild(props);
  };

  const whitelist_player = async (props: SystemProps.WhitelistPlayerProps) => {
    await provider.whitelist_player(props);
  };

  const transfer_guild_ownership = async (props: SystemProps.TransferGuildOwnership) => {
    await provider.transfer_guild_ownership(props);
  };

  const remove_guild_member = async (props: SystemProps.RemoveGuildMember) => {
    await provider.remove_guild_member(props);
  };

  const disband_guild = async (props: SystemProps.DisbandGuild) => {
    await provider.disband_guild(props);
  };

  const remove_player_from_whitelist = async (props: SystemProps.RemovePlayerFromWhitelist) => {
    await provider.remove_player_from_whitelist(props);
  };

  const battle_start = async (props: SystemProps.BattleStartProps) => {
    await provider.battle_start(props);
  };

  const battle_resolve = async (props: SystemProps.BattleResolveProps) => {
    await provider.battle_resolve(props);
  };

  const battle_force_start = async (props: SystemProps.BattleForceStartProps) => {
    await provider.battle_force_start(props);
  };

  const battle_leave = async (props: SystemProps.BattleLeaveProps) => {
    await provider.battle_leave(props);
  };

  const battle_join = async (props: SystemProps.BattleJoinProps) => {
    await provider.battle_join(props);
  };

  const battle_leave_and_claim = async (props: SystemProps.BattleClaimAndLeaveProps) => {
    await provider.battle_claim_and_leave(props);
  };

  const battle_leave_and_pillage = async (props: SystemProps.BattleLeaveAndRaidProps) => {
    await provider.battle_leave_and_pillage(props);
  };

  const battle_claim = async (props: SystemProps.BattleClaimProps) => {
    await provider.battle_claim(props);
  };

  const battle_pillage = async (props: SystemProps.BattlePillageProps) => {
    await provider.battle_pillage(props);
  };

  const isLive = async () => {
    try {
      await provider.uuid();
      return true;
    } catch {
      return false;
    }
  };

  const systemCalls = {
    send_resources: withAuth(send_resources),
    send_resources_multiple: withAuth(send_resources_multiple),
    pickup_resources: withAuth(pickup_resources),
    remove_liquidity: withAuth(remove_liquidity),
    add_liquidity: withAuth(add_liquidity),
    sell_resources: withAuth(sell_resources),
    buy_resources: withAuth(buy_resources),
    change_bank_owner_fee: withAuth(change_bank_owner_fee),
    open_account: withAuth(open_account),
    create_bank: withAuth(create_bank),
    explore: withAuth(explore),
    set_address_name: withAuth(set_address_name),
    set_entity_name: withAuth(set_entity_name),
    isLive: isLive,
    create_order: withAuth(create_order),
    accept_order: withAuth(accept_order),
    cancel_order: withAuth(cancel_order),
    accept_partial_order: withAuth(accept_partial_order),
    upgrade_realm: withAuth(upgrade_realm),
    create_multiple_realms: withAuth(create_multiple_realms),
    transfer_resources: withAuth(transfer_resources),
    travel_hex: withAuth(travel_hex),
    destroy_building: withAuth(destroy_building),
    pause_production: withAuth(pause_production),
    resume_production: withAuth(resume_production),
    create_building: withAuth(create_building),
    create_army: withAuth(create_army),
    delete_army: withAuth(delete_army),
    uuid: uuid,

    create_hyperstructure: withAuth(create_hyperstructure),
    contribute_to_construction: withAuth(contribute_to_construction),
    set_access: withAuth(set_access),
    set_co_owners: withAuth(set_co_owners),
    get_points: withAuth(get_points),
    end_game: withAuth(end_game),
    register_to_leaderboard: withAuth(register_to_leaderboard),
    claim_leaderboard_rewards: withAuth(claim_leaderboard_rewards),

    claim_quest: withAuth(claim_quest),
    mint_resources: withAuth(mint_resources),

    army_buy_troops: withAuth(army_buy_troops),
    army_merge_troops: withAuth(army_merge_troops),

    create_guild: withAuth(create_guild),
    join_guild: withAuth(join_guild),
    whitelist_player: withAuth(whitelist_player),
    transfer_guild_ownership: withAuth(transfer_guild_ownership),
    remove_guild_member: withAuth(remove_guild_member),
    disband_guild: withAuth(disband_guild),
    remove_player_from_whitelist: withAuth(remove_player_from_whitelist),

    battle_start: withAuth(battle_start),
    battle_force_start: withAuth(battle_force_start),
    battle_resolve: withAuth(battle_resolve),
    battle_leave: withAuth(battle_leave),
    battle_join: withAuth(battle_join),
    battle_claim: withAuth(battle_claim),
    battle_pillage: withAuth(battle_pillage),
    battle_leave_and_claim: withAuth(battle_leave_and_claim),
    battle_leave_and_pillage: withAuth(battle_leave_and_pillage),

    mint_test_realm: withAuth(mint_test_realm),
    mint_season_passes: withAuth(mint_season_passes),
    attach_lords: withAuth(attach_lords),
    detach_lords: withAuth(detach_lords),
    mint_test_lords: withAuth(mint_test_lords),
    bridge_resources_into_realm: withAuth(bridge_resources_into_realm),
    bridge_start_withdraw_from_realm: withAuth(bridge_start_withdraw_from_realm),
    bridge_finish_withdraw_from_realm: withAuth(bridge_finish_withdraw_from_realm),
  };

  return systemCalls;
}
