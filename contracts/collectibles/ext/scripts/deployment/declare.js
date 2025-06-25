import { declareRealmsCollectibleContract } from "./libs/commands.js";

// Pretty console header
console.log("\n\n");
console.log(`╔══════════════════════════════════════════════════════════╗`.green);
console.log(`║                   Declaring Collectible                  ║`.green);
console.log(`╚══════════════════════════════════════════════════════════╝`.green);
console.log("\n");

const toHex = (address) => {
  return address.toString(16);
};

const class_hash = await declareRealmsCollectibleContract();

console.log("\n\n");
console.log(`╔════════════════════════════════════════════════════════════════════════════════════════════╗`.yellow);
console.log("    Collectible Class Hash: ".yellow + toHex(class_hash).magenta);
console.log(`╚════════════════════════════════════════════════════════════════════════════════════════════╝`.yellow);
console.log("\n\n");
