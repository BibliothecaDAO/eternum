import { ClientComponents, ID, Troops, TroopType } from "@bibliothecadao/types";
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
    const last_refill_tick = troops.stamina?.updated_tick ?? 0n;

    if (last_refill_tick >= BigInt(currentArmiesTick)) {
      return structuredClone(troops.stamina);
    }

    const newStamina = this.refill(
      currentArmiesTick,
      last_refill_tick,
      this.getMaxStamina(troops.category as TroopType),
      Number(troops.stamina.amount),
    );

    return newStamina;
  }

  public static getMaxStamina = (troopCategory: TroopType): number => {
    const staminaConfig = configManager.getTroopStaminaConfig(troopCategory);
    return staminaConfig.staminaMax;
  };

  private static refill(currentArmiesTick: number, last_refill_tick: bigint, maxStamina: number, amount: number) {
    const staminaPerTick = configManager.getRefillPerTick();

    const numTicksPassed = currentArmiesTick - Number(last_refill_tick);

    const totalStaminaSinceLastTick = numTicksPassed * staminaPerTick;

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
