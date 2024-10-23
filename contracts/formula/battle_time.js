// battle_time_calculator.js

class Percentage {
  static _100() {
    return 10_000;
  }

  static get(value, numerator) {
    return (value * numerator) / Percentage._100();
  }
}

class TroopConfig {
  constructor(
    health,
    knightStrength,
    paladinStrength,
    crossbowmanStrength,
    advantagePercent,
    disadvantagePercent,
    battleTimeScale,
    battleMaxTimeSeconds
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

const TroopType = {
  KNIGHT: 1,
  PALADIN: 2,
  CROSSBOWMAN: 3,
};

class Troops {
  constructor(knightCount, paladinCount, crossbowmanCount) {
    this.knightCount = knightCount * Troops.normalizationFactor();
    this.paladinCount = paladinCount * Troops.normalizationFactor();
    this.crossbowmanCount = crossbowmanCount * Troops.normalizationFactor();
  }

  count() {
    return this.knightCount + this.paladinCount + this.crossbowmanCount;
  }

  fullHealth(config) {
    const singleTroopHealth = config.health;
    const totalKnightHealth = singleTroopHealth * this.knightCount;
    const totalPaladinHealth = singleTroopHealth * this.paladinCount;
    const totalCrossbowmanHealth = singleTroopHealth * this.crossbowmanCount;
    return totalKnightHealth + totalPaladinHealth + totalCrossbowmanHealth;
  }

  static normalizationFactor() {
    return 1000;
  }
}

class Health {
  constructor(current, lifetime) {
    this.current = current;
    this.lifetime = lifetime;
  }

  stepsToDie(deduction, config) {
    if (this.current === 0 || deduction === 0) {
      return 0;
    }

    const singleTroopHealth = config.health * Troops.normalizationFactor();

    if (this.current <= deduction) {
      return 1;
    }

    if (this.current % singleTroopHealth !== 0) {
      throw new Error("Health is not a multiple of normalization factor.");
    }

    let numSteps;
    if (deduction >= singleTroopHealth) {
      numSteps = Math.floor(this.current / deduction);
      if (this.current % deduction > 0) {
        numSteps += 1;
      }
    } else {
      const currentLessOneTroop = this.current - singleTroopHealth;
      numSteps = Math.floor(currentLessOneTroop / deduction);
      numSteps += 1;
    }

    return numSteps;
  }
}

class Battle {
  constructor(attackArmy, defenceArmy, attackHealth, defenceHealth, config) {
    this.attackArmy = attackArmy;
    this.defenceArmy = defenceArmy;
    this.attackHealth = attackHealth;
    this.defenceHealth = defenceHealth;
    this.config = config;
  }

  strengthAgainst(attacker, defender) {
    // Calculate total strength with advantages and disadvantages

    // get default strength
    let attackerKnightStrength = 1 + attacker.knightCount * this.config.knightStrength;
    console.log("attackerKnightStrength:", attackerKnightStrength);
    let attackerPaladinStrength = 1 + attacker.paladinCount * this.config.paladinStrength;
    console.log("attackerPaladinStrength:", attackerPaladinStrength);
    let attackerCrossbowmanStrength = 1 + attacker.crossbowmanCount * this.config.crossbowmanStrength;
    console.log("attackerCrossbowmanStrength:", attackerCrossbowmanStrength);

    let defenderKnightStrength = 1 + defender.knightCount * this.config.knightStrength;
    console.log("defenderKnightStrength:", defenderKnightStrength);
    let defenderPaladinStrength = 1 + defender.paladinCount * this.config.paladinStrength;
    console.log("defenderPaladinStrength:", defenderPaladinStrength);
    let defenderCrossbowmanStrength = 1 + defender.crossbowmanCount * this.config.crossbowmanStrength;
    console.log("defenderCrossbowmanStrength:", defenderCrossbowmanStrength);

    /* knight advantage calculation against enemy paladin */

    let attackerKnightStrengthWithAdvantage =
      attackerKnightStrength +
      Math.floor((defenderPaladinStrength * this.config.advantagePercent) / attackerKnightStrength / Percentage._100());
    console.log("attackerKnightStrengthWithAdvantage", attackerKnightStrengthWithAdvantage);
    // attacker can only get a max of advantagePercent of its own size
    let attackerKnightStrengthWithAdvantageMax =
      attackerKnightStrength + Percentage.get(attackerKnightStrength, this.config.advantagePercent);
    attackerKnightStrengthWithAdvantage = Math.min(
      attackerKnightStrengthWithAdvantage,
      attackerKnightStrengthWithAdvantageMax,
    );
    console.log("attackerKnightStrengthWithAdvantageMax", attackerKnightStrengthWithAdvantageMax);

    /* knight disadvantage calculation against enemy crossbowman */

    let attackerKnightStrengthWithDisadvantage =
      attackerKnightStrength -
      Math.floor(
        (defenderCrossbowmanStrength * this.config.disadvantagePercent) / attackerKnightStrength / Percentage._100(),
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
        (defenderKnightStrength * this.config.advantagePercent) / attackerCrossbowmanStrength / Percentage._100(),
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
        (defenderPaladinStrength * this.config.disadvantagePercent) / attackerCrossbowmanStrength / Percentage._100(),
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
        (defenderCrossbowmanStrength * this.config.advantagePercent) / attackerPaladinStrength / Percentage._100(),
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
        (defenderKnightStrength * this.config.disadvantagePercent) / attackerPaladinStrength / Percentage._100(),
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
    console.log("attackerTotalKnightStrength:", attackerTotalKnightStrength);

    let attackerTotalCrossbowmanStrength =
      attackerCrossbowmanStrength +
      (attackerCrossbowmanStrengthWithAdvantage - attackerCrossbowmanStrength) -
      (attackerCrossbowmanStrength - attackerCrossbowmanStrengthWithDisadvantage);
    console.log("attackerTotalCrossbowmanStrength:", attackerTotalCrossbowmanStrength);

    let attackerTotalPaladinStrength =
      attackerPaladinStrength +
      (attackerPaladinStrengthWithAdvantage - attackerPaladinStrength) -
      (attackerPaladinStrength - attackerPaladinStrengthWithDisadvantage);
    console.log("attackerTotalPaladinStrength:", attackerTotalPaladinStrength);

    let attackerTotalStrength =
      attackerTotalKnightStrength + attackerTotalCrossbowmanStrength + attackerTotalPaladinStrength;
    console.log("attackerTotalStrength:", attackerTotalStrength);

    return attackerTotalStrength;
  }

  computeDelta() {
    // Calculate strengths
    console.log("Attack strength:");
    const attackStrength = this.strengthAgainst(this.attackArmy, this.defenceArmy);
    console.log("Defense strength:");
    const defenceStrength = this.strengthAgainst(this.defenceArmy, this.attackArmy);

    if (attackStrength === 0 || defenceStrength === 0) {
      return [1, 1];
    }

     const biggerStrength = attackStrength >= defenceStrength ? attackStrength : defenceStrength;
     const smallerStrength = attackStrength <= defenceStrength ? attackStrength : defenceStrength
    // Calculate damage received
    const attackSecondsToDie = 1 + Math.floor((100 * this.attackArmy.count()) / 10 / defenceStrength);
    const attackSecondsTillDeathScaled =
      1 + Math.floor((this.attackArmy.count() * attackSecondsToDie) / this.config.battleTimeScale);    
    const attackTT = Math.floor(this.config.battleMaxTimeSeconds * attackSecondsTillDeathScaled * smallerStrength / (attackSecondsTillDeathScaled + 100_000) / biggerStrength);
    const attackDamageReceived = 1 + Math.floor(this.attackHealth.current / attackTT);

    const defenceSecondsToDie = 1 + Math.floor((100 * this.defenceArmy.count()) / 10 / attackStrength);
    const defenceSecondsTillDeathScaled =
      1 + Math.floor((this.defenceArmy.count() * defenceSecondsToDie) / this.config.battleTimeScale);
    const defenceTT = Math.floor(this.config.battleMaxTimeSeconds * defenceSecondsTillDeathScaled * smallerStrength / (defenceSecondsTillDeathScaled + 100_000) / biggerStrength);
    const defenceDamageReceived = 1 + Math.floor(this.defenceHealth.current / defenceTT);

    return [defenceDamageReceived, attackDamageReceived];
  }

  calculateDuration() {
    const [attackDelta, defenceDelta] = this.computeDelta();
    const attackStepsToDie = this.attackHealth.stepsToDie(defenceDelta, this.config);
    const defenceStepsToDie = this.defenceHealth.stepsToDie(attackDelta, this.config);

    if (attackStepsToDie > defenceStepsToDie) {
      console.log("\n Attack Wins!!! \n");
    }
    if (attackStepsToDie < defenceStepsToDie) {
      console.log("\n Defence Wins!!! \n");
    }
    if (attackStepsToDie == defenceStepsToDie) {
      console.log("\n Both Attack and Defence lose \n");
    }
    return Math.min(attackStepsToDie, defenceStepsToDie);
  }
}

// Example Usage and Testing
function main() {
  // Define troop configuration
  const config = new TroopConfig(
    1, // health
    1, // knightStrength
    1, // paladinStrength
    1, // crossbowmanStrength
    1_000, // advantagePercent (10%)
    1_000, // disadvantagePercent (10%)

    1000, // battleTimeScale
    2 * 86400, // battleMaxTimeSeconds // 2 days
    /////////// BIG NOTE ///
    //
    // ADJUST THIS SCALE TO SEE HOW BATTLE TIME INCREASES/ DECREASES
    //
    // if you double the current value, the battle time reduces by 2x
    // if you reduce by 2, battle time increases by 2x
    //
    ///////////////////////////////////////
  );

  // Define attacking and defending troops
  const attacker1 = new Troops(100, 0, 0);
  const defender1 = new Troops(100, 0, 0);
  runBattle(attacker1, defender1, config, "Equal troops");

  // Test case 2: Attacker advantage
  const attacker2 = new Troops(0, 100, 0);
  const defender2 = new Troops(0, 100, 0);
  runBattle(attacker2, defender2, config, "Attacker advantage");
}

function runBattle(attacker, defender, config, testCase) {
  console.log(`\n--- Test Case: ${testCase} ---`);
  console.log("Attacker:", attacker);
  console.log("Defender:", defender);

  // Calculate full health for both armies
  const attackHealth = new Health(attacker.fullHealth(config), attacker.fullHealth(config));
  const defenceHealth = new Health(defender.fullHealth(config), defender.fullHealth(config));

  // Initialize Battle
  const battle = new Battle(attacker, defender, attackHealth, defenceHealth, config);

  // Calculate Battle Duration
  const durationSteps = battle.calculateDuration();
  console.log(`Battle Duration (in steps): ${durationSteps}`);

  // Convert steps to actual time if each step represents a second
  const days = Math.floor(durationSteps / 86400);
  const hours = Math.floor((durationSteps % 86400) / 3600);
  const minutes = Math.floor((durationSteps % 3600) / 60);
  const seconds = durationSteps % 60;
  console.log(`Battle Duration: ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`);
}

main();
