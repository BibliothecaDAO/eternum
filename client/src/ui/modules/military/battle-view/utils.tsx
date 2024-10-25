import { ClientComponents } from "@/dojo/createClientComponents";
import { configManager } from "@/dojo/setup";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Battle, Health, Percentage, Troops as SdkTroops, TroopConfig } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { getTotalTroops } from "./BattleHistory";

export const getChancesOfSuccess = (
  attackerArmy: ArmyInfo | undefined,
  defenderArmy: ArmyInfo | undefined,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
) => {
  if (!attackerArmy || !defenderArmy) {
    return attackerArmy ? 1 : 0;
  }

  const attackingArmyStrength = Number(
    fullStrength(attackerArmy.troops, troopConfig) * percentageLeft(attackerArmy.health),
  );
  const defendingArmyStrength = Number(
    fullStrength(defenderArmy.troops, troopConfig) * percentageLeft(defenderArmy.health),
  );

  const attackSuccessProbability =
    attackingArmyStrength / Math.max(Number(attackingArmyStrength + defendingArmyStrength), 1);
  return attackSuccessProbability;
};

function fullStrength(
  troops: SdkTroops,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
): bigint {
  const knightCount = BigInt(troops.knight_count);
  const paladinCount = BigInt(troops.paladin_count);
  const crossbowmanCount = BigInt(troops.crossbowman_count);
  const totalKnightStrength = BigInt(troopConfig.knight_strength) * knightCount;
  const totalPaladinStrength = BigInt(troopConfig.paladin_strength) * paladinCount;
  const totalCrossbowmanStrength = BigInt(troopConfig.crossbowman_strength) * crossbowmanCount;

  return totalKnightStrength + totalPaladinStrength + totalCrossbowmanStrength;
}

function percentageLeft(health: ComponentValue<ClientComponents["Health"]["schema"]>): bigint {
  if (health.lifetime === 0n) {
    return 0n;
  }
  return (health.current * BigInt(Percentage._100())) / health.lifetime;
}

export const getMaxResourceAmountStolen = (
  attackerArmy: ArmyInfo | undefined,
  defenderArmy: ArmyInfo | undefined,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
) => {
  if (!attackerArmy) return 0;
  const attackingTroops = getTotalTroops(attackerArmy.troops) / configManager.getResourcePrecision();
  return Math.floor(attackingTroops * getChancesOfSuccess(attackerArmy, defenderArmy, troopConfig));
};

export const getTroopLossOnRaid = (
  attackerArmy: ArmyInfo | undefined,
  defenderArmy: ArmyInfo | undefined,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
) => {
  if (!attackerArmy || !defenderArmy) return [0, 0];
  const battle = new Battle(
    attackerArmy.troops,
    defenderArmy.troops,
    new Health(attackerArmy.health),
    new Health(defenderArmy.health),
    new TroopConfig(
      troopConfig.health,
      troopConfig.knight_strength,
      troopConfig.paladin_strength,
      troopConfig.crossbowman_strength,
      troopConfig.advantage_percent,
      troopConfig.disadvantage_percent,
      troopConfig.battle_time_scale,
      troopConfig.battle_max_time_seconds,
    ),
  );
  const [attackDelta, defenceDelta] = battle.computeDelta();
  const duration = battle.calculateDuration();

  const attackerHealthLoss =
    (defenceDelta * duration) /
    troopConfig.pillage_health_divisor /
    configManager.getResourcePrecision() /
    configManager.getResourceMultiplier();
  const attackerTroopsLoss =
    (getTotalTroops(attackerArmy.troops) * attackerHealthLoss) / Number(attackerArmy.health.lifetime);

  const defenderHealthLoss =
    (attackDelta * duration) /
    troopConfig.pillage_health_divisor /
    configManager.getResourcePrecision() /
    configManager.getResourceMultiplier();
  const defenderTroopsLoss =
    (getTotalTroops(defenderArmy.troops) * defenderHealthLoss) / Number(defenderArmy.health.lifetime);

  return [
    Math.max(1, Math.floor(attackerTroopsLoss / configManager.getResourcePrecision())),
    Math.max(1, Math.floor(defenderTroopsLoss / configManager.getResourcePrecision())),
  ];
};
