import "colors";
import { getContractAddressFromCommonFolder } from "./libs/commands.js";
import { getAccount } from "./libs/network.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";

const DEFAULT_FACTORY_VERSION = 180n;

/**
 * Set MMR factory details.
 *
 * Usage:
 *   bun set-factory-address.js <factory_address>
 *
 * Optional env:
 *   MMR_FACTORY_VERSION (defaults to 1)
 */
export const setFactoryAddress = async (factoryAddress) => {
  console.log("\n\n");
  console.log(`╔══════════════════════════════════════════════════════════╗`.green);
  console.log(`║     Set MMR Factory Address & Version                    ║`.green);
  console.log(`╚══════════════════════════════════════════════════════════╝`.green);
  console.log("\n");
  console.log(`╔═════════════════════════════════════════════════════════════════╗`.yellow);
  console.log("  Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.yellow);
  console.log("\n\n");

  exitIfDeclined(await confirmMainnetDeployment());

  if (!factoryAddress) {
    throw new Error("Factory address is required as argument");
  }
  if (!factoryAddress.startsWith("0x")) {
    throw new Error("Factory address must start with 0x");
  }

  const mmrTokenAddress = await getContractAddressFromCommonFolder("mmrToken");
  if (!mmrTokenAddress) {
    throw new Error("MMR Token address not found. Deploy the MMR Token first.");
  }

  const factoryVersion = process.env.MMR_FACTORY_VERSION
    ? BigInt(process.env.MMR_FACTORY_VERSION)
    : DEFAULT_FACTORY_VERSION;

  console.log(`╔═════════════════════════════════════════════════════════════════╗`.cyan);
  console.log(`║ Set Factory Details:                                            ║`.cyan);
  console.log(`║   MMR Token:      ${mmrTokenAddress.slice(0, 20)}...`.white);
  console.log(`║   Factory Addr:   ${factoryAddress.slice(0, 20)}...`.white);
  console.log(`║   Factory Ver:    ${factoryVersion.toString()}`.white);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.cyan);
  console.log("\n");

  const account = getAccount();
  const calldata = [factoryAddress, factoryVersion];

  console.log("Calling set_factory_details...".magenta);
  const tx = await account.execute({
    contractAddress: mmrTokenAddress,
    entrypoint: "set_factory_details",
    calldata,
  });

  console.log("Tx hash: ".green, tx.transaction_hash);
  await account.waitForTransaction(tx.transaction_hash);

  console.log("\n\n");
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.green);
  console.log(`    Factory details updated successfully!`.green);
  console.log(`    Factory: `.yellow + factoryAddress.magenta);
  console.log(`    Version: `.yellow + factoryVersion.toString().magenta);
  console.log(`    Network: `.yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.green);
  console.log("\n\n\n");
};

const args = process.argv.slice(2);
if (args[0] === "--") {
  args.shift();
}
const factoryAddress = args[0];

if (!factoryAddress) {
  console.error("Error: Factory address required".red);
  console.error("Usage: bun set-factory-address.js <factory_address>".yellow);
  process.exit(1);
}

setFactoryAddress(factoryAddress)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
