import { EternumGlobalConfig } from "../constants";

export class Percentage {
  static _100() {
    return 10_000;
  }

  static get(value: number, numerator: number) {
    return (value * numerator) / Percentage._100();
  }
}

export class TroopConfig {
  health: number;
  knightStrength: number;
  paladinStrength: number;
  crossbowmanStrength: number;
  advantagePercent: number;
  disadvantagePercent: number;
  battleTimeScale: number;
  battleMaxTimeSeconds: number;

  constructor(
    health: number,
    knightStrength: number,
    paladinStrength: number,
    crossbowmanStrength: number,
    advantagePercent: number,
    disadvantagePercent: number,
    battleTimeScale: number,
    battleMaxTimeSeconds: number,
  ) {
    this.health = health;
    this.knightStrength = knightStrength;
    this.paladinStrength = paladinStrength;
    this.crossbowmanStrength = crossbowmanStrength;
    this.advantagePercent = advantagePercent;
    this.disadvantagePercent = disadvantagePercent;
    this.battleTimeScale = battleTimeScale;
    this.battleMaxTimeSeconds = battleMaxTimeSeconds;
  }
}

export class TroopsSimulator {
  knight_count: bigint;
  paladin_count: bigint;
  crossbowman_count: bigint;

  lifetime_knight_count: bigint;
  lifetime_paladin_count: bigint;
  lifetime_crossbowman_count: bigint;

  constructor(knight_count: bigint, paladin_count: bigint, crossbowman_count: bigint) {
    this.knight_count = knight_count;
    this.paladin_count = paladin_count;
    this.crossbowman_count = crossbowman_count;

    this.lifetime_knight_count = knight_count;
    this.lifetime_paladin_count = paladin_count;
    this.lifetime_crossbowman_count = crossbowman_count;
  }

  troops() {
    return {
      knight_count: this.knight_count,
      paladin_count: this.paladin_count,
      crossbowman_count: this.crossbowman_count,
    };
  }

  count() {
    return this.knight_count + this.paladin_count + this.crossbowman_count;
  }

  fullHealth(config: TroopConfig) {
    const singleTroopHealth = BigInt(config.health);
    const totalKnightHealth = singleTroopHealth * this.knight_count;
    const totalPaladinHealth = singleTroopHealth * this.paladin_count;
    const totalCrossbowmanHealth = singleTroopHealth * this.crossbowman_count;
    return {
      current: totalKnightHealth + totalPaladinHealth + totalCrossbowmanHealth,
      lifetime: totalKnightHealth + totalPaladinHealth + totalCrossbowmanHealth,
    };
  }

  static normalizationFactor() {
    return BigInt(EternumGlobalConfig.resources.resourcePrecision);
  }
}

export class Health {
  current: bigint;
  lifetime: bigint;

  constructor(health: { current: bigint; lifetime: bigint }) {
    this.current = health.current * TroopsSimulator.normalizationFactor();
    this.lifetime = health.lifetime * TroopsSimulator.normalizationFactor();
  }

  stepsToDie(deduction: bigint, config: TroopConfig) {
    if (this.current === 0n || deduction === 0n) {
      return 0;
    }

    const singleTroopHealth = BigInt(config.health) * TroopsSimulator.normalizationFactor();

    if (this.current <= deduction) {
      return 1;
    }

    if (this.current % singleTroopHealth !== 0n) {
      throw new Error("Health is not a multiple of normalization factor.");
    }

    let numSteps: number;
    if (deduction >= singleTroopHealth) {
      numSteps = Number(this.current / deduction);
      if (this.current % deduction > 0n) {
        numSteps += 1;
      }
    } else {
      const currentLessOneTroop = this.current - singleTroopHealth;
      numSteps = Number(currentLessOneTroop / deduction);
      numSteps += 1;
    }

    return numSteps;
  }
}

export class Battle {
  attackArmy: TroopsSimulator;
  defenceArmy: TroopsSimulator;
  attackHealth: Health;
  defenceHealth: Health;
  config: TroopConfig;

