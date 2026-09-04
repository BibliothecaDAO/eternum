import "colors";
import readline from "readline";

/**
 * Prompts user for confirmation when deploying to mainnet
 * Shows a beautiful warning dialog and waits for user confirmation
 *
 * @returns {Promise<boolean>} True if user confirms, false otherwise
 */
export const confirmMainnetDeployment = async () => {
  const network = process.env.STARKNET_NETWORK?.toLowerCase();

  if (network !== "mainnet") {
    return true; // No confirmation needed for non-mainnet networks
  }

  console.log("\n\n");
  console.log(`╔═══════════════════════════════════════════════════════════════════════════════════════╗`.red);
  console.log(`║                                    ⚠️  WARNING ⚠️                                     ║`.red);
  console.log(`║                                                                                       ║`.red);
  console.log(`║                           🚨 MAINNET DEPLOYMENT DETECTED 🚨                          ║`.red);
  console.log(`║                                                                                       ║`.red);
  console.log(`║  You are about to deploy to MAINNET!                  ║`.yellow);
  console.log(`║                                                                                       ║`.red);
  console.log(`║  Please double-check:                                                                ║`.white);
  console.log(`║  • Contract parameters are correct                                                    ║`.white);
  console.log(`║  • You have sufficient funds for deployment                                          ║`.white);
  console.log(`║                                                                                       ║`.red);
  console.log(`╚═══════════════════════════════════════════════════════════════════════════════════════╝`.red);
  console.log("\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const askConfirmation = () => {
      rl.question(`🤔 Do you want to continue with MAINNET deployment? (yes/no): `.cyan.bold, (answer) => {
        const cleanAnswer = answer.trim().toLowerCase();

        if (cleanAnswer === "yes" || cleanAnswer === "y") {
          console.log("\n");
          console.log(`✅ Proceeding with MAINNET deployment...`.green.bold);
          console.log("\n");
          rl.close();
          resolve(true);
        } else if (cleanAnswer === "no" || cleanAnswer === "n") {
          console.log("\n");
          console.log(`❌ Deployment cancelled by user.`.red.bold);
          console.log("\n");
          rl.close();
          resolve(false);
        } else {
          console.log(`❓ Please answer 'yes' or 'no' (or 'y'/'n')`.yellow);
          askConfirmation();
        }
      });
    };

    askConfirmation();
  });
};

/**
 * Exits the process gracefully if user chooses not to continue
 *
 * @param {boolean} shouldContinue - Result from confirmMainnetDeployment
 */
export const exitIfDeclined = (shouldContinue) => {
  if (!shouldContinue) {
    console.log(`👋 Goodbye!`.cyan);
    process.exit(0);
  }
};
