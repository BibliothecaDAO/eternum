import { Components, Schema, setComponent } from "@latticexyz/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Event } from "starknet";
import { getEntityIdFromKeys } from "../utils/utils";
import {
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
  InitializeHyperstructuresAndTravelProps,
  MintResourcesProps,
  PurchaseLaborProps,
  SendResourcesToHyperstructureProps,
  TransferResourcesProps,
  TravelProps,
  OffloadResourcesProps,
  CreateSoldiersProps,
  GroupAndDeploySoldiersProps,
  UngroupAndRegroupSoldiersProps,
  UngroupSoldiersProps,
  AttackProps,
  StealProps,
  LevelUpProps,
  SetAddressNameProps,
} from "@bibliothecadao/eternum";

export type SystemCalls = ReturnType<typeof createSystemCalls>;

// NOTE: need to add waitForTransaction when connected to rinnigan
export function createSystemCalls({ provider, contractComponents }: SetupNetworkResult) {
  const purchase_labor = async (props: PurchaseLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.purchase_labor(props)));
  };

  // Refactor the functions using the interfaces
  const build_labor = async (props: BuildLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.build_labor(props)));
  };

  const harvest_labor = async (props: HarvestLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.harvest_labor(props)));
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

  const offload_chest = async (props: OffloadResourcesProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.offload_chest(props)));
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

  const send_resources_to_hyperstructure = async (props: SendResourcesToHyperstructureProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.send_resources_to_hyperstructure(props)));
  };

  const travel = async (props: TravelProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.travel(props)));
  };

  const create_soldiers = async (props: CreateSoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_soldiers(props)));
  };

  const group_and_deploy_soldiers = async (props: GroupAndDeploySoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.group_and_deploy_soldiers(props)));
  };

  const ungroup_soldiers = async (props: UngroupSoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.ungroup_soldiers(props)));
  };

  const attack = async (props: AttackProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.attack(props)));
  };

  const steal = async (props: StealProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.steal(props)));
  };

  const ungroup_and_regroup_soldiers = async (props: UngroupAndRegroupSoldiersProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.ungroup_and_regroup_soldiers(props)));
  };

  const level_up = async (props: LevelUpProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.level_up(props)));
  };

  const set_address_name = async (props: SetAddressNameProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.set_address_name(props)));
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
    set_address_name,
    level_up,
    isLive,
    create_soldiers,
    group_and_deploy_soldiers,
    ungroup_soldiers,
    attack,
    steal,
    purchase_labor,
    build_labor,
    purchase_and_build_labor,
    harvest_labor,
    mint_resources,
    create_order,
    accept_order,
    cancel_fungible_order,
    offload_chest,
    create_free_transport_unit,
    create_caravan,
    attach_caravan,
    create_realm,
    create_road,
    transfer_resources,
    send_resources_to_hyperstructure,
    feed_hyperstructure_and_travel_back,
    initialize_hyperstructure_and_travel_back,
    initialize_hyperstructure,
    complete_hyperstructure,
    travel,
    ungroup_and_regroup_soldiers,
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
