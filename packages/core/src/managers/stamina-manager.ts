import { ClientComponents, ID, RELICS, ResourcesIds, Troops, TroopTier, TroopType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getArmyRelicEffects } from "../utils/relic";
import { configManager } from "./config-manager";

export class StaminaManager {
  constructor(
    private components: ClientComponents,
    private armyEntityId: ID,
  ) {}

  public getStamina(currentArmiesTick: number) {
    let armyOnchainStamina = getComponentValue(
      this.components.ExplorerTroops,
      getEntityIdFromKeys([BigInt(this.armyEntityId)]),
    )?.troops.stamina;

    if (!armyOnchainStamina) {
      return { ...DEFAULT_STAMINA, entity_id: this.armyEntityId };
    }

    const troops = getComponentValue(
      this.components.ExplorerTroops,
      getEntityIdFromKeys([BigInt(this.armyEntityId)]),
    )?.troops;

    if (!troops) return { ...DEFAULT_STAMINA, entity_id: this.armyEntityId };

    const activeRelicEffects = getArmyRelicEffects(troops.boosts, currentArmiesTick).map((relic) => relic.id);

    return StaminaManager.getStamina(troops, currentArmiesTick, activeRelicEffects);
  }

  public static getStamina(troops: Troops, currentArmiesTick: number, activeRelicEffects: ResourcesIds[]) {
    const staminaEffects = RELICS.filter((relic) => activeRelicEffects.includes(relic.id) && relic.type === "Stamina");

    const last_refill_tick = troops.stamina.updated_tick;

    if (last_refill_tick >= BigInt(currentArmiesTick)) {
      return structuredClone(troops.stamina);
    }

    const newStamina =
      staminaEffects.length > 0
        ? this.refill(
            currentArmiesTick,
            last_refill_tick,
            this.getMaxStamina(troops.category as TroopType, troops.tier as TroopTier),
            Number(troops.stamina.amount),
            Math.max(...staminaEffects.map((relic) => relic.bonus)),
          )
        : this.refill(
            currentArmiesTick,
            last_refill_tick,
            this.getMaxStamina(troops.category as TroopType, troops.tier as TroopTier),
            Number(troops.stamina.amount),
          );

    return newStamina;
  }

  public static getMaxStamina = (troopCategory: TroopType, troopTier: TroopTier): number => {
    const staminaConfig = configManager.getTroopStaminaConfig(troopCategory, troopTier);
    return staminaConfig.staminaMax;
  };

  private static refill(
    currentArmiesTick: number,
    last_refill_tick: bigint,
    maxStamina: number,
    amount: number,
    staminaMultiplier?: number,
  ) {
    const staminaPerTick = configManager.getRefillPerTick();

    const numTicksPassed = currentArmiesTick - Number(last_refill_tick);

    // Apply stamina relic multiplier to the regeneration rate if provided
    const enhancedStaminaPerTick = staminaMultiplier ? staminaPerTick * staminaMultiplier : staminaPerTick;
    const totalStaminaSinceLastTick = numTicksPassed * enhancedStaminaPerTick;

    const newAmount = Math.min(amount + totalStaminaSinceLastTick, maxStamina);

    return {
      amount: BigInt(newAmount),
      updated_tick: BigInt(currentArmiesTick),
    };
  }
}

const DEFAULT_STAMINA = {
  amount: 0n,
  last_refill_tick: 0n,
};
