import { divideByPrecision } from "@/ui/utils/utils";
import { TickIds, TravelTypes, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
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

  getTravelStaminaCost() {
    const staminaConfig = getComponentValue(
      this.components.TravelStaminaCostConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TravelTypes.Travel)]),
    );
    return staminaConfig?.cost!;
  }

  getExploreStaminaCost() {
    const staminaConfig = getComponentValue(
      this.components.TravelStaminaCostConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TravelTypes.Explore)]),
    );
    return staminaConfig?.cost!;
  }

  getExploreReward() {
    const exploreConfig = getComponentValue(this.components.MapConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return divideByPrecision(Number(exploreConfig?.reward_resource_amount ?? 0));
  }

  getTroopConfig() {
    const troopConfig = getComponentValue(this.components.TroopConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return {
      health: troopConfig?.health ?? 0,
      knightStrength: troopConfig?.knight_strength ?? 0,
      paladinStrength: troopConfig?.paladin_strength ?? 0,
      crossbowmanStrength: troopConfig?.crossbowman_strength ?? 0,
      advantagePercent: troopConfig?.advantage_percent ?? 0,
      disadvantagePercent: troopConfig?.disadvantage_percent ?? 0,
      maxTroopCount: divideByPrecision(troopConfig?.max_troop_count ?? 0),
      pillageHealthDivisor: troopConfig?.pillage_health_divisor ?? 0,
      baseArmyNumberForStructure: troopConfig?.army_free_per_structure ?? 0,
      armyExtraPerMilitaryBuilding: troopConfig?.army_extra_per_building ?? 0,
      maxArmiesPerStructure: troopConfig?.army_max_per_structure ?? 0,
      battleLeaveSlashNum: troopConfig?.battle_leave_slash_num ?? 0,
      battleLeaveSlashDenom: troopConfig?.battle_leave_slash_denom ?? 0,
      battleTimeScale: troopConfig?.battle_time_scale ?? 0,
    };
  }

  getBattleGraceTickCount() {
    const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    return Number(battleConfig?.battle_grace_tick_count);
  }

  getBattleDelay() {
    const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return Number(battleConfig?.battle_delay_seconds);
  }

  getTick(tickId: TickIds) {
    const tickConfig = getComponentValue(
      this.components.TickConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(tickId)]),
    );

    return Number(tickConfig?.tick_interval_in_seconds);
  }
}
