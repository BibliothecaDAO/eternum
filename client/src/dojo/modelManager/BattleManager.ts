import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { BattleSide, EternumGlobalConfig, Troops } from "@bibliothecadao/eternum";
import { Component, ComponentValue, Components, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "../createClientComponents";

export class BattleManager {
  battleId: bigint;
  battleModel: Component<ClientComponents["Battle"]["schema"]>;

  constructor(battleId: bigint, battleModel: Component<ClientComponents["Battle"]["schema"]>) {
    this.battleId = battleId;
    this.battleModel = battleModel;
  }

  public getUpdatedBattle(currentTimestamp: number) {
    const battle = this.getBattle();
    if (!battle) return;

    const battleClone = structuredClone(battle);

    this.updateHealth(battleClone, currentTimestamp);

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

  public getElapsedTime(currentTimestamp: number): number {
    const battle = this.getBattle();
    if (!battle) return 0;
    const duractionSinceLastUpdate = currentTimestamp - Number(battle.last_updated);
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

  public isBattleActive(currentTimestamp: number): boolean {
    const battle = this.getBattle();
    const timeSinceLastUpdate = this.getElapsedTime(currentTimestamp);
    return battle ? timeSinceLastUpdate < battle.duration_left : false;
  }

  private getBattle(): ComponentValue<ClientComponents["Battle"]["schema"]> | undefined {
    return getComponentValue(this.battleModel, getEntityIdFromKeys([this.battleId]));
  }

  public getUpdatedArmy(army: ArmyInfo, battle?: ComponentValue<ClientComponents["Battle"]["schema"]>) {
    if (BigInt(army.battle_id) !== this.battleId) {
      throw new Error("Army is not in the battle");
    }
    if (!battle) return army;

    const cloneArmy = structuredClone(army);

    let battle_army, battle_army_lifetime;
    if (String(army.battle_side) === BattleSide[BattleSide.Defence]) {
      battle_army = battle.defence_army;
      battle_army_lifetime = battle.defence_army_lifetime;
    } else {
      battle_army = battle.attack_army;
      battle_army_lifetime = battle.attack_army_lifetime;
    }

    cloneArmy.health.current = this.getTroopFullHealth(battle_army.troops);

    cloneArmy.troops.knight_count =
      cloneArmy.troops.knight_count === 0n
        ? 0n
        : BigInt(
            Math.floor(
              Number(
                (cloneArmy.troops.knight_count * battle_army.troops.knight_count) /
                  battle_army_lifetime.troops.knight_count,
              ),
            ),
          );

    cloneArmy.troops.paladin_count =
      cloneArmy.troops.paladin_count === 0n
        ? 0n
        : BigInt(
            Math.floor(
              Number(
                (cloneArmy.troops.paladin_count * battle_army.troops.paladin_count) /
                  battle_army_lifetime.troops.paladin_count,
              ),
            ),
          );

    cloneArmy.troops.crossbowman_count =
      cloneArmy.troops.crossbowman_count === 0n
        ? 0n
        : BigInt(
            Math.floor(
              Number(
                (cloneArmy.troops.crossbowman_count * battle_army.troops.crossbowman_count) /
                  battle_army_lifetime.troops.crossbowman_count,
              ),
            ),
          );
    return cloneArmy;
  }

  private getTroopFullHealth(troops: Troops): bigint {
    const health = EternumGlobalConfig.troop.health;
    let total_knight_health = health * Number(troops.knight_count);
    let total_paladin_health = health * Number(troops.paladin_count);
    let total_crossbowman_health = health * Number(troops.crossbowman_count);
    return BigInt(
      Math.floor(
        (total_knight_health + total_paladin_health + total_crossbowman_health) /
          (EternumGlobalConfig.resources.resourceMultiplier * Number(EternumGlobalConfig.troop.healthPrecision)),
      ),
    );
  }

  private getUpdatedTroops = (
    health: { current: bigint; lifetime: bigint },
    currentTroops: { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint },
  ): { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint } => {
    if (health.lifetime === 0n) {
      return {
        knight_count: 0n,
        paladin_count: 0n,
        crossbowman_count: 0n,
      };
    }

    return {
      knight_count: (health.current * currentTroops.knight_count) / health.lifetime,
      paladin_count: (health.current * currentTroops.paladin_count) / health.lifetime,
      crossbowman_count: (health.current * currentTroops.crossbowman_count) / health.lifetime,
    };
  };

  private updateHealth(battle: ComponentValue<Components["Battle"]["schema"]>, currentTimestamp: number) {
    const durationPassed: number = this.getElapsedTime(currentTimestamp);

    const attackDelta = this.attackingDelta(battle);
    const defenceDelta = this.defendingDelta(battle);

    battle.attack_army_health.current = this.getUdpdatedHealth(attackDelta, battle.attack_army_health, durationPassed);
    battle.defence_army_health.current = this.getUdpdatedHealth(
      defenceDelta,
      battle.defence_army_health,
      durationPassed,
    );
  }

  private getUdpdatedHealth(
    delta: bigint,
    health: ComponentValue<Components["Health"]["schema"]>,
    durationPassed: number,
  ) {
    const damagesDone = this.damagesDone(delta, durationPassed);
    const currentHealthAfterDamage = this.getCurrentHealthAfterDamage(health, damagesDone);
    return currentHealthAfterDamage;
  }

  private attackingDelta(battle: ComponentValue<Components["Battle"]["schema"]>) {
    return battle.attack_delta;
  }

  private defendingDelta(battle: ComponentValue<Components["Battle"]["schema"]>) {
    return battle.defence_delta;
  }

  private damagesDone(delta: bigint, durationPassed: number): bigint {
    return delta * BigInt(durationPassed);
  }

  private getCurrentHealthAfterDamage(health: ComponentValue<Components["Health"]["schema"]>, damages: bigint) {
    return damages > health.current ? 0n : health.current - damages;
  }
}
