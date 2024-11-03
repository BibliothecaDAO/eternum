import type * as SystemProps from "@bibliothecadao/eternum";
import { toast } from "react-toastify";
import { type SetupNetworkResult } from "./setupNetwork";

class PromiseQueue {
  private readonly queue: Array<() => Promise<any>> = [];
  private processing = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error("Error processing task:", error);
        }
      }
    }

    this.processing = false;
  }
}

type SystemCallFunctions = ReturnType<typeof createSystemCalls>;
type SystemCallFunction = (...args: any[]) => any;
type WrappedSystemCalls = Record<string, SystemCallFunction>;

const withErrorHandling =
  (fn: any) =>
  async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error: any) {
      toast(error.message);
    }
  };

export function createSystemCalls({ provider }: SetupNetworkResult) {
  const promiseQueue = new PromiseQueue();

  const withQueueing = <T extends (...args: any[]) => Promise<any>>(fn: T) => {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      return await promiseQueue.enqueue(async () => await fn(...args));
    };
  };

  const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(fn: T) => {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      try {
        return await fn(...args);
      } catch (error: any) {
        let errorMessage = error.message;

        if (error.message.includes("Failure reason:")) {
          const match = error.message.match(/Failure reason: \\"(.*?)"/);
          if (match?.[1]) {
            errorMessage = match[1].slice(0, -1);
          } else {
            const matchOther = error.message.match(/Failure reason: "(.*?)"/);
            if (matchOther?.[1]) {
              errorMessage = matchOther[1].slice(0, -1);
            } else {
              const matchHex = error.message.match(/Failure reason: (0x[0-9a-f]+) \('(.*)'\)/);
              if (matchHex?.[2]) {
                errorMessage = matchHex[2];
              }
            }
          }
        }
        toast(errorMessage);
        throw error;
      }
    };
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

  const create_realm = async (props: SystemProps.CreateRealmProps) => {
    await provider.create_realm(props);
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

  const travel = async (props: SystemProps.TravelProps) => {
    await provider.travel(props);
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

  const set_co_owners = async (props: SystemProps.SetCoOwnersProps) => {
    await provider.set_co_owners(props);
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

  const leave_guild = async (props: SystemProps.LeaveGuild) => {
    await provider.leave_guild(props);
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
    send_resources: withQueueing(withErrorHandling(send_resources)),
    send_resources_multiple: withQueueing(withErrorHandling(send_resources_multiple)),
    pickup_resources: withQueueing(withErrorHandling(pickup_resources)),
    remove_liquidity: withQueueing(withErrorHandling(remove_liquidity)),
    add_liquidity: withQueueing(withErrorHandling(add_liquidity)),
    sell_resources: withQueueing(withErrorHandling(sell_resources)),
    buy_resources: withQueueing(withErrorHandling(buy_resources)),
    change_bank_owner_fee: withQueueing(withErrorHandling(change_bank_owner_fee)),
    open_account: withQueueing(withErrorHandling(open_account)),
    create_bank: withQueueing(withErrorHandling(create_bank)),
    explore: withQueueing(withErrorHandling(explore)),
    set_address_name: withQueueing(withErrorHandling(set_address_name)),
    set_entity_name: withQueueing(withErrorHandling(set_entity_name)),
    isLive: withQueueing(withErrorHandling(isLive)),
    create_order: withQueueing(withErrorHandling(create_order)),
    accept_order: withQueueing(withErrorHandling(accept_order)),
    cancel_order: withQueueing(withErrorHandling(cancel_order)),
    accept_partial_order: withQueueing(withErrorHandling(accept_partial_order)),
    create_realm: withQueueing(withErrorHandling(create_realm)),
    upgrade_realm: withQueueing(withErrorHandling(upgrade_realm)),
    create_multiple_realms: withQueueing(withErrorHandling(create_multiple_realms)),
    transfer_resources: withQueueing(withErrorHandling(transfer_resources)),
    travel: withQueueing(withErrorHandling(travel)),
    travel_hex: withQueueing(withErrorHandling(travel_hex)),
    destroy_building: withQueueing(withErrorHandling(destroy_building)),
    pause_production: withQueueing(withErrorHandling(pause_production)),
    resume_production: withQueueing(withErrorHandling(resume_production)),
    create_building: withQueueing(withErrorHandling(create_building)),
    create_army: withQueueing(withErrorHandling(create_army)),
    delete_army: withQueueing(withErrorHandling(delete_army)),
    uuid: withQueueing(withErrorHandling(uuid)),

    create_hyperstructure: withQueueing(withErrorHandling(create_hyperstructure)),
    contribute_to_construction: withQueueing(withErrorHandling(contribute_to_construction)),
    set_access: withQueueing(withErrorHandling(set_access)),
    set_co_owners: withQueueing(withErrorHandling(set_co_owners)),
    end_game: withQueueing(withErrorHandling(end_game)),

    claim_quest: withQueueing(withErrorHandling(claim_quest)),
    mint_resources: withQueueing(withErrorHandling(mint_resources)),

    army_buy_troops: withQueueing(withErrorHandling(army_buy_troops)),
    army_merge_troops: withQueueing(withErrorHandling(army_merge_troops)),

    create_guild: withQueueing(withErrorHandling(create_guild)),
    join_guild: withQueueing(withErrorHandling(join_guild)),
    whitelist_player: withQueueing(withErrorHandling(whitelist_player)),
    leave_guild: withQueueing(withErrorHandling(leave_guild)),
    transfer_guild_ownership: withQueueing(withErrorHandling(transfer_guild_ownership)),
    remove_guild_member: withQueueing(withErrorHandling(remove_guild_member)),
    disband_guild: withQueueing(withErrorHandling(disband_guild)),
    remove_player_from_whitelist: withQueueing(withErrorHandling(remove_player_from_whitelist)),

    battle_start: withQueueing(withErrorHandling(battle_start)),
    battle_force_start: withQueueing(withErrorHandling(battle_force_start)),
    battle_leave: withQueueing(withErrorHandling(battle_leave)),
    battle_join: withQueueing(withErrorHandling(battle_join)),
    battle_claim: withQueueing(withErrorHandling(battle_claim)),
    battle_pillage: withQueueing(withErrorHandling(battle_pillage)),
    battle_leave_and_claim: withQueueing(withErrorHandling(battle_leave_and_claim)),
    battle_leave_and_pillage: withQueueing(withErrorHandling(battle_leave_and_pillage)),
  };

  // TODO: Fix Type
  const wrappedSystemCalls = Object.fromEntries(
    Object.entries(systemCalls).map(([key, fn]) => [key, withErrorHandling(fn)]),
  );

  return systemCalls;
}
