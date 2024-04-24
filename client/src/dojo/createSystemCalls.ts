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

  const create_soldiers = async (props: SystemProps.CreateSoldiersProps) => {
    await provider.create_soldiers(props);
  };

  const attack = async (props: SystemProps.AttackProps) => {
    await provider.attack(props);
  };

  const steal = async (props: SystemProps.StealProps) => {
    await provider.steal(props);
  };

  const detach_soldiers = async (props: SystemProps.DetachSoldiersProps) => {
    await provider.detach_soldiers(props);
  };

  const level_up_realm = async (props: SystemProps.LevelUpRealmProps) => {
    await provider.level_up_realm(props);
  };

  const set_address_name = async (props: SystemProps.SetAddressNameProps) => {
    await provider.set_address_name(props);
  };

  const merge_soldiers = async (props: SystemProps.MergeSoldiersProps) => {
    await provider.merge_soldiers(props);
  };

  const create_and_merge_soldiers = async (props: SystemProps.CreateAndMergeSoldiersProps) => {
    await provider.create_and_merge_soldiers(props);
  };

  const heal_soldiers = async (props: SystemProps.HealSoldiersProps) => {
    await provider.heal_soldiers(props);
  };

  const transfer_items = async (props: SystemProps.TransferItemsProps) => {
    await provider.transfer_items(props);
  };

  const transfer_items_from_multiple = async (props: SystemProps.TransferItemsFromMultipleProps) => {
    await provider.transfer_items_from_multiple(props);
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

  const create_army = async (props: SystemProps.CreateArmyProps) => {
    await provider.create_army(props);
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
    create_and_merge_soldiers,
    level_up_realm,
    isLive,
    create_soldiers,
    detach_soldiers,
    attack,
    steal,
    create_order,
    accept_order,
    cancel_order,
    transfer_items,
    transfer_items_from_multiple,
    create_realm,
    create_multiple_realms,
    create_road,
    transfer_resources,
    travel,
    travel_hex,
    merge_soldiers,
    heal_soldiers,
    destroy_building,
    create_building,
    create_army,
    uuid,
  };

  // TODO: Fix Type
  const wrappedSystemCalls = Object.fromEntries(
    Object.entries(systemCalls).map(([key, fn]) => [key, withErrorHandling(fn)]),
  );

  return systemCalls;
}
