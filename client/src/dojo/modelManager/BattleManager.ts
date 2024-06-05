import { Component, OverridableComponent, getComponentValue } from "@dojoengine/recs";
import { BattleType } from "./types";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export class ProductionManager {
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

  public getElapsedTime(currentTick: number) {
    const battle = this.getBattle();
    if (!battle) return 0;
    return currentTick - Number(battle.tick_last_updated);
  }

  public getUpdatedBattle(currentTick: number) {
    const battle = this.getBattle();
    if (!battle) return;

    const durationPassed = this.getElapsedTime(currentTick);
    const attackDelta = this.attackingDelta();
    const defenceDelta = this.defendingDelta();

    battle.attack_army_health.current -= BigInt(attackDelta) * BigInt(durationPassed);
    battle.defence_army_health.current -= BigInt(defenceDelta) * BigInt(durationPassed);

    return battle;
  }
}
