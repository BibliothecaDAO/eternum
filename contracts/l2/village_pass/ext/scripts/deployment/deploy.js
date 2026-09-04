import { deployVillagePassContract, saveVillagePassAddressToCommonFolder } from "./libs/commands.js";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║                   Deploying Village Pass                 ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");

const toHex = (address) => {
  return address.toString(16);
};

// Deploy Village Pass contract
const villagePassAddress = await deployVillagePassContract();
console.log(`\n\n 🎫 Deployed Village Pass contract: ${toHex(villagePassAddress)}`);

// Save addresses
await saveVillagePassAddressToCommonFolder(villagePassAddress);

console.log("\n\n");
console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
console.log("    Village Pass Contract: ".yellow + toHex(villagePassAddress).magenta);
console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);
console.log(
  `\n\n 💾 Saved contract addresses to common folder (contracts/common/addresses/${process.env.STARKNET_NETWORK}.json)`,
);
console.log("\n\n\n");
