import { Components, Schema, setComponent } from "@dojoengine/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Event } from "starknet";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import {
  SwapBankAndTravelBackProps,
  AcceptOrderProps,
  AttachCaravanProps,
  BuildLaborProps,
  CancelFungibleOrderProps,
  CompleteHyperStructureProps,
  CreateCaravanProps,
  CreateFreeTransportUnitProps,
  CreateOrderProps,
  CreateRealmProps,
  CreateRoadProps,
  FeedHyperstructureAndTravelBackPropos,
  HarvestLaborProps,
  HarvestAllLaborProps,
  InitializeHyperstructuresAndTravelProps,
  MintResourcesProps,
  PurchaseLaborProps,
  SendResourcesToLocationProps,
  TransferResourcesProps,
  TravelProps,
  TransferItemsProps,
  CreateSoldiersProps,
  DetachSoldiersProps,
  AttackProps,
  StealProps,
  LevelUpProps,
  SetAddressNameProps,
  MergeSoldiersProps,
  CreateAndMergeSoldiersProps,
  HealSoldiersProps,
} from "@bibliothecadao/eternum";

export type SystemCalls = ReturnType<typeof createSystemCalls>;

// NOTE: need to add waitForTransaction when connected to rinnigan
export function createSystemCalls({ provider, contractComponents }: SetupNetworkResult) {
  const purchase_labor = async (props: PurchaseLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.purchase_labor(props)));
  };

  const uuid = async () => {
    return provider.uuid();
  };

  // Refactor the functions using the interfaces
  const build_labor = async (props: BuildLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.build_labor(props)));
  };

  const harvest_labor = async (props: HarvestLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.harvest_labor(props)));
  };

  const harvest_all_labor = async (props: HarvestAllLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.harvest_all_labor(props)));
  };

  const mint_resources = async (props: MintResourcesProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.mint_resources(props)));
  };

  const create_order = async (props: CreateOrderProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_order(props)));
  };

  const accept_order = async (props: AcceptOrderProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.accept_order(props)));
  };

  const cancel_fungible_order = async (props: CancelFungibleOrderProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.cancel_fungible_order(props)));
  };

  const create_free_transport_unit = async (props: CreateFreeTransportUnitProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_free_transport_unit(props)));
  };

  const create_caravan = async (props: CreateCaravanProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_caravan(props)));
  };

  const attach_caravan = async (props: AttachCaravanProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.attach_caravan(props)));
  };

  const purchase_and_build_labor = async (props: PurchaseLaborProps & BuildLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.purchase_and_build_labor(props)));
  };

  const create_realm = async (props: CreateRealmProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_realm(props)));
  };

  const create_road = async (props: CreateRoadProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_road(props)));
  };

  const transfer_resources = async (props: TransferResourcesProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.transfer_resources(props)));
  };

  const feed_hyperstructure_and_travel_back = async (props: FeedHyperstructureAndTravelBackPropos) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.feed_hyperstructure_and_travel_back(props)));
  };

  const initialize_hyperstructure_and_travel_back = async (props: InitializeHyperstructuresAndTravelProps) => {
    setComponentsFromEvents(
      contractComponents,
      getEvents(await provider.initialize_hyperstructure_and_travel_back(props)),
    );
  };

  const initialize_hyperstructure = async (props: InitializeHyperstructuresAndTravelProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.initialize_hyperstructure(props)));
  };

  const complete_hyperstructure = async (props: CompleteHyperStructureProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.complete_hyperstructure(props)));
  };

  const send_resources_to_location = async (props: SendResourcesToLocationProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.send_resources_to_location(props)));
  };

  const travel = async (props: TravelProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.travel(props)));
  };

  const create_soldiers = async (props: CreateSoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_soldiers(props)));
  };

  const attack = async (props: AttackProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.attack(props)));
  };

  const steal = async (props: StealProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.steal(props)));
  };

  const detach_soldiers = async (props: DetachSoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.detach_soldiers(props)));
  };

  const level_up = async (props: LevelUpProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.level_up(props)));
  };

  const set_address_name = async (props: SetAddressNameProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.set_address_name(props)));
  };

  const merge_soldiers = async (props: MergeSoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.merge_soldiers(props)));
  };

  const create_and_merge_soldiers = async (props: CreateAndMergeSoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_and_merge_soldiers(props)));
  };

  const heal_soldiers = async (props: HealSoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.heal_soldiers(props)));
  };

  const swap_bank_and_travel_back = async (props: SwapBankAndTravelBackProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.swap_bank_and_travel_back(props)));
  };

  const transfer_items = async (props: TransferItemsProps) => {
    console.log({ props });
    setComponentsFromEvents(contractComponents, getEvents(await provider.transfer_items(props)));
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
    swap_bank_and_travel_back,
    create_and_merge_soldiers,
    set_address_name,
    level_up,
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
    mint_resources,
    create_order,
    accept_order,
    cancel_fungible_order,
    transfer_items,
    create_free_transport_unit,
    create_caravan,
    attach_caravan,
    create_realm,
    create_road,
    transfer_resources,
    send_resources_to_location,
    feed_hyperstructure_and_travel_back,
    initialize_hyperstructure_and_travel_back,
    initialize_hyperstructure,
    complete_hyperstructure,
    travel,
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

  // create component object from values with schema
  const componentValues = componentFields.reduce((acc: Schema, key, index) => {
    const value = values[index];
    // @ts-ignore
    acc[key] = key === "address" ? value : Number(value);
    return acc;
  }, {});

  // set component
  setComponent(component, entityIndex, componentValues);
}

function hexToAscii(hex: string) {
  var str = "";
  for (var n = 2; n < hex.length; n += 2) {
    str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
  }
  return str;
}
