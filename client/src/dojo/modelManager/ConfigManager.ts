import { divideByPrecision } from "@/ui/utils/utils";
import {
  BUILDING_CATEGORY_POPULATION_CONFIG_ID,
  BuildingType,
  CapacityConfigCategory,
  TickIds,
  TravelTypes,
  WORLD_CONFIG_ID,
} from "@bibliothecadao/eternum";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ContractComponents } from "../contractComponents";

export class ClientConfigManager {
  private static _instance: ClientConfigManager;
  private components!: ContractComponents;

  private isDojoSet() {
    if (!this.components) {
      return false;
    }
    return true;
  }

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
    if (!this.isDojoSet()) return 0;

    const staminaConfig = getComponentValue(
      this.components.TravelStaminaCostConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TravelTypes.Travel)]),
    );
    return staminaConfig?.cost ?? 0;
  }

  getExploreStaminaCost() {
    if (!this.isDojoSet()) return 0;

    const staminaConfig = getComponentValue(
      this.components.TravelStaminaCostConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(TravelTypes.Explore)]),
    );
    return staminaConfig?.cost ?? 0;
  }

  getExploreReward() {
    if (!this.isDojoSet()) return 0;

    const exploreConfig = getComponentValue(this.components.MapConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return divideByPrecision(Number(exploreConfig?.reward_resource_amount ?? 0));
  }

  getTroopConfig() {
    if (!this.isDojoSet()) {
      return {
        health: 0,
        knightStrength: 0,
        paladinStrength: 0,
        crossbowmanStrength: 0,
        advantagePercent: 0,
        disadvantagePercent: 0,
        maxTroopCount: 0,
        pillageHealthDivisor: 0,
        baseArmyNumberForStructure: 0,
        armyExtraPerMilitaryBuilding: 0,
        maxArmiesPerStructure: 0,
        battleLeaveSlashNum: 0,
        battleLeaveSlashDenom: 0,
        battleTimeScale: 0,
      };
    }

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
    if (!this.isDojoSet()) return 0;

    const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    return Number(battleConfig?.battle_grace_tick_count);
  }

  getBattleDelay() {
    if (!this.isDojoSet()) return 0;

    const battleConfig = getComponentValue(this.components.BattleConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return Number(battleConfig?.battle_delay_seconds);
  }

  getTick(tickId: TickIds) {
    if (!this.isDojoSet()) return 0;

    const tickConfig = getComponentValue(
      this.components.TickConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(tickId)]),
    );

    return Number(tickConfig?.tick_interval_in_seconds);
  }

  getBankConfig() {
    if (!this.isDojoSet()) {
      return {
        lordsCost: 0,
        lpFeesNumerator: 0,
        lpFeesDenominator: 0,
      };
    }

    const bankConfig = getComponentValue(this.components.BankConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));

    return {
      lordsCost: divideByPrecision(Number(bankConfig?.lords_cost)),
      lpFeesNumerator: Number(bankConfig?.lp_fee_num ?? 0),
      lpFeesDenominator: Number(bankConfig?.lp_fee_denom ?? 0),
    };
  }

  getCapacityConfig(category: CapacityConfigCategory) {
    if (!this.isDojoSet()) {
      return 0;
    }

    const capacityConfig = getComponentValue(this.components.CapacityConfig, getEntityIdFromKeys([BigInt(category)]));
    return Number(capacityConfig?.weight_gram);
  }

  getSpeedConfig(entityType: number): number {
    if (!this.isDojoSet()) {
      return 0;
    }

    const speedConfig = getComponentValue(
      this.components.SpeedConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(entityType)]),
    );

    return speedConfig?.sec_per_km ?? 0;
  }

  getBuildingPopConfig(buildingId: BuildingType): {
    population: number;
    capacity: number;
  } {
    if (!this.isDojoSet()) {
      return {
        population: 0,
        capacity: 0,
      };
    }
    const buildingConfig = getComponentValue(
      this.components.BuildingCategoryPopConfig,
      getEntityIdFromKeys([BUILDING_CATEGORY_POPULATION_CONFIG_ID, BigInt(buildingId)]),
    );

    return {
      population: buildingConfig?.population ?? 0,
      capacity: buildingConfig?.capacity ?? 0,
    };
  }
}
