import { BiomeType } from "../constants";
import { TroopType } from "../types";

export class Percentage {
  static _100() {
    return 10_000;
  }

  static get(value: number, numerator: number) {
    return (value * numerator) / Percentage._100();
  }
}

export interface Army {
  stamina: number;
  troopCount: number;
  troopType: TroopType;
  tier: 1 | 2 | 3;
}

export interface CombatParameters {
  baseT1Value: number;
  staminaAttackThreshold: number;
  baseDamageFactor: number;
  betaSmall: number;
  betaLarge: number;
  c0: number;
  delta: number;
}

export class CombatSimulator {
  private static readonly BASE_T1_VALUE = 100; // Adjust this baseline value as needed
  private static readonly STAMINA_ATTACK_THRESHOLD = 30;
  //   private static readonly MAX_STAMINA_BONUS = 0.3; // 30%
  private static readonly BASE_DAMAGE_FACTOR = 3.5;

  // Combat scaling parameters
  private static readonly BETA_SMALL = 0.25;
  private static readonly BETA_LARGE = 0.12;
  private static readonly C0 = 100_000; // Transition point
  private static readonly DELTA = 50_000; // Transition width

  public static getBiomeBonus(troopType: TroopType, biome: BiomeType): number {
    const biomeModifiers: Record<BiomeType, Record<TroopType, number>> = {
      [BiomeType.Ocean]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: 0.3, [TroopType.Paladin]: -0.3 },
      [BiomeType.DeepOcean]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: 0.3, [TroopType.Paladin]: -0.3 },
      [BiomeType.Beach]: { [TroopType.Knight]: -0.3, [TroopType.Crossbowman]: 0.3, [TroopType.Paladin]: 0 },
      [BiomeType.Grassland]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: -0.3, [TroopType.Paladin]: 0.3 },
      [BiomeType.Shrubland]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: -0.3, [TroopType.Paladin]: 0.3 },
      [BiomeType.SubtropicalDesert]: { [TroopType.Knight]: -0.3, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: 0.3 },
      [BiomeType.TemperateDesert]: { [TroopType.Knight]: -0.3, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: 0.3 },
      [BiomeType.TropicalRainForest]: {
        [TroopType.Knight]: 0.3,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -0.3,
      },
      [BiomeType.TropicalSeasonalForest]: {
        [TroopType.Knight]: 0.3,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -0.3,
      },
      [BiomeType.TemperateRainForest]: {
        [TroopType.Knight]: 0.3,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -0.3,
      },
      [BiomeType.TemperateDeciduousForest]: {
        [TroopType.Knight]: 0.3,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -0.3,
      },
      [BiomeType.Tundra]: { [TroopType.Knight]: -0.3, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: 0.3 },
      [BiomeType.Taiga]: { [TroopType.Knight]: 0.3, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: -0.3 },
      [BiomeType.Snow]: { [TroopType.Knight]: -0.3, [TroopType.Crossbowman]: 0.3, [TroopType.Paladin]: 0 },
      [BiomeType.Bare]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: -0.3, [TroopType.Paladin]: 0.3 },
      [BiomeType.Scorched]: { [TroopType.Knight]: 0.3, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: -0.3 },
    };

    return 1 + (biomeModifiers[biome]?.[troopType] ?? 0);
  }

  private static getTierValue(tier: 1 | 2 | 3): number {
    switch (tier) {
      case 1:
        return this.BASE_T1_VALUE;
      case 2:
        return this.BASE_T1_VALUE * 2.5;
      case 3:
        return this.BASE_T1_VALUE * 7;
    }
  }

  private static calculateStaminaModifier(stamina: number, isAttacker: boolean): number {
    if (isAttacker) {
      if (stamina < this.STAMINA_ATTACK_THRESHOLD) return 0;
      // max stamina bonus is 30%
      const extraStamina = Math.min(stamina - this.STAMINA_ATTACK_THRESHOLD, this.STAMINA_ATTACK_THRESHOLD);
      return 1 + extraStamina / 100;
    } else {
      // Defender stamina penalty
      return 0.7 + (0.3 * Math.min(stamina, 30)) / 30;
    }
  }

  private static calculateEffectiveBeta(totalTroops: number): number {
    return (
      this.BETA_SMALL -
      (this.BETA_SMALL - this.BETA_LARGE) * ((Math.tanh((totalTroops - this.C0) / this.DELTA) + 1) / 2)
    );
  }

  public static simulateBattle(
    attacker: Army,
    defender: Army,
    biome: BiomeType,
  ): { attackerDamage: number; defenderDamage: number } {
    const totalTroops = attacker.troopCount + defender.troopCount;
    const betaEff = this.calculateEffectiveBeta(totalTroops);

    if (totalTroops === 0) {
      return { attackerDamage: 0, defenderDamage: 0 };
    }

    // Calculate attacker damage
    const attackerDamage =
      (this.BASE_DAMAGE_FACTOR *
        attacker.troopCount *
        (this.getTierValue(attacker.tier) / this.getTierValue(defender.tier)) *
        this.calculateStaminaModifier(attacker.stamina, true) *
        this.getBiomeBonus(attacker.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    // Calculate defender damage
    const defenderDamage =
      (this.BASE_DAMAGE_FACTOR *
        defender.troopCount *
        (this.getTierValue(defender.tier) / this.getTierValue(attacker.tier)) *
        this.calculateStaminaModifier(defender.stamina, false) *
        this.getBiomeBonus(defender.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    return {
      attackerDamage,
      defenderDamage,
    };
  }

  // Add getter for default parameters
  public static getDefaultParameters(): CombatParameters {
    return {
      baseT1Value: this.BASE_T1_VALUE,
      staminaAttackThreshold: this.STAMINA_ATTACK_THRESHOLD,
      baseDamageFactor: this.BASE_DAMAGE_FACTOR,
      betaSmall: this.BETA_SMALL,
      betaLarge: this.BETA_LARGE,
      c0: this.C0,
      delta: this.DELTA,
    };
  }

  // Add a method to simulate with custom parameters
  public static simulateBattleWithParams(
    attacker: Army,
    defender: Army,
    biome: BiomeType,
    params: CombatParameters,
  ): { attackerDamage: number; defenderDamage: number } {
    const totalTroops = attacker.troopCount + defender.troopCount;
    const betaEff =
      params.betaSmall -
      (params.betaSmall - params.betaLarge) * ((Math.tanh((totalTroops - params.c0) / params.delta) + 1) / 2);

    // Calculate attacker damage
    const attackerDamage =
      (params.baseDamageFactor *
        attacker.troopCount *
        (this.getTierValue(attacker.tier) / this.getTierValue(defender.tier)) *
        this.calculateStaminaModifier(attacker.stamina, true) *
        this.getBiomeBonus(attacker.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    // Calculate defender damage
    const defenderDamage =
      (params.baseDamageFactor *
        defender.troopCount *
        (this.getTierValue(defender.tier) / this.getTierValue(attacker.tier)) *
        this.calculateStaminaModifier(defender.stamina, false) *
        this.getBiomeBonus(defender.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    return {
      attackerDamage,
      defenderDamage,
    };
  }
}
