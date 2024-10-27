import { Battle, Health, TroopConfig, TroopsSimulator as Troops } from "@bibliothecadao/eternum";

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
  const attacker1 = new Troops(100n, 0n, 0n);
  const defender1 = new Troops(100n, 0n, 0n);
  runBattle(attacker1, defender1, config, "Equal troops");

  // Test case 2: Attacker advantage
  const attacker2 = new Troops(0n, 100n, 0n);
  const defender2 = new Troops(0n, 100n, 0n);
  runBattle(attacker2, defender2, config, "Attacker advantage");
}

function runBattle(attacker, defender, config, testCase) {
  console.log(`\n--- Test Case: ${testCase} ---`);
  console.log("Attacker:", attacker);
  console.log("Defender:", defender);

  // Calculate full health for both armies
  const attackHealth = new Health({ current: attacker.fullHealth(config), lifetime: attacker.fullHealth(config) });
  const defenceHealth = new Health({ current: defender.fullHealth(config), lifetime: defender.fullHealth(config) });

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
