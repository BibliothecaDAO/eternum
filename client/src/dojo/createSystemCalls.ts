import { SetupNetworkResult } from "./setupNetwork";
import { toast } from "react-toastify";
import * as SystemProps from "@bibliothecadao/eternum";

export type SystemCallFunctions = ReturnType<typeof createSystemCalls>;
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
  const uuid = async () => {
    return provider.uuid();
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

  const create_realm = async (props: SystemProps.CreateRealmProps) => {
    await provider.create_realm(props);
  };

  const create_multiple_realms = async (props: SystemProps.CreateMultipleRealmsProps) => {
    await provider.create_multiple_realms(props);
  };

  const create_road = async (props: SystemProps.CreateRoadProps) => {
    await provider.create_road(props);
  };

  const send_resources = async (props: SystemProps.SendResourcesProps) => {
    await provider.send_resources(props);
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

  const level_up_realm = async (props: SystemProps.LevelUpRealmProps) => {
    await provider.level_up_realm(props);
  };

  const set_address_name = async (props: SystemProps.SetAddressNameProps) => {
    await provider.set_address_name(props);
  };

  const set_entity_name = async (props: SystemProps.SetEntityNameProps) => {
    await provider.set_entity_name(props);
  };

  const explore = async (props: SystemProps.ExploreProps) => {
    console.log("explore", props);
    await provider.explore(props);
  };

  const create_building = async (props: SystemProps.CreateBuildingProps) => {
    await provider.create_building(props);
  };

  const destroy_building = async (props: SystemProps.DestroyBuildingProps) => {
    await provider.destroy_building(props);
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

  const army_buy_troops = async (props: SystemProps.ArmyBuyTroopsProps) => {
    await provider.army_buy_troops(props);
  };

  const army_merge_troops = async (props: SystemProps.ArmyMergeTroopsProps) => {
    await provider.army_merge_troops(props);
  };

  const mint_starting_resources = async (props: SystemProps.CreateStartingResources) => {
    await provider.mint_starting_resources(props);
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
    send_resources,
    pickup_resources,
    remove_liquidity,
    add_liquidity,
    sell_resources,
    buy_resources,
    change_bank_owner_fee,
    open_account,
    create_bank,
    explore,
    set_address_name,
    set_entity_name,
    level_up_realm,
    isLive,
    create_order,
    accept_order,
    cancel_order,
    create_realm,
    create_multiple_realms,
    create_road,
    transfer_resources,
    travel,
    travel_hex,
    destroy_building,
    create_building,
    create_army,
    uuid,
    mint_starting_resources,

    army_buy_troops,
    army_merge_troops,
  };

  // TODO: Fix Type
  const wrappedSystemCalls = Object.fromEntries(
    Object.entries(systemCalls).map(([key, fn]) => [key, withErrorHandling(fn)]),
  );

  return systemCalls;
}
