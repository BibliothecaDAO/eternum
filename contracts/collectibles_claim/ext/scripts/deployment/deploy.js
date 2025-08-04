import { deployCosmeticsClaimContract } from "./libs/commands.js";
import { confirmMainnetDeployment, exitIfDeclined } from "./utils.js";

/**
 * Deploy a Cosmetics Claim contract with the specified name and symbol
 * All other parameters are read from environment variables
 *
 * @param {string} cosmeticsContract - The address of the Cosmetics contract
 * @param {string} paymentContract - The address of the Payment contract
 * @param {string} vrfProvider - The address of the VRF provider contract
 * @param {string} defaultAdmin - The address of the default admin
 * @param {string} upgrader - The address of the upgrader
 * @returns {Promise<bigint>} The deployed contract address
 */
export const deployCosmeticsClaim = async () => {

  // Pretty console header
  console.log("\n\n");
  console.log(`╔══════════════════════════════════════════════════════════╗`.green);
  console.log(`║ Deploying Cosmetics Claim Contract║`.green);
  console.log(`╚══════════════════════════════════════════════════════════╝`.green);
  console.log("\n");
  console.log(`╔═════════════════════════════════════════════════════════════════╗`.yellow);
  console.log("  Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚═════════════════════════════════════════════════════════════════╝`.yellow);
  console.log("\n\n");

  // Contract parameters from environment variables
  const cosmeticsContract = BigInt(process.env.COLLECTIBLES_COSMETICS_CONTRACT);
  const paymentContract = BigInt(process.env.COLLECTIBLES_COSMETICS_PAYMENT_CONTRACT);
  const vrfProvider = BigInt(process.env.COLLECTIBLES_COSMETICS_VRF_PROVIDER);
  const defaultAdmin = BigInt(process.env.COLLECTIBLES_COSMETICS_CLAIM_DEFAULT_ADMIN);
  const upgrader = BigInt(process.env.COLLECTIBLES_COSMETICS_CLAIM_UPGRADER);

  console.log(`📝 Contract Configuration:`);
  console.log(`   Cosmetics Contract: ${toHex(cosmeticsContract)}`);
  console.log(`   Payment Contract: ${toHex(paymentContract)}`);
  console.log(`   VRF Provider: ${toHex(vrfProvider)}`);
  console.log(`   Default Admin: ${toHex(defaultAdmin)}`);
  console.log(`   Upgrader: ${toHex(upgrader)}`);

  exitIfDeclined(await confirmMainnetDeployment());

  // Deploy RealmsCollectible contract
  const cosmeticsClaimAddress = await deployCosmeticsClaimContract(
    cosmeticsContract,
    paymentContract,
    vrfProvider,
    defaultAdmin,
    upgrader,
  );

  console.log(`\n\n 🎨 Deployed Cosmetics Claim contract: ${toHex(cosmeticsClaimAddress)}`);

  
  console.log("\n\n");
  console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
  console.log(`     Cosmetics Claim Contract: Deployed `.yellow + toHex(cosmeticsClaimAddress).magenta + " ");
  console.log("    Network: ".yellow + process.env.STARKNET_NETWORK.magenta);
  console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);

  console.log("\n\n\n");

  return cosmeticsClaimAddress;
};

const toHex = (address) => {
  if (typeof address === "string" && address.startsWith("0x")) {
    return address;
  }
  return "0x" + address.toString(16);
};


await deployCosmeticsClaim();