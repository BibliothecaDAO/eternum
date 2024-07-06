import { Component, ComponentValue, OverridableComponent, Type, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { BattleType } from "./types";

export class BattleManager {
  battleModel: Component<BattleType> | OverridableComponent<BattleType>;
  battleId: bigint;

  constructor(battleModel: Component<BattleType> | OverridableComponent<BattleType>, battleId: bigint) {
    this.battleModel = battleModel;
    this.battleId = battleId;
  }

  public getUpdatedBattle(currentTick: number) {
    const battle = this.getBattle();
    if (!battle) return;

    const battleClone = structuredClone(battle);

    const durationPassed: number = this.getElapsedTime(currentTick);

    const attackDelta = this.attackingDelta();
    const defenceDelta = this.defendingDelta();

    const damagesDoneToAttack = this.damagesDone(defenceDelta, durationPassed);
    const damagesDoneToDefence = this.damagesDone(attackDelta, durationPassed);

    battleClone.attack_army_health.current =
      damagesDoneToAttack > BigInt(battleClone.attack_army_health.current)
        ? 0n
        : BigInt(battleClone.attack_army_health.current) - damagesDoneToAttack;

    battleClone.defence_army_health.current =
      damagesDoneToDefence > BigInt(battleClone.defence_army_health.current)
        ? 0n
        : BigInt(battleClone.defence_army_health.current) - damagesDoneToDefence;

    battleClone.defence_army.troops = this.getUpdatedTroops(
      battleClone.defence_army_health,
      battleClone.defence_army.troops,
    );
    battleClone.attack_army.troops = this.getUpdatedTroops(
      battleClone.attack_army_health,
      battleClone.attack_army.troops,
    );

    return battleClone;
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

  public getTimeLeft(currentTimestamp: number): Date | undefined {
    const date = new Date(0);
    const battle = this.getBattle();

    if (!battle) {
      return undefined;
    }
    const duractionSinceLastUpdate = currentTimestamp - Number(battle.last_updated);
    if (Number(battle.duration_left) > duractionSinceLastUpdate) {
      date.setSeconds(Number(battle.duration_left) - duractionSinceLastUpdate);
      return date;
    } else {
      return undefined;
    }
  }

  public isBattleActive(currentTick: number): boolean {
    const battle = this.getBattle();
    const timeSinceLastUpdate = this.getElapsedTime(currentTick);
    return battle ? timeSinceLastUpdate < battle.duration_left : false;
  }

  public getBattle() {
    return getComponentValue(this.battleModel, getEntityIdFromKeys([this.battleId]));
  }

  private getUpdatedTroops = (
    health: { current: bigint; lifetime: bigint },
    currentTroops: ComponentValue<
      { knight_count: Type.BigInt; paladin_count: Type.BigInt; crossbowman_count: Type.BigInt },
      unknown
    >,
  ): ComponentValue<
    { knight_count: Type.BigInt; paladin_count: Type.BigInt; crossbowman_count: Type.BigInt },
    unknown
  > => {
    if (health.lifetime === 0n) {
      return {
        knight_count: 0n,
        paladin_count: 0n,
        crossbowman_count: 0n,
      };
    }
    return {
      knight_count: (BigInt(health.current) * BigInt(currentTroops.knight_count)) / BigInt(health.lifetime),
      paladin_count: (BigInt(health.current) * BigInt(currentTroops.paladin_count)) / BigInt(health.lifetime),
      crossbowman_count: (BigInt(health.current) * BigInt(currentTroops.crossbowman_count)) / BigInt(health.lifetime),
    };
  };

  private attackingDelta() {
    const battle = this.getBattle();
    return battle ? battle.attack_delta : 0n;
  }

  private defendingDelta() {
    const battle = this.getBattle();
    return battle ? battle.defence_delta : 0n;
  }

  private damagesDone(delta: bigint, durationPassed: number): bigint {
    return delta * BigInt(durationPassed);
  }
}
