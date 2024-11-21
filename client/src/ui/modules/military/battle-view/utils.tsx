import { ClientComponents } from "@/dojo/createClientComponents";
import { configManager } from "@/dojo/setup";
import { Battle, Health, Percentage, Troops as SdkTroops, TroopConfig } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { getTotalTroops } from "./BattleHistory";

type ArmyBattleInfo = {
  troops: {
    knight_count: bigint;
    paladin_count: bigint;
    crossbowman_count: bigint;
  };
  health: { current: bigint; lifetime: bigint };
};

interface TroopLosses {
  attackerKnightLost: number;
  attackerPaladinLost: number;
  attackerCrossbowmanLost: number;
  defenderKnightLost: number;
  defenderPaladinLost: number;
  defenderCrossbowmanLost: number;
}

export const getChancesOfSuccess = (
  attackerArmy: ArmyBattleInfo | undefined,
  defenderArmy: ArmyBattleInfo | undefined,
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

function percentageLeft(health: { current: bigint; lifetime: bigint }): bigint {
  if (health.lifetime === 0n) {
    return 0n;
  }
  return (health.current * BigInt(Percentage._100())) / health.lifetime;
}

export const getMaxResourceAmountStolen = (
  attackerArmy: ArmyBattleInfo | undefined,
  defenderArmy: ArmyBattleInfo | undefined,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
) => {
  if (!attackerArmy) return 0;
  const attackingTroops = getTotalTroops(attackerArmy.troops) / configManager.getResourcePrecision();
  return Math.floor(attackingTroops * getChancesOfSuccess(attackerArmy, defenderArmy, troopConfig));
};

export const roundDownToPrecision = (value: bigint, precision: Number) => {
  return BigInt(Number(value) - (Number(value) % Number(precision)));
};

export const roundUpToPrecision = (value: bigint, precision: Number) => {
  return BigInt(Number(value) + (Number(precision) - (Number(value) % Number(precision))));
};

export const getTroopLossOnRaidPerTroopType = (
  attackerArmy: ArmyBattleInfo | undefined,
  defenderArmy: ArmyBattleInfo | undefined,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
): TroopLosses => {
  if (!attackerArmy?.health?.lifetime || !defenderArmy?.health?.lifetime)
    return {
      attackerKnightLost: 0,
      attackerPaladinLost: 0,
      attackerCrossbowmanLost: 0,
      defenderKnightLost: 0,
      defenderPaladinLost: 0,
      defenderCrossbowmanLost: 0,
    };
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
  const attackerHealthLoss = Math.floor(
    (defenceDelta * duration) /
      troopConfig.pillage_health_divisor /
      configManager.getResourcePrecision() /
      configManager.getResourcePrecision(),
  );
  const attackerKnightLost = Math.ceil(
    (Number(attackerArmy.troops.knight_count) * Number(attackerHealthLoss)) / Number(attackerArmy.health.lifetime),
  );
  const attackerPaladinLost = Math.ceil(
    (Number(attackerArmy.troops.paladin_count) * Number(attackerHealthLoss)) / Number(attackerArmy.health.lifetime),
  );
  const attackerCrossbowmanLost = Math.ceil(
    (Number(attackerArmy.troops.crossbowman_count) * Number(attackerHealthLoss)) / Number(attackerArmy.health.lifetime),
  );

  const defenderHealthLoss = Math.floor(
    (attackDelta * duration) /
      troopConfig.pillage_health_divisor /
      configManager.getResourcePrecision() /
      configManager.getResourcePrecision(),
  );
  const defenderKnightLost = Math.ceil(
    (Number(defenderArmy.troops.knight_count) * Number(defenderHealthLoss)) / Number(defenderArmy.health.lifetime),
  );
  const defenderPaladinLost = Math.ceil(
    (Number(defenderArmy.troops.paladin_count) * Number(defenderHealthLoss)) / Number(defenderArmy.health.lifetime),
  );
  const defenderCrossbowmanLost = Math.ceil(
    (Number(defenderArmy.troops.crossbowman_count) * Number(defenderHealthLoss)) / Number(defenderArmy.health.lifetime),
  );

  return {
    attackerKnightLost,
    attackerPaladinLost,
    attackerCrossbowmanLost,
    defenderKnightLost,
    defenderPaladinLost,
    defenderCrossbowmanLost,
  };
};

export const getTroopLossOnRaid = (
  attackerArmy: ArmyBattleInfo | undefined,
  defenderArmy: ArmyBattleInfo | undefined,
  troopConfig: ComponentValue<ClientComponents["TroopConfig"]["schema"]>,
) => {
  const {
    attackerKnightLost,
    attackerPaladinLost,
    attackerCrossbowmanLost,
    defenderKnightLost,
    defenderPaladinLost,
    defenderCrossbowmanLost,
  } = getTroopLossOnRaidPerTroopType(attackerArmy, defenderArmy, troopConfig);
  const attackerTroopsLoss =
    roundUpToPrecision(BigInt(attackerKnightLost), configManager.getResourcePrecision()) +
    roundUpToPrecision(BigInt(attackerPaladinLost), configManager.getResourcePrecision()) +
    roundUpToPrecision(BigInt(attackerCrossbowmanLost), configManager.getResourcePrecision());
  const defenseTroopsLoss =
    roundUpToPrecision(BigInt(defenderKnightLost), configManager.getResourcePrecision()) +
    roundUpToPrecision(BigInt(defenderPaladinLost), configManager.getResourcePrecision()) +
    roundUpToPrecision(BigInt(defenderCrossbowmanLost), configManager.getResourcePrecision());

  return [attackerTroopsLoss, defenseTroopsLoss];
};
