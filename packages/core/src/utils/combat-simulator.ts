import { BiomeType } from "../constants";
import { TroopTier, TroopType } from "../types";

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
  tier: TroopTier;
}

export interface CombatParameters {
  damage_biome_bonus_num: number;
  damage_beta_small: number;
  damage_beta_large: number;
  damage_scaling_factor: number;
  damage_c0: number;
  damage_delta: number;
  t1_damage_value: number;
  t2_damage_multiplier: number;
  t3_damage_multiplier: number;
  stamina_attack_req: number;
}

export class CombatSimulator {
  private readonly t1DamageValue: number;
  private readonly t2DamageMultiplier: number;
  private readonly t3DamageMultiplier: number;
  private readonly staminaAttackThreshold: number;
  private readonly baseDamageFactor: number;
  private readonly betaSmall: number;
  private readonly betaLarge: number;
  private readonly c0: number;
  private readonly delta: number;
  private readonly biomeBonusNum: number;

  // private static readonly STAMINA_ATTACK_THRESHOLD = 30;
  // private static readonly BASE_DAMAGE_FACTOR = 3.5;
  // private static readonly BETA_SMALL = 0.25;
  // private static readonly BETA_LARGE = 0.12;
  // private static readonly C0 = 100_000; // Transition point
  // private static readonly DELTA = 50_000; // T

  constructor(params: CombatParameters) {
    this.t1DamageValue = params.t1_damage_value;
    this.t2DamageMultiplier = params.t2_damage_multiplier;
    this.t3DamageMultiplier = params.t3_damage_multiplier;
    this.staminaAttackThreshold = params.stamina_attack_req;
    this.baseDamageFactor = params.damage_scaling_factor;
    this.betaSmall = params.damage_beta_small;
    this.betaLarge = params.damage_beta_large;
    this.c0 = params.damage_c0;
    this.delta = params.damage_delta;
    this.biomeBonusNum = params.damage_biome_bonus_num;
  }

  public getBiomeBonus(troopType: TroopType, biome: BiomeType): number {
    const biomeModifiers: Record<BiomeType, Record<TroopType, number>> = {
      [BiomeType.None]: { [TroopType.Knight]: 0, [TroopType.Crossbowman]: 0, [TroopType.Paladin]: 0 },
      [BiomeType.Ocean]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: this.biomeBonusNum,
        [TroopType.Paladin]: -this.biomeBonusNum,
      },
      [BiomeType.DeepOcean]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: this.biomeBonusNum,
        [TroopType.Paladin]: -this.biomeBonusNum,
      },
      [BiomeType.Beach]: {
        [TroopType.Knight]: -this.biomeBonusNum,
        [TroopType.Crossbowman]: this.biomeBonusNum,
        [TroopType.Paladin]: 0,
      },
      [BiomeType.Grassland]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -this.biomeBonusNum,
        [TroopType.Paladin]: this.biomeBonusNum,
      },
      [BiomeType.Shrubland]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -this.biomeBonusNum,
        [TroopType.Paladin]: this.biomeBonusNum,
      },
      [BiomeType.SubtropicalDesert]: {
        [TroopType.Knight]: -this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: this.biomeBonusNum,
      },
      [BiomeType.TemperateDesert]: {
        [TroopType.Knight]: -this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: this.biomeBonusNum,
      },
      [BiomeType.TropicalRainForest]: {
        [TroopType.Knight]: this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -this.biomeBonusNum,
      },
      [BiomeType.TropicalSeasonalForest]: {
        [TroopType.Knight]: this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -this.biomeBonusNum,
      },
      [BiomeType.TemperateRainForest]: {
        [TroopType.Knight]: this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -this.biomeBonusNum,
      },
      [BiomeType.TemperateDeciduousForest]: {
        [TroopType.Knight]: this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -this.biomeBonusNum,
      },
      [BiomeType.Tundra]: {
        [TroopType.Knight]: -this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: this.biomeBonusNum,
      },
      [BiomeType.Taiga]: {
        [TroopType.Knight]: this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -this.biomeBonusNum,
      },
      [BiomeType.Snow]: {
        [TroopType.Knight]: -this.biomeBonusNum,
        [TroopType.Crossbowman]: this.biomeBonusNum,
        [TroopType.Paladin]: 0,
      },
      [BiomeType.Bare]: {
        [TroopType.Knight]: 0,
        [TroopType.Crossbowman]: -this.biomeBonusNum,
        [TroopType.Paladin]: this.biomeBonusNum,
      },
      [BiomeType.Scorched]: {
        [TroopType.Knight]: this.biomeBonusNum,
        [TroopType.Crossbowman]: 0,
        [TroopType.Paladin]: -this.biomeBonusNum,
      },
    };

    return 1 + (biomeModifiers[biome]?.[troopType] ?? 0);
  }

  private getTierValue(tier: TroopTier): number {
    switch (tier) {
      case TroopTier.T1:
        return this.t1DamageValue;
      case TroopTier.T2:
        return this.t1DamageValue * this.t2DamageMultiplier;
      case TroopTier.T3:
        return this.t1DamageValue * this.t3DamageMultiplier;
    }
  }

  private calculateStaminaModifier(stamina: number, isAttacker: boolean): number {
    if (isAttacker) {
      if (stamina < this.staminaAttackThreshold) return 0;
      // max stamina bonus is 30%
      const extraStamina = Math.min(stamina - this.staminaAttackThreshold, this.staminaAttackThreshold);
      return 1 + extraStamina / 100;
    } else {
      // Defender stamina penalty
      return 0.7 + (0.3 * Math.min(stamina, 30)) / 30;
    }
  }

  private calculateEffectiveBeta(totalTroops: number): number {
    return (
      this.betaSmall - (this.betaSmall - this.betaLarge) * ((Math.tanh((totalTroops - this.c0) / this.delta) + 1) / 2)
    );
  }

  public simulateBattle(
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
      (this.baseDamageFactor *
        attacker.troopCount *
        (this.getTierValue(attacker.tier) / this.getTierValue(defender.tier)) *
        this.calculateStaminaModifier(attacker.stamina, true) *
        this.getBiomeBonus(attacker.troopType, biome)) /
      Math.pow(totalTroops, betaEff);

    // Calculate defender damage
    const defenderDamage =
      (this.baseDamageFactor *
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

  public static getDefaultParameters(): CombatParameters {
    return {
      damage_biome_bonus_num: 0.3,
      damage_beta_small: 0.25,
      damage_beta_large: 0.12,
      damage_scaling_factor: 3.5,
      damage_c0: 100_000,
      damage_delta: 50_000,
      t1_damage_value: 100,
      t2_damage_multiplier: 2.5,
      t3_damage_multiplier: 7,
      stamina_attack_req: 30,
    };
  }

  // Static method to simulate with default parameters
  public simulateBattleWithParams(
    attacker: Army,
    defender: Army,
    biome: BiomeType,
  ): { attackerDamage: number; defenderDamage: number } {
    return this.simulateBattle(attacker, defender, biome);
  }
}
