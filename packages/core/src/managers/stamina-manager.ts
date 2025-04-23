import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { WORLD_CONFIG_ID, ClientComponents, ID, Troops, TroopType } from "@bibliothecadao/types";
import { configManager } from "./config-manager";

export class StaminaManager {
  constructor(
    private components: ClientComponents,
    private armyEntityId: ID,
  ) { }

  public static getStaminaConfig(troopType: TroopType) {
    return configManager.getTroopStaminaConfig(troopType);
  }

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

    const maxStamina = StaminaManager.getMaxStamina(troops);

    const staminaValue = {
      amount: armyOnchainStamina.amount,
      updated_tick: armyOnchainStamina.updated_tick,
      maxStamina: maxStamina,
    };

    return StaminaManager.getStamina(staminaValue, maxStamina, currentArmiesTick, this.components);
  }

  public static getStamina(
    staminaValue: { amount: bigint; updated_tick: bigint },
    maxStamina: number,
    currentArmiesTick: number,
    components: ClientComponents,
  ) {
    const last_refill_tick = staminaValue.updated_tick;

    if (last_refill_tick >= BigInt(currentArmiesTick)) {
      return structuredClone(staminaValue);
    }

    const newStamina = this.refill(
      currentArmiesTick,
      last_refill_tick,
      maxStamina,
      Number(staminaValue.amount),
      components,
    );

    return newStamina;
  }

  public static getMaxStamina = (troops: Troops | undefined): number => {
    const staminaConfig = this.getStaminaConfig(troops?.category as TroopType);
    return staminaConfig.staminaMax;
  };

  private static refill(
    currentArmiesTick: number,
    last_refill_tick: bigint,
    maxStamina: number,
    amount: number,
    components: ClientComponents,
  ) {
    const staminaPerTick = this.getRefillPerTick(components);

    const numTicksPassed = currentArmiesTick - Number(last_refill_tick);

    const totalStaminaSinceLastTick = numTicksPassed * staminaPerTick;

    const newAmount = Math.min(amount + totalStaminaSinceLastTick, maxStamina);

    return {
      amount: BigInt(newAmount),
      updated_tick: BigInt(currentArmiesTick),
    };
  }

  private static getRefillPerTick(components: ClientComponents) {
    const staminaRefillConfig = getComponentValue(
      components.WorldConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    )?.troop_stamina_config;
    return staminaRefillConfig?.stamina_gain_per_tick || 0;
  }
}

const DEFAULT_STAMINA = {
  amount: 0n,
  last_refill_tick: 0n,
};
