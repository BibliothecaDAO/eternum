import { BattleSide } from "@bibliothecadao/eternum";
import { Component, ComponentValue, Components, Has, HasValue, runQuery } from "@dojoengine/recs";
import { BattleInfo } from "./useBattles";

export const battleIsFinished = (Army: Component, battle: BattleInfo) => {
  const attackersEntityIds = getArmiesInBattleBySide(Army, battle, BattleSide.Attack);
  const defendersEntityIds = getArmiesInBattleBySide(Army, battle, BattleSide.Defence);

  return (
    (Array.from(attackersEntityIds).length === 0 && battle.defence_army_health.current <= 0n) ||
    (Array.from(defendersEntityIds).length === 0 && battle.attack_army_health.current <= 0)
  );
};

export const battleIsEmpty = (Army: Component, battle: BattleInfo) => {
  const attackersEntityIds = getArmiesInBattleBySide(Army, battle, BattleSide.Attack);
  const defendersEntityIds = getArmiesInBattleBySide(Army, battle, BattleSide.Defence);

  return Array.from(attackersEntityIds).length === 0 && Array.from(defendersEntityIds).length === 0;
};

export const armyHasLost = (army: ComponentValue<Components["Army"]["schema"]>, battle: BattleInfo) => {
  if (army.battle_id !== battle.entity_id) {
    throw new Error("Army not in the correct battle");
  }
  return (
    (army.battle_side === BattleSide.Attack && BigInt(battle.attack_army_health.current) <= 0) ||
    (army.battle_side === BattleSide.Defence && BigInt(battle.defence_army_health.current) <= 0)
  );
};

export const protectorStillInBattle = (Army: Component, Protectee: Component, battle: BattleInfo) => {
  const protectorEntityIds = getProtectorsInBattle(Army, Protectee, battle);
  return Array.from(protectorEntityIds).length > 0;
};

export const getProtectorsInBattle = (Army: Component, Protectee: Component, battle: BattleInfo) => {
  return runQuery([Has(Protectee), HasValue(Army, { battle_id: battle.entity_id, battle_side: "Defence" })]);
};

export const getArmiesInBattleBySide = (Army: Component, battle: BattleInfo, battle_side: BattleSide) => {
  return runQuery([Has(Army), HasValue(Army, { battle_id: battle.entity_id, battle_side: BattleSide[battle_side] })]);
};
