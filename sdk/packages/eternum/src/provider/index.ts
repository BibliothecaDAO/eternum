import { DojoProvider } from "@dojoengine/core";
import {
  AcceptOrderProps,
  AttachCaravanProps,
  BuildLaborProps,
  CancelFungibleOrderProps,
  CreateCaravanProps,
  CreateFreeTransportUnitProps,
  CreateOrderProps,
  CreateRealmProps,
  CreateMultipleRealmsProps,
  CreateRoadProps,
  FeedHyperstructureAndTravelBackPropos,
  HarvestLaborProps,
  PurchaseLaborProps,
  SendResourcesToLocationProps,
  TransferResourcesProps,
  TravelProps,
  TransferItemsProps,
  TransferItemsFromMultipleProps,
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
  HarvestAllLaborProps,
  SwapBankAndTravelBackProps,
  MintResourcesProps,
  DisassembleCaravanAndReturnFreeUnitsProps,
} from "../types/provider";
import { Call } from "starknet";

const UUID_OFFSET_CREATE_CARAVAN = 2;

export const getContractByName = (manifest: any, name: string) => {
  return (
    manifest.contracts.find((contract: any) => {
      const nameParts = contract.name.split("::");
      return nameParts[nameParts.length - 1] === name;
    })?.address || ""
  );
};

export class EternumProvider extends DojoProvider {
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

  public async harvest_all_labor(props: HarvestAllLaborProps) {
    const { entity_ids, signer } = props;

    const calldata = entity_ids.map((entity_id) => {
      return {
        contractAddress: getContractByName(this.manifest, "labor_systems"),
        entrypoint: "harvest",
        calldata: [this.getWorldAddress(), ...entity_id],
      };
    });

    const tx = await this.executeMulti(signer, calldata);
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
      expires_at,
    } = props;

    let maker_gives_resource = maker_gives_resource_amounts.flatMap((amount, i) => {
      return [maker_gives_resource_types[i], amount];
    });

