import { deployAllSeasonResourceContract, grantMinterRoleToInGameBridge } from "./libs/commands.js";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║             Deploying Season Resource ERC20s             ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");
  
// const toHex = (address) => {
//     return "0x" + address.toString(16);
// }

await deployAllSeasonResourceContract();
console.log(`📦 Deployed new Season Resource ERC20 contracts`.green);

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║          Granting Minter Role to In-Game Bridge          ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");
await grantMinterRoleToInGameBridge();
console.log(`✔ Granted minter role to the in-game bridge system for all Season Resource ERC20 contracts`.green);
console.log("\n\n\n");

console.log(`📦 Saved erc20 addresses to common folder (contracts/common/addresses/erc20s/${process.env.STARKNET_NETWORK}.json)`);
console.log("\n\n\n");
  