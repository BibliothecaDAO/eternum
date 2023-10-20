import { RPCProvider } from "@dojoengine/core";
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
  InitializeHyperstructuresProps,
  MintResourcesProps,
  PurchaseLaborProps,
  SendResourcesToHyperstructureProps,
  TransferResourcesProps,
  TravelProps,
} from "../types";
import { Call } from "starknet";
import { DEV_CONTRACTS, PROD_CONTRACTS } from "../constants";

const UUID_OFFSET_CREATE_ORDER = 3;
const UUID_OFFSET_CREATE_TRANSPORT_UNIT = 1;
const UUID_OFFSET_CREATE_CARAVAN = 2;

export class EternumProvider extends RPCProvider {
  public contracts: typeof DEV_CONTRACTS | typeof PROD_CONTRACTS;

  constructor(world_address: string, isDev: boolean, url?: string) {
    super(world_address, undefined, url);
    this.contracts = isDev ? DEV_CONTRACTS : PROD_CONTRACTS;
  }

  public async purchase_labor(props: PurchaseLaborProps): Promise<any> {
    const { signer, entity_id, resource_type, labor_units, multiplier } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.LABOR_SYSTEMS,
      calldata: {
        world: this.contracts.WORLD_ADDRESS,
        entity_id,
        resource_type,
        labor_units: (labor_units as number) * (multiplier as number),
      },
      entrypoint: "purchase",
    });

    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  // Refactor the functions using the interfaces
  public async build_labor(props: BuildLaborProps) {
    const { entity_id, resource_type, labor_units, multiplier, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.LABOR_SYSTEMS,
      entrypoint: "build",
      calldata: [this.contracts.WORLD_ADDRESS, entity_id, resource_type, labor_units, multiplier],
    });

    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async harvest_labor(props: HarvestLaborProps) {
    const { realm_id, resource_type, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.LABOR_SYSTEMS,
      entrypoint: "harvest",
      calldata: [this.contracts.WORLD_ADDRESS, realm_id, resource_type],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async mint_resources(props: MintResourcesProps) {
    const { entity_id, resources, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.TEST_RESOURCE_SYSTEMS,
      entrypoint: "mint",
      calldata: [this.contracts.WORLD_ADDRESS, entity_id, resources.length / 2, ...resources],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_order(props: CreateOrderProps) {
    const uuid = await this.uuid();
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

    let transactions: Call[] = [];

    // Common transaction for creating an order
    transactions.push({
      contractAddress: this.contracts.TRADE_SYSTEMS,
      entrypoint: "create_order",
      calldata: [
        this.contracts.WORLD_ADDRESS,
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
    if (!caravan_id && donkeys_quantity) {
      const transport_unit_ids = trade_id + UUID_OFFSET_CREATE_TRANSPORT_UNIT;
      final_caravan_id = transport_unit_ids + UUID_OFFSET_CREATE_CARAVAN;

      transactions.push(
        {
          contractAddress: this.contracts.TRANSPORT_UNIT_SYSTEMS,
          entrypoint: "create_free_unit",
          calldata: [this.contracts.WORLD_ADDRESS, maker_id, donkeys_quantity],
        },
        {
          contractAddress: this.contracts.CARAVAN_SYSTEMS,
          entrypoint: "create",
          calldata: [this.contracts.WORLD_ADDRESS, [transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    if (final_caravan_id) {
      // Common transaction for attaching a caravan
      transactions.push({
        contractAddress: this.contracts.TRADE_SYSTEMS,
        entrypoint: "attach_caravan",
        calldata: [this.contracts.WORLD_ADDRESS, maker_id, trade_id, final_caravan_id],
      });
    }

    const tx = await this.executeMulti(signer, transactions);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async accept_order(props: AcceptOrderProps) {
    const { taker_id, trade_id, donkeys_quantity, signer, caravan_id } = props;

    let transactions: Call[] = [];
    let final_caravan_id = caravan_id;

    // If no caravan_id, create a new caravan
    if (!caravan_id && donkeys_quantity) {
      const transport_unit_ids = await this.uuid();
      final_caravan_id = transport_unit_ids + UUID_OFFSET_CREATE_CARAVAN;

      transactions.push(
        {
          contractAddress: this.contracts.TRANSPORT_UNIT_SYSTEMS,
          entrypoint: "create_free_unit",
          calldata: [this.contracts.WORLD_ADDRESS, taker_id, donkeys_quantity],
        },
        {
          contractAddress: this.contracts.CARAVAN_SYSTEMS,
          entrypoint: "create",
          calldata: [this.contracts.WORLD_ADDRESS, [transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    if (final_caravan_id) {
      // Common transactions
      transactions.push(
        {
          contractAddress: this.contracts.TRADE_SYSTEMS,
          entrypoint: "attach_caravan",
          calldata: [this.contracts.WORLD_ADDRESS, taker_id, trade_id, final_caravan_id],
        },
        {
          contractAddress: this.contracts.TRADE_SYSTEMS,
          entrypoint: "accept_order",
          calldata: [this.contracts.WORLD_ADDRESS, taker_id, trade_id],
        },
      );
    }

    const tx = await this.executeMulti(signer, transactions);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async cancel_fungible_order(props: CancelFungibleOrderProps) {
    const { trade_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.TRADE_SYSTEMS,
      entrypoint: "cancel_order",
      calldata: [this.contracts.WORLD_ADDRESS, trade_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_free_transport_unit(props: CreateFreeTransportUnitProps) {
    const { realm_id, quantity, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.TRANSPORT_UNIT_SYSTEMS,
      entrypoint: "create_free_unit",
      calldata: [this.contracts.WORLD_ADDRESS, realm_id, quantity],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_caravan(props: CreateCaravanProps) {
    const { entity_ids, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.CARAVAN_SYSTEMS,
      entrypoint: "create",
      calldata: [this.contracts.WORLD_ADDRESS, entity_ids.length, ...entity_ids],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async attach_caravan(props: AttachCaravanProps) {
    const { realm_id, trade_id, caravan_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.TRADE_SYSTEMS,
      entrypoint: "attach_caravan",
      calldata: [this.contracts.WORLD_ADDRESS, realm_id, trade_id, caravan_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async claim_fungible_order(props: ClaimFungibleOrderProps) {
    const { entity_id, trade_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.TRADE_SYSTEMS,
      entrypoint: "claim_order",
      calldata: [this.contracts.WORLD_ADDRESS, entity_id, trade_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async purchase_and_build_labor(props: PurchaseLaborProps & BuildLaborProps) {
    const { entity_id, resource_type, labor_units, multiplier, signer } = props;
    const tx = await this.executeMulti(signer, [
      {
        contractAddress: this.contracts.LABOR_SYSTEMS,
        entrypoint: "purchase",
        calldata: [
          this.contracts.WORLD_ADDRESS,
          entity_id,
          resource_type,
          (labor_units as number) * (multiplier as number),
        ],
      },
      {
        contractAddress: this.contracts.LABOR_SYSTEMS,
        entrypoint: "build",
        calldata: [this.contracts.WORLD_ADDRESS, entity_id, resource_type, labor_units, multiplier],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_realm(props: CreateRealmProps) {
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

    const uuid = await this.uuid();

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: this.contracts.TEST_REALM_SYSTEMS,
        entrypoint: "create",
        calldata: [
          this.contracts.WORLD_ADDRESS,
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
        contractAddress: this.contracts.TEST_RESOURCE_SYSTEMS,
        entrypoint: "mint",
        calldata: [this.contracts.WORLD_ADDRESS, uuid, resources.length / 2, ...resources],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_road(props: CreateRoadProps) {
    const { creator_id, start_coord, end_coord, usage_count, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.ROAD_SYSTEMS,
      entrypoint: "create",
      calldata: [
        this.contracts.WORLD_ADDRESS,
        creator_id,
        start_coord.x,
        start_coord.y,
        end_coord.x,
        end_coord.y,
        usage_count,
      ],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async transfer_resources(props: TransferResourcesProps) {
    const { sending_entity_id, receiving_entity_id, resources, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.RESOURCE_SYSTEMS,
      entrypoint: "transfer",
      calldata: [
        this.contracts.WORLD_ADDRESS,
        sending_entity_id,
        receiving_entity_id,
        resources.length / 2,
        ...resources,
      ],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async send_resources_to_hyperstructure(props: SendResourcesToHyperstructureProps) {
    const {
      sending_entity_id,
      resources,
      donkeys_quantity,
      destination_coord_x,
      destination_coord_y,
      signer,
      caravan_id,
    } = props;

    let transactions: Call[] = [];
    let final_caravan_id = caravan_id;

    // If no caravan_id, create a new caravan
    if (!caravan_id && donkeys_quantity) {
      const transport_unit_ids = await this.uuid();
      final_caravan_id = transport_unit_ids + UUID_OFFSET_CREATE_CARAVAN;

      transactions.push(
        {
          contractAddress: this.contracts.TRANSPORT_UNIT_SYSTEMS,
          entrypoint: "create_free_unit",
          calldata: [this.contracts.WORLD_ADDRESS, sending_entity_id, donkeys_quantity],
        },
        {
          contractAddress: this.contracts.CARAVAN_SYSTEMS,
          entrypoint: "create",
          calldata: [this.contracts.WORLD_ADDRESS, [transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    if (final_caravan_id) {
      // Common transactions
      transactions.push(
        {
          contractAddress: this.contracts.RESOURCE_SYSTEMS,
          entrypoint: "transfer",
          calldata: [
            this.contracts.WORLD_ADDRESS,
            sending_entity_id,
            final_caravan_id,
            resources.length / 2,
            ...resources,
          ],
        },
        {
          contractAddress: this.contracts.TRAVEL_SYSTEMS,
          entrypoint: "travel",
          calldata: [this.contracts.WORLD_ADDRESS, final_caravan_id, destination_coord_x, destination_coord_y],
        },
      );
    }

    const tx = await this.executeMulti(signer, transactions);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public feed_hyperstructure_and_travel_back = async (props: FeedHyperstructureAndTravelBackPropos) => {
    const { entity_id, resources, hyperstructure_id, destination_coord_x, destination_coord_y, signer } = props;

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: this.contracts.RESOURCE_SYSTEMS,
        entrypoint: "transfer",
        calldata: [this.contracts.WORLD_ADDRESS, entity_id, hyperstructure_id, resources.length / 2, ...resources],
      },
      {
        contractAddress: this.contracts.TRAVEL_SYSTEMS,
        entrypoint: "travel",
        calldata: [this.contracts.WORLD_ADDRESS, entity_id, destination_coord_x, destination_coord_y],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  };

  public async initialize_hyperstructure_and_travel_back(props: InitializeHyperstructuresAndTravelProps) {
    const { entity_id, hyperstructure_id, destination_coord_x, destination_coord_y, signer } = props;

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: this.contracts.HYPERSTRUCTURE_SYSTEMS,
        entrypoint: "initialize",
        calldata: [this.contracts.WORLD_ADDRESS, entity_id, hyperstructure_id],
      },
      {
        contractAddress: this.contracts.TRAVEL_SYSTEMS,
        entrypoint: "travel",
        calldata: [this.contracts.WORLD_ADDRESS, entity_id, destination_coord_x, destination_coord_y],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async initialize_hyperstructure(props: InitializeHyperstructuresProps) {
    const { entity_id, hyperstructure_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.HYPERSTRUCTURE_SYSTEMS,
      entrypoint: "initialize",
      calldata: [this.contracts.WORLD_ADDRESS, entity_id, hyperstructure_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async complete_hyperstructure(props: CompleteHyperStructureProps) {
    const { hyperstructure_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.HYPERSTRUCTURE_SYSTEMS,
      entrypoint: "complete",
      calldata: [this.contracts.WORLD_ADDRESS, hyperstructure_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async travel(props: TravelProps) {
    const { travelling_entity_id, destination_coord_x, destination_coord_y, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: this.contracts.TRAVEL_SYSTEMS,
      entrypoint: "travel",
      calldata: [this.contracts.WORLD_ADDRESS, travelling_entity_id, destination_coord_x, destination_coord_y],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }
}
