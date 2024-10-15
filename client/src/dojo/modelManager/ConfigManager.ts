import { EternumGlobalConfig, TravelTypes, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

import { ContractComponents } from "../contractComponents";

export class ClientConfigManager {
  private static _instance: ClientConfigManager;
  private components!: ContractComponents;

  public setDojo(components: ContractComponents) {
    this.components = components;
  }

  public static instance(): ClientConfigManager {
    if (!ClientConfigManager._instance) {
      ClientConfigManager._instance = new ClientConfigManager();
    }
    return ClientConfigManager._instance;
  }

  getStaminaTravelConfig() {
    const staminaConfig = getComponentValue(
      this.components.TravelStaminaCostConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TravelTypes.Travel)]),
    );
    return staminaConfig?.cost!;
  }

  getStaminaExploreConfig() {
    const staminaConfig = getComponentValue(
      this.components.TravelStaminaCostConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TravelTypes.Explore)]),
    );
    return staminaConfig?.cost!;
  }

  getBattleGraceTickCount() {
    //  TODO: This is not working for some reason // sync issue
    const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return EternumGlobalConfig.battle.graceTickCount;
  }

  getBattleDelay() {
    //  TODO: This is not working for some reason
    const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return EternumGlobalConfig.battle.delaySeconds;
  }
}