  constructor(
    attackArmy: { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint },
    defenceArmy: { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint },
    attackHealth: { current: bigint; lifetime: bigint },
    defenceHealth: { current: bigint; lifetime: bigint },
    config: TroopConfig,
  ) {
    this.attackArmy = new TroopsSimulator(
      attackArmy.knight_count,
      attackArmy.paladin_count,
      attackArmy.crossbowman_count,
    );
    this.defenceArmy = new TroopsSimulator(
      defenceArmy.knight_count,
      defenceArmy.paladin_count,
      defenceArmy.crossbowman_count,
    );
    this.attackHealth = new Health(attackHealth);
    this.defenceHealth = new Health(defenceHealth);
    this.config = config;
  }

  strengthAgainst(attacker: TroopsSimulator, defender: TroopsSimulator) {
    // Calculate total strength with advantages and disadvantages
    let attackerKnightStrength = 1 + Number(attacker.knight_count) * this.config.knightStrength;
    let attackerPaladinStrength = 1 + Number(attacker.paladin_count) * this.config.paladinStrength;
    let attackerCrossbowmanStrength = 1 + Number(attacker.crossbowman_count) * this.config.crossbowmanStrength;

    let defenderKnightStrength = 1 + Number(defender.knight_count) * this.config.knightStrength;
    let defenderPaladinStrength = 1 + Number(defender.paladin_count) * this.config.paladinStrength;
    let defenderCrossbowmanStrength = 1 + Number(defender.crossbowman_count) * this.config.crossbowmanStrength;

    /* knight advantage calculation against enemy paladin */
    let attackerKnightStrengthWithAdvantage =
      attackerKnightStrength +
      Math.floor(
        (attackerKnightStrength * (defenderPaladinStrength * this.config.advantagePercent)) /
          attackerKnightStrength /
          Percentage._100(),
      );
    // attacker can only get a max of advantagePercent of its own size
    let attackerKnightStrengthWithAdvantageMax =
      attackerKnightStrength + Percentage.get(attackerKnightStrength, this.config.advantagePercent);
    attackerKnightStrengthWithAdvantage = Math.min(
      attackerKnightStrengthWithAdvantage,
      attackerKnightStrengthWithAdvantageMax,
    );

    /* knight disadvantage calculation against enemy crossbowman */
    let attackerKnightStrengthWithDisadvantage =
      attackerKnightStrength -
      Math.floor(
        attackerKnightStrength *
          ((defenderCrossbowmanStrength * this.config.disadvantagePercent) /
            attackerKnightStrength /
            Percentage._100()),
      );
    // attacker can only lose a max of disadvantagePercent of its own size
    let attackerKnightStrengthWithDisadvantageMax =
      attackerKnightStrength - Percentage.get(attackerKnightStrength, this.config.disadvantagePercent);
    attackerKnightStrengthWithDisadvantage = Math.max(
      attackerKnightStrengthWithDisadvantage,
      attackerKnightStrengthWithDisadvantageMax,
      0,
    );

    /* crossbowman advantage calculation against enemy knight */
    let attackerCrossbowmanStrengthWithAdvantage =
      attackerCrossbowmanStrength +
      Math.floor(
        (attackerCrossbowmanStrength * (defenderKnightStrength * this.config.advantagePercent)) /
          attackerCrossbowmanStrength /
          Percentage._100(),
      );
    let attackerCrossbowmanStrengthWithAdvantageMax =
      attackerCrossbowmanStrength + Percentage.get(attackerCrossbowmanStrength, this.config.advantagePercent);
    attackerCrossbowmanStrengthWithAdvantage = Math.min(
      attackerCrossbowmanStrengthWithAdvantage,
      attackerCrossbowmanStrengthWithAdvantageMax,
    );

    /* crossbowman disadvantage calculation against enemy paladin */
    let attackerCrossbowmanStrengthWithDisadvantage =
      attackerCrossbowmanStrength -
      Math.floor(
        (attackerCrossbowmanStrength * (defenderPaladinStrength * this.config.disadvantagePercent)) /
          attackerCrossbowmanStrength /
          Percentage._100(),
      );
    let attackerCrossbowmanStrengthWithDisadvantageMax =
      attackerCrossbowmanStrength - Percentage.get(attackerCrossbowmanStrength, this.config.disadvantagePercent);
    attackerCrossbowmanStrengthWithDisadvantage = Math.max(
      attackerCrossbowmanStrengthWithDisadvantage,
      attackerCrossbowmanStrengthWithDisadvantageMax,
      0,
    );

    /* paladin advantage calculation against enemy crossbowman */
    let attackerPaladinStrengthWithAdvantage =
      attackerPaladinStrength +
      Math.floor(
        (attackerPaladinStrength * (defenderCrossbowmanStrength * this.config.advantagePercent)) /
          attackerPaladinStrength /
          Percentage._100(),
      );
    let attackerPaladinStrengthWithAdvantageMax =
      attackerPaladinStrength + Percentage.get(attackerPaladinStrength, this.config.advantagePercent);
    attackerPaladinStrengthWithAdvantage = Math.min(
      attackerPaladinStrengthWithAdvantage,
      attackerPaladinStrengthWithAdvantageMax,
    );

    /* paladin disadvantage calculation against enemy knight */
    let attackerPaladinStrengthWithDisadvantage =
      attackerPaladinStrength -
      Math.floor(
        (attackerPaladinStrength * (defenderKnightStrength * this.config.disadvantagePercent)) /
          attackerPaladinStrength /
          Percentage._100(),
      );
    let attackerPaladinStrengthWithDisadvantageMax =
      attackerPaladinStrength - Percentage.get(attackerPaladinStrength, this.config.disadvantagePercent);
    attackerPaladinStrengthWithDisadvantage = Math.max(
      attackerPaladinStrengthWithDisadvantage,
      attackerPaladinStrengthWithDisadvantageMax,
      0,
    );

    // Calculate total strength
    let attackerTotalKnightStrength =
      attackerKnightStrength +
      (attackerKnightStrengthWithAdvantage - attackerKnightStrength) -
      (attackerKnightStrength - attackerKnightStrengthWithDisadvantage);

    let attackerTotalCrossbowmanStrength =
      attackerCrossbowmanStrength +
      (attackerCrossbowmanStrengthWithAdvantage - attackerCrossbowmanStrength) -
      (attackerCrossbowmanStrength - attackerCrossbowmanStrengthWithDisadvantage);

    let attackerTotalPaladinStrength =
      attackerPaladinStrength +
      (attackerPaladinStrengthWithAdvantage - attackerPaladinStrength) -
      (attackerPaladinStrength - attackerPaladinStrengthWithDisadvantage);

    let attackerTotalStrength =
      attackerTotalKnightStrength + attackerTotalCrossbowmanStrength + attackerTotalPaladinStrength;

    return attackerTotalStrength;
  }

