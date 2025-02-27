import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { WORLD_CONFIG_ID } from "../constants";
import { ClientComponents } from "../dojo/create-client-components";
import { ID, Troops, TroopType } from "../types";
import { configManager } from "./config-manager";

export class StaminaManager {
  constructor(
    private components: ClientComponents,
    private armyEntityId: ID,
  ) {}

  public getStaminaConfig(troopType: TroopType) {
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

    const last_refill_tick = armyOnchainStamina?.updated_tick;

    if (last_refill_tick >= BigInt(currentArmiesTick)) {
      return structuredClone(armyOnchainStamina);
    }

    const newStamina = this.refill(currentArmiesTick, last_refill_tick, Number(armyOnchainStamina.amount));

    return newStamina;
  }

  public getMaxStamina = (troops: Troops | undefined): number => {
    const staminaConfig = this.getStaminaConfig(troops?.category as TroopType);
    return staminaConfig.staminaMax;
  };

  private refill(currentArmiesTick: number, last_refill_tick: bigint, amount: number) {
    const staminaPerTick = this.getRefillPerTick();

    const numTicksPassed = currentArmiesTick - Number(last_refill_tick);

    const totalStaminaSinceLastTick = numTicksPassed * staminaPerTick;

    const maxStamina = this.getMaxStamina(
      getComponentValue(this.components.ExplorerTroops, getEntityIdFromKeys([BigInt(this.armyEntityId)]))?.troops,
    );
    const newAmount = Math.min(amount + totalStaminaSinceLastTick, maxStamina);

    return {
      entity_id: this.armyEntityId,
      amount: BigInt(newAmount),
      updated_tick: BigInt(currentArmiesTick),
    };
  }

  private getRefillPerTick() {
    const staminaRefillConfig = getComponentValue(
      this.components.WorldConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    )?.troop_stamina_config;
    return staminaRefillConfig?.stamina_gain_per_tick || 0;
  }
}

const DEFAULT_STAMINA = {
  amount: 0n,
  last_refill_tick: 0n,
};
