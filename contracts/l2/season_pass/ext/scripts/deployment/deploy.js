import {
  deploySeasonPassContract,
  deployTestLordsContract,
  deployTestRealmsContract,
  saveRelevantAddressesToCommonFolder,
  setSeasonPassAddressTestLordsContract,
} from "./libs/commands.js";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║                   Deploying Season Pass                  ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");

const toHex = (address) => {
  return address.toString(16);
};

// Contract address initialization
const presetRealmsAddress = BigInt(process.env.SEASON_PASS_PRESET_REALMS_ADDRESS);
const presetLordsAddress = BigInt(process.env.SEASON_PASS_PRESET_LORDS_ADDRESS);

let lordsContractAddress;
let realmsContractAddress;

// Realms contract deployment/setup
if (!presetRealmsAddress || BigInt(presetRealmsAddress) === BigInt(0)) {
  realmsContractAddress = await deployTestRealmsContract();
  console.log(`📦 Deployed new test Realms contract: ${toHex(realmsContractAddress)}`);
} else {
  realmsContractAddress = presetRealmsAddress;
  console.log(`🔗 Using preset Realms contract: ${toHex(realmsContractAddress)}`);
}

// Lords contract deployment/setup
if (!presetLordsAddress || BigInt(presetLordsAddress) === BigInt(0)) {
  lordsContractAddress = await deployTestLordsContract();
  console.log(`\n\n 📦 Deployed new test Lords contract: ${toHex(lordsContractAddress)}`);
} else {
  lordsContractAddress = presetLordsAddress;
  console.log(`\n\n 🔗 Using preset Lords contract: ${toHex(lordsContractAddress)}`);
}

// Deploy Season Pass contract
const seasonPassAddress = await deploySeasonPassContract(BigInt(realmsContractAddress), BigInt(lordsContractAddress));
console.log(`\n\n 🎫 Deployed Season Pass contract: ${toHex(seasonPassAddress)}`);

// Set Season Pass address in Lords contract if using test contract
if (!presetLordsAddress || BigInt(presetLordsAddress) === BigInt(0)) {
  await setSeasonPassAddressTestLordsContract(BigInt(lordsContractAddress), BigInt(seasonPassAddress));
  console.log(`\n\n ✔ Set Season Pass address in Lords contract \n\n`);
}

// Save addresses
await saveRelevantAddressesToCommonFolder(seasonPassAddress, realmsContractAddress, lordsContractAddress);

console.log("\n\n");
console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
console.log("    Season Pass Contract: ".yellow + toHex(seasonPassAddress).magenta);
console.log("    Lords Contract: ".yellow + toHex(lordsContractAddress).magenta);
console.log("    Realms Contract: ".yellow + toHex(realmsContractAddress).magenta);
console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);
console.log(
  `\n\n 💾 Saved contract addresses to common folder (contracts/common/addresses/${process.env.STARKNET_NETWORK}.json)`,
);
console.log("\n\n\n");
