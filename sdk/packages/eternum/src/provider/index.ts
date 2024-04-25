import { DojoProvider } from "@dojoengine/core";
import * as SystemProps from "../types/provider";
import { Account, AccountInterface, AllowArray, Call, CallData } from "starknet";
import EventEmitter from "eventemitter3";

export const getContractByName = (manifest: any, name: string) => {
  const contract = manifest.contracts.find((contract: any) => contract.name.includes("::" + name));
  if (contract) {
    return contract.address;
  } else {
    return "";
  }
};

function ApplyEventEmitter<T extends new (...args: any[]) => {}>(Base: T) {
  return class extends Base {
    eventEmitter = new EventEmitter();

    emit(event: string, ...args: any[]) {
      this.eventEmitter.emit(event, ...args);
    }

    on(event: string, listener: (...args: any[]) => void) {
      this.eventEmitter.on(event, listener);
    }

    off(event: string, listener: (...args: any[]) => void) {
      this.eventEmitter.off(event, listener);
    }
  };
}
const EnhancedDojoProvider = ApplyEventEmitter(DojoProvider);

export class EternumProvider extends EnhancedDojoProvider {
  constructor(katana: any, url?: string) {
    super(katana, url);
    this.manifest = katana;

    this.getWorldAddress = function () {
      const worldAddress = this.manifest.world.address;
      return worldAddress;
    };
  }