  computeDelta() {
    // Calculate strengths
    const attackStrength = this.strengthAgainst(this.attackArmy, this.defenceArmy);
    const defenceStrength = this.strengthAgainst(this.defenceArmy, this.attackArmy);
    if (attackStrength === 0 || defenceStrength === 0) {
      return [1, 1];
    }

    const biggerStrength = attackStrength >= defenceStrength ? attackStrength : defenceStrength;
    const smallerStrength = attackStrength <= defenceStrength ? attackStrength : defenceStrength;
    // Calculate damage received
    const attackSecondsToDie = 1 + Math.floor((100 * Number(this.attackArmy.count())) / 10 / defenceStrength);
    const attackSecondsTillDeathScaled =
      1 + Math.floor((Number(this.attackArmy.count()) * attackSecondsToDie) / this.config.battleTimeScale);
    const attackSecondsTillDeathLimited =
      1 +
      Math.floor(
        (this.config.battleMaxTimeSeconds * attackSecondsTillDeathScaled * smallerStrength) /
          (attackSecondsTillDeathScaled + 100_000) /
          biggerStrength,
      );
    const attackDamageReceived = 1 + Math.floor(Number(this.attackHealth.current) / attackSecondsTillDeathLimited);

    const defenceSecondsToDie = 1 + Math.floor((100 * Number(this.defenceArmy.count())) / 10 / attackStrength);
    const defenceSecondsTillDeathScaled =
      1 + Math.floor((Number(this.defenceArmy.count()) * defenceSecondsToDie) / this.config.battleTimeScale);
    const defenceSecondsTillDeathLimited =
      1 +
      Math.floor(
        (this.config.battleMaxTimeSeconds * defenceSecondsTillDeathScaled * smallerStrength) /
          (defenceSecondsTillDeathScaled + 100_000) /
          biggerStrength,
      );
    const defenceDamageReceived = 1 + Math.floor(Number(this.defenceHealth.current) / defenceSecondsTillDeathLimited);

    return [defenceDamageReceived, attackDamageReceived];
  }

