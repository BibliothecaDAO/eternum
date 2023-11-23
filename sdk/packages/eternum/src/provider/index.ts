import { RPCProvider, getContractByName } from "@dojoengine/core";
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
  InitializeHyperstructuresProps,
  MintResourcesProps,
  PurchaseLaborProps,
  SendResourcesToHyperstructureProps,
  TransferResourcesProps,
  TravelProps,
  OffloadResourcesProps,
  CreateSoldiersProps,
  GroupAndDeploySoldiersProps,
  UngroupSoldiersProps,
  UngroupAndRegroupSoldiersProps,
  AttackProps,
  StealProps,
  LevelUpProps,
  SetAddressNameProps,
} from "../types";
import { Call } from "starknet";

const UUID_OFFSET_CREATE_CARAVAN = 2;

export class EternumProvider extends RPCProvider {
  constructor(world_address: string, url?: string, manifest: any = undefined) {
    super(world_address, manifest, url);
  }

  public async purchase_labor(props: PurchaseLaborProps): Promise<any> {
    const { signer, entity_id, resource_type, labor_units, multiplier } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "labor_systems"),
      calldata: {
        world: this.getWorldAddress(),
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
      contractAddress: getContractByName(this.manifest, "labor_systems"),
      entrypoint: "build",
      calldata: [this.getWorldAddress(), entity_id, resource_type, labor_units, multiplier],
    });

    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async harvest_labor(props: HarvestLaborProps) {
    const { realm_id, resource_type, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "labor_systems"),
      entrypoint: "harvest",
      calldata: [this.getWorldAddress(), realm_id, resource_type],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async mint_resources(props: MintResourcesProps) {
    const { entity_id, resources, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "test_resource_systems"),
      entrypoint: "mint",
      calldata: [this.getWorldAddress(), entity_id, resources.length / 2, ...resources],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_order(props: CreateOrderProps) {
    const uuid = await this.uuid();
    const {
      maker_id,
      maker_gives_resource_types,
      maker_gives_resource_amounts,
      taker_id,
      taker_gives_resource_types,
      taker_gives_resource_amounts,
      signer,
      maker_transport_id,
      donkeys_quantity,
    } = props;

    const expires_at = Math.floor(Date.now() / 1000 + 2628000);
    let transactions: Call[] = [];

    // If no caravan_id is provided, create a new caravan
    let final_caravan_id = maker_transport_id || 0;
    if (!maker_transport_id && donkeys_quantity) {
      final_caravan_id = uuid + UUID_OFFSET_CREATE_CARAVAN;

      transactions.push(
        {
          contractAddress: getContractByName(this.manifest, "transport_unit_systems"),
          entrypoint: "create_free_unit",
          calldata: [this.getWorldAddress(), maker_id, donkeys_quantity],
        },
        {
          contractAddress: getContractByName(this.manifest, "caravan_systems"),
          entrypoint: "create",
          calldata: [this.getWorldAddress(), [uuid].length, ...[uuid]],
        },
      );
    }

    // // Common transaction for creating an order
    transactions.push({
      contractAddress: getContractByName(this.manifest, "trade_systems"),
      entrypoint: "create_order",
      calldata: [
        this.getWorldAddress(),
        maker_id,
        maker_gives_resource_types.length,
        ...maker_gives_resource_types,
        maker_gives_resource_amounts.length,
        ...maker_gives_resource_amounts,
        final_caravan_id,
        taker_id,
        taker_gives_resource_types.length,
        ...taker_gives_resource_types,
        taker_gives_resource_amounts.length,
        ...taker_gives_resource_amounts,
        expires_at,
      ],
    });

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
          contractAddress: getContractByName(this.manifest, "transport_unit_systems"),
          entrypoint: "create_free_unit",
          calldata: [this.getWorldAddress(), taker_id, donkeys_quantity],
        },
        {
          contractAddress: getContractByName(this.manifest, "caravan_systems"),
          entrypoint: "create",
          calldata: [this.getWorldAddress(), [transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    if (final_caravan_id) {
      // Common transactions
      transactions.push({
        contractAddress: getContractByName(this.manifest, "trade_systems"),
        entrypoint: "accept_order",
        calldata: [this.getWorldAddress(), taker_id, final_caravan_id, trade_id],
      });
    }

    const tx = await this.executeMulti(signer, transactions);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async cancel_fungible_order(props: CancelFungibleOrderProps) {
    const { trade_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "trade_systems"),
      entrypoint: "cancel_order",
      calldata: [this.getWorldAddress(), trade_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async offload_chest(props: OffloadResourcesProps) {
    const { entity_id, entity_index_in_inventory, receiving_entity_id, transport_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "resource_systems"),
      entrypoint: "offload_chest",
      calldata: [this.getWorldAddress(), entity_id, entity_index_in_inventory, receiving_entity_id, transport_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_free_transport_unit(props: CreateFreeTransportUnitProps) {
    const { realm_id, quantity, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "transport_unit_systems"),
      entrypoint: "create_free_unit",
      calldata: [this.getWorldAddress(), realm_id, quantity],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_caravan(props: CreateCaravanProps) {
    const { entity_ids, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "caravan_systems"),
      entrypoint: "create",
      calldata: [this.getWorldAddress(), entity_ids.length, ...entity_ids],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async attach_caravan(props: AttachCaravanProps) {
    const { realm_id, trade_id, caravan_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "trade_systems"),
      entrypoint: "attach_caravan",
      calldata: [this.getWorldAddress(), realm_id, trade_id, caravan_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async purchase_and_build_labor(props: PurchaseLaborProps & BuildLaborProps) {
    const { entity_id, resource_type, labor_units, multiplier, signer } = props;
    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "labor_systems"),
        entrypoint: "purchase",
        calldata: [this.getWorldAddress(), entity_id, resource_type, (labor_units as number) * (multiplier as number)],
      },
      {
        contractAddress: getContractByName(this.manifest, "labor_systems"),
        entrypoint: "build",
        calldata: [this.getWorldAddress(), entity_id, resource_type, labor_units, multiplier],
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
        contractAddress: getContractByName(this.manifest, "test_realm_systems"),
        entrypoint: "create",
        calldata: [
          this.getWorldAddress(),
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
        contractAddress: getContractByName(this.manifest, "test_resource_systems"),
        entrypoint: "mint",
        calldata: [this.getWorldAddress(), uuid, resources.length / 2, ...resources],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_road(props: CreateRoadProps) {
    const { creator_id, start_coord, end_coord, usage_count, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "road_systems"),
      entrypoint: "create",
      calldata: [
        this.getWorldAddress(),
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
      contractAddress: getContractByName(this.manifest, "resource_systems"),
      entrypoint: "transfer",
      calldata: [this.getWorldAddress(), sending_entity_id, receiving_entity_id, resources.length / 2, ...resources],
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
          contractAddress: getContractByName(this.manifest, "transport_unit_systems"),
          entrypoint: "create_free_unit",
          calldata: [this.getWorldAddress(), sending_entity_id, donkeys_quantity],
        },
        {
          contractAddress: getContractByName(this.manifest, "caravan_systems"),
          entrypoint: "create",
          calldata: [this.getWorldAddress(), [transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    if (final_caravan_id) {
      // Common transactions
      transactions.push(
        {
          contractAddress: getContractByName(this.manifest, "resource_systems"),
          entrypoint: "transfer",
          calldata: [this.getWorldAddress(), sending_entity_id, final_caravan_id, resources.length / 2, ...resources],
        },
        {
          contractAddress: getContractByName(this.manifest, "travel_systems"),
          entrypoint: "travel",
          calldata: [this.getWorldAddress(), final_caravan_id, destination_coord_x, destination_coord_y],
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
        contractAddress: getContractByName(this.manifest, "resource_systems"),
        entrypoint: "transfer",
        calldata: [this.getWorldAddress(), entity_id, hyperstructure_id, resources.length / 2, ...resources],
      },
      {
        contractAddress: getContractByName(this.manifest, "travel_systems"),
        entrypoint: "travel",
        calldata: [this.getWorldAddress(), entity_id, destination_coord_x, destination_coord_y],
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
        contractAddress: getContractByName(this.manifest, "hyperstructure_systems"),
        entrypoint: "initialize",
        calldata: [this.getWorldAddress(), entity_id, hyperstructure_id],
      },
      {
        contractAddress: getContractByName(this.manifest, "travel_systems"),
        entrypoint: "travel",
        calldata: [this.getWorldAddress(), entity_id, destination_coord_x, destination_coord_y],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async initialize_hyperstructure(props: InitializeHyperstructuresProps) {
    const { entity_id, hyperstructure_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "hyperstructure_systems"),
      entrypoint: "initialize",
      calldata: [this.getWorldAddress(), entity_id, hyperstructure_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async complete_hyperstructure(props: CompleteHyperStructureProps) {
    const { hyperstructure_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "hyperstructure_systems"),
      entrypoint: "complete",
      calldata: [this.getWorldAddress(), hyperstructure_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async travel(props: TravelProps) {
    const { travelling_entity_id, destination_coord_x, destination_coord_y, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "travel_systems"),
      entrypoint: "travel",
      calldata: [this.getWorldAddress(), travelling_entity_id, destination_coord_x, destination_coord_y],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_soldiers(props: CreateSoldiersProps) {
    const { realm_entity_id, quantity, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "create_soldiers",
      calldata: [this.getWorldAddress(), realm_entity_id, quantity],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async group_and_deploy_soldiers(props: GroupAndDeploySoldiersProps) {
    const { realm_entity_id, soldier_ids, duty, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "group_and_deploy_soldiers",
      calldata: [this.getWorldAddress(), realm_entity_id, soldier_ids, duty],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async ungroup_soldiers(props: UngroupSoldiersProps) {
    const { group_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "ungroup_soldiers",
      calldata: [this.getWorldAddress(), group_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async attack(props: AttackProps) {
    const { attacker_ids, target_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "attack",
      calldata: [this.getWorldAddress(), attacker_ids.length, ...attacker_ids, target_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async steal(props: StealProps) {
    const { attacker_id, target_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "steal",
      calldata: [this.getWorldAddress(), attacker_id, target_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async level_up(props: LevelUpProps) {
    const { realm_entity_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "leveling_systems"),
      entrypoint: "level_up",
      calldata: [this.getWorldAddress(), realm_entity_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async ungroup_and_regroup_soldiers(props: UngroupAndRegroupSoldiersProps) {
    const { signer, group_id, realm_entity_id, new_total_quantity, new_soldier_ids, duty } = props;

    if ((new_total_quantity as number) < 0) {
      throw new Error("new_total_quantity must be positive");
    }

    const soldier_number_from_previous = (new_total_quantity as number) - new_soldier_ids.length;

    if (soldier_number_from_previous < 0) {
      throw new Error("new_soldier_ids must be less than new_total_quantity");
    }

    // new soldiers ids is empty if we remove soldiers from a group
    const uuid = await this.uuid();

    const soldier_ids = [];
    for (let i = 0; i < soldier_number_from_previous; i++) {
      soldier_ids.push(uuid + i * 2);
    }

    // append new_soldier_ids to soldier_ids
    new_soldier_ids.forEach((id) => soldier_ids.push(id));

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "combat_systems"),
        entrypoint: "ungroup_soldiers",
        calldata: [this.getWorldAddress(), group_id],
      },
      {
        contractAddress: getContractByName(this.manifest, "combat_systems"),
        entrypoint: "group_and_deploy_soldiers",
        calldata: [this.getWorldAddress(), realm_entity_id, soldier_ids, duty],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async set_address_name(props: SetAddressNameProps) {
    const { name, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "name_systems"),
      entrypoint: "set_address_name",
      calldata: [this.getWorldAddress(), name],
    });

    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }
}
