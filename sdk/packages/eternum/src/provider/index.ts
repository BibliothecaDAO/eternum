import { DojoProvider } from "@dojoengine/core";
import EventEmitter from "eventemitter3";
import { Account, AccountInterface, AllowArray, Call, CallData, uint256 } from "starknet";
import * as SystemProps from "../types/provider";

export const NAMESPACE = "eternum";

export const getContractByName = (manifest: any, name: string) => {
  const contract = manifest.contracts.find((contract: any) => contract.tag === name);
  if (!contract) {
    throw new Error(`Contract ${name} not found in manifest`);
  }
  return contract.address;
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

  private async executeAndCheckTransaction(signer: Account | AccountInterface, transactionDetails: AllowArray<Call>) {
    const tx = await this.execute(signer, transactionDetails, NAMESPACE);

    const transactionResult = await this.waitForTransactionWithCheck(tx.transaction_hash);

    this.emit("transactionComplete", transactionResult);

    return transactionResult;
  }

  // Wrapper function to check for transaction errors
  async waitForTransactionWithCheck(transactionHash: string) {
    const receipt = await this.provider.waitForTransaction(transactionHash, {
      retryInterval: 500,
    });

    // Check if the transaction was reverted and throw an error if it was
    if (receipt.isReverted()) {
      this.emit("transactionFailed", `Transaction failed with reason: ${receipt.revert_reason}`);
      throw new Error(`Transaction failed with reason: ${receipt.revert_reason}`);
    }

    return receipt;
  }

  public async create_order(props: SystemProps.CreateOrderProps) {
    const { maker_id, maker_gives_resources, taker_id, taker_gives_resources, signer, expires_at } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
        entrypoint: "create_order",
        calldata: [
          maker_id,
          maker_gives_resources.length / 2,
          ...maker_gives_resources,
          taker_id,
          taker_gives_resources.length / 2,
          ...taker_gives_resources,
          expires_at,
        ],
      },
    ]);
  }

  public async accept_order(props: SystemProps.AcceptOrderProps) {
    const { taker_id, trade_id, maker_gives_resources, taker_gives_resources, signer } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
        entrypoint: "accept_order",
        calldata: [
          taker_id,
          trade_id,
          maker_gives_resources.length / 2,
          ...maker_gives_resources,
          taker_gives_resources.length / 2,
          ...taker_gives_resources,
        ],
      },
    ]);
  }

  public async accept_partial_order(props: SystemProps.AcceptPartialOrderProps) {
    const { taker_id, trade_id, maker_gives_resources, taker_gives_resources, taker_gives_actual_amount, signer } =
      props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
        entrypoint: "accept_partial_order",
        calldata: [
          taker_id,
          trade_id,
          maker_gives_resources.length / 2,
          ...maker_gives_resources,
          taker_gives_resources.length / 2,
          ...taker_gives_resources,
          taker_gives_actual_amount,
        ],
      },
    ]);
  }

  public async cancel_order(props: SystemProps.CancelOrderProps) {
    const { trade_id, return_resources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-trade_systems`),
      entrypoint: "cancel_order",
      calldata: [trade_id, return_resources.length / 2, ...return_resources],
    });
  }

  public async mint_resources(props: SystemProps.MintResourcesProps) {
    const { receiver_id, resources } = props;

    return await this.executeAndCheckTransaction(props.signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_resource_systems`),
      entrypoint: "mint",
      calldata: [receiver_id, resources.length / 2, ...resources],
    });
  }

  public async claim_quest(props: SystemProps.ClaimQuestProps) {
    const { receiver_id, quest_ids, signer } = props;

    const calldata = [
      ...quest_ids.map((questId) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
        entrypoint: "quest_claim",
        calldata: [questId, receiver_id],
      })),
    ];

    return await this.executeAndCheckTransaction(signer, calldata);
  }

  public async create_realm(props: SystemProps.CreateRealmProps) {
    const { realm_id, signer } = props;

    const tx = await this.execute(
      signer,
      [
        {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_realm_systems`),
          entrypoint: "create",
          calldata: [realm_id, "0x1a3e37c77be7de91a9177c6b57956faa6da25607e567b10a25cf64fea5e533b"],
        },
      ],
      NAMESPACE,
    );
    return await this.waitForTransactionWithCheck(tx.transaction_hash);
  }

  public async upgrade_realm(props: SystemProps.UpgradeRealmProps) {
    const { realm_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
      entrypoint: "upgrade_level",
      calldata: [realm_entity_id],
    });
  }

  create_multiple_realms = async (props: SystemProps.CreateMultipleRealmsProps) => {
    let { realm_ids, signer } = props;

    let calldata = realm_ids.flatMap((realm_id) => {
      let calldata = [
        {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_realm_systems`),
          entrypoint: "create",
          calldata: [realm_id, "0x46f957b7fe3335010607174edd5c4c3fae87b12c3760dc167ac738959d8c03b"],
        },
      ];
      return calldata;
    });

    return await this.executeAndCheckTransaction(signer, calldata);
  };

  public async transfer_resources(props: SystemProps.TransferResourcesProps) {
    const { sending_entity_id, receiving_entity_id, resources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "transfer",
      calldata: [sending_entity_id, receiving_entity_id, resources.length / 2, ...resources],
    });
  }

  public async send_resources(props: SystemProps.SendResourcesProps) {
    const { sender_entity_id, recipient_entity_id, resources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
      entrypoint: "send",
      calldata: [sender_entity_id, recipient_entity_id, resources.length / 2, ...resources],
    });
  }

  public async send_resources_multiple(props: SystemProps.SendResourcesMultipleProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
        entrypoint: "send",
        calldata: [call.sender_entity_id, call.recipient_entity_id, call.resources.length / 2, ...call.resources],
      })),
    );
  }

  public async pickup_resources(props: SystemProps.PickupResourcesProps) {
    const { recipient_entity_id, owner_entity_id, resources, signer } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
        entrypoint: "approve",
        calldata: [owner_entity_id, recipient_entity_id, resources.length / 2, ...resources],
      },
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-resource_systems`),
        entrypoint: "pickup",
        calldata: [recipient_entity_id, owner_entity_id, resources.length / 2, ...resources],
      },
    ]);
  }

  public async travel(props: SystemProps.TravelProps) {
    const { travelling_entity_id, destination_coord_x, destination_coord_y, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-travel_systems`),
      entrypoint: "travel",
      calldata: [travelling_entity_id, destination_coord_x, destination_coord_y],
    });
  }

  public async travel_hex(props: SystemProps.TravelHexProps) {
    const { travelling_entity_id, directions, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-travel_systems`),
      entrypoint: "travel_hex",
      calldata: [travelling_entity_id, directions],
    });
  }

  public async set_address_name(props: SystemProps.SetAddressNameProps) {
    const { name, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-name_systems`),
      entrypoint: "set_address_name",
      calldata: [name],
    });
  }

  public async set_entity_name(props: SystemProps.SetEntityNameProps) {
    const { entity_id, name, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-name_systems`),
      entrypoint: "set_entity_name",
      calldata: [entity_id, name],
    });
  }

  public async explore(props: SystemProps.ExploreProps) {
    const { unit_id, direction, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-map_systems`),
      entrypoint: "explore",
      calldata: [unit_id, direction],
    });
  }

  public async create_building(props: SystemProps.CreateBuildingProps) {
    const { entity_id, directions, building_category, produce_resource_type, signer } = props;

    return this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "create",
      calldata: CallData.compile([entity_id, directions, building_category, produce_resource_type]),
    });
  }

  public async destroy_building(props: SystemProps.DestroyBuildingProps) {
    const { entity_id, building_coord, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "destroy",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });
  }

  public async pause_production(props: SystemProps.PauseProductionProps) {
    const { entity_id, building_coord, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "pause_production",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });
  }

  public async resume_production(props: SystemProps.ResumeProductionProps) {
    const { entity_id, building_coord, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "resume_production",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });
  }

  public async create_bank(props: SystemProps.CreateBankProps) {
    const {
      realm_entity_id,
      coord,
      owner_fee_num,
      owner_fee_denom,
      owner_bridge_fee_dpt_percent,
      owner_bridge_fee_wtdr_percent,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
      entrypoint: "create_bank",
      calldata: [
        realm_entity_id,
        coord,
        owner_fee_num,
        owner_fee_denom,
        owner_bridge_fee_dpt_percent,
        owner_bridge_fee_wtdr_percent,
      ],
    });
  }

  public async create_admin_bank(props: SystemProps.CreateAdminBankProps) {
    const {
      name,
      coord,
      owner_fee_num,
      owner_fee_denom,
      owner_bridge_fee_dpt_percent,
      owner_bridge_fee_wtdr_percent,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_bank_systems`),
      entrypoint: "create_admin_bank",
      calldata: [
        name,
        coord,
        owner_fee_num,
        owner_fee_denom,
        owner_bridge_fee_dpt_percent,
        owner_bridge_fee_wtdr_percent,
      ],
    });
  }

  public async open_account(props: SystemProps.OpenAccountProps) {
    const { realm_entity_id, bank_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
      entrypoint: "open_account",
      calldata: [realm_entity_id, bank_entity_id],
    });
  }

  public async change_bank_owner_fee(props: SystemProps.ChangeBankOwnerFeeProps) {
    const { bank_entity_id, new_swap_fee_num, new_swap_fee_denom, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
      entrypoint: "change_owner_amm_fee",
      calldata: [bank_entity_id, new_swap_fee_num, new_swap_fee_denom],
    });
  }

  public async change_bank_bridge_fee(props: SystemProps.ChangeBankBridgeFeeProps) {
    const { bank_entity_id, new_bridge_fee_dpt_percent, new_bridge_fee_wtdr_percent, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
      entrypoint: "change_owner_bridge_fee",
      calldata: [bank_entity_id, new_bridge_fee_dpt_percent, new_bridge_fee_wtdr_percent],
    });
  }

  public async buy_resources(props: SystemProps.BuyResourcesProps) {
    const { bank_entity_id, entity_id, resource_type, amount, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-swap_systems`),
      entrypoint: "buy",
      calldata: [bank_entity_id, entity_id, resource_type, amount],
    });
  }

  public async sell_resources(props: SystemProps.SellResourcesProps) {
    const { bank_entity_id, entity_id, resource_type, amount, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-swap_systems`),
      entrypoint: "sell",
      calldata: [bank_entity_id, entity_id, resource_type, amount],
    });
  }

  public async add_liquidity(props: SystemProps.AddLiquidityProps) {
    const { bank_entity_id, entity_id, calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-liquidity_systems`),
        entrypoint: "add",
        calldata: [bank_entity_id, entity_id, call.resource_type, call.resource_amount, call.lords_amount],
      })),
    );
  }

  public async remove_liquidity(props: SystemProps.RemoveLiquidityProps) {
    const { bank_entity_id, entity_id, resource_type, shares, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-liquidity_systems`),
      entrypoint: "remove",
      calldata: [bank_entity_id, entity_id, resource_type, shares, false],
    });
  }

  public async create_army(props: SystemProps.ArmyCreateProps) {
    const { army_owner_id, is_defensive_army, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_systems`),
      entrypoint: "army_create",
      calldata: [army_owner_id, is_defensive_army],
    });
  }

  public async delete_army(props: SystemProps.ArmyDeleteProps) {
    const { army_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_systems`),
      entrypoint: "army_delete",
      calldata: [army_id],
    });
  }

  public async army_buy_troops(props: SystemProps.ArmyBuyTroopsProps) {
    const { army_id, payer_id, troops, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_systems`),
      entrypoint: "army_buy_troops",
      calldata: [army_id, payer_id, troops.knight_count, troops.paladin_count, troops.crossbowman_count],
    });
  }

  public async army_merge_troops(props: SystemProps.ArmyMergeTroopsProps) {
    const { from_army_id, to_army_id, troops, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-troop_systems`),
      entrypoint: "army_merge_troops",
      calldata: [from_army_id, to_army_id, troops],
    });
  }

  public async battle_start(props: SystemProps.BattleStartProps) {
    const { attacking_army_id, defending_army_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_start",
      calldata: [attacking_army_id, defending_army_id],
    });
  }

  public async battle_force_start(props: SystemProps.BattleForceStartProps) {
    const { battle_id, defending_army_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_force_start",
      calldata: [battle_id, defending_army_id],
    });
  }
  public async battle_join(props: SystemProps.BattleJoinProps) {
    const { battle_id, battle_side, army_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_join",
      calldata: [battle_id, battle_side, army_id],
    });
  }

  public async battle_leave(props: SystemProps.BattleLeaveProps) {
    const { battle_id, army_ids, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      army_ids.map((army_id) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
        entrypoint: "battle_leave",
        calldata: [battle_id, army_id],
      })),
    );
  }

  public async battle_pillage(props: SystemProps.BattlePillageProps) {
    const { army_id, structure_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_pillage_systems`),
      entrypoint: "battle_pillage",
      calldata: [army_id, structure_id],
    });
  }

  public async battle_claim(props: SystemProps.BattleClaimProps) {
    const { army_id, structure_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
      entrypoint: "battle_claim",
      calldata: [army_id, structure_id],
    });
  }

  public async battle_claim_and_leave(props: SystemProps.BattleClaimAndLeaveProps) {
    const { army_id, structure_id, battle_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
        entrypoint: "battle_leave",
        calldata: [battle_id, army_id],
      },
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
        entrypoint: "battle_claim",
        calldata: [army_id, structure_id],
      },
    ]);
  }

  public async battle_leave_and_pillage(props: SystemProps.BattleLeaveAndRaidProps) {
    const { army_id, structure_id, battle_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_systems`),
        entrypoint: "battle_leave",
        calldata: [battle_id, army_id],
      },
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-battle_pillage_systems`),
        entrypoint: "battle_pillage",
        calldata: [army_id, structure_id],
      },
    ]);
  }

  public async mint_starting_resources(props: SystemProps.MintStartingResources) {
    const { realm_entity_id, config_ids, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      config_ids.map((configId) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
        entrypoint: "mint_starting_resources",
        calldata: [configId, realm_entity_id],
      })),
    );
  }

  public async create_guild(props: SystemProps.CreateGuildProps) {
    const { is_public, guild_name, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "create_guild",
      calldata: [is_public, guild_name],
    });
  }

  public async join_guild(props: SystemProps.JoinGuildProps) {
    const { guild_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "join_guild",
      calldata: [guild_entity_id],
    });
  }

  public async whitelist_player(props: SystemProps.WhitelistPlayerProps) {
    const { player_address_to_whitelist, guild_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "whitelist_player",
      calldata: [player_address_to_whitelist, guild_entity_id],
    });
  }

  public async leave_guild(props: SystemProps.LeaveGuild) {
    const { signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "leave_guild",
      calldata: [],
    });
  }

  public async transfer_guild_ownership(props: SystemProps.TransferGuildOwnership) {
    const { guild_entity_id, to_player_address, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "transfer_guild_ownership",
      calldata: [guild_entity_id, to_player_address],
    });
  }

  public async remove_guild_member(props: SystemProps.RemoveGuildMember) {
    const { player_address_to_remove, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "remove_guild_member",
      calldata: [player_address_to_remove],
    });
  }

  public async remove_player_from_whitelist(props: SystemProps.RemovePlayerFromWhitelist) {
    const { player_address_to_remove, guild_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-guild_systems`),
      entrypoint: "remove_player_from_whitelist",
      calldata: [player_address_to_remove, guild_entity_id],
    });
  }

  public async set_quest_config(props: SystemProps.SetQuestConfigProps) {
    const { production_material_multiplier, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_quest_config",
      calldata: [production_material_multiplier],
    });
  }

  public async set_quest_reward_config(props: SystemProps.SetQuestRewardConfigProps) {
    const { calls, signer } = props;
    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_quest_reward_config",
          calldata: [
            call.quest_id,
            call.resources.length,
            ...call.resources.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_map_config(props: SystemProps.SetMapConfigProps) {
    const { config_id, reward_amount, shards_mines_fail_probability, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_map_config",
      calldata: [config_id, reward_amount, shards_mines_fail_probability],
    });
  }

  public async set_travel_stamina_cost_config(props: SystemProps.SetTravelStaminaCostConfigProps) {
    const { travel_type, cost, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_travel_stamina_cost_config",
      calldata: [travel_type, cost],
    });
  }

  public async set_travel_food_cost_config(props: SystemProps.SetTravelFoodCostConfigProps) {
    const {
      config_id,
      unit_type,
      explore_wheat_burn_amount,
      explore_fish_burn_amount,
      travel_wheat_burn_amount,
      travel_fish_burn_amount,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_travel_food_cost_config",
      calldata: [
        config_id,
        unit_type,
        explore_wheat_burn_amount,
        explore_fish_burn_amount,
        travel_wheat_burn_amount,
        travel_fish_burn_amount,
      ],
    });
  }
  public async set_season_config(props: SystemProps.SetSeasonConfigProps) {
    const { season_pass_address, realms_address, lords_address, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_season_config",
      calldata: [season_pass_address, realms_address, lords_address],
    });
  }

  public async set_resource_bridge_whitlelist_config(props: SystemProps.SetResourceBridgeWhitelistConfigProps) {
    const { token, resource_type, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_resource_bridge_whitelist_config",
      calldata: [token, resource_type],
    });
  }

  public async set_resource_bridge_fees_config(props: SystemProps.SetResourceBridgeFeesConfigProps) {
    const {
      velords_fee_on_dpt_percent,
      velords_fee_on_wtdr_percent,
      season_pool_fee_on_dpt_percent,
      season_pool_fee_on_wtdr_percent,
      client_fee_on_dpt_percent,
      client_fee_on_wtdr_percent,
      velords_fee_recipient,
      season_pool_fee_recipient,
      max_bank_fee_dpt_percent,
      max_bank_fee_wtdr_percent,
      signer,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_resource_bridge_fee_split_config",
      calldata: [
        0, // config id
        velords_fee_on_dpt_percent,
        velords_fee_on_wtdr_percent,
        season_pool_fee_on_dpt_percent,
        season_pool_fee_on_wtdr_percent,
        client_fee_on_dpt_percent,
        client_fee_on_wtdr_percent,
        velords_fee_recipient,
        season_pool_fee_recipient,
        max_bank_fee_dpt_percent,
        max_bank_fee_wtdr_percent,
      ],
    });
  }
  public async set_capacity_config(props: SystemProps.SetCapacityConfigProps) {
    const { category, weight_gram, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_capacity_config",
      calldata: [category, weight_gram],
    });
  }

  public async set_speed_config(props: SystemProps.SetSpeedConfigProps) {
    const { entity_type, sec_per_km, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_speed_config",
      calldata: [entity_type, sec_per_km],
    });
  }

  public async set_weight_config(props: SystemProps.SetWeightConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_weight_config",
          calldata: [call.entity_type, call.weight_gram],
        };
      }),
    );
  }

  public async set_tick_config(props: SystemProps.SetTickConfigProps) {
    const { tick_id, tick_interval_in_seconds, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_tick_config",
      calldata: [tick_id, tick_interval_in_seconds],
    });
  }

  public async set_production_config(props: SystemProps.SetProductionConfigProps) {
    const { signer, calls } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_production_config",
          calldata: [
            call.resource_type,
            call.amount,
            call.cost.length,
            ...call.cost.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_bank_config(props: SystemProps.SetBankConfigProps) {
    const { lords_cost, lp_fee_num, lp_fee_denom, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_bank_config",
      calldata: [lords_cost, lp_fee_num, lp_fee_denom],
    });
  }

  public async set_troop_config(props: SystemProps.SetTroopConfigProps) {
    const {
      signer,
      config_id,
      health,
      knight_strength,
      paladin_strength,
      crossbowman_strength,
      advantage_percent,
      disadvantage_percent,
      max_troop_count,
      pillage_health_divisor,
      army_free_per_structure,
      army_extra_per_military_building,
      army_max_per_structure,
      battle_leave_slash_num,
      battle_leave_slash_denom,
      battle_time_scale,
      battle_max_time_seconds,
    } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_troop_config",
      calldata: [
        config_id,
        health,
        knight_strength,
        paladin_strength,
        crossbowman_strength,
        advantage_percent,
        disadvantage_percent,
        max_troop_count,
        pillage_health_divisor,
        army_free_per_structure,
        army_extra_per_military_building,
        army_max_per_structure,
        battle_leave_slash_num,
        battle_leave_slash_denom,
        battle_time_scale,
        battle_max_time_seconds,
      ],
    });
  }

  public async set_battle_config(props: SystemProps.SetBattleConfigProps) {
    const { signer, config_id, battle_grace_tick_count, battle_delay_seconds } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_battle_config",
      calldata: [config_id, battle_grace_tick_count, battle_delay_seconds],
    });
  }

  public async set_building_category_pop_config(props: SystemProps.SetBuildingCategoryPopConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_building_category_pop_config",
          calldata: [call.building_category, call.population, call.capacity],
        };
      }),
    );
  }

  public async set_building_general_config(props: SystemProps.SetBuildingGeneralConfigProps) {
    const { base_cost_percent_increase, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_building_general_config",
      calldata: [base_cost_percent_increase],
    });
  }

  public async set_population_config(props: SystemProps.SetPopulationConfigProps) {
    const { base_population, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_population_config",
      calldata: [base_population],
    });
  }

  public async set_realm_level_config(props: SystemProps.setRealmUpgradeConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_realm_level_config",
          calldata: [
            call.level,
            call.cost_of_level.length,
            ...call.cost_of_level.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_realm_max_level_config(props: SystemProps.SetRealmMaxLevelConfigProps) {
    const { new_max_level, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_realm_max_level_config",
      calldata: [new_max_level],
    });
  }

  public async set_building_config(props: SystemProps.SetBuildingConfigProps) {
    const { calls, signer } = props;

    return await this.executeAndCheckTransaction(
      signer,
      calls.map((call) => {
        return {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
          entrypoint: "set_building_config",
          calldata: [
            call.building_category,
            call.building_resource_type,
            call.cost_of_building.length,
            ...call.cost_of_building.flatMap(({ resource, amount }) => [resource, amount]),
          ],
        };
      }),
    );
  }

  public async set_hyperstructure_config(props: SystemProps.SetHyperstructureConfig) {
    const {
      resources_for_completion,
      time_between_shares_change,
      points_per_cycle,
      points_for_win,
      points_on_completion,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_hyperstructure_config",
      calldata: [
        resources_for_completion,
        time_between_shares_change,
        points_per_cycle,
        points_for_win,
        points_on_completion,
      ],
    });
  }

  public async create_hyperstructure(props: SystemProps.CreateHyperstructureProps) {
    const { creator_entity_id, coords, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "create",
      calldata: [creator_entity_id, coords],
    });
  }

  public async contribute_to_construction(props: SystemProps.ContributeToConstructionProps) {
    const { hyperstructure_entity_id, contributor_entity_id, contributions, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "contribute_to_construction",
      calldata: [hyperstructure_entity_id, contributor_entity_id, contributions],
    });
  }

  public async set_access(props: SystemProps.SetAccessProps) {
    const { hyperstructure_entity_id, access, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "set_access",
      calldata: [hyperstructure_entity_id, access],
    });
  }

  public async end_game(props: SystemProps.EndGameProps) {
    const { signer, hyperstructure_contributed_to, hyperstructure_shareholder_epochs } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "end_game",
      calldata: [hyperstructure_contributed_to, hyperstructure_shareholder_epochs],
    });
  }

  public async set_co_owners(props: SystemProps.SetCoOwnersProps) {
    const { hyperstructure_entity_id, co_owners, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-hyperstructure_systems`),
      entrypoint: "set_co_owners",
      calldata: [hyperstructure_entity_id, co_owners],
    });
  }

  public async set_stamina_config(props: SystemProps.SetStaminaConfigProps) {
    const { unit_type, max_stamina, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_stamina_config",
      calldata: [unit_type, max_stamina],
    });
  }

  public async set_stamina_refill_config(props: SystemProps.SetStaminaRefillConfigProps) {
    const { amount_per_tick, start_boost_tick_count, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_stamina_refill_config",
      calldata: [amount_per_tick, start_boost_tick_count],
    });
  }

  public async set_mercenaries_config(props: SystemProps.SetMercenariesConfigProps) {
    const {
      knights_lower_bound,
      knights_upper_bound,
      paladins_lower_bound,
      paladins_upper_bound,
      crossbowmen_lower_bound,
      crossbowmen_upper_bound,
      rewards,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_mercenaries_config",
      calldata: [
        knights_lower_bound,
        knights_upper_bound,
        paladins_lower_bound,
        paladins_upper_bound,
        crossbowmen_lower_bound,
        crossbowmen_upper_bound,
        rewards,
      ],
    });
  }

  public async set_settlement_config(props: SystemProps.SetSettlementConfigProps) {
    const {
      radius,
      angle_scaled,
      center,
      min_distance,
      max_distance,
      min_scaling_factor_scaled,
      min_angle_increase,
      max_angle_increase,
      signer,
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_settlement_config",
      calldata: [
        radius,
        angle_scaled,
        center,
        min_distance,
        max_distance,
        min_scaling_factor_scaled,
        min_angle_increase,
        max_angle_increase,
      ],
    });
  }

  public async mint_test_realm(props: SystemProps.MintTestRealmProps) {
    const {
      token_id,
      signer,
      realms_address, // Should this be dynamically fetched from season config or passed to provider instead of prop?
    } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: realms_address.toString(),
      entrypoint: "mint",
      calldata: [uint256.bnToUint256(token_id)],
    });
  }

  public async mint_season_passes(props: SystemProps.MintSeasonPassesProps) {
    const {
      recipient,
      token_ids,
      signer,
      season_pass_address, // Should this be dynamically fetched from season config instead of prop?
    } = props;
    const multicall = token_ids.map((token) => {
      return {
        contractAddress: season_pass_address.toString(),
        entrypoint: "mint",
        calldata: [recipient, uint256.bnToUint256(token)],
      };
    });
    return await this.executeAndCheckTransaction(signer, multicall);
  }
}
