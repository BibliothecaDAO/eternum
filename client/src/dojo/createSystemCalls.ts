import { Components, Schema, setComponent } from "@latticexyz/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Account, Event, num } from "starknet";
import { getEntityIdFromKeys, padAddress } from "../utils/utils";

const LABOR_SYSTEMS = "0x5c63bfbfd7e5e82c294cea149630d0ac3ea710e947f220fa48d7ccb58653731";
const TRADE_SYSTEMS = "0x18f17b80dc7579827d8634ad26bf21c71886e95cd87abeb16a22663618e86ad";
const HYPERSTRUCTURE_SYSTEMS = "0x28abfdeb45c0c2bbd9111a61d3a10bb56627790c44e7d697a358f72ae584111";
const RESOURCE_SYSTEMS = "0x4359d4ce23debeaf72f8ccbae33ae3f7a7b25ad7128708be91348b1fae9b224";
const CARAVAN_SYSTEMS = "0x44370a5641d318cef5ee539c446d23bcd60702d37c3a479ef9980e304f72b18";
const ROAD_SYSTEMS = "0x623632e3533357e7a4c7702dde50be930fd2acfefea8736d9702a5cf1151193";
const TRANSPORT_UNIT_SYSTEMS = "0x6dff75af583b322417f2cebb34251b97059d48e9b812bf0465cc2fa06d65b0a";
const TRAVEL_SYSTEMS = "0x4b9dd6ed8f9c72d431326618cde6612088690d10a2f9f25f7afc45bdea6aa6f";
const TEST_REALM_SYSTEMS = "0x705314a73b16263057854603f9110efa8674d405ec4f9cdc5be0eee0396a178";
const TEST_RESOURCE_SYSTEMS = "0x1e5c3535f9ac613a1e8ea41db05cf4af404e98fc138c45afd85b92f99fc6c58";

interface SystemSigner {
  signer: Account;
}

export interface TravelProps extends SystemSigner {
  travelling_entity_id: num.BigNumberish;
  destination_coord_x: num.BigNumberish;
  destination_coord_y: num.BigNumberish;
}

export interface InitializeHyperstructuresProps extends SystemSigner {
  entity_id: num.BigNumberish;
  hyperstructure_id: num.BigNumberish;
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
  labor_units: num.BigNumberish;
}

export interface BuildLaborProps extends SystemSigner {
  realm_id: num.BigNumberish;
  resource_type: num.BigNumberish;
  labor_units: num.BigNumberish;
  multiplier: num.BigNumberish;
}

export interface HarvestLaborProps extends SystemSigner {
  realm_id: num.BigNumberish; // TODO: this is entity id not realm id
  resource_type: num.BigNumberish;
}

export interface MintResourcesProps extends SystemSigner {
  entity_id: num.BigNumberish;
  resources: num.BigNumberish[];
}

export interface TakeFungibleOrderProps extends SystemSigner {
  taker_id: num.BigNumberish;
  trade_id: num.BigNumberish;
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
}

export interface MakeFungibleOrderProps extends SystemSigner {
  maker_id: num.BigNumberish;
  maker_entity_types: num.BigNumberish[];
  maker_quantities: num.BigNumberish[];
  taker_id: num.BigNumberish;
  taker_entity_types: num.BigNumberish[];
  taker_quantities: num.BigNumberish[];
}

export type SystemCalls = ReturnType<typeof createSystemCalls>;

