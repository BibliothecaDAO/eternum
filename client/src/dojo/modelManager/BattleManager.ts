import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BattleType } from "./types";

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
    return battle ? battle.attack_delta : 0n;
  }

  public defendingDelta() {
    const battle = this.getBattle();
    return battle ? battle.defence_delta : 0n;
  }

  private damagesDone(delta: bigint, durationPassed: number): bigint {
    return delta * BigInt(durationPassed);
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

  public battleActive(currentTick: number): boolean {
    const battle = this.getBattle();
    const timeSinceLastUpdate = this.getElapsedTime(currentTick);
    return battle ? timeSinceLastUpdate < battle.duration_left : false;
  }

  public getUpdatedBattle(currentTick: number) {
    const battle = this.getBattle();
    if (!battle) return;
	
    const durationPassed: number = this.getElapsedTime(currentTick);

    const attackDelta = this.attackingDelta();
    const defenceDelta = this.defendingDelta();

    const damagesDoneToAttack = this.damagesDone(defenceDelta, durationPassed);
    const damagesDoneToDefence = this.damagesDone(attackDelta, durationPassed);

    battle.attack_army_health.current =
      damagesDoneToAttack > battle.attack_army_health.current
        ? 0n
        : battle.attack_army_health.current - damagesDoneToAttack;

    battle.defence_army_health.current =
      damagesDoneToDefence > battle.defence_army_health.current
        ? 0n
        : battle.defence_army_health.current - damagesDoneToDefence;
    return battle;
  }
}
