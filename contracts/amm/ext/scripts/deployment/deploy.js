import "colors";
import { deployAmmContract, resolveAmmLordsContractAddress, saveAmmAddressesToCommonFolder } from "./libs/commands.js";

console.log("\n\n");
console.log("╔══════════════════════════════════════════════════════════╗".green);
console.log("║                     Deploying AMM                       ║".green);
console.log("╚══════════════════════════════════════════════════════════╝".green);
console.log("\n");

const owner = BigInt(process.env.AMM_OWNER ?? process.env.STARKNET_ACCOUNT_ADDRESS);
const feeRecipient = BigInt(process.env.AMM_FEE_RECIPIENT ?? process.env.STARKNET_ACCOUNT_ADDRESS);
const lordsAddress = await resolveAmmLordsContractAddress();

console.log(`🔗 Using LORDS contract: ${lordsAddress.toString(16)}`);
console.log(`👤 AMM owner: ${owner.toString(16)}`);
console.log(`💸 Fee recipient: ${feeRecipient.toString(16)}`);

const deployment = await deployAmmContract({
  feeRecipient,
  lordsAddress,
  owner,
});

await saveAmmAddressesToCommonFolder({
  ammAddress: deployment.ammAddress,
  ammClassHash: deployment.ammClassHash,
  feeRecipient,
  lordsAddress,
  lpTokenClassHash: deployment.lpTokenClassHash,
  owner,
});

console.log("\n\n");
console.log("╔══════════════════════════════════════════════════════════════════════════════╗".yellow);
console.log("    AMM Contract: ".yellow + deployment.ammAddress.magenta);
console.log("    AMM Class Hash: ".yellow + deployment.ammClassHash.magenta);
console.log("    LP Token Class Hash: ".yellow + deployment.lpTokenClassHash.magenta);
console.log("    LORDS Contract: ".yellow + `0x${lordsAddress.toString(16)}`.magenta);
console.log("╚══════════════════════════════════════════════════════════════════════════════╝".yellow);
console.log(
  `\n\n💾 Saved AMM addresses to contracts/common/addresses/${process.env.STARKNET_NETWORK}.json and deployment addresses\n`,
);
