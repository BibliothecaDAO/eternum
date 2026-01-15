import { deployLordsContract, saveContractAddressToCommonFolder } from "./libs/commands.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";

export const deployLords = async () => {
  const name = "lords";
  const symbol = "$lords";
  // Pretty console header
  console.log("\n\n");
  console.log(`╔══════════════════════════════════════════════════════════╗`.green);
  console.log(`║ Deploying Lords [${name} (${symbol})] ║`.green);
  console.log(`╚══════════════════════════════════════════════════════════╝`.green);
  console.log("\n");
  console.log(`╔═════════════════════════════════════════════════════════════════╗`.yellow);
  console.log("  Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.yellow);
  console.log("\n\n");

  exitIfDeclined(await confirmMainnetDeployment());

  // Deploy Test Lords contract
  const lordsAddress = await deployLordsContract();

  await saveContractAddressToCommonFolder("lords", lordsAddress);

  console.log(`\n\n 🎨 Deployed Test Lords contract: ${toHex(lordsAddress)}`);

  console.log("\n\n");
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
  console.log(`     ${name} Contract: Deployed `.yellow + toHex(lordsAddress).magenta + " ");
  console.log("    Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);

  console.log("\n\n\n");

  return lordsAddress;
};

const toHex = (address) => {
  if (typeof address === "string" && address.startsWith("0x")) {
    return address;
  }
  return "0x" + address.toString(16);
};

await deployLords();
