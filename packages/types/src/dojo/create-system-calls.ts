// import type { EternumProvider } from "../types/provider";
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

  const create_order = async (props: SystemProps.CreateOrderProps) => {
    await provider.create_order(props);
  };

  const accept_order = async (props: SystemProps.AcceptOrderProps) => {
    await provider.accept_order(props);
  };

  const cancel_order = async (props: SystemProps.CancelOrderProps) => {
    await provider.cancel_order(props);
  };

  const mint_and_settle_test_realm = async (props: SystemProps.MintAndSettleTestRealmProps) => {
    await provider.mint_and_settle_test_realm(props);
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

  const bridge_deposit_into_realm = async (props: SystemProps.BridgeDepositIntoRealmProps) => {
    return await provider.bridge_deposit_into_realm(props);
  };

  const bridge_withdraw_from_realm = async (props: SystemProps.BridgeWithdrawFromRealmProps) => {
    return await provider.bridge_withdraw_from_realm(props);
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

  const arrivals_offload = async (props: SystemProps.ArrivalsOffloadProps) => {
    await provider.arrivals_offload(props);
  };

  const set_address_name = async (props: SystemProps.SetAddressNameProps) => {
    await provider.set_address_name(props);
  };

  const set_entity_name = async (props: SystemProps.SetEntityNameProps) => {
    await provider.set_entity_name(props);
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

  const mint_resources = async (props: SystemProps.MintResourcesProps) => {
    await provider.mint_resources(props);
  };

  const initialize_hyperstructure = async (props: SystemProps.InitializeHyperstructureProps) => {
    await provider.initialize(props);
  };

  const allocate_shares = async (props: SystemProps.SetCoOwnersProps) => {
    await provider.allocate_shares(props);
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

  const create_guild = async (props: SystemProps.CreateGuildProps) => {
    await provider.create_guild(props);
  };

  const join_guild = async (props: SystemProps.JoinGuildProps) => {
    await provider.join_guild(props);
  };

  const update_whitelist = async (props: SystemProps.UpdateWhitelist) => {
    await provider.update_whitelist(props);
  };

  const claim_construction_points = async (props: SystemProps.ClaimConstructionPointsProps) => {
    await provider.claim_construction_points(props);
  };

  const claim_share_points = async (props: SystemProps.ClaimSharePointsProps) => {
    await provider.claim_share_points(props);
  };

  const season_prize_claim = async (props: SystemProps.ClaimLeaderboardRewardsProps) => {
    await provider.season_prize_claim(props);
  };

  const remove_guild_member = async (props: SystemProps.RemoveGuildMember) => {
    await provider.remove_guild_member(props);
  };

  const disband_guild = async (props: SystemProps.DisbandGuild) => {
    await provider.disband_guild(props);
  };

  const isLive = async () => {
    try {
      await provider.uuid();
      return true;
    } catch {
      return false;
    }
  };

  const burn_resource_for_labor_production = async (props: SystemProps.BurnOtherResourcesForLaborProductionProps) => {
    await provider.burn_resource_for_labor_production(props);
  };

  const burn_labor_for_resource_production = async (props: SystemProps.BurnLaborResourcesForOtherProductionProps) => {
    await provider.burn_labor_for_resource_production(props);
  };

  const burn_resource_for_resource_production = async (
    props: SystemProps.BurnOtherPredefinedResourcesForResourcesProps,
  ) => {
    await provider.burn_resource_for_resource_production(props);
  };

  const guard_add = async (props: SystemProps.GuardAddProps) => {
    await provider.guard_add(props);
  };

  const guard_delete = async (props: SystemProps.GuardDeleteProps) => {
    await provider.guard_delete(props);
  };

  const explorer_create = async (props: SystemProps.ExplorerCreateProps) => {
    await provider.explorer_create(props);
  };

  const explorer_add = async (props: SystemProps.ExplorerAddProps) => {
    await provider.explorer_add(props);
  };

  const explorer_delete = async (props: SystemProps.ExplorerDeleteProps) => {
    await provider.explorer_delete(props);
  };

  const explorer_explorer_swap = async (props: SystemProps.ExplorerExplorerSwapProps) => {
    await provider.explorer_explorer_swap(props);
  };

  const explorer_guard_swap = async (props: SystemProps.ExplorerGuardSwapProps) => {
    await provider.explorer_guard_swap(props);
  };

  const guard_explorer_swap = async (props: SystemProps.GuardExplorerSwapProps) => {
    await provider.guard_explorer_swap(props);
  };

  const explorer_move = async (props: SystemProps.ExplorerMoveProps) => {
    await provider.explorer_move(props);
  };

  const attack_explorer_vs_explorer = async (props: SystemProps.AttackExplorerVsExplorerProps) => {
    await provider.attack_explorer_vs_explorer(props);
  };

  const attack_explorer_vs_guard = async (props: SystemProps.AttackExplorerVsGuardProps) => {
    await provider.attack_explorer_vs_guard(props);
  };

  const attack_guard_vs_explorer = async (props: SystemProps.AttackGuardVsExplorerProps) => {
    await provider.attack_guard_vs_explorer(props);
  };

  const raid_explorer_vs_guard = async (props: SystemProps.RaidExplorerVsGuardProps) => {
    await provider.raid_explorer_vs_guard(props);
  };

  const troop_troop_adjacent_transfer = async (props: SystemProps.TroopTroopAdjacentTransferProps) => {
    await provider.troop_troop_adjacent_transfer(props);
  };

  const troop_structure_adjacent_transfer = async (props: SystemProps.TroopStructureAdjacentTransferProps) => {
    await provider.troop_structure_adjacent_transfer(props);
  };

  const structure_troop_adjacent_transfer = async (props: SystemProps.StructureTroopAdjacentTransferProps) => {
    await provider.structure_troop_adjacent_transfer(props);
  };

  const create_village = async (props: SystemProps.CreateVillageProps) => {
    await provider.create_village(props);
  };

  const create_marketplace_order = async (props: SystemProps.CreateMarketplaceOrderProps) => {
    await provider.create_marketplace_order(props);
  };

  const accept_marketplace_order = async (props: SystemProps.AcceptMarketplaceOrderProps) => {
    await provider.accept_marketplace_order(props);
  };

  const cancel_marketplace_order = async (props: SystemProps.CancelMarketplaceOrderProps) => {
    await provider.cancel_marketplace_order(props);
  };

  const edit_marketplace_order = async (props: SystemProps.EditMarketplaceOrderProps) => {
    await provider.edit_marketplace_order(props);
  };

  const systemCalls = {
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

    create_marketplace_order: withAuth(create_marketplace_order),
    accept_marketplace_order: withAuth(accept_marketplace_order),
    cancel_marketplace_order: withAuth(cancel_marketplace_order),
    edit_marketplace_order: withAuth(edit_marketplace_order),
  };

  return systemCalls;
}
