import { DojoProvider } from "@dojoengine/core";
import * as SystemProps from "../types/provider";
import { Call, CallData } from "starknet";

const UUID_OFFSET_CREATE_CARAVAN = 2;

export const getContractByName = (manifest: any, name: string) => {
  const contract = manifest.contracts.find((contract: any) => contract.name.includes("::" + name));
  if (contract) {
    return contract.address;
  } else {
    return "";
  }
};

export class EternumProvider extends DojoProvider {
  constructor(katana: any, url?: string) {
    super(katana, url);
    this.manifest = katana;

    this.getWorldAddress = function () {
      const worldAddress = this.manifest.world.address;
      return worldAddress;
    };
  }

  // Wrapper function to check for transaction errors
  async waitForTransactionWithCheck(transactionHash: string) {
    const receipt = await this.provider.waitForTransaction(transactionHash, {
      retryInterval: 500,
    });

    // Check if the transaction was reverted and throw an error if it was
    if (receipt.isReverted()) {
      throw new Error(`Transaction failed with reason: ${receipt.revert_reason}`);
    }

    return receipt;
  }

  public async purchase_labor(props: SystemProps.PurchaseLaborProps): Promise<any> {
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

    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  // Refactor the functions using the interfaces
  public async build_labor(props: SystemProps.BuildLaborProps) {
    const { entity_id, resource_type, labor_units, multiplier, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "labor_systems"),
      entrypoint: "build",
      calldata: [entity_id, resource_type, labor_units, multiplier],
    });

    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async harvest_labor(props: SystemProps.HarvestLaborProps) {
    const { realm_id, resource_type, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "labor_systems"),
      entrypoint: "harvest",
      calldata: [realm_id, resource_type],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async harvest_all_labor(props: SystemProps.HarvestAllLaborProps) {
    const { entity_ids, signer } = props;

    const calldata = entity_ids.map((entity_id) => {
      return {
        contractAddress: getContractByName(this.manifest, "labor_systems"),
        entrypoint: "harvest",
        calldata: [...entity_id],
      };
    });

    const tx = await this.executeMulti(signer, calldata);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async create_order(props: SystemProps.CreateOrderProps) {
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
          calldata: [maker_id, donkeys_quantity],
        },
        {
          contractAddress: getContractByName(this.manifest, "caravan_systems"),
          entrypoint: "create",
          calldata: [[uuid].length, ...[uuid]],
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
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async mint_resources(props: SystemProps.MintResourcesProps) {
    const { receiver_id, resources } = props;

    const tx = await this.executeMulti(props.signer, {
      contractAddress: getContractByName(this.manifest, "test_resource_systems"),
      entrypoint: "mint",
      calldata: [receiver_id, resources.length / 2, ...resources],
    });

    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async accept_order(props: SystemProps.AcceptOrderProps) {
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
          calldata: [taker_id, donkeys_quantity],
        },
        {
          contractAddress: getContractByName(this.manifest, "caravan_systems"),
          entrypoint: "create",
          calldata: [[transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    if (final_caravan_id) {
      // Common transactions
      transactions.push({
        contractAddress: getContractByName(this.manifest, "trade_systems"),
        entrypoint: "accept_order",
        calldata: [taker_id, final_caravan_id, trade_id],
      });
    }

    const tx = await this.executeMulti(signer, transactions);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async cancel_fungible_order(props: SystemProps.CancelFungibleOrderProps) {
    const { trade_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "trade_systems"),
      entrypoint: "cancel_order",
      calldata: [trade_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async transfer_items_from_multiple(props: SystemProps.TransferItemsFromMultipleProps) {
    const { senders, signer } = props;

    let calldata = senders.flatMap((sender) => {
      return sender.indices.map((index) => {
        return {
          contractAddress: getContractByName(this.manifest, "resource_systems"),
          entrypoint: "transfer_item",
          calldata: [sender.sender_id, index, sender.receiver_id],
        };
      });
    });

    const tx = await this.executeMulti(signer, calldata);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async transfer_items(props: SystemProps.TransferItemsProps) {
    const { sender_id, indices, receiver_id, signer } = props;

    let calldata = indices.map((index) => {
      return {
        contractAddress: getContractByName(this.manifest, "resource_systems"),
        entrypoint: "transfer_item",
        calldata: [sender_id, index, receiver_id],
      };
    });

    // send request to transfer items in batches of `BATCH_SIZE`

    const BATCH_SIZE = 3;
    let batchCalldata = [];

    for (let i = 1; i <= calldata.length; i++) {
      batchCalldata.push(calldata[i - 1]);
      if (i % BATCH_SIZE == 0 || i == calldata.length) {
        const tx = await this.executeMulti(signer, batchCalldata);
        await this.waitForTransactionWithCheck(tx.transaction_hash);

        // reset batchCalldata
        batchCalldata = [];
      }
    }
  }

  public async create_free_transport_unit(props: SystemProps.CreateFreeTransportUnitProps) {
    const { realm_id, quantity, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "transport_unit_systems"),
      entrypoint: "create_free_unit",
      calldata: [realm_id, quantity],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async create_caravan(props: SystemProps.CreateCaravanProps) {
    const { entity_ids, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "caravan_systems"),
      entrypoint: "create",
      calldata: [entity_ids.length, ...entity_ids],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async disassemble_caravan_and_return_free_units(props: SystemProps.DisassembleCaravanAndReturnFreeUnitsProps) {
    const { caravan_id, unit_ids, signer } = props;
    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "caravan_systems"),
        entrypoint: "disassemble",
        calldata: [caravan_id],
      },
      {
        contractAddress: getContractByName(this.manifest, "transport_unit_systems"),
        entrypoint: "return_free_units",
        calldata: [unit_ids.length, ...unit_ids],
      },
    ]);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async attach_caravan(props: SystemProps.AttachCaravanProps) {
    const { realm_id, trade_id, caravan_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "trade_systems"),
      entrypoint: "attach_caravan",
      calldata: [realm_id, trade_id, caravan_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async purchase_and_build_labor(props: SystemProps.PurchaseLaborProps & SystemProps.BuildLaborProps) {
    const { entity_id, resource_type, labor_units, multiplier, signer } = props;
    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "labor_systems"),
        entrypoint: "purchase",
        calldata: [entity_id, resource_type, (labor_units as number) * (multiplier as number)],
      },
      {
        contractAddress: getContractByName(this.manifest, "labor_systems"),
        entrypoint: "build",
        calldata: [entity_id, resource_type, labor_units, multiplier],
      },
    ]);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async create_realm(props: SystemProps.CreateRealmProps) {
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
      position,
      signer,
    } = props;

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "realm_systems"),
        entrypoint: "create",
        calldata: [
          realm_id,
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
    ]);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  create_multiple_realms = async (props: SystemProps.CreateMultipleRealmsProps) => {
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
        position,
      } = realm;

      let calldata = [
        {
          contractAddress: getContractByName(this.manifest, "realm_systems"),
          entrypoint: "create",
          calldata: [
            realm_id,
            resource_types_packed,
            resource_types_count,
            cities,
            harbors,
            rivers,
            regions,
            wonder,
            order,
            2, // entity ID in position struct
            position.x,
            position.y,
          ],
        },
      ];

      return calldata;
    });

    const tx = await this.executeMulti(signer, calldata);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  };

  public async create_road(props: SystemProps.CreateRoadProps) {
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
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async transfer_resources(props: SystemProps.TransferResourcesProps) {
    const { sending_entity_id, receiving_entity_id, resources, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "resource_systems"),
      entrypoint: "transfer",
      calldata: [sending_entity_id, receiving_entity_id, resources.length / 2, ...resources],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async send_resources_to_location(props: SystemProps.SendResourcesToLocationProps) {
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
          calldata: [sending_entity_id, donkeys_quantity],
        },
        {
          contractAddress: getContractByName(this.manifest, "caravan_systems"),
          entrypoint: "create",
          calldata: [[transport_unit_ids].length, ...[transport_unit_ids]],
        },
      );
    }

    if (final_caravan_id) {
      // Common transactions
      transactions.push(
        {
          contractAddress: getContractByName(this.manifest, "resource_systems"),
          entrypoint: "transfer",
          calldata: [sending_entity_id, final_caravan_id, resources.length / 2, ...resources],
        },
        {
          contractAddress: getContractByName(this.manifest, "travel_systems"),
          entrypoint: "travel",
          calldata: [final_caravan_id, destination_coord_x, destination_coord_y],
        },
      );
    }

    const tx = await this.executeMulti(signer, transactions);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public swap_bank_and_travel_back = async (props: SystemProps.SwapBankAndTravelBackProps) => {
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
        calldata: [sender_id, inventoryIndex, sender_id],
      },
      ...indices.map((index, i) => ({
        contractAddress: getContractByName(this.manifest, "bank_systems"),
        entrypoint: "swap",
        calldata: [bank_id, index, sender_id, resource_types[i], resource_amounts[i]],
      })),
      {
        contractAddress: getContractByName(this.manifest, "travel_systems"),
        entrypoint: "travel",
        calldata: [sender_id, destination_coord_x, destination_coord_y],
      },
    ]);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  };

