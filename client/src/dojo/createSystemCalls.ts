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
  const purchase_labor = async (props: SystemProps.PurchaseLaborProps) => {
    await provider.purchase_labor(props);
  };

  const uuid = async () => {
    return provider.uuid();
  };

  // Refactor the functions using the interfaces
  const build_labor = async (props: SystemProps.BuildLaborProps) => {
    await provider.build_labor(props);
  };

  const harvest_labor = async (props: SystemProps.HarvestLaborProps) => {
    await provider.harvest_labor(props);
  };

  const harvest_all_labor = async (props: SystemProps.HarvestAllLaborProps) => {
    await provider.harvest_all_labor(props);
  };

  const create_order = async (props: SystemProps.CreateOrderProps) => {
    await provider.create_order(props);
  };

  const accept_order = async (props: SystemProps.AcceptOrderProps) => {
    await provider.accept_order(props);
  };

  const cancel_fungible_order = async (props: SystemProps.CancelFungibleOrderProps) => {
    await provider.cancel_fungible_order(props);
  };

  const create_free_transport_unit = async (props: SystemProps.CreateFreeTransportUnitProps) => {
    await provider.create_free_transport_unit(props);
  };

  const create_caravan = async (props: SystemProps.CreateCaravanProps) => {
    await provider.create_caravan(props);
  };

  const disassemble_caravan_and_return_free_units = async (
    props: SystemProps.DisassembleCaravanAndReturnFreeUnitsProps,
  ) => {
    await provider.disassemble_caravan_and_return_free_units(props);
  };

  const attach_caravan = async (props: SystemProps.AttachCaravanProps) => {
    await provider.attach_caravan(props);
  };

  const purchase_and_build_labor = async (props: SystemProps.PurchaseLaborProps & SystemProps.BuildLaborProps) => {
    await provider.purchase_and_build_labor(props);
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

  const transfer_resources = async (props: SystemProps.TransferResourcesProps) => {
    await provider.transfer_resources(props);
  };

  const feed_hyperstructure_and_travel_back = async (props: SystemProps.FeedHyperstructureAndTravelBackPropos) => {
    await provider.feed_hyperstructure_and_travel_back(props);
  };

  const send_resources_to_location = async (props: SystemProps.SendResourcesToLocationProps) => {
    await provider.send_resources_to_location(props);
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

  const control_hyperstructure = async (props: SystemProps.ControlHyperstructureProps) => {
    await provider.control_hyperstructure(props);
  };

  const complete_hyperstructure = async (props: SystemProps.CompleteHyperstructureProps) => {
    await provider.complete_hyperstructure(props);
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

  const create_labor_building = async (props: SystemProps.CreateLaborBuildingProps) => {
    await provider.create_labor_building(props);
  };

  const destroy_labor_building = async (props: SystemProps.DestroyLaborBuildingProps) => {
    await provider.destroy_labor_building(props);
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

  const isLive = async () => {
    try {
      await provider.uuid();
      return true;
    } catch {
      return false;
    }
  };

  const systemCalls = {
    remove_liquidity,
    add_liquidity,
    sell_resources,
    buy_resources,
    change_bank_owner_fee,
    open_account,
    create_bank,
    explore,
    create_labor_building,
    destroy_labor_building,
    control_hyperstructure,
    complete_hyperstructure,
    disassemble_caravan_and_return_free_units,
    set_address_name,
    create_and_merge_soldiers,
    level_up_realm,
    isLive,
    create_soldiers,
    detach_soldiers,
    attack,
    steal,
    purchase_labor,
    build_labor,
    purchase_and_build_labor,
    harvest_labor,
    harvest_all_labor,
    create_order,
    accept_order,
    cancel_fungible_order,
    transfer_items,
    transfer_items_from_multiple,
    create_free_transport_unit,
    create_caravan,
    attach_caravan,
    create_realm,
    create_multiple_realms,
    create_road,
    transfer_resources,
    send_resources_to_location,
    feed_hyperstructure_and_travel_back,
    travel,
    travel_hex,
    merge_soldiers,
    heal_soldiers,
    destroy_building,
    create_building,
    uuid,
  };

  // TODO: Fix Type
  const wrappedSystemCalls = Object.fromEntries(
    Object.entries(systemCalls).map(([key, fn]) => [key, withErrorHandling(fn)]),
  );

  return systemCalls;
}
