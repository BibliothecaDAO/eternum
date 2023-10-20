import { Components, Schema, setComponent } from "@latticexyz/recs";
import { SetupNetworkResult } from "./setupNetwork";
import { Account, AllowArray, Call, Event, num } from "starknet";
import { getEntityIdFromKeys } from "../utils/utils";

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

const WORLD_ADDRESS = import.meta.env.VITE_WORLD_ADDRESS;

const UUID_OFFSET_CREATE_ORDER = 3;
const UUID_OFFSET_CREATE_TRANSPORT_UNIT = 1;
const UUID_OFFSET_CREATE_CARAVAN = 2;

interface SystemSigner {
  signer: Account;
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
    const { entity_id, resource_type, labor_units, multiplier, signer } = props;
    await executeTransaction(signer, {
      contractAddress: LABOR_SYSTEMS,
      entrypoint: "purchase",
      calldata: [WORLD_ADDRESS, entity_id, resource_type, (labor_units as number) * (multiplier as number)],
    });
  };

  // Refactor the functions using the interfaces
  const build_labor = async (props: BuildLaborProps) => {
    const { realm_id, resource_type, labor_units, multiplier, signer } = props;
    await executeTransaction(signer, {
      contractAddress: LABOR_SYSTEMS,
      entrypoint: "build",
      calldata: [WORLD_ADDRESS, realm_id, resource_type, labor_units, multiplier],
    });
  };

  const harvest_labor = async (props: HarvestLaborProps) => {
    const { realm_id, resource_type, signer } = props;
    await executeTransaction(signer, {
      contractAddress: LABOR_SYSTEMS,
      entrypoint: "harvest",
      calldata: [WORLD_ADDRESS, realm_id, resource_type],
    });
  };

  const mint_resources = async (props: MintResourcesProps) => {
    const { entity_id, resources, signer } = props;
    await executeTransaction(signer, {
      contractAddress: TEST_RESOURCE_SYSTEMS,
      entrypoint: "mint",
      calldata: [WORLD_ADDRESS, entity_id, resources.length / 2, ...resources],
    });
  };

  const create_order = async (props: CreateOrderProps) => {
    const uuid = await provider.uuid();
    const {
      maker_id,
      maker_entity_types,
      maker_quantities,
      taker_id,
      taker_entity_types,
      taker_quantities,
      signer,
      caravan_id,
      donkeys_quantity,
    } = props;

    const expires_at = Math.floor(Date.now() / 1000 + 2628000);
    const trade_id = uuid + UUID_OFFSET_CREATE_ORDER;

    let transactions = [];

    // Common transaction for creating an order
    transactions.push({
      contractAddress: TRADE_SYSTEMS,
      entrypoint: "create_order",
      calldata: [
        WORLD_ADDRESS,
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
      ],
    });

    // If no caravan_id is provided, create a new caravan
    let final_caravan_id = caravan_id;
    if (!caravan_id) {
      const transport_unit_ids = trade_id + UUID_OFFSET_CREATE_TRANSPORT_UNIT;
      final_caravan_id = transport_unit_ids + UUID_OFFSET_CREATE_CARAVAN;

      transactions.push(
        {
          contractAddress: TRANSPORT_UNIT_SYSTEMS,
          entrypoint: "create_free_unit",
          calldata: [WORLD_ADDRESS, maker_id, donkeys_quantity],
        },
        {
          contractAddress: CARAVAN_SYSTEMS,
          entrypoint: "create",
          calldata: [WORLD_ADDRESS, [transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    // Common transaction for attaching a caravan
    transactions.push({
      contractAddress: TRADE_SYSTEMS,
      entrypoint: "attach_caravan",
      calldata: [WORLD_ADDRESS, maker_id, trade_id, final_caravan_id],
    });

    await executeTransaction(signer, transactions);
  };

  const accept_order = async (props: AcceptOrderProps) => {
    const { taker_id, trade_id, donkeys_quantity, signer, caravan_id } = props;

    let transactions = [];
    let final_caravan_id = caravan_id;

    // If no caravan_id, create a new caravan
    if (!caravan_id) {
      const transport_unit_ids = await provider.uuid();
      final_caravan_id = transport_unit_ids + UUID_OFFSET_CREATE_CARAVAN;

      transactions.push(
        {
          contractAddress: TRANSPORT_UNIT_SYSTEMS,
          entrypoint: "create_free_unit",
          calldata: [WORLD_ADDRESS, taker_id, donkeys_quantity],
        },
        {
          contractAddress: CARAVAN_SYSTEMS,
          entrypoint: "create",
          calldata: [WORLD_ADDRESS, [transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    // Common transactions
    transactions.push(
      {
        contractAddress: TRADE_SYSTEMS,
        entrypoint: "attach_caravan",
        calldata: [WORLD_ADDRESS, taker_id, trade_id, final_caravan_id],
      },
      {
        contractAddress: TRADE_SYSTEMS,
        entrypoint: "accept_order",
        calldata: [WORLD_ADDRESS, taker_id, trade_id],
      },
    );

    await executeTransaction(signer, transactions);
  };

  const cancel_fungible_order = async (props: CancelFungibleOrderProps) => {
    const { trade_id, signer } = props;
    await executeTransaction(signer, {
      contractAddress: TRADE_SYSTEMS,
      entrypoint: "cancel_order",
      calldata: [WORLD_ADDRESS, trade_id],
    });
  };

  const create_free_transport_unit = async (props: CreateFreeTransportUnitProps): Promise<number> => {
    const uuid = await provider.uuid();
    const { realm_id, quantity, signer } = props;

    await executeTransaction(signer, {
      contractAddress: TRANSPORT_UNIT_SYSTEMS,
      entrypoint: "create_free_unit",
      calldata: [WORLD_ADDRESS, realm_id, quantity],
    });
    return uuid + UUID_OFFSET_CREATE_TRANSPORT_UNIT;
  };

  const create_caravan = async (props: CreateCaravanProps): Promise<number> => {
    const { entity_ids, signer } = props;
    const uuid = await provider.uuid();
    await executeTransaction(signer, {
      contractAddress: CARAVAN_SYSTEMS,
      entrypoint: "create",
      calldata: [WORLD_ADDRESS, entity_ids.length, ...entity_ids],
    });
    return uuid + UUID_OFFSET_CREATE_CARAVAN;
  };

  const attach_caravan = async (props: AttachCaravanProps) => {
    const { realm_id, trade_id, caravan_id, signer } = props;
    await executeTransaction(signer, {
      contractAddress: TRADE_SYSTEMS,
      entrypoint: "attach_caravan",
      calldata: [WORLD_ADDRESS, realm_id, trade_id, caravan_id],
    });
  };

  const claim_fungible_order = async (props: ClaimFungibleOrderProps) => {
    const { entity_id, trade_id, signer } = props;
    await executeTransaction(signer, {
      contractAddress: TRADE_SYSTEMS,
      entrypoint: "claim_order",
      calldata: [WORLD_ADDRESS, entity_id, trade_id],
    });
  };

  const purchase_and_build_labor = async (props: PurchaseAndBuildLaborProps) => {
    const { entity_id, resource_type, labor_units, multiplier, signer } = props;
    let total_units = (labor_units as number) * (multiplier as number);
    await executeTransaction(signer, [
      {
        contractAddress: LABOR_SYSTEMS,
        entrypoint: "purchase",
        calldata: [WORLD_ADDRESS, entity_id, resource_type, total_units],
      },
      {
        contractAddress: LABOR_SYSTEMS,
        entrypoint: "build",
        calldata: [WORLD_ADDRESS, entity_id, resource_type, labor_units, multiplier],
      },
    ]);
  };

  const create_realm = async (props: CreateRealmProps) => {
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
      resources,
      signer,
    } = props;

    const uuid = await provider.uuid();

    await executeTransaction(signer, [
      {
        contractAddress: TEST_REALM_SYSTEMS,
        entrypoint: "create",
        calldata: [
          WORLD_ADDRESS,
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
        ],
      },
      {
        contractAddress: TEST_RESOURCE_SYSTEMS,
        entrypoint: "mint",
        calldata: [WORLD_ADDRESS, uuid, resources.length / 2, ...resources],
      },
    ]);
  };

  const create_road = async (props: CreateRoadProps) => {
    const { creator_id, start_coord, end_coord, usage_count, signer } = props;
    await executeTransaction(signer, {
      contractAddress: ROAD_SYSTEMS,
      entrypoint: "create",
      calldata: [WORLD_ADDRESS, creator_id, start_coord.x, start_coord.y, end_coord.x, end_coord.y, usage_count],
    });
  };

  const transfer_resources = async (props: TransferResourcesProps) => {
    const { sending_entity_id, receiving_entity_id, resources, signer } = props;
    await executeTransaction(signer, {
      contractAddress: RESOURCE_SYSTEMS,
      entrypoint: "transfer",
      calldata: [WORLD_ADDRESS, sending_entity_id, receiving_entity_id, resources.length / 2, ...resources],
    });
  };

  const send_resources_to_hyperstructure = async (props: SendResourcesToHyperstructureProps) => {
    const {
      sending_entity_id,
      resources,
      donkeys_quantity,
      destination_coord_x,
      destination_coord_y,
      signer,
      caravan_id,
    } = props;

    let transactions = [];
    let final_caravan_id = caravan_id;

    // If no caravan_id, create a new caravan
    if (!caravan_id) {
      const transport_unit_ids = await provider.uuid();
      final_caravan_id = transport_unit_ids + UUID_OFFSET_CREATE_CARAVAN;

      transactions.push(
        {
          contractAddress: TRANSPORT_UNIT_SYSTEMS,
          entrypoint: "create_free_unit",
          calldata: [WORLD_ADDRESS, sending_entity_id, donkeys_quantity],
        },
        {
          contractAddress: CARAVAN_SYSTEMS,
          entrypoint: "create",
          calldata: [WORLD_ADDRESS, [transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    // Common transactions
    transactions.push(
      {
        contractAddress: RESOURCE_SYSTEMS,
        entrypoint: "transfer",
        calldata: [WORLD_ADDRESS, sending_entity_id, final_caravan_id, resources.length / 2, ...resources],
      },
      {
        contractAddress: TRAVEL_SYSTEMS,
        entrypoint: "travel",
        calldata: [WORLD_ADDRESS, final_caravan_id, destination_coord_x, destination_coord_y],
      },
    );

    await executeTransaction(signer, transactions);
  };

  const feed_hyperstructure_and_travel_back = async (props: FeedHyperstructureAndTravelBackPropos) => {
    const { entity_id, resources, hyperstructure_id, destination_coord_x, destination_coord_y, signer } = props;

    await executeTransaction(signer, [
      {
        contractAddress: RESOURCE_SYSTEMS,
        entrypoint: "transfer",
        calldata: [WORLD_ADDRESS, entity_id, hyperstructure_id, resources.length / 2, ...resources],
      },
      {
        contractAddress: TRAVEL_SYSTEMS,
        entrypoint: "travel",
        calldata: [WORLD_ADDRESS, entity_id, destination_coord_x, destination_coord_y],
      },
    ]);
  };

  const initialize_hyperstructure_and_travel_back = async (props: InitializeHyperstructuresAndTravelProps) => {
    const { entity_id, hyperstructure_id, destination_coord_x, destination_coord_y, signer } = props;

    await executeTransaction(signer, [
      {
        contractAddress: HYPERSTRUCTURE_SYSTEMS,
        entrypoint: "initialize",
        calldata: [WORLD_ADDRESS, entity_id, hyperstructure_id],
      },
      {
        contractAddress: TRAVEL_SYSTEMS,
        entrypoint: "travel",
        calldata: [WORLD_ADDRESS, entity_id, destination_coord_x, destination_coord_y],
      },
    ]);
  };

  const initialize_hyperstructure = async (props: InitializeHyperstructuresProps) => {
    const { entity_id, hyperstructure_id, signer } = props;
    await executeTransaction(signer, {
      contractAddress: HYPERSTRUCTURE_SYSTEMS,
      entrypoint: "initialize",
      calldata: [WORLD_ADDRESS, entity_id, hyperstructure_id],
    });
  };

  const complete_hyperstructure = async (props: CompleteHyperStructureProps) => {
    const { hyperstructure_id, signer } = props;
    await executeTransaction(signer, {
      contractAddress: HYPERSTRUCTURE_SYSTEMS,
      entrypoint: "complete",
      calldata: [WORLD_ADDRESS, hyperstructure_id],
    });
  };

  const travel = async (props: TravelProps) => {
    const { travelling_entity_id, destination_coord_x, destination_coord_y, signer } = props;
    await executeTransaction(signer, {
      contractAddress: TRAVEL_SYSTEMS,
      entrypoint: "travel",
      calldata: [WORLD_ADDRESS, travelling_entity_id, destination_coord_x, destination_coord_y],
    });
  };

  async function executeTransaction(signer: any, calls: AllowArray<Call>) {
    const tx = await provider.execute(signer, calls);
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
