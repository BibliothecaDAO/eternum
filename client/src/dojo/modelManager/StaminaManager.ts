import { ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { SetupResult } from "../setup";

export class StaminaManager {
  constructor(
    private setup: SetupResult,
    private armyEntity: Entity,
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
      knightConfig: knightConfig!.max_stamina,
      crossbowmanConfig: crossbowmanConfig!.max_stamina,
      paladinConfig: paladinConfig!.max_stamina,
    };
  }

  public getStamina(currentArmiesTick: number) {
    let armyOnchainStamina = getComponentValue(this.setup.components.Stamina, this.armyEntity);
    if (!armyOnchainStamina) {
      throw Error("no onchain stamina found for army");
    }

    const armyEntity = getComponentValue(this.setup.components.Army, this.armyEntity);
    if (!armyEntity) {
      throw Error("no army for army");
    }

    const last_refill_tick = armyOnchainStamina?.last_refill_tick;

    if (last_refill_tick === BigInt(currentArmiesTick)) {
      return armyOnchainStamina;
    }

    const newStamina = this.refill(currentArmiesTick, last_refill_tick, armyOnchainStamina.amount);

    return { entity_id: armyEntity.entity_id, ...newStamina };
  }

  public maxStamina = (troops: any): number => {
    let maxStaminas: number[] = [];
    const staminaConfig = this.getStaminaConfig();
    if (troops.knight_count > 0) {
      maxStaminas.push(staminaConfig.knightConfig);
    }
    if (troops.crossbowman_count > 0) {
      maxStaminas.push(staminaConfig.crossbowmanConfig);
    }
    if (troops.paladin_count > 0) {
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

    const maxStamina = this.maxStamina(getComponentValue(this.setup.components.Army, this.armyEntity)?.troops);
    const newAmount = Math.min(amount + totalStaminaSinceLastTick, maxStamina);

    return {
      amount: newAmount,
      last_refill_tick: BigInt(currentArmiesTick),
    };
  }
  private getRefillPerTick() {
    const staminaRefillConfig = getComponentValue(
      this.setup.components.StaminaRefillConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID]),
    );
    if (!staminaRefillConfig) throw new Error("no stamina refill config");
    return staminaRefillConfig.amount_per_tick;
  }
}
