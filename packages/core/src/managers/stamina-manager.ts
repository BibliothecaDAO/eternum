import { ClientComponents, ID, Troops, TroopTier, TroopType } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
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

    return StaminaManager.getStamina(troops, currentArmiesTick);
  }

  public static getStamina(troops: Troops, currentArmiesTick: number) {

    const lastRefillTick = troops.stamina.updated_tick;
    if (lastRefillTick >= BigInt(currentArmiesTick)) {
      return structuredClone(troops.stamina);
    }

    const staminaPerTick = configManager.getRefillPerTick();
    let boostStaminaPerTick = staminaPerTick * troops.boosts.incr_stamina_regen_percent_num / 10_000;
    let boostNumTicksPassed = Math.min(currentArmiesTick - Number(lastRefillTick), troops.boosts.incr_stamina_regen_tick_count);
    let additionalStaminaBoost = boostNumTicksPassed * boostStaminaPerTick;

    const newStamina = this.refill(
      currentArmiesTick,
      lastRefillTick,
      this.getMaxStamina(troops.category as TroopType, troops.tier as TroopTier),
      Number(troops.stamina.amount),
      additionalStaminaBoost,
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
    additionalStaminaBoost?: number,
  ) {
    const staminaPerTick = configManager.getRefillPerTick();
    const numTicksPassed = currentArmiesTick - Number(last_refill_tick);
    const totalStaminaSinceLastTick = (numTicksPassed * staminaPerTick) + (additionalStaminaBoost ?? 0);

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
