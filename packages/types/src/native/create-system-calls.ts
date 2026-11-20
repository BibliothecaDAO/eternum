import { GetTransactionReceiptResponse } from "starknet";
import * as SystemProps from "../types";

export type SystemCallAuthHandler = {
  onNoAccount?: () => void;
  onError?: (error: Error) => void;
  /**
   * Why no action can be sent right now (the game has not opened to play), or null. Every system call asks it before
   * sending, so no entrance acts early; the chain would refuse with "game not started".
   */
  refuseNow?: () => string | null;
};

/** A system call the client did not send, because the game does not accept actions yet; its message is the reason. */
export class ActionRefusedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ActionRefusedError";
  }
}

/** Failures the system call already handed to its error handler, so a caller that tells the player logs nothing more. */
const reportedFailures = new WeakSet<object>();

/** Whether a system call already reported this failure to its error handler (the one that logs it). */
export const wasReported = (error: unknown): boolean =>
  typeof error === "object" && error !== null && reportedFailures.has(error);

export type SystemCalls = ReturnType<typeof createSystemCalls>;

export function createSystemCalls({ provider, authHandler }: { provider: any; authHandler?: SystemCallAuthHandler }) {
  const withAuth = <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
    return (async (...args: Parameters<T>) => {
      // A refusal is the game's state, not a failure: it is thrown to the caller and never reported as an error.
      const refusal = authHandler?.refuseNow?.() ?? null;
      if (refusal !== null) throw new ActionRefusedError(refusal);
      try {
        const props = args[0] as SystemProps.SystemSigner;

        // Check for signer specifically
        if (!props?.signer || props?.signer.address === "0x0") {
          authHandler?.onNoAccount?.();
          throw new Error("No account connected");
        }

        return await fn(...args);
      } catch (error) {
        if (authHandler?.onError && !wasReported(error)) {
          authHandler.onError(error as Error);
          if (typeof error === "object" && error !== null) reportedFailures.add(error);
        }
        throw error;
      }
    }) as T;
  };

  const claim_daily_quest = (props: Parameters<typeof provider.claim_daily_quest>[0]) =>
    provider.claim_daily_quest(props);
  const settle_season = (props: Parameters<typeof provider.settle_season>[0]) => provider.settle_season(props);
  const enter_depth = (props: Parameters<typeof provider.enter_depth>[0]) => provider.enter_depth(props);
  const choose_oath = (props: Parameters<typeof provider.choose_oath>[0]) => provider.choose_oath(props);
  const buy_stamina = (props: Parameters<typeof provider.buy_stamina>[0]) => provider.buy_stamina(props);
  const buy_seal = (props: Parameters<typeof provider.buy_seal>[0]) => provider.buy_seal(props);
  const reroll_oath = (props: Parameters<typeof provider.reroll_oath>[0]) => provider.reroll_oath(props);
  const research = (props: Parameters<typeof provider.research>[0]) => provider.research(props);

  const provision_realm = async (
    props: SystemProps.UpgradeRealmProps & { upgrade?: boolean },
  ): Promise<GetTransactionReceiptResponse> => provider.provision_realm(props);

  const upgrade_realm = async (props: SystemProps.UpgradeRealmProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.upgrade_realm(props);
  };

  const send_resources_multiple = async (
    props: SystemProps.SendResourcesMultipleProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.send_resources_multiple(props);
  };

  const arrivals_offload = async (props: SystemProps.ArrivalsOffloadProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.arrivals_offload(props);
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

  const execute_realm_production_plan = async (
    props: SystemProps.ExecuteRealmProductionPlanProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.execute_realm_production_plan(props);
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

  const remove_guild_member = async (props: SystemProps.RemoveGuildMember): Promise<GetTransactionReceiptResponse> => {
    return await provider.remove_guild_member(props);
  };

  const disband_guild = async (props: SystemProps.DisbandGuild): Promise<GetTransactionReceiptResponse> => {
    return await provider.disband_guild(props);
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

  const toggle_alternate = async (props: SystemProps.ToggleAlternateProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.toggle_alternate(props);
  };

  const explorer_travel = async (props: SystemProps.ExplorerTravelProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.explorer_travel(props);
  };

  const explorer_explore = async (props: SystemProps.ExplorerExploreProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.explorer_explore(props);
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

  const attack_explorer_vs_guard_and_garrison = async (
    props: SystemProps.AttackExplorerVsGuardAndGarrisonProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.attack_explorer_vs_guard_and_garrison(props);
  };

  const attack_guard_vs_explorer = async (
    props: SystemProps.AttackGuardVsExplorerProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.attack_guard_vs_explorer(props);
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

  const receive_army_grant = async (
    props: SystemProps.ReceiveArmyGrantProps,
  ): Promise<GetTransactionReceiptResponse> => {
    return await provider.receive_army_grant(props);
  };

  const leave_guild = async (props: SystemProps.LeaveGuildProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.leave_guild(props);
  };

  const interact_site = (props: SystemProps.InteractSiteProps) => provider.interact_site(props);

  const apply_relic = async (props: SystemProps.ApplyRelicProps): Promise<GetTransactionReceiptResponse> => {
    return await provider.apply_relic(props);
  };

  const systemCalls = {
    send_resources_multiple: withAuth(send_resources_multiple),
    arrivals_offload: withAuth(arrivals_offload),
    set_entity_name: withAuth(set_entity_name),
    upgrade_realm: withAuth(upgrade_realm),
    provision_realm: withAuth(provision_realm),
    receive_army_grant: withAuth(receive_army_grant),
    destroy_building: withAuth(destroy_building),
    pause_production: withAuth(pause_production),
    resume_production: withAuth(resume_production),
    execute_realm_production_plan: withAuth(execute_realm_production_plan),
    create_building: withAuth(create_building),

    create_guild: withAuth(create_guild),
    join_guild: withAuth(join_guild),
    update_whitelist: withAuth(update_whitelist),
    remove_guild_member: withAuth(remove_guild_member),
    disband_guild: withAuth(disband_guild),
    settle_season: withAuth(settle_season),
    claim_daily_quest: withAuth(claim_daily_quest),
    enter_depth: withAuth(enter_depth),
    research: withAuth(research),
    choose_oath: withAuth(choose_oath),
    buy_stamina: withAuth(buy_stamina),
    buy_seal: withAuth(buy_seal),
    reroll_oath: withAuth(reroll_oath),

    burn_resource_for_resource_production: withAuth(burn_resource_for_resource_production),

    guard_add: withAuth(guard_add),
    guard_delete: withAuth(guard_delete),
    explorer_create: withAuth(explorer_create),
    explorer_add: withAuth(explorer_add),
    explorer_delete: withAuth(explorer_delete),
    explorer_explorer_swap: withAuth(explorer_explorer_swap),
    explorer_guard_swap: withAuth(explorer_guard_swap),
    guard_explorer_swap: withAuth(guard_explorer_swap),
    toggle_alternate: withAuth(toggle_alternate),
    explorer_travel: withAuth(explorer_travel),
    explorer_explore: withAuth(explorer_explore),
    attack_explorer_vs_explorer: withAuth(attack_explorer_vs_explorer),
    attack_explorer_vs_guard: withAuth(attack_explorer_vs_guard),
    attack_explorer_vs_guard_and_garrison: withAuth(attack_explorer_vs_guard_and_garrison),
    attack_guard_vs_explorer: withAuth(attack_guard_vs_explorer),

    troop_troop_adjacent_transfer: withAuth(troop_troop_adjacent_transfer),
    troop_structure_adjacent_transfer: withAuth(troop_structure_adjacent_transfer),

    leave_guild: withAuth(leave_guild),

    interact_site: withAuth(interact_site),
    apply_relic: withAuth(apply_relic),
  };

  return systemCalls;
}
