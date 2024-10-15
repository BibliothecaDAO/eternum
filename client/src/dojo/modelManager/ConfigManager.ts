import { TravelTypes, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
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
    const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    return battleConfig?.battle_grace_tick_count!;
  }

  getBattleDelay() {
    const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    return battleConfig?.battle_delay_seconds!;
  }
}
