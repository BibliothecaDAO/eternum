import { DojoResult } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import { Health } from "@/types";
import { BattleSide, EternumGlobalConfig, ID } from "@bibliothecadao/eternum";
import { ComponentValue, Components, Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ClientComponents } from "../createClientComponents";

export enum BattleType {
  Hex,
  Structure,
}

export class BattleManager {
  battleEntityId: ID;
  dojo: DojoResult;
  battleType: BattleType | undefined;
  private battleIsClaimable: boolean | undefined;
  private battleIsRaidable: boolean | undefined;

  constructor(battleEntityId: ID, dojo: DojoResult) {
    this.battleEntityId = battleEntityId;
    this.dojo = dojo;
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

  public isBattle(): boolean {
    const battle = this.getBattle();
    return battle !== undefined;
  }

  public getElapsedTime(currentTimestamp: number): number {
    const battle = this.getBattle();

    if (!battle) return 0;

    const durationSinceLastUpdate = currentTimestamp - Number(battle.last_updated);
    if (Number(battle.duration_left) >= durationSinceLastUpdate) {
      return durationSinceLastUpdate;
    } else {
      return Number(battle.duration_left);
    }
  }

  public getTimeLeft(currentTimestamp: number): Date | undefined {
    const battle = this.getBattle();

    if (!battle) {
      return undefined;
    }

    const date = new Date(0);

    const durationSinceLastUpdate = currentTimestamp - Number(battle.last_updated);
    if (Number(battle.duration_left) > durationSinceLastUpdate) {
      date.setSeconds(Number(battle.duration_left) - durationSinceLastUpdate);
      return date;
    } else {
      return undefined;
    }
  }

  public isBattleOngoing(currentTimestamp: number): boolean {
    const battle = this.getBattle();

    const timeSinceLastUpdate = this.getElapsedTime(currentTimestamp);

    return battle ? timeSinceLastUpdate < battle.duration_left : false;
  }

  public getBattle(): ComponentValue<ClientComponents["Battle"]["schema"]> | undefined {
    return getComponentValue(this.dojo.setup.components.Battle, getEntityIdFromKeys([BigInt(this.battleEntityId)]));
  }

  public getUpdatedArmy(
    army: ArmyInfo | undefined,
    updatedBattle: ComponentValue<ClientComponents["Battle"]["schema"]> | undefined,
  ) {
    if (!army) return;

    if (!updatedBattle) return army;

    const cloneArmy = structuredClone(army);

    let battle_army, battle_army_lifetime;
    if (army.battle_side === BattleSide[BattleSide.Defence]) {
      battle_army = updatedBattle.defence_army;
      battle_army_lifetime = updatedBattle.defence_army_lifetime;
    } else {
      battle_army = updatedBattle.attack_army;
      battle_army_lifetime = updatedBattle.attack_army_lifetime;
    }

    cloneArmy.troops.knight_count =
      cloneArmy.troops.knight_count === 0n
        ? 0n
        : BigInt(
            Math.floor(
              Number(cloneArmy.troops.knight_count) *
                this.getRemainingPercentageOfTroops(
                  battle_army.troops.knight_count,
                  battle_army_lifetime.troops.knight_count,
                ),
            ),
          );

    cloneArmy.troops.paladin_count =
      cloneArmy.troops.paladin_count === 0n
        ? 0n
        : BigInt(
            Math.floor(
              Number(cloneArmy.troops.paladin_count) *
                this.getRemainingPercentageOfTroops(
                  battle_army.troops.paladin_count,
                  battle_army_lifetime.troops.paladin_count,
                ),
            ),
          );

    cloneArmy.troops.crossbowman_count =
      cloneArmy.troops.crossbowman_count === 0n
        ? 0n
        : BigInt(
            Math.floor(
              Number(cloneArmy.troops.crossbowman_count) *
                this.getRemainingPercentageOfTroops(
                  battle_army.troops.crossbowman_count,
                  battle_army_lifetime.troops.crossbowman_count,
                ),
            ),
          );

    cloneArmy.health.current = this.getTroopFullHealth(cloneArmy.troops);

    return cloneArmy;
  }

  public isClaimable(
    currentTimestamp: number,
    selectedArmy: ArmyInfo | undefined,
    structure: Structure | undefined,
    defender: ArmyInfo | undefined,
  ): boolean {
    if (!selectedArmy) return false;
    if (this.battleIsClaimable) return this.battleIsClaimable;

    if (this.isBattleOngoing(currentTimestamp)) {
      return false;
    }

    if (!structure) {
      this.battleIsClaimable = false;
      return false;
    }

    if (this.getBattleType(structure) !== BattleType.Structure) {
      this.battleIsClaimable = false;
      return false;
    }

    if (defender === undefined) {
      this.battleIsClaimable = true;
      return true;
    }

    const updatedBattle = this.getUpdatedBattle(currentTimestamp);
    if (updatedBattle && updatedBattle.defence_army_health.current > 0n) {
      this.battleIsClaimable = false;
      return false;
    }

    if (defender.health.current > 0n) {
      this.battleIsClaimable = false;
      return false;
    }

    if (structure.isMine) {
      return false;
    }

    if (selectedArmy.health.current <= 0n) {
      return false;
    }

    this.battleIsClaimable = true;
    return true;
  }

  public isRaidable(
    currentTimestamp: number,
    selectedArmy: ArmyInfo | undefined,
    structure: Structure | undefined,
  ): boolean {
    if (!selectedArmy) return false;

    if (!structure) return false;

    if (this.battleIsRaidable) return this.battleIsRaidable;

    if (this.isBattleOngoing(currentTimestamp) && selectedArmy.battle_id !== this.battleEntityId) {
      return false;
    }

    if (this.getBattleType(structure) === BattleType.Hex) {
      this.battleIsRaidable = false;
      return false;
    }

    if (structure.isMine) return false;

    this.battleIsRaidable = true;
    return true;
  }

  public isAttackable(defender: ArmyInfo | undefined): boolean {
    if (!defender) return false;

    if (!this.isBattle() && defender.health.current > 0n) return true;

    return false;
  }

  public isLeavable(currentTimestamp: number, selectedArmy: ArmyInfo | undefined): boolean {
    if (!this.isBattle()) return false;

    if (!selectedArmy) return false;

    if (selectedArmy.protectee && this.isBattleOngoing(currentTimestamp)) return false;

    return true;
  }

  public isEmpty(): boolean {
    return (
      runQuery([
        Has(this.dojo.setup.components.Army),
        HasValue(this.dojo.setup.components.Army, { battle_id: this.battleEntityId }),
      ]).size === 0
    );
  }

  public async pillageStructure(raider: ArmyInfo, structureEntityId: ID) {
    if (this.battleEntityId !== 0 && this.battleEntityId === raider.battle_id) {
      await this.dojo.setup.systemCalls.battle_leave_and_pillage({
        signer: this.dojo.account.account,
        army_id: raider.entity_id,
        battle_id: this.battleEntityId,
        structure_id: structureEntityId,
      });
    } else {
      await this.dojo.setup.systemCalls.battle_pillage({
        signer: this.dojo.account.account,
        army_id: raider.entity_id,
        structure_id: structureEntityId,
      });
    }
  }

  public getBattleType(structure: Structure | undefined): BattleType {
    if (this.battleType) return this.battleType;

    if (!structure) {
      this.battleType = BattleType.Hex;
      return this.battleType;
    }

    this.battleType = BattleType.Structure;
    return this.battleType;
  }

  private getTroopFullHealth(troops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]>): bigint {
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
    health: Health,
    currentTroops: ComponentValue<ClientComponents["Army"]["schema"]["troops"]>,
  ): ComponentValue<ClientComponents["Army"]["schema"]["troops"]> => {
    if (health.current > health.lifetime) {
      throw new Error("Current health shouldn't be bigger than lifetime");
    }

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

  private updateHealth(battle: ComponentValue<ClientComponents["Battle"]["schema"]>, currentTimestamp: number) {
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
    health: ComponentValue<ClientComponents["Battle"]["schema"]["defence_army_health"]>,
    durationPassed: number,
  ) {
    const damagesDone = this.damagesDone(delta, durationPassed);
    const currentHealthAfterDamage = BigInt(
      Math.min(Number(health.current), Number(this.getCurrentHealthAfterDamage(health, damagesDone))),
    );
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

  private getRemainingPercentageOfTroops(current_troops: bigint, lifetime_troops: bigint) {
    return Number(current_troops) / Number(lifetime_troops);
  }
}
