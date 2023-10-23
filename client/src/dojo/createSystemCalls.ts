import { Components, Schema, setComponent } from "@latticexyz/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Account, AllowArray, Call, Event, num } from "starknet";
import { getEntityIdFromKeys, padAddress } from "../utils/utils";
import {
  AcceptOrderProps,
  AttachCaravanProps,
  BuildLaborProps,
  CancelFungibleOrderProps,
  ClaimFungibleOrderProps,
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
} from "@bibliothecadao/eternum";


const LABOR_SYSTEMS = "0x49f2774476b6a119a5cf30927c0f4c88503c90659f6fccd2de2ed4ca8dfcce1";
const TRADE_SYSTEMS = "0x484e890ec6628a7d099bc545be049fc62924ff6329ae20aa407ffd18be3ffba";
const HYPERSTRUCTURE_SYSTEMS = "0x56aaf8eced85a21c3f4da811e57766f62907376fb32290b7b8f518b433dcfa8";
const RESOURCE_SYSTEMS = "0x3aaa6ad1d188c320af8aacfdb43f59a00978c225ab8268ae6962a5cd6f4e1ff";
const CARAVAN_SYSTEMS = "0x4a37f9e7e230616faee2a634bfce12ab4ccde30c166a6d9e8f60ab90fed7d14";
const ROAD_SYSTEMS = "0x3e8d56fe6843cabc393363c0b871029a1799ff3754a93d63626adc316009bdf";
const TRANSPORT_UNIT_SYSTEMS = "0x7fe4766dd6c4a161c09b612889f2f92a016e97a8964daabca07378cbb3606bd";
const TRAVEL_SYSTEMS = "0x3315c2f50986e9fe9562cb73ec992cbddb8270b7747179d0919b54964e189c6";
const TEST_REALM_SYSTEMS = "0x1996a879c5c85a15824d957865a95e3a94d097a09c19e97d93c46e713c0f75";
const TEST_RESOURCE_SYSTEMS = "0x2ca9678b8934991b89f91e7092e4e56a8a585defddc494d3671b480a7eeb668";
const CC_CONTRACT_ADDRESS = "0x66f875b933680247ec0b12e325d51952ef6cd5182ba0ec15561d4c7c7b24a7d";

const WORLD_ADDRESS = import.meta.env.VITE_WORLD_ADDRESS;

const UUID_OFFSET_CREATE_ORDER = 3;
const UUID_OFFSET_CREATE_TRANSPORT_UNIT = 1;
const UUID_OFFSET_CREATE_CARAVAN = 2;

interface SystemSigner {
  signer: Account;
}

export interface MintCC extends SystemSigner {

}

export interface GenerateMap extends SystemSigner {
  token_id: num.BigNumberish;
}

export interface TravelProps extends SystemSigner {
  travelling_entity_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
}

export interface CreateOrderProps {
  maker_id: num.BigNumberish;
  maker_entity_types: num.BigNumberish[];
  maker_quantities: num.BigNumberish[];
  taker_id: num.BigNumberish;
  taker_entity_types: num.BigNumberish[];
  taker_quantities: num.BigNumberish[];
  signer: any;
  caravan_id?: num.BigNumberish;
  donkeys_quantity?: num.BigNumberish;
}

export interface InitializeHyperstructuresProps extends SystemSigner {
  entity_id: num.BigNumberish;
  hyperstructure_id: num.BigNumberish;
}

export interface InitializeHyperstructuresAndTravelProps extends SystemSigner {
  entity_id: num.BigNumberish;
  hyperstructure_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
}
export interface FeedHyperstructureAndTravelBackPropos extends SystemSigner {
  entity_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
  resources: num.BigNumberish[];
  hyperstructure_id: num.BigNumberish;
}

export interface SendResourcesToHyperstructureProps extends SystemSigner {
  sending_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
  donkeys_quantity?: num.BigNumberish;
  caravan_id?: num.BigNumberish;
}

export interface CompleteHyperStructureProps extends SystemSigner {
  hyperstructure_id: num.BigNumberish;
}

