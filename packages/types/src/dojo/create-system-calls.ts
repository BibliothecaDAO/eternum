import { Call, Result } from "starknet";
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

  const blitz_realm_register = async (props: SystemProps.BlitzRealmRegisterProps): Promise<Result> => {
    return await provider.blitz_realm_register(props);
  };

  const blitz_realm_make_hyperstructures = async (
    props: SystemProps.BlitzRealmMakeHyperstructuresProps,
  ): Promise<Result> => {
    return await provider.blitz_realm_make_hyperstructures(props);
  };

  const blitz_realm_create = async (props: SystemProps.BlitzRealmCreateProps): Promise<Result> => {
    return await provider.blitz_realm_create(props);
  };

  const create_order = async (props: SystemProps.CreateOrderProps): Promise<Result> => {
    return await provider.create_order(props);
  };

  const accept_order = async (props: SystemProps.AcceptOrderProps): Promise<Result> => {
    return await provider.accept_order(props);
  };

  const cancel_order = async (props: SystemProps.CancelOrderProps): Promise<Result> => {
    return await provider.cancel_order(props);
  };

  const mint_and_settle_test_realm = async (props: SystemProps.MintAndSettleTestRealmProps): Promise<Result> => {
    return await provider.mint_and_settle_test_realm(props);
  };

  const mint_test_realm = async (props: SystemProps.MintTestRealmProps): Promise<Result> => {
    return await provider.mint_test_realm(props);
  };

  const mint_season_passes = async (props: SystemProps.MintSeasonPassesProps): Promise<Result> => {
    return await provider.mint_season_passes(props);
  };

  const attach_lords = async (props: SystemProps.AttachLordsProps): Promise<Result> => {
    return await provider.attach_lords(props);
  };

  const detach_lords = async (props: SystemProps.DetachLordsProps): Promise<Result> => {
    return await provider.detach_lords(props);
  };

  const mint_test_lords = async (props: SystemProps.MintTestLordsProps): Promise<Result> => {
    return await provider.mint_test_lords(props);
  };

  const bridge_deposit_into_realm = async (props: SystemProps.BridgeDepositIntoRealmProps): Promise<Result> => {
    return await provider.bridge_deposit_into_realm(props);
  };

  const bridge_withdraw_from_realm = async (props: SystemProps.BridgeWithdrawFromRealmProps): Promise<Result> => {
    return await provider.bridge_withdraw_from_realm(props);
  };

  const upgrade_realm = async (props: SystemProps.UpgradeRealmProps): Promise<Result> => {
    return await provider.upgrade_realm(props);
  };

  const create_multiple_realms = async (props: SystemProps.CreateMultipleRealmsProps): Promise<Result> => {
    return await provider.create_multiple_realms(props);
  };

  const send_resources = async (props: SystemProps.SendResourcesProps): Promise<Result> => {
    return await provider.send_resources(props);
  };

  const send_resources_multiple = async (props: SystemProps.SendResourcesMultipleProps): Promise<Result> => {
    return await provider.send_resources_multiple(props);
  };

  const pickup_resources = async (props: SystemProps.PickupResourcesProps): Promise<Result> => {
    return await provider.pickup_resources(props);
  };

  const arrivals_offload = async (props: SystemProps.ArrivalsOffloadProps): Promise<Result> => {
    return await provider.arrivals_offload(props);
  };

  const set_address_name = async (props: SystemProps.SetAddressNameProps): Promise<Result> => {
    return await provider.set_address_name(props);
  };

  const set_entity_name = async (props: SystemProps.SetEntityNameProps): Promise<Result> => {
    return await provider.set_entity_name(props);
  };

  const create_building = async (props: SystemProps.CreateBuildingProps): Promise<Result> => {
    return await provider.create_building(props);
  };

  const destroy_building = async (props: SystemProps.DestroyBuildingProps): Promise<Result> => {
    return await provider.destroy_building(props);
  };

  const pause_production = async (props: SystemProps.PauseProductionProps): Promise<Result> => {
    return await provider.pause_production(props);
  };

  const resume_production = async (props: SystemProps.ResumeProductionProps): Promise<Result> => {
    return await provider.resume_production(props);
  };

  const change_bank_owner_fee = async (props: SystemProps.ChangeBankOwnerFeeProps): Promise<Result> => {
    return await provider.change_bank_owner_fee(props);
  };

  const buy_resources = async (props: SystemProps.BuyResourcesProps): Promise<Result> => {
    return await provider.buy_resources(props);
  };

  const sell_resources = async (props: SystemProps.SellResourcesProps): Promise<Result> => {
    return await provider.sell_resources(props);
  };

  const add_liquidity = async (props: SystemProps.AddLiquidityProps): Promise<Result> => {
    return await provider.add_liquidity(props);
  };

  const remove_liquidity = async (props: SystemProps.RemoveLiquidityProps): Promise<Result> => {
    return await provider.remove_liquidity(props);
  };

  const mint_resources = async (props: SystemProps.MintResourcesProps): Promise<Result> => {
    return await provider.mint_resources(props);
  };

  const initialize_hyperstructure = async (props: SystemProps.InitializeHyperstructureProps): Promise<Result> => {
    return await provider.initialize(props);
  };

  const allocate_shares = async (props: SystemProps.SetCoOwnersProps): Promise<Result> => {
    return await provider.allocate_shares(props);
  };

  const contribute_to_construction = async (props: SystemProps.ContributeToConstructionProps): Promise<Result> => {
    return await provider.contribute_to_construction(props);
  };

  const set_access = async (props: SystemProps.SetAccessProps): Promise<Result> => {
    return await provider.set_access(props);
  };

  const end_game = async (props: SystemProps.EndGameProps): Promise<Result> => {
    return await provider.end_game(props);
  };

  const create_guild = async (props: SystemProps.CreateGuildProps): Promise<Result> => {
    return await provider.create_guild(props);
  };

  const join_guild = async (props: SystemProps.JoinGuildProps): Promise<Result> => {
    return await provider.join_guild(props);
  };

  const update_whitelist = async (props: SystemProps.UpdateWhitelist): Promise<Result> => {
    return await provider.update_whitelist(props);
  };

  const claim_construction_points = async (props: SystemProps.ClaimConstructionPointsProps): Promise<Result> => {
    return await provider.claim_construction_points(props);
  };

  const claim_share_points = async (props: SystemProps.ClaimSharePointsProps): Promise<Result> => {
    return await provider.claim_share_points(props);
  };

  const season_prize_claim = async (props: SystemProps.ClaimLeaderboardRewardsProps): Promise<Result> => {
    return await provider.season_prize_claim(props);
  };

  const remove_guild_member = async (props: SystemProps.RemoveGuildMember): Promise<Result> => {
    return await provider.remove_guild_member(props);
  };

  const disband_guild = async (props: SystemProps.DisbandGuild): Promise<Result> => {
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
  ): Promise<Result> => {
    return await provider.burn_resource_for_labor_production(props);
  };

  const burn_labor_for_resource_production = async (
    props: SystemProps.BurnLaborResourcesForOtherProductionProps,
  ): Promise<Result> => {
    return await provider.burn_labor_for_resource_production(props);
  };

  const burn_resource_for_resource_production = async (
    props: SystemProps.BurnOtherPredefinedResourcesForResourcesProps,
  ): Promise<Result> => {
    return await provider.burn_resource_for_resource_production(props);
  };

  const guard_add = async (props: SystemProps.GuardAddProps): Promise<Result> => {
    return await provider.guard_add(props);
  };

  const guard_delete = async (props: SystemProps.GuardDeleteProps): Promise<Result> => {
    return await provider.guard_delete(props);
  };

  const explorer_create = async (props: SystemProps.ExplorerCreateProps): Promise<Result> => {
    return await provider.explorer_create(props);
  };

  const explorer_add = async (props: SystemProps.ExplorerAddProps): Promise<Result> => {
    return await provider.explorer_add(props);
  };

  const explorer_delete = async (props: SystemProps.ExplorerDeleteProps): Promise<Result> => {
    return await provider.explorer_delete(props);
  };

  const explorer_explorer_swap = async (props: SystemProps.ExplorerExplorerSwapProps): Promise<Result> => {
    return await provider.explorer_explorer_swap(props);
  };

  const explorer_guard_swap = async (props: SystemProps.ExplorerGuardSwapProps): Promise<Result> => {
    return await provider.explorer_guard_swap(props);
  };

  const guard_explorer_swap = async (props: SystemProps.GuardExplorerSwapProps): Promise<Result> => {
    return await provider.guard_explorer_swap(props);
  };

  const explorer_move = async (props: SystemProps.ExplorerMoveProps): Promise<Result> => {
    return await provider.explorer_move(props);
  };

  const attack_explorer_vs_explorer = async (props: SystemProps.AttackExplorerVsExplorerProps): Promise<Result> => {
    return await provider.attack_explorer_vs_explorer(props);
  };

  const attack_explorer_vs_guard = async (props: SystemProps.AttackExplorerVsGuardProps): Promise<Result> => {
    return await provider.attack_explorer_vs_guard(props);
  };

  const attack_guard_vs_explorer = async (props: SystemProps.AttackGuardVsExplorerProps): Promise<Result> => {
    return await provider.attack_guard_vs_explorer(props);
  };

  const raid_explorer_vs_guard = async (props: SystemProps.RaidExplorerVsGuardProps): Promise<Result> => {
    return await provider.raid_explorer_vs_guard(props);
  };

  const troop_troop_adjacent_transfer = async (props: SystemProps.TroopTroopAdjacentTransferProps): Promise<Result> => {
    return await provider.troop_troop_adjacent_transfer(props);
  };

  const troop_structure_adjacent_transfer = async (
    props: SystemProps.TroopStructureAdjacentTransferProps,
  ): Promise<Result> => {
    return await provider.troop_structure_adjacent_transfer(props);
  };

  const structure_troop_adjacent_transfer = async (
    props: SystemProps.StructureTroopAdjacentTransferProps,
  ): Promise<Result> => {
    return await provider.structure_troop_adjacent_transfer(props);
  };

  const create_village = async (props: SystemProps.CreateVillageProps): Promise<Result> => {
    return await provider.create_village(props);
  };

  const create_marketplace_orders = async (props: SystemProps.CreateMarketplaceOrdersProps): Promise<Result> => {
    return await provider.create_marketplace_orders(props);
  };

  const accept_marketplace_order = async (
    props: SystemProps.AcceptMarketplaceOrdersProps,
    approval: Call,
  ): Promise<Result> => {
    return await provider.accept_marketplace_orders(props, approval);
  };

  const cancel_marketplace_order = async (props: SystemProps.CancelMarketplaceOrderProps): Promise<Result> => {
    return await provider.cancel_marketplace_order(props);
  };

  const edit_marketplace_order = async (props: SystemProps.EditMarketplaceOrderProps): Promise<Result> => {
    return await provider.edit_marketplace_order(props);
  };

  const leave_guild = async (props: SystemProps.LeaveGuildProps): Promise<Result> => {
    return await provider.leave_guild(props);
  };

  const claim_wonder_production_bonus = async (props: SystemProps.ClaimWonderProductionBonusProps): Promise<Result> => {
    return await provider.claim_wonder_production_bonus(props);
  };

  const start_quest = async (props: SystemProps.StartQuestProps): Promise<Result> => {
    return await provider.start_quest(props);
  };

  const claim_reward = async (props: SystemProps.ClaimRewardProps): Promise<Result> => {
    return await provider.claim_reward(props);
  };

  const get_game_count = async (props: SystemProps.GetGameCountProps) => {
    return await provider.get_game_count(props);
  };

  const transfer_structure_ownership = async (props: SystemProps.TransferStructureOwnershipProps): Promise<Result> => {
    return await provider.transfer_structure_ownership(props);
  };

  const transfer_agent_ownership = async (props: SystemProps.TransferAgentOwnershipProps): Promise<Result> => {
    return await provider.transfer_agent_ownership(props);
  };

  const structure_burn = async (props: SystemProps.StructureBurnProps): Promise<Result> => {
    return await provider.structure_burn(props);
  };

  const troop_burn = async (props: SystemProps.TroopBurnProps): Promise<Result> => {
    return await provider.troop_burn(props);
  };

  const open_chest = async (props: SystemProps.OpenChestProps): Promise<Result> => {
    return await provider.open_chest(props);
  };

  const apply_relic = async (props: SystemProps.ApplyRelicProps): Promise<Result> => {
    return await provider.apply_relic(props);
  };

  const systemCalls = {
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
