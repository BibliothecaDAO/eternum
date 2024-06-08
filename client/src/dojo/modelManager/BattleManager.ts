import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { BattleType } from "./types";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export class BattleManager {
  battleModel: Component<BattleType> | OverridableComponent<BattleType>;
  battleId: bigint;

  constructor(battleModel: Component<BattleType> | OverridableComponent<BattleType>, battleId: bigint) {
    this.battleModel = battleModel;
    this.battleId = battleId;
  }

  public getBattle() {
    return getComponentValue(this.battleModel, getEntityIdFromKeys([this.battleId]));
  }

  public attackingDelta() {
    const battle = this.getBattle();
    return battle ? battle.attack_delta : 0;
  }

  public defendingDelta() {
    const battle = this.getBattle();
    return battle ? battle.defence_delta : 0;
  }

  public getElapsedTime(currentTick: number): number {
    const battle = this.getBattle();
    if (!battle) return 0;
    const duractionSinceLastUpdate = currentTick - Number(battle.last_updated);
    if (Number(battle.duration_left) >= duractionSinceLastUpdate) {
      return duractionSinceLastUpdate;
    } else {
      return Number(battle.duration_left);
    }
  }

  public battleActive() {
    const battle = this.getBattle();
    return battle ? battle.duration_left > 0n : false;
  }

  public getUpdatedBattle(currentTick: number) {
    const battle = this.getBattle();
    if (!battle) return;

    const durationPassed: number = this.getElapsedTime(currentTick);
    const attackDelta = this.attackingDelta();
    const defenceDelta = this.defendingDelta();

    if (BigInt(attackDelta) * BigInt(durationPassed) > battle.attack_army_health.current) {
      battle.attack_army_health.current = 0n;
    } else {
      battle.attack_army_health.current -= BigInt(defenceDelta) * BigInt(durationPassed);
    }

    if (BigInt(defenceDelta) * BigInt(durationPassed) > battle.defence_army_health.current) {
      battle.defence_army_health.current = 0n;
    } else {
      battle.defence_army_health.current -= BigInt(attackDelta) * BigInt(durationPassed);
    }

    return battle;
  }
}
