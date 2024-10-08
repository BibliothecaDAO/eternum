import { ID, ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "../createClientComponents";
import { SetupResult } from "../setup";

export class StaminaManager {
  constructor(
    private setup: SetupResult,
    private armyEntityId: ID,
  ) {}

  public getStaminaConfig() {
    const knightConfig = getComponentValue(
      this.setup.components.StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Knight)]),
    );
    const crossbowmanConfig = getComponentValue(
      this.setup.components.StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Crossbowman)]),
    );
    const paladinConfig = getComponentValue(
      this.setup.components.StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Paladin)]),
    );

    return {
      knightConfig: knightConfig?.max_stamina ?? 0,
      crossbowmanConfig: crossbowmanConfig?.max_stamina ?? 0,
      paladinConfig: paladinConfig?.max_stamina ?? 0,
    };
  }

  public getStamina(currentArmiesTick: number) {
    let armyOnchainStamina = getComponentValue(
      this.setup.components.Stamina,
      getEntityIdFromKeys([BigInt(this.armyEntityId)]),
    );
    if (!armyOnchainStamina) {
      return { ...DEFAULT_STAMINA, entity_id: this.armyEntityId };
    }

    const armyEntityId = getComponentValue(
      this.setup.components.Army,
      getEntityIdFromKeys([BigInt(this.armyEntityId)]),
    );
    if (!armyEntityId) {
      return { ...DEFAULT_STAMINA, entity_id: this.armyEntityId };
    }

    const last_refill_tick = armyOnchainStamina?.last_refill_tick;

    if (last_refill_tick >= BigInt(currentArmiesTick)) {
      return structuredClone(armyOnchainStamina);
    }

    const newStamina = this.refill(currentArmiesTick, last_refill_tick, armyOnchainStamina.amount);

    return newStamina;
  }

  public getMaxStamina = (troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]> | undefined): number => {
    let maxStaminas: number[] = [];
    const staminaConfig = this.getStaminaConfig();
    if ((troops?.knight_count ?? 0) > 0) {
      maxStaminas.push(staminaConfig.knightConfig);
    }
    if ((troops?.crossbowman_count ?? 0) > 0) {
      maxStaminas.push(staminaConfig.crossbowmanConfig);
    }
    if ((troops?.paladin_count ?? 0) > 0) {
      maxStaminas.push(staminaConfig.paladinConfig);
    }

    if (maxStaminas.length === 0) return 0;

    const maxArmyStamina = Math.min(...maxStaminas);

    return maxArmyStamina;
  };

  private refill(currentArmiesTick: number, last_refill_tick: bigint, amount: number) {
    const staminaPerTick = this.getRefillPerTick();

    const numTicksPassed = currentArmiesTick - Number(last_refill_tick);

    const totalStaminaSinceLastTick = numTicksPassed * staminaPerTick;

    const maxStamina = this.getMaxStamina(
      getComponentValue(this.setup.components.Army, getEntityIdFromKeys([BigInt(this.armyEntityId)]))?.troops,
    );
    const newAmount = Math.min(amount + totalStaminaSinceLastTick, maxStamina);

    return {
      entity_id: this.armyEntityId,
      amount: newAmount,
      last_refill_tick: BigInt(currentArmiesTick),
    };
  }

  private getRefillPerTick() {
    const staminaRefillConfig = getComponentValue(
      this.setup.components.StaminaRefillConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    );
    return staminaRefillConfig?.amount_per_tick || 0;
  }
}

const DEFAULT_STAMINA = {
  amount: 0,
  last_refill_tick: 0n,
};
