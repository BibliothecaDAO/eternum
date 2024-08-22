import { getCurrentArmiesTick } from "@/three/helpers/ticks";
import { ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { Entity, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { SetupResult } from "../setup";

export class StaminaManager {
  private staminaConfig: {
    knightConfig: number;
    crossbowmanConfig: number;
    paladinConfig: number;
  };

  constructor(
    private entity: Entity,
    private dojo: SetupResult,
  ) {
    const knightConfig = getComponentValue(
      this.dojo.components.StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Knight)]),
    );
    const crossbowmanConfig = getComponentValue(
      this.dojo.components.StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Crossbowman)]),
    );
    const paladinConfig = getComponentValue(
      this.dojo.components.StaminaConfig,
      getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Paladin)]),
    );

    this.staminaConfig = {
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
    if (troops.knight_count > 0) {
      maxStaminas.push(this.staminaConfig.knightConfig);
    }
    if (troops.crossbowman_count > 0) {
      maxStaminas.push(this.staminaConfig.crossbowmanConfig);
    }
    if (troops.paladin_count > 0) {
      maxStaminas.push(this.staminaConfig.paladinConfig);
    }

    if (maxStaminas.length === 0) return 0;

    const maxArmyStamina = Math.min(...maxStaminas);

    return maxArmyStamina;
  };

  private _getStamina() {
    let staminaEntity = getComponentValue(this.dojo.components.Stamina, this.entity);
    if (!staminaEntity) {
      throw Error("no stamina for entity");
    }
    const armyEntity = getComponentValue(this.dojo.components.Army, this.entity);
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