  public feed_hyperstructure_and_travel_back = async (props: SystemProps.FeedHyperstructureAndTravelBackPropos) => {
    const { entity_id, inventoryIndex, hyperstructure_id, destination_coord_x, destination_coord_y, signer } = props;

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "resource_systems"),
        entrypoint: "transfer_item",
        calldata: [entity_id, inventoryIndex, hyperstructure_id],
      },
      {
        contractAddress: getContractByName(this.manifest, "travel_systems"),
        entrypoint: "travel",
        calldata: [entity_id, destination_coord_x, destination_coord_y],
      },
    ]);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  };

  public async travel(props: SystemProps.TravelProps) {
    const { travelling_entity_id, destination_coord_x, destination_coord_y, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "travel_systems"),
      entrypoint: "travel",
      calldata: [travelling_entity_id, destination_coord_x, destination_coord_y],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async travel_hex(props: SystemProps.TravelHexProps) {
    const { travelling_entity_id, directions, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "travel_systems"),
      entrypoint: "travel_hex",
      calldata: [travelling_entity_id, directions],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async create_soldiers(props: SystemProps.CreateSoldiersProps) {
    const { realm_entity_id, quantity, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "create_soldiers",
      calldata: [realm_entity_id, quantity],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async detach_soldiers(props: SystemProps.DetachSoldiersProps) {
    const { unit_id, detached_quantity, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "detach_soldiers",
      calldata: [unit_id, detached_quantity],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async attack(props: SystemProps.AttackProps) {
    const { attacker_ids, target_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "attack",
      calldata: [attacker_ids.length, ...attacker_ids, target_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async steal(props: SystemProps.StealProps) {
    const { attacker_id, target_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "steal",
      calldata: [attacker_id, target_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async control_hyperstructure(props: SystemProps.ControlHyperstructureProps) {
    const { hyperstructure_id, order_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "hyperstructure_systems"),
      entrypoint: "control",
      calldata: [hyperstructure_id, order_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async complete_hyperstructure(props: SystemProps.CompleteHyperstructureProps) {
    const { hyperstructure_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "hyperstructure_systems"),
      entrypoint: "complete",
      calldata: [hyperstructure_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async level_up_realm(props: SystemProps.LevelUpRealmProps) {
    const { realm_entity_id, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "leveling_systems"),
      entrypoint: "level_up_realm",
      calldata: [realm_entity_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async merge_soldiers(props: SystemProps.MergeSoldiersProps) {
    const { merge_into_unit_id, units, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "merge_soldiers",
      calldata: [merge_into_unit_id, units.length / 2, ...units],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async create_and_merge_soldiers(props: SystemProps.CreateAndMergeSoldiersProps) {
    const { realm_entity_id, quantity, merge_into_unit_id, signer } = props;
    const uuid = await this.uuid();

    const units = [uuid, quantity];
    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "combat_systems"),
        entrypoint: "create_soldiers",
        calldata: [realm_entity_id, quantity],
      },
      {
        contractAddress: getContractByName(this.manifest, "combat_systems"),
        entrypoint: "merge_soldiers",
        calldata: [merge_into_unit_id, units.length / 2, ...units],
      },
    ]);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async heal_soldiers(props: SystemProps.HealSoldiersProps) {
    const { unit_id, health_amount, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "heal_soldiers",
      calldata: [unit_id, health_amount],
    });

    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async set_address_name(props: SystemProps.SetAddressNameProps) {
    const { name, signer } = props;
    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "name_systems"),
      entrypoint: "set_address_name",
      calldata: [name],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async create_labor_building(props: SystemProps.CreateLaborBuildingProps) {
    const { realm_entity_id, building_type } = props;

    const tx = await this.executeMulti(props.signer, {
      contractAddress: getContractByName(this.manifest, "buildings_systems"),
      entrypoint: "create",
      calldata: [realm_entity_id, building_type],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async destroy_labor_building(props: SystemProps.DestroyLaborBuildingProps) {
    const { realm_entity_id } = props;

    const tx = await this.executeMulti(props.signer, {
      contractAddress: getContractByName(this.manifest, "buildings_systems"),
      entrypoint: "destroy",
      calldata: [realm_entity_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async explore(props: SystemProps.ExploreProps) {
    const { unit_id, direction, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "map_systems"),
      entrypoint: "explore",
      calldata: [unit_id, direction],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async create_building(props: SystemProps.CreateBuildingProps) {
    const { entity_id, building_coord, building_category, produce_resource_type, signer } = props;

    console.log(
      CallData.compile([entity_id, building_coord.x, building_coord.y, building_category, produce_resource_type]),
    );

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "building_systems"),
      entrypoint: "create",
      calldata: CallData.compile([
        entity_id,
        building_coord.x,
        building_coord.y,
        building_category,
        produce_resource_type,
      ]),
    });

    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async destroy_building(props: SystemProps.DestroyBuildingProps) {
    const { entity_id, building_coord, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "building_systems"),
      entrypoint: "destroy",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });
    return await this.provider.waitForTransaction(tx.transaction_hash, {
      retryInterval: 500,
    });
  }

  public async create_bank(props: SystemProps.CreateBankProps) {
    const { coord, owner_fee_scaled, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "config_systems"),
      entrypoint: "create_bank",
      calldata: [coord, owner_fee_scaled],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async open_account(props: SystemProps.OpenAccountProps) {
    const { bank_entity_id, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "bank_systems"),
      entrypoint: "open_account",
      calldata: [bank_entity_id],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async change_bank_owner_fee(props: SystemProps.ChangeBankOwnerFeeProps) {
    const { bank_entity_id, new_swap_fee_unscaled, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "bank_systems"),
      entrypoint: "change_owner_fee",
      calldata: [bank_entity_id, new_swap_fee_unscaled],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async buy_resources(props: SystemProps.BuyResourcesProps) {
    const { bank_entity_id, resource_type, amount, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "swap_systems"),
      entrypoint: "buy",
      calldata: [bank_entity_id, resource_type, amount],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async sell_resources(props: SystemProps.SellResourcesProps) {
    const { bank_entity_id, resource_type, amount, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "swap_systems"),
      entrypoint: "sell",
      calldata: [bank_entity_id, resource_type, amount],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public add_liquidity = async (props: SystemProps.AddLiquidityProps) => {
    const { bank_entity_id, resource_type, resource_amount, lords_amount, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "liquidity_systems"),
      entrypoint: "add",
      calldata: [bank_entity_id, resource_type, resource_amount, lords_amount],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  };

  public remove_liquidity = async (props: SystemProps.RemoveLiquidityProps) => {
    const { bank_entity_id, resource_type, shares, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "liquidity_systems"),
      entrypoint: "remove",
      calldata: [bank_entity_id, resource_type, shares],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  };
}