export interface TransferResourcesProps extends SystemSigner {
  sending_entity_id: num.BigNumberish;
  receiving_entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

export interface PurchaseLaborProps extends SystemSigner {
  entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  multiplier: num.BigNumberish;
  labor_units: num.BigNumberish;
}

export interface BuildLaborProps extends SystemSigner {
  realm_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  labor_units: num.BigNumberish;
  multiplier: num.BigNumberish;
}

export interface PurchaseAndBuildLaborProps extends SystemSigner {
  entity_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  multiplier: num.BigNumberish;
  labor_units: num.BigNumberish;
}

export interface HarvestLaborProps extends SystemSigner {
  realm_id: num.BigNumberish; // TODO: this is entity id not realm id
  resource_type: num.BigNumberish;
}

export interface MintResourcesProps extends SystemSigner {
  entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

interface AcceptOrderProps extends SystemSigner {
  taker_id: num.BigNumberish;
  trade_id: num.BigNumberish;
  caravan_id?: num.BigNumberish; // This is optional now
  donkeys_quantity?: num.BigNumberish; // Also optional
}

export interface CancelFungibleOrderProps extends SystemSigner {
  trade_id: num.BigNumberish;
}

export interface CreateFreeTransportUnitProps extends SystemSigner {
  realm_id: num.BigNumberish;
  quantity: num.BigNumberish;
}

export interface CreateCaravanProps extends SystemSigner {
  entity_ids: num.BigNumberish[];
}

export interface AttachCaravanProps extends SystemSigner {
  realm_id: num.BigNumberish;
  trade_id: num.BigNumberish;
  caravan_id: num.BigNumberish;
}

export interface CreateRoadProps extends SystemSigner {
  creator_id: num.BigNumberish;
  start_coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  end_coord: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  usage_count: num.BigNumberish;
}

export interface ClaimFungibleOrderProps extends SystemSigner {
  entity_id: num.BigNumberish;
  trade_id: num.BigNumberish;
}

// Interface definition
export interface CreateRealmProps extends SystemSigner {
  realm_id: num.BigNumberish;
  owner: num.BigNumberish;
  resource_types_packed: num.BigNumberish;
  resource_types_count: num.BigNumberish;
  cities: num.BigNumberish;
  harbors: num.BigNumberish;
  rivers: num.BigNumberish;
  regions: num.BigNumberish;
  wonder: num.BigNumberish;
  order: num.BigNumberish;
  position: {
    x: num.BigNumberish;
    y: num.BigNumberish;
  };
  resources: num.BigNumberish[];
}

export type SystemCalls = ReturnType<typeof createSystemCalls>;

// NOTE: need to add waitForTransaction when connected to rinnigan
export function createSystemCalls({ provider, contractComponents }: SetupNetworkResult) {
  const purchase_labor = async (props: PurchaseLaborProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.purchase_labor(props)));
  };

  const mint_cc = async (props: MintCC) => {
    const { signer } = props;
    await executeTransaction(signer, {
      contractAddress: CC_CONTRACT_ADDRESS,
      entrypoint: "mint",
      calldata: [],
    });
  };

  const generate_map = async (props: GenerateMap) => {
    const { signer, token_id } = props;
    await executeTransaction(signer, {
      contractAddress: CC_CONTRACT_ADDRESS,
      entrypoint: "generate_map",
      calldata: [WORLD_ADDRESS, token_id],
    });
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

  const create_free_transport_unit = async (props: CreateFreeTransportUnitProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_free_transport_unit(props)));
  };

  const create_caravan = async (props: CreateCaravanProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.create_caravan(props)));
  };

  const attach_caravan = async (props: AttachCaravanProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.attach_caravan(props)));
  };

  const claim_fungible_order = async (props: ClaimFungibleOrderProps) => {
    setComponentsFromEvents(contractComponents, getEvents(await provider.claim_fungible_order(props)));
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

  async function executeTransaction(signer: any, calls: AllowArray<Call>) {
    const tx = await provider.execute(signer, calls);
    console.log("tx hash:" + tx.transaction_hash);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
    return events;
  }

  return {
    purchase_labor,
    build_labor,
    purchase_and_build_labor,
    harvest_labor,
    mint_resources,
    create_order,
    accept_order,
    claim_fungible_order,
    cancel_fungible_order,
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
    mint_cc,
    generate_map
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