  private async executeAndCheckTransaction(
    signer: Account | AccountInterface,
    transactionDetails: AllowArray<Call>,
  ): Promise<any> {
    const tx = await this.executeMulti(signer, transactionDetails);
    this.emit("transactionComplete", await this.waitForTransactionWithCheck(tx.transaction_hash));
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
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

  public async create_order(props: SystemProps.CreateOrderProps) {
    const {
      maker_id,
      maker_gives_resource_types,
      maker_gives_resource_amounts,
      taker_id,
      taker_gives_resource_types,
      taker_gives_resource_amounts,
      signer,
      expires_at,
    } = props;

    let maker_gives_resource = maker_gives_resource_amounts.flatMap((amount, i) => {
      return [maker_gives_resource_types[i], amount];
    });

    let taker_gives_resource = taker_gives_resource_amounts.flatMap((amount, i) => {
      return [taker_gives_resource_types[i], amount];
    });

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "trade_systems"),
        entrypoint: "create_order",
        calldata: [
          this.getWorldAddress(),
          maker_id,
          maker_gives_resource_types.length,
          ...maker_gives_resource,
          taker_id,
          taker_gives_resource_types.length,
          ...taker_gives_resource,
          expires_at,
        ],
      },
    ]);
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
    const { taker_id, trade_id, signer } = props;

    const tx = await this.executeMulti(signer, [
      {
        contractAddress: getContractByName(this.manifest, "trade_systems"),
        entrypoint: "accept_order",
        calldata: [taker_id, trade_id],
      },
    ]);
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async cancel_order(props: SystemProps.CancelOrderProps) {
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

  public async send_resources(props: SystemProps.SendResourcesProps) {
    const { sender_entity_id, recipient_entity_id, resources, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "resource_systems"),
      entrypoint: "send",
      calldata: [sender_entity_id, recipient_entity_id, resources.length / 2, ...resources],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async pickup_resources(props: SystemProps.PickupResourcesProps) {
    const { donkey_owner_entity_id, resource_owner_entity_id, resources, signer } = props;

    const tx = await this.executeMulti(signer, {
      contractAddress: getContractByName(this.manifest, "resource_systems"),
      entrypoint: "pickup",
      calldata: [donkey_owner_entity_id, resource_owner_entity_id, resources],
    });
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

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

  public async level_up_realm(props: SystemProps.LevelUpRealmProps) {
    const { realm_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "leveling_systems"),
      entrypoint: "level_up_realm",
      calldata: [realm_entity_id],
    });
  }

  public async merge_soldiers(props: SystemProps.MergeSoldiersProps) {
    const { merge_into_unit_id, units, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "merge_soldiers",
      calldata: [merge_into_unit_id, units.length / 2, ...units],
    });
  }

  public async create_and_merge_soldiers(props: SystemProps.CreateAndMergeSoldiersProps) {
    const { realm_entity_id, quantity, merge_into_unit_id, signer } = props;
    const uuid = await this.uuid();

    const units = [uuid, quantity];

    return await this.executeAndCheckTransaction(signer, [
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
  }

  public async heal_soldiers(props: SystemProps.HealSoldiersProps) {
    const { unit_id, health_amount, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "combat_systems"),
      entrypoint: "heal_soldiers",
      calldata: [unit_id, health_amount],
    });
  }

  public async set_address_name(props: SystemProps.SetAddressNameProps) {
    const { name, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "name_systems"),
      entrypoint: "set_address_name",
      calldata: [name],
    });
  }

  public async set_entity_name(props: SystemProps.SetEntityNameProps) {
    const { entity_id, name, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "name_systems"),
      entrypoint: "set_entity_name",
      calldata: [entity_id, name],
    });
  }

  public async explore(props: SystemProps.ExploreProps) {
    const { unit_id, direction, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "map_systems"),
      entrypoint: "explore",
      calldata: [unit_id, direction],
    });
  }

  public async create_building(props: SystemProps.CreateBuildingProps) {
    const { entity_id, building_coord, building_category, produce_resource_type, signer } = props;

    return this.executeAndCheckTransaction(signer, {
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
  }

  public async destroy_building(props: SystemProps.DestroyBuildingProps) {
    const { entity_id, building_coord, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "building_systems"),
      entrypoint: "destroy",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });
  }

  public async create_bank(props: SystemProps.CreateBankProps) {
    const { realm_entity_id, coord, owner_fee_scaled, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "bank_systems"),
      entrypoint: "create_bank",
      calldata: [realm_entity_id, coord, owner_fee_scaled],
    });
  }

  public async open_account(props: SystemProps.OpenAccountProps) {
    const { bank_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "bank_systems"),
      entrypoint: "open_account",
      calldata: [bank_entity_id],
    });
  }

  public async change_bank_owner_fee(props: SystemProps.ChangeBankOwnerFeeProps) {
    const { bank_entity_id, new_swap_fee_unscaled, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "bank_systems"),
      entrypoint: "change_owner_fee",
      calldata: [bank_entity_id, new_swap_fee_unscaled],
    });
  }

  public async buy_resources(props: SystemProps.BuyResourcesProps) {
    const { bank_entity_id, resource_type, amount, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "swap_systems"),
      entrypoint: "buy",
      calldata: [bank_entity_id, resource_type, amount],
    });
  }

  public async sell_resources(props: SystemProps.SellResourcesProps) {
    const { bank_entity_id, resource_type, amount, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "swap_systems"),
      entrypoint: "sell",
      calldata: [bank_entity_id, resource_type, amount],
    });
  }

  public async add_liquidity(props: SystemProps.AddLiquidityProps) {
    const { bank_entity_id, resource_type, resource_amount, lords_amount, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "liquidity_systems"),
      entrypoint: "add",
      calldata: [bank_entity_id, resource_type, resource_amount, lords_amount],
    });
  }

  public async remove_liquidity(props: SystemProps.RemoveLiquidityProps) {
    const { bank_entity_id, resource_type, shares, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "liquidity_systems"),
      entrypoint: "remove",
      calldata: [bank_entity_id, resource_type, shares, false],
    });
  }

  public async create_army(props: SystemProps.CreateArmyProps) {
    const { owner_id, troops, signer } = props;

    console.log(owner_id, troops, signer);

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, "combat_v2_systems"),
      entrypoint: "create_army",
      calldata: [owner_id, troops.knight_count, troops.paladin_count, troops.crossbowman_count],
    });
  }
}
