import { DojoProvider } from "@dojoengine/core";
import EventEmitter from "eventemitter3";
import { Account, AccountInterface, AllowArray, Call, CallData } from "starknet";
// import { EternumGlobalConfig } from "../constants";
import * as SystemProps from "../types/provider";

export const NAMESPACE = "eternum";

export const getContractByName = (manifest: any, name: string) => {
  const contract = manifest.contracts.find((contract: any) => contract.tag === name);
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

    // implement that in ui instead
    // let maker_gives_resource = maker_gives_resource_amounts.flatMap((amount, i) => {
    //   return [maker_gives_resource_types[i], amount];
    // });

    // let taker_gives_resource = taker_gives_resource_amounts.flatMap((amount, i) => {
    //   return [taker_gives_resource_types[i], amount];
    // });

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

  public async mint_resources_and_claim_quest(props: SystemProps.MintResourcesAndClaimProps) {
    const { receiver_id, resources, config_ids, signer } = props;

    const calldata = [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_resource_systems`),
        entrypoint: "mint",
        calldata: [receiver_id, resources.length / 2, ...resources],
      },
      ...config_ids.map((configId) => ({
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
        entrypoint: "mint_starting_resources",
        calldata: [configId, receiver_id],
      })),
    ];

    return await this.executeAndCheckTransaction(signer, calldata);
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

    const tx = await this.execute(
      signer,
      [
        {
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
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
      ],
      NAMESPACE,
    );
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
          contractAddress: getContractByName(this.manifest, `${NAMESPACE}-realm_systems`),
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

    return await this.executeAndCheckTransaction(signer, calldata);
  };

  public async create_road(props: SystemProps.CreateRoadProps) {
    const { creator_id, start_coord, end_coord, usage_count, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-road_systems`),
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
  }

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

  public async level_up_realm(props: SystemProps.LevelUpRealmProps) {
    const { realm_entity_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-leveling_systems`),
      entrypoint: "level_up_realm",
      calldata: [realm_entity_id],
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
    const { entity_id, building_coord, building_category, produce_resource_type, signer } = props;

    return this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-building_systems`),
      entrypoint: "destroy",
      calldata: [entity_id, building_coord.x, building_coord.y],
    });
  }

  public async create_bank(props: SystemProps.CreateBankProps) {
    const { realm_entity_id, coord, owner_fee_num, owner_fee_denom, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-bank_systems`),
      entrypoint: "create_bank",
      calldata: [realm_entity_id, coord, owner_fee_num, owner_fee_denom],
    });
  }

  public async create_admin_bank(props: SystemProps.CreateAdminBankProps) {
    const { coord, owner_fee_num, owner_fee_denom, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-dev_bank_systems`),
      entrypoint: "create_admin_bank",
      calldata: [coord, owner_fee_num, owner_fee_denom],
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
      entrypoint: "change_owner_fee",
      calldata: [bank_entity_id, new_swap_fee_num, new_swap_fee_denom],
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
    const { bank_entity_id, entity_id, resource_type, resource_amount, lords_amount, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-liquidity_systems`),
      entrypoint: "add",
      calldata: [bank_entity_id, entity_id, resource_type, resource_amount, lords_amount],
    });
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
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "army_create",
      calldata: [army_owner_id, is_defensive_army],
    });
  }

  public async delete_army(props: SystemProps.ArmyDeleteProps) {
    const { army_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "army_delete",
      calldata: [army_id],
    });
  }

  public async army_buy_troops(props: SystemProps.ArmyBuyTroopsProps) {
    const { army_id, payer_id, troops, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "army_buy_troops",
      calldata: [army_id, payer_id, troops.knight_count, troops.paladin_count, troops.crossbowman_count],
    });
  }

  public async army_merge_troops(props: SystemProps.ArmyMergeTroopsProps) {
    const { from_army_id, to_army_id, troops, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "army_merge_troops",
      calldata: [from_army_id, to_army_id, troops],
    });
  }

  public async battle_start(props: SystemProps.BattleStartProps) {
    const { attacking_army_id, defending_army_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "battle_start",
      calldata: [attacking_army_id, defending_army_id],
    });
  }

  public async battle_join(props: SystemProps.BattleJoinProps) {
    const { battle_id, battle_side, army_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "battle_join",
      calldata: [battle_id, battle_side, army_id],
    });
  }

  public async battle_leave(props: SystemProps.BattleLeaveProps) {
    const { battle_id, army_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "battle_leave",
      calldata: [battle_id, army_id],
    });
  }

  public async battle_pillage(props: SystemProps.BattlePillageProps) {
    const { army_id, structure_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "battle_pillage",
      calldata: [army_id, structure_id],
    });
  }

  public async battle_claim(props: SystemProps.BattleClaimProps) {
    const { army_id, structure_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
      entrypoint: "battle_claim",
      calldata: [army_id, structure_id],
    });
  }

  public async battle_claim_and_leave(props: SystemProps.BattleClaimAndLeaveProps) {
    const { army_id, structure_id, battle_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
        entrypoint: "battle_leave",
        calldata: [battle_id, army_id],
      },
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
        entrypoint: "battle_claim",
        calldata: [army_id, structure_id],
      },
    ]);
  }

  public async battle_leave_and_pillage(props: SystemProps.BattleLeaveAndRaidProps) {
    const { army_id, structure_id, battle_id, signer } = props;

    return await this.executeAndCheckTransaction(signer, [
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
        entrypoint: "battle_leave",
        calldata: [battle_id, army_id],
      },
      {
        contractAddress: getContractByName(this.manifest, `${NAMESPACE}-combat_systems`),
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

  public async set_mint_config(props: SystemProps.SetMintConfigProps) {
    const { config_id, resources, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_mint_config",
      calldata: [config_id, resources.length, ...resources.flatMap(({ resource, amount }) => [resource, amount])],
    });
  }

  public async set_exploration_config(props: SystemProps.SetExplorationConfigProps) {
    const { wheat_burn_amount, fish_burn_amount, reward_amount, shards_mines_fail_probability, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_exploration_config",
      calldata: [wheat_burn_amount, fish_burn_amount, reward_amount, shards_mines_fail_probability],
    });
  }

  public async set_capacity_config(props: SystemProps.SetCapacityConfigProps) {
    const { entity_type, weight_gram, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_capacity_config",
      calldata: [entity_type, weight_gram],
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
      pillage_health_divisor,
      army_free_per_structure,
      army_extra_per_military_building,
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
        pillage_health_divisor,
        army_free_per_structure,
        army_extra_per_military_building,
      ],
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

  public async set_population_config(props: SystemProps.SetPopulationConfigProps) {
    const { base_population, signer } = props;

    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_population_config",
      calldata: [base_population],
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
    const { resources_for_completion, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_hyperstructure_config",
      calldata: [resources_for_completion],
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

  public async set_stamina_config(props: SystemProps.SetStaminaConfigProps) {
    const { unit_type, max_stamina, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_stamina_config",
      calldata: [unit_type, max_stamina],
    });
  }

  public async set_mercenaries_config(props: SystemProps.SetMercenariesConfigProps) {
    const { troops, rewards, signer } = props;
    return await this.executeAndCheckTransaction(signer, {
      contractAddress: getContractByName(this.manifest, `${NAMESPACE}-config_systems`),
      entrypoint: "set_mercenaries_config",
      calldata: [troops, rewards],
    });
  }
}