// NOTE: need to add waitForTransaction when connected to rinnigan
export function createSystemCalls({ provider, contractComponents }: SetupNetworkResult) {
  const purchase_labor = async (props: PurchaseLaborProps) => {
    const { entity_id, resource_type, labor_units, signer } = props;
    const tx = await provider.execute(signer, LABOR_SYSTEMS, "purchase", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      entity_id,
      resource_type,
      labor_units,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });

    setComponentsFromEvents(contractComponents, getEvents(receipt));
  };

  // Refactor the functions using the interfaces
  const build_labor = async (props: BuildLaborProps) => {
    const { realm_id, resource_type, labor_units, multiplier, signer } = props;
    const tx = await provider.execute(signer, LABOR_SYSTEMS, "build", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      realm_id,
      resource_type,
      labor_units,
      multiplier,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });

    setComponentsFromEvents(contractComponents, getEvents(receipt));
  };

  const harvest_labor = async (props: HarvestLaborProps) => {
    const { realm_id, resource_type, signer } = props;
    const tx = await provider.execute(signer, LABOR_SYSTEMS, "harvest", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      realm_id,
      resource_type,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });

    setComponentsFromEvents(contractComponents, getEvents(receipt));
  };

  const mint_resources = async (props: MintResourcesProps) => {
    const { entity_id, resources, signer } = props;
    const tx = await provider.execute(signer, TEST_RESOURCE_SYSTEMS, "mint", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      entity_id,
      resources.length / 2,
      ...resources,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });

    setComponentsFromEvents(contractComponents, getEvents(receipt));
  };

  const make_fungible_order = async (props: MakeFungibleOrderProps): Promise<number> => {
    const { maker_id, maker_entity_types, maker_quantities, taker_id, taker_entity_types, taker_quantities, signer } =
      props;

    const expires_at = Math.floor(Date.now() / 1000 + 2628000);

    const tx = await provider.execute(signer, TRADE_SYSTEMS, "create_order", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      maker_id,
      maker_entity_types.length,
      ...maker_entity_types,
      maker_quantities.length,
      ...maker_quantities,
      taker_id,
      taker_entity_types.length,
      ...taker_entity_types,
      taker_quantities.length,
      ...taker_quantities,
      1,
      expires_at,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
    let trade_id = getEntityIdFromEvents(events, "Trade");
    return trade_id;
  };

  const take_fungible_order = async (props: TakeFungibleOrderProps) => {
    const { taker_id, trade_id, signer } = props;
    const tx = await provider.execute(signer, TRADE_SYSTEMS, "accept_order", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      taker_id,
      trade_id,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });

    setComponentsFromEvents(contractComponents, getEvents(receipt));
  };

  const cancel_fungible_order = async (props: CancelFungibleOrderProps) => {
    const { trade_id, signer } = props;
    const tx = await provider.execute(signer, TRADE_SYSTEMS, "cancel_order", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      trade_id,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
  };

  const create_free_transport_unit = async (props: CreateFreeTransportUnitProps): Promise<number> => {
    const { realm_id, quantity, signer } = props;

    const tx = await provider.execute(signer, TRANSPORT_UNIT_SYSTEMS, "create_free_unit", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      realm_id,
      quantity,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
    // TODO: use getEntityIdFromEvents
    return parseInt(events[1].data[2]);
  };

  const create_caravan = async (props: CreateCaravanProps): Promise<number> => {
    const { entity_ids, signer } = props;
    const tx = await provider.execute(signer, CARAVAN_SYSTEMS, "create", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      entity_ids.length,
      ...entity_ids,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
    // TODO: use getEntityIdFromEvents
    const caravan_id = parseInt(events[2].data[2]);
    return caravan_id;
  };

  const attach_caravan = async (props: AttachCaravanProps) => {
    const { realm_id, trade_id, caravan_id, signer } = props;
    const tx = await provider.execute(signer, TRADE_SYSTEMS, "attach_caravan", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      realm_id,
      trade_id,
      caravan_id,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
  };

  const claim_fungible_order = async (props: ClaimFungibleOrderProps) => {
    const { entity_id, trade_id, signer } = props;
    const tx = await provider.execute(signer, TRADE_SYSTEMS, "claim_order", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      entity_id,
      trade_id,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
  };

  const create_realm = async (props: CreateRealmProps): Promise<number> => {
    const {
      realm_id,
      owner,
      resource_types_packed,
      resource_types_count,
      cities,
      harbors,
      rivers,
      regions,
      wonder,
      order,
      position,
      signer,
    } = props;

    const tx = await provider.execute(signer, TEST_REALM_SYSTEMS, "create", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      realm_id,
      owner,
      resource_types_packed,
      resource_types_count,
      cities,
      harbors,
      rivers,
      regions,
      wonder,
      order,
      2,
      position.x,
      position.y,
    ]);

    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);

    let realm_entity_id: number = 0;
    // TODO: use getEntityIdFromEvents
    for (const event of events) {
      // if component change is Realm (hex), take entity_id
      if (event.data[0] === "0x5265616c6d") {
        realm_entity_id = parseInt(event.data[2]);
      }
    }
    return realm_entity_id;
  };

  const create_road = async (props: CreateRoadProps) => {
    const { creator_id, start_coord, end_coord, usage_count, signer } = props;
    const tx = await provider.execute(signer, ROAD_SYSTEMS, "create", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      creator_id,
      start_coord.x,
      start_coord.y,
      end_coord.x,
      end_coord.y,
      usage_count,
    ]);
    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
  };

  const transfer_resources = async (props: TransferResourcesProps) => {
    const { sending_entity_id, receiving_entity_id, resources, signer } = props;
    const tx = await provider.execute(signer, RESOURCE_SYSTEMS, "transfer", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      sending_entity_id,
      receiving_entity_id,
      resources.length / 2,
      ...resources,
    ]);

    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
  };

  const initialize_hyperstructure = async (props: InitializeHyperstructuresProps) => {
    const { entity_id, hyperstructure_id, signer } = props;
    const tx = await provider.execute(signer, HYPERSTRUCTURE_SYSTEMS, "initialize", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      entity_id,
      hyperstructure_id,
    ]);

    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
  };

  const complete_hyperstructure = async (props: CompleteHyperStructureProps) => {
    const { hyperstructure_id, signer } = props;
    const tx = await provider.execute(signer, HYPERSTRUCTURE_SYSTEMS, "complete", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      hyperstructure_id,
    ]);

    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
  };

  const travel = async (props: TravelProps) => {
    const { travelling_entity_id, destination_coord_x, destination_coord_y, signer } = props;
    // TODO: put coords
    const tx = await provider.execute(signer, TRAVEL_SYSTEMS, "travel", [
      import.meta.env.VITE_WORLD_ADDRESS!,
      travelling_entity_id,
      destination_coord_x,
      destination_coord_y,
    ]);

    const receipt = await provider.provider.waitForTransaction(tx.transaction_hash, { retryInterval: 500 });
    const events = getEvents(receipt);
    setComponentsFromEvents(contractComponents, events);
  };

  return {
    purchase_labor,
    build_labor,
    harvest_labor,
    mint_resources,
    make_fungible_order,
    take_fungible_order,
    claim_fungible_order,
    cancel_fungible_order,
    create_free_transport_unit,
    create_caravan,
    attach_caravan,
    create_realm,
    create_road,
    transfer_resources,
    initialize_hyperstructure,
    complete_hyperstructure,
    travel,
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
    acc[key] = key === "address" ? padAddress(value) : Number(value);
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

function asciiToHex(ascii: string) {
  var hex = "";
  for (var i = 0; i < ascii.length; i++) {
    var charCode = ascii.charCodeAt(i);
    hex += charCode.toString(16).padStart(2, "0");
  }
  return `0x${hex}`;
}

function getEntityIdFromEvents(events: Event[], componentName: string): number {
  let entityId = 0;
  const event = events.find((event) => {
    return event.data[0] === asciiToHex(componentName);
  });
  if (event) {
    entityId = parseInt(event.data[2]);
  }
  return entityId;
}
