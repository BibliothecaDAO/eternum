import { Components, Schema, setComponent } from "@dojoengine/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Event } from "starknet";
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
} from "@bibliothecadao/eternum";

export type SystemCalls = ReturnType<typeof createSystemCalls>;

// NOTE: need to add waitForTransaction when connected to rinnigan
export function createSystemCalls({ provider, contractComponents }: SetupNetworkResult) {
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
    uuid,
  };
}

export function getEvents(receipt: any): any[] {
  return receipt.events.filter((event: any) => {
    return event.keys.length === 1 && event.keys[0] === import.meta.env.VITE_EVENT_KEY;
  });
}

export function setComponentsFromEvents(components: Components, events: Event[]) {
  events.forEach((event) => setComponentFromEvent(components, event.data));
}

export function setComponentFromEvent(components: Components, eventData: string[]) {
  // retrieve the component name
  const componentName = hexToAscii(eventData[0]);

  // retrieve the component from name
  const component = components[componentName];
  if (!component) return;

  // get keys
  const keysNumber = parseInt(eventData[1]);
  let index = 2 + keysNumber + 1;

  const keys = eventData.slice(2, 2 + keysNumber).map((key) => BigInt(key));

  // get entityIndex from keys
  const entityIndex = getEntityIdFromKeys(keys);

  // get values
  let numberOfValues = parseInt(eventData[index++]);

  // get values
  const valuesFromEventData = eventData.slice(index, index + numberOfValues);

  // get component files
  let componentFields = Object.keys(component.schema);

  // Add keys to values if there are extra fields in the component schema (in case we want to add keys to the field values)
  const values =
    valuesFromEventData.length < componentFields.length ? [...keys, ...valuesFromEventData] : valuesFromEventData;

  const metadata = component.metadata as { types: string[]; name: string };

  // create component object from values with schema
  const componentValues = componentFields.reduce((acc: Schema, key, index) => {
    const value = values[index];
    const type = metadata.types[index];
    // @ts-ignore
    acc[key] = setType(type, value);
    return acc;
  }, {});

  // set component
  setComponent(component, entityIndex, componentValues);
}

const setType = (type: string, value: string) => {
  switch (type) {
    case "u8":
      return Number(value);
    case "u16":
      return Number(value);
    case "u32":
      return Number(value);
    case "u64":
      return Number(value);
    case "u128":
      return BigInt(value);
    case "felt252":
      return BigInt(value);
    case "bool":
      return parseInt(value) === 1;
    case "contractaddress":
      return BigInt(value);
    default:
      return BigInt(value);
  }
};

function hexToAscii(hex: string) {
  var str = "";
  for (var n = 2; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  return str;
}
