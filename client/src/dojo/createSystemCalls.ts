import { Components, Schema, setComponent } from "@dojoengine/recs";
import { SetupNetworkResult } from "./setupNetwork";

import { getEntityIdFromKeys } from "../utils/utils";
import {
  DisassembleCaravanAndReturnFreeUnitsProps,
  SwapBankAndTravelBackProps,
  AcceptOrderProps,
  AttachCaravanProps,
  BuildLaborProps,
  CancelFungibleOrderProps,
  CreateCaravanProps,
  CreateFreeTransportUnitProps,
  CreateOrderProps,
  CreateRealmProps,
  CreateRoadProps,
  FeedHyperstructureAndTravelBackPropos,
  HarvestLaborProps,
  HarvestAllLaborProps,
  PurchaseLaborProps,
  SendResourcesToLocationProps,
  TransferResourcesProps,
  TravelProps,
  TransferItemsProps,
  CreateSoldiersProps,
  DetachSoldiersProps,
  AttackProps,
  StealProps,
  LevelUpRealmProps,
  ControlHyperstructureProps,
  CompleteHyperstructureProps,
  SetAddressNameProps,
  MergeSoldiersProps,
  CreateAndMergeSoldiersProps,
  HealSoldiersProps,
  CreateMultipleRealmsProps,
  TransferItemsFromMultipleProps,
  CreateLaborBuildingProps,
  DestroyLaborBuildingProps,
  ExploreProps,
  TravelHexProps,
  CreateBuildingProps,
  DestroyBuildingProps,
} from "@bibliothecadao/eternum";

export type SystemCalls = ReturnType<typeof createSystemCalls>;

// NOTE: need to add waitForTransaction when connected to rinnigan
export function createSystemCalls({ provider }: SetupNetworkResult) {
  const purchase_labor = async (props: PurchaseLaborProps) => {
    await provider.purchase_labor(props);
  };

  const uuid = async () => {
    return provider.uuid();
  };

  // Refactor the functions using the interfaces
  const build_labor = async (props: BuildLaborProps) => {
    await provider.build_labor(props);
  };

  const harvest_labor = async (props: HarvestLaborProps) => {
    await provider.harvest_labor(props);
  };

  const harvest_all_labor = async (props: HarvestAllLaborProps) => {
    await provider.harvest_all_labor(props);
  };

  const create_order = async (props: CreateOrderProps) => {
    await provider.create_order(props);
  };

  const accept_order = async (props: AcceptOrderProps) => {
    await provider.accept_order(props);
  };

  const cancel_fungible_order = async (props: CancelFungibleOrderProps) => {
    await provider.cancel_fungible_order(props);
  };

  const create_free_transport_unit = async (props: CreateFreeTransportUnitProps) => {
    await provider.create_free_transport_unit(props);
  };

  const create_caravan = async (props: CreateCaravanProps) => {
    await provider.create_caravan(props);
  };

  const disassemble_caravan_and_return_free_units = async (props: DisassembleCaravanAndReturnFreeUnitsProps) => {
    await provider.disassemble_caravan_and_return_free_units(props);
  };

  const attach_caravan = async (props: AttachCaravanProps) => {
    await provider.attach_caravan(props);
  };

  const purchase_and_build_labor = async (props: PurchaseLaborProps & BuildLaborProps) => {
    await provider.purchase_and_build_labor(props);
  };

  const create_realm = async (props: CreateRealmProps) => {
    await provider.create_realm(props);
  };

  const create_multiple_realms = async (props: CreateMultipleRealmsProps) => {
    await provider.create_multiple_realms(props);
  };

  const create_road = async (props: CreateRoadProps) => {
    await provider.create_road(props);
  };

  const transfer_resources = async (props: TransferResourcesProps) => {
    await provider.transfer_resources(props);
  };

  const feed_hyperstructure_and_travel_back = async (props: FeedHyperstructureAndTravelBackPropos) => {
    await provider.feed_hyperstructure_and_travel_back(props);
  };

  const send_resources_to_location = async (props: SendResourcesToLocationProps) => {
    await provider.send_resources_to_location(props);
  };

  const travel = async (props: TravelProps) => {
    await provider.travel(props);
  };

  const travel_hex = async (props: TravelHexProps) => {
    await provider.travel_hex(props);
  };

  const create_soldiers = async (props: CreateSoldiersProps) => {
    await provider.create_soldiers(props);
  };

  const attack = async (props: AttackProps) => {
    await provider.attack(props);
  };

  const steal = async (props: StealProps) => {
    await provider.steal(props);
  };

  const detach_soldiers = async (props: DetachSoldiersProps) => {
    await provider.detach_soldiers(props);
  };

  const level_up_realm = async (props: LevelUpRealmProps) => {
    await provider.level_up_realm(props);
  };

  const control_hyperstructure = async (props: ControlHyperstructureProps) => {
    await provider.control_hyperstructure(props);
  };

  const complete_hyperstructure = async (props: CompleteHyperstructureProps) => {
    await provider.complete_hyperstructure(props);
  };

  const set_address_name = async (props: SetAddressNameProps) => {
    await provider.set_address_name(props);
  };

  const merge_soldiers = async (props: MergeSoldiersProps) => {
    await provider.merge_soldiers(props);
  };

  const create_and_merge_soldiers = async (props: CreateAndMergeSoldiersProps) => {
    await provider.create_and_merge_soldiers(props);
  };

  const heal_soldiers = async (props: HealSoldiersProps) => {
    await provider.heal_soldiers(props);
  };

  const swap_bank_and_travel_back = async (props: SwapBankAndTravelBackProps) => {
    await provider.swap_bank_and_travel_back(props);
  };

  const transfer_items = async (props: TransferItemsProps) => {
    await provider.transfer_items(props);
  };

  const transfer_items_from_multiple = async (props: TransferItemsFromMultipleProps) => {
    await provider.transfer_items_from_multiple(props);
  };

  const create_labor_building = async (props: CreateLaborBuildingProps) => {
    await provider.create_labor_building(props);
  };

  const destroy_labor_building = async (props: DestroyLaborBuildingProps) => {
    await provider.destroy_labor_building(props);
  };

  const explore = async (props: ExploreProps) => {
    await provider.explore(props);
  };

  const create_building = async (props: CreateBuildingProps) => {
    await provider.create_building(props);
  };

  const destroy_building = async (props: DestroyBuildingProps) => {
    await provider.destroy_building(props);
  };

  const isLive = async () => {
    try {
      await provider.uuid();
      return true;
    } catch {
      return false;
    }
  };

  return {
    explore,
    create_labor_building,
    destroy_labor_building,
    control_hyperstructure,
    complete_hyperstructure,
    disassemble_caravan_and_return_free_units,
    swap_bank_and_travel_back,
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
}

export function getEvents(receipt: any): any[] {
  return receipt.events.filter((event: any) => {
    return event.keys.length === 1 && event.keys[0] === import.meta.env.VITE_EVENT_KEY;
  });
}