    let taker_gives_resource = taker_gives_resource_amounts.flatMap((amount, i) => {
      return [taker_gives_resource_types[i], amount];
    });

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
        ...maker_gives_resource,
        final_caravan_id,
        taker_id,
        taker_gives_resource_types.length,
        ...taker_gives_resource,
        expires_at,
      ],
    });

    const tx = await this.executeMulti(signer, transactions);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async mint_resources(props: MintResourcesProps) {
    const { receiver_id, resources } = props;

    const tx = await this.executeMulti(props.signer, {
      contractAddress: getContractByName(this.manifest, "test_resource_systems"),
      entrypoint: "mint",
      calldata: [this.getWorldAddress(), receiver_id, resources.length / 2, ...resources],
    });

    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async accept_order(props: AcceptOrderProps) {
    const { taker_id, trade_id, donkeys_quantity, caravan_id, signer } = props;

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

  public async transfer_items_from_multiple(props: TransferItemsFromMultipleProps) {
    const { senders, signer } = props;

    let calldata = senders.flatMap((sender) => {
      return sender.indices.map((index) => {
        return {
          contractAddress: getContractByName(this.manifest, "resource_systems"),
          entrypoint: "transfer_item",
          calldata: [this.getWorldAddress(), sender.sender_id, index, sender.receiver_id],
        };
      });
    });

    const tx = await this.executeMulti(signer, calldata);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async transfer_items(props: TransferItemsProps) {
    const { sender_id, indices, receiver_id, signer } = props;

    let calldata = indices.map((index) => {
      return {
        contractAddress: getContractByName(this.manifest, "resource_systems"),
        entrypoint: "transfer_item",
        calldata: [this.getWorldAddress(), sender_id, index, receiver_id],
      };
    });
    const tx = await this.executeMulti(signer, calldata);
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

  public async disassemble_caravan_and_return_free_units(props: DisassembleCaravanAndReturnFreeUnitsProps) {
    const { caravan_id, unit_ids, signer } = props;
    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "caravan_systems"),
        entrypoint: "disassemble",
        calldata: [this.getWorldAddress(), caravan_id],
      },
      {
        contractAddress: getContractByName(this.manifest, "transport_unit_systems"),
        entrypoint: "return_free_units",
        calldata: [this.getWorldAddress(), unit_ids.length, ...unit_ids],
      },
    ]);
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
      resource_types_packed,
      resource_types_count,
      cities,
      harbors,
      rivers,
      regions,
      wonder,
      order,
      order_hyperstructure_id,
      position,
      signer,
    } = props;

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "realm_systems"),
        entrypoint: "create",
        calldata: [
          this.getWorldAddress(),
          realm_id,
          resource_types_packed,
          resource_types_count,
          cities,
          harbors,
          rivers,
          regions,
          wonder,
          order,
          order_hyperstructure_id,
          2,
          position.x,
          position.y,
        ],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  create_multiple_realms = async (props: CreateMultipleRealmsProps) => {
    let { realms, signer } = props;

    let calldata = realms.flatMap((realm) => {
      const {
        realm_id,
        resource_types_packed,
        resource_types_count,
        cities,
        harbors,
        rivers,
        regions,
        wonder,
        order,
        order_hyperstructure_id,
        position,
      } = realm;

      let calldata = [
        {
          contractAddress: getContractByName(this.manifest, "realm_systems"),
          entrypoint: "create",
          calldata: [
            this.getWorldAddress(),
            realm_id,
            resource_types_packed,
            resource_types_count,
            cities,
            harbors,
            rivers,
            regions,
            wonder,
            order,
            order_hyperstructure_id, // TODO: issue here we can't pass th BigINt
            2, // entity ID in position struct
            position.x,
            position.y,
          ],
        },
      ];

      return calldata;
    });

    const tx = await this.executeMulti(signer, calldata);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  };

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

  public async send_resources_to_location(props: SendResourcesToLocationProps) {
    const {
      sending_entity_id,
      resources,
      donkeys_quantity,
      destination_coord_x,
      destination_coord_y,
      caravan_id,
      signer,
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

  public swap_bank_and_travel_back = async (props: SwapBankAndTravelBackProps) => {
    const {
      sender_id,
      inventoryIndex,
      bank_id,
      resource_types,
      resource_amounts,
      indices,
      destination_coord_x,
      destination_coord_y,
      signer,
    } = props;

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "resource_systems"),
        entrypoint: "transfer_item",
        calldata: [this.getWorldAddress(), sender_id, inventoryIndex, sender_id],
      },
      ...indices.map((index, i) => ({
        contractAddress: getContractByName(this.manifest, "bank_systems"),
        entrypoint: "swap",
        calldata: [this.getWorldAddress(), bank_id, index, sender_id, resource_types[i], resource_amounts[i]],
      })),
      {
        contractAddress: getContractByName(this.manifest, "travel_systems"),
        entrypoint: "travel",
        calldata: [this.getWorldAddress(), sender_id, destination_coord_x, destination_coord_y],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  };

  public feed_hyperstructure_and_travel_back = async (props: FeedHyperstructureAndTravelBackPropos) => {
    const { entity_id, inventoryIndex, hyperstructure_id, destination_coord_x, destination_coord_y, signer } = props;

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "resource_systems"),
        entrypoint: "transfer_item",
        calldata: [this.getWorldAddress(), entity_id, inventoryIndex, hyperstructure_id],
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

  public async detach_soldiers(props: DetachSoldiersProps) {
    const { unit_id, detached_quantity, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "detach_soldiers",
      calldata: [this.getWorldAddress(), unit_id, detached_quantity],
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

  public async control_hyperstructure(props: ControlHyperstructureProps) {
    const { hyperstructure_id, order_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "hyperstructure_systems"),
      entrypoint: "control",
      calldata: [this.getWorldAddress(), hyperstructure_id, order_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async complete_hyperstructure(props: CompleteHyperstructureProps) {
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

  public async level_up_realm(props: LevelUpRealmProps) {
    const { realm_entity_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "leveling_systems"),
      entrypoint: "level_up_realm",
      calldata: [this.getWorldAddress(), realm_entity_id],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async merge_soldiers(props: MergeSoldiersProps) {
    const { merge_into_unit_id, units, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "merge_soldiers",
      calldata: [this.getWorldAddress(), merge_into_unit_id, units.length / 2, ...units],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_and_merge_soldiers(props: CreateAndMergeSoldiersProps) {
    const { realm_entity_id, quantity, merge_into_unit_id, signer } = props;
    const uuid = await this.uuid();

    const units = [uuid, quantity];
    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "combat_systems"),
        entrypoint: "create_soldiers",
        calldata: [this.getWorldAddress(), realm_entity_id, quantity],
      },
      {
        contractAddress: getContractByName(this.manifest, "combat_systems"),
        entrypoint: "merge_soldiers",
        calldata: [this.getWorldAddress(), merge_into_unit_id, units.length / 2, ...units],
      },
    ]);
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async heal_soldiers(props: HealSoldiersProps) {
    const { unit_id, health_amount, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "heal_soldiers",
      calldata: [this.getWorldAddress(), unit_id, health_amount],
    });

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
