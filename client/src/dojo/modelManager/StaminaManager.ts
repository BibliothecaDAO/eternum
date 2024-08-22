import { getCurrentArmiesTick } from "@/three/helpers/ticks";
import { ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { SetupResult } from "../setup";

export class StaminaManager {
  constructor(
    private setup: SetupResult,
    private entity: Entity,
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

  public getStamina() {
    return this._getStamina();
  }

  private _maxStamina = (troops: any): number => {
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

  private _getStamina() {
    let staminaEntity = getComponentValue(this.setup.components.Stamina, this.entity);
    if (!staminaEntity) {
      throw Error("no stamina for entity");
    }
    const armyEntity = getComponentValue(this.setup.components.Army, this.entity);
    if (!armyEntity) {
      throw Error("no army for entity");
    }

    const currentArmiesTick = getCurrentArmiesTick();
    const last_refill_tick = staminaEntity?.last_refill_tick;

    if (currentArmiesTick !== Number(last_refill_tick)) {
      staminaEntity = {
        ...staminaEntity!,
        last_refill_tick: BigInt(currentArmiesTick),
        amount: this._maxStamina(armyEntity!.troops),
      };
    }
    return staminaEntity;
  }
}
