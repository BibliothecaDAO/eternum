import { getCurrentArmiesTick } from "@/three/helpers/ticks";
import { ID, ResourcesIds, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { SetupResult } from "../setup";

export class StaminaManager {
  armyEntityId: ID;

  constructor(
    armyEntityId: ID,
    private dojo: SetupResult,
  ) {
    this.armyEntityId = armyEntityId;
  }

  public getStamina() {
    return this._getStamina();
  }

  private _maxStamina = (troops: any): number => {
    let maxStaminas: number[] = [];
    if (troops.knight_count > 0) {
      const knightConfig = getComponentValue(
        this.dojo.components.StaminaConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Knight)]),
      );
      maxStaminas.push(knightConfig!.max_stamina);
    }
    if (troops.crossbowman_count > 0) {
      const crossbowmenConfig = getComponentValue(
        this.dojo.components.StaminaConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Crossbowman)]),
      );
      maxStaminas.push(crossbowmenConfig!.max_stamina);
    }
    if (troops.paladin_count > 0) {
      const paladinConfig = getComponentValue(
        this.dojo.components.StaminaConfig,
        getEntityIdFromKeys([WORLD_CONFIG_ID, BigInt(ResourcesIds.Paladin)]),
      );
      maxStaminas.push(paladinConfig!.max_stamina);
    }

    if (maxStaminas.length === 0) return 0;

    const maxArmyStamina = Math.min(...maxStaminas);

    return maxArmyStamina;
  };

  private _getStamina() {
    const entity = runQuery([HasValue(this.dojo.components.Stamina, { entity_id: this.armyEntityId })])
      .values()
      .next().value;
    let staminaEntity = getComponentValue(this.dojo.components.Stamina, entity);
    if (!staminaEntity) {
      throw Error("no stamina for entity");
    }
    const armyEntity = getComponentValue(this.dojo.components.Army, entity);

    const currentArmiesTick = getCurrentArmiesTick();

    if (currentArmiesTick !== Number(staminaEntity?.last_refill_tick)) {
      staminaEntity = {
        ...staminaEntity!,
        last_refill_tick: BigInt(currentArmiesTick),
        amount: this._maxStamina(armyEntity!.troops),
      };
    }
    return staminaEntity;
  }
}
