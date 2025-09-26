import { Call, GetTransactionReceiptResponse } from "starknet";
import * as SystemProps from "../types";

export type SystemCallAuthHandler = {
  onNoAccount?: () => void;
  onError?: (error: Error) => void;
};

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls({ provider, authHandler }: { provider: any; authHandler?: SystemCallAuthHandler }) {
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

  const blitz_realm_obtain_entry_token = async (
    props: SystemProps.BlitzRealmObtainEntryTokenProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.blitz_realm_obtain_entry_token(props);
  };

  const blitz_realm_register = async (
    props: SystemProps.BlitzRealmRegisterProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.blitz_realm_register(props);
  };

  const blitz_realm_make_hyperstructures = async (
    props: SystemProps.BlitzRealmMakeHyperstructuresProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.blitz_realm_make_hyperstructures(props);
  };

  const blitz_realm_create = async (
    props: SystemProps.BlitzRealmCreateProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.blitz_realm_create(props);
  };

  const create_order = async (props: SystemProps.CreateOrderProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.create_order(props);
  };

  const accept_order = async (props: SystemProps.AcceptOrderProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.accept_order(props);
  };

  const cancel_order = async (props: SystemProps.CancelOrderProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.cancel_order(props);
  };

  const mint_and_settle_test_realm = async (
    props: SystemProps.MintAndSettleTestRealmProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.mint_and_settle_test_realm(props);
  };

  const mint_test_realm = async (props: SystemProps.MintTestRealmProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.mint_test_realm(props);
  };

  const mint_season_passes = async (
    props: SystemProps.MintSeasonPassesProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.mint_season_passes(props);
  };

  const attach_lords = async (props: SystemProps.AttachLordsProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.attach_lords(props);
  };

  const detach_lords = async (props: SystemProps.DetachLordsProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.detach_lords(props);
  };

  const mint_test_lords = async (props: SystemProps.MintTestLordsProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.mint_test_lords(props);
  };

  const bridge_deposit_into_realm = async (
    props: SystemProps.BridgeDepositIntoRealmProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.bridge_deposit_into_realm(props);
  };

  const bridge_withdraw_from_realm = async (
    props: SystemProps.BridgeWithdrawFromRealmProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.bridge_withdraw_from_realm(props);
  };

  const upgrade_realm = async (props: SystemProps.UpgradeRealmProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.upgrade_realm(props);
  };

  const create_multiple_realms = async (
    props: SystemProps.CreateMultipleRealmsProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.create_multiple_realms(props);
  };

  const send_resources = async (props: SystemProps.SendResourcesProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.send_resources(props);
  };

  const send_resources_multiple = async (
    props: SystemProps.SendResourcesMultipleProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.send_resources_multiple(props);
  };

  const pickup_resources = async (props: SystemProps.PickupResourcesProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.pickup_resources(props);
  };

  const arrivals_offload = async (props: SystemProps.ArrivalsOffloadProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.arrivals_offload(props);
  };

  const set_address_name = async (props: SystemProps.SetAddressNameProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.set_address_name(props);
  };

  const set_entity_name = async (props: SystemProps.SetEntityNameProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.set_entity_name(props);
  };

  const create_building = async (props: SystemProps.CreateBuildingProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.create_building(props);
  };

  const destroy_building = async (props: SystemProps.DestroyBuildingProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.destroy_building(props);
  };

  const pause_production = async (props: SystemProps.PauseProductionProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.pause_production(props);
  };

  const resume_production = async (
    props: SystemProps.ResumeProductionProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.resume_production(props);
  };

  const change_bank_owner_fee = async (
    props: SystemProps.ChangeBankOwnerFeeProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.change_bank_owner_fee(props);
  };

  const buy_resources = async (props: SystemProps.BuyResourcesProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.buy_resources(props);
  };

  const sell_resources = async (props: SystemProps.SellResourcesProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.sell_resources(props);
  };

  const add_liquidity = async (props: SystemProps.AddLiquidityProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.add_liquidity(props);
  };

  const remove_liquidity = async (props: SystemProps.RemoveLiquidityProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.remove_liquidity(props);
  };

  const mint_resources = async (props: SystemProps.MintResourcesProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.mint_resources(props);
  };

  const initialize_hyperstructure = async (
    props: SystemProps.InitializeHyperstructureProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.initialize(props);
  };

  const allocate_shares = async (props: SystemProps.SetCoOwnersProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.allocate_shares(props);
  };

  const contribute_to_construction = async (
    props: SystemProps.ContributeToConstructionProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.contribute_to_construction(props);
  };

  const set_access = async (props: SystemProps.SetAccessProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.set_access(props);
  };

  const end_game = async (props: SystemProps.EndGameProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.end_game(props);
  };

  const create_guild = async (props: SystemProps.CreateGuildProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.create_guild(props);
  };

  const join_guild = async (props: SystemProps.JoinGuildProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.join_guild(props);
  };

  const update_whitelist = async (props: SystemProps.UpdateWhitelist): Promise<GetTransactionReceiptResponse> => {
    return await provider.update_whitelist(props);
  };

  const claim_construction_points = async (
    props: SystemProps.ClaimConstructionPointsProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.claim_construction_points(props);
  };

  const claim_share_points = async (
    props: SystemProps.ClaimSharePointsProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.claim_share_points(props);
  };

  const season_prize_claim = async (
    props: SystemProps.ClaimLeaderboardRewardsProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.season_prize_claim(props);
  };

  const blitz_prize_player_rank = async (
    props: SystemProps.BlitzPrizePlayerRankProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.blitz_prize_player_rank(props);
  };

  const blitz_prize_claim = async (props: SystemProps.BlitzPrizeClaimProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.blitz_prize_claim(props);
  };

  const blitz_prize_claim_no_game = async (
    props: SystemProps.BlitzPrizeClaimNoGameProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.blitz_prize_claim_no_game(props);
  };

  const remove_guild_member = async (props: SystemProps.RemoveGuildMember): Promise<GetTransactionReceiptResponse> => {
    return await provider.remove_guild_member(props);
  };

  const disband_guild = async (props: SystemProps.DisbandGuild): Promise<GetTransactionReceiptResponse> => {
    return await provider.disband_guild(props);
  };

  const isLive = async () => {
    try {
      await provider.uuid();
      return true;
    } catch {
      return false;
    }
  };

  const burn_resource_for_labor_production = async (
    props: SystemProps.BurnOtherResourcesForLaborProductionProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.burn_resource_for_labor_production(props);
  };

  const burn_labor_for_resource_production = async (
    props: SystemProps.BurnLaborResourcesForOtherProductionProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.burn_labor_for_resource_production(props);
  };

  const burn_resource_for_resource_production = async (
    props: SystemProps.BurnOtherPredefinedResourcesForResourcesProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.burn_resource_for_resource_production(props);
  };

  const guard_add = async (props: SystemProps.GuardAddProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.guard_add(props);
  };

  const guard_delete = async (props: SystemProps.GuardDeleteProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.guard_delete(props);
  };

  const explorer_create = async (props: SystemProps.ExplorerCreateProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.explorer_create(props);
  };

  const explorer_add = async (props: SystemProps.ExplorerAddProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.explorer_add(props);
  };

  const explorer_delete = async (props: SystemProps.ExplorerDeleteProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.explorer_delete(props);
  };

  const explorer_explorer_swap = async (
    props: SystemProps.ExplorerExplorerSwapProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.explorer_explorer_swap(props);
  };

  const explorer_guard_swap = async (
    props: SystemProps.ExplorerGuardSwapProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.explorer_guard_swap(props);
  };

  const guard_explorer_swap = async (
    props: SystemProps.GuardExplorerSwapProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.guard_explorer_swap(props);
  };

  const explorer_move = async (props: SystemProps.ExplorerMoveProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.explorer_move(props);
  };

  const attack_explorer_vs_explorer = async (
    props: SystemProps.AttackExplorerVsExplorerProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.attack_explorer_vs_explorer(props);
  };

  const attack_explorer_vs_guard = async (
    props: SystemProps.AttackExplorerVsGuardProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.attack_explorer_vs_guard(props);
  };

  const attack_guard_vs_explorer = async (
    props: SystemProps.AttackGuardVsExplorerProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.attack_guard_vs_explorer(props);
  };

  const raid_explorer_vs_guard = async (
    props: SystemProps.RaidExplorerVsGuardProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.raid_explorer_vs_guard(props);
  };

  const troop_troop_adjacent_transfer = async (
    props: SystemProps.TroopTroopAdjacentTransferProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.troop_troop_adjacent_transfer(props);
  };

  const troop_structure_adjacent_transfer = async (
    props: SystemProps.TroopStructureAdjacentTransferProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.troop_structure_adjacent_transfer(props);
  };

  const structure_troop_adjacent_transfer = async (
    props: SystemProps.StructureTroopAdjacentTransferProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.structure_troop_adjacent_transfer(props);
  };

  const create_village = async (props: SystemProps.CreateVillageProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.create_village(props);
  };

  const create_marketplace_orders = async (
    props: SystemProps.CreateMarketplaceOrdersProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.create_marketplace_orders(props);
  };

  const accept_marketplace_order = async (
    props: SystemProps.AcceptMarketplaceOrdersProps,
    approval: Call,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.accept_marketplace_orders(props, approval);
  };

  const cancel_marketplace_order = async (
    props: SystemProps.CancelMarketplaceOrderProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.cancel_marketplace_order(props);
  };

  const edit_marketplace_order = async (
    props: SystemProps.EditMarketplaceOrderProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.edit_marketplace_order(props);
  };

  const leave_guild = async (props: SystemProps.LeaveGuildProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.leave_guild(props);
  };

  const claim_wonder_production_bonus = async (
    props: SystemProps.ClaimWonderProductionBonusProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.claim_wonder_production_bonus(props);
  };

  const start_quest = async (props: SystemProps.StartQuestProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.start_quest(props);
  };

  const claim_reward = async (props: SystemProps.ClaimRewardProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.claim_reward(props);
  };

  const get_game_count = async (props: SystemProps.GetGameCountProps) => {
    return await provider.get_game_count(props);
  };

  const transfer_structure_ownership = async (
    props: SystemProps.TransferStructureOwnershipProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.transfer_structure_ownership(props);
  };

  const transfer_agent_ownership = async (
    props: SystemProps.TransferAgentOwnershipProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.transfer_agent_ownership(props);
  };

  const structure_burn = async (props: SystemProps.StructureBurnProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.structure_burn(props);
  };

  const troop_burn = async (props: SystemProps.TroopBurnProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.troop_burn(props);
  };

  const open_chest = async (props: SystemProps.OpenChestProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.open_chest(props);
  };

  const apply_relic = async (props: SystemProps.ApplyRelicProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.apply_relic(props);
  };

  const systemCalls = {
    blitz_realm_obtain_entry_token: withAuth(blitz_realm_obtain_entry_token),
    blitz_realm_register: withAuth(blitz_realm_register),
    blitz_realm_make_hyperstructures: withAuth(blitz_realm_make_hyperstructures),
    blitz_realm_create: withAuth(blitz_realm_create),

    send_resources: withAuth(send_resources),
    send_resources_multiple: withAuth(send_resources_multiple),
    pickup_resources: withAuth(pickup_resources),
    arrivals_offload: withAuth(arrivals_offload),
    remove_liquidity: withAuth(remove_liquidity),
    add_liquidity: withAuth(add_liquidity),
    sell_resources: withAuth(sell_resources),
    buy_resources: withAuth(buy_resources),
    change_bank_owner_fee: withAuth(change_bank_owner_fee),
    set_address_name: withAuth(set_address_name),
    set_entity_name: withAuth(set_entity_name),
    isLive: isLive,
    create_order: withAuth(create_order),
    accept_order: withAuth(accept_order),
    cancel_order: withAuth(cancel_order),
    upgrade_realm: withAuth(upgrade_realm),
    create_multiple_realms: withAuth(create_multiple_realms),
    create_village: withAuth(create_village),
    destroy_building: withAuth(destroy_building),
    pause_production: withAuth(pause_production),
    resume_production: withAuth(resume_production),
    create_building: withAuth(create_building),
    claim_wonder_production_bonus: withAuth(claim_wonder_production_bonus),

    uuid: uuid,

    initialize_hyperstructure: withAuth(initialize_hyperstructure),
    allocate_shares: withAuth(allocate_shares),
    contribute_to_construction: withAuth(contribute_to_construction),
    set_access: withAuth(set_access),
    end_game: withAuth(end_game),
    claim_construction_points: withAuth(claim_construction_points),
    claim_share_points: withAuth(claim_share_points),
    season_prize_claim: withAuth(season_prize_claim),
    blitz_prize_player_rank: withAuth(blitz_prize_player_rank),
    blitz_prize_claim: withAuth(blitz_prize_claim),
    blitz_prize_claim_no_game: withAuth(blitz_prize_claim_no_game),

    mint_resources: withAuth(mint_resources),

    create_guild: withAuth(create_guild),
    join_guild: withAuth(join_guild),
    update_whitelist: withAuth(update_whitelist),
    remove_guild_member: withAuth(remove_guild_member),
    disband_guild: withAuth(disband_guild),

    mint_test_realm: withAuth(mint_test_realm),
    mint_season_passes: withAuth(mint_season_passes),
    attach_lords: withAuth(attach_lords),
    detach_lords: withAuth(detach_lords),
    mint_test_lords: withAuth(mint_test_lords),
    mint_and_settle_test_realm: withAuth(mint_and_settle_test_realm),
    bridge_deposit_into_realm: withAuth(bridge_deposit_into_realm),
    bridge_withdraw_from_realm: withAuth(bridge_withdraw_from_realm),

    burn_resource_for_labor_production: withAuth(burn_resource_for_labor_production),
    burn_labor_for_resource_production: withAuth(burn_labor_for_resource_production),
    burn_resource_for_resource_production: withAuth(burn_resource_for_resource_production),

    guard_add: withAuth(guard_add),
    guard_delete: withAuth(guard_delete),
    explorer_create: withAuth(explorer_create),
    explorer_add: withAuth(explorer_add),
    explorer_delete: withAuth(explorer_delete),
    explorer_explorer_swap: withAuth(explorer_explorer_swap),
    explorer_guard_swap: withAuth(explorer_guard_swap),
    guard_explorer_swap: withAuth(guard_explorer_swap),
    explorer_move: withAuth(explorer_move),
    attack_explorer_vs_explorer: withAuth(attack_explorer_vs_explorer),
    attack_explorer_vs_guard: withAuth(attack_explorer_vs_guard),
    attack_guard_vs_explorer: withAuth(attack_guard_vs_explorer),
    raid_explorer_vs_guard: withAuth(raid_explorer_vs_guard),

    troop_troop_adjacent_transfer: withAuth(troop_troop_adjacent_transfer),
    troop_structure_adjacent_transfer: withAuth(troop_structure_adjacent_transfer),
    structure_troop_adjacent_transfer: withAuth(structure_troop_adjacent_transfer),

    create_marketplace_orders: withAuth(create_marketplace_orders),
    accept_marketplace_orders: withAuth(accept_marketplace_order),
    cancel_marketplace_order: withAuth(cancel_marketplace_order),
    edit_marketplace_order: withAuth(edit_marketplace_order),

    leave_guild: withAuth(leave_guild),

    start_quest: withAuth(start_quest),
    claim_reward: withAuth(claim_reward),
    get_game_count: withAuth(get_game_count),

    transfer_structure_ownership: withAuth(transfer_structure_ownership),
    transfer_agent_ownership: withAuth(transfer_agent_ownership),
    structure_burn: withAuth(structure_burn),
    troop_burn: withAuth(troop_burn),
    open_chest: withAuth(open_chest),
    apply_relic: withAuth(apply_relic),
  };

  return systemCalls;
}
