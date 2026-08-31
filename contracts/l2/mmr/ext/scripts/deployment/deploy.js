import "colors";
import { num } from "starknet";
import { deployMMRTokenContract } from "./libs/commands.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";

const { toHex } = num;

/**
 * Deploy MMR Token Contract
 *
 * Constructor parameters:
 * - default_admin: ContractAddress - Admin who can grant/revoke roles
 * - upgrader: ContractAddress - Account with UPGRADER_ROLE (can upgrade contract)
 */
export const deployMMRToken = async () => {
  console.log("\n\n");
  console.log(`╔══════════════════════════════════════════════════════════╗`.green);
  console.log(`║        Deploying Blitz MMR Token Contract                ║`.green);
  console.log(`╚══════════════════════════════════════════════════════════╝`.green);
  console.log("\n");
  console.log(`╔═════════════════════════════════════════════════════════════════╗`.yellow);
  console.log("  Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.yellow);
  console.log("\n\n");

  exitIfDeclined(await confirmMainnetDeployment());

  // Read environment variables for constructor
  const defaultAdmin = process.env.MMR_DEFAULT_ADMIN;
  const upgrader = process.env.MMR_UPGRADER;

  if (!defaultAdmin) {
    throw new Error("MMR_DEFAULT_ADMIN environment variable is not set");
  }

  if (!upgrader) {
    throw new Error("MMR_UPGRADER environment variable is not set");
  }

  console.log(`╔═════════════════════════════════════════════════════════════════╗`.cyan);
  console.log(`║ Constructor Parameters:                                         ║`.cyan);
  console.log(`║   Default Admin: ${defaultAdmin.slice(0, 20)}...`.white);
  console.log(`║   Upgrader:      ${upgrader.slice(0, 20)}...`.white);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.cyan);
  console.log("\n");

  // Deploy MMR Token contract
  const mmrTokenAddress = await deployMMRTokenContract(defaultAdmin, upgrader);

  console.log(`\n\n 🎮 Deployed MMR Token contract: ${toHex(mmrTokenAddress)}`);

  console.log("\n\n");
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
  console.log(`    Contract: Deployed `.yellow + toHex(mmrTokenAddress).magenta + " ");
  console.log("    Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);

  console.log("\n\n\n");

  return mmrTokenAddress;
};
