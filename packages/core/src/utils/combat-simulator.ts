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
  damage_beta_small: bigint;
  damage_beta_large: bigint;
  damage_scaling_factor: bigint;
  damage_c0: bigint;
  damage_delta: bigint;
  t1_damage_value: bigint;
  t2_damage_multiplier: bigint;
  t3_damage_multiplier: bigint;
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

  constructor(params: CombatParameters) {
    this.t1DamageValue = Number(params.t1_damage_value) / 2 ** 64; // 100
    this.t2DamageMultiplier = Number(params.t2_damage_multiplier) / 2 ** 64; // 2.5
    this.t3DamageMultiplier = Number(params.t3_damage_multiplier) / 2 ** 64; // 7
    this.staminaAttackThreshold = params.stamina_attack_req; // 30
    this.baseDamageFactor = Number(params.damage_scaling_factor) / 2 ** 64; // 3.5
    this.betaSmall = Number(params.damage_beta_small) / 2 ** 64; // 0.25
    this.betaLarge = Number(params.damage_beta_large) / 2 ** 64; // 0.12
    this.c0 = Number(params.damage_c0); // 0
    this.delta = Number(params.damage_delta) / 2 ** 64; // 50000
    this.biomeBonusNum = params.damage_biome_bonus_num / 10000; // 0.3
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
      damage_biome_bonus_num: 3000,
      damage_beta_small: 25000000000000000000n,
      damage_beta_large: 12000000000000000000n,
      damage_scaling_factor: 35000000000000000000n,
      damage_c0: 0n,
      damage_delta: 50000n,
      t1_damage_value: 100n,
      t2_damage_multiplier: 250n,
      t3_damage_multiplier: 700n,
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