  calculateDuration() {
    const [attackDelta, defenceDelta] = this.computeDelta();
    const attackStepsToDie = this.attackHealth.stepsToDie(BigInt(defenceDelta), this.config);
    const defenceStepsToDie = this.defenceHealth.stepsToDie(BigInt(attackDelta), this.config);

    return Math.min(attackStepsToDie, defenceStepsToDie);
  }

  private getUpdatedTroops = (
    health: Health,
    currentTroops: { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint },
  ): { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint } => {
    if (health.current > health.lifetime) {
      return {
        knight_count: 0n,
        paladin_count: 0n,
        crossbowman_count: 0n,
      };
    }

    if (health.lifetime === 0n) {
      return {
        knight_count: 0n,
        paladin_count: 0n,
        crossbowman_count: 0n,
      };
    }

    let knight_count = (health.current * currentTroops.knight_count) / health.lifetime;
    let paladin_count = (health.current * currentTroops.paladin_count) / health.lifetime;
    let crossbowman_count = (health.current * currentTroops.crossbowman_count) / health.lifetime;

    if (knight_count < EternumGlobalConfig.resources.resourcePrecision) {
      knight_count = 0n;
    }
    if (paladin_count < EternumGlobalConfig.resources.resourcePrecision) {
      paladin_count = 0n;
    }
    if (crossbowman_count < EternumGlobalConfig.resources.resourcePrecision) {
      crossbowman_count = 0n;
    }

    return {
      knight_count: knight_count - (knight_count % BigInt(EternumGlobalConfig.resources.resourcePrecision)),
      paladin_count: paladin_count - (paladin_count % BigInt(EternumGlobalConfig.resources.resourcePrecision)),
      crossbowman_count:
        crossbowman_count - (crossbowman_count % BigInt(EternumGlobalConfig.resources.resourcePrecision)),
    };
  };

  getWinner() {
    const [attackDelta, defenceDelta] = this.computeDelta();
    return attackDelta > defenceDelta ? this.attackArmy : this.defenceArmy;
  }

  getRemainingTroops() {
    const [attackDelta, defenceDelta] = this.computeDelta();

    const duration = this.calculateDuration();
    const attackerHealth = new Health({
      current: this.attackHealth.current - BigInt(defenceDelta) * BigInt(duration),
      lifetime: this.attackHealth.lifetime,
    });
    const defenderHealth = new Health({
      current: this.defenceHealth.current - BigInt(attackDelta) * BigInt(duration),
      lifetime: this.defenceHealth.lifetime,
    });

    const attackerTroops = this.getUpdatedTroops(attackerHealth, this.attackArmy);
    const defenderTroops = this.getUpdatedTroops(defenderHealth, this.defenceArmy);

    return {
      attackerTroops,
      defenderTroops,
    };
  }
}
