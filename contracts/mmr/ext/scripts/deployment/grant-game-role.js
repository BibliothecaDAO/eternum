import "colors";
import { Contract, hash, num } from "starknet";
import { getContractAddressFromCommonFolder } from "./libs/commands.js";
import { getAccount } from "./libs/network.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";

const { toHex } = num;

// GAME_ROLE selector matches Cairo's selector!("GAME_ROLE")
const GAME_ROLE = hash.getSelectorFromName("GAME_ROLE");

/**
 * Grant GAME_ROLE to a contract address on the MMR Token
 *
 * Usage: Pass the contract address as a command line argument
 * Example: bun grant-game-role.js 0x1234...
 */
export const grantGameRole = async (contractAddress) => {
  console.log("\n\n");
  console.log(`╔══════════════════════════════════════════════════════════╗`.green);
  console.log(`║        Grant GAME_ROLE on MMR Token                      ║`.green);
  console.log(`╚══════════════════════════════════════════════════════════╝`.green);
  console.log("\n");
  console.log(`╔═════════════════════════════════════════════════════════════════╗`.yellow);
  console.log("  Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.yellow);
  console.log("\n\n");

  exitIfDeclined(await confirmMainnetDeployment());

  if (!contractAddress) {
    throw new Error("Contract address is required as argument");
  }

  // Validate address format
  if (!contractAddress.startsWith("0x")) {
    throw new Error("Contract address must start with 0x");
  }

  // Get MMR token address from common folder
  const mmrTokenAddress = await getContractAddressFromCommonFolder("mmrToken");
  if (!mmrTokenAddress) {
    throw new Error("MMR Token address not found. Deploy the MMR Token first.");
  }

  console.log(`╔═════════════════════════════════════════════════════════════════╗`.cyan);
  console.log(`║ Grant GAME_ROLE:                                                ║`.cyan);
  console.log(`║   MMR Token:      ${mmrTokenAddress.slice(0, 20)}...`.white);
  console.log(`║   Grant To:       ${contractAddress.slice(0, 20)}...`.white);
  console.log(`║   Role:           GAME_ROLE`.white);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.cyan);
  console.log("\n");

  const account = getAccount();

  // Call grant_role on MMR Token
  // ABI for grant_role: fn grant_role(ref self: ContractState, role: felt252, account: ContractAddress)
  const calldata = [GAME_ROLE, contractAddress];

  console.log("Calling grant_role...".magenta);

  const tx = await account.execute({
    contractAddress: mmrTokenAddress,
    entrypoint: "grant_role",
    calldata,
  });

  console.log("Tx hash: ".green, tx.transaction_hash);
  await account.waitForTransaction(tx.transaction_hash);

  console.log("\n\n");
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.green);
  console.log(`    GAME_ROLE granted successfully!`.green);
  console.log(`    Contract: `.yellow + contractAddress.magenta);
  console.log(`    Network: `.yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.green);

  console.log("\n\n\n");
};

// Get contract address from command line arguments
const args = process.argv.slice(2);
const contractAddress = args[0];

if (!contractAddress) {
  console.error("Error: Contract address required".red);
  console.error("Usage: bun grant-game-role.js <contract_address>".yellow);
  process.exit(1);
}

grantGameRole(contractAddress)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
